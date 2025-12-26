import { useState, useRef, useEffect } from 'react';
import './App.css';



function App() {
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
    // Append voice config
    const wsUrl = `${protocol}//${window.location.hostname}:3000?ttsProvider=openai&voice=${selectedVoice}`;
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Nexus Voice POC</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label>
            Voice: 
            <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value as any)}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="alloy">Alloy (OpenAI)</option>
              <option value="shimmer">Shimmer (OpenAI)</option>
            </select>
          </label>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            backgroundColor: isConnected ? '#4caf50' : '#f44336' 
          }} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div style={{ 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1 
      }}>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={isRecording ? stopRecording : startRecording} 
            disabled={!isConnected}
            style={{ 
              padding: '10px 20px', 
              fontSize: '16px', 
              cursor: 'pointer',
              backgroundColor: isRecording ? 'red' : 'green',
              color: 'white',
              border: 'none',
              borderRadius: '5px'
            }}
          >
            {isRecording ? 'STOP RECORDING' : 'START RECORDING'}
          </button>
        </div>

        <div style={{ 
          display: 'flex', 
          flex: 1, 
          gap: '20px',
          minHeight: 0 // necessary for flex scroll
        }}>
          {/* Left Column: User Transcripts */}
          <div style={{ 
            flex: 1, 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            padding: '15px', 
            backgroundColor: '#f9f9f9',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{ marginTop: 0 }}>User (Microphone)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {userTranscripts.length === 0 && <p style={{ color: '#999' }}>Speak into the mic...</p>}
              {userTranscripts.map((text, index) => (
                <div key={index} style={{ 
                  padding: '10px', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '8px',
                  alignSelf: 'flex-start'
                }}>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: AI Response */}
          <div style={{ 
            flex: 1, 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            padding: '15px', 
            backgroundColor: '#f0f4c3',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>Nexus AI</h2>
            {aiResponse ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {aiResponse}
              </div>
            ) : (
               <p style={{ color: '#999' }}>AI response will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
