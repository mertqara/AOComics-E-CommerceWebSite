// src/Components/Pages/LoginSignUp/LoginSignUp.jsx
import React, { useState } from 'react';
import './CSS/LoginSignUp.css';
import { Link, useNavigate } from 'react-router-dom';
import API from '../../../services/api';  // Goes up 3 levels to src/services

const LoginSignUp = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!agreed) {
      setError('Please agree to terms and conditions');
      return;
    }

    setLoading(true);

    try {
      const response = await API.post('/auth/register', { name, email, password });
      
      // Save token and user info
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirect to home page
      navigate('/');
      
      // Optional: Reload to update navbar
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='loginsignup'>
      <div className="loginsignup-container">
        <h1>Sign Up</h1>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="loginsignup-fields">
            <input 
              type="text" 
              placeholder='Your Name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input 
              type="email" 
              placeholder='Email Address'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="loginsignup-agree">
            <input 
              type="checkbox" 
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <p>By continuing, I agree to the terms of use & privacy policy.</p>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Continue'}
          </button>
        </form>

        <p className="loginsignup-login">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginSignUp;