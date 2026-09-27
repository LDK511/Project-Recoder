import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import './App.css';

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="app">
          <header className="header">
            <h1>🛍️ ShopMall</h1>
            <nav>
              <a href="/">상품</a>
              <a href="/checkout">장바구니</a>
            </nav>
          </header>
          <main className="main-content">
            <Routes>
              <Route path="/" element={<ProductList />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
            </Routes>
          </main>
          <footer className="footer">
            <p>&copy; 2024 ShopMall. All rights reserved.</p>
          </footer>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;