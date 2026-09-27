import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import '../styles/Cart.css';

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId') || 'guest';
      const response = await apiClient.get(`/api/cart/${userId}`);
      setCartItems(response.data.items || []);
      setError(null);
    } catch (err) {
      setError('장바구니를 불러올 수 없습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      await apiClient.put(`/api/cart/${userId}`, {
        productId,
        quantity,
      });
      fetchCart();
    } catch (err) {
      setError('수량 업데이트에 실패했습니다.');
      console.error(err);
    }
  };

  const removeItem = async (productId) => {
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      await apiClient.delete(`/api/cart/${userId}/${productId}`);
      fetchCart();
    } catch (err) {
      setError('상품 제거에 실패했습니다.');
      console.error(err);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  if (loading) return <div className="cart-container"><p>로딩 중...</p></div>;

  return (
    <div className="cart-container">
      <h1>장바구니</h1>
      {error && <div className="error-message">{error}</div>}
      
      {cartItems.length === 0 ? (
        <div className="empty-cart">
          <p>장바구니가 비어있습니다.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            쇼핑 계속하기
          </button>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {cartItems.map((item) => (
              <div key={item.productId} className="cart-item">
                <img src={item.image} alt={item.name} className="item-image" />
                <div className="item-details">
                  <h3>{item.name}</h3>
                  <p className="item-price">₩{item.price.toLocaleString()}</p>
                </div>
                <div className="item-quantity">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="qty-btn"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantity(item.productId, parseInt(e.target.value) || 1)
                    }
                    className="qty-input"
                  />
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="qty-btn"
                  >
                    +
                  </button>
                </div>
                <div className="item-subtotal">
                  ₩{(item.price * item.quantity).toLocaleString()}
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="btn-remove"
                >
                  제거
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span>소계:</span>
              <span>₩{calculateTotal().toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span>배송료:</span>
              <span>무료</span>
            </div>
            <div className="summary-row total">
              <span>합계:</span>
              <span>₩{calculateTotal().toLocaleString()}</span>
            </div>
            <button
              onClick={() => navigate('/checkout')}
              className="btn-checkout"
            >
              결제하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}