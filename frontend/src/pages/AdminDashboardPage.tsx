import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, getErrorMessage } from '../api/client';
import AdminLayout from '../components/AdminLayout';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import { ProductImage } from '../components/ui';
import type { DashboardStats, OrderStatus } from '../types';
import { formatPrice, ORDER_STATUS_LABEL } from '../utils/formatters';

const PIPELINE: OrderStatus[] = ['pending', 'paid', 'preparing', 'shipping', 'completed'];

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminAPI
      .stats()
      .then((r) => setStats(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (!stats) {
    return <AdminLayout title="대시보드">{error ? <ErrorAlert message={error} /> : <LoadingSpinner />}</AdminLayout>;
  }

  const max = Math.max(1, ...stats.daily.map((d) => d.revenue));
  const todo = stats.status_counts.paid ?? 0;

  return (
    <AdminLayout title="대시보드">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="오늘 매출" value={formatPrice(stats.today.revenue)} sub={`결제 ${stats.today.orders}건`} />
        <Kpi label="이번 달 매출" value={formatPrice(stats.month.revenue)} sub={`결제 ${stats.month.orders}건`} />
        <Link to="/admin/orders?status=paid" className="panel block p-5 hover:border-ink">
          <p className="text-sm text-ink-mute">출고 처리할 주문</p>
          <p className={`num mt-1 text-[28px] font-extrabold tracking-tight ${todo > 0 ? 'text-felt' : ''}`}>{todo}건</p>
          <p className="text-sm text-ink-mute">결제완료 상태</p>
        </Link>
        <Kpi label="배송 중" value={`${stats.status_counts.shipping ?? 0}건`} sub="송장 등록 완료" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel p-5">
          <h2 className="font-bold">최근 7일 매출</h2>
          <div className="mt-6 flex h-48 items-end gap-3" role="img" aria-label="최근 7일 일별 매출 막대 그래프">
            {stats.daily.map((d) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="num text-[11px] text-ink-mute">{d.revenue ? `${Math.round(d.revenue / 1000).toLocaleString()}천` : ''}</span>
                <div
                  className={`w-full max-w-[44px] rounded-t ${d.revenue ? 'bg-felt' : 'bg-line'}`}
                  style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
                  title={`${d.day} ${formatPrice(d.revenue)} (${d.orders}건)`}
                />
                <span className="num text-xs text-ink-soft">{d.day}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-bold">주문 단계별 현황</h2>
          <ul className="mt-3 divide-y divide-line">
            {PIPELINE.map((s) => (
              <li key={s}>
                <Link to={`/admin/orders?status=${s}`} className="flex items-center justify-between py-2.5 text-[15px] hover:text-felt">
                  <span>{ORDER_STATUS_LABEL[s]}</span>
                  <span className="num font-semibold">{stats.status_counts[s] ?? 0}</span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between py-2.5 text-[15px] text-ink-mute">
              <span>취소·만료·환불</span>
              <span className="num">
                {(stats.status_counts.cancelled ?? 0) + (stats.status_counts.expired ?? 0) + (stats.status_counts.refunded ?? 0)}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section className="panel mt-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">재고 부족 상품</h2>
          <Link to="/admin/products" className="text-sm text-ink-mute hover:text-ink">
            상품 관리
          </Link>
        </div>
        {stats.low_stock.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-mute">재고가 5개 이하인 상품이 없어요.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.low_stock.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md bg-well p-2.5">
                <ProductImage src={p.image_url} alt={p.name} className="h-12 w-12 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{p.name}</p>
                  <p className={`num text-sm font-bold ${p.stock === 0 ? 'text-sale' : ''}`}>{p.stock === 0 ? '품절' : `${p.stock}개 남음`}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
};

const Kpi: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="panel p-5">
    <p className="text-sm text-ink-mute">{label}</p>
    <p className="num mt-1 text-[28px] font-extrabold tracking-tight">{value}</p>
    <p className="text-sm text-ink-mute">{sub}</p>
  </div>
);

export default AdminDashboardPage;
