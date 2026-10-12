import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, productsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCartContext } from '../context/CartContext';
import { useStoreConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import type { Product } from '../types';
import { formatPrice } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { EmptyState, Price, ProductImage, QuantityStepper } from '../components/ui';
import { Icon } from '../components/Icon';

const MAX_PER_ORDER = 99;

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCartContext();
  const toast = useToast();
  const cfg = useStoreConfig();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'cart' | 'buy' | null>(null);
  const [tab, setTab] = useState<'desc' | 'shipping'>('desc');

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadError(null);
    productsAPI
      .getDetail(Number(id))
      .then((r) => alive && setProduct(r.data))
      .catch((err) => alive && setLoadError(getErrorMessage(err, '상품 정보를 불러오지 못했습니다.')))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (product) document.title = `${product.name} | ${cfg.store.name}`;
    return () => {
      document.title = cfg.store.name;
    };
  }, [product, cfg.store.name]);

  if (isLoading) return <LoadingSpinner />;
  if (!product) {
    return (
      <div className="shell">
        <EmptyState
          title="판매하지 않는 상품이에요"
          description={loadError ?? '상품이 삭제되었거나 주소가 잘못되었습니다.'}
          action={
            <Link to="/" className="btn-primary">
              다른 상품 보기
            </Link>
          }
        />
      </div>
    );
  }

  const soldOut = product.stock <= 0;
  const maxQty = Math.min(product.stock, MAX_PER_ORDER);
  const lineTotal = product.price_cents * quantity;

  const requireLogin = () => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  };

  const handleAdd = async (mode: 'cart' | 'buy') => {
    if (!isAuthenticated) return requireLogin();
    if (mode === 'buy') {
      // 바로 구매: 장바구니를 거치지 않고 이 상품만 주문서로
      navigate('/checkout', { state: { direct: [{ product_id: product.id, quantity }] } });
      return;
    }
    setBusy(mode);
    setActionError(null);
    try {
      await addItem(product.id, quantity);
      toast.show('장바구니에 담았어요.', { action: { label: '장바구니 보기', to: '/cart' } });
    } catch (err) {
      setActionError(getErrorMessage(err, '장바구니에 담지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const fee = cfg.shipping.fee_cents;
  const threshold = cfg.shipping.free_threshold_cents;

  return (
    <div className="shell pt-6">
      <nav className="mb-5 text-sm text-ink-mute" aria-label="현재 위치">
        <Link to="/" className="hover:text-ink">
          홈
        </Link>
        {product.category && (
          <>
            <span className="mx-2">/</span>
            <Link to={`/?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
              {product.category}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <ProductImage src={product.image_url} alt={product.name} className="aspect-square" rounded="rounded-xl" />

        <div className="md:sticky md:top-28 md:self-start">
          <h1 className="text-2xl font-bold leading-snug tracking-tight sm:text-[28px]">{product.name}</h1>
          <div className="mt-4">
            <Price price={product.price_cents} compareAt={product.compare_at_price_cents} size="lg" />
          </div>

          <dl className="mt-6 space-y-3 border-y border-line py-5 text-[15px]">
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-ink-mute">배송비</dt>
              <dd>
                {fee === 0 ? '무료배송' : `${formatPrice(fee)}`}
                {fee > 0 && threshold > 0 && (
                  <span className="text-ink-mute"> ({formatPrice(threshold)} 이상 구매 시 무료)</span>
                )}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-ink-mute">출고</dt>
              <dd>결제 후 1~2 영업일 이내 출고 (주말·공휴일 제외)</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-ink-mute">재고</dt>
              <dd className={soldOut ? 'font-semibold text-sale' : product.stock <= 5 ? 'font-semibold text-sale' : ''}>
                {soldOut ? '품절 — 재입고 예정 미정' : product.stock <= 5 ? `${product.stock}개 남음` : '구매 가능'}
              </dd>
            </div>
          </dl>

          {!soldOut && (
            <div className="mt-5 flex items-center justify-between rounded-lg bg-well px-4 py-3.5">
              <QuantityStepper value={quantity} max={maxQty} onChange={setQuantity} />
              <p className="num text-right">
                <span className="block text-[13px] text-ink-mute">상품 금액</span>
                <span className="text-xl font-extrabold tracking-tight">{formatPrice(lineTotal)}</span>
              </p>
            </div>
          )}

          {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} className="mt-4" />}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn-outline btn-lg" onClick={() => handleAdd('cart')} disabled={soldOut || busy !== null}>
              {busy === 'cart' ? '담는 중…' : '장바구니'}
            </button>
            <button className="btn-primary btn-lg" onClick={() => handleAdd('buy')} disabled={soldOut || busy !== null}>
              {soldOut ? '품절' : busy === 'buy' ? '이동 중…' : '바로 구매'}
            </button>
          </div>
          {!isAuthenticated && !soldOut && (
            <p className="mt-3 text-center text-sm text-ink-mute">
              구매하려면{' '}
              <button onClick={requireLogin} className="font-semibold text-felt underline underline-offset-2">
                로그인
              </button>
              이 필요해요.
            </p>
          )}

          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <Icon name="refresh" className="h-4 w-4 text-felt" /> 수령 후 7일 이내 교환·반품 가능
            </li>
            <li className="flex items-center gap-2">
              <Icon name="shield" className="h-4 w-4 text-felt" /> 결제 정보는 PG사에서 안전하게 처리
            </li>
          </ul>
        </div>
      </div>

      <section className="mt-16">
        <div className="flex border-b border-line" role="tablist">
          {(
            [
              ['desc', '상품 정보'],
              ['shipping', '배송·교환·반품'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-5 py-3.5 text-[15px] ${tab === k ? 'border-ink font-bold text-ink' : 'border-transparent text-ink-mute hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-w-3xl py-8 text-[15px] leading-[1.8] text-ink-soft" role="tabpanel">
          {tab === 'desc' ? (
            <p className="whitespace-pre-line">{product.description || '상품 설명이 아직 없습니다.'}</p>
          ) : (
            <ShippingPolicy />
          )}
        </div>
      </section>
    </div>
  );
};

export const ShippingPolicy: React.FC = () => {
  const cfg = useStoreConfig();
  const fee = cfg.shipping.fee_cents;
  const threshold = cfg.shipping.free_threshold_cents;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-bold text-ink">배송 안내</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            배송비 {fee === 0 ? '무료' : formatPrice(fee)}
            {fee > 0 && threshold > 0 && ` · ${formatPrice(threshold)} 이상 구매 시 무료배송`}
          </li>
          <li>결제 완료 후 1~2 영업일 이내 출고되며, 출고 후 보통 1~2일 안에 도착합니다.</li>
          <li>제주·도서산간 지역은 추가 배송비가 발생할 수 있습니다.</li>
          <li>배송이 시작되면 주문 상세에서 송장번호로 배송 위치를 확인할 수 있습니다.</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-bold text-ink">교환·반품 안내</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>상품을 받은 날로부터 7일 이내에 교환·반품을 신청할 수 있습니다. (전자상거래법 제17조)</li>
          <li>단순 변심에 의한 반품은 왕복 배송비를 고객이 부담합니다.</li>
          <li>상품 불량이나 오배송은 받은 날로부터 3개월 이내, 그 사실을 안 날로부터 30일 이내 무료로 교환·반품해 드립니다.</li>
          <li>사용하거나 포장을 훼손해 상품 가치가 크게 떨어진 경우 교환·반품이 제한될 수 있습니다.</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-bold text-ink">주문 취소</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>상품 준비 전(결제대기·결제완료)에는 주문 상세에서 바로 취소할 수 있고, 결제 금액은 자동 환불됩니다.</li>
          <li>결제대기 주문은 {cfg.order_payment_timeout_minutes}분 안에 결제하지 않으면 자동 취소됩니다.</li>
          <li>
            문의: 고객센터 {cfg.store.phone} ({cfg.store.csHours})
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ProductDetailPage;
