import React, { useState } from 'react';
// These are the icons needed for William's design layout
import { BrainCircuit, Mail, LockKeyhole, ArrowRight, Dumbbell } from 'lucide-react';

function AuthPage({ onShowHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const formData = new FormData();
    formData.append('username', email); // Maps frontend email to FastAPI's required username slot
    formData.append('password', password);

    const endpoint = isRegistering ? 'register' : 'login';

    try {
      const response = await fetch(`http://localhost:8000/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegistering) {
          setSuccessMessage('Account created successfully! You can now sign in.');
          setIsRegistering(false);
          setPassword('');
        } else {
          localStorage.setItem('userToken', data.access_token);
          onShowHome(); // Tells App.jsx to switch to the home view
        }
      } else {
        setErrorMessage(data.detail || 'An error occurred. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Cannot reach backend server. Is Uvicorn running on port 8000?');
    }
  };

  return (
    <section className="loginPage" aria-label="GymXP sign in">
      <div className="loginStory">
        <img
          src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80"
          alt="Athlete training with battle ropes"
        />
        <div className="loginStoryContent">
          <p className="eyebrow">AI workout intelligence</p>
          <h1>Train with a plan that adapts before you stall.</h1>
          <div className="loginMetrics" aria-label="Training highlights">
            <span><strong>45m</strong>Smart session</span>
            <span><strong>+8%</strong>Weekly volume</span>
            <span><strong>78</strong>Recovery score</span>
          </div>
        </div>
      </div>

      <form className="loginPanel" onSubmit={handleFormSubmit}>
        <div className="loginPanelHeader">
          <span className="loginIcon">
            <BrainCircuit size={24} />
          </span>
          <div>
            <p className="eyebrow">{isRegistering ? 'Get started' : 'Welcome back'}</p>
            <h2>{isRegistering ? 'Create your GymXP Account' : 'Sign in to GymXP'}</h2>
          </div>
        </div>

        {errorMessage && <div style={{ color: '#ff4d4d', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '6px', marginBottom: '10px', fontSize: '14px' }}>{errorMessage}</div>}
        {successMessage && <div style={{ color: '#2e7d32', backgroundColor: '#e8f5e9', padding: '10px', borderRadius: '6px', marginBottom: '10px', fontSize: '14px' }}>{successMessage}</div>}

        <label className="fieldGroup">
          <span>Email</span>
          <span className="inputWrap">
            <Mail size={18} />
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </span>
        </label>

        <label className="fieldGroup">
          <span>Password</span>
          <span className="inputWrap">
            <LockKeyhole size={18} />
            <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </span>
        </label>

        {!isRegistering && (
          <div className="loginOptions">
            <label className="rememberChoice"><input type="checkbox" /><span>Remember me</span></label>
            <button className="textButton" type="button">Forgot password</button>
          </div>
        )}

        <button className="primaryBtn loginSubmit" type="submit">
          <span>{isRegistering ? 'Sign Up' : 'Sign In'}</span>
          <ArrowRight size={18} />
        </button>

        <button className="secondaryBtn demoButton" type="button" onClick={onShowHome}>
          <Dumbbell size={18} />
          <span>View demo dashboard</span>
        </button>

        <p className="signupPrompt">
          {isRegistering ? 'Already have an account? ' : 'New to GymXP? '}
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setErrorMessage(''); setSuccessMessage(''); }}>
            {isRegistering ? 'Sign In instead' : 'Create an account'}
          </button>
        </p>
      </form>
    </section>
  );
}

export default AuthPage;