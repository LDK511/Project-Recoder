import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import '../styles/CheckoutPage.css';

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    price: number;
    image_url: string | null;
  };
}

interface Order {
  id: number;
  total_amount: number;
  status: string;
}

interface PaymentResponse {
  payment_id: string;
  order_id: number;
  amount: number;
  currency: string;
  status: string;
  client_secret: string | null;
  test_mode: boolean;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testPaymentMode, setTestPaymentMode] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentCheckCount, setPaymentCheckCount] = useState(0);

  // 장바구니 조회
  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/cart');
        setCartItems(response.data.items);
        setTotalAmount(response.data.total_amount);
      } catch (err: any) {
        setError(err.response?.data?.error || '장바구니 조회 실패');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCart();
    }
  }, [user]);

  // 서버 상태 확인 (테스트 결제 모드 확인)
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await apiClient.get('/health');
        setTestPaymentMode(response.data.test_payment_mode || false);
      } catch (err) {
        console.error('Failed to check server status');
      }
    };

    checkServerStatus();
  }, []);

  // 테스트 결제 모드에서 주문 상태 폴링
  useEffect(() => {
    if (!testPaymentMode || !paymentOrder) return;

    const pollOrderStatus = async () => {
      if (paymentCheckCount >= 30) {
        setError('결제 확인 시간 초과');
        return;
      }

      try {
        const response = await apiClient.get(`/api/orders/${paymentOrder.id}`);
        if (response.data.status === 'paid') {
          setProcessingPayment(false);
          setPaymentOrder(null);
          setPaymentCheckCount(0);
          navigate(`/orders/${paymentOrder.id}`, {
            state: { message: '결제가 완료되었습니다!' },
          });
        } else {
          setPaymentCheckCount((prev) => prev + 1);
        }
      } catch (err) {
        console.error('Failed to check order status');
      }
    };

    const timer = setTimeout(pollOrderStatus, 2000);
    return () => clearTimeout(timer);
  }, [testPaymentMode, paymentOrder, paymentCheckCount, navigate]);

  const handleCreateOrder = async () => {
    if (cartItems.length === 0) {
      setError('장바구니가 비어있습니다');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 멱등성 키 생성
      const idempotencyKey = `order-${Date.now()}-${Math.random()}`;

      // 주문 생성
      const orderResponse = await apiClient.post('/api/orders', {
        idempotency_key: idempotencyKey,
      });

      const order = orderResponse.data;

      // 결제 시작
      const paymentResponse = await apiClient.post<PaymentResponse>(
        '/api/payment/checkout',
        { order_id: order.id },
      );

      const payment = paymentResponse.data;

      if (testPaymentMode) {
        // 테스트 결제 모드: 상태 폴링 시작
        setPaymentOrder(order);
        setProcessingPayment(true);
        setPaymentCheckCount(0);
      } else {
        // 실제 결제 모드: Stripe Elements로 결제 진행
        // 이 부분은 실제 Stripe 키가 있을 때 구현됨
        navigate(`/orders/${order.id}`, {
          state: { paymentSecret: payment.client_secret },
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '주문 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="checkout-container">
        <div className="error-message">로그인이 필요합니다</div>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <h1>결제</h1>

      {error && <div className="error-message">{error}</div>}

      {loading && !processingPayment && <div className="loading">로딩 중...</div>}

      {processingPayment && (
        <div className="payment-processing">
          <div className="spinner"></div>
          <p>테스트 결제 진행 중...</p>
          <p className="small-text">주문 상태를 확인하고 있습니다. 잠시만 기다려주세요.</p>
        </div>
      )}

      {!processingPayment && (
        <>
          <div className="checkout-content">
            <div className="cart-summary">
              <h2>주문 요약</h2>
              {cartItems.length === 0 ? (
                <p className="empty-cart">장바구니가 비어있습니다</p>
              ) : (
                <>
                  <div className="cart-items-list">
                    {cartItems.map((item) => (
                      <div key={item.id} className="cart-item-row">
                        <div className="item-info">
                          <h3>{item.product?.name}</h3>
                          <p className="item-price">
                            {(item.product?.price || 0).toLocaleString('ko-KR')}원 × {item.quantity}
                          </p>
                        </div>
                        <div className="item-total">
                          {((item.product?.price || 0) * item.quantity).toLocaleString('ko-KR')}원
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="checkout-total">
                    <div className="total-row">
                      <span>총액:</span>
                      <span className="total-amount">{totalAmount.toLocaleString('ko-KR')}원</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="payment-section">
              <h2>결제 방법</h2>
              {testPaymentMode ? (
                <div className="test-payment-notice">
                  <p>🧪 테스트 결제 모드</p>
                  <p>이것은 모의 결제 환경입니다. 실제 결제가 이루어지지 않습니다.</p>
                </div>
              ) : (
                <div className="payment-notice">
                  <p>카드 결제를 진행합니다.</p>
                </div>
              )}

              <button
                className="checkout-button"
                onClick={handleCreateOrder}
                disabled={loading || cartItems.length === 0}
              >
                {testPaymentMode ? '테스트 결제 진행' : '결제하기'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
