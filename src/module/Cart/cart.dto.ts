import { IsMongoId, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';
export class updateQuantityDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;
}
export class CreateCartDto extends updateQuantityDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;
}
export class paramDto {
  @IsNotEmpty()
  @IsMongoId()
  id: Types.ObjectId;
}
