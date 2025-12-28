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
import { VOICE_BEHAVIOR_PROMPT } from './prompts';

// Pricing Constants (USD)
const GROQ_INPUT_PRICE_PER_M = 0.59;
const GROQ_OUTPUT_PRICE_PER_M = 0.79;
const OPENAI_TTS_PRICE_PER_M_CHAR = 15.00;
const DEEPGRAM_STT_PRICE_PER_MIN = 0.0059;
const USD_BRL_RATE = 5.54;

interface CostTracker {
  groq: {
    inputTokens: number;
    outputTokens: number;
    cost: number; // BRL
  };
  openai: {
    characters: number;
    cost: number; // BRL
  };
  deepgram: {
    seconds: number;
    cost: number; // BRL
    timer?: NodeJS.Timeout;
  };
  totalCost: number; // BRL
}

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
  private clientCosts = new Map<WebSocket, CostTracker>();
  
  // Audio Response Queue: Ensures audio chunks are sent in order for each client
  private responseQueues = new Map<WebSocket, Promise<void>>();

  // Transcript Buffer: Accumulates speech until silence (UtteranceEnd)
  private clientTranscriptBuffers = new Map<WebSocket, string>();

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly groqService: GroqService,
    private readonly openAiService: OpenAiService,
  ) {}

  handleConnection(client: WebSocket, request: any) {
    console.log('Client connected');

    // Parse Query Params (e.g., /?ttsProvider=openai&voice=alloy)
    const urlString = request.url || '';
    const url = new URL(urlString, 'http://localhost');
    
    const ttsProvider = (url.searchParams.get('ttsProvider') as 'openai' | 'deepgram') || 'openai';
    const voice = url.searchParams.get('voice') || 'shimmer';
    const systemInstruction = url.searchParams.get('systemInstruction') || undefined;

    this.clientConfigs.set(client, { ttsProvider, voice, systemInstruction });
    
    // Initialize Cost Tracker
    const tracker: CostTracker = {
      groq: { inputTokens: 0, outputTokens: 0, cost: 0 },
      openai: { characters: 0, cost: 0 },
      deepgram: { seconds: 0, cost: 0 },
      totalCost: 0,
    };
    this.clientCosts.set(client, tracker);
    
    // Deepgram cost will be calculated based on audio chunks received
    
    // Deepgram cost will be calculated based on audio chunks received
    
    this.responseQueues.set(client, Promise.resolve()); // Initialize queue
    this.clientTranscriptBuffers.set(client, ''); // Initialize buffer

    console.log(`Client Config: Provider=${ttsProvider}, Voice=${voice}`);

    const deepgramLive = this.deepgramService.createLiveConnection();
    this.deepgramConnections.set(client, deepgramLive);

    deepgramLive.on('open', () => {
      console.log('Deepgram Live Connection Open');
    });

    deepgramLive.on('Results', async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && data.is_final) {
        console.log('Speech Final detected. Transcript part:', transcript);
        if (client.readyState === WebSocket.OPEN) {
             client.send(JSON.stringify({ event: 'transcript', data: transcript }));
        }
        
        // Append to buffer instead of processing immediately
        const currentBuffer = this.clientTranscriptBuffers.get(client) || '';
        this.clientTranscriptBuffers.set(client, currentBuffer + ' ' + transcript);

      } else if (transcript) {
         // Interim results
         if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event: 'transcript', data: transcript }));
         }
      }
    });

    deepgramLive.on('UtteranceEnd', async () => {
        console.log('UtteranceEnd detected (Silence). Processing buffer...');
        const buffer = this.clientTranscriptBuffers.get(client)?.trim();
        
        if (buffer && buffer.length > 0) {
            console.log('Processing full user text:', buffer);
            // Clear buffer immediately to avoid double processing
            this.clientTranscriptBuffers.set(client, '');
            
            // Trigger LLM and TTS with the complete sentence
            if (client.readyState === WebSocket.OPEN) {
                 client.send(JSON.stringify({ event: 'processing_start' }));
            }
            await this.processTextResponse(client, buffer);
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
                if (message.event === 'speech_end') {
                    console.log('Received Manual Speech End.');
                    const buffer = this.clientTranscriptBuffers.get(client)?.trim();
                    if (buffer && buffer.length > 0) {
                        console.log('Processing full user text (Manual Trigger):', buffer);
                        this.clientTranscriptBuffers.set(client, '');
                        if (client.readyState === WebSocket.OPEN) {
                             client.send(JSON.stringify({ event: 'processing_start' }));
                        }
                        await this.processTextResponse(client, buffer);
                    }
                    return;
                }
            } catch (e) {
                // Not JSON, treat as audio
            }

            // Forward binary audio to Deepgram
            const connection = this.deepgramConnections.get(client);
            if (connection && connection.getReadyState() === 1) { // OPEN
                connection.send(data);
                
                // Estimate Deepgram cost based on audio duration sent
                // Frontend streams chunks every ~100ms
                this.updateDeepgramCost(client, 0.1);
            }
        }
    });
  }

  handleDisconnect(client: WebSocket) {
    console.log('Client disconnected');
    
    // Clear cost tracker
    const tracker = this.clientCosts.get(client);
    if (tracker?.deepgram.timer) {
        clearInterval(tracker.deepgram.timer);
    }
    this.clientCosts.delete(client);

    const deepgramLive = this.deepgramConnections.get(client);
    if (deepgramLive) {
      deepgramLive.finish();
      this.deepgramConnections.delete(client);
    }
    this.clientConfigs.delete(client);
    this.responseQueues.delete(client);
    this.clientTranscriptBuffers.delete(client);
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
        let systemPrompt = config?.systemInstruction;

        if (systemPrompt) {
          systemPrompt = VOICE_BEHAVIOR_PROMPT(systemPrompt);
        }

        const stream = await this.groqService.generateStream(text, systemPrompt);
        let sentenceBuffer = '';
        
        for await (const chunk of stream) {
          // Check for token usage in the chunk (Groq specific)
          if (chunk.x_groq?.usage) {
             const usage = chunk.x_groq.usage;
             this.updateGroqCost(client, usage.prompt_tokens, usage.completion_tokens);
          }

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
          // Track OpenAI Cost (Pricing is per character)
          this.updateOpenAICost(client, text.length);
          return await this.openAiService.generateAudio(text, config.voice as any);
      } else {
          // Fallback/Default to Deepgram if specified
          return await this.deepgramService.generateAudio(text);
      }
  }

  private updateGroqCost(client: WebSocket, inputTokens: number, outputTokens: number) {
      const tracker = this.clientCosts.get(client);
      if (!tracker) return;

      tracker.groq.inputTokens += inputTokens;
      tracker.groq.outputTokens += outputTokens;
      
      const inputCost = (tracker.groq.inputTokens / 1_000_000) * GROQ_INPUT_PRICE_PER_M;
      const outputCost = (tracker.groq.outputTokens / 1_000_000) * GROQ_OUTPUT_PRICE_PER_M;
      
      tracker.groq.cost = (inputCost + outputCost) * USD_BRL_RATE;
      
      this.updateTotalAndSend(client, tracker);
  }

  private updateOpenAICost(client: WebSocket, charCount: number) {
      const tracker = this.clientCosts.get(client);
      if (!tracker) return;

      tracker.openai.characters += charCount;
      
      const costUSD = (tracker.openai.characters / 1_000_000) * OPENAI_TTS_PRICE_PER_M_CHAR;
      tracker.openai.cost = costUSD * USD_BRL_RATE;

      this.updateTotalAndSend(client, tracker);
  }
  
  private updateDeepgramCost(client: WebSocket, durationSeconds: number) {
      const tracker = this.clientCosts.get(client);
      if (!tracker) return;
      
      tracker.deepgram.seconds += durationSeconds;
      const minutes = tracker.deepgram.seconds / 60;
      tracker.deepgram.cost = (minutes * DEEPGRAM_STT_PRICE_PER_MIN) * USD_BRL_RATE;
      
      // Update frontend cost
      this.updateTotalAndSend(client, tracker);
  }

  private updateTotalAndSend(client: WebSocket, tracker: CostTracker) {
      tracker.totalCost = tracker.groq.cost + tracker.openai.cost + tracker.deepgram.cost;
      
      if (client.readyState === WebSocket.OPEN) {
          const payload = {
              event: 'cost_update',
              data: {
                  groq: {
                      tokens: tracker.groq.inputTokens + tracker.groq.outputTokens,
                      cost: tracker.groq.cost.toFixed(4)
                  },
                  openai: {
                      characters: tracker.openai.characters,
                      cost: tracker.openai.cost.toFixed(4)
                  },
                  deepgram: {
                      seconds: tracker.deepgram.seconds,
                      cost: tracker.deepgram.cost.toFixed(4)
                  },
                  total_cost: tracker.totalCost.toFixed(4)
              }
          };
          client.send(JSON.stringify(payload));
      }
  }
}
