import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { OrderDetail, HealthResponse } from '../types';
import '../styles/OrderDetailPage.css';

interface PaymentCheckState {
  isChecking: boolean;
  checkCount: number;
  maxChecks: number;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [testPaymentMode, setTestPaymentMode] = useState(false);
  const [paymentCheck, setPaymentCheck] = useState<PaymentCheckState>({
    isChecking: false,
    checkCount: 0,
    maxChecks: 30,
  });

  const orderId = parseInt(id || '0', 10);

  // 주문 정보 조회
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/orders/${orderId}`);
        setOrder(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || '주문을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    if (orderId > 0) {
      fetchOrder();
    }
  }, [orderId]);

  // 테스트 결제 모드 확인
  useEffect(() => {
    const checkPaymentMode = async () => {
      try {
        const response = await apiClient.get<HealthResponse>('/health');
        setTestPaymentMode(response.data.test_payment_mode);
      } catch (err) {
        console.error('Failed to check payment mode', err);
      }
    };

    checkPaymentMode();
  }, []);

  // 결제 상태 확인 (테스트 모드에서 pending 상태일 때)
  useEffect(() => {
    if (
      !testPaymentMode ||
      !order ||
      order.status !== 'pending' ||
      paymentCheck.isChecking ||
      paymentCheck.checkCount >= paymentCheck.maxChecks
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPaymentCheck((prev) => ({ ...prev, isChecking: true }));
        const response = await apiClient.get(`/api/orders/${orderId}`);
        setOrder(response.data);
        setPaymentCheck((prev) => ({
          ...prev,
          checkCount: prev.checkCount + 1,
          isChecking: false,
        }));
      } catch (err) {
        console.error('Failed to check order status', err);
        setPaymentCheck((prev) => ({
          ...prev,
          checkCount: prev.checkCount + 1,
          isChecking: false,
        }));
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [testPaymentMode, order, orderId, paymentCheck]);

  // 주문 취소
  const handleCancel = async () => {
    if (!window.confirm('이 주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      setCancelling(true);
      setError(null);
      const response = await apiClient.post(`/api/orders/${orderId}/cancel`);
      setOrder(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '주문 취소에 실패했습니다');
    } finally {
      setCancelling(false);
    }
  };

  // 결제 진행
  const handleProceedToPayment = () => {
    navigate(`/checkout?order_id=${orderId}`);
  };

  if (loading) {
    return (
      <div className="order-detail-page">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-detail-page">
        <div className="error-container">
          <p className="error-message">{error || '주문을 찾을 수 없습니다'}</p>
          <Link to="/orders" className="btn btn-primary">
            주문 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    pending: '결제 대기 중',
    paid: '결제 완료',
    completed: '배송 완료',
    cancelled: '취소됨',
  };

  const statusClass = `status-${order.status}`;

  return (
    <div className="order-detail-page">
      <div className="order-detail-container">
        <div className="order-header">
          <h1>주문 상세</h1>
          <Link to="/orders" className="btn btn-secondary">
            주문 목록
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="order-info-card">
          <div className="info-row">
            <label>주문 번호:</label>
            <span className="value">#{order.id}</span>
          </div>
          <div className="info-row">
            <label>주문 날짜:</label>
            <span className="value">{new Date(order.created_at).toLocaleString('ko-KR')}</span>
          </div>
          <div className="info-row">
            <label>상태:</label>
            <span className={`value status ${statusClass}`}>{statusLabel[order.status]}</span>
          </div>
          {testPaymentMode && order.status === 'pending' && (
            <div className="info-row test-payment-notice">
              <span className="notice-text">
                🧪 테스트 결제 모드: 결제 상태를 확인 중입니다... ({paymentCheck.checkCount}/{paymentCheck.maxChecks})
              </span>
            </div>
          )}
        </div>

        <div className="order-items-section">
          <h2>주문 상품</h2>
          <div className="items-table">
            <div className="table-header">
              <div className="col-product">상품</div>
              <div className="col-quantity">수량</div>
              <div className="col-price">단가</div>
              <div className="col-total">합계</div>
            </div>
            {order.items && order.items.length > 0 ? (
              order.items.map((item) => (
                <div key={item.id} className="table-row">
                  <div className="col-product">상품 ID: {item.product_id}</div>
                  <div className="col-quantity">{item.quantity}</div>
                  <div className="col-price">₩{item.unit_price.toLocaleString()}</div>
                  <div className="col-total">₩{(item.unit_price * item.quantity).toLocaleString()}</div>
                </div>
              ))
            ) : (
              <div className="table-row empty">
                <div className="col-product">주문 상품이 없습니다</div>
              </div>
            )}
          </div>
        </div>

        <div className="order-summary">
          <div className="summary-row">
            <span className="label">총액:</span>
            <span className="amount">₩{order.total_amount.toLocaleString()}</span>
          </div>
        </div>

        <div className="order-actions">
          {order.status === 'pending' && (
            <>
              <button
                className="btn btn-primary btn-large"
                onClick={handleProceedToPayment}
                disabled={cancelling}
              >
                결제 진행
              </button>
              <button
                className="btn btn-danger btn-large"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? '취소 중...' : '주문 취소'}
              </button>
            </>
          )}
          {order.status !== 'pending' && (
            <Link to="/products" className="btn btn-primary btn-large">
              계속 쇼핑하기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
