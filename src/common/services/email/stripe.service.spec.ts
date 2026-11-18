import { StripeService } from './stripe.service';

describe('Stripe checkout retries', () => {
  it('keeps the request body and idempotency key stable across retries', async () => {
    const previous = { ...process.env };
    try {
      process.env.STRIPE_API_KEY = 'sk_test_example';
      process.env.CHECKOUT_SUCCESS_URL = 'https://example.test/success';
      process.env.CHECKOUT_CANCEL_URL = 'https://example.test/cancel';
      const create = jest.fn().mockResolvedValue({ id: 'cs_example' });
      const service = new StripeService();
      (service as any).client = { checkout: { sessions: { create } } };
      const params = {
        customer_email: 'customer@example.test',
        metadata: { orderId: 'order' },
      };
      const clock = jest.spyOn(Date, 'now');
      clock.mockReturnValue(1700000000000);
      await service.createCheckoutSession(params, 'checkout-order');
      clock.mockReturnValue(1700000060000);
      await service.createCheckoutSession(params, 'checkout-order');
      expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
      expect(create.mock.calls[0][1]).toEqual({
        idempotencyKey: 'checkout-order',
      });
    } finally {
      jest.restoreAllMocks();
      process.env = previous;
    }
  });
});
