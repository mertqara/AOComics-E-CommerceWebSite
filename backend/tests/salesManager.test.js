const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const salesManagerRoutes = require('../routes/salesManager');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Refund = require('../models/Refund');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');

// Mock email service to prevent actual email sending during tests
jest.mock('../utils/emailService', () => ({
  notifyWishlistUsers: jest.fn().mockResolvedValue({ sent: 2, failed: 0 }),
  sendRefundApprovalEmail: jest.fn().mockResolvedValue(true),
  sendRefundRejectionEmail: jest.fn().mockResolvedValue(true)
}));

let mongoServer;
let app;
let salesManagerToken;
let salesManagerId;
let testProduct;
let testUser;
let testOrder;
let testRefund;

// Setup Express app for testing
const setupApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/sales', auth, salesManagerRoutes);
  return testApp;
};

// Generate JWT token for testing
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role, email: 'test@example.com' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Setup Express app
  app = setupApp();

  // Create test sales manager user
  const salesManager = await User.create({
    name: 'Test Sales Manager',
    email: 'salesmanager@test.com',
    password: 'password123',
    role: 'sales_manager'
  });
  salesManagerId = salesManager._id;
  salesManagerToken = generateToken(salesManagerId, 'sales_manager');

  // Create test customer
  testUser = await User.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: 'password123',
    role: 'customer',
    wishlist: []
  });

  // Create test product
  testProduct = await Product.create({
    name: 'Test Comic Book',
    description: 'A test comic',
    price: 100,
    originalPrice: 100,
    discount: 0,
    quantityInStock: 50,
    category: 'Marvel',
    serialNumber: 'TEST-001',
    model: 'Test Model'
  });

  // Add product to user's wishlist
  testUser.wishlist.push(testProduct._id);
  await testUser.save();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Reset test product to original state
  testProduct.price = 100;
  testProduct.originalPrice = 100;
  testProduct.discount = 0;
  testProduct.quantityInStock = 50;
  await testProduct.save();
});

afterEach(async () => {
  // Clean up orders and refunds after each test
  await Order.deleteMany({});
  await Refund.deleteMany({});
});

