// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  model: String,
  serialNumber: String,
  description: String,
  quantityInStock: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discount:{ type: Number , default: 0 },
  warrantyStatus: String,
  distributorInfo: String,
  category: String, // Marvel, DC, Image, etc.
  imageUrl: String,
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);