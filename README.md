# AO Comics - E-Commerce Platform

A full-stack comic book e-commerce web application built for Sabancı University CS 308 Software Engineering course.

## 📖 Overview

AO Comics is a complete e-commerce platform featuring role-based access control, real-time support chat, secure payment processing, and comprehensive order management. The platform supports four distinct user roles with specialized functionalities for managing a comic book retail business.

## ✨ Features

### Customer Features
- Browse and search comic book catalog with advanced filters
- Shopping cart with real-time stock validation
- Wishlist with automated discount notifications via email
- Secure checkout with encrypted credit card payment
- Order tracking (processing → in-transit → delivered)
- Order cancellation (processing status only)
- Product returns and refunds (30-day window for delivered orders)
- Product reviews and ratings
- Real-time support chat
- User profile management

### Sales Manager Features
- Set product discounts with automatic pricing updates
- Email notifications to wishlist users about discounts
- View and export invoices by date range
- Revenue and profit analytics with interactive charts
- Approve/reject customer refund requests

### Product Manager Features
- Add/remove products and categories
- Manage inventory and stock levels
- View delivery lists and order details
- Update order status (processing, in-transit, delivered)
- Approve/reject customer reviews

### Support Agent Features
- Real-time chat interface with customers
- View customer context (profile, cart, order history, wishlist)
- Queue management for active conversations
- Send text messages and file attachments

## 🛠️ Tech Stack

**Frontend:**
- React 18.2.0
- React Router
- Socket.io Client (real-time chat)
- Recharts (analytics visualization)

**Backend:**
- Node.js 20.x
- Express.js
- MongoDB with Mongoose
- Socket.io (WebSocket server)
- JWT Authentication
- bcrypt (password hashing)
- Nodemailer (email service)
- AES-256 (credit card encryption)

## 📁 Project Structure

```
AO-Comics/
├── backend/
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API endpoints
│   ├── middleware/       # Auth & validation
│   ├── services/         # Email & business logic
│   ├── utils/            # Encryption utilities
│   └── server.js         # Express server
├── src/
│   ├── Components/
│   │   ├── Pages/        # React page components
│   │   └── Navbar/       # Navigation component
│   ├── services/         # API service layer
│   └── App.js            # React app entry
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.x or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ao-comics.git
cd ao-comics
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ..
npm install
```

4. **Configure environment variables**

Create a `.env` file in the `backend` directory:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5001

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=AO Comics <your_email@gmail.com>

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key
```

5. **Run the application**

Start backend server:
```bash
cd backend
npm start
```

Start frontend (in a new terminal):
```bash
npm start
```

The application will open at `http://localhost:3000`

## 📊 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

### Products
- `GET /products` - Get all products
- `POST /products` - Create product (PM only)
- `PUT /products/:id` - Update product (PM only)
- `DELETE /products/:id` - Delete product (PM only)

### Orders
- `POST /orders` - Create order
- `GET /orders/my-orders` - Get user's orders
- `PUT /orders/:id/cancel` - Cancel order (processing only)
- `PUT /orders/:id/status` - Update order status (PM only)

### Refunds
- `POST /refunds/request` - Request refund
- `GET /refunds/pending` - Get pending refunds (SM only)
- `PUT /refunds/:id/approve` - Approve refund (SM only)

### Chat
- Real-time WebSocket connection via Socket.io
- Customer context automatically linked for logged-in users

## 🔒 Security Features

- **Authentication:** JWT-based authentication with role-based access control
- **Password Security:** bcrypt hashing with salt rounds
- **Payment Security:** AES-256 encryption for credit card data
- **Data Validation:** Input sanitization and validation on all endpoints
- **Authorization:** Role-based permissions for sensitive operations

## 👥 User Roles

| Role              | Key Responsibilities                          |
|-------------------|-----------------------------------------------|
| Customer          | Browse, purchase, review products             |
| Sales Manager     | Pricing, discounts, revenue analytics         |
| Product Manager   | Inventory, delivery, order status             |
| Support Agent     | Customer support via live chat                |

## 📧 Email Notifications

- Order confirmation with invoice
- Wishlist discount alerts
- Refund approval notifications
- Professional HTML email templates

## 🧪 Testing

API endpoints tested using **Postman**. Test credit card for checkout:
- Card Number: `4111 1111 1111 1111`
- CVV: `123`
- Expiry: `12/27`

## 🎓 Academic Context

This project was developed as part of **CS 308 Software Engineering** course at Sabancı University (Spring 2026). It demonstrates full-stack development skills, database design, API development, real-time communication, and software engineering best practices.

## 📝 License

This project is developed for educational purposes as part of coursework at Sabancı University.

## 👤 Author

**Ahmet Mert Kara** - Sabancı University Computer Science Student

---