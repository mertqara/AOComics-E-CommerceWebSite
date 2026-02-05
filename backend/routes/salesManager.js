const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Refund = require('../models/Refund');
const auth = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');
// Import email notification service
const { notifyWishlistUsers, sendRefundApprovalEmail, sendRefundRejectionEmail } = require('../utils/emailService');


// Apply discount to products AND send email notifications

router.post('/discount', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { productIds, discountPercentage } = req.body;

    const updatedProducts = [];
    // Track email notification results
    const emailResults = {
      totalProducts: 0,
      totalEmailsSent: 0,
      totalEmailsFailed: 0,
      details: []
    };

    for (let id of productIds) {
      const product = await Product.findById(id);
      if (product) {
        // Apply discount
        product.originalPrice = product.originalPrice || product.price;
        product.price = Math.round(product.originalPrice * (1 - discountPercentage / 100) * 100) / 100;
        product.discount = discountPercentage;
        await product.save();
        updatedProducts.push(product);

        // Find users who have this product in wishlist
        const usersWithProductInWishlist = await User.find({
          wishlist: id
        }).select('name email');

        if (usersWithProductInWishlist.length > 0) {
          // Send email notifications
          const result = await notifyWishlistUsers(product, usersWithProductInWishlist);

          emailResults.totalProducts++;
          emailResults.totalEmailsSent += result.sent;
          emailResults.totalEmailsFailed += result.failed;
          emailResults.details.push({
            productName: product.name,
            usersNotified: usersWithProductInWishlist.length,
            emailsSent: result.sent,
            emailsFailed: result.failed
          });
        }
      }
    }

    res.json({
      message: 'Discount applied successfully',
      products: updatedProducts,
      // Include email notification results in response
      emailNotifications: emailResults
    });
  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ message: 'Error applying discount' });
  }
});


// Set product price
router.patch('/set-price/:productId', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { productId } = req.params;
    const { price } = req.body;

    if (!price || price <= 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update the price
    product.price = parseFloat(price);
    // If there was a discount, clear it since we're setting a new base price
    product.originalPrice = parseFloat(price);
    product.discount = 0;

    await product.save();

    res.json({
      message: 'Price updated successfully',
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice
      }
    });
  } catch (error) {
    console.error('Error setting price:', error);
    res.status(500).json({ message: 'Error setting price' });
  }
});

// Remove discount from products

router.post('/undiscount', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { productIds } = req.body;
    const updatedProducts = [];

    for (let id of productIds) {
      const product = await Product.findById(id);

      if (product && product.originalPrice) {
        product.price = product.originalPrice;
        product.discountApplied = 0;
        await product.save();
        updatedProducts.push(product);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Discounts removed and original prices restored.',
      count: updatedProducts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error while removing discounts.',
      error: error.message
    });
  }
});


// Get invoices by date range

router.get('/invoices', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const orders = await Order.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).populate('user', 'name email').populate('orderItems.product');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices' });
  }
});


// Calculate revenue and profit

router.get('/analytics', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const orders = await Order.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $ne: 'cancelled' }
    }).populate('orderItems.product');

    let revenue = 0;
    let cost = 0;

    orders.forEach(order => {
      revenue += order.totalPrice;
      order.orderItems.forEach(item => {
        const itemCost = (item.price * 0.5) * item.quantity;
        cost += itemCost;
      });
    });

    const profit = revenue - cost;


    // Include orderCount and averageOrderValue in response
    res.json({
      revenue,
      cost,
      profit,
      orderCount: orders.length,
      averageOrderValue: orders.length > 0 ? revenue / orders.length : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating analytics' });
  }


});

// ============================================
// GET /api/sales/detailed-metrics
// Get detailed sales metrics (top products, categories, etc.)
// ============================================
router.get('/detailed-metrics', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get all orders (both successful and cancelled for comparison)
    const allOrders = await Order.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).populate('orderItems.product');

    const successfulOrders = allOrders.filter(order => order.status !== 'cancelled');
    const cancelledOrders = allOrders.filter(order => order.status === 'cancelled');

    // 1. Aggregate product sales
    const productStats = {};
    let totalItemsSold = 0;

    successfulOrders.forEach(order => {
      order.orderItems.forEach(item => {
        if (item.product) {
          const productId = item.product._id.toString();
          totalItemsSold += item.quantity;

          if (!productStats[productId]) {
            productStats[productId] = {
              name: item.product.name,
              category: item.product.category,
              quantitySold: 0,
              revenue: 0
            };
          }

          productStats[productId].quantitySold += item.quantity;
          productStats[productId].revenue += item.price * item.quantity;
        }
      });
    });

    // 2. Top 5 selling products by quantity
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    // 3. Revenue by category
    const categoryRevenue = {};
    Object.values(productStats).forEach(product => {
      if (!categoryRevenue[product.category]) {
        categoryRevenue[product.category] = 0;
      }
      categoryRevenue[product.category] += product.revenue;
    });

    // Convert to array and sort
    const categoryBreakdown = Object.entries(categoryRevenue)
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // 4. Cancellation metrics
    const cancellationRate = allOrders.length > 0
      ? (cancelledOrders.length / allOrders.length) * 100
      : 0;

    res.json({
      topProducts,
      categoryBreakdown,
      totalItemsSold,
      totalOrders: allOrders.length,
      successfulOrders: successfulOrders.length,
      cancelledOrders: cancelledOrders.length,
      cancellationRate: cancellationRate.toFixed(1)
    });
  } catch (error) {
    console.error('Error calculating detailed metrics:', error);
    res.status(500).json({ message: 'Error calculating detailed metrics' });
  }
});

