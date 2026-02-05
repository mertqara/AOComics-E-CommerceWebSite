// src/Components/Pages/Home/Home_new.jsx
import React, { useState, useEffect, useContext } from "react";
import "./Home.css";
import Header from "../../Header/Header";
import API from "../../../services/api";
import { CartContext } from "../../../context/CartContext";
import { WishlistContext } from "../../../context/WishlistContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [comics, setComics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tempSort, setTempSort] = useState('');
  const [tempCategory, setTempCategory] = useState('');
  const { addToCart } = useContext(CartContext);
  // Get wishlist functions from context
  const { addToWishlist, removeFromWishlist, isInWishlist } = useContext(WishlistContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories from public endpoint
        const categoriesResponse = await API.get('/products/categories');
        setCategories(categoriesResponse.data);

        // Fetch products
        let url = '/products?';
        if (sortBy) url += `sort=${sortBy}&`;
        if (categoryFilter) url += `category=${categoryFilter}`;

        console.log('Fetching:', url);

        const response = await API.get(url);
        setComics(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load products');
        setLoading(false);
      }
    };

    fetchData();
  }, [sortBy, categoryFilter]);

  const handleApplyFilters = () => {
    setSortBy(tempSort);
    setCategoryFilter(tempCategory);
  };

  const handleClearFilters = () => {
    setTempSort('');
    setTempCategory('');
    setSortBy('');
    setCategoryFilter('');
  };

  const handleAddToCart = (product) => {
    const success = addToCart(product);
    if (success) {
      alert(`${product.name} added to cart!`);
    }
  };

  // Handle wishlist toggle
  const handleWishlistToggle = (e, product) => {
    e.stopPropagation(); // Prevent card click navigation
    if (isInWishlist(product._id)) {
      removeFromWishlist(product._id);
    } else {
      addToWishlist(product);
    }
  };

  if (loading) {
    return (
      <main className="home">
        <Header />
        <div style={{ padding: '4vw 6vw', textAlign: 'center' }}>
          <h2>Loading products...</h2>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="home">
        <Header />
        <div style={{ padding: '4vw 6vw', textAlign: 'center', color: 'red' }}>
          <h2>{error}</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <Header />

      <section className="comics-section">
        <div className="section-header">
          <h2>Just Added</h2>

          <div className="filters">
            <select
              value={tempCategory}
              onChange={(e) => setTempCategory(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <select
              value={tempSort}
              onChange={(e) => setTempSort(e.target.value)}
              className="filter-select"
            >
              <option value="">Sort By</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popular">Most Popular</option>
            </select>

            <button onClick={handleApplyFilters} className="apply-btn">
              Apply Filters
            </button>
            <button onClick={handleClearFilters} className="clear-btn">
              Clear
            </button>
          </div>
        </div>

        <div className="comics-grid">
          {comics.length === 0 ? (
            <p style={{gridColumn: '1/-1', textAlign: 'center', padding: '40px'}}>
              No products found
            </p>
          ) : (
            comics.map((c) => (
              <div
                className="comic-card"
                key={c._id}
                onClick={() => navigate(`/product/${c._id}`)}
                style={{cursor: 'pointer', position: 'relative'}}
              >
                {/*Wishlist heart icon in top-right corner */}
                <button
                  onClick={(e) => handleWishlistToggle(e, c)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '35px',
                    height: '35px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.3s ease',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isInWishlist(c._id) ? '❤️' : '🤍'}
                </button>

                <img src={c.imageUrl} alt={c.name} />
                <h3>{c.name}</h3>
                <p>{c.category}</p>

                {/* Rating Display */}
                <div style={{fontSize: '0.9rem', margin: '0.5vw 0'}}>
                  <span>{'⭐'.repeat(Math.round(c.rating))}</span>
                  <span style={{color: '#777', marginLeft: '5px'}}>
                    ({c.numReviews})
                  </span>
                </div>

                {/* Price and Discount Section */}
                <div className="price-container" style={{ margin: '10px 0' }}>
                  {c.originalPrice && c.originalPrice > c.price ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Red Percentage Badge */}
                      <span style={{
                        backgroundColor: '#ff4141',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}>
                        -{Math.round(((c.originalPrice - c.price) / c.originalPrice) * 100)}%
                      </span>

                      {/* Discounted Price */}
                      <span style={{ fontWeight: 'bold', color: '#ff4141', fontSize: '1.1rem' }}>
                        ${c.price.toFixed(2)}
                      </span>

                      {/* Crossed-out Original Price */}
                      <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.85rem' }}>
                        ${c.originalPrice.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    /* Standard price view if no discount is active */
                    <p style={{ fontWeight: 'bold', color: '#ff4141', fontSize: '1.1rem', margin: 0 }}>
                      ${c.price.toFixed(2)}
                    </p>
                  )}
                </div>

                <p style={{
                  fontSize: '0.85rem',
                  color: c.quantityInStock > 0 ? 'green' : 'red',
                  marginTop: '0.5vw'
                }}>
                  {c.quantityInStock > 0
                    ? `${c.quantityInStock} in stock`
                    : 'Out of Stock'}
                </p>
                <button
                  disabled={c.quantityInStock === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(c);
                  }}
                >
                  {c.quantityInStock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
