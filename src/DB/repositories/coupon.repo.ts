import { Injectable } from '@nestjs/common';
import { DBRepository } from './db.repo';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Coupon } from '../models';
@Injectable()
export class CouponRepository extends DBRepository<Coupon> {
  constructor(
    @InjectModel(Coupon.name)
    protected override readonly model: Model<Coupon>,
  ) {
    super(model);
  }
}