// ============================================
// REFUND MANAGEMENT
// ============================================

// Get all refund requests
router.get('/refunds', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { status } = req.query;

    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const refunds = await Refund.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name imageUrl price')
      .populate('order', 'createdAt deliveryCompletedAt')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(refunds);
  } catch (error) {
    console.error('Get refunds error:', error);
    res.status(500).json({ message: 'Server error while fetching refunds' });
  }
});

// Get refund statistics
router.get('/refunds/statistics', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      Refund.countDocuments(),
      Refund.countDocuments({ status: 'pending' }),
      Refund.countDocuments({ status: 'approved' }),
      Refund.countDocuments({ status: 'rejected' })
    ]);

    // Calculate total refund amount
    const approvedRefunds = await Refund.find({ status: 'approved' });
    const totalRefundAmount = approvedRefunds.reduce((sum, refund) => sum + refund.refundAmount, 0);

    res.json({
      total,
      byStatus: {
        pending,
        approved,
        rejected
      },
      totalRefundAmount
    });
  } catch (error) {
    console.error('Get refund statistics error:', error);
    res.status(500).json({ message: 'Server error while fetching statistics' });
  }
});

// Approve refund
router.patch('/refunds/:id/approve', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id)
      .populate('user', 'name email')
      .populate('product', 'name')
      .populate('order');

    if (!refund) {
      return res.status(404).json({ message: 'Refund request not found' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        message: `Refund already ${refund.status}`
      });
    }

    // Check 30-day window from delivery
    const deliveryDate = refund.order.deliveryCompletedAt;
    if (!deliveryDate) {
      return res.status(400).json({ message: 'Delivery date not found' });
    }

    const daysSinceDelivery = Math.floor((Date.now() - deliveryDate) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 30) {
      return res.status(400).json({
        message: 'Cannot approve refund. The 30-day refund window has expired.'
      });
    }

    // Update refund status
    refund.status = 'approved';
    refund.reviewedBy = req.user.id;
    refund.reviewedAt = new Date();
    await refund.save();

    // Add product back to stock
    const product = await Product.findById(refund.product._id);
    if (product) {
      product.quantityInStock += refund.quantity;
      await product.save();
    }

    // Update order item to mark as refunded
    const order = await Order.findById(refund.order._id);
    if (order) {
      const orderItem = order.orderItems.find(
        item => item.product.toString() === refund.product._id.toString()
      );

      if (orderItem) {
        orderItem.refundedQuantity = (orderItem.refundedQuantity || 0) + refund.quantity;
        if (orderItem.refundedQuantity >= orderItem.quantity) {
          orderItem.refunded = true;
        }
        await order.save();
      }
    }

    // Send email notification to customer
    try {
      await sendRefundApprovalEmail(
        refund.user.email,
        refund.user.name,
        refund.product.name,
        refund.quantity,
        refund.refundAmount
      );
    } catch (emailError) {
      console.error('Failed to send refund approval email:', emailError);
      // Don't fail the whole operation if email fails
    }

    res.json({
      message: 'Refund approved successfully. Product added back to stock. Confirmation email sent to customer.',
      refund
    });
  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(500).json({ message: 'Server error while approving refund' });
  }
});

// Reject refund
router.patch('/refunds/:id/reject', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const refund = await Refund.findById(req.params.id)
      .populate('user', 'name email')
      .populate('product', 'name');

    if (!refund) {
      return res.status(404).json({ message: 'Refund request not found' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        message: `Refund already ${refund.status}`
      });
    }

    refund.status = 'rejected';
    refund.reviewedBy = req.user.id;
    refund.reviewedAt = new Date();
    refund.rejectionReason = rejectionReason;
    await refund.save();

    // Send email notification to customer
    try {
      await sendRefundRejectionEmail(
        refund.user.email,
        refund.user.name,
        refund.product.name,
        rejectionReason
      );
    } catch (emailError) {
      console.error('Failed to send refund rejection email:', emailError);
      // Don't fail the whole operation if email fails
    }

    res.json({
      message: 'Refund rejected. Notification email sent to customer.',
      refund
    });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({ message: 'Server error while rejecting refund' });
  }
});

// Export the router

module.exports = router;
