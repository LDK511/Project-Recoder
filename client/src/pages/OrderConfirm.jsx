import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder } from '../api/client';
import '../styles/OrderConfirm.css';

export default function OrderConfirm() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await getOrder(orderId);
        setOrder(data);
      } catch (err) {
        setError(err.message || '주문 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return <div className="order-confirm-container"><p>로딩 중...</p></div>;
  }

  if (error) {
    return (
      <div className="order-confirm-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-confirm-container">
        <p>주문 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="order-confirm-container">
      <div className="order-confirm-card">
        <h1>주문 완료</h1>
        <div className="success-icon">✓</div>
        
        <div className="order-info">
          <div className="info-row">
            <span className="label">주문 번호:</span>
            <span className="value">{order._id}</span>
          </div>
          <div className="info-row">
            <span className="label">주문 상태:</span>
            <span className="value status">{order.status}</span>
          </div>
          <div className="info-row">
            <span className="label">총 금액:</span>
            <span className="value amount">₩{order.totalPrice.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="label">주문 일시:</span>
            <span className="value">{new Date(order.createdAt).toLocaleString('ko-KR')}</span>
          </div>
        </div>

        <div className="order-items">
          <h2>주문 상품</h2>
          <table className="items-table">
            <thead>
              <tr>
                <th>상품명</th>
                <th>수량</th>
                <th>가격</th>
                <th>소계</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.productId}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>₩{item.price.toLocaleString()}</td>
                  <td>₩{(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="action-buttons">
          <button className="btn-primary" onClick={() => navigate('/')}>계속 쇼핑하기</button>
          <button className="btn-secondary" onClick={() => navigate('/orders')}>주문 목록 보기</button>
        </div>
      </div>
    </div>
  );
}