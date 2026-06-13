import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Auth } from 'src/common/decorators';
import { TokenTypeEnum, UserRole } from 'src/common/enums';
@WebSocketGateway(80, {
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor() {}
  @WebSocketServer()
  private io: Server;
  @Auth({
    role: [UserRole.USER],
    tokenType: TokenTypeEnum.access,
  })
  @SubscribeMessage('sayhi')
  handleSayHiEvent(
    @MessageBody() data: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(data);
    this.io.emit('hi', 'Hello from NestJS WebSocket Gateway!');
  }
  handleConnection(socket: Socket) {
    console.log('client connected:', socket.id);
  }
  handleDisconnect(socket: Socket) {
    console.log('client disconnected:', socket.id);
  }
  //Notification
  handleProductQuantityChange(productId: Types.ObjectId, quantity: number) {
    this.io.emit('productQuantityChanged', { productId, quantity });
  }
}
