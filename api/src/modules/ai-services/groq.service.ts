import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
  private groq: Groq;

  constructor(private configService: ConfigService) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY'),
    });
  }

  async generateStream(prompt: string, systemPrompt?: string): Promise<AsyncIterable<any>> {
    const systemContent = systemPrompt 
        ? systemPrompt 
        : 'Você é um assistente direto e objetivo. Responda sempre em Português do Brasil com respostas extremamente curtas e secas. Sem introduções ou conclusões.';

    return this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemContent,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      stream: true,
    });
  }
}
