import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PaginatedResponse } from '../types';
import type { Order } from '../types';
import '../styles/AdminOrdersPage.css';

const AdminOrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const limit = 20;

  // 관리자 권한 확인
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // 주문 목록 조회
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));
        if (statusFilter) {
          params.append('status', statusFilter);
        }
        const response = await apiClient.get<PaginatedResponse<OrderDetail>>(
          `/api/admin/orders?${params.toString()}`,
        );
        setOrders(response.data.items);
        setTotal(response.data.total);
      } catch (err: any) {
        setError(err.response?.data?.error || '주문 목록을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchOrders();
    }
  }, [page, statusFilter, user]);

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge-pending';
      case 'paid':
        return 'badge-paid';
      case 'completed':
        return 'badge-completed';
      case 'cancelled':
        return 'badge-cancelled';
      default:
        return 'badge-default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '결제 대기';
      case 'paid':
        return '결제 완료';
      case 'completed':
        return '배송 완료';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  if (!user || user.role !== 'admin') {
    return <div className="admin-orders-page">접근 권한이 없습니다</div>;
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-orders-container">
        <h1>주문 관리</h1>

        {error && <div className="error-message">{error}</div>}

        <div className="admin-orders-controls">
          <div className="filter-group">
            <label htmlFor="status-filter">상태 필터:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="filter-select"
            >
              <option value="">모든 상태</option>
              <option value="pending">결제 대기</option>
              <option value="paid">결제 완료</option>
              <option value="completed">배송 완료</option>
              <option value="cancelled">취소됨</option>
            </select>
          </div>
          <div className="total-info">
            총 {total}개 주문 (페이지 {page}/{totalPages})
          </div>
        </div>

        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="no-orders">주문이 없습니다</div>
        ) : (
          <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>주문 ID</th>
                  <th>사용자 ID</th>
                  <th>총액</th>
                  <th>상태</th>
                  <th>상품 수</th>
                  <th>생성일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="order-row">
                    <td className="order-id">#{order.id}</td>
                    <td className="user-id">{order.user_id}</td>
                    <td className="total-amount">{order.total_amount.toLocaleString()}원</td>
                    <td className="status">
                      <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="item-count">{order.items.length}개</td>
                    <td className="created-at">
                      {new Date(order.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="actions">
                      <button
                        className="btn-view"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn-pagination"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              이전
            </button>
            <span className="page-info">
              {page} / {totalPages}
            </span>
            <button
              className="btn-pagination"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrdersPage;
