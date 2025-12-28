import { Controller, Post, Body } from '@nestjs/common';
import { GroqService } from './groq.service';
import { ConfigService } from '@nestjs/config';

@Controller('ai-services')
export class LeadProfileController {
  constructor(
    private readonly groqService: GroqService,
    private readonly configService: ConfigService,
  ) {}

  @Post('generate-profile')
  async generateProfile(@Body() body: { answers: { question: string; answer: string }[] }) {
    const { answers } = body;
    const systemPromptGenerator = this.configService.get<string>('SYSTEM_PROMPT_GENERATOR');

    if (!systemPromptGenerator) {
      throw new Error('SYSTEM_PROMPT_GENERATOR is not defined');
    }

    // Format the input for the AI
    const formattedInput = answers
      .map((a) => `Pergunta: ${a.question}\nResposta: ${a.answer}`)
      .join('\n---\n');

    const fullPrompt = `${systemPromptGenerator}\n\nENTRADA (Respostas do Usuário):\n${formattedInput}`;

    // Use Groq to generate the profile
    const response = await this.groqService.generateCompletion(fullPrompt);

    return { systemPrompt: response };
  }
}
