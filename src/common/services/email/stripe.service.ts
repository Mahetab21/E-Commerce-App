import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
@Injectable()
export class StripeService {
  private client?: Stripe;
  private get stripe() {
    if (!process.env.STRIPE_API_KEY)
      throw new ServiceUnavailableException('Payments are not configured');
    return (this.client ??= new Stripe(process.env.STRIPE_API_KEY));
  }
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    key: string,
  ) {
    if (!process.env.CHECKOUT_SUCCESS_URL || !process.env.CHECKOUT_CANCEL_URL)
      throw new ServiceUnavailableException('Checkout URLs are not configured');
    return this.stripe.checkout.sessions.create(
      {
        ...params,
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: process.env.CHECKOUT_SUCCESS_URL,
        cancel_url: process.env.CHECKOUT_CANCEL_URL,
        // Keep retry parameters stable for the order's idempotency key.
        // Stripe supplies the session expiry when it first creates the session.
      },
      { idempotencyKey: key },
    );
  }
  getSession(id: string) {
    return this.stripe.checkout.sessions.retrieve(id);
  }
  expireSession(id: string) {
    return this.stripe.checkout.sessions.expire(id);
  }
  createRefundedPayment(paymentIntent: string, key: string) {
    return this.stripe.refunds.create(
      { payment_intent: paymentIntent, reason: 'requested_by_customer' },
      { idempotencyKey: key },
    );
  }
  verifyWebhook(raw: Buffer | undefined, signature: string | undefined) {
    if (!process.env.STRIPE_WEBHOOK_SECRET)
      throw new ServiceUnavailableException(
        'Webhook verification is not configured',
      );
    if (!raw || !signature)
      throw new BadRequestException('Missing webhook signature or raw body');
    try {
      return this.stripe.webhooks.constructEvent(
        raw,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
