import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class KokoroService {
  private readonly pythonServiceUrl = 'http://localhost:8880';

  async generateAudio(text: string, voice: string = 'bm_lewis', speed: number = 1.0): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/v1/audio/speech`,
        {
          input: text,
          voice: voice,
          speed: speed,
        },
        {
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Kokoro TTS Error:', error);
      throw error;
    }
  }
}
