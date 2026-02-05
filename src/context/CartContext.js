// src/context/CartContext.js
import React, { createContext, useState, useEffect } from 'react';
// Context to share cart-related state and functions across the app
export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // Holds all items currently in the cart
  const [cartItems, setCartItems] = useState([]);
  // Used to make sure localStorage sync happens only after initial load
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart data from localStorage when the app first mounts
  useEffect(() => {
    const savedCart = sessionStorage.getItem('cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart:', error);
        setCartItems([]);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart data to localStorage whenever cartItems change
  useEffect(() => {
    if (isLoaded) {
      sessionStorage.setItem('cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isLoaded]);

  // Adds a product to the cart or increases quantity if it already exists
  const addToCart = (product) => {
    const existingItem = cartItems.find(item => item._id === product._id);
    
    if (existingItem) {
      // Prevent adding more than available stock
      if (existingItem.qty >= product.quantityInStock) {
        alert(`Cannot add more. Only ${product.quantityInStock} items in stock.`);
        return false; 
      }
      
      setCartItems(cartItems.map(item =>
        item._id === product._id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      // Do not allow adding out-of-stock products
      if (product.quantityInStock < 1) {
        alert('This product is out of stock.');
        return false;
      }
      
      setCartItems([...cartItems, { ...product, qty: 1 }]);
    }
    return true; 
  };
  // Removes a product completely from the cart
  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item._id !== productId));
  };

  // Increases quantity of a specific cart item, respecting stock limits
  const increaseQty = (productId) => {
    const item = cartItems.find(item => item._id === productId);
    
    if (!item) return;
    
    if (item.qty >= item.quantityInStock) {
      alert(`Cannot add more. Only ${item.quantityInStock} items in stock.`);
      return;
    }
    
    setCartItems(cartItems.map(item =>
      item._id === productId ? { ...item, qty: item.qty + 1 } : item
    ));
  };

  // Decreases quantity of a cart item or removes it if quantity reaches 1
  const decreaseQty = (productId) => {
    const item = cartItems.find(item => item._id === productId);
    if (item.qty === 1) {
      removeFromCart(productId);
    } else {
      setCartItems(cartItems.map(item =>
        item._id === productId ? { ...item, qty: item.qty - 1 } : item
      ));
    }
  };

  // Clears the entire cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Calculates total price of all items in the cart
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.qty), 0);
  };

   // Calculates total number of items in the cart
  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.qty, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      increaseQty,
      decreaseQty,
      clearCart,
      getCartTotal,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  );
};