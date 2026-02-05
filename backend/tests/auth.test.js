const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('./setup');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Set JWT_SECRET for testing
process.env.JWT_SECRET = 'test-secret-key';

describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        name: userData.name,
        email: userData.email
      });
      expect(response.body.user).toHaveProperty('id');

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.name).toBe(userData.name);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123'
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const userData = {
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'password123'
      };

      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        name: userData.name,
        email: userData.email,
        role: 'customer'
      });
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with incorrect password', async () => {
      const userData = {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        password: 'correctpassword'
      };

      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Try login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT token on registration', async () => {
      const userData = {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const token = response.body.token;
      expect(token).toBeTruthy();

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id');
      expect(decoded.id).toBe(response.body.user.id);
    });
  });
});
