import { BadRequestException, Injectable } from '@nestjs/common';
import { CartRepository, ProductRepository, HUserDocument } from '../../DB';
import { CreateCartDto, updateQuantityDto } from './cart.dto';
import { Types } from 'mongoose';
@Injectable()
export class CartService {
  constructor(
    private readonly CartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
  ) {}
  private async product(id: Types.ObjectId, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new BadRequestException('Quantity must be a positive integer');
    const product = await this.productRepository.findOne({
      _id: id,
      deletedAt: { $exists: false },
      stock: { $gte: quantity },
    });
    if (!product)
      throw new BadRequestException(
        'Product unavailable or insufficient stock',
      );
    return product;
  }
  async createCart(body: CreateCartDto, user: HUserDocument) {
    const product = await this.product(body.productId, body.quantity);
    const item = {
      productId: body.productId,
      quantity: body.quantity,
      finalPrice: product.price,
    };
    const cart = await this.CartRepository.findOne({ createdBy: user._id });
    if (!cart)
      return this.CartRepository.create({
        createdBy: user._id,
        products: [item],
      });
    if (
      cart.products.some(
        (p) => p.productId.toString() === body.productId.toString(),
      )
    )
      throw new BadRequestException(
        'Product already in cart; use quantity update',
      );
    cart.products.push(item);
    return cart.save();
  }
  async removeProductFromCart(id: Types.ObjectId, user: HUserDocument) {
    const cart = await this.CartRepository.findOne({
      createdBy: user._id,
      'products.productId': id,
    });
    if (!cart) throw new BadRequestException('Product not in cart');
    cart.products = cart.products.filter(
      (p) => p.productId.toString() !== id.toString(),
    );
    return cart.save();
  }
  async updateProductQuantityInCart(
    id: Types.ObjectId,
    user: HUserDocument,
    body: updateQuantityDto,
  ) {
    const product = await this.product(id, body.quantity);
    const cart = await this.CartRepository.findOne({
      createdBy: user._id,
      'products.productId': id,
    });
    if (!cart) throw new BadRequestException('Product not in cart');
    const item = cart.products.find(
      (p) => p.productId.toString() === id.toString(),
    )!;
    item.quantity = body.quantity;
    item.finalPrice = product.price;
    return cart.save();
  }
  async clearCart(user: HUserDocument) {
    const cart = await this.CartRepository.findOne({ createdBy: user._id });
    if (!cart) throw new BadRequestException('Cart not found');
    cart.products = [];
    return cart.save();
  }
}
