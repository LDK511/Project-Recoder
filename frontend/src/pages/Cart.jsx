import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import '../styles/Cart.css';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity } = useContext(CartContext);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="cart-container">
        <h1>장바구니</h1>
        <p className="empty-message">장바구니가 비어있습니다.</p>
        <Link to="/" className="btn btn-primary">상품 보기</Link>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <h1>장바구니</h1>
      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <img src={item.image} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h3>{item.name}</h3>
              <p className="price">₩{item.price.toLocaleString()}</p>
            </div>
            <div className="cart-item-quantity">
              <button
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                className="qty-btn"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                className="qty-input"
              />
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="qty-btn"
              >
                +
              </button>
            </div>
            <div className="cart-item-subtotal">
              ₩{(item.price * item.quantity).toLocaleString()}
            </div>
            <button
              onClick={() => removeFromCart(item.id)}
              className="btn-remove"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <div className="cart-summary">
        <div className="summary-row">
          <span>합계:</span>
          <span className="total">₩{total.toLocaleString()}</span>
        </div>
        <Link to="/checkout" className="btn btn-primary btn-checkout">
          주문하기
        </Link>
      </div>
    </div>
  );
}
