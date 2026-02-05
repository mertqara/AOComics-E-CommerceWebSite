// src/Components/Pages/ProductDetail/ProductDetail_new.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { CartContext } from '../../../context/CartContext';
import { WishlistContext } from '../../../context/WishlistContext';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useContext(WishlistContext);

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productResponse = await API.get(`/products/${id}`);
        setProduct(productResponse.data);
        
        const reviewsResponse = await API.get(`/reviews/product/${id}`);
        setReviews(reviewsResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Fetch error:', error);
        setError('Product not found');
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleAddToCart = () => {
    const success = addToCart(product);
    if (success) {
      alert(`${product.name} added to cart!`);
    }
  };

  const handleWishlistToggle = () => {
    if (isInWishlist(product._id)) {
      removeFromWishlist(product._id);
      alert(`${product.name} removed from wishlist`);
    } else {
      addToWishlist(product);
      alert(`${product.name} added to wishlist`);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('Please login to submit a review');
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setReviewError('');

    try {
      await API.post('/reviews/comment', {
        productId: id,
        comment
      });

      alert('Review submitted! It will be visible after approval by product manager.');
      setComment('');
    } catch (error) {
      setReviewError(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRating = async (ratingValue) => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('Please login to rate this product');
      navigate('/login');
      return;
    }

    try {
      await API.post('/reviews/rating', {
        productId: id,
        rating: ratingValue
      });

      alert('Rating submitted successfully!');

      const productResponse = await API.get(`/products/${id}`);
      setProduct(productResponse.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit rating');
    }
  };

  if (loading) return <div className="product-detail-page"><h2>Loading...</h2></div>;
  if (error) return <div className="product-detail-page"><h2>{error}</h2></div>;
  if (!product) return <div className="product-detail-page"><h2>Product not found</h2></div>;

  return (
    <div className="product-detail-page">
      <button onClick={() => navigate(-1)} className="back-btn">← Back</button>

      <div className="product-detail-container">
        {/* Product Info */}
        <div className="product-image-section">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/400x550/cccccc/666666?text=Image+Not+Available';
            }}
          />
        </div>

        <div className="product-info-section">
          <h1>{product.name}</h1>
          <p className="product-category">{product.category}</p>

          <div className="product-rating">
            <span className="stars">{'⭐'.repeat(Math.round(product.rating))}</span>
            <span className="rating-text">
              {product.rating.toFixed(1)} ({product.numReviews} ratings)
            </span>
          </div>

          <p className="product-description">{product.description}</p>

          <div className="product-details">
            <p><strong>Model:</strong> {product.model}</p>
            <p><strong>Serial Number:</strong> {product.serialNumber}</p>
            <p><strong>Distributor:</strong> {product.distributorInfo}</p>
            <p><strong>Warranty:</strong> {product.warrantyStatus}</p>
          </div>

          <div className="product-price-section">
            {/* Check if a discount exists */}
            {product.originalPrice && product.originalPrice > product.price ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {/* Red Discount Badge */}
                <span style={{
                  backgroundColor: '#ff4141',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}>
                  -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                </span>

                {/* Current Discounted Price */}
                <h2 className="price" style={{ color: '#ff4141', margin: 0 }}>
                  ${product.price.toFixed(2)}
                </h2>

                {/* Original Price with Strikethrough */}
                <span style={{
                  textDecoration: 'line-through',
                  color: '#999',
                  fontSize: '1.1rem'
                }}>
                  ${product.originalPrice.toFixed(2)}
                </span>
              </div>
            ) : (
              /* Standard price view if no discount */
              <h2 className="price">${product.price.toFixed(2)}</h2>
            )}

            <p className={`stock ${product.quantityInStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.quantityInStock > 0
                ? `${product.quantityInStock} in stock`
                : 'Out of Stock'}
            </p>
</div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              className="add-to-cart-btn"
              disabled={product.quantityInStock === 0}
              onClick={handleAddToCart}
              style={{ flex: 1 }}
            >
              {product.quantityInStock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>

            <button
              onClick={handleWishlistToggle}
              style={{
                padding: '12px 20px',
                background: isInWishlist(product._id) ? '#ff4141' : 'white',
                color: isInWishlist(product._id) ? 'white' : '#ff4141',
                border: `2px solid #ff4141`,
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {isInWishlist(product._id) ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Rating - INDEPENDENT */}
      <div className="quick-rating-section">
        <h3>Rate this product:</h3>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Your rating helps other customers
        </p>
        <div className="star-buttons">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleQuickRating(star)}
              className="star-btn"
            >
              {'⭐'.repeat(star)}
            </button>
          ))}
        </div>
      </div>

      {/* Review Form - COMMENT ONLY, NO RATING */}
      <div className="review-form-section">
        <h3>Write a Review</h3>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Share your thoughts about this product (rating submitted separately above)
        </p>
        
        {reviewError && <p className="error-message">{reviewError}</p>}

        <form onSubmit={handleSubmitReview}>
          <div className="form-group">
            <label>Your Review:</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this product..."
              rows="5"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="submit-review-btn">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>

      <div className="reviews-section">
        <h3>Customer Reviews ({reviews.length})</h3>

        {reviews.length === 0 ? (
          <p className="no-reviews">No reviews yet. Be the first to review!</p>
        ) : (
          <div className="reviews-list">
            {reviews.map(review => (
              <div key={review._id} className="review-card">
                <div className="review-header">
                  <span className="reviewer-name">{review.user.name}</span>
                </div>
                <p className="review-date">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
                <p className="review-comment">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
