# Web Frontend Documentation 💻

## 🏗️ Architecture & Implementation

The frontend is a **Vite + React + TypeScript** application designed to demonstrate the real-time voice capabilities.

### Key Features
*   **Audio Capture**: Uses standard Web Audio API to capture microphone input.
*   **WebSocket Streaming**: Streams raw audio data (converted to suitable format) to the backend via WebSockets.
*   **Real-time UI**: Displays:
    *   **User Transcripts**: Real-time STT results from Deepgram.
    *   **AI Responses**: Streaming tokens from the LLM.
    *   **Audio Playback**: Plays the TTS audio returned by the backend (binary stream).

## 🚀 Installation & Setup

### Prerequisites
*   Node.js v20+
*   npm

### Configuration
The application expects the backend to be running on `http://localhost:3000`.
If you need to change this, check `src/App.tsx` or `vite.config.ts`.

### Running Locally

1.  **Navigate to the web directory:**
    ```bash
    cd web
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

### Troubleshooting
*   **Connection Refused**: Ensure the backend is running and that port 3000 is accessible.
*   **Microphone Permission**: Allow microphone access in your browser when prompted.

## 🧠 AI Architecture & Prompt Engineering

### Two-Prompt System
We split the "Persona" responsibility into two distinct stages to optimize for different goals:

1.  **Generation Phase (`SYSTEM_PROMPT_GENERATOR`)**:
    *   **Location**: `api/.env`
    *   **Purpose**: Creates the static "Character Sheet" (Lead Profile).
    *   **Trigger**: Button "Auto Generate" or Manual Creation.
    *   **Output**: A static JSON/Object containing Name, Bio, Pain Points, Objections.
    *   **Status**: *Static / Setup-only.*

2.  **Runtime Phase (`VOICE_BEHAVIOR_PROMPT`)**:
    *   **Location**: `api/src/modules/conversation/prompts.ts`
    *   **Purpose**: Controls the *Acting* and *Voice* during the call.
    *   **Trigger**: Every user message in the WebSocket.
    *   **Mechanism**: Wraps the Static Lead Profile with dynamic acting instructions.
    *   **Optimization**: Strictly engineered for TTS (Text-to-Speech) quality.
        *   Forces lowercasing (better prosody).
        *   Injects hesitation ("...").
        *   Uses fillers ("humm", "olha") to buy time.

---

