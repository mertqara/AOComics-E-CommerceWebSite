const request = require('supertest');
const express = require('express');
const productRoutes = require('../routes/products');
const Product = require('../models/Product');
require('./setup');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/products', productRoutes);

describe('Product Routes', () => {
  // Sample products for testing
  const sampleProducts = [
    {
      name: 'Spider-Man: Into the Spider-Verse',
      description: 'Amazing comic featuring Spider-Man',
      price: 15.99,
      quantityInStock: 10,
      category: 'Marvel',
      rating: 4.5,
      numReviews: 25
    },
    {
      name: 'Batman: The Dark Knight',
      description: 'Epic Batman adventure',
      price: 12.99,
      quantityInStock: 5,
      category: 'DC',
      rating: 4.8,
      numReviews: 40
    },
    {
      name: 'The Walking Dead Vol 1',
      description: 'Zombie survival story',
      price: 9.99,
      quantityInStock: 15,
      category: 'Image',
      rating: 4.2,
      numReviews: 30
    },
    {
      name: 'Iron Man: Extremis',
      description: 'Iron Man faces new threats',
      price: 18.99,
      quantityInStock: 8,
      category: 'Marvel',
      rating: 4.0,
      numReviews: 15
    }
  ];

  beforeEach(async () => {
    // Insert sample products before each test
    await Product.insertMany(sampleProducts);
  });

  describe('GET /api/products', () => {
    it('should get all products without filter', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveLength(4);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('price');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Marvel')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].category).toBe('Marvel');
      expect(response.body[1].category).toBe('Marvel');
    });
  });

  describe('GET /api/products/search', () => {
    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/products/search?query=Spider-Man')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toContain('Spider-Man');
    });

    it('should search products by description (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/products/search?query=zombie')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].description.toLowerCase()).toContain('zombie');
    });
  });

  describe('Product Sorting', () => {
    it('should sort products by price ascending', async () => {
      const response = await request(app)
        .get('/api/products?sort=price-asc')
        .expect(200);

      expect(response.body).toHaveLength(4);
      // Verify ascending order
      expect(response.body[0].price).toBeLessThanOrEqual(response.body[1].price);
      expect(response.body[1].price).toBeLessThanOrEqual(response.body[2].price);
      expect(response.body[2].price).toBeLessThanOrEqual(response.body[3].price);
    });

    it('should sort products by price descending', async () => {
      const response = await request(app)
        .get('/api/products?sort=price-desc')
        .expect(200);

      expect(response.body).toHaveLength(4);
      // Verify descending order
      expect(response.body[0].price).toBeGreaterThanOrEqual(response.body[1].price);
      expect(response.body[1].price).toBeGreaterThanOrEqual(response.body[2].price);
      expect(response.body[2].price).toBeGreaterThanOrEqual(response.body[3].price);
    });

    it('should sort products by rating (highest first)', async () => {
      const response = await request(app)
        .get('/api/products?sort=rating')
        .expect(200);

      expect(response.body).toHaveLength(4);
      // Verify rating descending order
      expect(response.body[0].rating).toBeGreaterThanOrEqual(response.body[1].rating);
      expect(response.body[1].rating).toBeGreaterThanOrEqual(response.body[2].rating);
    });

    it('should sort products by popularity (most reviews first)', async () => {
      const response = await request(app)
        .get('/api/products?sort=popular')
        .expect(200);

      expect(response.body).toHaveLength(4);
      // Verify popularity (numReviews) descending order
      expect(response.body[0].numReviews).toBeGreaterThanOrEqual(response.body[1].numReviews);
      expect(response.body[1].numReviews).toBeGreaterThanOrEqual(response.body[2].numReviews);
      // Most popular should be Batman with 40 reviews
      expect(response.body[0].name).toBe('Batman: The Dark Knight');
    });
  });
});
