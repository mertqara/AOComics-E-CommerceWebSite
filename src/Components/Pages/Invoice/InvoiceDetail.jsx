// src/Components/Pages/Invoice/InvoiceDetail.jsx
import React from 'react';
import './InvoiceDetail.css';

const InvoiceDetail = ({ invoice, showActions = true, onPrint, onDownloadPDF }) => {
  if (!invoice) {
    return <div className="invoice-error">No invoice data available</div>;
  }

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    if (onDownloadPDF) {
      onDownloadPDF();
    } else {
      alert('Please use Print > Save as PDF in your browser');
      window.print();
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      paid: 'status-badge paid',
      draft: 'status-badge draft',
      cancelled: 'status-badge cancelled'
    };
    return statusClasses[status] || 'status-badge';
  };

  return (
    <div className="invoice-detail-container">
      <div className="invoice-header">
        <h1>INVOICE</h1>
        <div className="invoice-info">
          <p><strong>Invoice #:</strong> {invoice.invoiceNumber}</p>
          <p><strong>Date:</strong> {formatDate(invoice.invoiceDate)}</p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={getStatusBadge(invoice.status)}>
              {invoice.status.toUpperCase()}
            </span>
          </p>
        </div>
      </div>

      <div className="invoice-parties">
        <div className="company-info">
          <h2>AO Comics</h2>
          <p>123 Comic Street</p>
          <p>Istanbul, Turkey</p>
          <p>Email: contact@aocomics.com</p>
          <p>Phone: +90 (212) 555-0123</p>
        </div>

        <div className="customer-info">
          <h3>Bill To:</h3>
          <p><strong>{invoice.customerInfo?.name || 'N/A'}</strong></p>
          <p>{invoice.customerInfo?.email || 'N/A'}</p>
          <p>{invoice.customerInfo?.address || 'N/A'}</p>
          {invoice.customerInfo?.taxID && (
            <p>Tax ID: {invoice.customerInfo.taxID}</p>
          )}
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>${item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>

          {invoice.discount > 0 && (
            <div className="total-row discount">
              <span>Discount:</span>
              <span>-${invoice.discount.toFixed(2)}</span>
            </div>
          )}

          <div className="total-row">
            <span>Tax (18%):</span>
            <span>${invoice.tax.toFixed(2)}</span>
          </div>

          <div className="total-row grand-total">
            <span><strong>Total Amount:</strong></span>
            <span><strong>${invoice.totalAmount.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="invoice-notes">
          <h4>Notes:</h4>
          <p>{invoice.notes}</p>
        </div>
      )}

      <div className="invoice-footer">
        <p>Thank you for your business!</p>
        <p>For questions about this invoice, please contact us at support@aocomics.com</p>
      </div>

      {showActions && (
        <div className="invoice-actions no-print">
          <button onClick={handlePrint} className="btn-print">
            Print Invoice
          </button>
          <button onClick={handleDownloadPDF} className="btn-pdf">
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
