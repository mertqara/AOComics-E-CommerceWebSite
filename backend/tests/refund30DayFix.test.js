const request = require('supertest');
const express = require('express');
const salesManagerRoutes = require('../routes/salesManager');
const Refund = require('../models/Refund');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
require('./setup');

const app = express();
app.use(express.json());
app.use('/api/sales', salesManagerRoutes);

describe('30-Day Refund Window Enforcement - Sales Manager', () => {
  let salesManager;
  let customer;
  let product;
  let managerToken;

  beforeEach(async () => {
    salesManager = await User.create({
      name: 'Sales Manager',
      email: 'manager@test.com',
      password: 'password123',
      role: 'sales_manager'
    });

    customer = await User.create({
      name: 'Customer',
      email: 'customer@test.com',
      password: 'password123',
      role: 'customer'
    });

    product = await Product.create({
      name: 'Test Comic',
      description: 'Test',
      price: 19.99,
      quantityInStock: 100,
      category: 'Marvel'
    });

    managerToken = 'manager-mock-token';
  });

  it('Should reject approval of refund for order delivered 35 days ago', async () => {
    // Create order delivered 35 days ago
    const oldOrder = await Order.create({
      user: customer._id,
      orderItems: [{
        product: product._id,
        name: 'Test Comic',
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
      deliveryCompletedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
    });

    // Create a refund request
    const refund = await Refund.create({
      order: oldOrder._id,
      user: customer._id,
      product: product._id,
      quantity: 1,
      refundAmount: 19.99,
      reason: 'Testing expired refund',
      status: 'pending'
    });

    // Try to approve it
    const response = await request(app)
      .patch(`/api/sales/refunds/${refund._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('30-day');

    // Verify refund is still pending
    const updatedRefund = await Refund.findById(refund._id);
    expect(updatedRefund.status).toBe('pending');
  });

  it('Should allow approval of refund for order delivered 25 days ago', async () => {
    // Create order delivered 25 days ago (within window)
    const validOrder = await Order.create({
      user: customer._id,
      orderItems: [{
        product: product._id,
        name: 'Test Comic',
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
      deliveryCompletedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
    });

    // Create a refund request
    const refund = await Refund.create({
      order: validOrder._id,
      user: customer._id,
      product: product._id,
      quantity: 1,
      refundAmount: 19.99,
      reason: 'Valid refund within window',
      status: 'pending'
    });

    // Try to approve it
    const response = await request(app)
      .patch(`/api/sales/refunds/${refund._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('approved');

    // Verify refund is approved
    const updatedRefund = await Refund.findById(refund._id);
    expect(updatedRefund.status).toBe('approved');
  });

  it('Should reject approval exactly on day 31', async () => {
    // Create order delivered exactly 31 days ago
    const borderlineOrder = await Order.create({
      user: customer._id,
      orderItems: [{
        product: product._id,
        name: 'Test Comic',
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

    const refund = await Refund.create({
      order: borderlineOrder._id,
      user: customer._id,
      product: product._id,
      quantity: 1,
      refundAmount: 19.99,
      reason: 'Day 31 test',
      status: 'pending'
    });

    const response = await request(app)
      .patch(`/api/sales/refunds/${refund._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('30-day');
  });

  it('Should allow approval on day 30 (boundary test)', async () => {
    // Create order delivered exactly 30 days ago
    const day30Order = await Order.create({
      user: customer._id,
      orderItems: [{
        product: product._id,
        name: 'Test Comic',
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
      deliveryCompletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const refund = await Refund.create({
      order: day30Order._id,
      user: customer._id,
      product: product._id,
      quantity: 1,
      refundAmount: 19.99,
      reason: 'Day 30 boundary test',
      status: 'pending'
    });

    const response = await request(app)
      .patch(`/api/sales/refunds/${refund._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('approved');
  });
});
