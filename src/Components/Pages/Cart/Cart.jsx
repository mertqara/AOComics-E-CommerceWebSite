// src/Components/Pages/Cart/Cart.jsx
import React, { useContext } from "react";
import "./Cart.css";
import { CartContext } from "../../../context/CartContext";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const { cartItems, increaseQty, decreaseQty, removeFromCart, getCartTotal } = useContext(CartContext);
  const navigate = useNavigate();

  const items = cartItems.map(item => ({
    id: item._id,
    img: item.imageUrl,
    title: item.name,
    description: item.description,
    qty: item.qty,
    price: item.price,
    quantityInStock: item.quantityInStock
  }));

  return (
    <div className="cart-page">
      <h1 className="cart-title">Your Cart</h1>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '18px', color: '#777', marginBottom: '20px' }}>
            Your cart is empty.
          </p>
          <button onClick={() => navigate('/')} className="checkout-btn">
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <img className="cart-item-img" src={item.img} alt={item.title} />
                <div className="cart-item-info">
                  <h2>{item.title}</h2>
                  <p className="cart-item-meta">{item.description}</p>
                  
                  {/* ADD STOCK INFO */}
                  <p style={{ 
                    fontSize: '13px', 
                    color: item.qty >= item.quantityInStock ? '#f44336' : '#666',
                    marginTop: '5px'
                  }}>
                    {item.quantityInStock} available in stock
                    {item.qty >= item.quantityInStock && ' (Max reached)'}
                  </p>
                  
                  <div className="cart-item-controls">
                    <div className="cart-qty">
                      <button onClick={() => decreaseQty(item.id)}>-</button>
                      <span>{item.qty}</span>
                      {/* DISABLE + BUTTON IF AT MAX STOCK */}
                      <button 
                        onClick={() => increaseQty(item.id)}
                        disabled={item.qty >= item.quantityInStock}
                        style={{
                          cursor: item.qty >= item.quantityInStock ? 'not-allowed' : 'pointer',
                          opacity: item.qty >= item.quantityInStock ? 0.5 : 1
                        }}
                      >
                        +
                      </button>
                    </div>
                    <p className="cart-price">${(item.price * item.qty).toFixed(2)}</p>
                    <button className="cart-remove" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>Order Summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>${getCartTotal().toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total</span>
              <span>${getCartTotal().toFixed(2)}</span>
            </div>
            <button className="checkout-btn" onClick={() => {
              const token = sessionStorage.getItem('token');
              if (!token) {
                alert('Please login to checkout');
                navigate('/login');
              } else {
                navigate('/checkout');
              }
            }}>
              Proceed to Checkout
            </button>
            <p className="summary-note">Taxes calculated at checkout</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;