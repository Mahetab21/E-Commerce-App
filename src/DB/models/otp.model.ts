import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OtpEnumType } from '../../common/enums/otp.enum';
import { Hash } from '../../common/utilits/hash';
@Schema({ timestamps: true })
export class Otp {
  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: String, required: true })
  code: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expireAt: Date;

  @Prop({ type: String, enum: OtpEnumType, required: true })
  type: OtpEnumType;
}
export type HOtpDocument = HydratedDocument<Otp>;
export const OtpSchema = SchemaFactory.createForClass(Otp);
OtpSchema.pre('save', async function () {
  if (this.isModified('code')) this.code = await Hash(this.code);
});
OtpSchema.index({ createdBy: 1, type: 1 }, { unique: true });
OtpSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
export const OtpModel = MongooseModule.forFeature([
  {
    name: Otp.name,
    schema: OtpSchema,
  },
]);
