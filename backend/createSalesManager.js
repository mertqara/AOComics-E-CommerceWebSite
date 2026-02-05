// Script to create a sales manager user
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const createSalesManager = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    // Sales Manager credentials
    const salesManagerData = {
      name: 'Dila Erol',
      email: 'emiriseverim@aocomics.com',
      password: 'dila123', // You can change this password
      role: 'sales_manager'
    };

    // Check if sales manager already exists
    const existingUser = await User.findOne({ email: salesManagerData.email });
    if (existingUser) {
      console.log('❌ Sales manager already exists with email:', salesManagerData.email);
      console.log('Use these credentials to login:');
      console.log('Email:', salesManagerData.email);
      console.log('Password: sales123');
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(salesManagerData.password, 10);

    // Create sales manager user
    const salesManager = new User({
      name: salesManagerData.name,
      email: salesManagerData.email,
      password: hashedPassword,
      role: salesManagerData.role
    });

    await salesManager.save();

    console.log('✅ Sales Manager created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('Email:', salesManagerData.email);
    console.log('Password:', salesManagerData.password);
    console.log('');
    console.log('You can now login with these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sales manager:', error);
    process.exit(1);
  }
};

createSalesManager();
