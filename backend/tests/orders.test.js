const request = require('supertest');
const express = require('express');
const orderRoutes = require('../routes/orders');
const authRoutes = require('../routes/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
require('./setup');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

process.env.JWT_SECRET = 'test-secret-key';

describe('Order Routes', () => {
  let authToken;
  let userId;
  let productId;
  let productId2;

  beforeEach(async () => {
    // Register and login a user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'password123'
      });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;

    // Create test products
    const product1 = await Product.create({
      name: 'Spider-Man Comic',
      description: 'Amazing Spider-Man',
      price: 15.99,
      quantityInStock: 10,
      category: 'Marvel'
    });
    productId = product1._id;

    const product2 = await Product.create({
      name: 'Batman Comic',
      description: 'Dark Knight',
      price: 12.99,
      quantityInStock: 3,
      category: 'DC'
    });
    productId2 = product2._id;
  });

  describe('POST /api/orders', () => {
    it('should create order with valid items and sufficient stock', async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            quantity: 2,
            price: 15.99
          }
        ],
        totalPrice: 31.98,
        deliveryAddress: '123 Main St, New York, NY 10001'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.message).toBe('Order placed successfully');
      expect(response.body.order).toHaveProperty('_id');
      expect(response.body.order.status).toBe('processing');
      expect(response.body.order.orderItems).toHaveLength(1);

      // Verify stock was reduced
      const product = await Product.findById(productId);
      expect(product.quantityInStock).toBe(8); // 10 - 2
    });

    it('should reject order with insufficient stock', async () => {
      const orderData = {
        orderItems: [
          {
            product: productId2,
            quantity: 5, // Only 3 in stock
            price: 12.99
          }
        ],
        totalPrice: 64.95,
        deliveryAddress: '456 Oak Ave, Los Angeles, CA 90001'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.message).toContain('Not enough stock');
      expect(response.body.message).toContain('Only 3 available');

      // Verify stock was NOT reduced
      const product = await Product.findById(productId2);
      expect(product.quantityInStock).toBe(3);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel order and restore stock', async () => {
      // Create an order first
      const orderData = {
        orderItems: [
          {
            product: productId,
            quantity: 3,
            price: 15.99
          }
        ],
        totalPrice: 47.97,
        deliveryAddress: '789 Elm St, Chicago, IL 60601'
      };

      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.order._id;

      // Verify stock was reduced
      let product = await Product.findById(productId);
      expect(product.quantityInStock).toBe(7); // 10 - 3

      // Cancel the order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cancelResponse.body.message).toBe('Order cancelled successfully');
      expect(cancelResponse.body.order.status).toBe('cancelled');

      // Verify stock was restored
      product = await Product.findById(productId);
      expect(product.quantityInStock).toBe(10); // 7 + 3 restored

      // Verify order status in database
      const order = await Order.findById(orderId);
      expect(order.status).toBe('cancelled');
    });

    it('should reject cancellation of non-processing orders', async () => {
      // Create an order
      const orderData = {
        orderItems: [
          {
            product: productId,
            quantity: 1,
            price: 15.99
          }
        ],
        totalPrice: 15.99,
        deliveryAddress: '321 Pine St, Boston, MA 02101'
      };

      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.order._id;

      // Update order status to 'delivered'
      await Order.findByIdAndUpdate(orderId, { status: 'delivered' });

      // Try to cancel the delivered order
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(cancelResponse.body.message).toBe('Can only cancel orders that are in processing status');
    });
  });
});
