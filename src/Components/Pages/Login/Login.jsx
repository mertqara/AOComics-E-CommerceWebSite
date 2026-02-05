// src/Components/Pages/Login/Login.jsx
import React, { useState } from 'react';
import './Login.css';
import { Link, useNavigate } from 'react-router-dom';
import API from '../../../services/api';  // Goes up 3 levels to src/services

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/auth/login', { email, password });

      // Save token and user info to sessionStorage (per-tab storage)
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirect to home page
      navigate('/');
      
      // Optional: Reload to update navbar
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-container">
        <h1>Login</h1>
        
        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-fields">
            <input 
              type="email" 
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Continue'}
          </button>
        </form>

        <p className="login-signup">
          Don't have an account? <Link to="/signup">Sign up here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;