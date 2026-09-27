import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import ProductList from './pages/ProductList'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirm from './pages/OrderConfirm'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="container">
            <h1>🛍️ 쇼핑몰</h1>
            <nav>
              <Link to="/">상품</Link>
              <Link to="/cart">장바구니</Link>
            </nav>
          </div>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<ProductList />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirm/:orderId" element={<OrderConfirm />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>&copy; 2024 쇼핑몰. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  )
}

export default App
