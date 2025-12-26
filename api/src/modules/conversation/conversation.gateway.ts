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

  private clientConfigs = new Map<WebSocket, { ttsProvider: 'openai' | 'deepgram'; voice: string; systemInstruction?: string }>();
  
  // Audio Response Queue: Ensures audio chunks are sent in order for each client
  private responseQueues = new Map<WebSocket, Promise<void>>();

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
    const systemInstruction = url.searchParams.get('systemInstruction') || undefined;

    this.clientConfigs.set(client, { ttsProvider, voice, systemInstruction });
    this.responseQueues.set(client, Promise.resolve()); // Initialize queue

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
        await this.processTextResponse(client, transcript);

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

    client.on('message', async (data) => {
        if (Buffer.isBuffer(data)) {
            // Try to parse as JSON first (for text input)
            try {
                const message = JSON.parse(data.toString());
                if (message.event === 'text_input' && message.text) {
                    console.log('Received Text Input:', message.text);
                    await this.processTextResponse(client, message.text);
                    return;
                }
            } catch (e) {
                // Not JSON, treat as audio
            }

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
    this.responseQueues.delete(client);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: string,
    @ConnectedSocket() client: WebSocket,
  ): void {
    console.log('Received ping:', data);
    client.send(JSON.stringify({ event: 'pong', data: 'pong' }));
  }

  private async processTextResponse(client: WebSocket, text: string) {
     // Trigger LLM and TTS
     try {
        const config = this.clientConfigs.get(client);
        const stream = await this.groqService.generateStream(text, config?.systemInstruction);
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
                    console.log(`\nQueuing Audio Generation for: "${sentenceToSpeak}"`);
                    this.queueAudioGeneration(client, sentenceToSpeak);
                }
            }
          }
        }
        
        // Handle any remaining text in buffer
        if (sentenceBuffer.trim().length > 0) {
           console.log(`\nQueuing Audio Generation for remaining: "${sentenceBuffer}"`);
           this.queueAudioGeneration(client, sentenceBuffer);
        }
        
        console.log('\nLLM Stream finished');
      } catch (error) {
        console.error('Groq Error:', error);
      }
  }

  /**
   * Generates audio in parallel but sends it sequentially.
   */
  private queueAudioGeneration(client: WebSocket, text: string) {
      // 1. Start generation immediately (Parallel)
      const audioPromise = this.generateAudioInternal(client, text);

      // 2. Queue the sending (Sequential)
      const currentQueue = this.responseQueues.get(client) || Promise.resolve();

      const nextQueue = currentQueue.then(async () => {
          try {
              const audioBuffer = await audioPromise; // Wait for THIS specific audio to be ready
              if (client.readyState === WebSocket.OPEN) {
                  client.send(audioBuffer); // Send binary audio
              }
          } catch (error) {
              console.error(`Failed to send audio for "${text}":`, error);
          }
      });

      // Update the queue tail
      this.responseQueues.set(client, nextQueue);
  }

  private async generateAudioInternal(client: WebSocket, text: string): Promise<Buffer> {
      const config = this.clientConfigs.get(client);
      
      if (config?.ttsProvider === 'openai') {
          return await this.openAiService.generateAudio(text, config.voice as any);
      } else {
          // Fallback/Default to Deepgram if specified
          return await this.deepgramService.generateAudio(text);
      }
  }
}
