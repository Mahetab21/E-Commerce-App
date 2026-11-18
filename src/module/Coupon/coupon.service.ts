import {
  ConflictException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CouponRepository, ProductRepository } from '../../DB';
import type { HUserDocument } from '../../DB';
import { CreateCouponDto, updateCouponDto } from './coupon.dto';
import { Types } from 'mongoose';
@Injectable()
export class CouponService {
  constructor(
    private readonly CouponRepository: CouponRepository,
    private readonly productRepository: ProductRepository,
  ) {}
  //=================== Create Coupon ===================
  async createCoupon(body: CreateCouponDto, user: HUserDocument) {
    const { code, amount, fromDate, toDate }: CreateCouponDto = body;
    if (new Date(toDate) <= new Date(fromDate))
      throw new BadRequestException('toDate must be after fromDate');
    const couponExist = await this.CouponRepository.findOne({
      code: code.toLowerCase(),
    });
    if (couponExist) {
      throw new ConflictException('Coupon code already exists');
    }
    const newCoupon = await this.CouponRepository.create({
      code: code.toLowerCase(),
      amount,
      fromDate,
      toDate,
      createdBy: user._id,
    });
    if (!newCoupon) {
      throw new InternalServerErrorException('Failed to create coupon');
    }
    return newCoupon;
  }
  //=================== Update Coupon ===================
  async updateCoupon(
    id: Types.ObjectId,
    couponDto: updateCouponDto,
    user: HUserDocument,
  ) {
    const { code, amount, fromDate, toDate } = couponDto;
    const coupon = await this.CouponRepository.findOne({ _id: id });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    if (
      new Date(toDate ?? coupon.toDate) <= new Date(fromDate ?? coupon.fromDate)
    )
      throw new BadRequestException('toDate must be after fromDate');
    if (code && code.toLowerCase() !== coupon.code.toLowerCase()) {
      const couponExist = await this.CouponRepository.findOne({
        code: code.toLowerCase(),
      });
      if (couponExist) {
        throw new ConflictException('Coupon code already exists');
      }
    }
    const updatedCoupon = await this.CouponRepository.findOneAndUpdate({
      filter: { _id: id },
      update: {
        ...(code !== undefined && { code: code.toLowerCase() }),
        ...(amount !== undefined && { amount }),
        ...(fromDate !== undefined && { fromDate }),
        ...(toDate !== undefined && { toDate }),
        updatedBy: user._id,
        updatedAt: new Date(),
      },
      options: { new: true },
    });

    if (!updatedCoupon) {
      throw new InternalServerErrorException('Failed to update coupon');
    }

    return updatedCoupon;
  }
}
