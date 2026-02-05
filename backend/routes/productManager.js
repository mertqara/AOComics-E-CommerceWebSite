// backend/routes/productManager.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');

// All routes require authentication and product_manager role
router.use(auth);
router.use(checkRole('product_manager'));

// ========================================
// CATEGORY MANAGEMENT
// ========================================

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
});

// Add new category
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = new Category({
      name: name.trim(),
      description: description?.trim()
    });

    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error while creating category' });
  }
});

// Update category
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name: name?.trim(), description: description?.trim() },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error while updating category' });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    // Check if any products use this category
    const productsCount = await Product.countDocuments({ category: req.params.id });

    if (productsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category. ${productsCount} product(s) are using this category.`
      });
    }

    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error while deleting category' });
  }
});

// ========================================
// PRODUCT MANAGEMENT
// ========================================

// Get all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
});

// Add new product
router.post('/products', async (req, res) => {
  try {
    const productData = req.body;

    // Validate required fields
    if (!productData.name || !productData.price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error while creating product' });
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error while updating product' });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    // Check if product is in any pending/processing orders
    const ordersCount = await Order.countDocuments({
      'orderItems.product': req.params.id,
      status: { $in: ['processing', 'in-transit'] }
    });

    if (ordersCount > 0) {
      return res.status(400).json({
        message: `Cannot delete product. ${ordersCount} active order(s) contain this product.`
      });
    }

    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Also delete all reviews for this product
    await Review.deleteMany({ product: req.params.id });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error while deleting product' });
  }
});

// ========================================
// STOCK MANAGEMENT
// ========================================

// Update product stock
router.patch('/products/:id/stock', async (req, res) => {
  try {
    const { quantityInStock } = req.body;

    if (quantityInStock === undefined || quantityInStock < 0) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { quantityInStock },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Stock updated successfully',
      product
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ message: 'Server error while updating stock' });
  }
});

// Get low stock products (stock < 10)
router.get('/products/low-stock', async (req, res) => {
  try {
    const lowStockProducts = await Product.find({
      quantityInStock: { $lt: 10 }
    }).sort({ quantityInStock: 1 });

    res.json(lowStockProducts);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ message: 'Server error while fetching low stock products' });
  }
});

// ========================================
// DELIVERY MANAGEMENT
// ========================================

// Get all orders (delivery list) with filtering
router.get('/deliveries', async (req, res) => {
  try {
    const { status, completed } = req.query;

    let filter = {};
    if (status) {
      filter.status = status;
    }
    if (completed !== undefined) {
      filter.deliveryCompleted = completed === 'true';
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name imageUrl')
      .sort({ createdAt: -1 });

    // Format as delivery list - filter out orders with missing user/product data
    const deliveryList = orders
      .filter(order => order.user && order.orderItems.every(item => item.product))
      .map(order => ({
        deliveryId: order._id,
        customerId: order.user._id,
        customerName: order.user.name,
        customerEmail: order.user.email,
        products: order.orderItems.map(item => ({
          productId: item.product._id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price
        })),
        totalPrice: order.totalPrice,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
        deliveryCompleted: order.deliveryCompleted,
        deliveryCompletedAt: order.deliveryCompletedAt,
        createdAt: order.createdAt
      }));

    res.json(deliveryList);
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({ message: 'Server error while fetching deliveries' });
  }
});

// Get single delivery/order details
router.get('/deliveries/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      deliveryId: order._id,
      customerId: order.user._id,
      customerInfo: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone
      },
      products: order.orderItems,
      totalPrice: order.totalPrice,
      deliveryAddress: order.deliveryAddress,
      status: order.status,
      deliveryCompleted: order.deliveryCompleted,
      deliveryCompletedAt: order.deliveryCompletedAt,
      createdAt: order.createdAt
    });
  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({ message: 'Server error while fetching delivery' });
  }
});

// Update order status
router.patch('/deliveries/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['processing', 'in-transit', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = { status };

    // If status is delivered, mark delivery as completed
    if (status === 'delivered') {
      updateData.deliveryCompleted = true;
      updateData.deliveryCompletedAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('user', 'name email')
    .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error while updating order status' });
  }
});

// Mark delivery as completed/uncompleted
router.patch('/deliveries/:id/completion', async (req, res) => {
  try {
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({ message: 'Completed must be a boolean value' });
    }

    const updateData = {
      deliveryCompleted: completed,
      deliveryCompletedAt: completed ? new Date() : null
    };

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      message: `Delivery marked as ${completed ? 'completed' : 'pending'}`,
      order
    });
  } catch (error) {
    console.error('Update delivery completion error:', error);
    res.status(500).json({ message: 'Server error while updating delivery completion' });
  }
});

// Get delivery statistics
router.get('/statistics/deliveries', async (req, res) => {
  try {
    const [total, processing, inTransit, delivered, cancelled, completed] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ status: 'in-transit' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.countDocuments({ deliveryCompleted: true })
    ]);

    res.json({
      total,
      byStatus: {
        processing,
        inTransit,
        delivered,
        cancelled
      },
      completed
    });
  } catch (error) {
    console.error('Get delivery statistics error:', error);
    res.status(500).json({ message: 'Server error while fetching statistics' });
  }
});

// ========================================
// COMMENT/REVIEW APPROVAL
// ========================================

// Get pending reviews
router.get('/reviews/pending', async (req, res) => {
  try {
    const reviews = await Review.find({
      approved: false,
      comment: { $ne: 'Rating only' }
    })
    .populate('user', 'name email')
    .populate('product', 'name imageUrl')
    .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
});

// Get all reviews (approved and pending)
router.get('/reviews/all', async (req, res) => {
  try {
    const reviews = await Review.find({
      comment: { $ne: 'Rating only' }
    })
    .populate('user', 'name email')
    .populate('product', 'name imageUrl')
    .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
});

// Approve review
router.patch('/reviews/:id/approve', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    )
    .populate('user', 'name')
    .populate('product', 'name');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({
      message: 'Review approved successfully',
      review
    });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ message: 'Server error while approving review' });
  }
});

// Disapprove/Reject review (delete)
router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review rejected and deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error while deleting review' });
  }
});

// ========================================
// INVOICES VIEW - TEMPORARILY DISABLED
// Will be implemented by team member
// ========================================

// TODO: Invoice system will be implemented separately

module.exports = router;
