// src/Components/Navbar/Navbar.jsx
import React, { useState, useEffect, useContext } from 'react';
import "./Navbar.css";
import logo from '../Assets/logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { CartContext } from '../../context/CartContext'; 
import { WishlistContext } from '../../context/WishlistContext';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  
  // Consuming both Cart and Wishlist contexts
  const { getCartCount } = useContext(CartContext);
  const { getWishlistCount } = useContext(WishlistContext);

  useEffect(() => {
    // Check if user is logged in via sessionStorage
    const userData = sessionStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className='navbar'>
      {/* 1. Logo Section */}
      <div className='nav-logo' onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
        <img src={logo} alt="AO Comics Logo"/>
        <p>AO Comics</p>
      </div>

      {/* 2. Navigation Menu */}
      <ul className="nav-menu">
        <li onClick={() => navigate('/')}>Shop</li>
        <li onClick={() => navigate('/search')}>Search</li>
        <li onClick={() => navigate('/orders')}>My Orders</li>
        {user && <li onClick={() => navigate('/profile')}>Profile</li>}
        {user && user.role === 'product_manager' && (
          <li onClick={() => navigate('/product-manager')}>Manager</li>
        )}
          {user && user.role === 'sales_manager' && (
          <li onClick={() => navigate('/sales-manager')}>Selling Products </li>
        )}
        {user && user.role === 'support_agent' && (
          <li onClick={() => navigate('/support-agent')}>Support</li>
        )}
      </ul>

      {/* 3. Action Icons & Auth Section */}
      <div className='nav-login-cart'>
        
        {/* User Authentication / Welcome Message */}
        {user ? (
          <>
            <span style={{ marginRight: '15px', fontSize: '14px' }}>
              Hello, {user.name}
            </span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <Link to="/login">
            <button className="nav-login-btn">Login</button>
          </Link>
        )}
        
        {/* Wishlist Icon with Badge */}
        <Link to="/wishlist" style={{position: 'relative', display: 'inline-block', marginLeft: '15px'}}>
          <button style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>❤️</button>
          {getWishlistCount() > 0 && (
            <span className="nav-badge">
              {getWishlistCount()}
            </span>
          )}
        </Link>

        {/* Cart Icon with Badge */}
        <Link to="/cart" style={{position: 'relative', display: 'inline-block', marginLeft: '15px'}}>
          <img src="/assets/cart_icon.png" alt="Cart" />
          {getCartCount() > 0 && (
            <span className="nav-badge">
              {getCartCount()}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
};

export default Navbar;