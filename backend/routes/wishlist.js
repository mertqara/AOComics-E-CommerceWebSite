// backend/routes/wishlist_with_email.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { notifyWishlistUsers } = require('../utils/emailService');

// ============================================
// GET /api/wishlist - Get user's wishlist
// ============================================
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ wishlist: user.wishlist });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// POST /api/wishlist/add - Add product to wishlist
// ============================================
router.post('/add', auth, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    user.wishlist.push(productId);
    await user.save();
    await user.populate('wishlist');

    res.json({
      message: 'Product added to wishlist',
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// DELETE /api/wishlist/remove/:productId - Remove product from wishlist
// ============================================
router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.wishlist.includes(productId)) {
      return res.status(400).json({ message: 'Product not in wishlist' });
    }

    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();
    await user.populate('wishlist');

    res.json({
      message: 'Product removed from wishlist',
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// DELETE /api/wishlist/clear - Clear entire wishlist
// ============================================
router.delete('/clear', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.wishlist = [];
    await user.save();

    res.json({
      message: 'Wishlist cleared',
      wishlist: []
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// GET /api/wishlist/count - Get wishlist item count
// ============================================
//1
router.get('/count', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ count: user.wishlist.length });
  } catch (error) {
    console.error('Get wishlist count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//2
// ============================================
// POST /api/wishlist/notify-discount/:productId
// Notify all users who have this product in wishlist about a discount
// ============================================
router.post('/notify-discount/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product has a discount
    if (!product.originalPrice || product.originalPrice <= product.price) {
      return res.status(400).json({ message: 'Product does not have an active discount' });
    }

    // Find all users who have this product in their wishlist
    const users = await User.find({
      wishlist: productId
    }).select('name email');

    if (users.length === 0) {
      return res.json({
        message: 'No users have this product in their wishlist',
        emailsSent: 0
      });
    }

    // Send email notifications
    const results = await notifyWishlistUsers(product, users);

    res.json({
      message: 'Discount notifications sent',
      emailsSent: results.sent,
      emailsFailed: results.failed,
      totalUsers: users.length,
      errors: results.errors
    });
  } catch (error) {
    console.error('Notify discount error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
