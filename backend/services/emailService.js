// backend/services/emailService.js
const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email service error:', error);
  } else {
    console.log('✅ Email service is ready');
  }
});

// Send order confirmation email with invoice
const sendOrderConfirmation = async (userEmail, orderData) => {
  const { orderId, orderItems, totalPrice, deliveryAddress, createdAt } = orderData;
  
  const invoiceNumber = `INV-${orderId.toString().slice(-8)}`;
  const orderDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create items list for email
  const itemsList = orderItems.map(item => 
    `<tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: `Order Confirmation - ${invoiceNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff4141; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
          .invoice-table th { background: #f5f5f5; padding: 12px; text-align: left; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; text-align: right; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; padding: 12px 30px; background: #ff4141; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AO Comics</h1>
            <p>Order Confirmation</p>
          </div>
          
          <div class="content">
            <h2>Thank you for your order!</h2>
            <p>Your order has been confirmed and is being processed.</p>
            
            <div style="background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #ff4141;">
              <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
              <p><strong>Order Date:</strong> ${orderDate}</p>
              <p><strong>Order ID:</strong> ${orderId}</p>
            </div>

            <h3>Order Details:</h3>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
              </tbody>
            </table>

            <div class="total">
              <p>Subtotal: $${totalPrice.toFixed(2)}</p>
              <p>Shipping: FREE</p>
              <p style="border-top: 2px solid #333; padding-top: 10px;">Total Paid: $${totalPrice.toFixed(2)}</p>
            </div>

            <div style="background: white; padding: 15px; margin: 20px 0;">
              <h4>Delivery Address:</h4>
              <p>${deliveryAddress}</p>
            </div>

            <div style="text-align: center;">
              <a href="http://localhost:3000/orders" class="button">Track Your Order</a>
            </div>
          </div>

          <div class="footer">
            <p>Questions? Contact us at support@aocomics.com</p>
            <p>© 2025 AO Comics. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderConfirmation
};