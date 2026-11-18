import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserGender, UserProvider, UserRole } from '../../common/enums';
import { HydratedDocument, Types } from 'mongoose';
import type { HOtpDocument } from './otp.model';
import { Hash } from '../../common/utilits/hash';
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class User {
  @Prop({
    type: String,
    required: true,
    minLength: 2,
    maxLength: 30,
    trim: true,
  })
  firstName: string;

  @Prop({
    type: String,
    required: true,
    minLength: 2,
    maxLength: 30,
    trim: true,
  })
  lastName: string;

  // userName will be defined as a virtual on the schema
  userName?: string;

  @Prop({
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
  })
  email: string;
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  password: string;
  @Prop({
    type: Number,
    min: 18,
    max: 100,
    required: true,
  })
  age: number;
  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Prop({ type: Number, default: 0 })
  tokenVersion: number;
  @Prop({
    type: String,
    enum: UserGender,
    default: UserGender.MALE,
  })
  gender: UserGender;
  @Prop({
    type: String,
    enum: UserProvider,
    default: UserProvider.LOCAL,
  })
  provider: UserProvider;
  @Prop({
    type: String,
    required: false,
  })
  image?: string;
  @Prop({
    type: Date,
    default: Date.now,
  })
  changeCredentials: Date;

  @Prop({
    default: false,
  })
  confirmed: boolean;
  @Prop({
    type: Date,
  })
  otpExpires: Date;

  // otp will be defined as a virtual on the schema
  otp?: HOtpDocument;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
  wishList: Types.ObjectId[];
}
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as any).password;
    delete (ret as any).otp;
    delete (ret as any).tokenVersion;
    return ret;
  },
});
export type HUserDocument = HydratedDocument<User>;

// Add virtuals
UserSchema.virtual('userName')
  .get(function () {
    return `${this.firstName} ${this.lastName}`;
  })
  .set(function (value: string) {
    const [firstName, lastName] = value.split(' ');
    this.firstName = firstName;
    this.lastName = lastName;
  });
//virtual populate for otp
UserSchema.virtual('otp', {
  ref: 'Otp',
  localField: '_id',
  foreignField: 'createdBy', // Assuming 'createdBy' is the field in Otp that references User
  justOne: true, //one-to-one relationship
});

// Add pre-save middleware for password hashing
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await Hash(this.password);
  }
  next();
});

export const UserModel = MongooseModule.forFeature([
  {
    name: User.name,
    schema: UserSchema,
  },
]);
