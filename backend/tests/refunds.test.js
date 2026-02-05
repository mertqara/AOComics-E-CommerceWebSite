const request = require('supertest');
const express = require('express');
const refundRoutes = require('../routes/refunds');
const salesManagerRoutes = require('../routes/salesManager');
const Refund = require('../models/Refund');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
require('./setup');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/refunds', refundRoutes);
app.use('/api/sales', salesManagerRoutes);

describe('Refund System Tests', () => {
  let testUser;
  let testProduct;
  let testOrder;
  let authToken;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      password: 'password123',
      role: 'customer'
    });

    // Create test product
    testProduct = await Product.create({
      name: 'Test Comic Book',
      description: 'A test comic',
      price: 19.99,
      quantityInStock: 100,
      category: 'Marvel',
      rating: 4.5,
      numReviews: 10
    });

    // Create delivered order with deliveryCompletedAt
    testOrder = await Order.create({
      user: testUser._id,
      orderItems: [{
        product: testProduct._id,
        name: 'Test Comic Book',
        quantity: 2,
        price: 19.99
      }],
      totalPrice: 39.98,
      deliveryAddress: '123 Test St',
      paymentInfo: {
        creditCardNumber: '**** **** **** 1234',
        cardHolderName: 'Test Customer',
        expiryDate: '12/25'
      },
      status: 'delivered',
      deliveryCompletedAt: new Date()
    });

    authToken = 'mock-token';
  });

  describe('POST /api/refunds/request - Customer Refund Request', () => {
    it('TC1: should successfully create a refund request for delivered order', async () => {
      const refundData = {
        orderId: testOrder._id,
        productId: testProduct._id,
        quantity: 1,
        reason: 'Product arrived damaged'
      };

      const response = await request(app)
        .post('/api/refunds/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Refund request submitted successfully');
      expect(response.body.refund).toHaveProperty('status', 'pending');
      expect(response.body.refund.quantity).toBe(1);
      expect(response.body.refund.refundAmount).toBe(19.99);
    });

    it('TC2: should reject refund request for non-delivered order', async () => {
      // Create non-delivered order
      const processingOrder = await Order.create({
        user: testUser._id,
        orderItems: [{
          product: testProduct._id,
          name: 'Test Comic Book',
          quantity: 1,
          price: 19.99
        }],
        totalPrice: 19.99,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: '**** **** **** 1234',
          cardHolderName: 'Test Customer',
          expiryDate: '12/25'
        },
        status: 'processing'
      });

      const refundData = {
        orderId: processingOrder._id,
        productId: testProduct._id,
        quantity: 1,
        reason: 'Changed my mind'
      };

      const response = await request(app)
        .post('/api/refunds/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(400);

      expect(response.body.message).toContain('delivered');
    });

    it('TC3: should reject refund request after 30-day window', async () => {
      // Create order delivered 31 days ago
      const oldOrder = await Order.create({
        user: testUser._id,
        orderItems: [{
          product: testProduct._id,
          name: 'Test Comic Book',
          quantity: 1,
          price: 19.99
        }],
        totalPrice: 19.99,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: '**** **** **** 1234',
          cardHolderName: 'Test Customer',
          expiryDate: '12/25'
        },
        status: 'delivered',
        deliveryCompletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      });

      const refundData = {
        orderId: oldOrder._id,
        productId: testProduct._id,
        quantity: 1,
        reason: 'Too late'
      };

      const response = await request(app)
        .post('/api/refunds/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(400);

      expect(response.body.message).toContain('30 days');
    });

    it('TC4: should reject refund for quantity exceeding ordered amount', async () => {
      const refundData = {
        orderId: testOrder._id,
        productId: testProduct._id,
        quantity: 10, // Only ordered 2
        reason: 'Want to refund more than ordered'
      };

      const response = await request(app)
        .post('/api/refunds/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(400);

      expect(response.body.message).toContain('available for refund');
    });

    it('TC5: should require refund reason', async () => {
      const refundData = {
        orderId: testOrder._id,
        productId: testProduct._id,
        quantity: 1,
        reason: '' // Empty reason
      };

      const response = await request(app)
        .post('/api/refunds/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(400);

      expect(response.body.message).toContain('required');
    });
  });

  describe('GET /api/refunds/my-refunds - View Customer Refunds', () => {
    it('TC6: should retrieve all refunds for authenticated customer', async () => {
      // Create test refunds
      await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 19.99,
        reason: 'Damaged product',
        status: 'pending'
      });

      const response = await request(app)
        .get('/api/refunds/my-refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('status');
    });

    it('TC7: should return empty array when customer has no refunds', async () => {
      const response = await request(app)
        .get('/api/refunds/my-refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('PATCH /api/sales/refunds/:id/approve - Sales Manager Approval', () => {
    let salesManager;
    let managerToken;
    let pendingRefund;

    beforeEach(async () => {
      salesManager = await User.create({
        name: 'Sales Manager',
        email: 'manager@test.com',
        password: 'password123',
        role: 'sales_manager'
      });

      managerToken = 'manager-mock-token';

      pendingRefund = await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 19.99,
        reason: 'Defective product',
        status: 'pending'
      });
    });

    it('TC8: should successfully approve refund request', async () => {
      const response = await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.message).toContain('approved');
      expect(response.body.refund.status).toBe('approved');
    });

    it('TC9: should add product quantity back to stock on approval', async () => {
      const originalStock = testProduct.quantityInStock;

      await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.quantityInStock).toBe(originalStock + 1);
    });

    it('TC10: should reject approval of already approved refund', async () => {
      // First approval
      await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Second approval attempt
      const response = await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(400);

      expect(response.body.message).toContain('already');
    });
  });

  describe('PATCH /api/sales/refunds/:id/reject - Sales Manager Rejection', () => {
    let salesManager;
    let managerToken;
    let pendingRefund;

    beforeEach(async () => {
      salesManager = await User.create({
        name: 'Sales Manager',
        email: 'manager@test.com',
        password: 'password123',
        role: 'sales_manager'
      });

      managerToken = 'manager-mock-token';

      pendingRefund = await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 19.99,
        reason: 'Not satisfied',
        status: 'pending'
      });
    });

    it('TC11: should successfully reject refund with reason', async () => {
      const response = await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Product was used' })
        .expect(200);

      expect(response.body.message).toContain('rejected');
      expect(response.body.refund.status).toBe('rejected');
      expect(response.body.refund.rejectionReason).toBe('Product was used');
    });

    it('TC12: should require rejection reason', async () => {
      const response = await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: '' })
        .expect(400);

      expect(response.body.message).toContain('reason');
    });

    it('TC13: should NOT add stock back when refund is rejected', async () => {
      const originalStock = testProduct.quantityInStock;

      await request(app)
        .patch(`/api/sales/refunds/${pendingRefund._id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Invalid request' })
        .expect(200);

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.quantityInStock).toBe(originalStock);
    });
  });

  describe('GET /api/sales/refunds - Sales Manager View Refunds', () => {
    let salesManager;
    let managerToken;

    beforeEach(async () => {
      salesManager = await User.create({
        name: 'Sales Manager',
        email: 'manager@test.com',
        password: 'password123',
        role: 'sales_manager'
      });

      managerToken = 'manager-mock-token';

      // Create refunds with different statuses
      await Refund.create([
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 1',
          status: 'pending'
        },
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 2',
          status: 'approved'
        },
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 3',
          status: 'rejected',
          rejectionReason: 'Invalid'
        }
      ]);
    });

    it('TC14: should retrieve all refunds when filter is "all"', async () => {
      const response = await request(app)
        .get('/api/sales/refunds?status=all')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });

    it('TC15: should filter refunds by pending status', async () => {
      const response = await request(app)
        .get('/api/sales/refunds?status=pending')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('pending');
    });

    it('TC16: should filter refunds by approved status', async () => {
      const response = await request(app)
        .get('/api/sales/refunds?status=approved')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('approved');
    });

    it('TC17: should filter refunds by rejected status', async () => {
      const response = await request(app)
        .get('/api/sales/refunds?status=rejected')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('rejected');
    });
  });

  describe('GET /api/sales/refunds/statistics - Refund Statistics', () => {
    let salesManager;
    let managerToken;

    beforeEach(async () => {
      salesManager = await User.create({
        name: 'Sales Manager',
        email: 'manager@test.com',
        password: 'password123',
        role: 'sales_manager'
      });

      managerToken = 'manager-mock-token';

      // Create refunds with different statuses
      await Refund.create([
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 1',
          status: 'pending'
        },
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 2,
          refundAmount: 39.98,
          reason: 'Reason 2',
          status: 'approved'
        },
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 3',
          status: 'approved'
        },
        {
          order: testOrder._id,
          user: testUser._id,
          product: testProduct._id,
          quantity: 1,
          refundAmount: 19.99,
          reason: 'Reason 4',
          status: 'rejected',
          rejectionReason: 'Invalid'
        }
      ]);
    });

    it('TC18: should return correct refund statistics', async () => {
      const response = await request(app)
        .get('/api/sales/refunds/statistics')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.total).toBe(4);
      expect(response.body.byStatus.pending).toBe(1);
      expect(response.body.byStatus.approved).toBe(2);
      expect(response.body.byStatus.rejected).toBe(1);
    });

    it('TC19: should calculate total refunded amount correctly', async () => {
      const response = await request(app)
        .get('/api/sales/refunds/statistics')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Only approved refunds: 39.98 + 19.99 = 59.97
      expect(response.body.totalRefundAmount).toBeCloseTo(59.97, 2);
    });
  });

  describe('GET /api/refunds/eligible-products/:orderId - Check Eligibility', () => {
    it('TC20: should return eligible products within 30-day window', async () => {
      const response = await request(app)
        .get(`/api/refunds/eligible-products/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('order');
      expect(response.body).toHaveProperty('eligibleItems');
      expect(Array.isArray(response.body.eligibleItems)).toBe(true);
      expect(response.body.eligibleItems.length).toBeGreaterThan(0);
    });

    it('TC21: should show days since delivery in eligibility check', async () => {
      const response = await request(app)
        .get(`/api/refunds/eligible-products/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.order).toHaveProperty('daysSinceDelivery');
      expect(response.body.order.daysSinceDelivery).toBeGreaterThanOrEqual(0);
      expect(response.body.order.daysSinceDelivery).toBeLessThanOrEqual(30);
    });

    it('TC22: should show available quantity for refund', async () => {
      const response = await request(app)
        .get(`/api/refunds/eligible-products/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.eligibleItems[0]).toHaveProperty('availableForRefund');
      expect(response.body.eligibleItems[0].availableForRefund).toBe(2);
    });

    it('TC23: should reduce available quantity after partial refund', async () => {
      // Create a refund for 1 item
      await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 19.99,
        reason: 'Partial refund',
        status: 'pending'
      });

      // Update order with refundedQuantity
      testOrder.orderItems[0].refundedQuantity = 1;
      await testOrder.save();

      const response = await request(app)
        .get(`/api/refunds/eligible-products/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should have 1 available (2 ordered - 1 refunded)
      expect(response.body.eligibleItems[0].availableForRefund).toBe(1);
    });

    it('TC24: should exclude fully refunded products', async () => {
      // Refund all items
      testOrder.orderItems[0].refundedQuantity = 2;
      await testOrder.save();

      const response = await request(app)
        .get(`/api/refunds/eligible-products/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should have no eligible items
      expect(response.body.eligibleItems.length).toBe(0);
    });

    it('TC25: should reject eligibility check for non-existent order', async () => {
      const fakeOrderId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/refunds/eligible-products/${fakeOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});