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
}
