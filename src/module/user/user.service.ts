import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRepository } from '../../DB/repositories/user.repo';
import { AddUserDto } from './dto/add_user.dto';
import { BcryptUtil } from 'src/common/utilits/hash';
import { EmailService } from 'src/common/services/email.service';
import { VerifyEmailDto } from './dto/verify_email.dto';
import { SignInDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { emailTemplate } from 'src/common/services/send.temp';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { UserProvider } from 'src/common/enums';
@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  //==================== Sign Up ====================
  async signUp(dto: AddUserDto) {
    const existingUser = await this.userRepository.findOne({
      email: dto.email,
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const hashedPassword = await BcryptUtil.hashPassword(dto.password);
    const otp = this.emailService.generateOtp().toString();
    const otpHash = await BcryptUtil.hashPassword(otp);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await this.emailService.sendEmail({
      to: dto.email,
      subject: 'Confirm your email',
      html: emailTemplate(otp, 'Email Confirmation'),
    });

    const user = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
      otp: otpHash,
      confirmed: false,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    });
    return {
      message: 'User created successfully',
      user,
    };
  }
  //==================== confirm Email ===============
  async confirmEmail(dto: VerifyEmailDto) {
    const user = await this.userRepository.findOne({
      email: dto.email,
      confirmed: false,
    });
    if (!user) {
      throw new BadRequestException('Invalid email or already confirmed');
    }
    if (!user.otpExpires || user.otpExpires < new Date()) {
      throw new BadRequestException('OTP has expired');
    }
    const isOtpValid = await BcryptUtil.comparePassword(dto.otp, user.otp);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }
    await this.userRepository.updateOne(
      { email: dto.email },
      { $set: { confirmed: true }, $unset: { otp: '', otpExpires: '' } },
    );

    return {
      message: 'Email confirmed successfully',
    };
  }
  //==================== sign In ====================
  async signIn(dto: SignInDto) {
    const user = await this.userRepository.findOne({
      email: dto.email,
      confirmed: true,
    });
    if (!user) {
      throw new BadRequestException('Invalid email or unconfirmed account');
    }
    if (!(await BcryptUtil.comparePassword(dto.password, user.password))) {
      throw new BadRequestException('Invalid password');
    }
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      message: 'Sign in successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        role: user.role,
      },
    };
  }
  //==================== forget Password ====================
  async forgetPassword({ email }: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const otp = this.emailService.generateOtp().toString();
    const otpHash = await BcryptUtil.hashPassword(otp);
    await this.emailService.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html: emailTemplate(otp, 'Forget Password'),
    });
    await this.userRepository.updateOne(
      { email },
      { otp: otpHash, otpExpires: new Date(Date.now() + 10 * 60 * 1000) },
    );
    return { message: 'OTP sent successfully to your email' };
  }
  //===================== reset Password =====================
  async resetPassword({ email, otp, password }: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      email,
      otp: { $exists: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!(await BcryptUtil.comparePassword(otp, user.otp))) {
      throw new BadRequestException('Invalid OTP');
    }
    const hashedPassword = await BcryptUtil.hashPassword(password);
    await this.userRepository.updateOne(
      { email: email },
      {
        $set: { password: hashedPassword },
        $unset: { otp: '', otpExpires: '' },
      },
    );

    return { message: 'Password reset successfully' };
  }

  //==================== Google OAuth Sign In/Up ====================
  async signInWithGoogle(dto: GoogleOAuthDto) {
    const client = new OAuth2Client();

    const ticket = await client.verifyIdToken({
      idToken: dto.idToken,
      audience: this.configService.get('WEB_CLIENT_ID'),
    });
    const googlePayload = ticket.getPayload();

    const { email, email_verified, picture, name } =
      googlePayload as TokenPayload;

    // Check if user exists
    let user = await this.userRepository.findOne({ email: email! });

    if (!user) {
      // Create new user for Google OAuth
      user = await this.userRepository.create({
        email: email!,
        image: picture!,
        confirmed: email_verified!,
        userName: name!,
        password: await BcryptUtil.hashPassword(uuidv4()), // Random password for OAuth users
        provider: UserProvider.GOOGLE,
      });
    }

    // Check if user is trying to login with Google but registered with system
    if (user.provider === UserProvider.LOCAL) {
      throw new BadRequestException(
        'This email is registered with a password. Please sign in with your password instead.',
      );
    }

    const jwtPayload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const jwtid = uuidv4();
    const accessToken = this.jwtService.sign(
      { ...jwtPayload, jti: jwtid },
      { expiresIn: '1d' },
    );
    const refreshToken = this.jwtService.sign(
      { ...jwtPayload, jti: jwtid },
      { expiresIn: '7d' },
    );

    return {
      message: 'User logged in with Google successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        role: user.role,
        image: user.image,
        provider: user.provider,
      },
    };
  }
}
