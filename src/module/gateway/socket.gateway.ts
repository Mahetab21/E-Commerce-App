import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../../common/services';
@WebSocketGateway({ namespace: '/socket', cors: { origin: false } })
export class SocketGateway implements OnGatewayConnection {
  constructor(private readonly tokens: TokenService) {}
  @WebSocketServer() private io: Server;
  async handleConnection(socket: Socket) {
    try {
      const authorization =
        socket.handshake.auth?.authorization ||
        socket.handshake.headers.authorization;
      const [prefix, token] = String(authorization || '').split(' ');
      const signature = await this.tokens.GetSignature(prefix);
      if (!signature || !token) throw new Error('Missing credentials');
      const { user } = await this.tokens.decodedTokenAndFetchUser(
        token,
        signature,
      );
      await socket.join(user.id);
    } catch {
      socket.disconnect(true);
    }
  }
}
