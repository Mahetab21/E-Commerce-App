import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsStrongPassword,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsMatch } from '../../../common/decorators/user.decorator';
export class AddUserDto {
  @IsString()
  @Length(2, 30)
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @Length(2, 30)
  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(18)
  @Max(100)
  age: number;

  @IsStrongPassword()
  @IsNotEmpty()
  password: string;

  @IsMatch(['password'])
  @ValidateIf((data: AddUserDto) => {
    return Boolean(data.password);
  })
  confirmPassword: string;
}
