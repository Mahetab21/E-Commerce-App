import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBrandDto, QueryDto, UpdateBrandDto } from './brand.dto';
import { BrandRepository, HUserDocument } from '../../DB';
import { S3Service } from '../../common/services/s3.service';
import { Types } from 'mongoose';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly s3Service: S3Service,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  //=================== Create Brand ===================
  async createBrand(
    branddto: CreateBrandDto,
    user: HUserDocument,
    file: Express.Multer.File,
  ) {
    const { name, slogan } = branddto;
    const brandExists = await this.brandRepository.findOne({ name });
    if (brandExists) {
      throw new ConflictException('Brand with this name already exists');
    }
    const url = await this.s3Service.uploadFile({
      path: 'brands',
      file,
    });
    const brand = await this.brandRepository.create({
      name,
      slogan,
      image: url,
      createdBy: user._id,
    });
    if (!brand) {
      await this.s3Service.deleteFile({
        Key: url,
      });
      throw new ConflictException('Error creating brand');
    }
    return brand;
  }
  //=================== Update Brand ===================
  async updateBrand(
    id: Types.ObjectId,
    branddto: UpdateBrandDto,
    user: HUserDocument,
  ) {
    const { name, slogan } = branddto;
    const brand = await this.brandRepository.findOne({
      _id: id,
      createdBy: user._id,
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    if (
      name &&
      (await this.brandRepository.findOne({ name, _id: { $ne: id } }))
    ) {
      throw new ConflictException('Brand with this name already exists');
    }
    const updatedBrand = await this.brandRepository.findOneAndUpdate({
      filter: { _id: id, createdBy: user._id },
      update: { name, slogan },
    });
    return updatedBrand;
  }
  //=================== Update Brand Image ===================
  async updateBrandImage(
    id: Types.ObjectId,
    file: Express.Multer.File,
    user: HUserDocument,
  ) {
    const brand = await this.brandRepository.findOne({
      _id: id,
      createdBy: user._id,
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    const url = await this.s3Service.uploadFile({
      path: 'brands',
      file,
    });
    const updatedBrand = await this.brandRepository.findOneAndUpdate({
      filter: { _id: id, createdBy: user._id },
      update: { image: url },
    });
    if (!updatedBrand) {
      await this.s3Service.deleteFile({
        Key: url,
      });
      throw new ConflictException('Error updating brand image');
    }
    await this.s3Service.deleteFile({
      Key: brand.image,
    });
    return updatedBrand;
  }
  //=================== Freeze Brand ===================
  async freezeBrand(id: Types.ObjectId, user: HUserDocument) {
    const brand = await this.brandRepository.findOneAndUpdate({
      filter: { _id: id, createdBy: user._id, deletedAt: { $exists: false } },
      update: { deletedAt: new Date(), updatedBy: user._id },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found or already frozen');
    }
    return brand;
  }
  //=================== restore Brand ===================
  async restoreBrand(id: Types.ObjectId, user: HUserDocument) {
    //we wrirte paranois: true to arrive to middleware of findOneAndUpdate in the repository to check if the document is frozen or not
    const brand = await this.brandRepository.findOneAndUpdate({
      filter: { _id: id, deletedAt: { $exists: true }, paranoid: false },
      update: {
        $unset: { deletedAt: '' },
        restoredAt: new Date(),
        updatedBy: user._id,
      },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found or already restored');
    }
    return brand;
  }
  //=================== Delete Brand ===================
  async deleteBrand(id: Types.ObjectId, user: HUserDocument) {
    const brand = await this.brandRepository.findOneAndDelete({
      _id: id,
      createdBy: user._id,
      deletedAt: { $exists: true },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found or already deleted');
    }
    await this.s3Service.deleteFile({
      Key: brand.image,
    });
    return brand;
  }
  //=================== Get All Brands ===================
  async getAllBrands(query: QueryDto) {
    const { page = 1, limit = 20 } = query;
    const search = query.search?.replace(
      /[.*+?^${\}()|[\]\\]/g,
      (match) => '\\' + match,
    );
    const { currentPage, countDocument, numberOfPages, docs } =
      await this.brandRepository.paginate({
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
  //=================== cash ===============
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cash(query: QueryDto) {}
}
