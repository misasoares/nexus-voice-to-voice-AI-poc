import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepgramService } from './deepgram.service';
import { GroqService } from './groq.service';

@Module({
  imports: [ConfigModule],
  providers: [DeepgramService, GroqService],
  exports: [DeepgramService, GroqService],
})
export class AiServicesModule {}
