import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
@Injectable()
export class StripeService {
  private stripe = new Stripe(process.env.STRIPE_API_KEY!);
  constructor() {}
  createCheckoutSession = async ({
    line_items,
    discounts,
    metadata,
    customer_email,
  }: {
    line_items: [];
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    metadata: {};
    customer_email: string;
    discounts?: Stripe.Checkout.SessionCreateParams.Discount[];
  }) => {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email,
      metadata,
      success_url: 'http://localhost:3000/order/success',
      cancel_url: 'http://localhost:3000/order/cancel',
      line_items,
      discounts,
    });
    return session;
  };
  createCoupon = async ({ percent_off }: { percent_off: number }) => {
    const coupon = await this.stripe.coupons.create({
      percent_off,
      duration: 'once',
    });
    return coupon;
  };
  createRefundedPayment = async ({
    paymentIntent,
  }: {
    paymentIntent: string;
  }) => {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntent,
      reason: 'requested_by_customer',
    });
    return refund;
  };
}
