import React, { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if user is logged in
  const isLoggedIn = () => {
    return !!sessionStorage.getItem('token');
  };

  // Load wishlist from backend if logged in, otherwise use localStorage
  useEffect(() => {
    const loadWishlist = async () => {
      if (isLoggedIn()) {
        // Load from backend for authenticated users
        try {
          const response = await API.get('/wishlist');
          setWishlistItems(response.data.wishlist || []);
        } catch (error) {
          console.error('Error loading wishlist from backend:', error);
          // Fallback to localStorage if backend fails
          const savedWishlist = sessionStorage.getItem('wishlist');
          if (savedWishlist) {
            setWishlistItems(JSON.parse(savedWishlist));
          }
        }
      } else {
        // Load from localStorage for guest users
        const savedWishlist = sessionStorage.getItem('wishlist');
        if (savedWishlist) {
          try {
            setWishlistItems(JSON.parse(savedWishlist));
          } catch (error) {
            console.error('Error loading wishlist:', error);
            setWishlistItems([]);
          }
        }
      }
      setIsLoaded(true);
    };

    loadWishlist();
  }, []);

  // Save to localStorage only for guest users
  useEffect(() => {
    if (isLoaded && !isLoggedIn()) {
      sessionStorage.setItem('wishlist', JSON.stringify(wishlistItems));
    }
  }, [wishlistItems, isLoaded]);

  // Add to wishlist (backend if logged in, localStorage if guest)
  const addToWishlist = async (product) => {
    if (isLoggedIn()) {
      // Add to backend for authenticated users
      try {
        const response = await API.post('/wishlist/add', { productId: product._id });
        setWishlistItems(response.data.wishlist || []);
      } catch (error) {
        console.error('Error adding to wishlist:', error);
        alert(error.response?.data?.message || 'Failed to add to wishlist');
      }
    } else {
      // Add to localStorage for guest users
      const existingItem = wishlistItems.find(item => item._id === product._id);
      if (!existingItem) {
        setWishlistItems([...wishlistItems, product]);
      }
    }
  };

  // Remove from wishlist (backend if logged in, localStorage if guest)
  const removeFromWishlist = async (productId) => {
    if (isLoggedIn()) {
      // Remove from backend for authenticated users
      try {
        const response = await API.delete(`/wishlist/remove/${productId}`);
        setWishlistItems(response.data.wishlist || []);
      } catch (error) {
        console.error('Error removing from wishlist:', error);
        alert(error.response?.data?.message || 'Failed to remove from wishlist');
      }
    } else {
      // Remove from localStorage for guest users
      setWishlistItems(wishlistItems.filter(item => item._id !== productId));
    }
  };

  // Check if product is in wishlist
  const isInWishlist = (productId) => {
    return wishlistItems.some(item => item._id === productId);
  };

  // Clear wishlist (backend if logged in, localStorage if guest)
  const clearWishlist = async () => {
    if (isLoggedIn()) {
      // Clear from backend for authenticated users
      try {
        await API.delete('/wishlist/clear');
        setWishlistItems([]);
      } catch (error) {
        console.error('Error clearing wishlist:', error);
        alert('Failed to clear wishlist');
      }
    } else {
      // Clear from localStorage for guest users
      setWishlistItems([]);
    }
  };

  // Get wishlist count
  const getWishlistCount = () => {
    return wishlistItems.length;
  };

  return (
    <WishlistContext.Provider value={{
      wishlistItems,
      addToWishlist,
      removeFromWishlist,
      isInWishlist,
      clearWishlist,
      getWishlistCount
    }}>
      {children}
    </WishlistContext.Provider>
  );
};
