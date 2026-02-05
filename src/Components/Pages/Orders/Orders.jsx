// src/Components/Pages/Orders/Orders.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [refundQuantity, setRefundQuantity] = useState(1);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await API.get('/orders/my-orders');
      console.log('Orders response:', response.data);
      
      // Handle both response formats
      if (Array.isArray(response.data)) {
        setOrders(response.data);
      } else if (response.data.orders && Array.isArray(response.data.orders)) {
        setOrders(response.data.orders);
      } else {
        console.error('Unexpected response format:', response.data);
        setOrders([]);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
      if (error.response?.status === 401) {
        alert('Please login to view orders');
        navigate('/login');
      } else {
        alert('Failed to load orders');
      }
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'processing': 'status-processing',
      'in-transit': 'status-transit',
      'delivered': 'status-delivered',
      'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-processing';
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleRequestRefund = (order, item) => {
    setSelectedOrder(order);
    setSelectedProduct(item);
    setRefundQuantity(1);
    setRefundReason('');
    setShowRefundModal(true);
  };

  const submitRefund = async () => {
    if (!refundReason.trim()) {
      alert('Please provide a reason for the refund');
      return;
    }

    if (submittingRefund) {
      return; // Prevent multiple submissions
    }

    // Check 30-day window before submission
    if (!canRequestRefund(selectedOrder)) {
      alert('This order is no longer eligible for refund. The 30-day window has expired.');
      setShowRefundModal(false);
      return;
    }

    setSubmittingRefund(true);

    try {
      await API.post('/refunds/request', {
        orderId: selectedOrder._id,
        productId: selectedProduct.product._id,
        quantity: refundQuantity,
        reason: refundReason
      });

      alert('Refund request submitted successfully!');
      setShowRefundModal(false);
      fetchOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit refund request');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const canRequestRefund = (order) => {
    console.log('Checking refund eligibility:', {
      orderId: order._id,
      status: order.status,
      deliveryCompletedAt: order.deliveryCompletedAt,
      hasDeliveryDate: !!order.deliveryCompletedAt
    });

    if (order.status !== 'delivered') {
      console.log('Order not delivered');
      return false;
    }
    if (!order.deliveryCompletedAt) {
      console.log('No deliveryCompletedAt timestamp');
      return false;
    }

    const daysSinceDelivery = Math.floor((Date.now() - new Date(order.deliveryCompletedAt)) / (1000 * 60 * 60 * 24));
    console.log('Days since delivery:', daysSinceDelivery);
    return daysSinceDelivery <= 30;
  };

  const canCancelOrder = (order) => {
    // CS 308 Requirement 14: Orders can only be cancelled if status is "processing"
    return order.status === 'processing';
  };

  const handleCancelOrder = async (orderId) => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this order? This action cannot be undone.'
    );

    if (!confirmCancel) {
      return;
    }

    try {
      await API.put(`/orders/${orderId}/cancel`);
      alert('Order cancelled successfully!');
      fetchOrders(); // Reload orders
    } catch (error) {
      console.error('Cancel order error:', error);
      alert(error.response?.data?.message || 'Failed to cancel order');
    }
  };

  const handleViewInvoice = async (orderId) => {
    try {
      const resp = await API.get(`/invoices/order/${orderId}`);
      const invoice = resp.data;
      // Navigate to invoice page and pass invoice object
      navigate('/invoice', { state: { invoice } });
    } catch (error) {
      if (error.response?.status === 404) {
        // Invoice not found - try to create it first, then retry
        console.log('Invoice not found, attempting to create it...');
        try {
          // Create invoice for this specific order
          await API.post('/invoices', { orderId });
          console.log('Invoice created successfully, fetching again...');

          // Retry fetching the invoice
          const retryResp = await API.get(`/invoices/order/${orderId}`);
          const invoice = retryResp.data;
          navigate('/invoice', { state: { invoice } });
        } catch (createError) {
          console.error('Failed to create invoice:', createError);
          // If creation fails, show the order as a fallback invoice
          const order = orders.find(o => o._id === orderId);
          if (order) {
            // Generate invoice data from order
            const invoiceData = {
              items: order.orderItems.map(item => ({
                name: item.product?.name || item.name,
                qty: item.quantity,
                price: item.price,
                product: { name: item.product?.name || item.name, price: item.price }
              })),
              total: order.totalPrice,
              address: order.deliveryAddress
            };
            navigate('/invoice', { state: { orderData: invoiceData } });
          } else {
            alert('Invoice not found and could not be created');
          }
        }
      } else if (error.response?.status === 403) {
        alert('You are not authorized to view this invoice');
      } else {
        console.error('Fetch invoice error:', error);
        alert('Failed to load invoice');
      }
    }
  };

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-container">
          <h1>My Orders</h1>
          <div className="loading-message">Loading your orders...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-container">
        <h1>My Orders</h1>

        {orders.length === 0 ? (
          <div className="no-orders">
            <p>You haven't placed any orders yet.</p>
            <button onClick={() => navigate('/products')} className="shop-now-btn">
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order._id} className="order-card">
                {/* Order Header */}
                <div className="order-header">
                  <div className="order-info">
                    <h3>Order #{order._id?.slice(-8) || 'N/A'}</h3>
                    <p className="order-date">
                      Placed on {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="order-status">
                    <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="order-items">
                  {order.orderItems && order.orderItems.map((item, index) => (
                    <div key={index} className="order-item">
                      {item.product?.imageUrl && (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name || item.name}
                          className="order-item-image"
                        />
                      )}
                      <div className="order-item-details">
                        <h4>{item.product?.name || item.name}</h4>
                        <p className="item-quantity">Quantity: {item.quantity}</p>
                        <p className="item-price">${(item.price * item.quantity).toFixed(2)}</p>
                        {canRequestRefund(order) && (item.availableForRefund > 0) && (
                          <button
                            className="refund-btn"
                            onClick={() => handleRequestRefund(order, item)}
                          >
                            Request Refund
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className="order-footer">
                  <div className="order-address">
                    <strong>Delivery Address:</strong>
                    <p>{order.deliveryAddress}</p>
                  </div>
                  
                  {/* Payment Info with Masked Card */}
                  {order.paymentInfo && (
                    <div className="order-payment">
                      <strong>Payment:</strong>
                      <p>💳 {order.paymentInfo.creditCardNumber || 'Card ending in ****'}</p>
                      <p>{order.paymentInfo.cardHolderName}</p>
                    </div>
                  )}

                  <div className="order-total">
                    <strong>Total:</strong>
                    <span className="total-amount">${order.totalPrice?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Order Actions - Cancel Button + Invoice */}
                <div className="order-actions">
                  {canCancelOrder(order) && (
                    <button
                      className="cancel-order-btn"
                      onClick={() => handleCancelOrder(order._id)}
                    >
                      Cancel Order
                    </button>
                  )}

                  <button
                    className="view-invoice-btn"
                    onClick={() => handleViewInvoice(order._id)}
                  >
                    View / Download Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refund Modal */}
        {showRefundModal && selectedProduct && (
          <div className="modal-overlay" onClick={() => setShowRefundModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Request Refund</h2>
              <div className="refund-product-info">
                <h3>{selectedProduct.product?.name || selectedProduct.name}</h3>
                <p>Price: ${selectedProduct.price}</p>
                <p>Ordered Quantity: {selectedProduct.quantity}</p>
              </div>

                <div className="refund-form">
                <label>
                  Quantity to Refund:
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.availableForRefund || selectedProduct.quantity}
                    value={refundQuantity}
                    onChange={(e) => setRefundQuantity(parseInt(e.target.value))}
                  />
                </label>

                <label>
                  Reason for Refund:
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Please explain why you'd like to return this product..."
                    rows="4"
                    required
                  />
                </label>

                <div className="refund-amount">
                  <strong>Refund Amount: ${(selectedProduct.price * refundQuantity).toFixed(2)}</strong>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={submitRefund}
                    disabled={submittingRefund}
                  >
                    {submittingRefund ? 'Submitting...' : 'Submit Refund Request'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowRefundModal(false)}
                    disabled={submittingRefund}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;