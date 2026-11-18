import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus, PaymentMethod } from '../../common/enums/order.enum';
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class Order {
  @Prop({
    type: [
      {
        productId: { type: Types.ObjectId, ref: 'Product', required: true },
        name: String,
        quantity: Number,
        unitPrice: Number,
      },
    ],
    required: true,
  })
  items: {
    productId: Types.ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  @Prop({ type: String, default: 'egp' }) currency: string;
  @Prop({ type: String }) checkoutSessionId?: string;
  @Prop({ type: String }) refundId?: string;
  @Prop({ type: Boolean, default: false }) stockReleased: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Cart', required: true })
  cart: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Coupon' })
  coupon: Types.ObjectId;
  @Prop({ type: Number, required: true })
  totalPrice: number;
  @Prop({ type: String, required: true })
  address: string;
  @Prop({ type: String, required: true })
  phone: string;
  // eslint-disable-next-line prettier/prettier
  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod: PaymentMethod;
  @Prop({ type: String, enum: OrderStatus, required: true })
  orderStatus: OrderStatus;
  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  })
  arriveAt: Date;
  @Prop({ type: String })
  paymentIntentId: string;
  @Prop({
    type: {
      paidAt: Date,
      deliveredAt: Date,
      deliveredBy: { type: Types.ObjectId, ref: 'User' },
      cancelledAt: Date,
      cancelledBy: { type: Types.ObjectId, ref: 'User' },
      refundedAt: Date,
      refundedBy: { type: Types.ObjectId, ref: 'User' },
    },
  })
  orderChanges: object;
}
export type HOrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
export const OrderModel = MongooseModule.forFeature([
  {
    name: Order.name,
    schema: OrderSchema,
  },
]);
