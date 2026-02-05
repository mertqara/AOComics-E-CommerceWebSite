const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const invoiceRoutes = require('../routes/invoices');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

let mongoServer;
let app;
let customerToken;
let salesManagerToken;
let customerId;
let salesManagerId;
let testProduct;
let testOrder;

// Setup Express app for testing
const setupApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/invoices', invoiceRoutes);
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

  // Create test customer
  const customer = await User.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: 'password123',
    role: 'customer',
    taxID: 'TAX123456'
  });
  customerId = customer._id;
  customerToken = generateToken(customerId, 'customer');

  // Create test sales manager
  const salesManager = await User.create({
    name: 'Test Sales Manager',
    email: 'salesmanager@test.com',
    password: 'password123',
    role: 'sales_manager'
  });
  salesManagerId = salesManager._id;
  salesManagerToken = generateToken(salesManagerId, 'sales_manager');

  // Create test product
  testProduct = await Product.create({
    name: 'Invoice Test Comic',
    description: 'Comic for invoice testing',
    price: 100,
    quantityInStock: 50,
    category: 'Marvel',
    serialNumber: 'INV-001',
    model: 'Invoice Model'
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Create a fresh test order before each test
  testOrder = await Order.create({
    user: customerId,
    orderItems: [
      {
        product: testProduct._id,
        name: testProduct.name,
        quantity: 2,
        price: 100
      }
    ],
    totalPrice: 200,
    deliveryAddress: '123 Test Street, Test City',
    paymentInfo: {
      creditCardNumber: 'encrypted-card-number',
      cardholderName: 'Test Customer',
      expiryDate: '12/25'
    },
    status: 'processing'
  });
});

afterEach(async () => {
  // Clean up invoices and orders after each test
  await Invoice.deleteMany({});
  await Order.deleteMany({});
});

