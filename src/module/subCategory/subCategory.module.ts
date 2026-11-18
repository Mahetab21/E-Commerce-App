import { Module } from '@nestjs/common';
import { subCategoryController } from './subCategory.controller';
import { subCategoryService } from './subCategory.service';
import { S3Service, TokenService } from '../../common/services';
import { JwtService } from '@nestjs/jwt';
import {
  UserModel,
  CategoryModel,
  CategoryRepository,
  UserRepository,
  BrandModel,
  subCategoryModel,
  BrandRepository,
  SubCategoryRepository,
} from '../../DB';
@Module({
  imports: [UserModel, BrandModel, subCategoryModel, CategoryModel],
  controllers: [subCategoryController],
  providers: [
    subCategoryService,
    TokenService,
    JwtService,
    UserRepository,
    SubCategoryRepository,
    S3Service,
    BrandRepository,
    CategoryRepository,
  ],
})
export class subCategoryModule {}
