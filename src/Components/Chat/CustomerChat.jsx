// src/Components/Chat/CustomerChat.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import API from '../../services/api';
import './CustomerChat.css';

const CustomerChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentName, setAgentName] = useState('');
  
  // Start chat form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Get user info if logged in
  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCustomerName(user.name);
      setCustomerEmail(user.email);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateSessionId = () => {
    const sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('guestSessionId', sessionId);
    return sessionId;
  };

  const connectSocket = useCallback((chatId) => {
    // Disconnect existing socket to prevent duplicates
    if (socketRef.current) {
      socketRef.current.off(); // Remove all listeners
      socketRef.current.disconnect();
    }

    socketRef.current = io('http://localhost:5001/chat', {
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected');
      
      // Join chat room
      socketRef.current.emit('customer:join', { 
        chatId
      });
    });

    socketRef.current.on('message:received', (data) => {
      setMessages(prev => {
        // Prevent duplicates - check if message already exists
        const isDuplicate = prev.some(msg => {
          const msgTime = msg.timestamp?.toString();
          const newTime = data.message.timestamp?.toString();
          const msgText = msg.text || msg.message;
          const newText = data.message.text || data.message.message;
          
          return msgTime === newTime && msgText === newText;
        });
        
        if (isDuplicate) {
          console.log('🚫 Duplicate message prevented');
          return prev;
        }
        
        const next = [...prev, data.message];

        // Update cached chat in sessionStorage so UI persists across reloads
        try {
          const cached = JSON.parse(sessionStorage.getItem('chat') || 'null');
          if (cached && cached._id === data.chatId) {
            cached.messages = next;
            sessionStorage.setItem('chat', JSON.stringify(cached));
          }
        } catch (err) {
          // ignore
        }

        return next;
      });
    });

    socketRef.current.on('agent:joined', (data) => {
      setAgentName(data.agentName);
      setMessages(prev => [...prev, {
        sender: 'system',
        text: data.message,
        timestamp: new Date()
      }]);
    });

    socketRef.current.on('typing:status', (data) => {
      if (data.isTyping) {
        setIsTyping(true);
      } else {
        setIsTyping(false);
      }
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      alert(error.message);
    });
  }, []);

  const checkForExistingChat = useCallback(async () => {
    try {
      // If we have a cached chat from previous session, show it immediately
      const cached = sessionStorage.getItem('chat');
      if (cached) {
        const parsed = JSON.parse(cached);
        setChat(parsed);
        setMessages(parsed.messages || []);
        setChatStarted(true);
        if (parsed.agent) setAgentName(parsed.agent.name);
        // Connect socket in background
        connectSocket(parsed._id);
        // Still verify with server to refresh state
      }

      // If user is logged in, ask server for any active chat linked to their account
      const userData = sessionStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user?.id) {
            const responseByUser = await API.get(`/chat/my-chat?userId=${user.id}`);
            if (responseByUser.data && responseByUser.data.chat) {
              setChat(responseByUser.data.chat);
              setMessages(responseByUser.data.chat.messages || []);
              setChatStarted(true);
              if (responseByUser.data.chat.agent) setAgentName(responseByUser.data.chat.agent.name);
              try { sessionStorage.setItem('chat', JSON.stringify(responseByUser.data.chat)); } catch (err) {}
              connectSocket(responseByUser.data.chat._id);
              return; // we've resumed the account chat, no need to check guest id
            }
          }
        } catch (err) {
          console.warn('Failed to parse user from sessionStorage', err);
        }
      }

      const guestSessionId = sessionStorage.getItem('guestSessionId') || generateSessionId();
      const response = await API.get(`/chat/my-chat?guestSessionId=${guestSessionId}`);
      
      if (response.data && response.data.chat) {
        setChat(response.data.chat);
        setMessages(response.data.chat.messages || []);
        setChatStarted(true);
        if (response.data.chat.agent) {
          setAgentName(response.data.chat.agent.name);
        }

        // Cache chat for persistence
        try { sessionStorage.setItem('chat', JSON.stringify(response.data.chat)); } catch (err) {}

        // Connect socket (if not already connected to same chat)
        connectSocket(response.data.chat._id);
      }
    } catch (error) {
      // No active chat found - that's fine
      console.log('No existing chat', error?.response?.data?.message || error.message);
      // If cached chat exists but server says none, clear cache
      try {
        const cached = JSON.parse(sessionStorage.getItem('chat') || 'null');
        if (cached) sessionStorage.removeItem('chat');
      } catch (err) {}
    }
  }, [connectSocket]);

  // Check for existing chat on mount
  useEffect(() => {
    checkForExistingChat();
  }, [checkForExistingChat]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        console.log('🔌 Socket disconnected on cleanup');
      }
    };
  }, []);

  const handleStartChat = async (e) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const guestSessionId = sessionStorage.getItem('guestSessionId') || generateSessionId();
      
      // ✅ Get userId from localStorage for logged-in users
      const userData = sessionStorage.getItem('user');
      const userId = userData ? JSON.parse(userData).id : null;
      
      const response = await API.post('/chat/start', {
        customerName,
        customerEmail,
        guestSessionId,
        initialMessage,
        userId // ✅ Send userId for context fetching
      });

      setChat(response.data.chat);
      setMessages(response.data.chat.messages || []);
      setChatStarted(true);
      
      // Connect socket
      connectSocket(response.data.chat._id);
      // Cache chat so it persists across reloads
      try { sessionStorage.setItem('chat', JSON.stringify(response.data.chat)); } catch (err) {}

    } catch (error) {
      console.error('Start chat error:', error);
      alert(error.response?.data?.message || 'Failed to start chat');
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!inputMessage.trim()) return;

    socketRef.current.emit('message:send', {
      chatId: chat._id,
      message: inputMessage,
      senderName: customerName
    });

    setInputMessage('');
    
    // Stop typing indicator
    socketRef.current.emit('typing:stop', { chatId: chat._id });
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);

    // Emit typing start
    if (!typingTimeoutRef.current) {
      socketRef.current?.emit('typing:start', {
        chatId: chat._id,
        userName: customerName
      });
    }

    // Clear existing timeout
    clearTimeout(typingTimeoutRef.current);

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { chatId: chat._id });
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('📤 Uploading file:', file.name);
      
      const response = await API.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('✅ Upload response:', response.data);

      // Send message with attachment
      socketRef.current.emit('message:send', {
        chatId: chat._id,
        message: `📎 Sent a file: ${file.name}`,
        senderName: customerName,
        attachments: [response.data.file || response.data]
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert(error.response?.data?.message || 'Failed to upload file');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) {
    return (
      <button
        className="chat-widget-button"
        onClick={() => setIsOpen(true)}
      >
        💬
      </button>
    );
  }

  return (
    <>
      <button
        className="chat-widget-button"
        onClick={() => setIsOpen(false)}
      >
        ✕
      </button>

      <div className="chat-widget-window">
        <div className="chat-header">
          <div>
            <h3>Customer Support</h3>
            <div className="chat-status">
              {chat && chat.status === 'active' ? (
                <span>🟢 {agentName || 'Support Agent'}</span>
              ) : (
                <span>🟡 Waiting for agent...</span>
              )}
            </div>
          </div>
          <button className="close-chat-btn" onClick={handleClose}>✕</button>
        </div>

        {!chatStarted ? (
          <form className="chat-start-form" onSubmit={handleStartChat}>
            <h4>Start a conversation</h4>
            <p>We typically reply within a few minutes</p>
            
            <input
              type="text"
              placeholder="Your name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
            
            <input
              type="email"
              placeholder="Email (optional)"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
            
            <textarea
              placeholder="How can we help you?"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
            />
            
            <button type="submit" className="start-chat-btn">
              Start Chat
            </button>
          </form>
        ) : (
          <>
            <div className="chat-messages">
              {(messages || []).map((msg, index) => (
                msg.sender === 'system' ? (
                  <div key={index} style={{ textAlign: 'center', margin: '10px 0', fontSize: '12px', color: '#999' }}>
                    {msg.text || msg.message}
                  </div>
                ) : (
                  <div key={index} className={`chat-message ${msg.sender}`}>
                    <div className="message-bubble">
                      <div className="message-sender">{msg.senderName}</div>
                      <p className="message-text">{msg.text || msg.message}</p>
                      
                      {msg.attachments && msg.attachments.map((att, i) => {
                        if (!att.url) return null;
                        const filename = att.url.split('/').pop();
                        return (
                          <div key={i} className="message-attachment">
                            {att.type === 'image' ? (
                              <img src={`http://localhost:5001${att.url}`} alt={att.filename} />
                            ) : (
                              <a
                                href={`http://localhost:5001/api/chat/download/${filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                📎 {att.filename}
                              </a>
                            )}
                          </div>
                        );
                      })}
                      
                      <div className="message-time">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                )
              ))}
              
              {isTyping && (
                <div className="chat-message agent">
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <div className="chat-input-wrapper">
                  <textarea
                    className="chat-input"
                    placeholder="Type a message..."
                    value={inputMessage}
                    onChange={handleTyping}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    rows="1"
                  />
                  <button
                    type="button"
                    className="attach-btn"
                    onClick={() => fileInputRef.current.click()}
                  >
                    📎
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,video/*"
                  />
                </div>
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!inputMessage.trim()}
                >
                  ➤
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CustomerChat;