import { Injectable } from '@nestjs/common';
import { HUserDocument, User } from '../models';
import { DBRepository } from './db.repo';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
@Injectable()
export class UserRepository extends DBRepository<HUserDocument> {
  constructor(
    @InjectModel(User.name)
    protected override readonly model: Model<HUserDocument>,
  ) {
    super(model);
  }
}
