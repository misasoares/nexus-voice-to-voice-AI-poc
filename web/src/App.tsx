import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Connect to WebSocket using the same hostname as the page, but on backend port 3000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use window.location.hostname for IP/localhost, and default backend port 3000
    // Note: If using Vite proxy, we might want just '/' but here we assume direct connection to API
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
          setTranscripts((prev) => [...prev, data.data]);
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Nexus Voice Integration Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        Status: <span style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {!isRecording ? (
          <button onClick={startRecording} disabled={!isConnected} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
            START RECORDING
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: 'red', color: 'white' }}>
            STOP RECORDING
          </button>
        )}
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }}>
        <h3>Transcripts:</h3>
        {transcripts.length === 0 && <p>Waiting for speech...</p>}
        {transcripts.map((text, index) => (
          <p key={index} style={{ borderBottom: '1px solid #eee', paddingBottom: '5px' }}>{text}</p>
        ))}
      </div>
    </div>
  );
}

export default App;
