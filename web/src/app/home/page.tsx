import { Link } from 'react-router-dom';
import './home.css';

const HomePage = () => {
  return (
    <div className="home-container">
      <div className="card-container">
        <Link to="/voice-to-voice" className="card">
          Voice to Voice
        </Link>
        <Link to="/text-to-voice" className="card">
          Text to Voice
        </Link>
        <Link to="/ai-roles" className="card">
          AI Roles
        </Link>
      </div>
    </div>
  );
};

export default HomePage;
