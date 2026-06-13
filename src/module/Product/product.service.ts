import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateProductDto,
  QueryDto,
  UpdateProductDto,
  AddVariantDto,
  UpdateVariantDto,
  DeleteVariantDto,
} from './product.dto';
import {
  ProductRepository,
  BrandRepository,
  CategoryRepository,
  UserRepository,
} from 'src/DB';
import { HUserDocument, SubCategoryRepository } from 'src/DB';
import { S3Service } from 'src/common/services/s3.service';
import { Types } from 'mongoose';
@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly s3Service: S3Service,
    private readonly brandRepository: BrandRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subCategoryRepository: SubCategoryRepository,
    private readonly userRepository: UserRepository,
  ) {}
  //=================== Create Product ===================
  async createProduct(
    productDto: CreateProductDto,
    user: HUserDocument,
    file: {
      mainImage: Express.Multer.File[];
      subImages: Express.Multer.File[];
    },
  ) {
    const {
      name,
      description,
      discount,
      quantity,
      stock,
      brand,
      category,
      variants,
      subCategory,
    } = productDto;
    let { price } = productDto;
    const brandExists = await this.brandRepository.findOne({ _id: brand });
    if (!brandExists) {
      throw new NotFoundException('brand not found');
    }
    const categoryExists = await this.categoryRepository.findOne({
      _id: category,
    });
    if (!categoryExists) {
      throw new NotFoundException('category not found');
    }
    const subCategoryExists = await this.subCategoryRepository.findOne({
      _id: subCategory,
    });
    if (!subCategoryExists) {
      throw new NotFoundException('subCategory not found');
    }
    if (stock > quantity) {
      throw new BadRequestException('stock cannot be greater than quantity');
    }
    price = price - price * ((discount || 0) / 100);
    const filePath = file.mainImage[0];
    const filesPath = file.subImages;
    const mainImageUrl = await this.s3Service.uploadFile({
      file: filePath,
      path: `Categories/${categoryExists.assetFolderId}/Products/mainImage`,
    });
    const subImagesUrls = await this.s3Service.uploadFiles({
      files: filesPath,
      path: `Categories/${categoryExists.assetFolderId}/Products/subImages`,
    });
    const product = await this.productRepository.create({
      name,
      description,
      price,
      discount,
      quantity,
      stock,
      brand: Types.ObjectId.createFromHexString(brand.toString()),
      category: Types.ObjectId.createFromHexString(category.toString()),
      subCategory: Types.ObjectId.createFromHexString(subCategory.toString()),
      assetFolderId: subCategoryExists.assetFolderId,
      mainImage: mainImageUrl,
      subImage: subImagesUrls,
      variants: variants
        ? variants.map((v) => ({ ...v, images: [], discount: v.discount || 0 }))
        : [],
    });
    if (!product) {
      await this.s3Service.deleteFile({ Key: mainImageUrl });
      await this.s3Service.deleteFiles({ urls: subImagesUrls });
      throw new BadRequestException('Error creating product');
    }
    return product;
  }
  //================== Update Product ==================
  async updateProduct(
    productDto: UpdateProductDto,
    user: HUserDocument,
    id: Types.ObjectId,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, description, discount, quantity, stock, brand, category } =
      productDto;
    let { price } = productDto;
    const product = await this.productRepository.findOne({ _id: id });
    if (!product) {
      throw new NotFoundException('product not found');
    }
    if (category) {
      const categoryExists = await this.categoryRepository.findOne({
        _id: category,
      });
      if (!categoryExists) {
        throw new NotFoundException('category not found');
      }
    }
    if (brand) {
      const brandExists = await this.brandRepository.findOne({ _id: brand });
      if (!brandExists) {
        throw new NotFoundException('brand not found');
      }
    }
    if (price && discount) {
      price = price - price * (discount / 100);
    } else if (price) {
      price = price - price * (product.discount / 100);
    } else if (discount) {
      price = product.price - product.price * (discount / 100);
    }
    if (stock) {
      if (stock > product.quantity) {
        throw new BadRequestException('stock cannot be greater than quantity');
      }
    }
    const updatedProduct = await this.productRepository.findOneAndUpdate({
      filter: { _id: id },
      update: {
        ...productDto,
        price,
        discount,
        stock,
        quantity,
      },
    });
    return updatedProduct;
  }
  //================== Add to wish list ==================
  async addToWishList(id: Types.ObjectId, user: HUserDocument) {
    const product = await this.productRepository.findOne({
      filter: { _id: id },
    });
    if (!product) {
      throw new NotFoundException('product not found');
    }
    let userExists = await this.userRepository.findOneAndUpdate({
      filter: { _id: user._id, wishList: { $in: id } },
      update: {
        $pull: {
          wishList: id,
        },
        options: { new: true },
      },
    });
    if (!userExists) {
      userExists = await this.userRepository.findOneAndUpdate({
        filter: { _id: user._id },
        update: {
          $addToSet: {
            wishList: id,
          },
        },
        options: { new: true },
      });
    }
    return userExists;
  }
  //================== Update Product Image ==================
  async updateProductImage(
    id: Types.ObjectId,
    file: Express.Multer.File,
    user: HUserDocument,
  ) {
    const Product = await this.productRepository.findOne({
      _id: id,
      createdBy: user._id,
    });
    if (!Product) {
      throw new NotFoundException('Product not found');
    }
    const url = await this.s3Service.uploadFile({
      path: `Categories/.../Products/${Product.assetFolderId}/mainImage`,
      file,
    });
    const updatedProduct = await this.productRepository.findOneAndUpdate({
      filter: { _id: id },
      update: { mainImage: url },
      options: { new: true },
    });
    if (!updatedProduct) {
      await this.s3Service.deleteFile({
        Key: url,
      });
      throw new ConflictException('Error updating Product image');
    }
    await this.s3Service.deleteFile({
      Key: Product.mainImage,
    });
    return updatedProduct;
  }
  //=================== Get All Products ===================
  async getAllProducts(query: QueryDto) {
    const { page = 1, limit = 2, search } = query;
    const { currentPage, countDocument, numberOfPages, docs } =
      await this.productRepository.paginate({
        filter: {
          ...(search
            ? {
                $or: [
                  { name: { $regex: search, $options: 'i' } },
                  { slogan: { $regex: search, $options: 'i' } },
                ],
              }
            : {}),
        },
        query: { page, limit },
      });
    return { currentPage, countDocument, numberOfPages, docs };
  }
  //*************** Product Variants Management ***************//
  //=================== Add Variant to Product ===================
  async addVariant(
    addVariantDto: AddVariantDto,
    user: HUserDocument,
    files?: Express.Multer.File[],
  ) {
    const { productId, variant } = addVariantDto;
    const product = await this.productRepository.findOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if SKU already exists
    const skuExists = product.variants?.some((v) => v.sku === variant.sku);
    if (skuExists) {
      throw new ConflictException('SKU already exists for this product');
    }

    let variantImages: string[] = [];
    if (files && files.length > 0) {
      const category = await this.categoryRepository.findOne({
        _id: product.category,
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      variantImages = await this.s3Service.uploadFiles({
        files,
        path: `Categories/${category.assetFolderId}/Products/variants/${variant.sku}`,
      });
    }

    const updatedProduct = await this.productRepository.findOneAndUpdate({
      filter: { _id: productId },
      update: {
        $push: {
          variants: {
            ...variant,
            images: variantImages,
          },
        },
      },
    });

    if (!updatedProduct) {
      if (variantImages.length > 0) {
        await this.s3Service.deleteFiles({ urls: variantImages });
      }
      throw new BadRequestException('Error adding variant');
    }

    return updatedProduct;
  }
  //=================== Update Variant ===================
  async updateVariant(updateVariantDto: UpdateVariantDto) {
    const { productId, sku, variant } = updateVariantDto;
    const product = await this.productRepository.findOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variantIndex = product.variants?.findIndex((v) => v.sku === sku);
    if (variantIndex === -1 || variantIndex === undefined) {
      throw new NotFoundException('Variant not found');
    }

    // If updating SKU, check if new SKU already exists
    if (variant.sku && variant.sku !== sku) {
      const newSkuExists = product.variants?.some((v) => v.sku === variant.sku);
      if (newSkuExists) {
        throw new ConflictException('New SKU already exists for this product');
      }
    }

    const updateFields: Record<string, any> = {};
    Object.keys(variant).forEach((key) => {
      const value = variant[key as keyof typeof variant];
      if (value !== undefined) {
        updateFields[`variants.${variantIndex}.${key}`] = value;
      }
    });

    const updatedProduct = await this.productRepository.findOneAndUpdate({
      filter: { _id: productId },
      update: { $set: updateFields },
    });

    return updatedProduct;
  }
  //=================== Delete Variant ===================
  async deleteVariant(deleteVariantDto: DeleteVariantDto) {
    const { productId, sku } = deleteVariantDto;
    const product = await this.productRepository.findOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variant = product.variants?.find((v) => v.sku === sku);
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const updatedProduct = await this.productRepository.findOneAndUpdate({
      filter: { _id: productId },
      update: {
        $pull: {
          variants: { sku },
        },
      },
    });

    if (!updatedProduct) {
      throw new BadRequestException('Error deleting variant');
    }

    // Delete variant images from S3
    if (variant.images && variant.images.length > 0) {
      await this.s3Service.deleteFiles({ urls: variant.images });
    }

    return updatedProduct;
  }
  //=================== Get Product Variants ===================
  async getProductVariants(productId: Types.ObjectId) {
    const product = await this.productRepository.findOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product.variants || [];
  }
}
