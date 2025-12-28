import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoleStore } from '../../../store/useRoleStore';
import { Send, ArrowLeft, Loader2, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'ai' | 'user';
  isTyping?: boolean;
}

const QUESTIONS = [
  "O que você vende? (Produto e Ticket médio)",
  "Qual é a principal transformação ou promessa do seu produto?",
  "Quem é o seu cliente ideal? (Profissão, Idade aproximada, Gênero)",
  "Qual é o nível de consciência desse lead? (Perdido / Sabe do problema / Comparando soluções)",
  "Qual é a principal Dor/Problema que tira o sono dele?",
  "Qual é o principal Desejo dele? Onde ele quer chegar?",
  "Liste as TOP 3 Objeções Reais que você ouve.",
  "Qual o estilo de personalidade mais comum? (Apressado, Desconfiado, etc.)",
  "Qual o contexto dessa chamada? (Cold call, Inbound, Indicação?)",
  "O que ele valoriza mais na decisão? (Preço, Rapidez, Confiança?)",
  "O que irrita esse lead ou faz ele perder o interesse?",
  "Escreva 2 frases curtas que esse lead costuma dizer (gírias/estilo)."
];

const CreateProfilePage = () => {
  const navigate = useNavigate();
  const { addRole } = useRoleStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Initial greeting
  useEffect(() => {
    if (currentQuestionIndex === -1 && !hasInitialized.current) {
      hasInitialized.current = true;
      addSystemMessage("Olá, tudo bem? Vamos iniciar o processo de criação de Perfil de Lead.", 500);
      
      setTimeout(() => {
        askNextQuestion(0);
      }, 1500);
    }
  }, []);

  const addSystemMessage = (text: string, typingDelay = 2000) => {
    setIsTyping(true);
    
    // Smooth scrolling to show typing indicator
    setTimeout(() => scrollToBottom(), 100);

    setTimeout(() => {
      setIsTyping(false);
      const newMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: 'ai'
      };
      setMessages(prev => [...prev, newMessage]);
    }, typingDelay);
  };

  const askNextQuestion = (index: number) => {
    if (index < QUESTIONS.length) {
      addSystemMessage(QUESTIONS[index]);
      setCurrentQuestionIndex(index);
    } else {
      generateProfile();
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || isTyping || isGenerating) return;

    const userText = inputText.trim();
    setInputText('');

    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: userText,
      sender: 'user'
    };
    setMessages(prev => [...prev, userMessage]);

    // Save answer
    if (currentQuestionIndex >= 0 && currentQuestionIndex < QUESTIONS.length) {
      setAnswers(prev => [...prev, { 
        question: QUESTIONS[currentQuestionIndex], 
        answer: userText 
      }]);
      
      // Proceed to next question
      setTimeout(() => {
        askNextQuestion(currentQuestionIndex + 1);
      }, 500);
    }
  };

  const generateProfile = async () => {
    setIsGenerating(true);
    try {
      // Assuming API URL is stored in VITE_API_URL or relative proxy
      // Adjust the URL based on your specific setup
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/ai-services/generate-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate profile');
      }

      const data = await response.json();
      const generatedPrompt = data.systemPrompt;
      
      // Extract a name from the answers or generate a generic one
      const nameAnswer = answers.find(a => a.question.includes("Quem é o seu cliente ideal"));
      const extractedName = nameAnswer ? `Persona: ${nameAnswer.answer.substring(0, 20)}...` : 'Novo Perfil de Lead';

      addRole(generatedPrompt, extractedName);
      
      alert('Perfil criado com sucesso!');
      navigate('/ai-roles');
      
    } catch (error) {
      console.error('Error generating profile:', error);
      alert('Erro ao gerar perfil. Tente novamente.');
      setIsGenerating(false);
    }
  };

  const progressPercentage = Math.min(((currentQuestionIndex) / QUESTIONS.length) * 100, 100);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <header style={{ 
        padding: '16px 20px', 
        backgroundColor: 'white', 
        borderBottom: '1px solid #eaeaea', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => navigate('/ai-roles')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              color: '#666'
            }}
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>Criando Novo Perfil</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>IA Arquiteta de Personas</p>
          </div>
        </div>
        
        {/* Simple Progress Indicator */}
        <div style={{ width: '100px', height: '6px', backgroundColor: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${Math.max(0, progressPercentage)}%`, 
            height: '100%', 
            backgroundColor: '#007bff', 
            transition: 'width 0.5s ease' 
          }} />
        </div>
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{ 
              display: 'flex', 
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', maxWidth: '80%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', 
                backgroundColor: msg.sender === 'user' ? '#007bff' : '#1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                {msg.sender === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
              </div>
              
              <div style={{
                padding: '12px 16px',
                borderRadius: '16px',
                borderTopLeftRadius: msg.sender === 'ai' ? '4px' : '16px',
                borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
                backgroundColor: msg.sender === 'user' ? '#007bff' : 'white',
                color: msg.sender === 'user' ? 'white' : '#333',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                lineHeight: '1.5',
                fontSize: '15px'
              }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
           <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '8px', maxWidth: '80%' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Bot size={16} color="white" />
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '16px',
                borderTopLeftRadius: '4px',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <span className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#ccc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                <span className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#ccc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.16s' }}></span>
                <span className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#ccc', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.32s' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {isGenerating ? (
        <div style={{ padding: '30px', backgroundColor: 'white', borderTop: '1px solid #eaeaea', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <Loader2 size={32} className="spin-animation" color="#007bff" />
            <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Gerando Perfil de Lead...</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Isso pode levar alguns segundos.</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #eaeaea' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isTyping ? "Aguarde a próxima pergunta..." : "Digite sua resposta..."}
              disabled={isTyping}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '30px',
                border: '1px solid #ddd',
                fontSize: '16px',
                outline: 'none',
                backgroundColor: isTyping ? '#f5f5f5' : 'white',
                color: '#000',
                transition: 'all 0.2s'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isTyping}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: !inputText.trim() || isTyping ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !inputText.trim() || isTyping ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CreateProfilePage;
