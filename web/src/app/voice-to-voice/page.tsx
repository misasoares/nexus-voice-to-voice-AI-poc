import { useVoiceToVoice } from './useHook';

const VoiceToVoicePage = () => {
  const {
    isConnected,
    isRecording,
    userTranscripts,
    aiResponse,
    selectedVoice,
    setSelectedVoice,
    ttsProvider,
    setTtsProvider,
    kokoroVoice,
    setKokoroVoice,
    kokoroVoiceMix,
    setKokoroVoiceMix,
    enableMixing,
    setEnableMixing,
    kokoroSpeed,
    setKokoroSpeed,
    startRecording,
    stopRecording,
    costData,
    duration,
    isAiSpeaking,
    isProcessing,
    isMuted,
    toggleMute
  } = useVoiceToVoice();

  // Helper to format duration as MM:SS
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Nexus Voice POC</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>
              Provider:
              <select
                value={ttsProvider}
                onChange={(e) => setTtsProvider(e.target.value as any)}
                style={{ marginLeft: '5px', padding: '5px' }}
              >
                <option value="openai">OpenAI</option>
                <option value="kokoro">Kokoro (Local)</option>
              </select>
            </label>

            {ttsProvider === 'openai' && (
              <label>
                Voice:
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value as any)}
                  style={{ marginLeft: '5px', padding: '5px' }}
                >
                  <option value="alloy">Alloy</option>
                  <option value="shimmer">Shimmer</option>
                </select>
              </label>
            )}

            {ttsProvider === 'kokoro' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <label>
                        Voice 1:
                        <select
                            value={kokoroVoice}
                            onChange={(e) => setKokoroVoice(e.target.value)}
                            style={{ marginLeft: '5px', padding: '5px' }}
                        >
                            <optgroup label="American Female">
                                <option value="af_bella">Bella</option>
                                <option value="af_nicole">Nicole</option>
                                <option value="af_sarah">Sarah</option>
                                <option value="af_sky">Sky</option>
                            </optgroup>
                            <optgroup label="American Male">
                                <option value="am_adam">Adam</option>
                                <option value="am_michael">Michael</option>
                            </optgroup>
                            <optgroup label="British Female">
                                <option value="bf_emma">Emma</option>
                                <option value="bf_isabella">Isabella</option>
                            </optgroup>
                            <optgroup label="British Male">
                                <option value="bm_george">George</option>
                                <option value="bm_lewis">Lewis</option>
                            </optgroup>
                        </select>
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '12px' }}>
                            <input 
                                type="checkbox" 
                                checked={enableMixing} 
                                onChange={(e) => setEnableMixing(e.target.checked)}
                                style={{ marginRight: '4px' }}
                            />
                            Mix
                        </label>
                    </div>

                    {enableMixing && (
                         <label>
                         Voice 2:
                         <select
                             value={kokoroVoiceMix}
                             onChange={(e) => setKokoroVoiceMix(e.target.value)}
                             style={{ marginLeft: '5px', padding: '5px' }}
                         >
                            <optgroup label="American Female">
                                <option value="af_bella">Bella</option>
                                <option value="af_nicole">Nicole</option>
                                <option value="af_sarah">Sarah</option>
                                <option value="af_sky">Sky</option>
                            </optgroup>
                            <optgroup label="American Male">
                                <option value="am_adam">Adam</option>
                                <option value="am_michael">Michael</option>
                            </optgroup>
                            <optgroup label="British Female">
                                <option value="bf_emma">Emma</option>
                                <option value="bf_isabella">Isabella</option>
                            </optgroup>
                            <optgroup label="British Male">
                                <option value="bm_george">George</option>
                                <option value="bm_lewis">Lewis</option>
                            </optgroup>
                         </select>
                         </label>
                    )}
                </div>

                <label>
                  Speed:
                  <input
                    type="number"
                    step="0.1"
                    value={kokoroSpeed}
                    onChange={(e) => setKokoroSpeed(parseFloat(e.target.value))}
                    style={{ marginLeft: '5px', padding: '5px', width: '50px' }}
                  />
                </label>
              </>
            )}
          </div>
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

          <button 
             onClick={toggleMute}
             disabled={!isRecording}
             style={{
                marginLeft: '10px',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: isRecording ? 'pointer' : 'not-allowed',
                backgroundColor: isMuted ? '#FF5722' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                opacity: isRecording ? 1 : 0.5
             }}
          >
             {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>
          
          {isAiSpeaking && (
             <span style={{ marginLeft: '15px', color: '#ff9800', fontWeight: 'bold' }}>
               AI Speaking... {isMuted ? '(Mic Muted)' : '(Mic Active)'}
             </span>
          )}

          {isProcessing && !isAiSpeaking && (
             <span style={{ marginLeft: '15px', color: '#2196f3', fontWeight: 'bold' }}>
               AI Thinking... {isMuted ? '(Mic Muted)' : '(Mic Active)'}
             </span>
          )}
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

        {/* Cost Estimation */}
        {costData && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            fontSize: '14px',
            color: '#333'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
               <h3 style={{ margin: 0 }}>Session Stats</h3>
               <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatTime(duration)}</span>
            </div>
            <p style={{ margin: '5px 0' }}>
              <strong>groq:</strong> {costData.groq.tokens} tokens utilizados no groq, estimativa de R${costData.groq.cost.replace('.', ',')}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>open ai:</strong> {costData.openai.characters} tokens utilizados no open ai, estimativa de R${costData.openai.cost.replace('.', ',')}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>deepgram:</strong> {costData.deepgram.seconds} segundos utilizados no deepgram, estimativa de R${costData.deepgram.cost.replace('.', ',')}
            </p>
            <p style={{ margin: '5px 0', borderTop: '1px solid #ccc', paddingTop: '5px', fontWeight: 'bold' }}>
              estimativa de valor total: R${costData.total_cost.replace('.', ',')} (custo do groq + custo da open ai + custo do deepgram)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceToVoicePage;
