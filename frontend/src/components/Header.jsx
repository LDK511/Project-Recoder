import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { CartContext } from '../context/CartContext';

function Header() {
  const { cart } = useContext(CartContext);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>🛍️ ShopMall</h1>
        </Link>
        
        <nav className="nav-menu">
          <Link to="/" className="nav-link">상품</Link>
          <Link to="/cart" className="nav-link cart-link">
            🛒 장바구니
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;