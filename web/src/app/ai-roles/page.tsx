import { useState } from 'react';
import { useRoleStore } from '../../store/useRoleStore';
import { Trash2, CheckCircle, Plus, User, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const AiRolesPage = () => {
  const { roles, addRole, removeRole, activeRoleId, setActiveRole } = useRoleStore();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const mockAnswers = [
        { question: "O que você vende? (Produto e Ticket médio)", answer: "Software de Gestão de Frota. Ticket médio de R$ 500/mês por veículo." },
        { question: "Qual é a principal transformação ou promessa do seu produto?", answer: "Redução de 20% nos custos de combustível e manutenção preventiva automatizada." },
        { question: "Quem é o seu cliente ideal? (Profissão, Idade aproximada, Gênero)", answer: "Gerentes de Logística, 35-50 anos, Homens e Mulheres." },
        { question: "Qual é o nível de consciência desse lead? (Perdido / Sabe do problema / Comparando soluções)", answer: "Sabe do problema (gasta muito com manutenção) mas não conhece minha solução." },
        { question: "Qual é a principal Dor/Problema que tira o sono dele?", answer: "Veículos parados na oficina e falta de controle sobre os motoristas." },
        { question: "Qual é o principal Desejo dele? Onde ele quer chegar?", answer: "Ter a frota rodando 100% do tempo e relatórios automáticos no email." },
        { question: "Liste as TOP 3 Objeções Reais que você ouve.", answer: "1. É muito caro. 2. Meus motoristas não vão usar. 3. Já tenho rastreador simples." },
        { question: "Qual o estilo de personalidade mais comum? (Apressado, Desconfiado, etc.)", answer: "Apressado e Prático. Quer números." },
        { question: "Qual o contexto dessa chamada? (Cold call, Inbound, Indicação?)", answer: "Cold Call." },
        { question: "O que ele valoriza mais na decisão? (Preço, Rapidez, Confiança?)", answer: "Rapidez na instalação e ROI claro." },
        { question: "O que irrita esse lead ou faz ele perder o interesse?", answer: "Enrolação técnica e promessas vagas." },
        { question: "Escreva 2 frases curtas que esse lead costuma dizer (gírias/estilo).", answer: "\"Preciso disso pra ontem\" e \"Me manda o email que eu vejo\"." }
      ];

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/ai-services/generate-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: mockAnswers }),
      });

      if (!response.ok) throw new Error('Failed to generate');

      const data = await response.json();
      addRole(data.systemPrompt, "Gerente Logística (Auto)");
      alert('Perfil gerado automaticamente com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar perfil automático.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8f9fa' }}>
      <header style={{ padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#666', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>
            &larr; Back
          </Link>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>Lead Profiles</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: isGenerating ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(40,167,69,0.2)'
            }}
          >
            <Sparkles size={20} />
            {isGenerating ? 'Generating...' : 'Auto Generate'}
          </button>
          <button
            onClick={() => navigate('/ai-roles/create')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
            }}
          >
            <Plus size={20} />
            Create New Profile
          </button>
        </div>
      </header>

      <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        
        {/* List Section */}
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '18px', color: '#444' }}>Available Profiles</h2>
          {roles.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px', 
              backgroundColor: 'white', 
              borderRadius: '16px',
              border: '1px dashed #ccc',
              color: '#666'
            }}>
              <User size={48} color="#ddd" style={{ marginBottom: '16px' }} />
              <p style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>No profiles found</p>
              <p style={{ margin: '8px 0 20px', color: '#999' }}>Create your first lead profile to start simulating calls.</p>
              <button
                onClick={() => navigate('/ai-roles/create')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Create Profile
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {roles.map((role) => {
                const isActive = role.id === activeRoleId;
                return (
                  <div key={role.id} style={{
                    padding: '24px',
                    border: isActive ? '2px solid #007bff' : '1px solid #eaeaea',
                    borderRadius: '16px',
                    backgroundColor: isActive ? '#f8fbff' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    height: '200px'
                  }}
                  onClick={() => setActiveRole(isActive ? null : role.id)}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>{role.name}</h3>
                        {isActive && <CheckCircle size={20} color="#007bff" />}
                      </div>
                      <p style={{ 
                        margin: 0, 
                        color: '#666', 
                        fontSize: '14px', 
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {role.content.replace(/\*\*/g, '').substring(0, 150)}...
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(role.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm('Are you sure you want to delete this profile?')) {
                            removeRole(role.id);
                          }
                        }}
                        title="Delete Role"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          color: '#ff4d4f',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff1f0'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AiRolesPage;
