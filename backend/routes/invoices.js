// backend/routes/invoices.js
const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');

// Create invoice from order (auto-called when order is placed, or manually by sales manager)
router.post('/', auth, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ order: orderId });
    if (existingInvoice) {
      return res.status(400).json({
        message: 'Invoice already exists for this order',
        invoice: existingInvoice
      });
    }

    // Get order details
    const order = await Order.findById(orderId)
      .populate('orderItems.product')
      .populate('user');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization - user can only create invoices for their own orders (unless sales_manager)
    if (req.user.role !== 'sales_manager' &&
        order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to create invoice for this order' });
    }

    // Calculate invoice items with totals
    const invoiceItems = order.orderItems.map(item => ({
      product: item.product._id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price
    }));

    // Calculate subtotal
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate tax (18% VAT - you can adjust this)
    const tax = subtotal * 0.18;

    // Total amount
    const totalAmount = subtotal + tax;

    // Create invoice
    const invoice = new Invoice({
      order: order._id,
      customer: order.user._id,
      customerInfo: {
        name: order.user.name,
        email: order.user.email,
        address: order.deliveryAddress,
        taxID: order.user.taxID || ''
      },
      items: invoiceItems,
      subtotal,
      discount: 0,
      tax,
      totalAmount,
      invoiceDate: order.createdAt,
      status: 'paid'
    });

    await invoice.save();

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice
    });

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Server error while creating invoice' });
  }
});

// Get all invoices with date range filter (for sales manager)
router.get('/', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};

    // Apply date range filter if provided
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) {
        query.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = end;
      }
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'name email')
      .populate('order')
      .sort({ invoiceDate: -1 });

    res.json(invoices);

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Server error while fetching invoices' });
  }
});

// Get single invoice by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'name email taxID')
      .populate('order')
      .populate('items.product');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check authorization - user can only view their own invoices (unless sales_manager)
    if (req.user.role !== 'sales_manager' &&
        invoice.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    res.json(invoice);

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error while fetching invoice' });
  }
});

// Get invoice by order ID
router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ order: req.params.orderId })
      .populate('customer', 'name email taxID')
      .populate('order')
      .populate('items.product');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found for this order' });
    }

    // Check authorization
    if (req.user.role !== 'sales_manager' &&
        invoice.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    res.json(invoice);

  } catch (error) {
    console.error('Get invoice by order error:', error);
    res.status(500).json({ message: 'Server error while fetching invoice' });
  }
});

// Update invoice status (for sales manager)
router.patch('/:id/status', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['draft', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('customer', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      message: 'Invoice status updated',
      invoice
    });

  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ message: 'Server error while updating invoice' });
  }
});

// Get invoice statistics (for sales manager dashboard)
router.get('/stats/summary', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateQuery = {};
    if (startDate || endDate) {
      dateQuery.invoiceDate = {};
      if (startDate) dateQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.invoiceDate.$lte = end;
      }
    }

    const invoices = await Invoice.find(dateQuery);

    const stats = {
      totalInvoices: invoices.length,
      totalRevenue: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalTax: invoices.reduce((sum, inv) => sum + inv.tax, 0),
      paidInvoices: invoices.filter(inv => inv.status === 'paid').length,
      cancelledInvoices: invoices.filter(inv => inv.status === 'cancelled').length
    };

    res.json(stats);

  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({ message: 'Server error while fetching invoice statistics' });
  }
});

// Create invoices for all orders without invoices (admin/sales_manager only)
router.post('/create-missing', auth, checkRole('sales_manager'), async (req, res) => {
  try {
    // Find all orders that don't have invoices
    const orders = await Order.find({})
      .populate('orderItems.product')
      .populate('user');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        // Check if invoice already exists
        const existingInvoice = await Invoice.findOne({ order: order._id });
        if (existingInvoice) {
          skipped++;
          continue;
        }

        // Calculate invoice items
        const invoiceItems = order.orderItems.map(item => ({
          product: item.product._id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        }));

        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        const tax = subtotal * 0.18;
        const totalAmount = subtotal + tax;

        // Create invoice
        const invoice = new Invoice({
          order: order._id,
          customer: order.user._id,
          customerInfo: {
            name: order.user.name,
            email: order.user.email,
            address: order.deliveryAddress,
            taxID: order.user.taxID || ''
          },
          items: invoiceItems,
          subtotal,
          discount: 0,
          tax,
          totalAmount,
          invoiceDate: order.createdAt,
          status: 'paid'
        });

        await invoice.save();
        created++;
      } catch (err) {
        console.error(`Error creating invoice for order ${order._id}:`, err);
        errors++;
      }
    }

    res.json({
      message: 'Invoice creation completed',
      created,
      skipped,
      errors,
      total: orders.length
    });

  } catch (error) {
    console.error('Create missing invoices error:', error);
    res.status(500).json({ message: 'Server error while creating invoices' });
  }
});

module.exports = router;
