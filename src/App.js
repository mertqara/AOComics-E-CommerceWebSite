import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Components
import Navbar from './Components/Navbar/Navbar';
import CustomerChat from './Components/Chat/CustomerChat'; // ✅ NEW

// Pages
import Home from './Components/Pages/Home/Home';
import LoginSignUp from './Components/Pages/LoginSignUp/LoginSignUp';
import Login from './Components/Pages/Login/Login';
import Cart from './Components/Pages/Cart/Cart';
import Checkout from './Components/Pages/Checkout/Checkout';
import Payment from './Components/Pages/Payment/Payment';
import Invoice from './Components/Pages/Invoice/Invoice';
import Orders from './Components/Pages/Orders/Orders';
import SearchPage from './Components/Pages/Search/SearchPage';
import ProductDetail from './Components/Pages/ProductDetail/ProductDetail';
import ProductManager from './Components/Pages/ProductManager/ProductManager';
import SalesManager from './Components/Pages/SalesManager/SalesManager';
import Wishlist from './Components/Pages/Whistlist/Wishlist';
import SupportAgent from './Components/Pages/SupportAgent/SupportAgent';
import Profile from './Components/Pages/Profile/Profile';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<LoginSignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/invoice" element={<Invoice />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/product-manager" element={<ProductManager />} />
          <Route path="/sales-manager" element={<SalesManager />} />
          <Route path="/support-agent" element={<SupportAgent />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>

        <CustomerChat />
      </div>
    </Router>
  );
}

export default App;