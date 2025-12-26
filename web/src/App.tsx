import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
  
  // We keep track of the current AI response accumulation
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Connect to WebSocket using the same hostname as the page, but on backend port 3000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'transcript') {
           // We just append to the list of user transcripts for now. 
           // In a real chat app, you'd want to handle "final" vs "interim" updates more vaguely, 
           // but appending works for a simple log.
           setUserTranscripts(prev => [...prev, data.data]);
        } else if (data.event === 'llm_token') {
           // Append token to the current AI response
           setAiResponse(prev => prev + data.data);
        }
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const startRecording = async () => {
    // Clear previous session data separately if desired, 
    // but for now we keep appending or clearing manually.
    setAiResponse(''); // Clear AI response for new recording? Or keep history? 
    // Let's clear AI response when starting a new turn helps visibility, 
    // but the user might want valid history. 
    // For this simple POC, let's just append or keep as is.
    // Actually, let's clear AI response on START so we see the new one clearly.
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
    <div style={{ 
      padding: '20px', 
      fontFamily: 'sans-serif', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      <h1>Nexus Voice - Feature 3 Verify</h1>
      
      <div style={{ marginBottom: '20px' }}>
        Status: <span style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <button 
          onClick={isRecording ? stopRecording : startRecording} 
          disabled={!isConnected}
          style={{ 
            marginLeft: '20px',
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
  );
}

export default App;
