import { Body, Controller, Patch, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { AddUserDto } from './dto/add_user.dto';
import { VerifyEmailDto } from './dto/verify_email.dto';
import { SignInDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Post('signup')
  async signUp(@Body() dto: AddUserDto) {
    return this.userService.signUp(dto);
  }

  @Patch('confirmEmail')
  async confirmEmail(@Body() dto: VerifyEmailDto) {
    return this.userService.confirmEmail(dto);
  }
  @Post('signin')
  async signIn(@Body() dto: SignInDto) {
    return this.userService.signIn(dto);
  }
  @Patch('forgotPassword')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userService.forgetPassword(dto);
  }
  @Patch('resetPassword')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(dto);
  }

  @Post('google-oauth')
  async googleOAuth(@Body() dto: GoogleOAuthDto) {
    return this.userService.signInWithGoogle(dto);
  }
}
