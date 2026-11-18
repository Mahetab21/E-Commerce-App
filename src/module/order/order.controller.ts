import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from './order.service';
import { Auth, User } from '../../common/decorators';
import { UserRole, TokenTypeEnum } from '../../common/enums';
import { CreateOrderDto, paramDto } from './order.dto';
import type { HUserDocument } from '../../DB';
@Controller('Order')
export class OrderController {
  constructor(private readonly OrderService: OrderService) {}
  //---------- create Order -----------
  @Post()
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async createOrder(
    @Body() OrderDto: CreateOrderDto,
    @User() user: HUserDocument,
  ) {
    const order = await this.OrderService.createOrder(OrderDto, user);
    return { message: 'Done', order };
  }
  //-------------stripe checkout session -------------
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  @Post('/stripe/:id')
  async paymentWithStripe(
    @Param() params: paramDto,
    @User() user: HUserDocument,
  ) {
    return this.OrderService.paymentWithStripe(params.id, user);
  }
  @Post('/webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.OrderService.webhook(req.rawBody, signature);
  }
  @Auth({
    role: [UserRole.ADMIN],
    tokenType: TokenTypeEnum.access,
  })
  @Patch('/:id')
  async refundOrder(@Param() params: paramDto, @User() user: HUserDocument) {
    return this.OrderService.refundOrder(params.id, user);
  }
}
