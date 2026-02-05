const request = require('supertest');
const express = require('express');
const reviewRoutes = require('../routes/reviews');
const authRoutes = require('../routes/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
require('./setup');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);

process.env.JWT_SECRET = 'test-secret-key';

describe('Review Routes', () => {
  let authToken;
  let userId;
  let productId;

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

    // Create test product
    const product = await Product.create({
      name: 'Spider-Man Comic',
      description: 'Amazing Spider-Man',
      price: 15.99,
      quantityInStock: 10,
      category: 'Marvel',
      rating: 0,
      numReviews: 0
    });
    productId = product._id;

    // Create a delivered order (so user can review)
    await Order.create({
      user: userId,
      orderItems: [{
        product: productId,
        name: 'Spider-Man Comic',
        quantity: 1,
        price: 15.99
      }],
      totalPrice: 15.99,
      deliveryAddress: '123 Main St',
      status: 'delivered'
    });
  });

  describe('POST /api/reviews', () => {
    it('should create review from verified purchaser', async () => {
      const reviewData = {
        productId: productId,
        rating: 5,
        comment: 'Great comic book! Highly recommended.'
      };

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.message).toContain('Review submitted successfully');
      expect(response.body.review).toHaveProperty('_id');
      expect(response.body.review.rating).toBe(5);
      expect(response.body.review.comment).toBe('Great comic book! Highly recommended.');
      expect(response.body.review.approved).toBe(false);

      // Verify review was created in database
      const review = await Review.findOne({
        product: productId,
        user: userId
      });
      expect(review).toBeTruthy();
      expect(review.rating).toBe(5);
    });

    it('should reject review from non-purchaser', async () => {
      // Create another product without an order
      const product2 = await Product.create({
        name: 'Batman Comic',
        description: 'Dark Knight',
        price: 12.99,
        quantityInStock: 5,
        category: 'DC'
      });

      const reviewData = {
        productId: product2._id,
        rating: 4,
        comment: 'Looks good but I did not buy it'
      };

      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(400);

      expect(response.body.message).toBe('You can only review products you have purchased and received');

      // Verify no review was created
      const review = await Review.findOne({
        product: product2._id,
        user: userId
      });
      expect(review).toBeNull();
    });
  });

  describe('Product Rating Update', () => {
    it('should update product rating after review approval', async () => {
      // Create multiple reviews
      const reviewData1 = {
        productId: productId,
        rating: 5,
        comment: 'Excellent!'
      };

      const response1 = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData1)
        .expect(201);

      const reviewId1 = response1.body.review._id;

      // Create second user and order
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User Two',
          email: 'user2@example.com',
          password: 'password456'
        });

      const user2Token = user2Response.body.token;
      const user2Id = user2Response.body.user.id;

      await Order.create({
        user: user2Id,
        orderItems: [{
          product: productId,
          name: 'Spider-Man Comic',
          quantity: 1,
          price: 15.99
        }],
        totalPrice: 15.99,
        deliveryAddress: '456 Oak Ave',
        status: 'delivered'
      });

      // Second user creates review
      const reviewData2 = {
        productId: productId,
        rating: 3,
        comment: 'It was okay'
      };

      const response2 = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${user2Token}`)
        .send(reviewData2)
        .expect(201);

      const reviewId2 = response2.body.review._id;

      // Check product rating before approval (should still be 0)
      let product = await Product.findById(productId);
      expect(product.rating).toBe(0);
      expect(product.numReviews).toBe(0);

      // Approve first review (rating 5)
      await request(app)
        .patch(`/api/reviews/${reviewId1}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check product rating after first approval
      product = await Product.findById(productId);
      expect(product.rating).toBe(5);
      expect(product.numReviews).toBe(1);

      // Approve second review (rating 3)
      await request(app)
        .patch(`/api/reviews/${reviewId2}/approve`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Check product rating after second approval (average of 5 and 3 = 4)
      product = await Product.findById(productId);
      expect(product.rating).toBe(4);
      expect(product.numReviews).toBe(2);
    });
  });
});
