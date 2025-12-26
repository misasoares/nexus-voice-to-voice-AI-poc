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

  async generateStream(prompt: string): Promise<AsyncIterable<any>> {
    return this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente útil e amigável. Responda sempre em Português do Brasil de forma concisa.',
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
