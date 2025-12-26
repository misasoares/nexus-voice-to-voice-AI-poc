import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './app/home/page';
import VoiceToVoicePage from './app/voice-to-voice/page';
import TextToVoicePage from './app/text-to-voice/page';
import AiRolesPage from './app/ai-roles/page';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice-to-voice" element={<VoiceToVoicePage />} />
        <Route path="/text-to-voice" element={<TextToVoicePage />} />
        <Route path="/ai-roles" element={<AiRolesPage />} />
      </Routes>
    </Router>
  );
}

export default App;
