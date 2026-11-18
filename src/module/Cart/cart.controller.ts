import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { TokenTypeEnum, UserRole } from '../../common/enums';
import { Auth, User } from '../../common/decorators';
import type { HUserDocument } from '../../DB';
import { CreateCartDto, paramDto, updateQuantityDto } from './cart.dto';
import { CartService } from './cart.service';
@Controller('Carts')
export class CartController {
  constructor(private readonly CartService: CartService) {}
  //------- create Cart -------
  @Post()
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async createCart(
    @Body() CartDto: CreateCartDto,
    @User() user: HUserDocument,
  ) {
    const Cart = await this.CartService.createCart(CartDto, user);
    return { message: 'Done', Cart };
  }
  //----------- remove product from cart -----------
  @Delete(':id')
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async removeProductFromCart(
    @Param() param: paramDto,
    @User() user: HUserDocument,
  ) {
    const Cart = await this.CartService.removeProductFromCart(param.id, user);
    return { message: 'Done', Cart };
  }
  //----------- update product quantity in cart -----------
  @Patch(':id')
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async updateProductQuantityInCart(
    @Param() param: paramDto,
    @Body() body: updateQuantityDto,
    @User() user: HUserDocument,
  ) {
    const Cart = await this.CartService.updateProductQuantityInCart(
      param.id,
      user,
      body,
    );
    return { message: 'Done', Cart };
  }
  //----------- clear cart -----------
  @Delete()
  @Auth({
    role: [UserRole.ADMIN, UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  async clearCart(@User() user: HUserDocument) {
    const Cart = await this.CartService.clearCart(user);
    return { message: 'Cart cleared successfully', Cart };
  }
}
