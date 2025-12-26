import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, LiveClient } from '@deepgram/sdk';

@Injectable()
export class DeepgramService implements OnModuleInit {
  private deepgram;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPGRAM_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not defined');
    }
    this.deepgram = createClient(apiKey);
  }

  onModuleInit() {
    console.log('DeepgramService initialized');
  }

  createLiveConnection(): LiveClient {
    return this.deepgram.listen.live({
      model: 'nova-2',
      language: 'pt-BR',
      smart_format: true,
      // Let Deepgram detect or assume wav/default
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
    });
  }

  async generateAudio(text: string): Promise<Buffer> {
    const response = await this.deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en',
      }
    );

    const stream = await response.getStream();
    if (stream) {
      const buffer = await this.streamToBuffer(stream);
      return buffer;
    } else {
        throw new Error('Error generating audio: No stream returned');
    }
  }

  private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
  }
}

