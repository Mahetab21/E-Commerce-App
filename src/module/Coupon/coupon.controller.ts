import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { TokenTypeEnum, UserRole } from 'src/common/enums';
import { Auth, User } from 'src/common/decorators';
import type { HUserDocument } from 'src/DB';
import { CreateCouponDto, paramDto, updateCouponDto } from './coupon.dto';
import { CouponService } from './coupon.service';
@Controller('Coupons')
export class CouponController {
  constructor(private readonly CouponService: CouponService) {}
  //------- createCoupon -------
  @Post()
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async createCoupon(
    @Body() CouponDto: CreateCouponDto,
    @User() user: HUserDocument,
  ) {
    const Coupon = await this.CouponService.createCoupon(CouponDto, user);
    return { message: 'Done', Coupon };
  }
  //-------- updateCoupon -------
  @Patch(':id')
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async updateCoupon(
    @Param() params: paramDto,
    @Body() body: updateCouponDto,
    @User() user: HUserDocument,
  ) {
    const Coupon = await this.CouponService.updateCoupon(params.id, body, user);
    return { message: 'Done', Coupon };
  }
}
