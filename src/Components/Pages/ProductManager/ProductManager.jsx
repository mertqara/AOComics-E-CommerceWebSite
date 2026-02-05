// src/Components/Pages/ProductManager/ProductManager.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import './ProductManager.css';

const ProductManager = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Products & Categories
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', quantityInStock: '', category: '',
    description: '', model: '', serialNumber: '', warrantyStatus: '',
    distributorInfo: '', imageUrl: '', discount: 0
  });
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  // Deliveries
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  // Reviews
  const [pendingReviews, setPendingReviews] = useState([]);

  // Statistics
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = sessionStorage.getItem('token');
      const userStr = sessionStorage.getItem('user');

      if (!token) {
        navigate('/login');
        return false;
      }

      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role !== 'product_manager') {
          alert('Access denied. Product Manager role required.');
          navigate('/');
          return false;
        }
      }
      return true;
    };

    const fetchAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchProducts(),
          fetchCategories(),
          fetchDeliveries(),
          fetchPendingReviews(),
          fetchStats()
        ]);
        setLoading(false);
      } catch (error) {
        console.error('Fetch error:', error);
        if (error.response?.status === 403) {
          alert('Access denied. Product Manager role required.');
          navigate('/');
        } else {
          setError(error.response?.data?.message || 'Failed to load data');
        }
        setLoading(false);
      }
    };

    if (checkAuth()) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchProducts = async () => {
    const response = await API.get('/product-manager/products');
    setProducts(response.data);
  };

  const fetchCategories = async () => {
    const response = await API.get('/product-manager/categories');
    setCategories(response.data);
  };

  const fetchDeliveries = async () => {
    const response = await API.get('/product-manager/deliveries');
    setDeliveries(response.data);
  };

  const fetchPendingReviews = async () => {
    const response = await API.get('/product-manager/reviews/pending');
    setPendingReviews(response.data);
  };

  const fetchStats = async () => {
    const response = await API.get('/product-manager/statistics/deliveries');
    setStats(response.data);
  };

  // Category Management
  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await API.post('/product-manager/categories', newCategory);
      alert('Category added successfully!');
      setNewCategory({ name: '', description: '' });
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await API.delete(`/product-manager/categories/${id}`);
      alert('Category deleted successfully!');
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete category');
    }
  };

  // Product Management
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await API.post('/product-manager/products', {
        ...newProduct,
        price: parseFloat(newProduct.price),
        quantityInStock: parseInt(newProduct.quantityInStock),
        discount: parseFloat(newProduct.discount) || 0
      });
      alert('Product added successfully!');
      setNewProduct({
        name: '', price: '', quantityInStock: '', category: '',
        description: '', model: '', serialNumber: '', warrantyStatus: '',
        distributorInfo: '', imageUrl: '', discount: 0
      });
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add product');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/product-manager/products/${editingProduct._id}`, {
        ...editingProduct,
        price: parseFloat(editingProduct.price),
        quantityInStock: parseInt(editingProduct.quantityInStock),
        discount: parseFloat(editingProduct.discount) || 0
      });
      alert('Product updated successfully!');
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await API.delete(`/product-manager/products/${id}`);
      alert('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleUpdateStock = async (productId, newStock) => {
    try {
      await API.patch(`/product-manager/products/${productId}/stock`, {
        quantityInStock: parseInt(newStock)
      });
      alert('Stock updated successfully!');
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update stock');
    }
  };

  // Delivery Management
  const handleUpdateDeliveryStatus = async (deliveryId, status) => {
    try {
      await API.patch(`/product-manager/deliveries/${deliveryId}/status`, { status });
      alert(`Delivery status updated to ${status}`);
      fetchDeliveries();
      fetchStats();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update delivery status');
    }
  };

  const handleToggleDeliveryCompletion = async (deliveryId, currentStatus) => {
    try {
      await API.patch(`/product-manager/deliveries/${deliveryId}/completion`, {
        completed: !currentStatus
      });
      alert(`Delivery marked as ${!currentStatus ? 'completed' : 'pending'}`);
      fetchDeliveries();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update delivery completion');
    }
  };

  // Review Management
  const handleApproveReview = async (reviewId) => {
    try {
      await API.patch(`/product-manager/reviews/${reviewId}/approve`);
      alert('Review approved successfully!');
      fetchPendingReviews();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve review');
    }
  };

  const handleRejectReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to reject this review?')) return;
    try {
      await API.delete(`/product-manager/reviews/${reviewId}`);
      alert('Review rejected successfully!');
      fetchPendingReviews();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject review');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return '#FFA500';
      case 'in-transit': return '#2196F3';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#f44336';
      default: return '#999';
    }
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    if (deliveryFilter === 'all') return true;
    if (deliveryFilter === 'pending') return !delivery.deliveryCompleted;
    if (deliveryFilter === 'completed') return delivery.deliveryCompleted;
    return delivery.status === deliveryFilter;
  });

  if (loading) {
    return (
      <div className="product-manager-page">
        <h1>Product Manager Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-manager-page">
        <h1>Product Manager Dashboard</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="product-manager-page">
      <h1>Product Manager Dashboard</h1>

      {/* Statistics Overview */}
      {stats && (
        <div className="stats-overview">
          <div className="stat-card">
            <h3>{products.length}</h3>
            <p>Total Products</p>
          </div>
          <div className="stat-card">
            <h3>{stats.byStatus.processing}</h3>
            <p>Processing Orders</p>
          </div>
          <div className="stat-card">
            <h3>{stats.byStatus.inTransit}</h3>
            <p>In Transit</p>
          </div>
          <div className="stat-card">
            <h3>{pendingReviews.length}</h3>
            <p>Pending Reviews</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products & Stock
        </button>
        <button
          className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={`tab-button ${activeTab === 'deliveries' ? 'active' : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          Deliveries ({deliveries.filter(d => !d.deliveryCompleted).length})
        </button>
        <button
          className={`tab-button ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({pendingReviews.length})
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="tab-content">
          <h2>Product Management</h2>

          {/* Add Product Form */}
          <div className="form-section">
            <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Product Name *"
                  value={editingProduct ? editingProduct.name : newProduct.name}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, name: e.target.value})
                    : setNewProduct({...newProduct, name: e.target.value})
                  }
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price *"
                  value={editingProduct ? editingProduct.price : newProduct.price}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, price: e.target.value})
                    : setNewProduct({...newProduct, price: e.target.value})
                  }
                  required
                />
                <input
                  type="number"
                  placeholder="Stock Quantity *"
                  value={editingProduct ? editingProduct.quantityInStock : newProduct.quantityInStock}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, quantityInStock: e.target.value})
                    : setNewProduct({...newProduct, quantityInStock: e.target.value})
                  }
                  required
                />
                <select
                  value={editingProduct ? editingProduct.category : newProduct.category}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, category: e.target.value})
                    : setNewProduct({...newProduct, category: e.target.value})
                  }
                  required
                >
                  <option value="">Select Category *</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Model"
                  value={editingProduct ? editingProduct.model : newProduct.model}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, model: e.target.value})
                    : setNewProduct({...newProduct, model: e.target.value})
                  }
                />
                <input
                  type="text"
                  placeholder="Serial Number"
                  value={editingProduct ? editingProduct.serialNumber : newProduct.serialNumber}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, serialNumber: e.target.value})
                    : setNewProduct({...newProduct, serialNumber: e.target.value})
                  }
                />
                <input
                  type="text"
                  placeholder="Warranty Status"
                  value={editingProduct ? editingProduct.warrantyStatus : newProduct.warrantyStatus}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, warrantyStatus: e.target.value})
                    : setNewProduct({...newProduct, warrantyStatus: e.target.value})
                  }
                />
                <input
                  type="text"
                  placeholder="Distributor Info"
                  value={editingProduct ? editingProduct.distributorInfo : newProduct.distributorInfo}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, distributorInfo: e.target.value})
                    : setNewProduct({...newProduct, distributorInfo: e.target.value})
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Discount %"
                  value={editingProduct ? editingProduct.discount : newProduct.discount}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, discount: e.target.value})
                    : setNewProduct({...newProduct, discount: e.target.value})
                  }
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={editingProduct ? editingProduct.imageUrl : newProduct.imageUrl}
                  onChange={(e) => editingProduct
                    ? setEditingProduct({...editingProduct, imageUrl: e.target.value})
                    : setNewProduct({...newProduct, imageUrl: e.target.value})
                  }
                />
              </div>
              <textarea
                placeholder="Description"
                value={editingProduct ? editingProduct.description : newProduct.description}
                onChange={(e) => editingProduct
                  ? setEditingProduct({...editingProduct, description: e.target.value})
                  : setNewProduct({...newProduct, description: e.target.value})
                }
                rows="3"
              />
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
                {editingProduct && (
                  <button type="button" className="btn-secondary" onClick={() => setEditingProduct(null)}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Products List */}
          <div className="products-list">
            <h3>All Products ({products.length})</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Category</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product._id} className={product.quantityInStock < 10 ? 'low-stock' : ''}>
                      <td>{product.name}</td>
                      <td>${product.price.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          value={product.quantityInStock}
                          onChange={(e) => handleUpdateStock(product._id, e.target.value)}
                          style={{ width: '60px' }}
                        />
                        {product.quantityInStock < 10 && <span className="low-stock-badge">Low</span>}
                      </td>
                      <td>{categories.find(c => c._id === product.category)?.name || product.category}</td>
                      <td>
                        <button className="btn-edit" onClick={() => setEditingProduct(product)}>Edit</button>
                        <button className="btn-delete" onClick={() => handleDeleteProduct(product._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="tab-content">
          <h2>Category Management</h2>

          <div className="form-section">
            <h3>Add New Category</h3>
            <form onSubmit={handleAddCategory}>
              <input
                type="text"
                placeholder="Category Name (e.g., Marvel, DC, Image)"
                value={newCategory.name}
                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                required
              />
              <button type="submit" className="btn-primary">Add Category</button>
            </form>
          </div>

          <div className="categories-list">
            <h3>All Categories ({categories.length})</h3>
            {categories.map(category => (
              <div key={category._id} className="category-card">
                <h4>{category.name}</h4>
                <button className="btn-delete" onClick={() => handleDeleteCategory(category._id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && (
        <div className="tab-content">
          <h2>Delivery Management</h2>

          <div className="filter-section">
            <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)}>
              <option value="all">All Deliveries</option>
              <option value="pending">Pending Completion</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div className="deliveries-list">
            {filteredDeliveries.map(delivery => (
              <div key={delivery.deliveryId} className="delivery-card">
                <div className="delivery-header">
                  <div>
                    <h3>Delivery #{delivery.deliveryId.slice(-8)}</h3>
                    <p style={{ fontSize: '0.85em', color: '#888' }}>
                      Delivery ID: {delivery.deliveryId}
                    </p>
                    <p>Customer: {delivery.customerName} ({delivery.customerEmail})</p>
                    <p style={{ fontSize: '0.9em', color: '#666' }}>
                      Customer ID: {delivery.customerId}
                    </p>
                    <p className="delivery-date">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span
                      className="status-badge"
                      style={{ background: getStatusColor(delivery.status) }}
                    >
                      {delivery.status.toUpperCase()}
                    </span>
                    {delivery.deliveryCompleted && (
                      <span className="completed-badge">✓ COMPLETED</span>
                    )}
                  </div>
                </div>

                <div className="delivery-details">
                  <h4>Products:</h4>
                  {delivery.products.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <p>• {item.productName} x {item.quantity} - ${item.price.toFixed(2)}</p>
                      <p style={{ fontSize: '0.9em', color: '#666', marginLeft: '20px' }}>
                        Product ID: {item.productId}
                      </p>
                    </div>
                  ))}
                  <p><strong>Total:</strong> ${delivery.totalPrice.toFixed(2)}</p>
                  <p><strong>Address:</strong> {delivery.deliveryAddress}</p>
                </div>

                <div className="delivery-actions">
                  {delivery.status === 'processing' && (
                    <button
                      className="btn-status"
                      onClick={() => handleUpdateDeliveryStatus(delivery.deliveryId, 'in-transit')}
                    >
                      Mark as In Transit
                    </button>
                  )}
                  {delivery.status === 'in-transit' && (
                    <button
                      className="btn-status"
                      onClick={() => handleUpdateDeliveryStatus(delivery.deliveryId, 'delivered')}
                    >
                      Mark as Delivered
                    </button>
                  )}
                  {delivery.status === 'delivered' && (
                    <button
                      className={delivery.deliveryCompleted ? 'btn-secondary' : 'btn-primary'}
                      onClick={() => handleToggleDeliveryCompletion(delivery.deliveryId, delivery.deliveryCompleted)}
                    >
                      {delivery.deliveryCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="tab-content">
          <h2>Review Approval ({pendingReviews.length} pending)</h2>

          {pendingReviews.length === 0 ? (
            <div className="no-pending">
              <p>No pending reviews</p>
            </div>
          ) : (
            <div className="reviews-list">
              {pendingReviews.map(review => (
                <div key={review._id} className="review-card">
                  <div className="review-header">
                    <div>
                      <h3>{review.product.name}</h3>
                      <p>By: {review.user.name} ({review.user.email})</p>
                      <p className="review-date">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="review-rating">
                      {'⭐'.repeat(review.rating)}
                    </div>
                  </div>
                  <div className="review-content">
                    <p>{review.comment}</p>
                  </div>
                  <div className="review-actions">
                    <button className="btn-approve" onClick={() => handleApproveReview(review._id)}>
                      Approve
                    </button>
                    <button className="btn-reject" onClick={() => handleRejectReview(review._id)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ProductManager;
