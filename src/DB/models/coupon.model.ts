import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class Coupon {
  @Prop({
    required: true,
    unique: true,
    type: String,
    trim: true,
    minLength: 2,
    maxLength: 50,
    lowercase: true,
  })
  code: string;

  @Prop({ type: Number, required: true, min: 1, max: 99 })
  amount: number;
  @Prop({ type: Date, required: true })
  fromDate: Date;

  @Prop({ type: Date, required: true })
  toDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User', required: true }] })
  usedBy: Types.ObjectId[];

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop({ type: Date })
  restoredAt: Date;
}
export type HCouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);
CouponSchema.pre(['findOne', 'find', 'findOneAndUpdate'], function (next) {
  const { paranoid, ...rest } = this.getQuery();
  if (paranoid === false) {
    this.setQuery({ ...rest, deletedAt: { $exists: true } });
  } else if (paranoid === true) {
    this.setQuery({ ...rest, deletedAt: { $exists: false } });
  }
  next();
});
export const CouponModel = MongooseModule.forFeature([
  {
    name: Coupon.name,
    schema: CouponSchema,
  },
]);
