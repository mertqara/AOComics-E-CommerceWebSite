// backend/routes/chat.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Order = require('../models/Order');
const upload = require('../config/upload');

// FLEXIBLE AUTH IMPORT - handles different export formats
let auth;
try {
  const authModule = require('../middleware/auth');
  // Check if it's a default export or named export
  auth = authModule.auth || authModule.default || authModule;
} catch (error) {
  console.error('Auth middleware not found:', error);
  // Fallback auth middleware if file doesn't exist
  auth = (req, res, next) => {
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
}

// Middleware to check if user is support agent
const isSupportAgent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'support_agent') {
      return res.status(403).json({ message: 'Access denied. Support Agent role required.' });
    }

    next();
  } catch (error) {
    console.error('Support agent auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==================== CUSTOMER ROUTES ====================

// Start a new chat
router.post('/start', async (req, res) => {
  try {
    console.log('📨 Chat start request received:', req.body);
    
    const { customerName, customerEmail, initialMessage, userId, guestSessionId } = req.body;
    
    if (!customerName || !initialMessage) {
      return res.status(400).json({ 
        message: 'Customer name and initial message are required' 
      });
    }

    console.log('👤 Customer:', customerName, customerEmail, 'UserId:', userId);

    // Check if user has an active chat already
    let existingChat;
    if (userId) {
      existingChat = await Chat.findOne({
        'customer.userId': userId,
        status: { $in: ['waiting', 'active'] }
      });
    } else if (guestSessionId) {
      existingChat = await Chat.findOne({
        'customer.guestSessionId': guestSessionId,
        status: { $in: ['waiting', 'active'] }
      });
    }

    if (existingChat) {
      console.log('📝 Returning existing chat:', existingChat._id);
      return res.json({ 
        chat: existingChat,
        message: 'Resuming existing chat'
      });
    }

    // ✅ ENHANCED: Fetch comprehensive customer context if logged in
    let customerContext = {
      profile: null,
      recentOrders: [],
      cart: null,
      wishlist: []
    };

    if (userId) {
      try {
        // Get user profile
        const user = await User.findById(userId).select('name email homeAddress taxID');
        if (user) {
          customerContext.profile = {
            name: user.name,
            email: user.email,
            homeAddress: user.homeAddress || null,
            taxID: user.taxID || null
          };
        }

        // Get recent orders with full details
        const recentOrders = await Order.find({ user: userId })
          .populate('orderItems.product', 'name imageUrl price')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        
        // Format orders for storage
        customerContext.recentOrders = recentOrders.map(order => ({
          _id: order._id,
          orderItems: order.orderItems.map(item => ({
            product: item.product ? {
              _id: item.product._id,
              name: item.product.name,
              imageUrl: item.product.imageUrl,
              price: item.product.price
            } : null,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          totalPrice: order.totalPrice,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
          createdAt: order.createdAt
        }));

        // Get wishlist with product details
        const userWithWishlist = await User.findById(userId)
          .populate('wishlist', 'name price imageUrl quantityInStock')
          .lean();
        
        if (userWithWishlist && userWithWishlist.wishlist) {
          customerContext.wishlist = userWithWishlist.wishlist.map(item => ({
            _id: item._id,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            quantityInStock: item.quantityInStock
          }));
        }

        // Get cart contents
        try {
          const Cart = require('../models/Cart');
          const cart = await Cart.findOne({ userId })
            .populate('items.product', 'name price imageUrl quantityInStock')
            .lean();
          
          if (cart && cart.items && cart.items.length > 0) {
            const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAdd), 0);
            
            customerContext.cart = {
              items: cart.items.map(item => ({
                product: item.product ? {
                  _id: item.product._id,
                  name: item.product.name,
                  price: item.product.price,
                  imageUrl: item.product.imageUrl,
                  quantityInStock: item.product.quantityInStock
                } : null,
                quantity: item.quantity,
                priceAtAdd: item.priceAtAdd
              })),
              totalItems,
              subtotal
            };
          }
        } catch (cartError) {
          console.log('Cart not available or error:', cartError.message);
        }

      } catch (contextError) {
        console.error('Error fetching customer context:', contextError);
      }
    }

    // Create new chat with enhanced context
    const newChat = new Chat({
      customer: {
        userId: userId || null,
        name: customerName,
        email: customerEmail || null,
        guestSessionId: guestSessionId || null
      },
      messages: [{
        sender: 'customer',
        senderName: customerName,
        text: initialMessage,
        timestamp: new Date()
      }],
      customerContext,
      status: 'waiting'
    });

    console.log('💾 Saving new chat...');
    const savedChat = await newChat.save();
    console.log('✅ Chat saved successfully:', savedChat._id);

    res.status(201).json({ 
      chat: savedChat,
      message: 'Chat started successfully'
    });

  } catch (error) {
    console.error('❌ Error starting chat:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get customer's active chat
router.get('/my-chat', async (req, res) => {
  try {
    const { userId, guestSessionId } = req.query;

    let chat;
    if (userId) {
      chat = await Chat.findOne({
        'customer.userId': userId,
        status: { $in: ['waiting', 'active'] }
      }).populate('agent', 'name email');
    } else if (guestSessionId) {
      chat = await Chat.findOne({
        'customer.guestSessionId': guestSessionId,
        status: { $in: ['waiting', 'active'] }
      }).populate('agent', 'name email');
    }

    if (!chat) {
      return res.status(404).json({ message: 'No active chat found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error fetching customer chat:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SUPPORT AGENT ROUTES ====================

// Get queue of waiting chats
router.get('/queue', auth, isSupportAgent, async (req, res) => {
  try {
    const waitingChats = await Chat.find({
      status: 'waiting'
    })
    .populate('customer', 'name email')
    .sort({ createdAt: 1 })
    .select('customer messages createdAt status')
    .limit(20)
    .lean();

    res.json({ chats: waitingChats });
  } catch (error) {
    console.error('Error fetching chat queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get agent's active chats
router.get('/my-active-chats', auth, isSupportAgent, async (req, res) => {
  try {
    const activeChats = await Chat.find({
      agent: req.user.id,
      status: 'active'
    })
    .populate('customer', 'name email')
    .populate('agent', 'name email')
    .sort({ updatedAt: -1 })
    .lean();

    res.json({ chats: activeChats });
  } catch (error) {
    console.error('Error fetching active chats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Claim a chat from the queue
router.post('/:chatId/claim', auth, isSupportAgent, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.status !== 'waiting') {
      return res.status(400).json({ message: 'Chat is no longer available' });
    }

    chat.agent = req.user.id;
    chat.status = 'active';
    
    // Add system message
    const agent = await User.findById(req.user.id);
    chat.messages.push({
      sender: 'system',
      senderName: 'System',
      text: `${agent.name} has joined the chat`,
      timestamp: new Date()
    });

    await chat.save();

    // Populate agent and customer info
    await chat.populate('agent', 'name email');
    await chat.populate('customer', 'name email');

    res.json({
      chat,
      message: 'Chat claimed successfully' 
    });
  } catch (error) {
    console.error('Error claiming chat:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Close a chat
router.post('/:chatId/close', auth, isSupportAgent, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.agent.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to close this chat' });
    }

    chat.status = 'closed';
    chat.closedAt = new Date();
    
    // Add system message
    const agent = await User.findById(req.user.id);
    chat.messages.push({
      sender: 'system',
      senderName: 'System',
      text: `Chat closed by ${agent.name}`,
      timestamp: new Date()
    });

    await chat.save();

    res.json({ 
      message: 'Chat closed successfully',
      chat 
    });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== FILE UPLOAD ====================

// Upload chat attachment
// Use dedicated chatUpload to ensure files are stored in /uploads/chat-attachments
const { chatUpload } = require('../config/upload');
router.post('/upload', chatUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('✅ File uploaded:', req.file);

    const fileData = {
      filename: req.file.originalname,
      url: `/uploads/chat-attachments/${req.file.filename}`,
      type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
      mimetype: req.file.mimetype,
      size: req.file.size
    };

    res.json({
      message: 'File uploaded successfully',
      file: fileData,
      ...fileData  // Also send at top level for backward compatibility
    });
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download file endpoint with proper headers
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../uploads/chat-attachments', filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get original filename from the stored filename (remove timestamp prefix)
    const originalName = filename.split('-').slice(1).join('-');

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Send file
    res.sendFile(filepath);
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;