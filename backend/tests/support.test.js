const request = require('supertest');
const express = require('express');
const chatRoutes = require('../routes/chat');
const User = require('../models/User');
require('./setup');

const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);

describe('Support Agent & Chat Routes', () => {
  let customerId;

  beforeEach(async () => {
    // create a support agent user that the test auth middleware will map to
    await User.create({
      name: 'Support Agent',
      email: 'manager@test.com',
      password: 'password123',
      role: 'support_agent'
    });
  });

  it('Customer can start a chat', async () => {
    const res = await request(app)
      .post('/api/chat/start')
      .send({ customerName: 'Alice', initialMessage: 'Hello support', customerEmail: 'alice@test.com' })
      .expect(201);

    expect(res.body).toHaveProperty('chat');
    expect(res.body.chat.status).toBe('waiting');
    customerId = res.body.chat.customer.userId || res.body.chat._id;
  });

  it('Support agent can view queue, claim and close a chat', async () => {
    // start a chat as customer
    const start = await request(app)
      .post('/api/chat/start')
      .send({ customerName: 'Bob', initialMessage: 'Need help', customerEmail: 'bob@test.com' })
      .expect(201);

    const chatId = start.body.chat._id;

    // support agent views queue
    const queue = await request(app)
      .get('/api/chat/queue')
      .set('Authorization', 'Bearer manager-mock-token')
      .expect(200);

    expect(Array.isArray(queue.body.chats)).toBe(true);
    expect(queue.body.chats.some(c => c._id === chatId)).toBe(true);

    // claim the chat
    const claim = await request(app)
      .post(`/api/chat/${chatId}/claim`)
      .set('Authorization', 'Bearer manager-mock-token')
      .expect(200);

    expect(claim.body.chat.status).toBe('active');
    expect(claim.body.chat.agent).toBeDefined();

    // close the chat
    const close = await request(app)
      .post(`/api/chat/${chatId}/close`)
      .set('Authorization', 'Bearer manager-mock-token')
      .expect(200);

    expect(close.body.chat.status).toBe('closed');
  });
});
