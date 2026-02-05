// src/Components/Pages/Search/SearchPage.jsx
import React, { useState } from "react";
import "./Search.css";
import API from "../../../services/api";
import { useNavigate } from "react-router-dom";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await API.get(`/products/search?query=${query}`);
      setResults(response.data);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page">
      <h2>Search Comics</h2>

      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="Search for comics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p style={{marginTop: '20px'}}>Searching...</p>}

      {searched && !loading && (
        <div style={{marginTop: '30px'}}>
          <h3>{results.length} results found</h3>
          
          <div className="comics-grid" style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            marginTop: '20px'
          }}>
            {results.map((comic) => (
              <div 
                key={comic._id} 
                onClick={() => navigate(`/product/${comic._id}`)}
                style={{
                  background: '#f8f8f8',
                  borderRadius: '10px',
                  padding: '15px',
                  width: '220px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <img 
                  src={comic.imageUrl} 
                  alt={comic.name}
                  style={{
                    width: '100%',
                    height: '300px',
                    objectFit: 'cover',
                    borderRadius: '10px'
                  }}
                />
                <h3 style={{fontSize: '1rem', marginTop: '10px'}}>{comic.name}</h3>
                <p style={{color: 'gray'}}>{comic.category}</p>
                
                {/* Rating */}
                <div style={{fontSize: '0.9rem', margin: '5px 0'}}>
                  <span>{'⭐'.repeat(Math.round(comic.rating))}</span>
                  <span style={{color: '#777', marginLeft: '5px'}}>
                    ({comic.numReviews})
                  </span>
                </div>

                <div className="store-price-container">
                {comic.originalPrice && comic.originalPrice > comic.price ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '5px 0' }}>
                    {/* Percentage Badge */}
                    <span style={{ 
                      backgroundColor: '#ff4141', 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '3px', 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem' 
                    }}>
                      -{Math.round(((comic.originalPrice - comic.price) / comic.originalPrice) * 100)}%
                    </span>

                    {/* Discounted Price */}
                    <p style={{ fontWeight: 'bold', color: '#ff4141', fontSize: '1.1rem', margin: 0 }}>
                      ${comic.price.toFixed(2)}
                    </p>

                    {/* Strikethrough Original Price */}
                    <p style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.85rem', margin: 0 }}>
                      ${comic.originalPrice.toFixed(2)}
                    </p>
                  </div>
                ) : (
                  /* Normal price display if no discount */
                  <p style={{ fontWeight: 'bold', color: '#ff4141' }}>
                    ${comic.price.toFixed(2)}
                  </p>
                )}

                {/* Stock status display */}
                <p style={{ fontSize: '0.85rem', color: comic.quantityInStock > 0 ? 'green' : 'red', margin: '5px 0' }}>
                  {comic.quantityInStock > 0 ? `${comic.quantityInStock} in stock` : 'Out of Stock'}
                </p>
              </div>
              
              </div>
            ))}
          </div>

          {results.length === 0 && (
            <p style={{marginTop: '20px', color: '#777'}}>
              No products found for "{query}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;