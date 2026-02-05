// backend/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  rating: { 
    type: Number,  
    min: 0, 
    max: 5,
    default: 0
  },
  comment: { 
    type: String, 
    required: true 
  },
  approved: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Prevent duplicate reviews from same user on same product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);