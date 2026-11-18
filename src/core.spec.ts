import 'reflect-metadata';
import { Mongoose, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DBRepository } from './DB/repositories/db.repo';
import { UserSchema } from './DB/models/user.model';
import { CartSchema } from './DB/models/cart.model';
import { Compare } from './common/utilits/hash';
import { TokenService } from './common/services/token';
import { AuthorizationGuard } from './common/guards/authorization.guard';
import { signUpDTO } from './module/user/dto/signup.dto';
import { ResetPasswordDto } from './module/user/dto/forget&resetPassword';
import { updateQuantityDto } from './module/Cart/cart.dto';
import { CartService } from './module/Cart/cart.service';
import { UserService } from './module/user/user.service';
import { UserRole } from './common/enums';

describe('Core validation and security', () => {
  const signup = {
    firstName: 'Demo',
    lastName: 'Customer',
    email: 'demo@example.test',
    age: 24,
    password: 'DemoPassword!123',
    confirmPassword: 'DemoPassword!123',
  };
  it('rejects public role assignment', async () => {
    const errors = await validate(
      plainToInstance(signUpDTO, { ...signup, role: 'admin' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });
  it.each([-1, 0, 1.5])('rejects cart quantity %s', async (quantity) => {
    expect(
      await validate(plainToInstance(updateQuantityDto, { quantity })),
    ).not.toHaveLength(0);
  });
  it('accepts positive integer cart quantities', async () => {
    expect(
      await validate(plainToInstance(updateQuantityDto, { quantity: 2 })),
    ).toHaveLength(0);
  });
  it('requires matching strong reset passwords and a six-digit code', async () => {
    const errors = await validate(
      plainToInstance(ResetPasswordDto, {
        email: signup.email,
        otp: 'x',
        password: 'weak',
        cPassword: 'different',
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['otp', 'password', 'cPassword']),
    );
  });
  it('runs password hashing before persistence and removes the hash from JSON', async () => {
    const mongo = new Mongoose();
    const User = mongo.model('UnitUser', UserSchema);
    User.collection.insertOne = jest
      .fn()
      .mockResolvedValue({ acknowledged: true });
    const user = new User(signup);
    await user.save();
    expect(user.password).not.toBe(signup.password);
    expect(await Compare(signup.password, user.password)).toBe(true);
    expect(user.toJSON()).not.toHaveProperty('password');
    expect(user.toJSON()).not.toHaveProperty('tokenVersion');
  });
  it('recomputes a cart subtotal on save', async () => {
    const mongo = new Mongoose();
    const Cart = mongo.model('UnitCart', CartSchema);
    Cart.collection.insertOne = jest
      .fn()
      .mockResolvedValue({ acknowledged: true });
    const cart = new Cart({
      createdBy: new Types.ObjectId(),
      products: [
        { productId: new Types.ObjectId(), quantity: 3, finalPrice: 12.5 },
      ],
    });
    await cart.save();
    expect(cart.subTotal).toBe(37.5);
  });
  it('rejects expired tokens and tokens from a previous password version', async () => {
    const jwt = new JwtService();
    const user = {
      _id: new Types.ObjectId(),
      email: signup.email,
      confirmed: true,
      tokenVersion: 2,
    };
    const tokens = new TokenService(jwt, {
      findOne: jest.fn().mockResolvedValue(user),
    } as any);
    const secret = process.env.ACCESS_TOKEN_USER!;
    const token = await jwt.signAsync(
      { id: user._id, email: user.email, version: 1 },
      { secret },
    );
    await expect(
      tokens.decodedTokenAndFetchUser(token, secret),
    ).rejects.toThrow('revoked');
    const expired = await jwt.signAsync(
      { id: user._id, email: user.email, version: 2 },
      { secret, expiresIn: -1 },
    );
    await expect(
      tokens.decodedTokenAndFetchUser(expired, secret),
    ).rejects.toThrow();
  });
  it('returns forbidden when a customer reaches an admin endpoint', () => {
    const reflector = { get: () => [UserRole.ADMIN] } as unknown as Reflector;
    const context = {
      getType: () => 'http',
      getHandler: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.USER } }),
      }),
    };
    expect(() =>
      new AuthorizationGuard(reflector).canActivate(context as any),
    ).toThrow('Insufficient permissions');
  });
});

describe('Repository and cart contracts', () => {
  it('passes update options and validators to MongoDB', async () => {
    const model = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const repo = new DBRepository(model as any);
    const session = {} as any;
    await repo.findOneAndUpdate({
      filter: { _id: 'id' },
      update: { name: 'value' },
      options: { session },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'id' },
      { name: 'value' },
      { new: true, runValidators: true, session },
    );
  });
  it('rejects accidental wrapped findOne filters', async () => {
    const model = { findOne: jest.fn() };
    await expect(
      new DBRepository(model as any).findOne({ filter: { _id: 'id' } }),
    ).rejects.toThrow('direct MongoDB filter');
    expect(model.findOne).not.toHaveBeenCalled();
  });
  it('counts the same filtered records returned by pagination', async () => {
    const model = {
      find: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    const filter = { name: 'missing' };
    const result = await new DBRepository(model as any).paginate({
      filter,
      query: { page: -3, limit: 999 },
    });
    expect(model.countDocuments).toHaveBeenCalledWith(filter);
    expect(model.find).toHaveBeenCalledWith(filter, undefined, {
      skip: 0,
      limit: 100,
    });
    expect(result.countDocument).toBe(0);
  });
  it('uses the requesting customer ID and never updates another cart', async () => {
    const user = { _id: new Types.ObjectId() } as any,
      productId = new Types.ObjectId();
    const cart = { findOne: jest.fn().mockResolvedValue(null) };
    const product = { findOne: jest.fn().mockResolvedValue({ price: 10 }) };
    await expect(
      new CartService(cart as any, product as any).updateProductQuantityInCart(
        productId,
        user,
        { quantity: 1 },
      ),
    ).rejects.toThrow('not in cart');
    expect(cart.findOne).toHaveBeenCalledWith({
      createdBy: user._id,
      'products.productId': productId,
    });
  });
  it('does not change the cart when stock is unavailable', async () => {
    const cart = { findOne: jest.fn() };
    const product = { findOne: jest.fn().mockResolvedValue(null) };
    await expect(
      new CartService(cart as any, product as any).createCart(
        { productId: new Types.ObjectId(), quantity: 2 },
        { _id: new Types.ObjectId() } as any,
      ),
    ).rejects.toThrow('stock');
    expect(cart.findOne).not.toHaveBeenCalled();
  });
  it('rejects an expired reset code before saving any password', async () => {
    const user = {
      _id: new Types.ObjectId(),
      email: 'demo@example.test',
      save: jest.fn(),
    };
    const users = { findOne: jest.fn().mockResolvedValue(user) };
    const otps = { findOneAndUpdate: jest.fn().mockResolvedValue(null) };
    const service = new UserService(
      users as any,
      otps as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.resetPassword({
        email: user.email,
        otp: '123456',
        password: 'NewPassword!123',
        cPassword: 'NewPassword!123',
      }),
    ).rejects.toThrow('Invalid or expired');
    expect(user.save).not.toHaveBeenCalled();
    expect(
      otps.findOneAndUpdate.mock.calls[0][0].filter.expireAt.$gt,
    ).toBeInstanceOf(Date);
    expect(otps.findOneAndUpdate.mock.calls[0][0].filter.attempts).toEqual({
      $lt: 5,
    });
  });
});
