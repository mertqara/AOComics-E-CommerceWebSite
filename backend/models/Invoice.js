// backend/models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    default: function() {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `INV-${timestamp}-${random}`;
    }
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerInfo: {
    name: String,
    email: String,
    address: String,
    taxID: String
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'paid', 'cancelled'],
    default: 'paid'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
