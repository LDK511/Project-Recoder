import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import '../styles/Checkout.css';

export default function Checkout() {
  const [cartItems, setCartItems] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    address: '',
    addressDetail: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      const response = await apiClient.get(`/api/cart/${userId}`);
      setCartItems(response.data.items || []);
    } catch (err) {
      setError('장바구니 정보를 불러올 수 없습니다.');
      console.error(err);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePayment = async () => {
    if (!formData.email || !formData.name || !formData.phone || !formData.address) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (cartItems.length === 0) {
      setError('장바구니가 비어있습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const totalAmount = calculateTotal();
      const userId = localStorage.getItem('userId') || 'guest';

      // 아임포트 결제 요청
      const IMP = window.IMP;
      if (!IMP) {
        setError('결제 시스템을 초기화할 수 없습니다.');
        setLoading(false);
        return;
      }

      IMP.init('imp12345678'); // 아임포트 가맹점 ID (환경변수로 변경 필요)

      IMP.request_pay(
        {
          pg: 'html5_inicis',
          pay_method: 'card',
          merchant_uid: `order_${Date.now()}`,
          name: `쇼핑몰 주문 (${cartItems.length}개 상품)`,
          amount: totalAmount,
          buyer_email: formData.email,
          buyer_name: formData.name,
          buyer_tel: formData.phone,
          buyer_addr: formData.address,
          buyer_postcode: '',
        },
        async (rsp) => {
          if (rsp.success) {
            try {
              // 결제 검증
              const verifyResponse = await apiClient.post('/api/payment/verify', {
                impUid: rsp.imp_uid,
                merchantUid: rsp.merchant_uid,
                amount: totalAmount,
              });

              if (verifyResponse.data.success) {
                // 주문 생성
                const orderResponse = await apiClient.post('/api/orders', {
                  userId,
                  items: cartItems,
                  totalPrice: totalAmount,
                  paymentId: rsp.imp_uid,
                  shippingInfo: {
                    name: formData.name,
                    phone: formData.phone,
                    address: formData.address,
                    addressDetail: formData.addressDetail,
                  },
                });

                // 장바구니 비우기
                await apiClient.delete(`/api/cart/${userId}`);

                // 주문 확인 페이지로 이동
                navigate(`/order-confirm/${orderResponse.data.orderId}`);
              } else {
                setError('결제 검증에 실패했습니다.');
              }
            } catch (err) {
              setError('주문 처리 중 오류가 발생했습니다.');
              console.error(err);
            }
          } else {
            setError(`결제 실패: ${rsp.error_msg}`);
          }
          setLoading(false);
        }
      );
    } catch (err) {
      setError('결제 요청 중 오류가 발생했습니다.');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <h1>결제</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="checkout-content">
        <div className="checkout-form">
          <h2>배송 정보</h2>
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="example@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="홍길동"
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">전화번호</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="010-1234-5678"
            />
          </div>
          <div className="form-group">
            <label htmlFor="address">주소</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="서울시 강남구 테헤란로"
            />
          </div>
          <div className="form-group">
            <label htmlFor="addressDetail">상세주소</label>
            <input
              type="text"
              id="addressDetail"
              name="addressDetail"
              value={formData.addressDetail}
              onChange={handleInputChange}
              placeholder="123-456"
            />
          </div>
        </div>

        <div className="checkout-summary">
          <h2>주문 요약</h2>
          <div className="order-items">
            {cartItems.map((item) => (
              <div key={item.productId} className="order-item">
                <span className="item-name">{item.name}</span>
                <span className="item-qty">x{item.quantity}</span>
                <span className="item-price">₩{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="summary-divider"></div>
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
            onClick={handlePayment}
            disabled={loading}
            className="btn-pay"
          >
            {loading ? '처리 중...' : '결제하기'}
          </button>
          <button
            onClick={() => navigate('/cart')}
            className="btn-back"
          >
            장바구니로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}