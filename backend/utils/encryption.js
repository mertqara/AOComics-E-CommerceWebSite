// backend/utils/encryption.js
const crypto = require('crypto');

// Use environment variable for encryption key, or default for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '7k9mP2qR5tY8wE3nA6cF1xV4bN0zL7jM'; // Must be 32 characters
const IV_LENGTH = 16;

function encryptCreditCard(text) {
  if (!text) return null;
  
  const cleanText = text.replace(/[\s-]/g, '');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(cleanText);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptCreditCard(text) {
  if (!text) return null;
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

function maskCreditCard(cardNumber) {
  if (!cardNumber) return null;
  
  const clean = cardNumber.replace(/[\s-]/g, '');
  const lastFour = clean.slice(-4);
  return '**** **** **** ' + lastFour;
}

module.exports = {
  encryptCreditCard,
  decryptCreditCard,
  maskCreditCard
};