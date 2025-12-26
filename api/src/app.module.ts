import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationModule } from './modules/conversation/conversation.module';
// import { AiServicesModule } from './modules/ai-services/ai-services.module'; // Will implement later

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConversationModule,
    // AiServicesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
