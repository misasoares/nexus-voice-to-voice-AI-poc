import { useState } from 'react';
import { useRoleStore } from '../../store/useRoleStore';
import { Trash2, CheckCircle, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';

const AiRolesPage = () => {
  const { roles, addRole, removeRole, activeRoleId, setActiveRole } = useRoleStore();
  const [inputText, setInputText] = useState('');

  const handleSave = () => {
    if (!inputText.trim()) return;
    addRole(inputText.trim());
    setInputText('');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>&larr; Back</Link>
        <h1 style={{ margin: 0 }}>AI Roles Manager</h1>
      </header>

      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Input Section */}
        <div style={{ marginBottom: '40px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Define a New Role</label>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Example: You are a helpful assistant who speaks in rhymes..."
              rows={5}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '16px'
              }}
            />
            <button
              onClick={handleSave}
              disabled={!inputText.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: inputText.trim() ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                height: 'fit-content'
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* List Section */}
        <div>
          <h2 style={{ marginBottom: '20px' }}>Saved Roles</h2>
          {roles.length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No roles defined yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {roles.map((role) => {
                const isActive = role.id === activeRoleId;
                return (
                  <div key={role.id} style={{
                    padding: '20px',
                    border: isActive ? '2px solid #4caf50' : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    backgroundColor: isActive ? '#f0fdf4' : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}>
                    <div 
                      onClick={() => setActiveRole(isActive ? null : role.id)}
                      style={{ flex: 1, cursor: 'pointer', display: 'flex', gap: '15px', alignItems: 'center' }}
                    >
                      {isActive ? <CheckCircle size={24} color="#4caf50" /> : <Circle size={24} color="#ccc" />}
                      <span style={{ fontSize: '16px', lineHeight: '1.5', color: '#333' }}>{role.content}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRole(role.id);
                      }}
                      title="Delete Role"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        color: '#f44336',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={20} />
                    </button>
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
