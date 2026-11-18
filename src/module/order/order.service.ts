import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession, Types } from 'mongoose';
import Stripe from 'stripe';
import {
  CartRepository,
  OrderRepository,
  CouponRepository,
  ProductRepository,
  HUserDocument,
} from '../../DB';
import { CreateOrderDto } from './order.dto';
import { OrderStatus, PaymentMethod } from '../../common/enums/order.enum';
import { StripeService } from '../../common/services/email/stripe.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly OrderRepository: OrderRepository,
    private readonly CartRepository: CartRepository,
    private readonly CouponRepository: CouponRepository,
    private readonly ProductRepository: ProductRepository,
    private readonly stripeService: StripeService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async createOrder(body: CreateOrderDto, user: HUserDocument) {
    return this.connection.transaction(async (session) => {
      const options = { session };
      const cart = await this.CartRepository.findOne(
        { createdBy: user._id },
        undefined,
        options,
      );
      if (!cart?.products.length)
        throw new BadRequestException('Cart is empty');
      const items: {
        productId: Types.ObjectId;
        name: string;
        quantity: number;
        unitPrice: number;
      }[] = [];
      let subtotalCents = 0;
      for (const item of cart.products) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
          throw new BadRequestException('Invalid quantity');
        const product = await this.ProductRepository.findOneAndUpdate({
          filter: {
            _id: item.productId,
            deletedAt: { $exists: false },
            stock: { $gte: item.quantity },
          },
          update: { $inc: { stock: -item.quantity } },
          options,
        });
        if (!product)
          throw new BadRequestException(
            'A product is unavailable or has insufficient stock',
          );
        const cents = Math.round(product.price * 100);
        if (!Number.isSafeInteger(cents) || cents < 0)
          throw new BadRequestException('Invalid product price');
        subtotalCents += cents * item.quantity;
        items.push({
          productId: product._id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: cents / 100,
        });
      }
      let coupon;
      if (body.couponCode) {
        coupon = await this.CouponRepository.findOneAndUpdate({
          filter: {
            code: body.couponCode.trim().toLowerCase(),
            usedBy: { $ne: user._id },
            fromDate: { $lte: new Date() },
            toDate: { $gt: new Date() },
            deletedAt: { $exists: false },
          },
          update: { $addToSet: { usedBy: user._id } },
          options,
        });
        if (!coupon || coupon.amount < 0 || coupon.amount > 100)
          throw new BadRequestException(
            'Invalid, expired or previously used coupon',
          );
      }
      const totalCents = Math.round(
        subtotalCents * (1 - (coupon?.amount || 0) / 100),
      );
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0)
        throw new BadRequestException('Order total must be positive');
      const order = await this.OrderRepository.create(
        {
          userId: user._id,
          cart: cart._id,
          coupon: coupon?._id,
          items,
          totalPrice: totalCents / 100,
          currency: 'egp',
          address: body.address,
          phone: body.phone,
          paymentMethod: body.paymentMethod,
          orderStatus:
            body.paymentMethod === PaymentMethod.CASH
              ? OrderStatus.PROCESSING
              : OrderStatus.PENDING,
          stockReleased: false,
        },
        session,
      );
      // Clearing the cart and reserving stock commit together. Orders own their immutable item snapshot.
      await this.CartRepository.findOneAndUpdate({
        filter: { _id: cart._id, __v: cart.__v },
        update: { $set: { products: [], subTotal: 0 }, $inc: { __v: 1 } },
        options,
      });
      return order;
    });
  }

  async paymentWithStripe(id: Types.ObjectId, user: HUserDocument) {
    const order = await this.OrderRepository.findOne({
      _id: id,
      userId: user._id,
      paymentMethod: PaymentMethod.CARD,
      orderStatus: OrderStatus.PENDING,
    });
    if (!order || !order.items?.length)
      throw new NotFoundException('Pending card order not found');
    if (order.checkoutSessionId)
      return this.stripeService.getSession(order.checkoutSessionId);
    const checkout = await this.stripeService.createCheckoutSession(
      {
        customer_email: user.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        line_items: [
          {
            price_data: {
              currency: order.currency,
              product_data: {
                name: `Order ${order.id}`,
                description: order.items
                  .map((i) => `${i.quantity} × ${i.name}`)
                  .join(', ')
                  .slice(0, 500),
              },
              unit_amount: Math.round(order.totalPrice * 100),
            },
            quantity: 1,
          },
        ],
      },
      `checkout-${order.id}`,
    );
    const saved = await this.OrderRepository.findOneAndUpdate({
      filter: { _id: order._id, orderStatus: OrderStatus.PENDING },
      update: { checkoutSessionId: checkout.id },
    });
    if (!saved) {
      await this.stripeService.expireSession(checkout.id);
      throw new ConflictException('Order was cancelled');
    }
    return checkout;
  }

  async webhook(raw: Buffer | undefined, signature: string | undefined) {
    const event = this.stripeService.verifyWebhook(raw, signature);
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      if (checkout.payment_status !== 'paid') return { received: true };
      const order = await this.OrderRepository.findOne({
        checkoutSessionId: checkout.id,
        paymentMethod: PaymentMethod.CARD,
      });
      if (!order)
        throw new ConflictException('Checkout is not attached to an order yet');
      if (
        checkout.metadata?.orderId !== order.id ||
        checkout.amount_total !== Math.round(order.totalPrice * 100) ||
        checkout.currency !== order.currency ||
        typeof checkout.payment_intent !== 'string'
      )
        throw new BadRequestException('Payment does not match order');
      await this.OrderRepository.findOneAndUpdate({
        filter: { _id: order._id, orderStatus: OrderStatus.PENDING },
        update: {
          orderStatus: OrderStatus.PAID,
          paymentIntentId: checkout.payment_intent,
          'orderChanges.paidAt': new Date(),
        },
      });
    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      await this.release(
        { checkoutSessionId: checkout.id, orderStatus: OrderStatus.PENDING },
        OrderStatus.CANCELLED,
      );
    } else if (
      event.type === 'refund.updated' ||
      event.type === 'refund.created'
    ) {
      const refund = event.data.object as Stripe.Refund;
      if (refund.status === 'succeeded') {
        await this.release(
          { refundId: refund.id, orderStatus: OrderStatus.REFUND_PENDING },
          OrderStatus.REFUNDED,
        );
      }
    }
    return { received: true };
  }

  private async release(
    filter: object,
    status: OrderStatus,
    actor?: Types.ObjectId,
  ) {
    return this.connection.transaction(async (session: ClientSession) => {
      const order = await this.OrderRepository.findOneAndUpdate({
        filter: { ...filter, stockReleased: false },
        update: {
          stockReleased: true,
          orderStatus: status,
          [status === OrderStatus.REFUNDED
            ? 'orderChanges.refundedAt'
            : 'orderChanges.cancelledAt']: new Date(),
          ...(actor
            ? {
                [status === OrderStatus.REFUNDED
                  ? 'orderChanges.refundedBy'
                  : 'orderChanges.cancelledBy']: actor,
              }
            : {}),
        },
        options: { session },
      });
      if (!order) return null;
      if (!order.items?.length)
        throw new ConflictException(
          'Legacy order requires manual reconciliation',
        );
      for (const item of order.items) {
        await this.ProductRepository.findOneAndUpdate({
          filter: { _id: item.productId },
          update: { $inc: { stock: item.quantity } },
          options: { session },
        });
      }
      if (order.coupon)
        await this.CouponRepository.findOneAndUpdate({
          filter: { _id: order.coupon },
          update: { $pull: { usedBy: order.userId } },
          options: { session },
        });
      return order;
    });
  }

  async refundOrder(id: Types.ObjectId, user: HUserDocument) {
    const order = await this.OrderRepository.findOne({ _id: id });
    if (!order) throw new NotFoundException('Order not found');
    if (
      [OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(order.orderStatus)
    )
      return order;
    if (
      [OrderStatus.PAID, OrderStatus.REFUND_PENDING].includes(
        order.orderStatus,
      ) &&
      order.paymentMethod === PaymentMethod.CARD
    ) {
      if (!order.paymentIntentId)
        throw new ConflictException('Order has no payment intent');
      const refund = await this.stripeService.createRefundedPayment(
        order.paymentIntentId,
        `refund-${order.id}`,
      );
      if (refund.status === 'failed' || refund.status === 'canceled')
        throw new BadRequestException(
          'Refund was not successful; reconcile with Stripe',
        );
      await this.OrderRepository.findOneAndUpdate({
        filter: {
          _id: id,
          orderStatus: { $in: [OrderStatus.PAID, OrderStatus.REFUND_PENDING] },
        },
        update: {
          refundId: refund.id,
          orderStatus: OrderStatus.REFUND_PENDING,
        },
      });
      if (refund.status === 'succeeded')
        return this.release(
          { _id: id, orderStatus: OrderStatus.REFUND_PENDING },
          OrderStatus.REFUNDED,
          user._id,
        );
      return this.OrderRepository.findOne({ _id: id });
    }
    if (
      ![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.orderStatus)
    )
      throw new BadRequestException('Order cannot be cancelled');
    if (order.checkoutSessionId) {
      const checkout = await this.stripeService.getSession(
        order.checkoutSessionId,
      );
      if (checkout.status === 'complete')
        throw new ConflictException(
          'Payment is being processed; wait for the webhook',
        );
      if (checkout.status === 'open')
        await this.stripeService.expireSession(checkout.id);
    }
    return this.release(
      { _id: id, orderStatus: order.orderStatus },
      OrderStatus.CANCELLED,
      user._id,
    );
  }
}
