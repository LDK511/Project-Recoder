import React from 'react';
import { useStoreConfig, shippingFeeFor } from '../context/ConfigContext';
import { formatPrice } from '../utils/formatters';

interface CartSummaryProps {
  subtotal_cents: number;
  /** 정가 기준 합계(할인 금액 표시용) */
  compare_total_cents?: number;
  /** 서버가 계산한 배송비가 있으면 그 값을 표시 */
  shipping_fee_cents?: number;
  children?: React.ReactNode;
  showFreeShippingBar?: boolean;
}

/** 주문 금액 요약 — 상품금액, 할인, 배송비, 결제 예정 금액을 투명하게 보여줍니다. */
const CartSummary: React.FC<CartSummaryProps> = ({
  subtotal_cents,
  compare_total_cents,
  shipping_fee_cents,
  children,
  showFreeShippingBar = true,
}) => {
  const cfg = useStoreConfig();
  const fee = shipping_fee_cents ?? shippingFeeFor(subtotal_cents, cfg);
  const threshold = cfg.shipping.free_threshold_cents;
  const remain = Math.max(0, threshold - subtotal_cents);
  const discount = compare_total_cents && compare_total_cents > subtotal_cents ? compare_total_cents - subtotal_cents : 0;
  const progress = threshold > 0 ? Math.min(100, (subtotal_cents / threshold) * 100) : 100;

  return (
    <div className="panel p-5">
      <h2 className="text-lg font-bold">결제 예정 금액</h2>
      <dl className="num mt-4 space-y-2.5 text-[15px]">
        <div className="flex justify-between">
          <dt className="text-ink-soft">상품 금액</dt>
          <dd>{formatPrice(subtotal_cents + discount)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-soft">할인 금액</dt>
            <dd className="text-sale">-{formatPrice(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">배송비</dt>
          <dd>{subtotal_cents === 0 ? '-' : fee === 0 ? '무료' : `+${formatPrice(fee)}`}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-semibold">총 결제 금액</dt>
          <dd className="text-2xl font-extrabold tracking-tight">{formatPrice(subtotal_cents + fee)}</dd>
        </div>
      </dl>

      {showFreeShippingBar && threshold > 0 && subtotal_cents > 0 && (
        <div className="mt-4 rounded-md bg-well px-3.5 py-3 text-sm">
          <p className="text-ink-soft">
            {remain > 0 ? (
              <>
                <strong className="num text-ink">{formatPrice(remain)}</strong> 더 담으면 무료배송
              </>
            ) : (
              <strong className="text-felt">무료배송 조건을 채웠어요</strong>
            )}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-felt transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
};

export default CartSummary;
