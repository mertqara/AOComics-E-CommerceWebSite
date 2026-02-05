// backend/models/Cart.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  priceAtAdd: {
    type: Number,
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  // For authenticated users
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // For guest users
  sessionId: {
    type: String,
    default: null
  },
  
  // Cart items
  items: [cartItemSchema],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ lastModified: -1 });

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for subtotal
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.priceAtAdd * item.quantity);
  }, 0);
});

// Ensure virtuals are included in JSON
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

// Update lastModified on save
cartSchema.pre('save', function(next) {
  this.lastModified = Date.now();
  next();
});

// Static method to find or create cart
cartSchema.statics.findOrCreateCart = async function(userId, sessionId) {
  let cart;
  
  if (userId) {
    // Find by userId
    cart = await this.findOne({ userId });
    
    if (!cart) {
      cart = new this({ userId, items: [] });
      await cart.save();
    }
  } else if (sessionId) {
    // Find by sessionId
    cart = await this.findOne({ sessionId });
    
    if (!cart) {
      cart = new this({ sessionId, items: [] });
      await cart.save();
    }
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }
  
  return cart;
};

// Instance method to get item by product ID
cartSchema.methods.getItem = function(productId) {
  return this.items.find(item => 
    item.product.toString() === productId.toString()
  );
};

// Instance method to check if product exists in cart
cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => 
    item.product.toString() === productId.toString()
  );
};

// Instance method to remove item
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.product.toString() !== productId.toString()
  );
};

// Clean up old guest carts (optional - can be run as a cron job)
cartSchema.statics.cleanupOldGuestCarts = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    sessionId: { $ne: null },
    userId: null,
    lastModified: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

module.exports = mongoose.model('Cart', cartSchema);