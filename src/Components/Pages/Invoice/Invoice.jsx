// src/Components/Pages/Invoice/Invoice.jsx
import React, { useEffect, useContext, useRef } from 'react'; // ✅ Add useRef
import { useLocation, useNavigate } from 'react-router-dom';
import { CartContext } from '../../../context/CartContext';
import API from '../../../services/api';
import './Invoice.css';

const Invoice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useContext(CartContext);
  const { orderData, paymentDetails, invoice } = location.state || {};
  
  // Prevent duplicate submissions
  const orderSubmitted = useRef(false);

  useEffect(() => {
    // If we reached here from Checkout with `orderData`, submit order if needed.
    // If we reached here with a server `invoice`, skip submission entirely.
    if (invoice) return;

    if (!orderData) return;

    if (orderSubmitted.current) return;

    if (orderData.orderId) {
      console.log('Order already created on server (orderId present), skipping submission.');
      orderSubmitted.current = true;
      try { clearCart(); } catch (e) { /* ignore */ }
      return;
    }

    const submitOrder = async () => {
      try {
        orderSubmitted.current = true;

        const orderItems = orderData.items.map(item => ({
          product: item.id,
          quantity: item.qty,
          price: item.price
        }));

        console.log('Submitting order with items:', orderItems);

        const response = await API.post('/orders', {
          orderItems,
          totalPrice: orderData.total,
          deliveryAddress: orderData.address
        });

        console.log('✅ Order created successfully:', response.data);
        clearCart();
      } catch (error) {
        console.error('❌ Order submission error:', error);
        console.error('Error response:', error.response?.data);
        orderSubmitted.current = false;
        const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Order was paid but there was an error saving it. Please contact support.';
        alert(errorMsg);
      }
    };

    submitOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    alert('Please use Print > Save as PDF in your browser');
    window.print();
  };

  // Prefer server-provided invoice if available
  if (!orderData && !invoice) {
    return (
      <div className="invoice-page">
        <h2>No invoice data found</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const invoiceNumber = invoice ? invoice.invoiceNumber : ('INV-' + Date.now().toString().slice(-8));
  const invoiceDate = invoice ? new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate values based on whether we have a server invoice or local orderData
  let subtotal, tax, totalAmount;

  if (invoice) {
    subtotal = invoice.subtotal;
    tax = invoice.tax;
    totalAmount = invoice.totalAmount;
  } else if (orderData) {
    // Calculate from orderData
    subtotal = orderData.total;
    tax = subtotal * 0.18; // 18% VAT
    totalAmount = subtotal + tax;
  } else {
    subtotal = 0;
    tax = 0;
    totalAmount = 0;
  }

  return (
    <div className="invoice-page">
      <div className="invoice-container">
        <div className="invoice-header">
          <h1>INVOICE</h1>
          <div className="invoice-info">
            <p><strong>Invoice #:</strong> {invoiceNumber}</p>
            <p><strong>Date:</strong> {invoiceDate}</p>
            <p><strong>Payment Status:</strong> <span className="paid-badge">PAID</span></p>
          </div>
        </div>

        <div className="company-info">
          <h2>AO Comics</h2>
          <p>123 Comic Street</p>
          <p>Istanbul, Turkey</p>
          <p>contact@aocomics.com</p>
        </div>

        <div className="customer-info">
          <h3>Deliver To:</h3>
          <p>{ invoice ? (invoice.customerInfo?.address || invoice.customerInfo?.email) : orderData.address }</p>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice ? invoice.items : orderData.items).map((item, index) => (
              <tr key={index}>
                <td>{item.name || item.product?.name}</td>
                <td>{item.quantity || item.qty}</td>
                <td>${(item.price || item.product?.price || 0).toFixed(2)}</td>
                <td>${((item.total) || (item.quantity || item.qty) * (item.price || item.product?.price || 0)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-total">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Tax (18% VAT):</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Shipping:</span>
            <span>FREE</span>
          </div>
          <div className="total-row grand-total">
            <span><strong>Total Paid:</strong></span>
            <span><strong>${totalAmount.toFixed(2)}</strong></span>
          </div>
        </div>

        <div className="payment-method">
          {invoice ? (
            <>
              <p><strong>Invoice To:</strong> {invoice.customerInfo?.name} ({invoice.customerInfo?.email})</p>
            </>
          ) : (
            <>
              <p><strong>Payment Method:</strong> Credit Card ({paymentDetails?.cardNumber})</p>
              <p><strong>Cardholder:</strong> {paymentDetails?.cardName}</p>
            </>
          )}
        </div>

        <div className="invoice-footer">
          <p>Thank you for your purchase!</p>
          <p>For questions, contact us at support@aocomics.com</p>
        </div>

        <div className="invoice-actions no-print">
          <button onClick={handlePrint}>Print Invoice</button>
          <button onClick={handleDownloadPDF}>Download PDF</button>
          <button onClick={() => navigate('/orders')}>View My Orders</button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;