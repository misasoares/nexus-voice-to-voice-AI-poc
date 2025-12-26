import React, { useState } from 'react';
import { useTextToVoice } from './useHook';

const TextToVoicePage = () => {
  const {
    isConnected,
    chatHistory,
    aiResponseBuffer,
    selectedVoice,
    setSelectedVoice,
    sendMessage
  } = useTextToVoice();

  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Nexus Text-to-Voice</h1>
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
        flex: 1,
        overflow: 'hidden'
      }}>
        
        {/* Chat History Area */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
            {chatHistory.map((msg, index) => (
                <div key={index} style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '18px',
                    backgroundColor: msg.sender === 'user' ? '#007bff' : '#ffffff',
                    color: msg.sender === 'user' ? '#ffffff' : '#333333',
                    border: msg.sender === 'ai' ? '1px solid #e0e0e0' : 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                    <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong>
                    <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                </div>
            ))}

            {/* Current accumulating AI response */}
            {aiResponseBuffer && (
                <div style={{
                    alignSelf: 'flex-start',
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '18px',
                    backgroundColor: '#ffffff',
                    color: '#333333',
                    border: '1px solid #e0e0e0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                    <strong>AI:</strong>
                    <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{aiResponseBuffer}</div>
                </div>
            )}
        </div>

        {/* Input Area */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder="Type your message here..."
             style={{
                 flex: 1,
                 padding: '12px',
                 borderRadius: '8px',
                 border: '1px solid #ccc',
                 resize: 'none',
                 height: '50px',
                 fontFamily: 'inherit'
             }}
          />
          <button
             onClick={handleSend}
             disabled={!isConnected || !inputText.trim()}
             style={{
                 padding: '0 25px',
                 backgroundColor: isConnected ? '#007bff' : '#cccccc',
                 color: 'white',
                 border: 'none',
                 borderRadius: '8px',
                 cursor: isConnected ? 'pointer' : 'not-allowed',
                 fontWeight: 'bold'
             }}
          >
              Send
          </button>
        </div>

      </div>
    </div>
  );
};

export default TextToVoicePage;
