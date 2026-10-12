import React from 'react';
import type { Order } from '../types';
import { formatDate } from '../utils/formatters';
import { Icon } from './Icon';

const STEPS = [
  { key: 'paid', label: '결제완료' },
  { key: 'preparing', label: '상품준비중' },
  { key: 'shipping', label: '배송중' },
  { key: 'completed', label: '배송완료' },
] as const;

const INDEX: Record<string, number> = { pending: -1, paid: 0, preparing: 1, shipping: 2, completed: 3 };

/** 주문 진행 단계 표시 (결제완료 → 상품준비중 → 배송중 → 배송완료) */
const OrderProgress: React.FC<{ order: Order }> = ({ order }) => {
  const current = INDEX[order.status];
  if (current === undefined) return null; // 취소/만료/환불은 별도 표시

  const timeOf = (key: string) => {
    if (key === 'paid') return order.paid_at;
    if (key === 'shipping') return order.shipped_at;
    if (key === 'completed') return order.delivered_at;
    return order.history?.find((h) => h.to_status === key)?.created_at ?? null;
  };

  return (
    <ol className="grid grid-cols-4" aria-label="주문 진행 상태">
      {STEPS.map((s, i) => {
        const done = i <= current;
        const active = i === current;
        const t = timeOf(s.key);
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-[15px] h-0.5 w-full -translate-y-1/2 ${i <= current ? 'bg-felt' : 'bg-line'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 grid h-[30px] w-[30px] place-items-center rounded-full text-sm font-bold ${
                done ? 'bg-felt text-white' : 'border-2 border-line bg-white text-ink-mute'
              } ${active ? 'ring-4 ring-felt/15' : ''}`}
            >
              {done && !active ? <Icon name="check" className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`mt-2 text-[13px] sm:text-sm ${active ? 'font-bold text-ink' : done ? 'text-ink-soft' : 'text-ink-mute'}`}>
              {s.label}
            </span>
            {done && t && <span className="num mt-0.5 hidden text-xs text-ink-mute sm:block">{formatDate(t).slice(6)}</span>}
          </li>
        );
      })}
    </ol>
  );
};

export default OrderProgress;
