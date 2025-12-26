import { useState, useRef, useEffect } from 'react';
import { useRoleStore } from '../../store/useRoleStore';

export const useVoiceToVoice = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'shimmer'>('alloy');
  
  // We keep track of the current AI response accumulation
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);

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
        playNextAudio(); // Try next one
      }
    }
  };

  useEffect(() => {
    // Connect to WebSocket using the same hostname as the page, but on backend port 3000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Append voice config and system prompt
    const activeRole = useRoleStore.getState().getActiveRole();
    const systemInstructionParam = activeRole ? `&systemInstruction=${encodeURIComponent(activeRole.content)}` : '';
    const wsUrl = `${protocol}//${window.location.hostname}:3000?ttsProvider=openai&voice=${selectedVoice}${systemInstructionParam}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.binaryType = 'arraybuffer'; // IMPORTANT for receiving audio

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      // Check if binary data (Audio Chunk)
      if (event.data instanceof ArrayBuffer) {
        // It's audio!
        const blob = new Blob([event.data], { type: 'audio/mp3' });
        audioQueueRef.current.push(blob);
        if (!isPlayingRef.current) {
            playNextAudio();
        }
        return;
      }

      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'transcript') {
           setUserTranscripts(prev => [...prev, data.data]);
        } else if (data.event === 'llm_token') {
           setAiResponse(prev => prev + data.data);
        }
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedVoice]); // Reconnect when voice changes

  const startRecording = async () => {
    setAiResponse(''); 
    setUserTranscripts([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); 
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(event.data);
        }
      };

      mediaRecorder.start(100); 
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  return {
    isConnected,
    isRecording,
    userTranscripts,
    aiResponse,
    selectedVoice,
    setSelectedVoice,
    startRecording,
    stopRecording
  };
};
