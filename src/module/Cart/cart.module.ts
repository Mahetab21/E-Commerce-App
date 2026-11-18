import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { TokenService } from '../../common/services';
import {
  UserModel,
  CartModel,
  ProductModel,
  CartRepository,
  UserRepository,
  ProductRepository,
} from '../../DB';
import { JwtService } from '@nestjs/jwt';
@Module({
  imports: [UserModel, CartModel, ProductModel],
  controllers: [CartController],
  providers: [
    CartService,
    CartRepository,
    UserRepository,
    TokenService,
    ProductRepository,
    JwtService,
  ],
})
export class CartModule {}
