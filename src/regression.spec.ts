import 'reflect-metadata';
import { sendEmail } from './common/services/email/email.service';
import { createConnection, Connection, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import Stripe from 'stripe';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UserSchema } from './DB/models/user.model';
import { OtpSchema } from './DB/models/otp.model';
import { CartSchema } from './DB/models/cart.model';
import { ProductSchema } from './DB/models/product.model';
import { CouponSchema } from './DB/models/coupon.model';
import { OrderSchema } from './DB/models/order.model';
import {
  UserRepository,
  OtpRepository,
  CartRepository,
  ProductRepository,
  CouponRepository,
  OrderRepository,
} from './DB';
import { UserService } from './module/user/user.service';
import { CartService } from './module/Cart/cart.service';
import { OrderService } from './module/order/order.service';
import { StripeService } from './common/services/email/stripe.service';
import { TokenService } from './common/services/token';
import { signUpDTO } from './module/user/dto/signup.dto';
import { updateQuantityDto } from './module/Cart/cart.dto';
import { Compare } from './common/utilits/hash';
import { UserRole, OtpEnumType } from './common/enums';
import { OrderStatus, PaymentMethod } from './common/enums/order.enum';
import { AppModule } from './app.module';
import { configureApp } from './config/http';
jest.mock('./common/services/email/email.service', () => ({
  generateOtp: () => 123456,
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;
integration('Commerce regression suite (MongoDB replica set)', () => {
  let db: Connection,
    users: UserRepository,
    otps: OtpRepository,
    carts: CartRepository;
  let products: ProductRepository,
    coupons: CouponRepository,
    orders: OrderRepository;
  let userService: UserService,
    cartService: CartService,
    orderService: OrderService,
    tokens: TokenService;
  let owner: any, other: any;
  const stripe = {
    verifyWebhook: jest.fn(),
    createCheckoutSession: jest.fn(),
    getSession: jest.fn(),
    expireSession: jest.fn(),
    createRefundedPayment: jest.fn(),
  };
  const signup = {
    firstName: 'Demo',
    lastName: 'Customer',
    email: 'owner@example.test',
    age: 24,
    password: 'DemoPassword!123',
    confirmPassword: 'DemoPassword!123',
  };
  beforeAll(async () => {
    db = await createConnection(process.env.TEST_MONGO_URI!).asPromise();
    const userModel = db.model('User', UserSchema),
      otpModel = db.model('Otp', OtpSchema);
    const cartModel = db.model('Cart', CartSchema),
      productModel = db.model('Product', ProductSchema);
    const couponModel = db.model('Coupon', CouponSchema),
      orderModel = db.model('Order', OrderSchema);
    await Promise.all(Object.values(db.models).map((model) => model.init()));
    users = new UserRepository(userModel);
    otps = new OtpRepository(otpModel);
    carts = new CartRepository(cartModel);
    products = new ProductRepository(productModel);
    coupons = new CouponRepository(couponModel);
    orders = new OrderRepository(orderModel);
    tokens = new TokenService(new JwtService(), users);
    userService = new UserService(users, otps, {} as any, tokens, {
      get: () => undefined,
    } as any);
    cartService = new CartService(carts, products);
    orderService = new OrderService(
      orders,
      carts,
      coupons,
      products,
      stripe as any,
      db,
    );
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    await Promise.all(
      Object.values(db.models).map((model) => model.deleteMany({})),
    );
    owner = await users.create({ ...signup, confirmed: true });
    other = await users.create({
      ...signup,
      email: 'other@example.test',
      confirmed: true,
    });
  });
  const seedProduct = async (stock = 5, price = 100) =>
    products.create({
      name: 'Test product ' + new Types.ObjectId(),
      description: 'Example product',
      price,
      basePrice: price,
      stock,
      quantity: stock,
      mainImage: 'ecommerce/catalog/demo.png',
      assetFolderId: 'demo',
      brand: new Types.ObjectId(),
      category: new Types.ObjectId(),
      subCategory: new Types.ObjectId(),
    });
  const placeOrder = async (paymentMethod = PaymentMethod.CARD) => {
    const product = await seedProduct();
    await cartService.createCart(
      { productId: product._id, quantity: 2 },
      owner,
    );
    return orderService.createOrder(
      { address: 'Demo address', phone: '01000000000', paymentMethod },
      owner,
    );
  };
  it('rejects self-assigned admin roles at the public DTO', async () => {
    const errors = await validate(
      plainToInstance(signUpDTO, { ...signup, role: UserRole.ADMIN }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });
  it('always creates a normal user and sends one confirmation code', async () => {
    const { user } = await userService.signUp({
      ...signup,
      email: 'signup@example.test',
      role: UserRole.ADMIN,
    } as any);
    expect(user.role).toBe(UserRole.USER);
    expect(JSON.parse(JSON.stringify(user))).not.toHaveProperty('password');
    expect(await db.model('Otp').countDocuments({ createdBy: user._id })).toBe(
      1,
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('hashes a reset password, consumes its code and revokes old tokens', async () => {
    const previous = await userService.signIn({
      email: owner.email,
      password: signup.password,
    });
    await userService.forgetPassword({ email: owner.email });
    await userService.resetPassword({
      email: owner.email,
      otp: '123456',
      password: 'NewPassword!123',
      cPassword: 'NewPassword!123',
    });
    const saved = await users.findOne({ _id: owner._id });
    expect(saved!.password).not.toBe('NewPassword!123');
    expect(await Compare('NewPassword!123', saved!.password)).toBe(true);
    expect(await db.model('Otp').countDocuments({ createdBy: owner._id })).toBe(
      0,
    );
    await expect(
      userService.refreshToken(previous.refresh_token),
    ).rejects.toThrow();
    await expect(
      tokens.decodedTokenAndFetchUser(
        previous.access_token,
        process.env.ACCESS_TOKEN_USER!,
      ),
    ).rejects.toThrow();
  });
  it('rejects expired OTPs and locks out after five wrong guesses', async () => {
    await otps.create({
      createdBy: owner._id,
      type: OtpEnumType.FORGET_PASSWORD,
      code: '123456',
      expireAt: new Date(Date.now() - 1000),
    });
    const reset = {
      email: owner.email,
      otp: '123456',
      password: 'NewPassword!123',
      cPassword: 'NewPassword!123',
    };
    await expect(userService.resetPassword(reset)).rejects.toThrow();
    await otps.deleteMany({});
    await userService.forgetPassword({ email: owner.email });
    for (let i = 0; i < 5; i++)
      await expect(
        userService.resetPassword({ ...reset, otp: '000000' }),
      ).rejects.toThrow();
    await expect(userService.resetPassword(reset)).rejects.toThrow();
  });
  it('validates positive integer quantities', async () => {
    for (const quantity of [-1, 0, 1.5])
      expect(
        (await validate(plainToInstance(updateQuantityDto, { quantity })))
          .length,
      ).toBeGreaterThan(0);
  });
  it('isolates carts by owner, checks stock and recomputes totals', async () => {
    const product = await seedProduct();
    await cartService.createCart(
      { productId: product._id, quantity: 2 },
      owner,
    );
    await expect(
      cartService.updateProductQuantityInCart(product._id, other, {
        quantity: 1,
      }),
    ).rejects.toThrow();
    await expect(
      cartService.updateProductQuantityInCart(product._id, owner, {
        quantity: 6,
      }),
    ).rejects.toThrow();
    expect(
      (
        await cartService.updateProductQuantityInCart(product._id, owner, {
          quantity: 3,
        })
      ).subTotal,
    ).toBe(300);
    expect((await cartService.clearCart(owner)).subTotal).toBe(0);
  });
  it('captures prices, reserves stock and clears the cart atomically', async () => {
    const order = await placeOrder();
    expect(order.totalPrice).toBe(200);
    expect(order.items[0].quantity).toBe(2);
    expect(
      (await products.findOne({ _id: order.items[0].productId }))!.stock,
    ).toBe(3);
    expect((await carts.findOne({ createdBy: owner._id }))!.subTotal).toBe(0);
    await products.findOneAndUpdate({
      filter: { _id: order.items[0].productId },
      update: { price: 900 },
    });
    expect((await orders.findOne({ _id: order._id }))!.items[0].unitPrice).toBe(
      100,
    );
  });
  it('rolls back stock and retains the cart when a coupon is expired', async () => {
    const product = await seedProduct();
    await cartService.createCart(
      { productId: product._id, quantity: 1 },
      owner,
    );
    await coupons.create({
      code: 'expired',
      amount: 10,
      fromDate: new Date(2020, 0, 1),
      toDate: new Date(2020, 1, 1),
      createdBy: owner._id,
    });
    await expect(
      orderService.createOrder(
        {
          address: 'Demo',
          phone: '123',
          paymentMethod: PaymentMethod.CASH,
          couponCode: 'expired',
        },
        owner,
      ),
    ).rejects.toThrow();
    expect((await products.findOne({ _id: product._id }))!.stock).toBe(5);
    expect(
      (await carts.findOne({ createdBy: owner._id }))!.products,
    ).toHaveLength(1);
    expect(await db.model('Order').countDocuments()).toBe(0);
  });
  it('prevents overselling when two customers order the last unit', async () => {
    const product = await seedProduct(1);
    await cartService.createCart(
      { productId: product._id, quantity: 1 },
      owner,
    );
    await cartService.createCart(
      { productId: product._id, quantity: 1 },
      other,
    );
    const body = {
      address: 'Demo',
      phone: '123',
      paymentMethod: PaymentMethod.CASH,
    };
    const results = await Promise.allSettled([
      orderService.createOrder(body, owner),
      orderService.createOrder(body, other),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await products.findOne({ _id: product._id }))!.stock).toBe(0);
  });
  it('creates checkout from the order snapshot and rejects another owner', async () => {
    const order = await placeOrder();
    stripe.createCheckoutSession.mockResolvedValue({ id: 'cs_test' });
    await expect(
      orderService.paymentWithStripe(order._id, other),
    ).rejects.toThrow();
    await orderService.paymentWithStripe(order._id, owner);
    expect(
      stripe.createCheckoutSession.mock.calls[0][0].line_items[0].price_data
        .unit_amount,
    ).toBe(20000);
    expect((await orders.findOne({ _id: order._id }))!.checkoutSessionId).toBe(
      'cs_test',
    );
  });
  it('ignores unrelated/unpaid webhooks and verifies amount before recording payment', async () => {
    const order = await placeOrder();
    await orders.findOneAndUpdate({
      filter: { _id: order._id },
      update: { checkoutSessionId: 'cs_test' },
    });
    const checkout = {
      id: 'cs_test',
      metadata: { orderId: order.id },
      amount_total: 20000,
      currency: 'egp',
      payment_intent: 'pi_test',
      payment_status: 'unpaid',
    };
    stripe.verifyWebhook.mockReturnValue({
      type: 'customer.created',
      data: { object: {} },
    });
    await orderService.webhook(Buffer.from('{}'), 'signature');
    stripe.verifyWebhook.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: checkout },
    });
    await orderService.webhook(Buffer.from('{}'), 'signature');
    expect((await orders.findOne({ _id: order._id }))!.orderStatus).toBe(
      OrderStatus.PENDING,
    );
    checkout.payment_status = 'paid';
    checkout.amount_total = 1;
    await expect(
      orderService.webhook(Buffer.from('{}'), 'signature'),
    ).rejects.toThrow();
    checkout.amount_total = 20000;
    await orderService.webhook(Buffer.from('{}'), 'signature');
    await orderService.webhook(Buffer.from('{}'), 'signature');
    expect((await orders.findOne({ _id: order._id }))!.orderStatus).toBe(
      OrderStatus.PAID,
    );
    expect(
      (await products.findOne({ _id: order.items[0].productId }))!.stock,
    ).toBe(3);
  });
  it('cancels a cash order once and restores its stock', async () => {
    const order = await placeOrder(PaymentMethod.CASH);
    await orderService.refundOrder(order._id, owner);
    await orderService.refundOrder(order._id, owner);
    expect(
      (await products.findOne({ _id: order.items[0].productId }))!.stock,
    ).toBe(5);
  });
  it('does not mark a paid order refunded when Stripe fails', async () => {
    const order = await placeOrder();
    await orders.findOneAndUpdate({
      filter: { _id: order._id },
      update: { orderStatus: OrderStatus.PAID, paymentIntentId: 'pi_test' },
    });
    stripe.createRefundedPayment.mockRejectedValueOnce(
      new Error('Network failure'),
    );
    await expect(orderService.refundOrder(order._id, owner)).rejects.toThrow(
      'Network failure',
    );
    expect((await orders.findOne({ _id: order._id }))!.orderStatus).toBe(
      OrderStatus.PAID,
    );
    stripe.createRefundedPayment.mockResolvedValue({
      id: 're_test',
      status: 'succeeded',
    });
    await orderService.refundOrder(order._id, owner);
    await orderService.refundOrder(order._id, owner);
    expect(
      (await products.findOne({ _id: order.items[0].productId }))!.stock,
    ).toBe(5);
  });
  it('uses the same filter for pagination data and counts', async () => {
    await seedProduct();
    const page = await products.paginate({
      filter: { name: 'missing' },
      query: { page: 1, limit: 10 },
    });
    expect(page.docs).toEqual([]);
    expect(page.countDocument).toBe(0);
  });
  it('boots the full app, blocks public private-file access and permits password recovery without login', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    try {
      await request(app.getHttpServer()).get('/').expect(200);
      await request(app.getHttpServer()).get('/upload/private/key').expect(404);
      await request(app.getHttpServer())
        .post('/user/signup')
        .send({ ...signup, role: UserRole.ADMIN })
        .expect(400);
      await request(app.getHttpServer())
        .patch('/user/forgotPassword')
        .send({ email: 'missing@example.test' })
        .expect(200);
      await request(app.getHttpServer()).post('/Coupons').send({}).expect(401);
    } finally {
      await app.close();
    }
  });
});
describe('Stripe signature verification', () => {
  it('accepts a genuine signature and rejects tampered payloads', () => {
    process.env.STRIPE_API_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
    const client = new Stripe('sk_test_example');
    const payload = JSON.stringify({
      id: 'evt_test',
      type: 'customer.created',
      data: { object: {} },
    });
    const signature = client.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_example',
    });
    const service = new StripeService();
    expect(service.verifyWebhook(Buffer.from(payload), signature).id).toBe(
      'evt_test',
    );
    expect(() =>
      service.verifyWebhook(Buffer.from(payload + ' '), signature),
    ).toThrow();
    expect(() =>
      service.verifyWebhook(Buffer.from(payload), undefined),
    ).toThrow();
  });
});
