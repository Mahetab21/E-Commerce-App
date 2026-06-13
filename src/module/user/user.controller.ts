import {
  Body,
  Controller,
  Post,
  Patch,
  Get,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { signUpDTO } from './dto/signup.dto';
import { resendOtpDto } from './dto/verify_email.dto';
import { VerifyEmailDto } from './dto/verify_email.dto';
import { SignInDto } from './dto/login.dto';
// import { ForgotPasswordDto, ResetPasswordDto } from './dto/password';
// import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { Auth, User } from 'src/common/decorators';
import type { HUserDocument } from 'src/DB/models/user.model';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileValidation, multerCloud } from 'src/common/utilits/multer';
import { storageType } from 'src/common/enums/multer.enum';
import { UserRole } from 'src/common/enums/user.enum';
import { TokenTypeEnum } from 'src/common/enums/token.enum';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forget&resetPassword';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  //-------sign up -------
  @Post('signup')
  signUp(@Body() body: signUpDTO) {
    return this.userService.signUp(body);
  }
  //-------resend otp -------
  @Post('resendOtp')
  resendOtp(@Body() body: resendOtpDto) {
    return this.userService.resendOtp(body);
  }
  //-------confirm email -------
  @Patch('confirmEmail')
  confirmEmail(@Body() dto: VerifyEmailDto) {
    return this.userService.confirmEmail(dto);
  }
  //-------sign in -------
  @Post('signin')
  async signIn(@Body() body: SignInDto) {
    return this.userService.signIn(body);
  }
  //-------refresh token -------
  @Post('refreshToken')
  async refreshToken(@Body() { refresh_token }: { refresh_token: string }) {
    return this.userService.refreshToken(refresh_token);
  }

  //-------get profile -------
  @Auth()
  @Get('getProfile')
  async getProfile(@User() user: HUserDocument) {
    const profile = await this.userService.getProfile(user._id);
    return { message: 'Profile fetched successfully', user: profile };
  }
  //-------upload file -------
  @Auth({
    role: [UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor(
      'attachment',
      multerCloud({
        fileTypes: fileValidation.image,
        storeType: storageType.memory,
      }),
    ),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @User() user: HUserDocument,
  ) {
    const url = await this.userService.uploadFile(file, user);
    return { message: 'file uploaded successfully', url };
  }
  //-------forget password -------
  @Auth({
    role: [UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  @Patch('forgotPassword')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.userService.forgetPassword(body);
  }
  //-------reset password -------
  @Auth({
    role: [UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  @Patch('resetPassword')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.userService.resetPassword(body);
  }
  //-------google oauth -------
  @Post('google-oauth')
  async googleOAuth(@Body() body: GoogleOAuthDto) {
    return this.userService.signInWithGoogle(body);
  }
}
