import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { S3Service, TokenService } from '../../common/services';
import { JwtService } from '@nestjs/jwt';
import {
  UserModel,
  UserRepository,
  BrandModel,
  CategoryModel,
  CategoryRepository,
  BrandRepository,
  ProductModel,
  ProductRepository,
  SubCategoryRepository,
  subCategoryModel,
} from '../../DB';
@Module({
  imports: [
    UserModel,
    BrandModel,
    CategoryModel,
    ProductModel,
    subCategoryModel,
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductRepository,
    BrandRepository,
    CategoryRepository,
    SubCategoryRepository,
    UserRepository,
    S3Service,
    TokenService,
    JwtService,
  ],
})
export class ProductModule {}
