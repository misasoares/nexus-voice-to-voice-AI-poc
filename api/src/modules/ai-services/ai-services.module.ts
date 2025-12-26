import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepgramService } from './deepgram.service';
import { GroqService } from './groq.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [ConfigModule],
  providers: [DeepgramService, GroqService, OpenAiService],
  exports: [DeepgramService, GroqService, OpenAiService],
})
export class AiServicesModule {}
