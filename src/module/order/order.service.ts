/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CartRepository,
  OrderRepository,
  CouponRepository,
  ProductRepository,
  HUserDocument,
} from 'src/DB';
import { CreateOrderDto } from './order.dto';
import { OrderStatus, PaymentMethod } from 'src/common/enums/order.enum';
import { Types } from 'mongoose';
import { StripeService } from 'src/common/services/email/stripe.service';
@Injectable()
export class OrderService {
  constructor(
    private readonly OrderRepository: OrderRepository,
    private readonly CartRepository: CartRepository,
    private readonly CouponRepository: CouponRepository,
    private readonly ProductRepository: ProductRepository,
    private readonly stripeService: StripeService,
  ) {}
  //=================== Create Order ===================
  async createOrder(body: CreateOrderDto, user: HUserDocument) {
    const { phone, address, paymentMethod, couponCode } = body;
    let coupon;
    if (couponCode) {
      coupon = await this.CouponRepository.findOne({
        code: couponCode,
        usedBy: { $ne: user._id },
      });
      if (!coupon) {
        throw new BadRequestException('Invalid or already used coupon code');
      }
    }
    const cart = await this.CartRepository.findOne({ createdBy: user._id });
    if (!cart || !cart.products.length) {
      throw new BadRequestException('Cart not found or empty');
    }
    for (const product of cart.products) {
      const productData = await this.ProductRepository.findOne({
        filter: {
          _id: product.productId,
          stock: { $gte: product.quantity },
        },
      });
      if (!productData) {
        throw new BadRequestException(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Product ${product.productId} is out of stock or insufficient quantity`,
        );
      }
    }
    const order = await this.OrderRepository.create({
      userId: user._id,
      cart: cart._id,
      coupon: couponCode ? coupon._id : undefined,
      totalPrice: couponCode
        ? cart.subTotal - (cart.subTotal * coupon.amount) / 100
        : cart.subTotal,
      address,
      phone,
      paymentMethod,
      orderStatus:
        paymentMethod === PaymentMethod.CASH
          ? OrderStatus.PROCESSING
          : OrderStatus.PENDING,
      paymentIntentId: '',
      orderChanges: {},
    });
    for (const product of cart.products) {
      await this.ProductRepository.findOneAndUpdate({
        filter: {
          _id: product.productId,
        },
        update: { $inc: { stock: -product.quantity } },
      });
    }
    if (coupon) {
      await this.CouponRepository.findOneAndUpdate({
        filter: { _id: coupon._id },
        update: { $push: { usedBy: user._id } },
      });
    }
    if (paymentMethod === PaymentMethod.CASH) {
      await this.CartRepository.findOneAndUpdate({
        filter: { _id: cart._id },
        update: { products: [] },
      });
    }
    return order;
  }
  //=================== Stripe Payment ===================
  // async paymentWithStripe(id: Types.ObjectId, user: HUserDocument) {
  //   const order = await this.OrderRepository.findOne({
  //     filter: { _id: id, orderStatus: OrderStatus.PENDING },
  //     options: {
  //       populate: [
  //         {
  //           path: 'cart',
  //           populate: {
  //             path: 'products.productId',
  //           },
  //         },
  //       ],
  //     },
  //   });
  //   if (!order) {
  //     throw new BadRequestException('Order not found or already processed');
  //   }
  //   const cart = order.cart as any;
  //   if (!cart || !cart.products || cart.products.length === 0) {
  //     throw new BadRequestException('Cart is empty or invalid');
  //   }
  //   const session = await this.stripeService.createCheckoutSession({
  //     customer_email: user.email,
  //     metadata: {
  //       orderId: order._id.toString(),
  //     },
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  //     line_items: cart.products.map((product: any) => {
  //       return {
  //         price_data: {
  //           currency: 'egp',
  //           product_data: {
  //             name: product.productId.name,
  //           },
  //           unit_amount: product.finalPrice * 100,
  //         },
  //         quantity: product.quantity,
  //       };
  //     }),
  //   });
  //   return session;
  // }
  // ...existing code...
  //=================== Stripe Payment ===================
  async paymentWithStripe(id: Types.ObjectId, user: HUserDocument) {
    const order = await this.OrderRepository.findOne({
      filter: { _id: id, userId: user._id, orderStatus: OrderStatus.PENDING },
    });

    if (!order) {
      throw new BadRequestException('Order not found or already processed');
    }

    // Fetch cart separately - don't use filter object, use direct ID
    const cart = await this.CartRepository.findOne({
      _id: order.cart,
    });

    console.log('Cart found:', cart);
    console.log('Products:', cart?.products);

    if (!cart) {
      throw new BadRequestException('Cart not found');
    }

    if (!cart.products || cart.products.length === 0) {
      throw new BadRequestException(
        'Cart is empty - products were already cleared or cart has no items',
      );
    }

    // Manually populate products
    const populatedProducts = await Promise.all(
      cart.products.map(async (product: any) => {
        const productData = await this.ProductRepository.findOne({
          filter: { _id: product.productId },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
          ...product,
          productId: productData,
        };
      }),
    );
    let coupon: any;
    if (order.coupon) {
      coupon = await this.stripeService.createCoupon({
        percent_off: (order.coupon as any).amount,
      });
    }
    const session = await this.stripeService.createCheckoutSession({
      customer_email: user.email,
      metadata: {
        orderId: order._id.toString(),
      },
      line_items: populatedProducts.map((product: any) => {
        return {
          price_data: {
            currency: 'egp',
            product_data: {
              name: product.productId.name,
            },
            unit_amount: product.finalPrice * 100,
          },
          quantity: product.quantity,
        };
      }) as any,
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
    });
    return session;
  }
  //=================== Stripe Webhook ===================
  async webhook(body: any) {
    const orderId = body.data.object.metadata.orderId;
    const order = await this.OrderRepository.findOneAndUpdate({
      filter: { _id: orderId },
      update: {
        orderStatus: OrderStatus.PAID,
        orderChanges: {
          paidAt: new Date(),
        },
        paymentIntentId: body.data.object.payment_intent,
      },
    });
    return order;
  }
  //=================== Refund Order ===================
  async refundOrder(id: Types.ObjectId, user: HUserDocument) {
    let order = await this.OrderRepository.findOneAndUpdate({
      filter: {
        _id: id,
        orderStatus: { $in: [OrderStatus.PENDING, OrderStatus.PROCESSING] },
      },
      update: {
        orderStatus: OrderStatus.CANCELLED,
        orderChanges: {
          cancelledAt: new Date(),
          canceledBy: user._id,
        },
      },
    });
    if (!order) {
      throw new BadRequestException('Order not found or cannot be cancelled');
    }
    if (order.paymentMethod === PaymentMethod.CARD) {
      await this.stripeService.createRefundedPayment({
        paymentIntent: order.paymentIntentId,
      });
      order = await this.OrderRepository.findOneAndUpdate({
        filter: {
          _id: id,
        },
        update: {
          orderStatus: OrderStatus.REFUNDED,
          orderChanges: {
            refundedAt: new Date(),
            refundedBy: user._id,
          },
        },
      });
      return order;
    }
  }
}
