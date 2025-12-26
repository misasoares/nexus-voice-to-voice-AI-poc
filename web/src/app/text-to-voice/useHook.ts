import { useState, useRef, useEffect } from 'react';
import { useRoleStore } from '../../store/useRoleStore';

export const useTextToVoice = () => {
  const [isConnected, setIsConnected] = useState(false);
  // Chat history: { sender: 'user' | 'ai', text: string }
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'ai', text: string }[]>([]);
  const [aiResponseBuffer, setAiResponseBuffer] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'shimmer'>('alloy');

  const socketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);

  // Playback logic is identical to voice-to-voice
  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const nextBlob = audioQueueRef.current.shift();
    if (nextBlob) {
      const audioUrl = URL.createObjectURL(nextBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        playNextAudio();
      };
      
      try {
        await audio.play();
      } catch (err) {
        console.error("Error playing audio chunk:", err);
        playNextAudio(); 
      }
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const activeRole = useRoleStore.getState().getActiveRole();
    const systemInstructionParam = activeRole ? `&systemInstruction=${encodeURIComponent(activeRole.content)}` : '';
    const wsUrl = `${protocol}//${window.location.hostname}:3000?ttsProvider=openai&voice=${selectedVoice}${systemInstructionParam}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('Connected to WebSocket (Text to Voice)');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: 'audio/mp3' });
        audioQueueRef.current.push(blob);
        if (!isPlayingRef.current) {
            playNextAudio();
        }
        return;
      }

      try {
        const data = JSON.parse(event.data);
        
        // In text-to-voice, we might not get 'transcript' from server in the same way 
        // since we are sending text. But if the server sends back 'llm_token', we stream it.
        if (data.event === 'llm_token') {
           setAiResponseBuffer(prev => {
               const newBuffer = prev + data.data;
               return newBuffer;
           });
        } 
        // Note: The server might send 'transcript' event if it processes audio, 
        // but here we send text. We rely on llm_token for the AI response text.
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedVoice]);

  // When AI response finishes (or we decide it's done), we can flush buffer to history.
  // However, without a clear "done" event from this specific backend stream logic, 
  // we might just show the buffer as the "current AI message".
  // For simplicity, we'll expose the buffer.

  const sendMessage = (text: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    // Add user message to history
    setChatHistory(prev => [...prev, { sender: 'user', text }]);
    
    // Clear previous AI response buffer for new turn
    setAiResponseBuffer('');
    
    // Send text to backend. 
    // The backend expects a JSON event or raw audio?
    // The user request says: "skip the voice to text step".
    // I need to check how the backend handles text input. 
    // If the backend only accepts audio blobs, I might need to clarify or adjust backend.
    // Let's assume for now I can send a specific JSON event for text input.
    // Wait, looking at App.tsx lines 104-105: socketRef.current.send(event.data); sends raw blobs.
    // I should check the backend `conversation.gateway.ts`.
    
    // For now I will assume I can send a text event. 
    // I'll pause this thought to check the backend if possible, or assume a standard protocol.
    // But since I can't read backend files unless they are open (and it is open!), I will read it.
    
    socketRef.current.send(JSON.stringify({
        event: 'text_input',
        text: text
    }));
  };

  return {
    isConnected,
    chatHistory,
    aiResponseBuffer,
    selectedVoice,
    setSelectedVoice,
    sendMessage
  };
};
