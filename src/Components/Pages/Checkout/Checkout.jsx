// src/Components/Pages/Checkout/Checkout.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import './Checkout.css';

const Checkout = () => {
  const [cart, setCart] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Payment Information States
  const [cardHolderName, setCardHolderName] = useState('');
  const [creditCardNumber, setCreditCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('Please login to checkout');
      navigate('/login');
      return;
    }

    // Get user info
    const userData = sessionStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Pre-fill delivery address if available
      if (parsedUser.homeAddress) {
        setDeliveryAddress(parsedUser.homeAddress);
      }
    }

    // Load cart from localStorage
    const savedCart = sessionStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        console.log('Loaded cart:', parsedCart);
        
        // Ensure cart items have proper structure
        const normalizedCart = parsedCart.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0
        }));
        
        setCart(normalizedCart);
      } catch (error) {
        console.error('Error parsing cart:', error);
        alert('Error loading cart');
        navigate('/cart');
      }
    } else {
      alert('Your cart is empty');
      navigate('/cart');
    }
  }, [navigate]);

  const calculateSubtotal = () => {
    const subtotal = cart.reduce((total, item) => {
      const quantity = parseInt(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return total + (price * quantity);
    }, 0);
    return subtotal;
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const validatePaymentInfo = () => {
    // Validate cardholder name
    if (!cardHolderName.trim()) {
      alert('Please enter cardholder name');
      return false;
    }

    // Validate credit card number
    const cleanCardNumber = creditCardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleanCardNumber)) {
      alert('Please enter a valid credit card number (13-19 digits)');
      return false;
    }

    // Validate expiry date
    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      alert('Please enter expiry date in MM/YY format');
      return false;
    }

    // Check if card is expired
    const [month, year] = expiryDate.split('/');
    const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
    const now = new Date();
    if (expiry < now) {
      alert('Card has expired');
      return false;
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      alert('Please enter a valid CVV (3-4 digits)');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    if (!deliveryAddress.trim()) {
      alert('Please enter delivery address');
      return;
    }

    // Validate payment information
    if (!validatePaymentInfo()) {
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        orderItems: cart.map(item => ({
          product: item._id,
          name: item.name,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0
        })),
        totalPrice: calculateTotal(),
        deliveryAddress: deliveryAddress.trim(),
        paymentInfo: {
          creditCardNumber: creditCardNumber,
          cardHolderName: cardHolderName,
          expiryDate: expiryDate
          // CVV is intentionally NOT sent to backend for security
        }
      };

      console.log('Sending order:', orderData);

      const response = await API.post('/orders', orderData);

      // Clear cart
      sessionStorage.removeItem('cart');
      setCart([]);

      const orderDataForInvoice = {
        items: cart.map(item => ({ id: item._id, name: item.name, qty: parseInt(item.quantity) || 1, price: parseFloat(item.price) || 0 })),
        address: deliveryAddress.trim(),
        total: calculateTotal()
      };

      const paymentDetails = {
        cardNumber: creditCardNumber.replace(/\s/g, '').replace(/.(?=.{4})/g, '*'),
        cardName: cardHolderName
      };

      // include server order id so invoice page doesn't re-submit the order
      orderDataForInvoice.orderId = response.data.order._id || response.data.order?.id;
      alert('Order placed successfully! Order ID: ' + response.data.order._id);
      navigate('/invoice', { state: { orderData: orderDataForInvoice, paymentDetails } });
    } catch (error) {
      console.error('Place order error:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <h1>Checkout</h1>
          <p>Your cart is empty</p>
          <button onClick={() => navigate('/products')} className="continue-shopping-btn">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1>Checkout</h1>

        <div className="checkout-layout">
          {/* Order Summary */}
          <div className="order-summary">
            <h2>Order Summary</h2>
            
            <div className="summary-items">
              {cart.map((item, index) => (
                <div key={index} className="summary-item">
                  <div className="item-info">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="item-thumbnail" />
                    )}
                    <div>
                      <h4>{item.name}</h4>
                      <p className="item-quantity">Qty: {item.quantity || 1}</p>
                    </div>
                  </div>
                  <div className="item-price">
                    ${((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="summary-totals">
              <div className="total-row">
                <span>Subtotal:</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="total-row total-final">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="checkout-form-container">
            <form onSubmit={handlePlaceOrder} className="checkout-form">
              
              {/* Delivery Information */}
              <div className="checkout-section">
                <h3>📦 Delivery Information</h3>
                
                {user && (
                  <div className="user-info">
                    <p><strong>Name:</strong> {user.name}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                  </div>
                )}

                <div className="form-group">
                  <label>Delivery Address *</label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter your full delivery address"
                    rows="4"
                    required
                  />
                </div>
              </div>

              {/* Payment Information */}
              <div className="checkout-section">
                <h3>💳 Payment Information</h3>
                
                <div className="form-group">
                  <label>Cardholder Name *</label>
                  <input
                    type="text"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Credit Card Number *</label>
                  <input
                    type="text"
                    value={creditCardNumber}
                    onChange={(e) => {
                      // Auto-format with spaces every 4 digits
                      const value = e.target.value.replace(/\s/g, '');
                      const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                      if (formatted.replace(/\s/g, '').length <= 19) {
                        setCreditCardNumber(formatted);
                      }
                    }}
                    placeholder="4111 1111 1111 1111"
                    maxLength="23"
                    required
                  />
                </div>

                <div className="payment-row">
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input
                      type="text"
                      value={expiryDate}
                      onChange={(e) => {
                        // Auto-format MM/YY
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '/' + value.slice(2, 4);
                        }
                        setExpiryDate(value);
                      }}
                      placeholder="12/27"
                      maxLength="5"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>CVV *</label>
                    <input
                      type="text"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      placeholder="123"
                      maxLength="4"
                      required
                    />
                    <small className="cvv-note">
                      (Not stored for security)
                    </small>
                  </div>
                </div>

                <div className="security-notice">
                  🔒 Your payment information is encrypted and secure
                </div>
              </div>

              {/* Place Order Button */}
              <button 
                type="submit" 
                className="place-order-btn"
                disabled={loading}
              >
                {loading ? 'Processing...' : `Place Order - $${calculateTotal().toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;