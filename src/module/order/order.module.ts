import { Module } from '@nestjs/common';
import { S3Service, TokenService } from 'src/common/services';
import {
  UserModel,
  CouponModel,
  ProductModel,
  CouponRepository,
  UserRepository,
  ProductRepository,
  OrderModel,
  CartModel,
  CartRepository,
  OrderRepository,
} from 'src/DB';
import { JwtService } from '@nestjs/jwt';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { StripeService } from 'src/common/services/email/stripe.service';
@Module({
  imports: [UserModel, OrderModel, CartModel, CouponModel, ProductModel],
  controllers: [OrderController],
  providers: [
    OrderService,
    TokenService,
    S3Service,
    OrderRepository,
    CartRepository,
    CouponRepository,
    UserRepository,
    TokenService,
    ProductRepository,
    JwtService,
    StripeService,
  ],
})
export class OrderModule {}
