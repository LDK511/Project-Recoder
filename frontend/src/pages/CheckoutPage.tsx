import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage, getFieldErrors, ordersAPI, productsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCartContext } from '../context/CartContext';
import { shippingFeeFor, useStoreConfig } from '../context/ConfigContext';
import type { CheckoutResponse, Product, ShippingForm } from '../types';
import { formatPhoneInput, formatPrice, uuidv4 } from '../utils/formatters';
import { getLastShipping, saveLastShipping } from '../utils/storage';
import CartSummary from '../components/CartSummary';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import PostcodeButton from '../components/PostcodeButton';
import { EmptyState, Field, ProductImage } from '../components/ui';

interface Line {
  product_id: number;
  name: string;
  image_url: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  quantity: number;
}

const MEMO_PRESETS = ['문 앞에 놓아 주세요', '경비실에 맡겨 주세요', '배송 전에 연락 주세요', '택배함에 넣어 주세요'];

const EMPTY: ShippingForm = { recipient_name: '', recipient_phone: '', postal_code: '', address1: '', address2: '', delivery_memo: '' };

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const cart = useCartContext();
  const cfg = useStoreConfig();

  const direct = (location.state as any)?.direct as { product_id: number; quantity: number }[] | undefined;
  const selectedIds = useMemo(
    () =>
      (params.get('items') ?? '')
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => n > 0),
    [params]
  );

  const [lines, setLines] = useState<Line[] | null>(null);
  const [form, setForm] = useState<ShippingForm>(() => {
    const last = getLastShipping<ShippingForm>();
    return last ? { ...EMPTY, ...last } : { ...EMPTY, recipient_name: user?.name ?? '' };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postcodeFallback, setPostcodeFallback] = useState(false);
  // 같은 주문서에서 버튼을 여러 번 눌러도 주문이 한 건만 생기도록 화면 단위로 키를 고정합니다.
  const idempotencyKey = useRef(uuidv4());
  const address2Ref = useRef<HTMLInputElement>(null);

  // 주문 상품 구성: 바로구매 → 해당 상품, 장바구니 → 선택한 항목(없으면 구매 가능한 전체)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (direct?.length) {
          const products = await Promise.all(direct.map((d) => productsAPI.getDetail(d.product_id).then((r) => r.data as Product)));
          if (!alive) return;
          setLines(
            products.map((p, i) => ({
              product_id: p.id,
              name: p.name,
              image_url: p.image_url,
              price_cents: p.price_cents,
              compare_at_price_cents: p.compare_at_price_cents,
              quantity: direct[i].quantity,
            }))
          );
          return;
        }
        await cart.refresh();
      } catch (e) {
        if (alive) setError(getErrorMessage(e, '주문 상품을 불러오지 못했습니다.'));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (direct?.length) return;
    const ok = cart.items.filter((i) => i.is_active && i.stock >= i.quantity && i.stock > 0);
    const chosen = selectedIds.length ? ok.filter((i) => selectedIds.includes(i.id)) : ok;
    if (!cart.isLoading) {
      setLines(
        chosen.map((i) => ({
          product_id: i.product_id,
          name: i.product_name,
          image_url: i.image_url,
          price_cents: i.price_cents,
          compare_at_price_cents: i.compare_at_price_cents,
          quantity: i.quantity,
        }))
      );
    }
  }, [cart.items, cart.isLoading, direct, selectedIds]);

  const subtotal = (lines ?? []).reduce((s, l) => s + l.price_cents * l.quantity, 0);
  const compareTotal = (lines ?? []).reduce((s, l) => s + (l.compare_at_price_cents ?? l.price_cents) * l.quantity, 0);

  const set = (k: keyof ShippingForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.recipient_name.trim()) e.recipient_name = '받는 분 이름을 입력해 주세요.';
    if (!/^0\d{8,10}$/.test(form.recipient_phone.replace(/\D/g, ''))) e.recipient_phone = '휴대폰 번호를 정확히 입력해 주세요. 예) 010-1234-5678';
    if (!/^\d{5}$/.test(form.postal_code.trim())) e.postal_code = '우편번호 5자리를 입력해 주세요.';
    if (form.address1.trim().length < 2) e.address1 = '주소를 입력해 주세요.';
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`ship-${first}`)?.focus();
    return !first;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!lines?.length) return;
    if (!validate()) return;
    if (!agree) {
      setError('주문 내용 확인 및 결제 진행에 동의해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await ordersAPI.checkout(
        idempotencyKey.current,
        lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        form
      );
      const data = r.data as CheckoutResponse;
      if (remember) saveLastShipping({ ...form });
      if (data.payment_url) {
        window.location.assign(data.payment_url); // 결제창(모의 결제/PG)으로 이동
      } else {
        navigate(`/orders/${data.order_id}?from=checkout`, { replace: true });
      }
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      setError(getErrorMessage(err, '주문을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      setSubmitting(false);
      // 재고 부족 등으로 실패하면 다음 시도는 새 주문으로
      idempotencyKey.current = uuidv4();
    }
  };

  if (lines === null) return <LoadingSpinner message="주문서를 준비하는 중" />;
  if (lines.length === 0) {
    return (
      <div className="shell pt-8">
        <EmptyState
          icon="bag"
          title="주문할 상품이 없어요"
          description="장바구니에서 상품을 선택한 뒤 다시 주문해 주세요."
          action={
            <Link to="/cart" className="btn-primary">
              장바구니로 가기
            </Link>
          }
        />
      </div>
    );
  }

  const inputCls = (k: string) => `input ${errors[k] ? 'input-error' : ''}`;

  return (
    <div className="shell pt-8">
      <h1 className="page-title">주문/결제</h1>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <section className="panel p-5 sm:p-6" aria-labelledby="ship-title">
            <div className="flex items-baseline justify-between">
              <h2 id="ship-title" className="text-lg font-bold">
                배송지
              </h2>
              <p className="text-[13px] text-ink-mute">
                <span className="text-sale">*</span> 필수 입력
              </p>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field id="ship-recipient_name" label="받는 분" required error={errors.recipient_name}>
                <input
                  id="ship-recipient_name"
                  className={inputCls('recipient_name')}
                  value={form.recipient_name}
                  onChange={(e) => set('recipient_name', e.target.value)}
                  autoComplete="shipping name"
                  maxLength={50}
                />
              </Field>
              <Field
                id="ship-recipient_phone"
                label="휴대폰 번호"
                required
                error={errors.recipient_phone}
                hint="배송 기사님이 도착 전 연락할 때만 사용해요."
              >
                <input
                  id="ship-recipient_phone"
                  className={inputCls('recipient_phone')}
                  value={form.recipient_phone}
                  onChange={(e) => set('recipient_phone', formatPhoneInput(e.target.value))}
                  inputMode="tel"
                  autoComplete="shipping tel"
                  placeholder="010-0000-0000"
                />
              </Field>
              <Field id="ship-postal_code" label="주소" required error={errors.postal_code || errors.address1} className="sm:col-span-2">
                <div className="flex gap-2">
                  <input
                    id="ship-postal_code"
                    className={`${inputCls('postal_code')} max-w-[9rem]`}
                    value={form.postal_code}
                    onChange={(e) => set('postal_code', e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="우편번호"
                    inputMode="numeric"
                    autoComplete="shipping postal-code"
                  />
                  <PostcodeButton
                    onComplete={(r) => {
                      setForm((f) => ({ ...f, postal_code: r.postal_code, address1: r.address1 }));
                      setErrors((e) => ({ ...e, postal_code: '', address1: '' }));
                      setTimeout(() => address2Ref.current?.focus(), 50);
                    }}
                    onUnavailable={() => setPostcodeFallback(true)}
                  />
                </div>
                <input
                  id="ship-address1"
                  className={`${inputCls('address1')} mt-2`}
                  value={form.address1}
                  onChange={(e) => set('address1', e.target.value)}
                  placeholder="도로명 주소"
                  autoComplete="shipping address-line1"
                />
                <input
                  ref={address2Ref}
                  id="ship-address2"
                  className="input mt-2"
                  value={form.address2}
                  onChange={(e) => set('address2', e.target.value)}
                  placeholder="상세 주소 (동·호수 등, 선택)"
                  autoComplete="shipping address-line2"
                  maxLength={255}
                />
                {postcodeFallback && (
                  <p className="field-hint">주소 검색을 불러오지 못했어요. 우편번호와 주소를 직접 입력해 주세요.</p>
                )}
              </Field>
              <Field id="ship-delivery_memo" label="배송 메모" optional className="sm:col-span-2">
                <input
                  id="ship-delivery_memo"
                  className="input"
                  list="memo-presets"
                  value={form.delivery_memo}
                  onChange={(e) => set('delivery_memo', e.target.value)}
                  placeholder="배송 기사님께 전할 말 (선택)"
                  maxLength={200}
                />
                <datalist id="memo-presets">
                  {MEMO_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
            </div>
            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="h-4 w-4 accent-felt" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              다음 주문 때 이 배송지 사용 (이 브라우저에만 저장)
            </label>
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="items-title">
            <h2 id="items-title" className="text-lg font-bold">
              주문 상품 <span className="num font-normal text-ink-mute">{lines.length}개</span>
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {lines.map((l) => (
                <li key={l.product_id} className="flex items-center gap-4 py-3.5">
                  <ProductImage src={l.image_url} alt={l.name} className="h-16 w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[15px]">{l.name}</p>
                    <p className="num text-sm text-ink-mute">
                      {formatPrice(l.price_cents)} · {l.quantity}개
                    </p>
                  </div>
                  <p className="num shrink-0 font-bold">{formatPrice(l.price_cents * l.quantity)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="pay-title">
            <h2 id="pay-title" className="text-lg font-bold">
              결제 수단
            </h2>
            {cfg.test_payment_mode ? (
              <ErrorAlert
                tone="warning"
                className="mt-4"
                message="테스트 결제 모드입니다. 실제 카드 결제는 일어나지 않으며, 다음 화면에서 결제 완료가 모의로 처리됩니다."
              />
            ) : (
              <p className="mt-3 text-[15px] text-ink-soft">
                신용·체크카드 등 결제 수단은 다음 단계의 보안 결제창에서 선택합니다. 카드 정보는 결제대행사(PG)에서 처리되며 쇼핑몰에 저장되지 않습니다.
              </p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <CartSummary subtotal_cents={subtotal} compare_total_cents={compareTotal}>
            {error && <ErrorAlert message={error} className="mb-4" />}
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-md bg-well p-3.5 text-sm leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-felt"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
              />
              <span>
                <span className="font-semibold">[필수]</span> 주문 상품, 결제 금액, 배송 정보를 확인했으며 결제 진행에 동의합니다. (
                <Link to="/policy/privacy" target="_blank" className="underline underline-offset-2">
                  개인정보 수집·이용
                </Link>
                ,{' '}
                <Link to="/policy/shipping" target="_blank" className="underline underline-offset-2">
                  교환·반품 안내
                </Link>
                )
              </span>
            </label>
            <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting}>
              {submitting ? '결제창으로 이동 중…' : `${formatPrice(subtotal + shippingFeeFor(subtotal, cfg))} 결제하기`}
            </button>
            <p className="mt-3 text-center text-[13px] text-ink-mute">
              {cfg.order_payment_timeout_minutes}분 안에 결제하지 않으면 주문이 자동 취소돼요.
            </p>
          </CartSummary>
        </aside>
      </form>
    </div>
  );
};

export default CheckoutPage;
