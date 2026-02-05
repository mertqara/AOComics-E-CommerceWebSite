// backend/routes/refunds.js
const express = require('express');
const router = express.Router();
const Refund = require('../models/Refund');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// ========================================
// CUSTOMER ROUTES
// ========================================

// Get user's refund requests
router.get('/my-refunds', async (req, res) => {
  try {
    const refunds = await Refund.find({ user: req.user.id })
      .populate('product', 'name imageUrl')
      .populate('order', 'createdAt deliveryCompletedAt')
      .sort({ createdAt: -1 });

    res.json(refunds);
  } catch (error) {
    console.error('Get refunds error:', error);
    res.status(500).json({ message: 'Server error while fetching refunds' });
  }
});

// Get eligible products for refund (from specific order)
router.get('/eligible-products/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    }).populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({
        message: 'Only delivered orders are eligible for refunds'
      });
    }

    // Check 30-day window from delivery
    const deliveryDate = order.deliveryCompletedAt;
    if (!deliveryDate) {
      return res.status(400).json({ message: 'Delivery date not found' });
    }

    const daysSinceDelivery = Math.floor((Date.now() - deliveryDate) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 30) {
      return res.status(400).json({
        message: 'Refund window expired. Products can only be returned within 30 days of delivery.'
      });
    }

    // Filter eligible items (not fully refunded)
    const eligibleItems = order.orderItems.filter(item => {
      const remainingQuantity = item.quantity - (item.refundedQuantity || 0);
      return remainingQuantity > 0;
    });

    res.json({
      order: {
        _id: order._id,
        createdAt: order.createdAt,
        deliveryCompletedAt: order.deliveryCompletedAt,
        daysSinceDelivery
      },
      eligibleItems: eligibleItems.map(item => ({
        product: item.product,
        orderedQuantity: item.quantity,
        refundedQuantity: item.refundedQuantity || 0,
        availableForRefund: item.quantity - (item.refundedQuantity || 0),
        price: item.price
      }))
    });
  } catch (error) {
    console.error('Get eligible products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request refund
router.post('/request', async (req, res) => {
  try {
    const { orderId, productId, quantity, reason } = req.body;

    // Validate input
    if (!orderId || !productId || !quantity || !reason) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find order
    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id
    }).populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({
        message: 'Only delivered orders are eligible for refunds'
      });
    }

    // Check 30-day window
    const deliveryDate = order.deliveryCompletedAt;
    if (!deliveryDate) {
      return res.status(400).json({ message: 'Delivery date not found' });
    }

    const daysSinceDelivery = Math.floor((Date.now() - deliveryDate) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 30) {
      return res.status(400).json({
        message: 'Refund window expired. Products can only be returned within 30 days of delivery.'
      });
    }

    // Find product in order
    const orderItem = order.orderItems.find(
      item => item.product._id.toString() === productId
    );

    if (!orderItem) {
      return res.status(404).json({ message: 'Product not found in order' });
    }

    // Check available quantity for refund
    const refundedQuantity = orderItem.refundedQuantity || 0;
    const availableQuantity = orderItem.quantity - refundedQuantity;

    if (quantity > availableQuantity) {
      return res.status(400).json({
        message: `Only ${availableQuantity} units available for refund`
      });
    }

    // Prevent duplicate pending/approved refund requests for same order/product by same user
    const existing = await Refund.findOne({
      order: orderId,
      product: productId,
      user: req.user.id,
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      return res.status(400).json({ message: 'A refund request for this item already exists' });
    }

    // Calculate refund amount (uses the price paid during purchase)
    const refundAmount = orderItem.price * quantity;

    // Create refund request
    const refund = new Refund({
      order: orderId,
      user: req.user.id,
      product: productId,
      quantity,
      refundAmount,
      reason
    });

    await refund.save();

    res.status(201).json({
      message: 'Refund request submitted successfully',
      refund
    });
  } catch (error) {
    console.error('Request refund error:', error);
    res.status(500).json({ message: 'Server error while requesting refund' });
  }
});

module.exports = router;
