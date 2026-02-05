// backend/routes/products.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// Get all categories (public endpoint)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
});

// Get all products with filtering and sorting
router.get('/', async (req, res) => {
  try {
    const { sort, category } = req.query;
    
    // Build filter
    let filter = {};
    if (category) {
      filter.category = category;
    }
    
    // Build sort
    let sortOption = {};
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };
    else if (sort === 'popular') sortOption = { numReviews: -1 };
    
    console.log('Filter:', filter);
    console.log('Sort:', sortOption);
    
    const products = await Product.find(filter).sort(sortOption);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }
    
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    });
    res.json(products);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category });
    res.json(products);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add product (for now, no auth required - we'll add admin auth later)
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;