// src/services/api.js
import axios from 'axios';

const API = axios.create({
  // Revert to backend port 5001 (previous configuration)
  baseURL: 'http://localhost:5001/api'
});

// Add token to requests automatically
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;