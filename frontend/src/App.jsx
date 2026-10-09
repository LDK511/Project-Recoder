import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { CartProvider } from './contexts/CartContext.jsx'
import ProductList from './pages/ProductList.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import Login from './pages/Login.jsx'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="app">
            <header className="header">
              <div className="header-container">
                <Link to="/" className="logo">🛍️ ShopMall</Link>
                <nav className="nav">
                  <Link to="/">상품</Link>
                  <Link to="/cart">장바구니</Link>
                  <Link to="/orders">주문 이력</Link>
                  <Link to="/login">계정</Link>
                </nav>
              </div>
            </header>
            <main className="main-content">
              <Routes>
                <Route path="/" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/login" element={<Login />} />
              </Routes>
            </main>
            <footer className="footer">
              <p>&copy; 2024 ShopMall. All rights reserved.</p>
            </footer>
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  )
}

export default App