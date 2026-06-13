import { BadRequestException, Injectable } from '@nestjs/common';
import { CartRepository, ProductRepository } from 'src/DB';
import type { HUserDocument } from 'src/DB';
import { CreateCartDto, updateQuantityDto } from './cart.dto';
import { Types } from 'mongoose';
import { SocketGateway } from '../gateway/socket.gateway';
@Injectable()
export class CartService {
  constructor(
    private readonly CartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
    private readonly SocketGateway: SocketGateway,
  ) {}
  //=================== Create Cart ===================
  async createCart(body: CreateCartDto, user: HUserDocument) {
    const { productId, quantity } = body;
    const product = await this.productRepository.findOne({
      _id: productId,
      stock: { $gte: quantity },
    });
    if (!product) {
      throw new BadRequestException('Product not found or insufficient stock');
    }
    const cart = await this.CartRepository.findOne({ createdBy: user._id });
    if (!cart) {
      const newCart = await this.CartRepository.create({
        createdBy: user._id,
        products: [
          {
            productId,
            quantity,
            finalPrice: product.price,
          },
        ],
      });
      return newCart;
    }
    const productCart = cart.products.find(
      (product) => product.productId.toString() === productId.toString(),
    );
    if (productCart) {
      throw new BadRequestException('Product already in cart');
    }
    cart.products.push({
      productId,
      quantity: quantity,
      finalPrice: product.price,
    });
    //Notification
    this.SocketGateway.handleProductQuantityChange(productId, quantity);
    await cart.save();
    return cart;
  }
  //=================== remove product from cart ===================
  async removeProductFromCart(id: Types.ObjectId, user: HUserDocument) {
    const product = await this.productRepository.findOne({
      filter: { _id: id },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    const cart = await this.CartRepository.findOne({
      filter: {
        createdBy: user._id,
        products: { $elemMatch: { productId: id } },
      },
    });
    if (!cart) {
      throw new BadRequestException('Product not in cart');
    }
    cart.products = cart.products.filter(
      (product) => product.productId.toString() !== id.toString(),
    );
    await cart.save();
    return cart;
  }
  //=================== update quantity of product in cart ===================
  async updateProductQuantityInCart(
    id: Types.ObjectId,
    user: HUserDocument,
    body: updateQuantityDto,
  ) {
    const { quantity } = body;
    const cart = await this.CartRepository.findOne({
      filter: {
        createdBy: user._id,
        products: { $elemMatch: { productId: id } },
      },
    });
    if (!cart) {
      throw new BadRequestException('Product not in cart');
    }
    cart.products.find((product) => {
      if (product.productId.toString() === id.toString()) {
        product.quantity = quantity;
        return product;
      }
    });
    await cart.save();
    return cart;
  }
  //=================== clear cart ===================
  async clearCart(user: HUserDocument) {
    const cart = await this.CartRepository.findOne({
      filter: { createdBy: user._id },
    });
    if (!cart) {
      throw new BadRequestException('Cart not found');
    }
    cart.products = [];
    await cart.save();
    return cart;
  }
}
