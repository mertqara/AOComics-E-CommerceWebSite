// backend/config/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
const chatAttachmentsDir = './uploads/chat-attachments';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(chatAttachmentsDir)) {
  fs.mkdirSync(chatAttachmentsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use chat-attachments folder for chat uploads. Check baseUrl/originalUrl because
    // when router is mounted (e.g., at /api/chat) req.path may be just '/upload'.
    const isChatRoute = (req.baseUrl && req.baseUrl.includes('/chat')) ||
                        (req.originalUrl && req.originalUrl.includes('/chat')) ||
                        (req.path && req.path.includes('/chat'));

    if (isChatRoute) {
      cb(null, chatAttachmentsDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const isChatRoute = (req.baseUrl && req.baseUrl.includes('/chat')) ||
                        (req.originalUrl && req.originalUrl.includes('/chat')) ||
                        (req.path && req.path.includes('/chat'));
    const prefix = isChatRoute ? 'chat-' : '';
    cb(null, prefix + uniqueSuffix + '-' + file.originalname);
  }
});

// File filter - allow images, common document types, and videos
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images, documents, and videos are allowed!'));
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: fileFilter
});

// Dedicated uploader for chat attachments to ensure correct destination
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chatAttachmentsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-' + uniqueSuffix + '-' + file.originalname);
  }
});

const chatUpload = multer({
  storage: chatStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: fileFilter
});
module.exports = upload;
module.exports.chatUpload = chatUpload;
