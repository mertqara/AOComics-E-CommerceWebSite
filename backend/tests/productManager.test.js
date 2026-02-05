const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const productManagerRoutes = require('../routes/productManager');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

let mongoServer;
let app;
let productManagerToken;
let productManagerId;
let testCategory;
let testProduct;
let testUser;

// Setup Express app for testing
const setupApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/product-manager', productManagerRoutes);
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

  // Create test product manager user
  const productManager = await User.create({
    name: 'Test Product Manager',
    email: 'productmanager@test.com',
    password: 'password123',
    role: 'product_manager'
  });
  productManagerId = productManager._id;
  productManagerToken = generateToken(productManagerId, 'product_manager');

  // Create test customer
  testUser = await User.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: 'password123',
    role: 'customer'
  });

  // Create test category
  testCategory = await Category.create({
    name: 'Marvel',
    description: 'Marvel Comics'
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up products, orders, and reviews after each test
  await Product.deleteMany({ _id: { $ne: testProduct?._id } });
  await Order.deleteMany({});
  await Review.deleteMany({});
});

describe('Product Manager Routes', () => {

  // ========================================
  // CATEGORY MANAGEMENT TESTS
  // ========================================

  describe('GET /api/product-manager/categories', () => {
    it('should retrieve all categories', async () => {
      const response = await request(app)
        .get('/api/product-manager/categories')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/product-manager/categories');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/product-manager/categories', () => {
    it('should create a new category', async () => {
      const response = await request(app)
        .post('/api/product-manager/categories')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'DC Comics',
          description: 'DC Universe comics'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Category created successfully');
      expect(response.body.category.name).toBe('DC Comics');
    });

    it('should reject duplicate category names', async () => {
      const response = await request(app)
        .post('/api/product-manager/categories')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'Marvel',
          description: 'Duplicate category'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject empty category name', async () => {
      const response = await request(app)
        .post('/api/product-manager/categories')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: '',
          description: 'No name category'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });
  });

  describe('PUT /api/product-manager/categories/:id', () => {
    it('should update category', async () => {
      const response = await request(app)
        .put(`/api/product-manager/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'Marvel Updated',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Category updated successfully');
      expect(response.body.category.name).toBe('Marvel Updated');

      // Restore original name for other tests
      testCategory.name = 'Marvel';
      await testCategory.save();
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/product-manager/categories/${fakeId}`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'Non-existent'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/product-manager/categories/:id', () => {
    it('should delete category with no products', async () => {
      const newCategory = await Category.create({
        name: 'Temporary Category',
        description: 'Will be deleted'
      });

      const response = await request(app)
        .delete(`/api/product-manager/categories/${newCategory._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Category deleted successfully');
    });

    it('should prevent deletion of category with products', async () => {
      const product = await Product.create({
        name: 'Test Product',
        price: 100,
        category: testCategory._id,
        quantityInStock: 10,
        serialNumber: 'TEST-001',
        model: 'Test Model'
      });

      const response = await request(app)
        .delete(`/api/product-manager/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot delete category');
      expect(response.body.message).toContain('product(s) are using');

      await product.deleteOne();
    });
  });

  // ========================================
  // PRODUCT MANAGEMENT TESTS
  // ========================================

  describe('GET /api/product-manager/products', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Test Comic',
        description: 'A test comic book',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'TEST-002',
        model: 'Test Model'
      });
    });

    it('should retrieve all products', async () => {
      const response = await request(app)
        .get('/api/product-manager/products')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/product-manager/products', () => {
    it('should create a new product', async () => {
      const response = await request(app)
        .post('/api/product-manager/products')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'New Comic',
          description: 'Brand new comic',
          price: 75,
          quantityInStock: 15,
          category: testCategory._id,
          serialNumber: 'NEW-001',
          model: 'New Model'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Product created successfully');
      expect(response.body.product.name).toBe('New Comic');
      expect(response.body.product.price).toBe(75);
    });

    it('should reject product without required fields', async () => {
      const response = await request(app)
        .post('/api/product-manager/products')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          description: 'Missing name and price'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });
  });

  describe('PUT /api/product-manager/products/:id', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Original Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'ORIG-001',
        model: 'Original Model'
      });
    });

    it('should update product', async () => {
      const response = await request(app)
        .put(`/api/product-manager/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'Updated Comic',
          price: 60
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Product updated successfully');
      expect(response.body.product.name).toBe('Updated Comic');
      expect(response.body.product.price).toBe(60);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/product-manager/products/${fakeId}`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({
          name: 'Non-existent'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/product-manager/products/:id', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Deletable Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'DEL-001',
        model: 'Delete Model'
      });
    });

    it('should delete product with no active orders', async () => {
      const response = await request(app)
        .delete(`/api/product-manager/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Product deleted successfully');

      const deletedProduct = await Product.findById(testProduct._id);
      expect(deletedProduct).toBeNull();
    });

    it('should prevent deletion of product with active orders', async () => {
      await Order.create({
        user: testUser._id,
        orderItems: [{
          product: testProduct._id,
          quantity: 1,
          price: 50
        }],
        totalPrice: 50,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'processing'
      });

      const response = await request(app)
        .delete(`/api/product-manager/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot delete product');
      expect(response.body.message).toContain('active order(s)');
    });

    it('should delete associated reviews when deleting product', async () => {
      await Review.create({
        product: testProduct._id,
        user: testUser._id,
        rating: 5,
        comment: 'Great product!',
        approved: true
      });

      const response = await request(app)
        .delete(`/api/product-manager/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);

      const reviews = await Review.find({ product: testProduct._id });
      expect(reviews).toHaveLength(0);
    });
  });

  // ========================================
  // STOCK MANAGEMENT TESTS
  // ========================================

  describe('PATCH /api/product-manager/products/:id/stock', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Stock Test Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'STOCK-001',
        model: 'Stock Model'
      });
    });

    it('should update product stock', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/products/${testProduct._id}/stock`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({ quantityInStock: 100 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Stock updated successfully');
      expect(response.body.product.quantityInStock).toBe(100);
    });

    it('should reject negative stock quantity', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/products/${testProduct._id}/stock`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({ quantityInStock: -5 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Valid quantity is required');
    });
  });

  describe('GET /api/product-manager/products/low-stock', () => {
    beforeEach(async () => {
      await Product.create({
        name: 'Low Stock Comic',
        price: 50,
        quantityInStock: 5,
        category: testCategory._id,
        serialNumber: 'LOW-001',
        model: 'Low Model'
      });

      await Product.create({
        name: 'High Stock Comic',
        price: 50,
        quantityInStock: 50,
        category: testCategory._id,
        serialNumber: 'HIGH-001',
        model: 'High Model'
      });
    });

    it('should retrieve products with stock less than 10', async () => {
      const response = await request(app)
        .get('/api/product-manager/products/low-stock')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(p => p.quantityInStock < 10)).toBe(true);
    });
  });

  // ========================================
  // DELIVERY MANAGEMENT TESTS
  // ========================================

  describe('GET /api/product-manager/deliveries', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Delivery Test Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'DELIV-001',
        model: 'Delivery Model'
      });

      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 50 }],
        totalPrice: 50,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'processing'
      });
    });

    it('should retrieve all deliveries', async () => {
      const response = await request(app)
        .get('/api/product-manager/deliveries')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('deliveryId');
      expect(response.body[0]).toHaveProperty('customerName');
    });

    it('should filter deliveries by status', async () => {
      const response = await request(app)
        .get('/api/product-manager/deliveries')
        .set('Authorization', `Bearer ${productManagerToken}`)
        .query({ status: 'processing' });

      expect(response.status).toBe(200);
      expect(response.body.every(d => d.status === 'processing')).toBe(true);
    });
  });

  describe('PATCH /api/product-manager/deliveries/:id/status', () => {
    let testOrder;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Status Test Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'STAT-001',
        model: 'Status Model'
      });

      testOrder = await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 50 }],
        totalPrice: 50,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'processing'
      });
    });

    it('should update order status to in-transit', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/deliveries/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({ status: 'in-transit' });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('in-transit');
    });

    it('should mark delivery as completed when status is delivered', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/deliveries/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({ status: 'delivered' });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('delivered');
      expect(response.body.order.deliveryCompleted).toBe(true);
      expect(response.body.order.deliveryCompletedAt).toBeTruthy();
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/deliveries/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${productManagerToken}`)
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('GET /api/product-manager/statistics/deliveries', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Stats Test Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'STATS-001',
        model: 'Stats Model'
      });

      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 50 }],
        totalPrice: 50,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'processing'
      });

      await Order.create({
        user: testUser._id,
        orderItems: [{ product: testProduct._id, quantity: 1, price: 50 }],
        totalPrice: 50,
        deliveryAddress: '123 Test St',
        paymentInfo: {
          creditCardNumber: 'encrypted',
          cardholderName: 'Test User',
          expiryDate: '12/25'
        },
        status: 'delivered',
        deliveryCompleted: true
      });
    });

    it('should return delivery statistics', async () => {
      const response = await request(app)
        .get('/api/product-manager/statistics/deliveries')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body.byStatus).toHaveProperty('processing');
      expect(response.body.byStatus).toHaveProperty('delivered');
      expect(response.body.total).toBe(2);
      expect(response.body.completed).toBe(1);
    });
  });

  // ========================================
  // REVIEW MANAGEMENT TESTS
  // ========================================

  describe('GET /api/product-manager/reviews/pending', () => {
    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Review Test Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'REV-001',
        model: 'Review Model'
      });

      await Review.create({
        product: testProduct._id,
        user: testUser._id,
        rating: 5,
        comment: 'Pending review',
        approved: false
      });

      await Review.create({
        product: testProduct._id,
        user: testUser._id,
        rating: 0,
        comment: 'Rating only',
        approved: false
      });
    });

    it('should retrieve pending reviews excluding rating-only', async () => {
      const response = await request(app)
        .get('/api/product-manager/reviews/pending')
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(r => r.approved === false)).toBe(true);
      expect(response.body.every(r => r.comment !== 'Rating only')).toBe(true);
    });
  });

  describe('PATCH /api/product-manager/reviews/:id/approve', () => {
    let testReview;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Approve Review Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'APPR-001',
        model: 'Approve Model'
      });

      testReview = await Review.create({
        product: testProduct._id,
        user: testUser._id,
        rating: 4,
        comment: 'Needs approval',
        approved: false
      });
    });

    it('should approve review', async () => {
      const response = await request(app)
        .patch(`/api/product-manager/reviews/${testReview._id}/approve`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Review approved successfully');
      expect(response.body.review.approved).toBe(true);
    });
  });

  describe('DELETE /api/product-manager/reviews/:id', () => {
    let testReview;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Delete Review Comic',
        price: 50,
        quantityInStock: 20,
        category: testCategory._id,
        serialNumber: 'DELREV-001',
        model: 'Delete Review Model'
      });

      testReview = await Review.create({
        product: testProduct._id,
        user: testUser._id,
        rating: 2,
        comment: 'Bad review to reject',
        approved: false
      });
    });

    it('should reject and delete review', async () => {
      const response = await request(app)
        .delete(`/api/product-manager/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${productManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rejected and deleted');

      const deletedReview = await Review.findById(testReview._id);
      expect(deletedReview).toBeNull();
    });
  });
});
