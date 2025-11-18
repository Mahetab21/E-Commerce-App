import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { TokenService } from 'src/common/services';
import {
  UserModel,
  CouponModel,
  ProductModel,
  CouponRepository,
  UserRepository,
  ProductRepository,
} from 'src/DB';
import { JwtService } from '@nestjs/jwt';
@Module({
  imports: [UserModel, CouponModel, ProductModel],
  controllers: [CouponController],
  providers: [
    CouponService,
    CouponRepository,
    UserRepository,
    TokenService,
    ProductRepository,
    JwtService,
  ],
})
export class CouponModule {}
