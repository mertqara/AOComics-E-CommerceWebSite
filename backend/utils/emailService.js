// backend/utils/emailService.js
const nodemailer = require('nodemailer');

// Create reusable email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send discount notification email to user
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's name
 * @param {object} product - Product object with discount info
 */
const sendDiscountNotification = async (userEmail, userName, product) => {
  try {
    const discountPercentage = Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100
    );

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: `🎉 ${discountPercentage}% OFF on ${product.name} - Limited Time!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff4141; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .product-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .discount-badge { background: #ff4141; color: white; padding: 10px 20px;
                             border-radius: 5px; font-size: 24px; font-weight: bold;
                             display: inline-block; margin: 10px 0; }
            .price-info { font-size: 20px; margin: 15px 0; }
            .original-price { text-decoration: line-through; color: #999; }
            .new-price { color: #ff4141; font-weight: bold; font-size: 28px; }
            .cta-button { background: #ff4141; color: white; padding: 15px 30px;
                         text-decoration: none; border-radius: 5px; display: inline-block;
                         margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Special Discount Alert!</h1>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Great news! A product in your wishlist is now on sale!</p>

              <div class="product-info">
                <h2>${product.name}</h2>
                <p><strong>Category:</strong> ${product.category}</p>

                <div class="discount-badge">
                  -${discountPercentage}% OFF
                </div>

                <div class="price-info">
                  <div class="new-price">$${product.price.toFixed(2)}</div>
                  <div class="original-price">Was: $${product.originalPrice.toFixed(2)}</div>
                  <div style="color: #27ae60; font-weight: bold; margin-top: 10px;">
                    You save: $${(product.originalPrice - product.price).toFixed(2)}
                  </div>
                </div>

                ${product.quantityInStock > 0
                  ? `<p style="color: #27ae60;">✓ In Stock (${product.quantityInStock} available)</p>`
                  : `<p style="color: #e74c3c;">Currently Out of Stock</p>`
                }
              </div>

              <center>
                <a href="http://localhost:3000/product/${product._id}" class="cta-button">
                  View Product →
                </a>
              </center>

              <p style="margin-top: 30px; font-size: 14px; color: #777;">
                This discount won't last forever! Visit our store now to grab this deal.
              </p>
            </div>

            <div class="footer">
              <p>AO Comics - Your Premium Comic Book Store</p>
              <p>You received this email because this product is in your wishlist.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Discount email sent to ${userEmail} for product: ${product.name}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending discount email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send discount notifications to all users who have the product in wishlist
 * @param {object} product - Product object with discount
 * @param {array} users - Array of users who have this product in wishlist
 */
const notifyWishlistUsers = async (product, users) => {
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };

  for (const user of users) {
    const result = await sendDiscountNotification(user.email, user.name, product);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({ user: user.email, error: result.error });
    }
  }

  console.log(`Email notification results: ${results.sent} sent, ${results.failed} failed`);
  return results;
};

/**
 * Send refund approval email to customer
 * @param {string} userEmail - Customer's email address
 * @param {string} userName - Customer's name
 * @param {string} productName - Name of the refunded product
 * @param {number} quantity - Quantity being refunded
 * @param {number} refundAmount - Total refund amount
 */
const sendRefundApprovalEmail = async (userEmail, userName, productName, quantity, refundAmount) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: `✅ Refund Approved - $${refundAmount.toFixed(2)} for ${productName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .refund-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4CAF50; }
            .amount { font-size: 32px; color: #4CAF50; font-weight: bold; margin: 15px 0; }
            .info-row { padding: 10px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Refund Approved</h1>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Your refund request has been approved by our sales team!</p>

              <div class="refund-info">
                <h2>Refund Details</h2>

                <div class="info-row">
                  <strong>Product:</strong> ${productName}
                </div>

                <div class="info-row">
                  <strong>Quantity:</strong> ${quantity} ${quantity > 1 ? 'units' : 'unit'}
                </div>

                <div class="info-row">
                  <strong>Refund Amount:</strong>
                  <div class="amount">$${refundAmount.toFixed(2)}</div>
                </div>
              </div>

              <p><strong>What happens next?</strong></p>
              <ul>
                <li>The refund amount will be processed to your original payment method</li>
                <li>Please allow 5-7 business days for the refund to appear in your account</li>
                <li>You will receive a confirmation once the refund is processed</li>
              </ul>

              <p style="margin-top: 30px; font-size: 14px; color: #777;">
                If you have any questions about your refund, please contact our customer support.
              </p>
            </div>

            <div class="footer">
              <p>AO Comics - Your Premium Comic Book Store</p>
              <p>Thank you for shopping with us!</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Refund approval email sent to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending refund approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send refund rejection email to customer
 * @param {string} userEmail - Customer's email address
 * @param {string} userName - Customer's name
 * @param {string} productName - Name of the product
 * @param {string} rejectionReason - Reason for rejection
 */
const sendRefundRejectionEmail = async (userEmail, userName, productName, rejectionReason) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: `❌ Refund Request Declined - ${productName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .refund-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f44336; }
            .reason-box { background: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Refund Request Update</h1>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>We've reviewed your refund request for <strong>${productName}</strong>.</p>

              <div class="refund-info">
                <h3>Unfortunately, we cannot process this refund at this time.</h3>

                <div class="reason-box">
                  <strong>Reason:</strong><br>
                  ${rejectionReason}
                </div>
              </div>

              <p>If you believe this decision was made in error or have additional questions, please don't hesitate to contact our customer support team. We're here to help!</p>

              <p style="margin-top: 30px;">
                <strong>Contact Support:</strong><br>
                Use the live chat feature on our website or email us for assistance.
              </p>
            </div>

            <div class="footer">
              <p>AO Comics - Your Premium Comic Book Store</p>
              <p>We appreciate your understanding.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Refund rejection email sent to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending refund rejection email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendDiscountNotification,
  notifyWishlistUsers,
  sendRefundApprovalEmail,
  sendRefundRejectionEmail
};
