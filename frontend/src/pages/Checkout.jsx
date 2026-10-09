import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../contexts/CartContext';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/Checkout.css';

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { clearCart } = useContext(CartContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: ''
  });

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      setError('배송 정보를 모두 입력해주세요.');
      return false;
    }
    if (!formData.cardNumber || !formData.cardExpiry || !formData.cardCvc) {
      setError('결제 정보를 모두 입력해주세요.');
      return false;
    }
    if (items.length === 0) {
      setError('장바구니가 비어있습니다.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setProcessing(true);
      setError(null);

      const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 3000;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          items: items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
          })),
          total_price: totalPrice,
          shipping_info: {
            name: formData.name,
            phone: formData.phone,
            address: formData.address
          },
          payment_info: {
            cardNumber: formData.cardNumber.replace(/\s/g, '').slice(-4),
            cardExpiry: formData.cardExpiry
          }
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '주문 생성 실패');
      }

      const orderData = await response.json();
      clearCart();
      navigate(`/orders/${orderData.order_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="checkout-container"><p>로딩 중...</p></div>;

  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingFee = 3000;
  const finalTotal = totalPrice + shippingFee;

  return (
    <div className="checkout-container">
      <h1>결제</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="checkout-content">
        <form onSubmit={handleSubmit} className="checkout-form">
          <section className="form-section">
            <h2>배송 정보</h2>
            <div className="form-group">
              <label htmlFor="name">이름</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
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
                disabled
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">휴대폰</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="010-0000-0000"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">배송 주소</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="도로명 주소"
                required
              />
            </div>
          </section>

          <section className="form-section">
            <h2>결제 정보</h2>
            <div className="form-group">
              <label htmlFor="cardNumber">카드 번호</label>
              <input
                type="text"
                id="cardNumber"
                name="cardNumber"
                value={formData.cardNumber}
                onChange={handleInputChange}
                placeholder="0000 0000 0000 0000"
                maxLength="19"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cardExpiry">유효기간</label>
                <input
                  type="text"
                  id="cardExpiry"
                  name="cardExpiry"
                  value={formData.cardExpiry}
                  onChange={handleInputChange}
                  placeholder="MM/YY"
                  maxLength="5"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="cardCvc">CVC</label>
                <input
                  type="text"
                  id="cardCvc"
                  name="cardCvc"
                  value={formData.cardCvc}
                  onChange={handleInputChange}
                  placeholder="000"
                  maxLength="3"
                  required
                />
              </div>
            </div>
          </section>

          <button type="submit" className="submit-btn" disabled={processing}>
            {processing ? '처리 중...' : '주문 완료'}
          </button>
        </form>

        <aside className="order-summary">
          <h2>주문 요약</h2>
          <div className="summary-items">
            {items.map(item => (
              <div key={item.product_id} className="summary-item">
                <span>{item.name} × {item.quantity}</span>
                <span>₩{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row">
            <span>상품 금액:</span>
            <span>₩{totalPrice.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>배송료:</span>
            <span>₩{shippingFee.toLocaleString()}</span>
          </div>
          <div className="summary-row total">
            <span>총액:</span>
            <span>₩{finalTotal.toLocaleString()}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
