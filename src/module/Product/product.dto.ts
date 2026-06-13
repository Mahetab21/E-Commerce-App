import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';
import { AtLeastOne } from 'src/common/decorators';

export class ProductVariantDto {
  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discount?: number;
}

export class UpdateProductVariantDto extends PartialType(ProductVariantDto) {
  @IsString()
  @IsNotEmpty()
  sku: string;
}

export class AddVariantDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @ValidateNested()
  @Type(() => ProductVariantDto)
  @IsNotEmpty()
  variant: ProductVariantDto;
}

export class UpdateVariantDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @ValidateNested()
  @Type(() => UpdateProductVariantDto)
  @IsNotEmpty()
  variant: UpdateProductVariantDto;
}

export class DeleteVariantDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  sku: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100000)
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  price: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  discount: number;

  @IsMongoId()
  @IsNotEmpty()
  brand: Types.ObjectId;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  stock: number;

  @IsMongoId()
  @IsNotEmpty()
  category: Types.ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  subCategory: Types.ObjectId;

  @ValidateNested({ each: true }) //for validating array of variants
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];
}
export class idDto {
  @IsNotEmpty()
  @IsMongoId()
  id: Types.ObjectId;
}
export class QueryDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;
}
@AtLeastOne([
  'name',
  'discription',
  'price',
  'discount',
  'brand',
  'quantity',
  'stock',
  'category',
])
export class UpdateProductDto extends PartialType(CreateProductDto) {}
export class paramDto {
  @IsNotEmpty()
  @IsMongoId()
  id: Types.ObjectId;
}
