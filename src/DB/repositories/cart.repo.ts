import { Injectable } from '@nestjs/common';
import { DBRepository } from './db.repo';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Cart } from '../models';
@Injectable()
export class CartRepository extends DBRepository<Cart> {
  constructor(
    @InjectModel(Cart.name)
    protected override readonly model: Model<Cart>,
  ) {
    super(model);
  }
}
