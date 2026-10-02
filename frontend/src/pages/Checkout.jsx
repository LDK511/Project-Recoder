import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import '../styles/Checkout.css';

export default function Checkout() {
  const { cart, clearCart } = useContext(CartContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    address: '',
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.customerName || !formData.email || !formData.address) {
      setError('모든 필드를 입력해주세요.');
      setLoading(false);
      return;
    }

    if (cart.length === 0) {
      setError('장바구니가 비어있습니다.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customerName: formData.customerName,
          email: formData.email,
          address: formData.address,
        }),
      });

      if (!response.ok) {
        throw new Error('주문 생성 실패');
      }

      const data = await response.json();
      clearCart();
      navigate(`/order-complete/${data.orderId}`);
    } catch (err) {
      setError(err.message || '주문 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="checkout-container">
        <h1>주문</h1>
        <p className="empty-message">장바구니가 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <h1>주문</h1>
      <div className="checkout-content">
        <div className="checkout-form">
          <h2>배송 정보</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="customerName">이름</label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="고객명"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">배송 주소</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="상세 주소를 입력해주세요"
                rows="4"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '처리 중...' : '주문 완료'}
            </button>
          </form>
        </div>
        <div className="checkout-summary">
          <h2>주문 요약</h2>
          <div className="summary-items">
            {cart.map((item) => (
              <div key={item.id} className="summary-item">
                <span>{item.name} × {item.quantity}</span>
                <span>₩{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>총액:</span>
            <span>₩{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
