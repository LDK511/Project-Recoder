import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { EmptyState, ProductImage } from '../components/ui';
import { formatDate, formatPrice } from '../utils/formatters';

export const OrdersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const { orders, pagination, isLoading, error, fetchOrders } = useOrders(10);

  useEffect(() => {
    fetchOrders(page);
  }, [fetchOrders, page]);

  return (
    <div className="shell max-w-3xl pt-8">
      <h1 className="page-title">주문·배송 조회</h1>
      {error && <ErrorAlert message={error} className="mt-4" />}

      {isLoading && orders.length === 0 ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="box"
          title="아직 주문한 상품이 없어요"
          action={
            <Link to="/" className="btn-primary">
              상품 둘러보기
            </Link>
          }
        />
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => {
            const first = order.items[0];
            const more = order.items.length - 1;
            return (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className="panel block p-5 transition-colors hover:border-ink">
                  <div className="flex items-center justify-between gap-3">
                    <p className="num text-sm text-ink-mute">
                      {formatDate(order.created_at, false)} · {order.order_number}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <ProductImage src={first?.image_url ?? null} alt={first?.product_name ?? ''} className="h-16 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[15px] font-semibold">
                        {first?.product_name}
                        {more > 0 && <span className="font-normal text-ink-mute"> 외 {more}건</span>}
                      </p>
                      <p className="num mt-0.5 text-[15px]">{formatPrice(order.total_cents)}</p>
                    </div>
                  </div>
                  {order.status === 'pending' && (
                    <p className="mt-3 text-sm font-semibold text-amber-800">결제를 완료해야 상품이 준비됩니다.</p>
                  )}
                  {order.status === 'shipping' && order.tracking_number && (
                    <p className="num mt-3 text-sm text-ink-soft">
                      {order.tracking_carrier} {order.tracking_number}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={(p) => {
          setParams(p === 1 ? {} : { page: String(p) });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};

export default OrdersPage;
