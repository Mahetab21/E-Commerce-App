import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Compare } from 'src/common/utilits/hash';
import { VerifyEmailDto } from './dto/verify_email.dto';
// import { SignInDto } from './dto/login.dto';
// import { ForgotPasswordDto, ResetPasswordDto } from './dto/password';
// import { GoogleAuthDto } from './dto/google-oauth.dto';
// import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { signUpDTO } from './dto/signup.dto';
// import { v4 as uuidv4 } from 'uuid';
// import { UserProvider } from 'src/common/enums';
import { eventEmitter } from 'src/common/utilits/email.event';
import { generateOtp } from 'src/common/services/email/email.service';
import { HUserDocument, OtpRepository, UserRepository } from 'src/DB';
import {
  OtpEnumType,
  UserGender,
  UserProvider,
  UserRole,
} from 'src/common/enums';
import { resendOtpDto } from './dto/verify_email.dto';
import { Types } from 'mongoose';
import { SignInDto } from './dto/login.dto';
import { S3Service, TokenService } from 'src/common/services';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forget&resetPassword';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private otpRepository: OtpRepository,
    private readonly s3Service: S3Service,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}
  private async sendOtp(userId: Types.ObjectId) {
    const otp = generateOtp();
    await this.otpRepository.create({
      code: otp.toString(),
      createdBy: userId,
      type: OtpEnumType.CONFIRM_EMAIL,
      expireAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  }
  //==================== Sign Up ====================
  async signUp(body: signUpDTO) {
    const { email, age, firstName, lastName, userName, gender } = body;
    const existingUser = await this.userRepository.findOne({
      email: body.email,
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const user = await this.userRepository.create({
      email,
      firstName,
      lastName,
      userName,
      age,
      password: body.password, // Remove manual hashing - pre-save middleware handles this
      confirmed: false,
      gender: gender ?? UserGender.MALE,
      role: body.role ?? UserRole.USER,
    });
    if (!user) {
      throw new BadRequestException('Failed to create user');
    }
    const otp = generateOtp().toString();
    eventEmitter.emit('confirmEmail', { email: body.email, otp });
    await this.sendOtp(user._id);
    return {
      message: 'User created successfully',
      user,
    };
  }
  //==================== Resend OTP ====================
  async resendOtp(body: resendOtpDto) {
    const { email } = body;
    const user = await this.userRepository.findOne(
      { email, confirmed: false },
      undefined,
      {
        populate: {
          path: 'otp',
        },
      },
    );
    if (!user) {
      throw new BadRequestException('User not found or already confirmed');
    }
    if (user.otp && user.otp.expireAt > new Date()) {
      throw new BadRequestException('OTP already sent');
    }

    await this.sendOtp(user._id);
    return {
      message: 'OTP resent successfully',
    };
  }
  //==================== confirm Email ===============
  async confirmEmail(body: VerifyEmailDto) {
    const { email, code } = body;
    const user = await this.userRepository.findOne(
      {
        email,
        confirmed: false,
      },
      undefined,
      {
        populate: {
          path: 'otp',
        },
      },
    );
    if (!user) {
      throw new BadRequestException('User not found or already confirmed');
    }
    console.log('Code from user:', code);
    console.log('OTP from DB:', user.otp);

    if (
      !user.otp ||
      user.otp.expireAt < new Date() ||
      !(await Compare(code, user.otp.code))
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    user.confirmed = true;
    await user.save();
    await this.otpRepository.deleteOne({
      createdBy: user._id,
    });
    return {
      message: 'Email confirmed successfully',
    };
  }
  //==================== sign In ====================
  async signIn(body: SignInDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, password } = body;
    const user = await this.userRepository.findOne({
      email: body.email,
      confirmed: true,
    });
    if (!user) {
      throw new BadRequestException('Invalid email or unconfirmed account');
    }
    if (!(await Compare(body.password, user.password))) {
      throw new BadRequestException('Invalid password');
    }
    const access_token = await this.tokenService.GenerateToken({
      payload: { email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.ACCESS_TOKEN_USER!
            : process.env.ACCESS_TOKEN_ADMIN!,
        expiresIn: '1d',
      },
    });
    const refresh_token = await this.tokenService.GenerateToken({
      payload: { email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.REFRESH_TOKEN_USER!
            : process.env.REFRESH_TOKEN_ADMIN!,
        expiresIn: '1y',
      },
    });

    return {
      message: 'User logged in successfully',
      access_token,
      refresh_token,
    };
  }
  //==================== Refresh Token ====================
  async refreshToken(refresh_token: string) {
    let decoded: any;
    let userRole: UserRole;
    try {
      decoded = await this.tokenService.VerifyToken({
        token: refresh_token,
        options: { secret: process.env.REFRESH_TOKEN_USER! },
      });
      userRole = UserRole.USER;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      try {
        decoded = await this.tokenService.VerifyToken({
          token: refresh_token,
          options: { secret: process.env.REFRESH_TOKEN_ADMIN! },
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        userRole = UserRole.ADMIN;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        throw new BadRequestException('Invalid or expired refresh token');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!decoded?.email || !decoded?.id) {
      throw new BadRequestException('Invalid refresh token');
    }

    // Get the user to ensure they still exist and are confirmed
    const user = await this.userRepository.findOne({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      _id: decoded.id as string,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      email: decoded.email as string,
      confirmed: true,
    });

    if (!user) {
      throw new BadRequestException('User not found or not confirmed');
    }

    // Generate new access token using user's actual role
    const access_token = await this.tokenService.GenerateToken({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      payload: { email: decoded.email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.ACCESS_TOKEN_USER!
            : process.env.ACCESS_TOKEN_ADMIN!,
        expiresIn: '1d',
      },
    });

    // Generate new refresh token using user's actual role
    const new_refresh_token = await this.tokenService.GenerateToken({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      payload: { email: decoded.email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.REFRESH_TOKEN_USER!
            : process.env.REFRESH_TOKEN_ADMIN!,
        expiresIn: '1y',
      },
    });

    return {
      message: 'Token refreshed successfully',
      access_token,
      refresh_token: new_refresh_token,
    };
  }
  //==================== upload file ====================
  uploadFile(file: Express.Multer.File, user: HUserDocument) {
    return this.s3Service.uploadFile({
      file,
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      path: `users/${user._id}`,
    });
  }
  //==================== forget Password ====================
  async forgetPassword(body: ForgotPasswordDto) {
    const { email } = body;
    const user = await this.userRepository.findOne({
      email,
      confirmed: { $exists: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const otp = generateOtp().toString();
    // Remove manual emission - the OTP model's post-save hook handles this
    await this.otpRepository.create({
      code: otp,
      createdBy: user._id,
      type: OtpEnumType.FORGET_PASSWORD,
      expireAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return {
      message: 'OTP sent to email successfully',
    };
  }
  //===================== reset Password =====================
  async resetPassword(body: ResetPasswordDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, otp, password, cPassword } = body;
    const user = await this.userRepository.findOne({
      email,
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const existingOtp = await this.otpRepository.findOne({
      createdBy: user._id,
      type: OtpEnumType.FORGET_PASSWORD,
    });
    console.log('OTP BEFORE COMPARE:', otp);
    console.log('OTP TYPE:', typeof otp);
    console.log('DB HASH:', existingOtp?.code);
    console.log('DB TYPE:', typeof existingOtp?.code);
    if (!existingOtp || !(await Compare(otp, existingOtp.code))) {
      throw new BadRequestException('Invalid OTP');
    }
    await this.userRepository.updateOne(
      { email: user?.email },
      { password: password, $unset: { otp: '' } },
    );
    await this.otpRepository.deleteOne({
      createdBy: user._id,
      type: OtpEnumType.FORGET_PASSWORD,
    });
    return { message: 'Password reset successfully' };
  }
  //==================== Google OAuth Sign In/Up ====================
  async signInWithGoogle(body: GoogleOAuthDto) {
    const { idToken } = body;
    const client = new OAuth2Client();
    async function verify() {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.WEB_CLIENT_ID!,
      });
      const payload = ticket.getPayload();
      return payload;
    }
    const { email, email_verified, picture, name } =
      (await verify()) as TokenPayload;
    //check email
    let user = await this.userRepository.findOne({ email });
    if (!user) {
      user = await this.userRepository.create({
        email: email!,
        image: picture!,
        confirmed: email_verified!,
        userName: name!,
        password: uuidv4(),
        provider: UserProvider.GOOGLE,
      });
    }
    if (user?.provider === UserProvider.LOCAL) {
      throw new BadRequestException(
        'Email already registered with system. Please use normal login.',
      );
    }
    const access_token = await this.tokenService.GenerateToken({
      payload: { email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.ACCESS_TOKEN_USER!
            : process.env.ACCESS_TOKEN_ADMIN!,
        expiresIn: '1d',
      },
    });

    const refresh_token = await this.tokenService.GenerateToken({
      payload: { email, id: user._id },
      options: {
        secret:
          user.role == UserRole.USER
            ? process.env.REFRESH_TOKEN_USER!
            : process.env.REFRESH_TOKEN_ADMIN!,
        expiresIn: '1y',
      },
    });
    return {
      message: 'User logged in with google successfully',
      access_token,
      refresh_token,
      user,
    };
  }
  //==================== get Profile ====================
  async getProfile(userId: Types.ObjectId) {
    const user = await this.userRepository.findOne(
      { _id: userId },
      '-password', // Exclude password field
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }
}
