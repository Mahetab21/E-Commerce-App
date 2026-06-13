import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { OrderService } from './order.service';
import { Auth, User } from 'src/common/decorators';
import { UserRole, TokenTypeEnum } from 'src/common/enums';
import { CreateOrderDto, paramDto } from './order.dto';
import type { HUserDocument } from 'src/DB';
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
  async webhook(@Body() body: any) {
    await this.OrderService.webhook(body);
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
