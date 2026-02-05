import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API from '../../../services/api';
import './SalesManager.css';
import InvoiceDetail from '../Invoice/InvoiceDetail';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function SalesManager() {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [newPrice, setNewPrice] = useState('');
  const [selectedProductForPrice, setSelectedProductForPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [detailedMetrics, setDetailedMetrics] = useState(null);

  // Invoice features
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  // Refund features
  const [refunds, setRefunds] = useState([]);
  const [refundFilter, setRefundFilter] = useState('pending');
  const [refundStats, setRefundStats] = useState(null);

  useEffect(() => {
    fetchProducts();

    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    const defaultStartDate = formatDate(thirtyDaysAgo);
    const defaultEndDate = formatDate(today);

    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);

    // Automatically fetch analytics with default date range
    const fetchInitialAnalytics = async () => {
      try {
        const res = await API.get(`/sales/analytics?startDate=${defaultStartDate}&endDate=${defaultEndDate}`);
        setAnalytics(res.data);
      } catch (error) {
        console.error('Error fetching initial analytics:', error);
      }
    };

    fetchInitialAnalytics();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await API.get('/products');
      setProducts(res.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to load products. Please check if the backend server is running.');
    }
  };

  const applyDiscount = async () => {
    await API.post('/sales/discount', {
      productIds: selectedProducts,
      discountPercentage: discount
    });
    alert('Discount applied!');
    fetchProducts();
  };

  const removeDiscount = async () => {
    try {
      await API.post('/sales/undiscount', {
        productIds: selectedProducts
      });

      alert('Discounts disabled and prices restored!');
      fetchProducts();
    } catch (error) {
      console.error('Error removing discount:', error);
      alert('Failed to remove discount.');
    }
  };

  const setProductPrice = async () => {
    if (!selectedProductForPrice) {
      alert('Please select a product');
      return;
    }
    if (!newPrice || parseFloat(newPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    try {
      await API.patch(`/sales/set-price/${selectedProductForPrice}`, {
        price: parseFloat(newPrice)
      });

      alert('Price updated successfully!');
      setNewPrice('');
      setSelectedProductForPrice('');
      fetchProducts();
    } catch (error) {
      console.error('Error setting price:', error);
      alert(error.response?.data?.message || 'Failed to set price');
    }
  };

  const getAnalytics = async () => {
    try {
      const res = await API.get(`/sales/analytics?startDate=${startDate}&endDate=${endDate}`);
      setAnalytics(res.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      alert('Failed to fetch analytics');
    }
  };

  // Enhanced invoice fetching with statistics
  const getInvoices = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    try {
      // Fetch invoices
      const invoicesRes = await API.get(
        `/invoices?startDate=${startDate}&endDate=${endDate}`
      );
      setInvoices(invoicesRes.data);

      // Fetch invoice statistics
      const statsRes = await API.get(
        `/invoices/stats/summary?startDate=${startDate}&endDate=${endDate}`
      );
      setInvoiceStats(statsRes.data);

    } catch (error) {
      console.error('Error fetching invoices:', error);
      alert('Failed to fetch invoices. Make sure you are using server.js');
    }
  };

  const getDetailedMetrics = async () => {
    const res = await API.get(`/sales/detailed-metrics?startDate=${startDate}&endDate=${endDate}`);
    setDetailedMetrics(res.data);
  };

  const viewInvoiceDetail = async (invoiceId) => {
    try {
      const res = await API.get(`/invoices/${invoiceId}`);
      setSelectedInvoice(res.data);
      setShowInvoiceDetail(true);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      alert('Failed to fetch invoice details');
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    alert('Use your browser\'s Print > Save as PDF option');
    window.print();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Fetch refund requests
  const fetchRefunds = async () => {
    try {
      const res = await API.get(`/sales/refunds?status=${refundFilter}`);
      setRefunds(res.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to load refunds');
    }
  };

  // Fetch refund statistics
  const fetchRefundStats = async () => {
    try {
      const res = await API.get('/sales/refunds/statistics');
      setRefundStats(res.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to load refund statistics');
    }
  };

  // Approve refund
  const approveRefund = async (refundId) => {
    if (!window.confirm('Are you sure you want to approve this refund? The product will be added back to stock.')) {
      return;
    }

    try {
      await API.patch(`/sales/refunds/${refundId}/approve`, {});
      alert('Refund approved successfully!');
      fetchRefunds();
      fetchRefundStats();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve refund');
    }
  };

  // Reject refund
  const rejectRefund = async (refundId) => {
    const reason = prompt('Please enter the reason for rejection:');
    if (!reason || reason.trim() === '') {
      alert('Rejection reason is required');
      return;
    }

    try {
      await API.patch(`/sales/refunds/${refundId}/reject`, { rejectionReason: reason });
      alert('Refund rejected');
      fetchRefunds();
      fetchRefundStats();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject refund');
    }
  };

  // Check if refund is within 30-day window
  const isRefundExpired = (refund) => {
    if (!refund.order?.deliveryCompletedAt) {
      return true; // No delivery date = expired
    }
    const daysSinceDelivery = Math.floor((Date.now() - new Date(refund.order.deliveryCompletedAt)) / (1000 * 60 * 60 * 24));
    return daysSinceDelivery > 30;
  };

  return (
    <div className="sales-manager-claude">
      <h1>Sales Manager Dashboard</h1>

      {/* Set Price Section */}
      <div className="section">
        <h2>Set Product Price</h2>
        <select
          value={selectedProductForPrice}
          onChange={(e) => setSelectedProductForPrice(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        >
          <option value="">-- Select a Product --</option>
          {products.map(p => (
            <option key={p._id} value={p._id}>
              {p.name} - Current Price: ${p.price}
            </option>
          ))}
        </select>

        <div className="price-input-group" style={{ marginBottom: '10px' }}>
          <input
            type="number"
            placeholder="New Price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            step="0.01"
            min="0"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <button onClick={setProductPrice} className="btn-primary" style={{ width: '100%' }}>
          Set Price
        </button>
      </div>

      {/* Apply Discount Section */}
      <div className="section">
        <h2>Apply Discount</h2>
        <select multiple onChange={(e) => setSelectedProducts(Array.from(e.target.selectedOptions, opt => opt.value))}>
          {products.map(p => (
            <option key={p._id} value={p._id}>
              {p.name} - ${p.price} {p.originalPrice && p.originalPrice !== p.price ? `(Original: $${p.originalPrice})` : ''}
            </option>
          ))}
        </select>

        <div className="discountRate">
          <input type="number" placeholder="Discount %" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>

        <div className="button-group">
          <button onClick={applyDiscount}>Apply Discount</button>
          <button onClick={removeDiscount} className="btn-secondary">
            Disable Discount
          </button>
        </div>
      </div>

      {/* Date Range Filter Section */}
      <div className="section date-filter-section">
        <h2>Select Date Range</h2>
        <div className="date-inputs">
          <div className="date-input-group">
            <label>Start Date:</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="date-input-group">
            <label>End Date:</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Revenue & Profit Section */}
      <div className="section">
        <h2>Revenue & Profit</h2>
        <button onClick={getAnalytics}>Get Analytics</button>
        {analytics && (
          <div className="analytics">
            <p><strong>Revenue:</strong> ${analytics.revenue.toFixed(2)}</p>
            <p><strong>Cost:</strong> ${analytics.cost.toFixed(2)}</p>
            <p><strong>Profit:</strong> ${analytics.profit.toFixed(2)}</p>
            <p><strong>Orders:</strong> {analytics.orderCount}</p>
            <p><strong>Average Order Value:</strong> ${analytics.averageOrderValue.toFixed(2)}</p>
            <p><strong>Profit Margin:</strong> {((analytics.profit / analytics.revenue) * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Detailed Sales Metrics Section */}
      <div className="section">
        <h2>Detailed Sales Metrics</h2>
        <button onClick={getDetailedMetrics}>Get Detailed Metrics</button>

        {detailedMetrics && (
          <div className="detailed-metrics">
            <div className="metrics-summary">
              <h3>Summary</h3>
              <div className="summary-grid">
                <div><strong>Total Items Sold:</strong> {detailedMetrics.totalItemsSold}</div>
                <div><strong>Total Orders:</strong> {detailedMetrics.totalOrders}</div>
                <div><strong>Successful Orders:</strong> {detailedMetrics.successfulOrders}</div>
                <div><strong>Cancelled Orders:</strong> {detailedMetrics.cancelledOrders}</div>
                <div><strong>Cancellation Rate:</strong> {detailedMetrics.cancellationRate}%</div>
              </div>
            </div>

            <div className="top-products">
              <h3>Top 5 Selling Products</h3>
              {detailedMetrics.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={detailedMetrics.topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="quantitySold" fill="#3498db" name="Quantity Sold" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No products sold in this period</p>
              )}
            </div>

            <div className="category-breakdown">
              <h3>Revenue by Category</h3>
              {detailedMetrics.categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={detailedMetrics.categoryBreakdown}
                      dataKey="revenue"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.category}: $${entry.revenue.toFixed(0)}`}
                    >
                      {detailedMetrics.categoryBreakdown.map((entry, index) => {
                        const colors = ['#ff4141', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#e74c3c'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p>No category data available</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Invoice Management Section */}
      <div className="section invoice-section">
        <h2>Invoice Management</h2>
        <button onClick={getInvoices} className="btn-primary">Get Invoices</button>

        {/* Invoice Statistics */}
        {invoiceStats && (
          <div className="invoice-stats">
            <h3>Invoice Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Invoices</span>
                <span className="stat-value">{invoiceStats.totalInvoices}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Revenue</span>
                <span className="stat-value">${invoiceStats.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Tax</span>
                <span className="stat-value">${invoiceStats.totalTax.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Paid Invoices</span>
                <span className="stat-value">{invoiceStats.paidInvoices}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Cancelled</span>
                <span className="stat-value">{invoiceStats.cancelledInvoices}</span>
              </div>
            </div>
          </div>
        )}

        {/* Invoice List */}
        {invoices.length > 0 && (
          <div className="invoices-list">
            <h3>Invoices ({invoices.length})</h3>
            <div className="invoice-table-container">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(invoice => (
                    <tr key={invoice._id}>
                      <td className="invoice-number">{invoice.invoiceNumber}</td>
                      <td>{formatDate(invoice.invoiceDate)}</td>
                      <td>
                        <div className="customer-info">
                          <div>{invoice.customer?.name || 'N/A'}</div>
                          <small>{invoice.customer?.email || 'N/A'}</small>
                        </div>
                      </td>
                      <td>{invoice.items.length}</td>
                      <td className="amount">${invoice.totalAmount.toFixed(2)}</td>
                      <td>
                        <span className={`status-badge ${invoice.status}`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => viewInvoiceDetail(invoice._id)}
                          className="btn-view"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {invoices.length === 0 && invoiceStats && (
          <p className="no-data">No invoices found for the selected date range.</p>
        )}
      </div>

      {/* Refund Management Section */}
      <div className="section">
        <h2>Refund Management</h2>
        <div style={{ marginBottom: '20px' }}>
          <button onClick={fetchRefundStats}>Get Refund Statistics</button>
          {refundStats && (
            <div className="analytics" style={{ marginTop: '15px' }}>
              <p><strong>Total Refund Requests:</strong> {refundStats.total}</p>
              <p><strong>Pending:</strong> {refundStats.byStatus.pending}</p>
              <p><strong>Approved:</strong> {refundStats.byStatus.approved}</p>
              <p><strong>Rejected:</strong> {refundStats.byStatus.rejected}</p>
              <p><strong>Total Refunded Amount:</strong> ${refundStats.totalRefundAmount.toFixed(2)}</p>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}>Filter by Status:</label>
          <select value={refundFilter} onChange={(e) => setRefundFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={fetchRefunds} style={{ marginLeft: '10px' }}>Load Refunds</button>
        </div>

        <div className="refunds-list">
          {refunds.length === 0 ? (
            <p>No refund requests found</p>
          ) : (
            refunds.map(refund => (
              <div key={refund._id} className="refund-card" style={{
                background: 'white',
                padding: '20px',
                marginBottom: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderLeft: `4px solid ${
                  refund.status === 'pending' ? '#ff9800' :
                  refund.status === 'approved' ? '#4caf50' : '#f44336'
                }`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ marginBottom: '5px' }}>{refund.product?.name || 'Product deleted'}</h4>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      Customer: {refund.user?.name} ({refund.user?.email})
                    </p>
                  </div>
                  <span style={{
                    padding: '5px 10px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'white',
                    background: refund.status === 'pending' ? '#ff9800' :
                               refund.status === 'approved' ? '#4caf50' : '#f44336'
                  }}>
                    {refund.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ marginBottom: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '5px' }}>
                  <p><strong>Quantity:</strong> {refund.quantity}</p>
                  <p><strong>Refund Amount:</strong> ${refund.refundAmount.toFixed(2)}</p>
                  <p><strong>Reason:</strong> {refund.reason}</p>
                  <p style={{ fontSize: '13px', color: '#777' }}>
                    <strong>Requested:</strong> {new Date(refund.createdAt).toLocaleString()}
                  </p>
                  {refund.order?.deliveryCompletedAt && (
                    <p style={{ fontSize: '13px', color: '#777' }}>
                      <strong>Delivered:</strong> {new Date(refund.order.deliveryCompletedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {refund.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    {isRefundExpired(refund) && (
                      <div style={{
                        padding: '10px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '5px',
                        color: '#856404',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        ⚠️ This refund is outside the 30-day window and cannot be approved
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => approveRefund(refund._id)}
                        disabled={isRefundExpired(refund)}
                        style={{
                          padding: '8px 16px',
                          background: isRefundExpired(refund) ? '#ccc' : '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: isRefundExpired(refund) ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          opacity: isRefundExpired(refund) ? 0.6 : 1
                        }}
                      >
                        Approve Refund
                      </button>
                      <button
                        onClick={() => rejectRefund(refund._id)}
                        style={{
                          padding: '8px 16px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Reject Refund
                      </button>
                    </div>
                  </div>
                )}

                {refund.status === 'approved' && refund.reviewedBy && (
                  <p style={{ fontSize: '13px', color: '#4caf50', marginTop: '10px' }}>
                    ✓ Approved by {refund.reviewedBy.name} on {new Date(refund.reviewedAt).toLocaleString()}
                  </p>
                )}

                {refund.status === 'rejected' && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#ffebee', borderRadius: '5px' }}>
                    <p style={{ fontSize: '13px', color: '#c62828' }}>
                      <strong>Rejection Reason:</strong> {refund.rejectionReason}
                    </p>
                    {refund.reviewedBy && (
                      <p style={{ fontSize: '13px', color: '#666' }}>
                        Rejected by {refund.reviewedBy.name} on {new Date(refund.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {showInvoiceDetail && selectedInvoice && (
        <div className="modal-overlay no-print" onClick={() => setShowInvoiceDetail(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowInvoiceDetail(false)}
            >
              ×
            </button>
            <InvoiceDetail
              invoice={selectedInvoice}
              showActions={true}
              onPrint={handlePrintInvoice}
              onDownloadPDF={handleDownloadPDF}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesManager;
