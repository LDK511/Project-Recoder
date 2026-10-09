import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../contexts/CartContext';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { removeFromCart, updateQuantity, clearCart } = useContext(CartContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchCartItems();
  }, [user, navigate]);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('장바구니 조회 실패');
      const data = await response.json();
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    try {
      const response = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('삭제 실패');
      removeFromCart(productId);
      setItems(items.filter(item => item.product_id !== productId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleQuantityChange = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    try {
      const response = await fetch('/api/cart', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ product_id: productId, quantity: newQuantity })
      });
      if (!response.ok) throw new Error('수량 변경 실패');
      updateQuantity(productId, newQuantity);
      setItems(items.map(item =>
        item.product_id === productId ? { ...item, quantity: newQuantity } : item
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (loading) return <div className="cart-container"><p>로딩 중...</p></div>;

  return (
    <div className="cart-container">
      <h1>장바구니</h1>
      {error && <div className="error-message">{error}</div>}
      
      {items.length === 0 ? (
        <div className="empty-cart">
          <p>장바구니가 비어있습니다.</p>
          <button onClick={() => navigate('/')}>쇼핑 계속하기</button>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map(item => (
              <div key={item.product_id} className="cart-item">
                <img src={item.image_url} alt={item.name} />
                <div className="item-info">
                  <h3>{item.name}</h3>
                  <p className="price">₩{item.price.toLocaleString()}</p>
                </div>
                <div className="quantity-control">
                  <button onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}>-</button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.product_id, parseInt(e.target.value) || 1)}
                    min="1"
                  />
                  <button onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}>+</button>
                </div>
                <div className="item-total">₩{(item.price * item.quantity).toLocaleString()}</div>
                <button className="remove-btn" onClick={() => handleRemove(item.product_id)}>삭제</button>
              </div>
            ))}
          </div>
          
          <div className="cart-summary">
            <div className="summary-row">
              <span>상품 금액:</span>
              <span>₩{totalPrice.toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span>배송료:</span>
              <span>₩3,000</span>
            </div>
            <div className="summary-row total">
              <span>총액:</span>
              <span>₩{(totalPrice + 3000).toLocaleString()}</span>
            </div>
            <button className="checkout-btn" onClick={() => navigate('/checkout')}>결제하기</button>
            <button className="continue-shopping-btn" onClick={() => navigate('/')}>계속 쇼핑하기</button>
          </div>
        </>
      )}
    </div>
  );
}
