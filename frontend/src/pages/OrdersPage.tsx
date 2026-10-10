import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import '../styles/OrdersPage.css';

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  completed: '배송 완료',
  cancelled: '취소됨',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#ff9800',
  paid: '#4caf50',
  completed: '#2196f3',
  cancelled: '#f44336',
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);

  // 주문 목록 조회
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await apiClient.get<PaginatedResponse>('/api/orders', {
          params: { page, limit },
        });
        setOrders(response.data.items);
        setTotal(response.data.total);
      } catch (err: any) {
        setError(err.response?.data?.error || '주문 목록 조회 실패');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user, page, limit]);

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('이 주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      await apiClient.post(`/api/orders/${orderId}/cancel`);
      // 주문 목록 새로고침
      const response = await apiClient.get<PaginatedResponse>('/api/orders', {
        params: { page, limit },
      });
      setOrders(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || '주문 취소 실패');
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (!user) {
    return (
      <div className="orders-container">
        <div className="error-message">로그인이 필요합니다</div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <h1>주문 내역</h1>

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">로딩 중...</div>}

      {!loading && orders.length === 0 && (
        <div className="empty-state">
          <p>주문 내역이 없습니다</p>
          <Link to="/products" className="link-button">
            상품 보기
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <>
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div className="order-info">
                    <h3>주문 #{order.id}</h3>
                    <p className="order-date">
                      {new Date(order.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="order-status">
                    <span
                      className="status-badge"
                      style={{ backgroundColor: STATUS_COLORS[order.status] }}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>

                <div className="order-items">
                  <h4>주문 상품</h4>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span className="item-quantity">수량: {item.quantity}</span>
                        <span className="item-price">
                          {(item.unit_price * item.quantity).toLocaleString('ko-KR')}원
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="order-footer">
                  <div className="order-total">
                    <span>총액:</span>
                    <span className="total-amount">
                      {order.total_amount.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="order-actions">
                    <Link to={`/orders/${order.id}`} className="btn btn-primary">
                      상세 보기
                    </Link>
                    {order.status === 'pending' && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                이전
              </button>
              <span className="pagination-info">
                {page} / {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
