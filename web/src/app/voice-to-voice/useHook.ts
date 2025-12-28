import { useState, useRef, useEffect } from 'react';
import { useRoleStore } from '../../store/useRoleStore';

export const useVoiceToVoice = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'shimmer'>('shimmer');
  const [costData, setCostData] = useState<{
      groq: { tokens: number; cost: string };
      openai: { characters: number; cost: string };
      deepgram: { seconds: number; cost: string };
      total_cost: string;
  } | null>(null);
  const [duration, setDuration] = useState(0); // in seconds
  
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // New state for "Thinking"
  
  // Refs for callbacks
  const isProcessingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  
  // We keep track of the current AI response accumulation
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // Track likely playing audio for barge-in

  // Helper to stop current audio playback immediately (Barge-in)
  const stopAudio = () => {
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
    audioQueueRef.current = []; // Clear queue
    setIsAiSpeaking(false);
  };  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      setIsProcessing(false); // Playback finished, allow listening again
      isProcessingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    setIsAiSpeaking(true); // Playback started
    const nextBlob = audioQueueRef.current.shift();
    if (nextBlob) {
      const audioUrl = URL.createObjectURL(nextBlob);
      const audio = new Audio(audioUrl);
      
        currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        playNextAudio();
      };
      
      try {
        await audio.play();
      } catch (err) {
        console.error("Error playing audio chunk:", err);
        currentAudioRef.current = null;
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
           // BARGE-IN: If user speaks, stop AI immediately
           if (isAiSpeaking || audioQueueRef.current.length > 0) {
               console.log("Barge-in triggered: Stopping AI audio");
               stopAudio();
           }
           setUserTranscripts(prev => [...prev, data.data]);
        } else if (data.event === 'llm_token') {
           setAiResponse(prev => prev + data.data);
        } else if (data.event === 'cost_update') {
           setCostData(data.data);
        } else if (data.event === 'processing_start') {
           setIsProcessing(true); // AI is thinking, stop listening/sending audio
           isProcessingRef.current = true;
        }
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    return () => {
      ws.close();
      stopAudio(); // Cleanup audio on unmount/reconnect
    };
  }, [selectedVoice]); // Reconnect when voice changes

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    setAiResponse(''); 
    setUserTranscripts([]);
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); 
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        // Send audio unless manually muted
        if (!isMutedRef.current && event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
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
      if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null; 
    }
    
    setIsRecording(false);
    setIsMuted(false);
    isMutedRef.current = false;
    stopAudio(); // Stop any pending AI audio
  };

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          stopRecording();
      };
  }, []);

  const toggleMute = () => {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      isMutedRef.current = newMutedState;

      if (newMutedState && socketRef.current?.readyState === WebSocket.OPEN) {
          // User muted (Stopped speaking) -> Signal end of speech to triggers AI
          socketRef.current.send(JSON.stringify({ event: 'speech_end' }));
      } else if (!newMutedState) {
          // User unmuted (Started speaking) -> Interrupt AI immediately
          console.log("User unmuted: Interrupting AI");
          stopAudio();
      }
  }

  return {
    isConnected,
    isRecording,
    userTranscripts,
    aiResponse,
    selectedVoice,
    setSelectedVoice,
    costData,
    duration,
    startRecording,
    stopRecording,
    isAiSpeaking,
    isProcessing,
    isMuted,
    toggleMute
  };
};
