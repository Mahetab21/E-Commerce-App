import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { HUserDocument, OtpRepository, UserRepository } from '../../DB';
import { OtpEnumType, UserProvider, UserRole } from '../../common/enums';
import { S3Service, TokenService } from '../../common/services';
import { Compare } from '../../common/utilits/hash';
import {
  generateOtp,
  sendEmail,
} from '../../common/services/email/email.service';
import { signUpDTO } from './dto/signup.dto';
import { SignInDto } from './dto/login.dto';
import { VerifyEmailDto, resendOtpDto } from './dto/verify_email.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forget&resetPassword';
import { GoogleOAuthDto } from './dto/google-oauth.dto';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private otpRepository: OtpRepository,
    private readonly s3Service: S3Service,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  private async sendOtp(user: HUserDocument, type: OtpEnumType) {
    const filter = { createdBy: user._id, type };
    const existing = await this.otpRepository.findOne(filter);
    if (existing && existing.expireAt.getTime() > Date.now() + 9 * 60_000) {
      throw new BadRequestException(
        'Please wait one minute before requesting another code',
      );
    }
    await this.otpRepository.deleteMany(filter);
    const code = generateOtp().toString();
    const record = await this.otpRepository.create({
      ...filter,
      code,
      expireAt: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
    });
    try {
      await sendEmail({
        to: user.email,
        subject: type,
        text: `Your code is ${code}. It expires in 10 minutes.`,
      });
    } catch (error) {
      await this.otpRepository.deleteOne({ _id: record._id });
      throw error;
    }
  }

  private async consumeOtp(
    user: HUserDocument,
    code: string,
    type: OtpEnumType,
  ) {
    const record = await this.otpRepository.findOneAndUpdate({
      filter: {
        createdBy: user._id,
        type,
        expireAt: { $gt: new Date() },
        attempts: { $lt: 5 },
      },
      update: { $inc: { attempts: 1 } },
    });
    if (!record || !(await Compare(code, record.code)))
      throw new BadRequestException('Invalid or expired code');
    // Atomically consume it: concurrent requests cannot reuse the same code.
    const consumed = await this.otpRepository.findOneAndDelete({
      _id: record._id,
      expireAt: { $gt: new Date() },
    });
    if (!consumed) throw new BadRequestException('Code already used');
  }

  private async tokens(user: HUserDocument) {
    const admin = user.role === UserRole.ADMIN;
    const payload = {
      email: user.email,
      id: user._id,
      version: user.tokenVersion,
    };
    return {
      access_token: await this.tokenService.GenerateToken({
        payload,
        options: {
          secret:
            process.env[admin ? 'ACCESS_TOKEN_ADMIN' : 'ACCESS_TOKEN_USER'],
          expiresIn: '15m',
        },
      }),
      refresh_token: await this.tokenService.GenerateToken({
        payload,
        options: {
          secret:
            process.env[admin ? 'REFRESH_TOKEN_ADMIN' : 'REFRESH_TOKEN_USER'],
          expiresIn: '7d',
        },
      }),
    };
  }

  async signUp(body: signUpDTO) {
    const email = body.email.trim().toLowerCase();
    if (await this.userRepository.findOne({ email }))
      throw new ConflictException('Email already registered');
    const names = body.userName?.trim().split(/\s+/);
    const firstName = names ? names[0] : body.firstName;
    const lastName = names ? names.slice(1).join(' ') : body.lastName;
    if (
      !firstName ||
      !lastName ||
      firstName.length < 2 ||
      lastName.length < 2
    ) {
      throw new BadRequestException('Provide both first and last names');
    }
    const user = await this.userRepository.create({
      email,
      firstName,
      lastName,
      age: body.age,
      password: body.password,
      gender: body.gender,
      role: UserRole.USER,
      confirmed: false,
    });
    await this.sendOtp(user, OtpEnumType.CONFIRM_EMAIL);
    return { message: 'Account created; check your email', user };
  }

  async resendOtp(body: resendOtpDto) {
    const user = await this.userRepository.findOne({
      email: body.email.trim().toLowerCase(),
      confirmed: false,
    });
    if (user) await this.sendOtp(user, OtpEnumType.CONFIRM_EMAIL);
    return {
      message: 'If the account needs confirmation, a code has been sent',
    };
  }

  async confirmEmail(body: VerifyEmailDto) {
    const user = await this.userRepository.findOne({
      email: body.email.trim().toLowerCase(),
      confirmed: false,
    });
    if (!user) throw new BadRequestException('Invalid or expired code');
    await this.consumeOtp(user, body.code, OtpEnumType.CONFIRM_EMAIL);
    user.confirmed = true;
    await user.save();
    return { message: 'Email confirmed successfully' };
  }

  async signIn(body: SignInDto) {
    const user = await this.userRepository.findOne({
      email: body.email.trim().toLowerCase(),
      confirmed: true,
      provider: UserProvider.LOCAL,
    });
    if (!user || !(await Compare(body.password, user.password)))
      throw new UnauthorizedException('Invalid credentials');
    return { message: 'Signed in', ...(await this.tokens(user)) };
  }

  async refreshToken(token: string) {
    if (!token || typeof token !== 'string')
      throw new UnauthorizedException('Invalid refresh token');
    for (const role of [UserRole.USER, UserRole.ADMIN]) {
      try {
        const secret =
          process.env[
            role === UserRole.ADMIN
              ? 'REFRESH_TOKEN_ADMIN'
              : 'REFRESH_TOKEN_USER'
          ];
        const { user } = await this.tokenService.decodedTokenAndFetchUser(
          token,
          secret!,
        );
        if (user.role !== role) continue;
        return { message: 'Token refreshed', ...(await this.tokens(user)) };
      } catch {
        /* Try the other role's signing key. */
      }
    }
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async forgetPassword(body: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      email: body.email.trim().toLowerCase(),
      confirmed: true,
      provider: UserProvider.LOCAL,
    });
    if (user) await this.sendOtp(user, OtpEnumType.FORGET_PASSWORD);
    return { message: 'If the account exists, a reset code has been sent' };
  }

  async resetPassword(body: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      email: body.email.trim().toLowerCase(),
      confirmed: true,
      provider: UserProvider.LOCAL,
    });
    if (!user) throw new BadRequestException('Invalid or expired code');
    await this.consumeOtp(user, body.otp, OtpEnumType.FORGET_PASSWORD);
    user.password = body.password;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.changeCredentials = new Date();
    await user.save(); // Runs the password hashing hook.
    return { message: 'Password reset successfully' };
  }

  async signInWithGoogle(body: GoogleOAuthDto) {
    const audience = this.configService.get<string>('WEB_CLIENT_ID');
    if (!audience)
      throw new BadRequestException('Google sign-in is not configured');
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: body.idToken,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified)
      throw new UnauthorizedException('Verified Google email required');
    const email = payload.email.toLowerCase();
    let user = await this.userRepository.findOne({ email });
    if (!user) {
      if (!body.firstName || !body.lastName || !body.age)
        throw new BadRequestException(
          'First sign-in requires firstName, lastName and age',
        );
      user = await this.userRepository.create({
        email,
        firstName: body.firstName,
        lastName: body.lastName,
        age: body.age,
        image: payload.picture,
        password: randomUUID(),
        confirmed: true,
        provider: UserProvider.GOOGLE,
        role: UserRole.USER,
      });
    }
    if (user.provider !== UserProvider.GOOGLE)
      throw new BadRequestException('Please use password sign-in');
    return {
      message: 'Signed in with Google',
      ...(await this.tokens(user)),
      user,
    };
  }

  uploadFile(file: Express.Multer.File, user: HUserDocument) {
    if (!file) throw new BadRequestException('An image attachment is required');
    return this.s3Service.uploadFile({ file, path: `users/${user._id}` });
  }

  async getProfile(userId: Types.ObjectId) {
    return this.userRepository.findOne({ _id: userId }, '-password');
  }
}
