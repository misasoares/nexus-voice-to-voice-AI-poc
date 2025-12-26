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
import { OpenAiService } from '../ai-services/openai.service';

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

  // Track sessions and configurations
  private deepgramConnections = new Map<WebSocket, any>();
  private clientConfigs = new Map<WebSocket, { ttsProvider: 'openai' | 'deepgram'; voice: string }>();

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly groqService: GroqService,
    private readonly openAiService: OpenAiService,
  ) {}

  handleConnection(client: WebSocket, request: any) {
    console.log('Client connected');

    // Parse Query Params (e.g., /?ttsProvider=openai&voice=alloy)
    // Note: request might be IncomingMessage
    const urlString = request.url || '';
    // Use a dummy base because ws request.url is relative
    const url = new URL(urlString, 'http://localhost');
    
    const ttsProvider = (url.searchParams.get('ttsProvider') as 'openai' | 'deepgram') || 'openai';
    const voice = url.searchParams.get('voice') || 'alloy';

    this.clientConfigs.set(client, { ttsProvider, voice });
    console.log(`Client Config: Provider=${ttsProvider}, Voice=${voice}`);

    const deepgramLive = this.deepgramService.createLiveConnection();
    this.deepgramConnections.set(client, deepgramLive);

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
        
        // Trigger LLM and TTS
        try {
          const stream = await this.groqService.generateStream(transcript);
          let sentenceBuffer = '';
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
               // Log to terminal
              process.stdout.write(content);
              
              // Send text token to frontend
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ event: 'llm_token', data: content }));
              }

              // Buffer for TTS
              sentenceBuffer += content;
              
              // Check for sentence delimiters
              if (/[.?!]/.test(content)) {
                  // Found a sentence end.
                  const sentenceToSpeak = sentenceBuffer.trim();
                  sentenceBuffer = ''; // Clear buffer

                  if (sentenceToSpeak.length > 0) {
                      console.log(`\nGenerating Audio for: "${sentenceToSpeak}"`);
                      await this.generateAndSendAudio(client, sentenceToSpeak);
                  }
              }
            }
          }
          
          // Handle any remaining text in buffer
          if (sentenceBuffer.trim().length > 0) {
             console.log(`\nGenerating Audio for remaining: "${sentenceBuffer}"`);
             await this.generateAndSendAudio(client, sentenceBuffer);
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
            const connection = this.deepgramConnections.get(client);
            if (connection && connection.getReadyState() === 1) { // OPEN
                connection.send(data);
            }
        }
    });
  }

  handleDisconnect(client: WebSocket) {
    console.log('Client disconnected');
    const deepgramLive = this.deepgramConnections.get(client);
    if (deepgramLive) {
      deepgramLive.finish();
      this.deepgramConnections.delete(client);
    }
    this.clientConfigs.delete(client);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: string,
    @ConnectedSocket() client: WebSocket,
  ): void {
    console.log('Received ping:', data);
    client.send(JSON.stringify({ event: 'pong', data: 'pong' }));
  }

  private async generateAndSendAudio(client: WebSocket, text: string) {
      try {
          const config = this.clientConfigs.get(client);
          let audioBuffer: Buffer;

          if (config?.ttsProvider === 'openai') {
              audioBuffer = await this.openAiService.generateAudio(text, config.voice as any);
          } else {
              // Fallback/Default to Deepgram if specified
              audioBuffer = await this.deepgramService.generateAudio(text);
          }

          if (client.readyState === WebSocket.OPEN) {
              client.send(audioBuffer); // Send binary audio
          }
      } catch (e) {
          console.error('TTS Generation Error:', e);
      }
  }
}
