// src/Components/Pages/Payment/Payment.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Payment.css';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderData } = location.state || {};
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessing(true);

    // Mock payment processing (2 second delay)
    setTimeout(() => {
      // Payment successful - navigate to invoice
      navigate('/invoice', { 
        state: { 
          orderData,
          paymentDetails: {
            cardNumber: '**** **** **** ' + cardNumber.slice(-4),
            cardName
          }
        } 
      });
    }, 2000);
  };

  if (!orderData) {
    return (
      <div className="payment-page">
        <h2>No order data found</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <h1>Payment</h1>
      
      <div className="payment-layout">
        {/* Order Summary */}
        <div className="order-summary-box">
          <h2>Order Summary</h2>
          {orderData.items.map(item => (
            <div key={item.id} className="summary-item">
              <span>{item.name} x {item.qty}</span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-total">
            <strong>Total:</strong>
            <strong>${orderData.total.toFixed(2)}</strong>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handlePayment} className="payment-form">
          <h2>Payment Details</h2>
          
          <label>Card Number</label>
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            maxLength="16"
            required
          />

          <label>Cardholder Name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            required
          />

          <div className="form-row">
            <div>
              <label>Expiry Date</label>
              <input
                type="text"
                placeholder="MM/YY"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                maxLength="5"
                required
              />
            </div>
            <div>
              <label>CVV</label>
              <input
                type="text"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                maxLength="3"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={processing}>
            {processing ? 'Processing Payment...' : 'Pay Now'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Payment;