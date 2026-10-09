import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/OrderHistory.css';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (!token) {
      setError('로그인이 필요합니다');
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || '주문 조회 실패');
          return;
        }

        setOrders(data.orders || []);
      } catch (err) {
        setError('네트워크 오류: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  if (loading) return <div className="order-history-container"><p>로딩 중...</p></div>;
  if (error) return <div className="order-history-container"><p className="error-message">{error}</p></div>;

  return (
    <div className="order-history-container">
      <h1>주문 이력</h1>
      {orders.length === 0 ? (
        <p className="no-orders">주문 이력이 없습니다</p>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <h3>주문 #{order.id}</h3>
                <span className={`status status-${order.status}`}>{order.status}</span>
              </div>
              <div className="order-details">
                <p><strong>주문일:</strong> {new Date(order.created_at).toLocaleDateString('ko-KR')}</p>
                <p><strong>총액:</strong> ₩{parseInt(order.total_price).toLocaleString('ko-KR')}</p>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="order-items">
                  <h4>상품</h4>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.product_name} × {item.quantity} - ₩{parseInt(item.price).toLocaleString('ko-KR')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}