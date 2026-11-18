import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { Types } from 'mongoose';
import { AtLeastOne } from '../../common/decorators';
import { CouponValidator } from '../../common/decorators/coupon.custom';

export class CreateCouponDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(99)
  @IsPositive()
  amount: number;

  @IsNotEmpty()
  @IsDateString()
  @Validate(CouponValidator)
  fromDate: Date;

  @IsNotEmpty()
  @IsDateString()
  toDate: Date;
}

export class paramDto {
  @IsNotEmpty()
  @IsMongoId()
  id: Types.ObjectId;
}
@AtLeastOne(['code', 'amount', 'fromDate', 'toDate'])
export class updateCouponDto extends PartialType(CreateCouponDto) {}
