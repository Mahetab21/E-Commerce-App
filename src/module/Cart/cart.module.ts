import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { TokenService } from 'src/common/services';
import {
  UserModel,
  CartModel,
  ProductModel,
  CartRepository,
  UserRepository,
  ProductRepository,
} from 'src/DB';
import { JwtService } from '@nestjs/jwt';
import { SocketGateway } from '../gateway/socket.gateway';
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
    SocketGateway,
  ],
})
export class CartModule {}
