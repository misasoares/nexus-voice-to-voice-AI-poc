import { useVoiceToVoice } from './useHook';

const VoiceToVoicePage = () => {
  const {
    isConnected,
    isRecording,
    userTranscripts,
    aiResponse,
    selectedVoice,
    setSelectedVoice,
    startRecording,
    stopRecording
  } = useVoiceToVoice();

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
};

export default VoiceToVoicePage;
