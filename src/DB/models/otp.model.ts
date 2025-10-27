import { MongooseModule, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OtpEnumType } from 'src/common/enums/otp.enum';
export class OTP {
  @Prop({ type: String, required: true })
  code: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expireAt: Date;

  @Prop({ type: String, enum: OtpEnumType, required: true })
  type: OtpEnumType;
}
export type HOtpDocument = HydratedDocument<OTP>;
export const OtpSchema = SchemaFactory.createForClass(OTP);

OtpSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
export const OtpModel = MongooseModule.forFeature([
  {
    name: OTP.name,
    schema: OtpSchema,
  },
]);
