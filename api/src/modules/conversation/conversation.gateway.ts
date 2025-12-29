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
import { KokoroService } from '../ai-services/kokoro.service';
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
  private clientConfigs = new Map<WebSocket, { ttsProvider: 'openai' | 'deepgram' | 'kokoro'; voice: string; speed: number; systemInstruction?: string }>();
  private clientCosts = new Map<WebSocket, CostTracker>();
  
  // Audio Response Queue: Ensures audio chunks are sent in order for each client
  private responseQueues = new Map<WebSocket, Promise<void>>();

  // Transcript Buffer: Accumulates speech until silence (UtteranceEnd)
  private clientTranscriptBuffers = new Map<WebSocket, string>();
  // Interim Buffer: Tracks the latest non-final transcript (for manual trigger race conditions)
  private clientInterimBuffers = new Map<WebSocket, string>();

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly groqService: GroqService,
    private readonly openAiService: OpenAiService,
    private readonly kokoroService: KokoroService,
  ) {}

  handleConnection(client: WebSocket, request: any) {
    console.log('Client connected');

    // Parse Query Params (e.g., /?ttsProvider=openai&voice=alloy)
    const urlString = request.url || '';
    const url = new URL(urlString, 'http://localhost');
    
    const ttsProvider = (url.searchParams.get('ttsProvider') as 'openai' | 'deepgram' | 'kokoro') || 'openai';
    const voice = url.searchParams.get('voice') || 'shimmer';
    const speed = parseFloat(url.searchParams.get('speed') || '1.0');
    const systemInstruction = url.searchParams.get('systemInstruction') || undefined;

    this.clientConfigs.set(client, { ttsProvider, voice, speed, systemInstruction });
    
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
    this.clientInterimBuffers.set(client, ''); // Initialize interim

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
        
        // Clear interim (it's now final)
        this.clientInterimBuffers.set(client, '');

      } else if (transcript) {
         // Interim results
         if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event: 'transcript', data: transcript }));
         }
         // Track interim for manual trigger
         this.clientInterimBuffers.set(client, transcript);
      }
    });

    deepgramLive.on('UtteranceEnd', async () => {
        console.log('UtteranceEnd detected (Silence). Ignored for Manual Mode.');
        // Manual Mode: We do NOT process buffer on VAD silence anymore.
        // The user must explicitly mute to trigger response.
        /*
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
        */
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
                    const finalBuffer = this.clientTranscriptBuffers.get(client)?.trim() || '';
                    const interimBuffer = this.clientInterimBuffers.get(client)?.trim() || '';
                    
                    // Combine Final + Interim (Interim is usually the last part being spoken that hasn't finalized yet)
                    const fullText = (finalBuffer + ' ' + interimBuffer).trim();

                    if (fullText.length > 0) {
                        console.log('Processing full user text (Manual Trigger):', fullText);
                        this.clientTranscriptBuffers.set(client, '');
                        this.clientInterimBuffers.set(client, '');
                        
                        if (client.readyState === WebSocket.OPEN) {
                             client.send(JSON.stringify({ event: 'processing_start' }));
                        }
                        await this.processTextResponse(client, fullText);
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
    this.clientInterimBuffers.delete(client);
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
            
            // Send text token to frontend (Show everything including thoughts for debugging/transparency, or filter if requested)
            // For now, let's send everything so the user sees the 'brain' working in the UI if we add support for it later.
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ event: 'llm_token', data: content }));
            }

            // Buffer for TTS - accumulate everything
            sentenceBuffer += content;
            
            // Check for sentence delimiters
            if (/[.?!]/.test(content)) {
                // Check if we are currently inside a thinking block? 
                // Simple approach: Regex replace on the whole sentenceBuffer when queuing.
                // We'll queue audio generation only if there is "speakable" text.
                
                // Let's defer the "thinking" removal to `queueAudioGeneration` or helper to keep this loop clean.
                // However, we need to know if the "sentence" is just a thought or real text.
                // The easiest way is to NOT split by sentence regarding the thought block.
                
                // If we have a closing tag </thinking>, we might want to trigger processing?
                // Actually, standard sentence splitting might break the <thinking> tag in half.
                // But typically thoughts come first. 
                // Let's keep the buffer logic simple and filter in queueAudioGeneration.
                
                const sentenceToSpeak = sentenceBuffer.trim();   
                
                // Only queue if it looks like a complete sentence AND it's not just inside a thinking block (this is hard to know without state).
                // Safer approach: Accumulate until we are sure.
                
                // Given the risk of splitting tags, let's look for tags explicitly.
                // If sentenceBuffer contains open <thinking> but not closed </thinking>, DO NOT FLUSH.
                const openCount = (sentenceBuffer.match(/<thinking>/g) || []).length;
                const closeCount = (sentenceBuffer.match(/<\/thinking>/g) || []).length;
                
                if (openCount === closeCount) {
                     // Balanced tags. We can flush.
                     const cleanText = this.filterThinking(sentenceToSpeak);
                     if (cleanText.length > 0) {
                        console.log(`\nQueuing Audio Generation for: "${cleanText}"`);
                        this.queueAudioGeneration(client, cleanText);
                     }
                     sentenceBuffer = ''; // Clear buffer
                }
            }
          }
        }
        
        // Handle any remaining text in buffer
        if (sentenceBuffer.trim().length > 0) {
           const cleanText = this.filterThinking(sentenceBuffer.trim());
           if (cleanText.length > 0) {
                console.log(`\nQueuing Final: "${cleanText}"`);
                this.queueAudioGeneration(client, cleanText);
           }
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
          // Add silence padding to prevent cut-off: ". " at start
          const paddedText = `. ${text}`; 
          
          this.updateOpenAICost(client, paddedText.length);
          return await this.openAiService.generateAudio(paddedText, config.voice as any);
      } else if (config?.ttsProvider === 'kokoro') {
          return await this.kokoroService.generateAudio(text, config.voice, config.speed);
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
    private filterThinking(text: string): string {
        // Remove <thinking>...</thinking> blocks
        // The 's' flag (dotall) is not supported in all JS versions of regex via literal but we can use [\s\S]
        return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    }
}
