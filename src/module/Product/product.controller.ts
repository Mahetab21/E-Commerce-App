import {
  Body,
  Controller,
  ParseFilePipe,
  Post,
  Patch,
  UploadedFile,
  UseInterceptors,
  Param,
  Get,
  Query,
  Delete,
  UploadedFiles,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { TokenTypeEnum, UserRole } from '../../common/enums';
import { Auth, User } from '../../common/decorators';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { fileValidation, multerCloud } from '../../common/utilits/multer';
import type { HUserDocument } from '../../DB';
import {
  CreateProductDto,
  idDto,
  paramDto,
  QueryDto,
  UpdateProductDto,
  AddVariantDto,
  UpdateVariantDto,
  DeleteVariantDto,
} from './product.dto';
@Controller('Products')
export class ProductController {
  constructor(private readonly ProductService: ProductService) {}
  //------- create Product -------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'subImages', maxCount: 5 },
      ],
      multerCloud({ fileTypes: fileValidation.image }),
    ),
  )
  @Post()
  async createProduct(
    @Body() productDto: CreateProductDto,
    @User() user: HUserDocument,
    @UploadedFiles()
    files: {
      mainImage: Express.Multer.File[];
      subImages: Express.Multer.File[];
    },
  ) {
    const product = await this.ProductService.createProduct(
      productDto,
      user,
      files,
    );
    return { message: 'Done', product };
  }
  //------------- update Product -------------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @Patch('update/:id')
  async updateProduct(
    @Param() param: paramDto,
    @Body() body: UpdateProductDto,
    @User() user: HUserDocument,
  ) {
    const product = await this.ProductService.updateProduct(
      body,
      user,
      param.id,
    );
    return { message: 'Done', product };
  }
  //-------------- Add to wish list--------------
  @Post('wish-list/:id')
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async addToWishList(@Param() param: paramDto, @User() user: HUserDocument) {
    const product = await this.ProductService.addToWishList(param.id, user);
    return { message: 'Done', product };
  }
  //------- update Product image -------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @UseInterceptors(
    FileInterceptor(
      'attachment',
      multerCloud({ fileTypes: fileValidation.image }),
    ),
  )
  @Patch('/updateImage/:id')
  async updateProductImage(
    @Param() params: idDto,
    @User() user: HUserDocument,
    @UploadedFile(ParseFilePipe) file: Express.Multer.File,
  ) {
    const Product = await this.ProductService.updateProductImage(
      params.id,
      file,
      user,
    );
    return { message: 'Done', Product };
  }
  //----------- get all Products -----------
  @Get()
  async getAllProducts(@Query() query: QueryDto) {
    const Products = await this.ProductService.getAllProducts(query);
    return { message: 'Done', Products };
  }
  //*************** Product Variants Management ***************//
  //----------- Add Variant to Product -----------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @UseInterceptors(
    FilesInterceptor(
      'variantImages',
      5,
      multerCloud({ fileTypes: fileValidation.image }),
    ),
  )
  @Post('variants/add')
  async addVariant(
    @Body() addVariantDto: AddVariantDto,
    @User() user: HUserDocument,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const product = await this.ProductService.addVariant(
      addVariantDto,
      user,
      files,
    );
    return { message: 'Variant added successfully', product };
  }

  //----------- Update Variant -----------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @Patch('variants/update')
  async updateVariant(@Body() updateVariantDto: UpdateVariantDto) {
    const product = await this.ProductService.updateVariant(updateVariantDto);
    return { message: 'Variant updated successfully', product };
  }

  //----------- Delete Variant -----------
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @Delete('variants/delete')
  async deleteVariant(@Body() deleteVariantDto: DeleteVariantDto) {
    const product = await this.ProductService.deleteVariant(deleteVariantDto);
    return { message: 'Variant deleted successfully', product };
  }

  //----------- Get Product Variants -----------
  @Get('variants/:id')
  async getProductVariants(@Param() params: idDto) {
    const variants = await this.ProductService.getProductVariants(params.id);
    return { message: 'Done', variants };
  }
}
