import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

function OrderComplete() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (!response.ok) {
          throw new Error('주문 정보를 불러올 수 없습니다.');
        }
        const data = await response.json();
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return <div className="order-complete-container"><p>로딩 중...</p></div>;
  }

  if (error) {
    return (
      <div className="order-complete-container">
        <p className="error-message">{error}</p>
        <Link to="/" className="btn-primary">쇼핑 계속하기</Link>
      </div>
    );
  }

  return (
    <div className="order-complete-container">
      <div className="order-complete-card">
        <div className="success-icon">✓</div>
        <h1>주문이 완료되었습니다!</h1>
        <p className="order-id">주문번호: {order?.orderId}</p>
        
        <div className="order-summary">
          <h2>주문 정보</h2>
          <div className="order-details">
            <p><strong>상태:</strong> {order?.status}</p>
            <p><strong>총액:</strong> ₩{order?.total?.toLocaleString()}</p>
            <p><strong>주문일:</strong> {new Date(order?.createdAt).toLocaleDateString('ko-KR')}</p>
          </div>

          <h3>주문 상품</h3>
          <div className="order-items">
            {order?.items?.map((item) => (
              <div key={item.productId} className="order-item">
                <span>{item.productName}</span>
                <span>수량: {item.quantity}</span>
                <span>₩{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="order-actions">
          <Link to="/" className="btn-primary">계속 쇼핑하기</Link>
        </div>
      </div>
    </div>
  );
}

export default OrderComplete;