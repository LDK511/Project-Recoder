import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getErrorMessage, ordersAPI } from '../api/client';
import { useCartContext } from '../context/CartContext';
import { useStoreConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import type { Order } from '../types';
import { formatDate, formatOrderStatus, formatPrice, trackingUrl } from '../utils/formatters';
import OrderStatusBadge from '../components/OrderStatusBadge';
import OrderProgress from '../components/OrderProgress';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StripePayment from '../components/StripePayment';
import { EmptyState, Modal, ProductImage } from '../components/ui';
import { Icon } from '../components/Icon';

const CLOSED_TITLE: Record<string, string> = {
  cancelled: '취소된 주문입니다',
  expired: '결제 기한이 지나 자동 취소된 주문입니다',
  refunded: '환불이 완료된 주문입니다',
};

const POLL_MS = 2000;
const MAX_POLLS = 30;
const CANCEL_REASONS = ['단순 변심', '다른 상품으로 다시 주문', '배송지를 잘못 입력함', '결제 수단 변경', '기타'];

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const fromPayment = params.get('from') === 'payment' || params.has('payment_intent');
  const cfg = useStoreConfig();
  const toast = useToast();
  const cart = useCartContext();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await ordersAPI.getDetail(Number(id));
    setOrder(r.data);
    return r.data as Order;
  }, [id]);

  useEffect(() => {
    load()
      .catch((e) => setError(getErrorMessage(e, '주문을 불러오지 못했습니다.')))
      .finally(() => setLoading(false));
  }, [load]);

  // 결제창에서 돌아온 직후: 웹훅으로 결제가 확정될 때까지 잠시 확인
  useEffect(() => {
    if (!order || order.status !== 'pending' || !fromPayment || polls >= MAX_POLLS) return;
    const t = window.setTimeout(() => {
      load()
        .then((o) => {
          if (o.status === 'paid') {
            cart.refresh().catch(() => undefined);
          }
        })
        .catch(() => undefined)
        .finally(() => setPolls((p) => p + 1));
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [order, fromPayment, polls, load, cart]);

  const resumePayment = async () => {
    if (!order) return;
    setPaying(true);
    setError(null);
    try {
      const r = await ordersAPI.resumePayment(order.id);
      if (r.data.payment_url) {
        window.location.assign(r.data.payment_url);
        return;
      }
      if (r.data.client_secret && cfg.stripe_publishable_key) {
        setClientSecret(r.data.client_secret);
      } else {
        setError('결제 수단이 설정되지 않았습니다. 고객센터로 문의해 주세요.');
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const r = await ordersAPI.cancel(order.id, reason);
      setOrder(r.data);
      setCancelOpen(false);
      toast.show(order.status === 'paid' ? '주문을 취소했어요. 결제 금액은 결제 수단으로 환불됩니다.' : '주문을 취소했어요.');
    } catch (e) {
      toast.show(getErrorMessage(e), { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!order) {
    return (
      <div className="shell pt-8">
        <EmptyState
          title="주문을 찾을 수 없어요"
          description={error ?? undefined}
          action={
            <Link to="/orders" className="btn-primary">
              주문 내역으로
            </Link>
          }
        />
      </div>
    );
  }

  const waiting = order.status === 'pending' && fromPayment && polls < MAX_POLLS;
  const justPaid = fromPayment && ['paid', 'preparing'].includes(order.status);
  const canCancel = order.status === 'pending' || order.status === 'paid';
  const closed = ['cancelled', 'expired', 'refunded'].includes(order.status);
  const track = trackingUrl(order.tracking_carrier, order.tracking_number);
  const returnUrl = `${window.location.origin}/orders/${order.id}?from=payment`;

  return (
    <div className="shell max-w-3xl pt-8">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink">
        <Icon name="chevronLeft" className="h-4 w-4" /> 주문 내역
      </Link>

      {/* 상태 안내 */}
      {justPaid && (
        <div className="mt-4 rounded-xl bg-felt px-6 py-7 text-white">
          <p className="text-2xl font-extrabold tracking-tight">주문이 완료되었어요</p>
          <p className="mt-1.5 text-white/80">
            결제가 확인되었습니다. 상품이 출고되면 송장번호를 이 화면에서 확인할 수 있어요.
          </p>
          <div className="mt-5 flex gap-2">
            <Link to="/" className="btn bg-white text-felt hover:bg-white/90">
              쇼핑 계속하기
            </Link>
            <button className="btn border border-white/40 text-white hover:bg-white/10" onClick={() => setParams({})}>
              주문 상세 보기
            </button>
          </div>
        </div>
      )}
      {waiting && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line px-5 py-4" role="status">
          <LoadingSpinner inline size="small" />
          <p>결제 결과를 확인하고 있어요. 이 화면을 닫지 말고 잠시만 기다려 주세요.</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title num">주문번호 {order.order_number}</h1>
          <p className="mt-1 text-sm text-ink-mute">{formatDate(order.created_at)} 주문</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mt-4" />}

      {order.status === 'pending' && !waiting && (
        <section className="panel mt-6 p-5">
          <p className="font-semibold">결제를 기다리고 있어요</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            {order.expires_at ? `${formatDate(order.expires_at)}까지 결제하지 않으면 주문이 자동 취소됩니다.` : '결제를 완료해 주세요.'}
          </p>
          {clientSecret && cfg.stripe_publishable_key ? (
            <div className="mt-5">
              <StripePayment publishableKey={cfg.stripe_publishable_key} clientSecret={clientSecret} amount={order.total_cents} returnUrl={returnUrl} />
            </div>
          ) : (
            <button className="btn-primary mt-4" onClick={resumePayment} disabled={paying}>
              {paying ? '결제창 여는 중…' : `${formatPrice(order.total_cents)} 결제하기`}
            </button>
          )}
        </section>
      )}

      {closed && (
        <section className="mt-6 rounded-lg bg-well p-5">
          <p className="font-semibold">{CLOSED_TITLE[order.status]}</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            {order.cancel_reason ? `사유: ${order.cancel_reason}` : ''}
            {order.cancelled_at ? ` · ${formatDate(order.cancelled_at)}` : ''}
          </p>
          {order.payment_id && order.status !== 'expired' && (
            <p className="mt-1 text-sm text-ink-mute">결제 금액은 결제 수단으로 환불되며, 카드사에 따라 3~5 영업일이 걸릴 수 있어요.</p>
          )}
        </section>
      )}

      {!closed && order.status !== 'pending' && (
        <section className="panel mt-6 p-5 sm:p-6" aria-label="배송 진행 상태">
          <OrderProgress order={order} />
          {order.tracking_number && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md bg-well px-4 py-3">
              <p className="text-[15px]">
                <Icon name="truck" className="mr-1.5 inline h-5 w-5 align-[-4px] text-felt" />
                {order.tracking_carrier} <span className="num font-semibold">{order.tracking_number}</span>
              </p>
              {track && (
                <a href={track} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
                  배송 조회
                </a>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-bold">주문 상품</h2>
        <ul className="mt-3 divide-y divide-line">
          {order.items.map((item, i) => (
            <li key={item.id ?? i} className="flex items-center gap-4 py-3.5">
              <ProductImage src={item.image_url} alt={item.product_name} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                {item.product_id ? (
                  <Link to={`/products/${item.product_id}`} className="line-clamp-1 hover:underline">
                    {item.product_name}
                  </Link>
                ) : (
                  <p className="line-clamp-1">{item.product_name}</p>
                )}
                <p className="num text-sm text-ink-mute">
                  {formatPrice(item.price_cents)} · {item.quantity}개
                </p>
              </div>
              <p className="num font-bold">{formatPrice(item.price_cents * item.quantity)}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-bold">배송지</h2>
          <dl className="mt-3 space-y-1.5 text-[15px]">
            <dd className="font-semibold">{order.recipient_name}</dd>
            <dd className="num text-ink-soft">{order.recipient_phone}</dd>
            <dd className="text-ink-soft">
              ({order.postal_code}) {order.address1} {order.address2}
            </dd>
            {order.delivery_memo && <dd className="text-sm text-ink-mute">메모: {order.delivery_memo}</dd>}
          </dl>
        </section>
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-bold">결제 정보</h2>
          <dl className="num mt-3 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">상품 금액</dt>
              <dd>{formatPrice(order.subtotal_cents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">배송비</dt>
              <dd>{order.shipping_fee_cents ? formatPrice(order.shipping_fee_cents) : '무료'}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2.5 font-bold">
              <dt>총 결제 금액</dt>
              <dd className="text-lg">{formatPrice(order.total_cents)}</dd>
            </div>
            {order.paid_at && (
              <div className="flex justify-between text-sm text-ink-mute">
                <dt>결제 일시</dt>
                <dd>{formatDate(order.paid_at)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {order.history && order.history.length > 0 && (
        <section className="mt-6 px-1">
          <h2 className="text-[15px] font-bold">처리 이력</h2>
          <ol className="mt-3 space-y-2 border-l-2 border-line pl-4 text-sm">
            {order.history.map((h) => (
              <li key={h.id}>
                <span className="num text-ink-mute">{formatDate(h.created_at)}</span>{' '}
                <span className="font-semibold">{formatOrderStatus(h.to_status)}</span>
                {h.note && <span className="text-ink-soft"> — {h.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {canCancel && (
          <button className="btn-danger" onClick={() => setCancelOpen(true)}>
            주문 취소
          </button>
        )}
        {['preparing', 'shipping', 'completed'].includes(order.status) && (
          <p className="text-sm text-ink-mute">
            교환·반품은 고객센터 {cfg.store.phone} 또는 {cfg.store.email}로 신청해 주세요.
          </p>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="주문 취소">
        <p className="text-[15px] text-ink-soft">
          {order.status === 'paid'
            ? `취소하면 ${formatPrice(order.total_cents)}이 결제 수단으로 환불됩니다.`
            : '결제 전 주문이라 바로 취소됩니다.'}
        </p>
        <fieldset className="mt-4 space-y-2">
          <legend className="field-label">취소 사유</legend>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3.5 py-2.5 has-[:checked]:border-felt has-[:checked]:bg-felt-light">
              <input type="radio" name="reason" className="accent-felt" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </fieldset>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={() => setCancelOpen(false)}>
            돌아가기
          </button>
          <button className="btn-dark" onClick={cancel} disabled={cancelling}>
            {cancelling ? '취소하는 중…' : '주문 취소하기'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetailPage;
