import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepgramService } from './deepgram.service';
import { GroqService } from './groq.service';
import { OpenAiService } from './openai.service';

import { LeadProfileController } from './lead-profile.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LeadProfileController],
  providers: [DeepgramService, GroqService, OpenAiService],
  exports: [DeepgramService, GroqService, OpenAiService],
})
export class AiServicesModule {}
