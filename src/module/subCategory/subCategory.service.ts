import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatesubCategoryDto,
  QueryDto,
  UpdatesubCategoryDto,
} from './subCategory.dto';
import {
  BrandRepository,
  SubCategoryRepository,
  CategoryRepository,
} from '../../DB';
import type { HUserDocument } from '../../DB';
import { S3Service } from '../../common/services/s3.service';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
@Injectable()
export class subCategoryService {
  constructor(
    private readonly subCategoryRepository: SubCategoryRepository,
    private readonly s3Service: S3Service,
    private readonly BrandRepository: BrandRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}
  //=================== Create subCategory ===================
  async createsubCategory(
    subCategorydto: CreatesubCategoryDto,
    user: HUserDocument,
    file: Express.Multer.File,
  ) {
    const { name, slogan, brands, category } = subCategorydto;
    if (
      !(await this.categoryRepository.findOne({
        _id: category,
        deletedAt: { $exists: false },
      }))
    ) {
      throw new NotFoundException('Category not found');
    }
    const subCategoryExists = await this.subCategoryRepository.findOne({
      name,
    });
    if (subCategoryExists) {
      throw new ConflictException('subCategory with this name already exists');
    }
    const strictId = [...new Set(brands || [])];
    if (
      brands &&
      (
        await this.BrandRepository.find({
          filter: { _id: { $in: strictId } },
        })
      ).length !== strictId.length
    ) {
      throw new NotFoundException('One or more brands not found');
    }
    const assetFolderId = randomUUID();
    const url = await this.s3Service.uploadFile({
      path: `Categories/${assetFolderId}`,
      file,
    });
    const subCategory = await this.subCategoryRepository.create({
      name,
      slogan,
      image: url,
      createdBy: user._id,
      assetFolderId,
      brands: strictId,
      category,
    });
    if (!subCategory) {
      await this.s3Service.deleteFile({
        Key: url,
      });
      throw new ConflictException('Error creating subCategory');
    }
    return subCategory;
  }
  //=================== Update subCategory ===================
  async updatesubCategory(
    id: Types.ObjectId,
    subCategorydto: UpdatesubCategoryDto,
    user: HUserDocument,
  ) {
    const { name, slogan, brands } = subCategorydto;
    if (
      subCategorydto.category &&
      !(await this.categoryRepository.findOne({
        _id: subCategorydto.category,
        deletedAt: { $exists: false },
      }))
    ) {
      throw new NotFoundException('Category not found');
    }
    const subCategory = await this.subCategoryRepository.findOne({
      _id: id,
      createdBy: user._id,
    });
    if (!subCategory) {
      throw new NotFoundException('subCategory not found');
    }
    if (
      name &&
      (await this.subCategoryRepository.findOne({ name, _id: { $ne: id } }))
    ) {
      throw new ConflictException('subCategory with this name already exists');
    }
    const strictId = [...new Set(brands || [])];
    if (
      brands &&
      (
        await this.BrandRepository.find({
          filter: { _id: { $in: strictId } },
        })
      ).length !== strictId.length
    ) {
      throw new NotFoundException('One or more brands not found');
    }

    const updatedsubCategory =
      await this.subCategoryRepository.findOneAndUpdate({
        filter: { _id: id, createdBy: user._id },
        update: {
          name,
          slogan,
          ...(subCategorydto.category
            ? { category: subCategorydto.category }
            : {}),
          ...(brands !== undefined ? { brands: strictId } : {}),
        },
      });
    return updatedsubCategory;
  }
  //=================== Update subCategory Image ===================
  async updatesubCategoryImage(
    id: Types.ObjectId,
    file: Express.Multer.File,
    user: HUserDocument,
  ) {
    const subCategory = await this.subCategoryRepository.findOne({
      _id: id,
      createdBy: user._id,
    });
    if (!subCategory) {
      throw new NotFoundException('subCategory not found');
    }
    const url = await this.s3Service.uploadFile({
      path: `Categories/${subCategory.assetFolderId}`,
      file,
    });
    const updatedsubCategory =
      await this.subCategoryRepository.findOneAndUpdate({
        filter: { _id: id },
        update: { image: url },
      });
    if (!updatedsubCategory) {
      await this.s3Service.deleteFile({
        Key: url,
      });
      throw new ConflictException('Error updating subCategory image');
    }
    await this.s3Service.deleteFile({
      Key: subCategory.image,
    });
    return updatedsubCategory;
  }
  //=================== Freeze subCategory ===================
  async freezesubCategory(id: Types.ObjectId, user: HUserDocument) {
    const subCategory = await this.subCategoryRepository.findOneAndUpdate({
      filter: { _id: id, deletedAt: { $exists: false } },
      update: { deletedAt: new Date(), updatedBy: user._id },
    });
    if (!subCategory) {
      throw new NotFoundException('subCategory not found or already frozen');
    }
    return subCategory;
  }
  //=================== restore subCategory ===================
  async restoresubCategory(id: Types.ObjectId, user: HUserDocument) {
    const subCategory = await this.subCategoryRepository.findOneAndUpdate({
      filter: { _id: id, deletedAt: { $exists: true }, paranoid: false },
      update: {
        $unset: { deletedAt: '' },
        restoredAt: new Date(),
        updatedBy: user._id,
      },
    });
    if (!subCategory) {
      throw new NotFoundException('subCategory not found or already restored');
    }
    return subCategory;
  }
  //=================== Delete subCategory ===================
  async deletesubCategory(id: Types.ObjectId) {
    const subCategory = await this.subCategoryRepository.findOneAndDelete({
      _id: id,
      deletedAt: { $exists: true },
    });
    if (!subCategory) {
      throw new NotFoundException('subCategory not found or already deleted');
    }
    await this.s3Service.deleteFile({
      Key: subCategory.image,
    });
    return subCategory;
  }
  //=================== Get All subCategories ===================
  async getAllsubCategories(query: QueryDto) {
    const { page = 1, limit = 20 } = query;
    const search = query.search?.replace(
      /[.*+?^${\}()|[\]\\]/g,
      (match) => '\\' + match,
    );
    const { currentPage, countDocument, numberOfPages, docs } =
      await this.subCategoryRepository.paginate({
        filter: {
          deletedAt: { $exists: false },
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
}
