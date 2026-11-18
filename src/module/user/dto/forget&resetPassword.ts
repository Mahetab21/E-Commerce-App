import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  IsString,
  Matches,
  IsByteLength,
} from 'class-validator';
import { IsMatch } from '../../../common/decorators/user.decorator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @IsNotEmpty()
  @IsStrongPassword()
  @IsByteLength(8, 72)
  password: string;

  @IsNotEmpty()
  @IsMatch(['password'])
  cPassword: string;
}
