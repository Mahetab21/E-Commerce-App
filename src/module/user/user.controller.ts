import { Body, Controller, Post, Patch, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { signUpDTO } from './dto/signup.dto';
import { resendOtpDto } from './dto/verify_email.dto';
import { VerifyEmailDto } from './dto/verify_email.dto';
import { SignInDto } from './dto/login.dto';
// import { ForgotPasswordDto, ResetPasswordDto } from './dto/password';
// import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { Auth, User } from 'src/common/decorators';
import type { HUserDocument } from 'src/DB/models/user.model';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Post('signup')
  signUp(@Body() body: signUpDTO) {
    return this.userService.signUp(body);
  }
  @Post('resendOtp')
  resendOtp(@Body() body: resendOtpDto) {
    return this.userService.resendOtp(body);
  }

  @Patch('confirmEmail')
  confirmEmail(@Body() dto: VerifyEmailDto) {
    return this.userService.confirmEmail(dto);
  }
  @Post('signin')
  async signIn(@Body() body: SignInDto) {
    return this.userService.signIn(body);
  }
  @Auth()
  @Get('getProfile')
  getProfile(@User() user: HUserDocument) {
    return { message: 'Profile fetched successfully', user };
  }
  // @Patch('forgotPassword')
  // async forgotPassword(@Body() dto: ForgotPasswordDto) {
  //   return this.userService.forgetPassword(dto);
  // }
  // @Patch('resetPassword')
  // async resetPassword(@Body() dto: ResetPasswordDto) {
  //   return this.userService.resetPassword(dto);
  // }

  // @Post('google-oauth')
  // async googleOAuth(@Body() dto: GoogleOAuthDto) {
  //   return this.userService.signInWithGoogle(dto);
  // }
}
