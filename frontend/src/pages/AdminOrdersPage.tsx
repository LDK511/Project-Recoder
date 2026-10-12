import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI, getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import AdminLayout from '../components/AdminLayout';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Pagination from '../components/Pagination';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, Field, Modal, ProductImage } from '../components/ui';
import type { Order, OrderStatus, PaginationMeta } from '../types';
import { formatDate, formatOrderStatus, formatPrice, ORDER_STATUS_LABEL } from '../utils/formatters';

const TABS: (OrderStatus | '')[] = ['', 'pending', 'paid', 'preparing', 'shipping', 'completed', 'cancelled', 'expired', 'refunded'];
const CARRIERS = ['CJ대한통운', '한진택배', '롯데택배', '우체국택배', '로젠택배', '경동택배'];

/** 상태별로 관리자가 할 수 있는 다음 작업 */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; tone: 'primary' | 'danger' }[]>> = {
  pending: [{ to: 'cancelled', label: '주문 취소', tone: 'danger' }],
  paid: [
    { to: 'preparing', label: '상품 준비 시작', tone: 'primary' },
    { to: 'cancelled', label: '취소 및 환불', tone: 'danger' },
  ],
  preparing: [
    { to: 'shipping', label: '송장 등록하고 발송', tone: 'primary' },
    { to: 'cancelled', label: '취소 및 환불', tone: 'danger' },
  ],
  shipping: [{ to: 'completed', label: '배송 완료 처리', tone: 'primary' }],
  completed: [{ to: 'refunded', label: '반품 환불 처리', tone: 'danger' }],
};

const AdminOrdersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as OrderStatus | '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(q);
  const [selected, setSelected] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([adminAPI.orders({ page, limit: 20, status: status || undefined, q: q || undefined }), adminAPI.stats()]);
      setOrders(r.data.data);
      setPagination(r.data.pagination);
      setCounts(s.data.status_counts);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!('page' in patch)) n.delete('page');
    setParams(n);
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <AdminLayout title="주문 관리">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5 pb-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t || 'all'}
              role="tab"
              aria-selected={status === t}
              onClick={() => update({ status: t || null })}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
                status === t ? 'border-ink bg-ink font-semibold text-white' : 'border-line text-ink-soft hover:border-ink'
              }`}
            >
              {t ? ORDER_STATUS_LABEL[t] : '전체'}
              <span className={`num ml-1 ${status === t ? 'text-white/70' : 'text-ink-mute'}`}>{t ? counts[t] ?? 0 : total}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: query.trim() || null });
        }}
      >
        <input
          className="input max-w-sm"
          type="search"
          placeholder="주문번호, 주문자, 받는 분, 연락처"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="주문 검색"
        />
        <button className="btn-dark">검색</button>
      </form>

      {error && <ErrorAlert message={error} className="mt-4" />}

      <div className="panel mt-4 overflow-hidden">
        {loading && orders.length === 0 ? (
          <LoadingSpinner />
        ) : orders.length === 0 ? (
          <EmptyState title="조건에 맞는 주문이 없어요" icon="list" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead className="bg-well text-sm text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">주문번호 / 일시</th>
                  <th className="px-4 py-3 font-semibold">주문자</th>
                  <th className="px-4 py-3 font-semibold">상품</th>
                  <th className="px-4 py-3 text-right font-semibold">결제금액</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-well/50">
                    <td className="px-4 py-3.5">
                      <p className="num font-semibold">{o.order_number}</p>
                      <p className="num text-sm text-ink-mute">{formatDate(o.created_at)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p>{o.customer_name}</p>
                      <p className="text-sm text-ink-mute">{o.customer_email}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      <p className="truncate">
                        {o.items[0]?.product_name}
                        {o.items.length > 1 && <span className="text-ink-mute"> 외 {o.items.length - 1}건</span>}
                      </p>
                    </td>
                    <td className="num px-4 py-3.5 text-right font-semibold">{formatPrice(o.total_cents)}</td>
                    <td className="px-4 py-3.5">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button className={NEXT[o.status] ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setSelected(o)}>
                        {NEXT[o.status] ? '처리' : '보기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination pagination={pagination} isLoading={loading} onPageChange={(p) => update({ page: p === 1 ? null : String(p) })} />

      {selected && (
        <OrderModal
          orderId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={(o) => {
            toast.show(`주문 ${o.order_number}을(를) '${formatOrderStatus(o.status)}'(으)로 변경했어요.`);
            setSelected(null);
            load();
          }}
        />
      )}
    </AdminLayout>
  );
};

const OrderModal: React.FC<{ orderId: number; onClose: () => void; onChanged: (o: Order) => void }> = ({ orderId, onClose, onChanged }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [mode, setMode] = useState<OrderStatus | null>(null);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminAPI
      .order(orderId)
      .then((r) => setOrder(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [orderId]);

  const apply = async (to: OrderStatus) => {
    if (!order) return;
    if ((to === 'shipping' || to === 'cancelled' || to === 'refunded') && mode !== to) {
      setMode(to);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await adminAPI.updateStatus(order.id, {
        status: to,
        ...(to === 'shipping' ? { tracking_carrier: carrier, tracking_number: tracking.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onChanged(r.data);
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={order ? `주문 ${order.order_number}` : '주문'} wide>
      {!order ? (
        error ? <ErrorAlert message={error} /> : <LoadingSpinner />
      ) : (
        <div className="space-y-5 text-[15px]">
          <div className="flex items-center justify-between">
            <OrderStatusBadge status={order.status} />
            <p className="num text-sm text-ink-mute">{formatDate(order.created_at)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-well p-3.5">
              <p className="text-sm font-semibold text-ink-mute">주문자</p>
              <p className="mt-1">{order.customer_name}</p>
              <p className="text-sm text-ink-soft">{order.customer_email}</p>
            </div>
            <div className="rounded-md bg-well p-3.5">
              <p className="text-sm font-semibold text-ink-mute">배송지</p>
              <p className="mt-1">
                {order.recipient_name} · <span className="num">{order.recipient_phone}</span>
              </p>
              <p className="text-sm text-ink-soft">
                ({order.postal_code}) {order.address1} {order.address2}
              </p>
              {order.delivery_memo && <p className="text-sm text-ink-mute">메모: {order.delivery_memo}</p>}
            </div>
          </div>

          <ul className="divide-y divide-line rounded-md border border-line">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 p-3">
                <ProductImage src={it.image_url} alt={it.product_name} className="h-12 w-12 shrink-0" />
                <p className="min-w-0 flex-1 truncate">{it.product_name}</p>
                <p className="num shrink-0 text-ink-soft">×{it.quantity}</p>
                <p className="num w-24 shrink-0 text-right font-semibold">{formatPrice(it.price_cents * it.quantity)}</p>
              </li>
            ))}
            <li className="num flex justify-between p-3 text-sm text-ink-soft">
              <span>상품 {formatPrice(order.subtotal_cents)} + 배송비 {formatPrice(order.shipping_fee_cents)}</span>
              <span className="text-base font-bold text-ink">{formatPrice(order.total_cents)}</span>
            </li>
          </ul>

          {order.tracking_number && (
            <p>
              송장: {order.tracking_carrier} <span className="num font-semibold">{order.tracking_number}</span>
            </p>
          )}
          {order.payment_id && <p className="num text-sm text-ink-mute">결제 ID: {order.payment_id}</p>}

          {mode === 'shipping' && (
            <div className="grid gap-3 rounded-md border border-felt/30 bg-felt-light/50 p-4 sm:grid-cols-[160px_1fr]">
              <Field id="carrier" label="택배사" required>
                <select id="carrier" className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                  {CARRIERS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field id="tracking" label="송장번호" required>
                <input id="tracking" className="input num" value={tracking} onChange={(e) => setTracking(e.target.value.replace(/[^\dA-Za-z-]/g, ''))} autoFocus />
              </Field>
            </div>
          )}
          {(mode === 'cancelled' || mode === 'refunded') && (
            <div className="rounded-md border border-sale/30 bg-sale/[0.04] p-4">
              <p className="text-sm">
                {order.payment_id ? `결제 금액 ${formatPrice(order.total_cents)}이 고객에게 환불됩니다. ` : ''}
                {mode === 'cancelled' ? '예약된 재고는 다시 판매 가능 상태가 됩니다.' : ''}
              </p>
              <Field id="note" label="사유" optional className="mt-3">
                <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 재고 부족, 고객 요청" maxLength={255} />
              </Field>
            </div>
          )}

          {error && <ErrorAlert message={error} />}

          {NEXT[order.status] ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {NEXT[order.status]!.map((a) => (
                <button
                  key={a.to}
                  className={a.tone === 'primary' ? 'btn-primary' : 'btn-danger'}
                  disabled={busy || (a.to === 'shipping' && mode === 'shipping' && !tracking.trim())}
                  onClick={() => apply(a.to)}
                >
                  {busy && mode === a.to ? '처리 중…' : mode === a.to ? `${a.label} 확정` : a.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="border-t border-line pt-4 text-sm text-ink-mute">더 이상 처리할 작업이 없는 주문입니다.</p>
          )}

          {order.history && order.history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-ink-soft">처리 이력 {order.history.length}건</summary>
              <ol className="mt-2 space-y-1 border-l-2 border-line pl-3">
                {order.history.map((h) => (
                  <li key={h.id}>
                    <span className="num text-ink-mute">{formatDate(h.created_at)}</span> {formatOrderStatus(h.to_status)}{' '}
                    <span className="text-ink-mute">· {h.actor}</span>
                    {h.note && <span className="text-ink-soft"> — {h.note}</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AdminOrdersPage;
