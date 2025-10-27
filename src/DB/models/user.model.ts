import { MongooseModule, Prop, Schema, Virtual } from '@nestjs/mongoose';
import { UserGender, UserProvider, UserRole } from 'src/common/enums';
import { SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictQuery: true,
})
export class User {
  @Prop({
    type: String,
    required: false,
    minLength: 2,
    maxLength: 30,
    trim: true,
  })
  firstName?: string;

  @Prop({
    type: String,
    required: false,
    minLength: 2,
    maxLength: 30,
    trim: true,
  })
  lastName?: string;

  @Virtual({
    get() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return `${this.firstName} ${this.lastName}`;
    },
    set(value) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this.firstName = value.split(' ')[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this.lastName = value.split(' ')[1];
    },
  })
  userName: string;

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
    required: false,
  })
  age?: number;
  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;
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
    type: String,
  })
  otp: string;
  @Prop({
    default: false,
  })
  confirmed: boolean;
  @Prop({
    type: Date,
  })
  otpExpires: Date;
}
export const UserSchema = SchemaFactory.createForClass(User);
export type HUserDocument = HydratedDocument<User>;
// export const UserModel = [
//   MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
// ];
export const UserModel = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
]);
