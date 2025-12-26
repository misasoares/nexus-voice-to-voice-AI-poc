import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { DeepgramService } from '../ai-services/deepgram.service';

@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class ConversationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private sessions = new Map<WebSocket, any>();

  constructor(private readonly deepgramService: DeepgramService) {}

  handleConnection(client: WebSocket) {
    console.log('Client connected');
    const deepgramLive = this.deepgramService.createLiveConnection();
    this.sessions.set(client, deepgramLive);

    deepgramLive.on('open', () => {
      console.log('Deepgram Live Connection Open');
    });

    deepgramLive.on('Results', (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript) {
        console.log('Transcript:', transcript);
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ event: 'transcript', data: transcript }));
        }
      }
      if (data.is_final) {
          console.log('Speech Final detected');
      }
    });

    deepgramLive.on('error', (err) => {
      console.error('Deepgram Error:', err);
    });

    client.on('message', (data) => {
        if (Buffer.isBuffer(data)) {
            // Forward binary audio to Deepgram
            const connection = this.sessions.get(client);
            if (connection && connection.getReadyState() === 1) { // OPEN
                connection.send(data);
            }
        }
    });
  }

  handleDisconnect(client: WebSocket) {
    console.log('Client disconnected');
    const deepgramLive = this.sessions.get(client);
    if (deepgramLive) {
      deepgramLive.finish();
      this.sessions.delete(client);
    }
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: string,
    @ConnectedSocket() client: WebSocket,
  ): void {
    console.log('Received ping:', data);
    client.send(JSON.stringify({ event: 'pong', data: 'pong' }));
  }
}
