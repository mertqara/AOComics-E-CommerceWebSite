// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { encryptCreditCard, decryptCreditCard, maskCreditCard } = require('../utils/encryption');
const { sendOrderConfirmation } = require('../services/emailService');

// Import auth middleware
let auth;
try {
  const authModule = require('../middleware/auth');
  auth = authModule.auth || authModule.default || authModule;
} catch (error) {
  console.error('Auth middleware not found:', error);
  auth = (req, res, next) => {
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
}

// ==================== CREATE ORDER ====================
// POST /orders
router.post('/', auth, async (req, res) => {
  try {
    const { orderItems, totalPrice, deliveryAddress, paymentInfo } = req.body;

    // Validate required fields
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    if (!paymentInfo || !paymentInfo.creditCardNumber || !paymentInfo.cardHolderName || !paymentInfo.expiryDate) {
      return res.status(400).json({ message: 'Payment information is required' });
    }

    // Validate credit card number format (basic validation)
    const cleanCardNumber = paymentInfo.creditCardNumber.replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(cleanCardNumber)) {
      return res.status(400).json({ message: 'Invalid credit card number' });
    }

    // Encrypt credit card number before saving
    const encryptedCardNumber = encryptCreditCard(paymentInfo.creditCardNumber);

    // Verify products exist and have enough stock
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      if (product.quantityInStock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.quantityInStock}` 
        });
      }
    }

    // Create order with encrypted credit card
    const order = new Order({
      user: req.user.id,
      orderItems,
      totalPrice,
      deliveryAddress,
      paymentInfo: {
        creditCardNumber: encryptedCardNumber,
        cardHolderName: paymentInfo.cardHolderName,
        expiryDate: paymentInfo.expiryDate
      }
    });

    await order.save();

    // Update product stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantityInStock: -item.quantity } }
      );
    }

    // Populate product details
    await order.populate('orderItems.product');

    // Create invoice automatically
    try {
      const user = await User.findById(req.user.id);

      // Calculate invoice items with totals
      const invoiceItems = order.orderItems.map(item => ({
        product: item.product._id,
        name: item.product?.name || item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price
      }));

      // Calculate subtotal
      const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

      // Calculate tax (18% VAT)
      const tax = subtotal * 0.18;

      // Total amount
      const totalAmount = subtotal + tax;

      // Create invoice
      const invoice = new Invoice({
        order: order._id,
        customer: user._id,
        customerInfo: {
          name: user.name,
          email: user.email,
          address: order.deliveryAddress,
          taxID: user.taxID || ''
        },
        items: invoiceItems,
        subtotal,
        discount: 0,
        tax,
        totalAmount,
        invoiceDate: order.createdAt,
        status: 'paid'
      });

      await invoice.save();
      console.log('✅ Invoice created automatically:', invoice.invoiceNumber);

    } catch (invoiceError) {
      // Don't fail the order if invoice creation fails
      console.error('⚠️ Invoice creation error (order still created):', invoiceError);
    }

    // Send confirmation email
    try {
      const user = await User.findById(req.user.id);
      if (user && user.email) {
        const emailData = {
          orderId: order._id,
          orderItems: order.orderItems.map(item => ({
            name: item.product?.name || item.name,
            quantity: item.quantity,
            price: item.price
          })),
          totalPrice: order.totalPrice,
          deliveryAddress: order.deliveryAddress,
          createdAt: order.createdAt
        };

        const emailResult = await sendOrderConfirmation(user.email, emailData);

        if (emailResult.success) {
          console.log('✅ Order confirmation email sent to:', user.email);
        } else {
          console.error('⚠️ Failed to send email, but order was created');
        }
      }
    } catch (emailError) {
      // Don't fail the order if email fails
      console.error('Email error (order still created):', emailError);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== GET USER'S ORDERS ====================
// GET /orders/my-orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('orderItems.product')
      .sort({ createdAt: -1 });

    // For better UX: include pending refund information per order item
    const orderIds = orders.map(o => o._id);

    // Fetch pending/approved refunds by this user for these orders
    const Refund = require('../models/Refund');
    const refunds = await Refund.find({
      order: { $in: orderIds },
      user: req.user.id,
      status: { $in: ['pending', 'approved'] }
    });

    // Build lookup of pending quantities per orderId+productId
    const pendingMap = {};
    for (const r of refunds) {
      const key = `${r.order.toString()}_${r.product.toString()}`;
      pendingMap[key] = (pendingMap[key] || 0) + (r.quantity || 0);
    }

    // Mask credit card numbers before sending to client
    const ordersWithMaskedCards = orders.map(order => {
      const orderObj = order.toObject();

      if (orderObj.paymentInfo && orderObj.paymentInfo.creditCardNumber) {
        // Decrypt and then mask
        const decrypted = decryptCreditCard(orderObj.paymentInfo.creditCardNumber);
        orderObj.paymentInfo.creditCardNumber = maskCreditCard(decrypted);
      }

      // Attach pendingRefundQuantity and availableForRefund to each order item
      orderObj.orderItems = orderObj.orderItems.map(item => {
        const prodId = item.product && item.product._id ? item.product._id : item.product;
        const key = `${orderObj._id}_${prodId}`;
        const pendingQty = pendingMap[key] || 0;
        const refundedQty = item.refundedQuantity || 0;
        const available = (item.quantity || 0) - refundedQty - pendingQty;
        return {
          ...item,
          pendingRefundQuantity: pendingQty,
          availableForRefund: available
        };
      });

      return orderObj;
    });

    res.json({ orders: ordersWithMaskedCards });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== GET SINGLE ORDER BY ID ====================
// GET /orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('orderItems.product')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify user owns this order (or is admin/product_manager)
    const user = await User.findById(req.user.id);
    const isOwner = order.user._id.toString() === req.user.id;
    const isAuthorized = user.role === 'admin' || user.role === 'product_manager';

    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const orderObj = order.toObject();
    
    // Mask credit card number
    if (orderObj.paymentInfo && orderObj.paymentInfo.creditCardNumber) {
      const decrypted = decryptCreditCard(orderObj.paymentInfo.creditCardNumber);
      orderObj.paymentInfo.creditCardNumber = maskCreditCard(decrypted);
    }

    res.json({ order: orderObj });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== GET ALL ORDERS (ADMIN/PRODUCT MANAGER) ====================
// GET /orders
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin or product_manager
    const user = await User.findById(req.user.id);
    if (!user || (user.role !== 'product_manager' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const orders = await Order.find()
      .populate('orderItems.product')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    // Mask credit card numbers
    const ordersWithMaskedCards = orders.map(order => {
      const orderObj = order.toObject();
      
      if (orderObj.paymentInfo && orderObj.paymentInfo.creditCardNumber) {
        const decrypted = decryptCreditCard(orderObj.paymentInfo.creditCardNumber);
        orderObj.paymentInfo.creditCardNumber = maskCreditCard(decrypted);
      }
      
      return orderObj;
    });

    res.json({ orders: ordersWithMaskedCards });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== UPDATE ORDER STATUS (PRODUCT MANAGER) ====================
// PUT /orders/:id/status
router.put('/:id/status', auth, async (req, res) => {
  try {
    // Check if user is product_manager or admin
    const user = await User.findById(req.user.id);
    if (!user || (user.role !== 'product_manager' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Access denied. Only product managers can update order status.' });
    }

    const { status } = req.body;

    // Validate status
    const validStatuses = ['processing', 'in-transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id)
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update status
    order.status = status;

    // If order is being marked as delivered, set deliveryCompletedAt timestamp
    if (status === 'delivered' && !order.deliveryCompletedAt) {
      order.deliveryCompletedAt = new Date();
    }

    await order.save();

    res.json({ 
      message: 'Order status updated', 
      order 
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== CANCEL ORDER ====================
// PUT /orders/:id/cancel
// CS 308 Requirement 14: Orders can only be cancelled if status is "processing"
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('orderItems.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Verify user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }
    
    // Validate status - ONLY processing orders can be cancelled
    if (order.status !== 'processing') {
      return res.status(400).json({ 
        message: `Cannot cancel order. Order is already ${order.status}. Only orders with "processing" status can be cancelled.`,
        currentStatus: order.status
      });
    }
    
    // Update status to cancelled
    order.status = 'cancelled';
    await order.save();
    
    // Restore stock (add products back to inventory)
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { quantityInStock: item.quantity } }
      );
      console.log(`✅ Restored ${item.quantity} units of ${item.product.name} to stock`);
    }
    
    res.json({ 
      message: 'Order cancelled successfully. Stock has been restored.',
      order 
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;