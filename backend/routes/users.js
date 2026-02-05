// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get user profile
router.get('/:id', auth, async (req, res) => {
  try {
    // Verify user is accessing their own profile or is admin
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/:id', auth, async (req, res) => {
  try {
    // Verify user is updating their own profile
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, taxID, homeAddress } = req.body;

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (taxID !== undefined) user.taxID = taxID;
    if (homeAddress !== undefined) user.homeAddress = homeAddress;

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(user._id).select('-password');
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/:id/password', auth, async (req, res) => {
  try {
    // Verify user is changing their own password
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;