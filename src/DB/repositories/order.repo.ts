import { Injectable } from '@nestjs/common';
import { DBRepository } from './db.repo';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../models';
@Injectable()
export class OrderRepository extends DBRepository<Order> {
  constructor(
    @InjectModel(Order.name)
    protected override readonly model: Model<Order>,
  ) {
    super(model);
  }
}
