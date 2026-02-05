// backend/models/Chat.js
const mongoose = require('mongoose');

// Simple fallback guest session id generator to avoid ESM import issues in tests
function generateGuestSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const chatSchema = new mongoose.Schema({
  // Customer information
  customer: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      default: null
    },
    guestSessionId: {
      type: String,
      default: null
    }
  },

  // Support agent assigned to this chat
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Chat status
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting'
  },

  // Messages in the chat
  messages: [{
    sender: {
      type: String,
      enum: ['customer', 'agent', 'system'],
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    text: {
      type: String,
      default: ''
    },
    attachments: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Customer context (for logged-in users)
  customerContext: {
    profile: {
      name: String,
      email: String,
      homeAddress: String,
      taxID: String
    },
    recentOrders: [{
      _id: mongoose.Schema.Types.ObjectId,
      orderItems: [{
        product: {
          _id: mongoose.Schema.Types.ObjectId,
          name: String,
          imageUrl: String,
          price: Number
        },
        name: String,
        quantity: Number,
        price: Number
      }],
      totalPrice: Number,
      status: String,
      deliveryAddress: String,
      createdAt: Date
    }],
    wishlistCount: {
      type: Number,
      default: 0
    },
    cart: {
      items: [{
        product: {
          _id: mongoose.Schema.Types.ObjectId,
          name: String,
          price: Number,
          imageUrl: String,
          quantityInStock: Number
        },
        quantity: Number,
        priceAtAdd: Number
      }],
      totalItems: Number,
      subtotal: Number
    },
    wishlist: [{
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      imageUrl: String,
      quantityInStock: Number
    }]
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  }
});

// Pre-save middleware
chatSchema.pre('save', async function() {
  // Generate session ID for guest users if not present
  if (!this.customer.userId && !this.customer.guestSessionId) {
    this.customer.guestSessionId = generateGuestSessionId();
  }
  
  // Update the updatedAt timestamp
  this.updatedAt = Date.now();
});

// Indexes for better query performance
chatSchema.index({ 'customer.userId': 1 });
chatSchema.index({ 'customer.guestSessionId': 1 });
chatSchema.index({ agent: 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);