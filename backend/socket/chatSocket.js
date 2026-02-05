// backend/socket/chatSocket.js
const Chat = require('../models/Chat');
const jwt = require('jsonwebtoken');

/**
 * Initialize Socket.io for real-time chat
 * @param {Server} io - Socket.io server instance
 */
function initializeChatSocket(io) {
  // Chat namespace
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log('💬 New socket connection:', socket.id);

    // Customer joins their chat room
    socket.on('customer:join', async (data) => {
      try {
        const { chatId } = data;

        // Verify chat exists
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Join room
        socket.join(chatId);
        socket.chatId = chatId;
        socket.userType = 'customer';

        console.log(`👤 Customer joined chat ${chatId}`);

        // Notify agent if chat is active
        if (chat.status === 'active' && chat.agent) {
          chatNamespace.to(chatId).emit('customer:joined', {
            chatId,
            message: 'Customer is online'
          });
        }
      } catch (error) {
        console.error('Customer join error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Support agent joins their chat room
    socket.on('agent:join', async (data) => {
      try {
        const { chatId, token } = data;

        // Verify agent token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agentId = decoded.id;

        // Verify chat exists and agent is assigned
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        if (chat.agent.toString() !== agentId) {
          socket.emit('error', { message: 'Not authorized for this chat' });
          return;
        }

        // Join room
        socket.join(chatId);
        socket.chatId = chatId;
        socket.userType = 'agent';
        socket.agentId = agentId;

        console.log(`🎧 Agent ${agentId} joined chat ${chatId}`);

        // Notify customer
        chatNamespace.to(chatId).emit('agent:joined', {
          chatId,
          agentName: chat.agent.name || 'Support Agent',
          message: 'Support agent has joined the chat'
        });
      } catch (error) {
        console.error('Agent join error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { chatId, message, attachments = [], senderName } = data;

        // Verify chat exists
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Determine sender type
        const senderType = socket.userType || 'customer';

        // Add message to chat
        const newMessage = {
          sender: senderType,
          senderName: senderName || (senderType === 'agent' ? 'Support Agent' : chat.customer.name),
          text: message,  // ✅ Changed from 'message' to 'text' to match schema
          attachments,
          timestamp: new Date(),
          read: false
        };

        chat.messages.push(newMessage);
        await chat.save();

        // Broadcast message to all in chat room
        chatNamespace.to(chatId).emit('message:received', {
          chatId,
          message: newMessage
        });

        console.log(`📨 Message sent in chat ${chatId} by ${senderType}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data) => {
      const { chatId, userName } = data;
      socket.to(chatId).emit('typing:status', {
        chatId,
        userName,
        isTyping: true
      });
    });

    socket.on('typing:stop', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('typing:status', {
        chatId,
        isTyping: false
      });
    });

    // Mark messages as read
    socket.on('messages:read', async (data) => {
      try {
        const { chatId } = data;
        
        const chat = await Chat.findById(chatId);
        if (chat) {
          // Mark unread messages as read
          chat.messages.forEach(msg => {
            if (!msg.read && msg.sender !== socket.userType) {
              msg.read = true;
            }
          });
          await chat.save();

          socket.to(chatId).emit('messages:read', { chatId });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);
      
      if (socket.chatId) {
        chatNamespace.to(socket.chatId).emit('user:left', {
          chatId: socket.chatId,
          userType: socket.userType
        });
      }
    });
  });

  console.log('✅ Chat socket initialized');
}

module.exports = initializeChatSocket;