import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { useCartContext } from '../context/CartContext';
import CartSummary from '../components/CartSummary';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { EmptyState, ProductImage, QuantityStepper } from '../components/ui';
import { Icon } from '../components/Icon';
import { formatPrice } from '../utils/formatters';
import type { CartItemWithProduct } from '../types';

const isPurchasable = (i: CartItemWithProduct) => i.is_active && i.stock > 0 && i.quantity <= i.stock;

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, isLoading, updateItem, removeItem, refresh } = useCartContext();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    refresh().catch((e) => setError(getErrorMessage(e)));
  }, [refresh]);

  // 처음 들어오면 구매 가능한 상품을 모두 선택
  useEffect(() => {
    if (!initialised && items.length) {
      setSelected(new Set(items.filter(isPurchasable).map((i) => i.id)));
      setInitialised(true);
    }
  }, [items, initialised]);

  const purchasable = items.filter(isPurchasable);
  const chosen = items.filter((i) => selected.has(i.id) && isPurchasable(i));
  const subtotal = chosen.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const compareTotal = chosen.reduce((s, i) => s + (i.compare_at_price_cents ?? i.price_cents) * i.quantity, 0);
  const allChecked = purchasable.length > 0 && purchasable.every((i) => selected.has(i.id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const run = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const removeSelected = async () => {
    const ids = items.filter((i) => selected.has(i.id) || !isPurchasable(i)).map((i) => i.id);
    for (const id of ids) await run(id, () => removeItem(id));
  };

  const checkoutQuery = useMemo(() => chosen.map((i) => i.id).join(','), [chosen]);

  if (isLoading && items.length === 0) return <LoadingSpinner />;

  if (items.length === 0) {
    return (
      <div className="shell pt-8">
        <h1 className="page-title">장바구니</h1>
        <EmptyState
          icon="bag"
          title="장바구니가 비어 있어요"
          description="마음에 드는 상품을 담아 두면 여기서 한 번에 주문할 수 있어요."
          action={
            <Link to="/" className="btn-primary">
              상품 둘러보기
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="shell pt-8">
      <h1 className="page-title">장바구니</h1>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mt-4" />}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="담은 상품">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] accent-felt"
                checked={allChecked}
                onChange={() => setSelected(allChecked ? new Set() : new Set(purchasable.map((i) => i.id)))}
              />
              전체 선택 <span className="num font-normal text-ink-mute">({chosen.length}/{purchasable.length})</span>
            </label>
            <button className="text-sm text-ink-mute hover:text-ink" onClick={removeSelected} disabled={busyId !== null}>
              선택 삭제
            </button>
          </div>

          <ul className="divide-y divide-line">
            {items.map((item) => {
              const ok = isPurchasable(item);
              const problem = !item.is_active
                ? '판매가 종료된 상품입니다.'
                : item.stock <= 0
                  ? '품절된 상품입니다.'
                  : item.quantity > item.stock
                    ? `재고가 ${item.stock}개 남았어요. 수량을 줄여 주세요.`
                    : null;
              return (
                <li key={item.id} className={`flex gap-3 py-5 sm:gap-4 ${busyId === item.id ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-felt"
                    checked={selected.has(item.id) && ok}
                    disabled={!ok}
                    onChange={() => toggle(item.id)}
                    aria-label={`${item.product_name} 선택`}
                  />
                  <Link to={`/products/${item.product_id}`} className="shrink-0">
                    <ProductImage src={item.image_url} alt={item.product_name} className={`h-20 w-20 sm:h-24 sm:w-24 ${ok ? '' : 'opacity-50'}`} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/products/${item.product_id}`} className="line-clamp-2 text-[15px] hover:underline">
                        {item.product_name}
                      </Link>
                      <button
                        onClick={() => run(item.id, () => removeItem(item.id))}
                        className="-mr-1 -mt-1 shrink-0 p-1 text-ink-mute hover:text-ink"
                        aria-label={`${item.product_name} 삭제`}
                      >
                        <Icon name="x" className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                    {problem && <p className="mt-1 text-sm font-semibold text-sale">{problem}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      {item.is_active && item.stock > 0 ? (
                        <QuantityStepper
                          size="sm"
                          value={Math.min(item.quantity, Math.max(item.stock, 1))}
                          max={Math.min(item.stock, 99)}
                          disabled={busyId === item.id}
                          onChange={(q) => run(item.id, () => updateItem(item.id, q))}
                          label={`${item.product_name} 수량`}
                        />
                      ) : (
                        <span />
                      )}
                      <p className="num text-right">
                        {item.compare_at_price_cents && item.compare_at_price_cents > item.price_cents && (
                          <span className="mr-2 text-sm text-ink-mute line-through">
                            {formatPrice(item.compare_at_price_cents * item.quantity)}
                          </span>
                        )}
                        <span className="text-[17px] font-bold">{formatPrice(item.price_cents * item.quantity)}</span>
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <CartSummary subtotal_cents={subtotal} compare_total_cents={compareTotal}>
            <button
              className="btn-primary btn-lg w-full"
              disabled={chosen.length === 0}
              onClick={() => navigate(`/checkout?items=${checkoutQuery}`)}
            >
              {chosen.length === 0 ? '주문할 상품을 선택해 주세요' : `${chosen.length}개 상품 주문하기`}
            </button>
            <Link to="/" className="mt-3 block text-center text-sm text-ink-mute hover:text-ink">
              쇼핑 계속하기
            </Link>
          </CartSummary>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
