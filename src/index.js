import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { CartProvider } from './context/CartContext';
// Import WishlistProvider to enable wishlist functionality across the app
import { WishlistProvider } from './context/WishlistContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CartProvider>
      {/* Wrap App with WishlistProvider so all components can access wishlist context */}
      <WishlistProvider>
        <App />
      </WishlistProvider>
    </CartProvider>
  </React.StrictMode>
);

reportWebVitals();