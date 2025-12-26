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
import { GroqService } from '../ai-services/groq.service';

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

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly groqService: GroqService
  ) {}

  handleConnection(client: WebSocket) {
    console.log('Client connected');
    const deepgramLive = this.deepgramService.createLiveConnection();
    this.sessions.set(client, deepgramLive);

    deepgramLive.on('open', () => {
      console.log('Deepgram Live Connection Open');
    });

    deepgramLive.on('Results', async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && data.is_final) {
        console.log('Speech Final detected. Transcript:', transcript);
        if (client.readyState === WebSocket.OPEN) {
             client.send(JSON.stringify({ event: 'transcript', data: transcript }));
        }
        
        // Trigger LLM
        try {
          const stream = await this.groqService.generateStream(transcript);
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              process.stdout.write(content); // Log to terminal
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ event: 'llm_token', data: content }));
              }
            }
          }
          console.log('\nLLM Stream finished');
        } catch (error) {
          console.error('Groq Error:', error);
        }
      } else if (transcript) {
         // Interim results
         if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event: 'transcript', data: transcript }));
         }
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
