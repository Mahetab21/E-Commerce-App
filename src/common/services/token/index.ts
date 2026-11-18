import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { JwtPayload } from 'jsonwebtoken';
import { TokenTypeEnum } from '../../enums';
import { UserRepository } from '../../../DB';
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly UserRepo: UserRepository,
  ) {}
  //function to generate token
  GenerateToken = async ({
    payload,
    options,
  }: {
    payload: object;
    options?: JwtSignOptions;
  }): Promise<string> => {
    return this.jwtService.signAsync(payload, options);
  };
  //function to verify token
  VerifyToken = async ({
    token,
    options,
  }: {
    token: string;
    options?: JwtVerifyOptions;
  }): Promise<JwtPayload> => {
    return this.jwtService.verifyAsync(token, {
      ...options,
      algorithms: ['HS256'],
    });
  };
  //function to get signature based on token type and prefix
  // eslint-disable-next-line @typescript-eslint/require-await
  GetSignature = async (
    prefix: string,
    tokenType: TokenTypeEnum = TokenTypeEnum.access,
  ) => {
    if (tokenType === TokenTypeEnum.access) {
      if (prefix === process.env.BEARER_USER) {
        return process.env.ACCESS_TOKEN_USER;
      } else if (prefix === process.env.BEARER_ADMIN) {
        return process.env.ACCESS_TOKEN_ADMIN;
      } else {
        return null;
      }
    } else if (tokenType === TokenTypeEnum.refresh) {
      if (prefix === process.env.BEARER_USER) {
        return process.env.REFRESH_TOKEN_USER;
      } else if (prefix === process.env.BEARER_ADMIN) {
        return process.env.REFRESH_TOKEN_ADMIN;
      } else {
        return null;
      }
    }
  };
  //function to decode token and fetch user
  decodedTokenAndFetchUser = async (token: string, signature: string) => {
    const decoded = await this.VerifyToken({
      token,
      options: { secret: signature },
    });
    if (!decoded?.email || !decoded?.id || !Number.isInteger(decoded.version)) {
      throw new UnauthorizedException('Invalid Token');
    }
    const user = await this.UserRepo.findOne({
      _id: decoded.id,
      email: decoded.email,
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user?.confirmed) {
      throw new UnauthorizedException('Please confirm your email');
    }
    if (decoded.version !== user.tokenVersion)
      throw new UnauthorizedException('Token revoked');
    return { decoded, user };
  };
}
