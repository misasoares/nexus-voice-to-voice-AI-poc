import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepgramService } from './deepgram.service';
import { GroqService } from './groq.service';
import { OpenAiService } from './openai.service';

import { LeadProfileController } from './lead-profile.controller';

import { KokoroService } from './kokoro.service';

@Module({
  imports: [ConfigModule],
  controllers: [LeadProfileController],
  providers: [DeepgramService, GroqService, OpenAiService, KokoroService],
  exports: [DeepgramService, GroqService, OpenAiService, KokoroService],
})
export class AiServicesModule {}