describe('Sales Manager Routes', () => {

  // ========================================
  // DISCOUNT MANAGEMENT TESTS
  // ========================================

  describe('POST /api/sales/discount', () => {
    it('should apply discount to products successfully', async () => {
      const response = await request(app)
        .post('/api/sales/discount')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({
          productIds: [testProduct._id],
          discountPercentage: 20
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Discount applied successfully');
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].discount).toBe(20);
      expect(response.body.products[0].price).toBe(80); // 100 - 20%

      // Verify product was updated in database
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.price).toBe(80);
      expect(updatedProduct.originalPrice).toBe(100);
    });

    it('should send email notifications to wishlist users', async () => {
      const { notifyWishlistUsers } = require('../utils/emailService');

      const response = await request(app)
        .post('/api/sales/discount')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({
          productIds: [testProduct._id],
          discountPercentage: 15
        });

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBeDefined();
      expect(response.body.emailNotifications.totalProducts).toBe(1);
      expect(notifyWishlistUsers).toHaveBeenCalled();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/sales/discount')
        .send({
          productIds: [testProduct._id],
          discountPercentage: 20
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/sales/undiscount', () => {
    it('should remove discount and restore original price', async () => {
      // First apply discount
      testProduct.originalPrice = 100;
      testProduct.price = 80;
      testProduct.discount = 20;
      await testProduct.save();

      const response = await request(app)
        .post('/api/sales/undiscount')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({
          productIds: [testProduct._id]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);

      // Verify product price restored
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.price).toBe(100);
    });
  });

  // ========================================
  // ANALYTICS TESTS
  // ========================================

  describe('GET /api/sales/analytics', () => {
    beforeEach(async () => {
      // Create test orders
      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [
          {
            product: testProduct._id,
            quantity: 2,
            price: 100
          }
        ],
        totalPrice: 200,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });
    });

    it('should calculate revenue, cost, and profit correctly', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get('/api/sales/analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.revenue).toBe(200);
      expect(response.body.cost).toBe(100); // 50% of revenue
      expect(response.body.profit).toBe(100);
      expect(response.body.orderCount).toBe(1);
      expect(response.body.averageOrderValue).toBe(200);
    });

    it('should exclude cancelled orders from analytics', async () => {
      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 100 }],
        totalPrice: 100,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'cancelled'
      });

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/sales/analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.orderCount).toBe(1); // Only non-cancelled order
      expect(response.body.revenue).toBe(200); // Only from non-cancelled order
    });
  });

  describe('GET /api/sales/detailed-metrics', () => {
    beforeEach(async () => {
      const product2 = await Product.create({
        name: 'Another Comic',
        price: 50,
        quantityInStock: 30,
        category: 'DC',
        serialNumber: 'TEST-002',
        model: 'Test Model 2'
      });

      await Order.create({
        user: testUser._id,
        orderItems: [
          { product: testProduct._id, quantity: 3, price: 100 },
          { product: product2._id, quantity: 1, price: 50 }
        ],
        totalPrice: 350,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });
    });

    it('should return detailed sales metrics', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/sales/detailed-metrics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.topProducts).toBeDefined();
      expect(response.body.categoryBreakdown).toBeDefined();
      expect(response.body.totalItemsSold).toBe(4); // 3 + 1
      expect(response.body.totalOrders).toBe(1);
    });

    it('should calculate cancellation rate correctly', async () => {
      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 100 }],
        totalPrice: 100,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'cancelled'
      });

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/sales/detailed-metrics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.totalOrders).toBe(2);
      expect(response.body.cancelledOrders).toBe(1);
      expect(parseFloat(response.body.cancellationRate)).toBe(50.0);
    });
  });

  // ========================================
  // REFUND MANAGEMENT TESTS
  // ========================================

  describe('GET /api/sales/refunds', () => {
    beforeEach(async () => {
      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 2, price: 100 }],
        totalPrice: 200,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });

      testRefund = await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 100,
        reason: 'Defective product',
        status: 'pending'
      });
    });

    it('should retrieve all refunds', async () => {
      const response = await request(app)
        .get('/api/sales/refunds')
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('pending');
    });

    it('should filter refunds by status', async () => {
      await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 100,
        reason: 'Changed mind',
        status: 'approved'
      });

      const response = await request(app)
        .get('/api/sales/refunds')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('pending');
    });
  });

  describe('GET /api/sales/refunds/statistics', () => {
    beforeEach(async () => {
      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 2, price: 100 }],
        totalPrice: 200,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });

      await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 100,
        status: 'pending'
      });

      await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 50,
        status: 'approved'
      });
    });

    it('should return refund statistics', async () => {
      const response = await request(app)
        .get('/api/sales/refunds/statistics')
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.byStatus.pending).toBe(1);
      expect(response.body.byStatus.approved).toBe(1);
      expect(response.body.totalRefundAmount).toBe(50);
    });
  });

  describe('PATCH /api/sales/refunds/:id/approve', () => {
    beforeEach(async () => {
      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [{
          product: testProduct._id,
          quantity: 2,
          price: 100,
          refundedQuantity: 0,
          refunded: false
        }],
        totalPrice: 200,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });

      testRefund = await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 100,
        status: 'pending'
      });
    });

    it('should approve refund and update inventory', async () => {
      const initialStock = testProduct.quantityInStock;

      const response = await request(app)
        .patch(`/api/sales/refunds/${testRefund._id}/approve`)
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('approved successfully');

      // Check refund status updated
      const updatedRefund = await Refund.findById(testRefund._id);
      expect(updatedRefund.status).toBe('approved');
      expect(updatedRefund.reviewedBy.toString()).toBe(salesManagerId.toString());

      // Check inventory updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.quantityInStock).toBe(initialStock + 1);
    });

    it('should prevent approving already processed refund', async () => {
      testRefund.status = 'approved';
      await testRefund.save();

      const response = await request(app)
        .patch(`/api/sales/refunds/${testRefund._id}/approve`)
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already approved');
    });
  });

  describe('PATCH /api/sales/refunds/:id/reject', () => {
    beforeEach(async () => {
      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 2, price: 100 }],
        totalPrice: 200,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });

      testRefund = await Refund.create({
        order: testOrder._id,
        user: testUser._id,
        product: testProduct._id,
        quantity: 1,
        refundAmount: 100,
        status: 'pending'
      });
    });

    it('should reject refund with reason', async () => {
      const response = await request(app)
        .patch(`/api/sales/refunds/${testRefund._id}/reject`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({ rejectionReason: 'Outside return window' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rejected');

      const updatedRefund = await Refund.findById(testRefund._id);
      expect(updatedRefund.status).toBe('rejected');
      expect(updatedRefund.rejectionReason).toBe('Outside return window');
    });

    it('should require rejection reason', async () => {
      const response = await request(app)
        .patch(`/api/sales/refunds/${testRefund._id}/reject`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Rejection reason is required');
    });
  });

  // ========================================
  // INVOICE RETRIEVAL TESTS
  // ========================================

  describe('GET /api/sales/invoices', () => {
    beforeEach(async () => {
      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 100 }],
        totalPrice: 100,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered'
      });
    });

    it('should retrieve invoices within date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/sales/invoices')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
