import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  optimisticConcurrency: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class CartProduct {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    validate: Number.isSafeInteger,
  })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  finalPrice: number;
}

@Schema({
  timestamps: true,
  optimisticConcurrency: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class Cart {
  @Prop({ type: [SchemaFactory.createForClass(CartProduct)], default: [] })
  products: CartProduct[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Number })
  subTotal: number;

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop({ type: Date })
  restoredAt: Date;
}
export type HCartDocument = HydratedDocument<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);
CartSchema.pre(['save'], function (next) {
  this.subTotal = this.products.reduce(
    (total, product) => total + product.finalPrice * product.quantity,
    0,
  );
  next();
});
CartSchema.pre(['findOne', 'find', 'findOneAndUpdate'], function (next) {
  const { paranoid, ...rest } = this.getQuery();
  if (paranoid === false) {
    this.setQuery({ ...rest, deletedAt: { $exists: true } });
  } else if (paranoid === true) {
    this.setQuery({ ...rest, deletedAt: { $exists: false } });
  }
  next();
});
export const CartModel = MongooseModule.forFeature([
  {
    name: Cart.name,
    schema: CartSchema,
  },
]);
