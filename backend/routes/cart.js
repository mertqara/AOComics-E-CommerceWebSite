// backend/routes/cart.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to extract user ID or session ID
 * Supports both authenticated users and guests
 */
const identifyUser = (req, res, next) => {
  // Check if user is authenticated (from auth middleware)
  if (req.user && req.user.id) {
    req.cartIdentifier = { userId: req.user.id };
    return next();
  }

  // For guests, use sessionId from header or create new one
  let sessionId = req.headers['x-session-id'] || req.body.sessionId;

  if (!sessionId) {
    sessionId = uuidv4();
  }

  req.cartIdentifier = { sessionId };
  req.newSessionId = sessionId;
  next();
};

/**
 * GET /api/cart
 * Get current user's cart (authenticated or guest)
 *
 * Headers:
 *   x-session-id: session identifier for guests (optional, will be created if missing)
 *
 * Response:
 *   200: Cart object with populated product details
 *   500: Server error
 */
router.get('/', identifyUser, async (req, res) => {
  try {
    const { userId, sessionId } = req.cartIdentifier;

    // Find cart
    const cart = await Cart.findOrCreateCart(userId, sessionId);

    // Populate product details
    await cart.populate('items.product');

    // Check for out-of-stock or deleted products
    const validatedItems = [];
    let hasChanges = false;

    for (const item of cart.items) {
      if (!item.product) {
        // Product was deleted
        hasChanges = true;
        continue;
      }

      // Check stock availability
      if (item.product.quantityInStock < item.quantity) {
        // Adjust quantity to available stock
        item.quantity = Math.max(item.product.quantityInStock, 0);
        hasChanges = true;
      }

      if (item.quantity > 0) {
        validatedItems.push(item);
      } else {
        hasChanges = true;
      }
    }

    // Update cart if items were removed or adjusted
    if (hasChanges) {
      cart.items = validatedItems;
      await cart.save();
    }

    // Return session ID for guests
    const response = {
      cart: {
        _id: cart._id,
        userId: cart.userId,
        sessionId: cart.sessionId,
        items: cart.items,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        lastModified: cart.lastModified
      }
    };

    if (req.newSessionId) {
      response.sessionId = req.newSessionId;
    }

    res.json(response);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      message: 'Failed to retrieve cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/cart/add
 * Add product to cart
 *
 * Body:
 *   productId: Product ID (required)
 *   quantity: Number of items (required, min: 1)
 *   sessionId: Guest session ID (optional for guests)
 *
 * Response:
 *   200: Product added/updated successfully
 *   400: Validation errors (out of stock, invalid quantity)
 *   404: Product not found
 *   500: Server error
 */
router.post('/add', identifyUser, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { userId, sessionId } = req.cartIdentifier;

    // Validation
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    // Fetch product with stock info
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is out of stock
    if (product.quantityInStock === 0) {
      return res.status(400).json({
        message: `${product.name} is currently out of stock`,
        inStock: false,
        availableStock: 0
      });
    }

    // Check if requested quantity exceeds available stock
    if (product.quantityInStock < quantity) {
      return res.status(400).json({
        message: `Only ${product.quantityInStock} unit(s) of ${product.name} available`,
        availableStock: product.quantityInStock,
        requestedQuantity: quantity
      });
    }

    // Find or create cart
    const cart = await Cart.findOrCreateCart(userId, sessionId);

    // Check if product already in cart
    const existingItem = cart.getItem(productId);

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      // Verify new total doesn't exceed stock
      if (newQuantity > product.quantityInStock) {
        return res.status(400).json({
          message: `Cannot add ${quantity} more. Only ${product.quantityInStock - existingItem.quantity} more available`,
          currentQuantity: existingItem.quantity,
          availableStock: product.quantityInStock,
          maxAdditional: product.quantityInStock - existingItem.quantity
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.priceAtAdd = product.price; // Update to current price
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        priceAtAdd: product.price
      });
    }

    await cart.save();
    await cart.populate('items.product');

    const response = {
      message: existingItem ? 'Cart updated successfully' : 'Product added to cart',
      cart: {
        _id: cart._id,
        items: cart.items,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal
      }
    };

    if (req.newSessionId) {
      response.sessionId = req.newSessionId;
    }

    res.json(response);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      message: 'Failed to add product to cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/cart/item/:productId
 * Update item quantity in cart
 *
 * Params:
 *   productId: Product ID
 *
 * Body:
 *   quantity: New quantity (required, min: 1)
 *
 * Response:
 *   200: Quantity updated
 *   400: Validation errors
 *   404: Product not in cart
 *   500: Server error
 */
router.patch('/item/:productId', identifyUser, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const { userId, sessionId } = req.cartIdentifier;

    // Validation
    if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    // Find cart
    const cart = await Cart.findOrCreateCart(userId, sessionId);

    if (cart.items.length === 0) {
      return res.status(404).json({ message: 'Cart is empty' });
    }

    // Find item in cart
    const item = cart.getItem(productId);

    if (!item) {
      return res.status(404).json({ message: 'Product not found in cart' });
    }

    // Check product stock
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product no longer available' });
    }

    if (product.quantityInStock === 0) {
      return res.status(400).json({
        message: `${product.name} is out of stock`,
        inStock: false
      });
    }

    if (quantity > product.quantityInStock) {
      return res.status(400).json({
        message: `Only ${product.quantityInStock} unit(s) available`,
        availableStock: product.quantityInStock,
        requestedQuantity: quantity
      });
    }

    // Update quantity
    item.quantity = quantity;
    item.priceAtAdd = product.price; // Update to current price

    await cart.save();
    await cart.populate('items.product');

    res.json({
      message: 'Quantity updated',
      cart: {
        _id: cart._id,
        items: cart.items,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal
      }
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      message: 'Failed to update cart item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/cart/item/:productId
 * Remove item from cart
 *
 * Params:
 *   productId: Product ID
 *
 * Response:
 *   200: Item removed
 *   404: Product not in cart
 *   500: Server error
 */
router.delete('/item/:productId', identifyUser, async (req, res) => {
  try {
    const { productId } = req.params;
    const { userId, sessionId } = req.cartIdentifier;

    // Find cart
    const cart = await Cart.findOrCreateCart(userId, sessionId);

    if (cart.items.length === 0) {
      return res.status(404).json({ message: 'Cart is empty' });
    }

    // Check if item exists
    if (!cart.hasProduct(productId)) {
      return res.status(404).json({ message: 'Product not found in cart' });
    }

    // Remove item
    cart.removeItem(productId);

    await cart.save();
    await cart.populate('items.product');

    res.json({
      message: 'Item removed from cart',
      cart: {
        _id: cart._id,
        items: cart.items,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal
      }
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      message: 'Failed to remove item from cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/cart/clear
 * Clear entire cart
 *
 * Response:
 *   200: Cart cleared
 *   500: Server error
 */
router.delete('/clear', identifyUser, async (req, res) => {
  try {
    const { userId, sessionId } = req.cartIdentifier;

    const cart = await Cart.findOrCreateCart(userId, sessionId);

    cart.items = [];
    await cart.save();

    res.json({
      message: 'Cart cleared',
      cart: {
        _id: cart._id,
        items: [],
        totalItems: 0,
        subtotal: 0
      }
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      message: 'Failed to clear cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/cart/merge
 * Merge guest cart with user cart after login
 * CRITICAL: This must be called immediately after user logs in
 *
 * Body:
 *   guestSessionId: Guest session ID (required)
 *
 * Response:
 *   200: Carts merged successfully
 *   400: Missing session ID or user not authenticated
 *   500: Server error
 */
router.post('/merge', async (req, res) => {
  try {
    const { guestSessionId } = req.body;

    // Verify user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User must be authenticated to merge carts' });
    }

    if (!guestSessionId) {
      return res.status(400).json({ message: 'Guest session ID is required' });
    }

    const userId = req.user.id;

    // Find guest cart
    const guestCart = await Cart.findOne({ sessionId: guestSessionId });

    if (!guestCart || guestCart.items.length === 0) {
      // No guest cart or empty cart - just return user's cart
      const userCart = await Cart.findOrCreateCart(userId, null);
      await userCart.populate('items.product');

      return res.json({
        message: 'No items to merge',
        cart: {
          _id: userCart._id,
          items: userCart.items,
          totalItems: userCart.totalItems,
          subtotal: userCart.subtotal
        }
      });
    }

    // Find or create user cart
    let userCart = await Cart.findOrCreateCart(userId, null);

    // Merge logic: For each item in guest cart
    for (const guestItem of guestCart.items) {
      const productId = guestItem.product.toString();

      // Check if product is still available and in stock
      const product = await Product.findById(productId);

      if (!product || product.quantityInStock === 0) {
        // Skip unavailable products
        continue;
      }

      const existingItem = userCart.getItem(productId);

      if (existingItem) {
        // Merge quantities (but don't exceed stock)
        const combinedQuantity = existingItem.quantity + guestItem.quantity;
        existingItem.quantity = Math.min(combinedQuantity, product.quantityInStock);
        existingItem.priceAtAdd = product.price; // Use current price
      } else {
        // Add to user cart (limit to stock)
        userCart.items.push({
          product: productId,
          quantity: Math.min(guestItem.quantity, product.quantityInStock),
          priceAtAdd: product.price
        });
      }
    }

    await userCart.save();

    // Delete guest cart
    await Cart.deleteOne({ sessionId: guestSessionId });

    // Populate and return merged cart
    await userCart.populate('items.product');

    res.json({
      message: 'Carts merged successfully',
      cart: {
        _id: userCart._id,
        items: userCart.items,
        totalItems: userCart.totalItems,
        subtotal: userCart.subtotal
      },
      itemsMerged: guestCart.items.length
    });
  } catch (error) {
    console.error('Merge cart error:', error);
    res.status(500).json({
      message: 'Failed to merge carts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cart/count
 * Get total item count in cart (lightweight endpoint)
 *
 * Response:
 *   200: { count: number }
 *   500: Server error
 */
router.get('/count', identifyUser, async (req, res) => {
  try {
    const { userId, sessionId } = req.cartIdentifier;

    const cart = await Cart.findOrCreateCart(userId, sessionId);

    res.json({
      count: cart.totalItems,
      sessionId: req.newSessionId
    });
  } catch (error) {
    console.error('Get cart count error:', error);
    res.status(500).json({
      message: 'Failed to get cart count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/cart/validate
 * Validate cart before checkout
 * Checks stock availability and price changes
 *
 * Response:
 *   200: Cart valid or validation warnings
 *   400: Critical issues preventing checkout
 *   500: Server error
 */
router.post('/validate', identifyUser, async (req, res) => {
  try {
    const { userId, sessionId } = req.cartIdentifier;

    const cart = await Cart.findOrCreateCart(userId, sessionId);
    await cart.populate('items.product');

    if (cart.items.length === 0) {
      return res.status(400).json({
        valid: false,
        message: 'Cart is empty'
      });
    }

    const issues = [];
    const warnings = [];
    let hasBlockingIssues = false;

    for (const item of cart.items) {
      if (!item.product) {
        issues.push({
          type: 'product_deleted',
          message: 'A product in your cart is no longer available',
          itemId: item._id
        });
        hasBlockingIssues = true;
        continue;
      }

      const product = item.product;

      // Check stock
      if (product.quantityInStock === 0) {
        issues.push({
          type: 'out_of_stock',
          productId: product._id,
          productName: product.name,
          message: `${product.name} is out of stock`
        });
        hasBlockingIssues = true;
      } else if (product.quantityInStock < item.quantity) {
        issues.push({
          type: 'insufficient_stock',
          productId: product._id,
          productName: product.name,
          message: `Only ${product.quantityInStock} unit(s) of ${product.name} available`,
          requestedQuantity: item.quantity,
          availableStock: product.quantityInStock
        });
        hasBlockingIssues = true;
      }

      // Check price changes
      if (Math.abs(product.price - item.priceAtAdd) > 0.01) {
        const priceChanged = product.price > item.priceAtAdd ? 'increased' : 'decreased';
        warnings.push({
          type: 'price_change',
          productId: product._id,
          productName: product.name,
          message: `Price of ${product.name} has ${priceChanged}`,
          oldPrice: item.priceAtAdd,
          newPrice: product.price,
          priceDifference: (product.price - item.priceAtAdd).toFixed(2)
        });
      }
    }

    if (hasBlockingIssues) {
      return res.status(400).json({
        valid: false,
        message: 'Cart has items that cannot be purchased',
        issues,
        warnings
      });
    }

    res.json({
      valid: true,
      message: warnings.length > 0 ? 'Cart valid with price changes' : 'Cart is valid',
      warnings,
      cart: {
        totalItems: cart.totalItems,
        subtotal: cart.subtotal
      }
    });
  } catch (error) {
    console.error('Validate cart error:', error);
    res.status(500).json({
      message: 'Failed to validate cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
