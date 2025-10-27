import { Injectable } from '@nestjs/common';
import { DBRepository } from './db.repo';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../models';
@Injectable()
export class OtpRepository extends DBRepository<User> {
  constructor(
    @InjectModel(User.name)
    protected override readonly model: Model<User>,
  ) {
    super(model);
  }
}