describe('Invoice Routes', () => {

  // ========================================
  // INVOICE CREATION TESTS
  // ========================================

  describe('POST /api/invoices', () => {
    it('should create invoice from order successfully', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Invoice created successfully');
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.order).toBe(testOrder._id.toString());
      expect(response.body.invoice.customer).toBe(customerId.toString());
      expect(response.body.invoice.subtotal).toBe(200);
      expect(response.body.invoice.tax).toBe(36); // 18% of 200
      expect(response.body.invoice.totalAmount).toBe(236); // 200 + 36
    });

    it('should calculate invoice items correctly', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(201);
      expect(response.body.invoice.items).toHaveLength(1);
      expect(response.body.invoice.items[0].quantity).toBe(2);
      expect(response.body.invoice.items[0].price).toBe(100);
      expect(response.body.invoice.items[0].total).toBe(200);
    });

    it('should include customer information in invoice', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(201);
      expect(response.body.invoice.customerInfo.name).toBe('Test Customer');
      expect(response.body.invoice.customerInfo.email).toBe('customer@test.com');
      expect(response.body.invoice.customerInfo.address).toBe('123 Test Street, Test City');
      expect(response.body.invoice.customerInfo.taxID).toBe('TAX123456');
    });

    it('should prevent duplicate invoice creation for same order', async () => {
      // Create first invoice
      await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invoice already exists');
    });

    it('should reject request without order ID', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Order ID is required');
    });

    it('should reject request for non-existent order', async () => {
      const fakeOrderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: fakeOrderId });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Order not found');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(401);
    });

    it('should set invoice status to paid by default', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(201);
      expect(response.body.invoice.status).toBe('paid');
    });
  });

  // ========================================
  // INVOICE RETRIEVAL TESTS
  // ========================================

  describe('GET /api/invoices', () => {
    beforeEach(async () => {
      // Create test invoices
      await Invoice.create({
        invoiceNumber: 'INV-2024-001',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 2, price: 100, total: 200 }],
        subtotal: 200,
        tax: 36,
        totalAmount: 236,
        invoiceDate: new Date('2024-01-15'),
        status: 'paid'
      });

      await Invoice.create({
        invoiceNumber: 'INV-2024-002',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 1, price: 100, total: 100 }],
        subtotal: 100,
        tax: 18,
        totalAmount: 118,
        invoiceDate: new Date('2024-02-20'),
        status: 'paid'
      });
    });

    it('should retrieve all invoices for sales manager', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should filter invoices by date range', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: '2024-02-01',
          endDate: '2024-02-28'
        });

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].invoiceNumber).toBe('INV-2024-002');
    });

    it('should sort invoices by date descending', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body[0].invoiceNumber).toBe('INV-2024-002'); // Most recent first
    });

    it('should reject request from non-sales manager', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/invoices/:id', () => {
    let testInvoice;

    beforeEach(async () => {
      testInvoice = await Invoice.create({
        invoiceNumber: 'INV-2024-003',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 2, price: 100, total: 200 }],
        subtotal: 200,
        tax: 36,
        totalAmount: 236,
        status: 'paid'
      });
    });

    it('should retrieve single invoice by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoice._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invoiceNumber).toBe('INV-2024-003');
      expect(response.body.totalAmount).toBe(236);
    });

    it('should retrieve invoice for sales manager', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoice._id}`)
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invoiceNumber).toBe('INV-2024-003');
    });

    it('should reject access to other customer invoices', async () => {
      const otherCustomer = await User.create({
        name: 'Other Customer',
        email: 'other@test.com',
        password: 'password123',
        role: 'customer'
      });
      const otherCustomerToken = generateToken(otherCustomer._id, 'customer');

      const response = await request(app)
        .get(`/api/invoices/${testInvoice._id}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Not authorized');

      await otherCustomer.deleteOne();
    });

    it('should return 404 for non-existent invoice', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/invoices/${fakeId}`)
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Invoice not found');
    });
  });

  describe('GET /api/invoices/order/:orderId', () => {
    let testInvoice;

    beforeEach(async () => {
      testInvoice = await Invoice.create({
        invoiceNumber: 'INV-2024-004',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 2, price: 100, total: 200 }],
        subtotal: 200,
        tax: 36,
        totalAmount: 236,
        status: 'paid'
      });
    });

    it('should retrieve invoice by order ID for owner', async () => {
      const response = await request(app)
        .get(`/api/invoices/order/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order._id).toBe(testOrder._id.toString());
      expect(response.body.invoiceNumber).toBe('INV-2024-004');
    });

    it('should retrieve invoice by order ID for sales manager', async () => {
      const response = await request(app)
        .get(`/api/invoices/order/${testOrder._id}`)
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invoiceNumber).toBe('INV-2024-004');
    });

    it('should return 404 if no invoice exists for order', async () => {
      const newOrder = await Order.create({
        user: customerId,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 100 }],
        totalPrice: 100,
        deliveryAddress: '456 Test Ave',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test',
          expiryDate: '12/25'
        },
        status: 'processing'
      });

      const response = await request(app)
        .get(`/api/invoices/order/${newOrder._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Invoice not found');

      await newOrder.deleteOne();
    });
  });

  // ========================================
  // INVOICE STATUS UPDATE TESTS
  // ========================================

  describe('PATCH /api/invoices/:id/status', () => {
    let testInvoice;

    beforeEach(async () => {
      testInvoice = await Invoice.create({
        invoiceNumber: 'INV-2024-005',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 2, price: 100, total: 200 }],
        subtotal: 200,
        tax: 36,
        totalAmount: 236,
        status: 'paid'
      });
    });

    it('should update invoice status to cancelled', async () => {
      const response = await request(app)
        .patch(`/api/invoices/${testInvoice._id}/status`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Invoice status updated');
      expect(response.body.invoice.status).toBe('cancelled');
    });

    it('should update invoice status to draft', async () => {
      const response = await request(app)
        .patch(`/api/invoices/${testInvoice._id}/status`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({ status: 'draft' });

      expect(response.status).toBe(200);
      expect(response.body.invoice.status).toBe('draft');
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .patch(`/api/invoices/${testInvoice._id}/status`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid status');
    });

    it('should reject request from non-sales manager', async () => {
      const response = await request(app)
        .patch(`/api/invoices/${testInvoice._id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent invoice', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/invoices/${fakeId}/status`)
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(404);
    });
  });

  // ========================================
  // INVOICE STATISTICS TESTS
  // ========================================

  describe('GET /api/invoices/stats/summary', () => {
    beforeEach(async () => {
      await Invoice.create({
        invoiceNumber: 'INV-2024-006',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 2, price: 100, total: 200 }],
        subtotal: 200,
        tax: 36,
        totalAmount: 236,
        invoiceDate: new Date('2024-01-15'),
        status: 'paid'
      });

      await Invoice.create({
        invoiceNumber: 'INV-2024-007',
        order: testOrder._id,
        customer: customerId,
        customerInfo: {
          name: 'Test Customer',
          email: 'customer@test.com',
          address: '123 Test Street',
          taxID: 'TAX123456'
        },
        items: [{ product: testProduct._id, name: 'Test Comic', quantity: 1, price: 100, total: 100 }],
        subtotal: 100,
        tax: 18,
        totalAmount: 118,
        invoiceDate: new Date('2024-01-20'),
        status: 'cancelled'
      });
    });

    it('should return invoice statistics', async () => {
      const response = await request(app)
        .get('/api/invoices/stats/summary')
        .set('Authorization', `Bearer ${salesManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalInvoices).toBe(2);
      expect(response.body.totalRevenue).toBe(354); // 236 + 118
      expect(response.body.totalTax).toBe(54); // 36 + 18
      expect(response.body.paidInvoices).toBe(1);
      expect(response.body.cancelledInvoices).toBe(1);
    });

    it('should filter statistics by date range', async () => {
      const response = await request(app)
        .get('/api/invoices/stats/summary')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-16'
        });

      expect(response.status).toBe(200);
      expect(response.body.totalInvoices).toBe(1);
      expect(response.body.totalRevenue).toBe(236);
    });

    it('should reject request from non-sales manager', async () => {
      const response = await request(app)
        .get('/api/invoices/stats/summary')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ========================================
  // TAX CALCULATION TESTS
  // ========================================

  describe('Tax Calculation', () => {
    it('should calculate 18% tax correctly for single item', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: testOrder._id });

      expect(response.status).toBe(201);
      const subtotal = 200;
      const expectedTax = subtotal * 0.18;
      expect(response.body.invoice.tax).toBe(expectedTax);
    });

    it('should calculate tax correctly for multiple items', async () => {
      const multiItemOrder = await Order.create({
        user: customerId,
        orderItems: [
          { product: testProduct._id, name: 'Comic 1', quantity: 3, price: 50 },
          { product: testProduct._id, name: 'Comic 2', quantity: 2, price: 75 }
        ],
        totalPrice: 300,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test',
          expiryDate: '12/25'
        },
        status: 'processing'
      });

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: multiItemOrder._id });

      expect(response.status).toBe(201);
      expect(response.body.invoice.subtotal).toBe(300);
      expect(response.body.invoice.tax).toBe(54); // 18% of 300
      expect(response.body.invoice.totalAmount).toBe(354);

      await multiItemOrder.deleteOne();
    });
  });
});
