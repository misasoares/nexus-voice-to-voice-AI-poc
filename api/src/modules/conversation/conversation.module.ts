import { Module } from '@nestjs/common';
import { ConversationGateway } from './conversation.gateway';
import { AiServicesModule } from '../ai-services/ai-services.module';

@Module({
  imports: [AiServicesModule],
  providers: [ConversationGateway],
})
export class ConversationModule {}
