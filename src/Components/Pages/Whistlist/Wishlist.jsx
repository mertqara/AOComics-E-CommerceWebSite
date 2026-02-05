import React, { useContext } from "react";
import "./Wishlist.css";
import { WishlistContext } from "../../../context/WishlistContext";
import { CartContext } from "../../../context/CartContext";
import { useNavigate } from "react-router-dom";

const Wishlist = () => {
  // Get wishlist items and functions from WishlistContext
  const { wishlistItems, removeFromWishlist } = useContext(WishlistContext);
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  // Handle adding item from wishlist to cart
  const handleAddToCart = (item) => {
    addToCart(item);
    alert(`${item.name} added to cart!`);
  };

  // Navigate to product detail page
  const handleViewProduct = (productId) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div className="wishlist-page">
      <h1 className="wishlist-title">My Wishlist</h1>

      {/* Show empty state if no items in wishlist */}
      {wishlistItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '18px', color: '#777', marginBottom: '20px' }}>
            Your wishlist is empty.
          </p>
          <button onClick={() => navigate('/')} className="continue-shopping-btn">
            Continue Shopping
          </button>
        </div>
      ) : (
        // Display wishlist items in a grid
        <div className="wishlist-grid">
          {wishlistItems.map((item) => (
            <div className="wishlist-item-card" key={item._id}>
              {/* Product image - clickable to view details */}
              <div className="wishlist-item-image" onClick={() => handleViewProduct(item._id)}>
                <img src={item.imageUrl} alt={item.name} />
              </div>

              {/* Product details section */}
              <div className="wishlist-item-details">
                <h3 onClick={() => handleViewProduct(item._id)}>{item.name}</h3>
                <p className="wishlist-item-category">{item.category}</p>

                {/* Product rating display */}
                <div className="wishlist-item-rating">
                  <span className="stars">{'⭐'.repeat(Math.round(item.rating || 0))}</span>
                  <span className="rating-text">
                    {(item.rating || 0).toFixed(1)} ({item.numReviews || 0})
                  </span>
                </div>

                <p className="wishlist-item-price">${item.price}</p>

                {/* Stock availability indicator */}
                <p className={`wishlist-item-stock ${item.quantityInStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                  {item.quantityInStock > 0
                    ? `${item.quantityInStock} in stock`
                    : 'Out of Stock'}
                </p>

                {/* Action buttons: Add to Cart and Remove from Wishlist */}
                <div className="wishlist-item-actions">
                  <button
                    className="add-to-cart-btn"
                    disabled={item.quantityInStock === 0}
                    onClick={() => handleAddToCart(item)}
                  >
                    {item.quantityInStock > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </button>

                  <button
                    className="remove-from-wishlist-btn"
                    onClick={() => removeFromWishlist(item._id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;