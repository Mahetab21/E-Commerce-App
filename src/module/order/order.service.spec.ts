import { Types } from 'mongoose';
import { OrderService } from './order.service';
import { OrderStatus, PaymentMethod } from '../../common/enums/order.enum';

describe('Payment boundaries', () => {
  let service: OrderService, orders: any, stripe: any, order: any, user: any;
  beforeEach(() => {
    user = { _id: new Types.ObjectId(), email: 'buyer@example.test' };
    const _id = new Types.ObjectId();
    order = {
      _id,
      id: _id.toString(),
      userId: user._id,
      totalPrice: 125.5,
      currency: 'egp',
      items: [{ name: 'Snapshot item', quantity: 1, unitPrice: 125.5 }],
      orderStatus: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.CARD,
    };
    orders = {
      findOne: jest.fn().mockResolvedValue(order),
      findOneAndUpdate: jest.fn().mockResolvedValue(order),
    };
    stripe = {
      verifyWebhook: jest.fn(),
      createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_demo' }),
      createRefundedPayment: jest.fn(),
    };
    service = new OrderService(
      orders,
      {} as any,
      {} as any,
      {} as any,
      stripe,
      {} as any,
    );
  });
  it('uses the stored order total without reading a mutable cart', async () => {
    await service.paymentWithStripe(order._id, user);
    expect(orders.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: order._id,
        userId: user._id,
        paymentMethod: PaymentMethod.CARD,
      }),
    );
    expect(
      stripe.createCheckoutSession.mock.calls[0][0].line_items[0].price_data
        .unit_amount,
    ).toBe(12550);
    expect(stripe.createCheckoutSession.mock.calls[0][1]).toBe(
      'checkout-' + order.id,
    );
  });
  it('rejects an invalid webhook before any order lookup', async () => {
    stripe.verifyWebhook.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    await expect(service.webhook(Buffer.from('{}'), 'invalid')).rejects.toThrow(
      'Invalid signature',
    );
    expect(orders.findOne).not.toHaveBeenCalled();
    expect(orders.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('ignores unrelated and unpaid webhook events', async () => {
    for (const event of [
      { type: 'customer.created', data: { object: {} } },
      {
        type: 'checkout.session.completed',
        data: { object: { payment_status: 'unpaid' } },
      },
    ]) {
      stripe.verifyWebhook.mockReturnValue(event);
      await expect(
        service.webhook(Buffer.from('{}'), 'signed'),
      ).resolves.toEqual({ received: true });
    }
    expect(orders.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects a signed payment with the wrong amount or currency', async () => {
    const checkout = {
      id: 'cs_demo',
      metadata: { orderId: order.id },
      payment_status: 'paid',
      payment_intent: 'pi_demo',
      amount_total: 1,
      currency: 'egp',
    };
    stripe.verifyWebhook.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: checkout },
    });
    await expect(service.webhook(Buffer.from('{}'), 'signed')).rejects.toThrow(
      'does not match',
    );
    checkout.amount_total = 12550;
    checkout.currency = 'usd';
    await expect(service.webhook(Buffer.from('{}'), 'signed')).rejects.toThrow(
      'does not match',
    );
    expect(orders.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('updates only pending orders when a matching payment arrives', async () => {
    stripe.verifyWebhook.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_demo',
          metadata: { orderId: order.id },
          payment_status: 'paid',
          payment_intent: 'pi_demo',
          amount_total: 12550,
          currency: 'egp',
        },
      },
    });
    await service.webhook(Buffer.from('{}'), 'signed');
    expect(orders.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { _id: order._id, orderStatus: OrderStatus.PENDING },
        update: expect.objectContaining({
          orderStatus: OrderStatus.PAID,
          paymentIntentId: 'pi_demo',
        }),
      }),
    );
  });
  it('leaves a paid order unchanged when a refund request fails', async () => {
    order.orderStatus = OrderStatus.PAID;
    order.paymentIntentId = 'pi_demo';
    stripe.createRefundedPayment.mockRejectedValue(
      new Error('Stripe unavailable'),
    );
    await expect(service.refundOrder(order._id, user)).rejects.toThrow(
      'Stripe unavailable',
    );
    expect(orders.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
