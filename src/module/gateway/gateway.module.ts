import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { TokenService } from '../../common/services';
import { JwtService } from '@nestjs/jwt';
import { UserModel, UserRepository } from '../../DB';

@Module({
  imports: [UserModel],
  providers: [SocketGateway, TokenService, JwtService, UserRepository],
  exports: [],
})
export class GatewayModule {}
