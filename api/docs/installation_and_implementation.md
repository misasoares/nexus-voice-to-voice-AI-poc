# API Documentation 🛠️

## 🏗️ Architecture & Implementation

The API is built with **NestJS** and serves as the orchestration layer for the Voice AI.

### Core Components
*   **Gateway (`src/modules/conversation/conversation.gateway.ts`)**: Handles the WebSocket connection with the frontend. It manages the audio stream, piping it to Deepgram for STT, then to Groq/LLM for processing, and finally to TTS (Deepgram Aura or OpenAI) for audio generation.
*   **AI Services**:
    *   **DeepgramService**: Manages real-time transcription (STT) and legacy TTS.
    *   **GroqService**: Interfaces with the Llama 3 model on Groq for ultra-fast text generation.
    *   **OpenAiService**: Handles Text-to-Speech (TTS) using the `tts-1` model for high-quality Portuguese audio.
*   **Orchestração Manual**: Instead of using a pre-packaged "Voice API", this project manually orchestrates these services to reduce costs from ~$0.20/min to ~$0.025/min.

## 🚀 Installation & Setup

### Prerequisites
*   Node.js v20+
*   npm
*   API Keys for **Deepgram**, **Groq**, and **OpenAI**.

### Environment Variables
1.  Copy the example env file:
    ```bash
    cp .env.example .env
    ```
2.  Fill in your keys in `.env`:
    ```env
    PORT=3000
    DEEPGRAM_API_KEY=your_deepgram_key
    GROQ_API_KEY=your_groq_key
    OPENAI_API_KEY=your_openai_key
    ```
    *Note: Ensure your OpenAI key has permissions for `model.request` (Audio generation).*

### Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Development Server:**
    ```bash
    npm run start:dev
    ```
    The API will be available at `http://localhost:3000` (WebSocket on the same port).

### Docker
You can also run the entire stack using Docker Compose from the root directory:
```bash
docker-compose up --build
```
