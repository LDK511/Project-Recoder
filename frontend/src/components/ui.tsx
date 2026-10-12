/** 작은 공용 UI 조각들 */
import React, { useEffect } from 'react';
import { discountRate, formatPrice } from '../utils/formatters';
import { Icon } from './Icon';

export const Price: React.FC<{ price: number; compareAt?: number | null; size?: 'sm' | 'md' | 'lg' }> = ({
  price,
  compareAt,
  size = 'md',
}) => {
  const rate = discountRate(price, compareAt);
  const main = { sm: 'text-[15px]', md: 'text-[17px]', lg: 'text-[28px]' }[size];
  return (
    <div className="num">
      {rate > 0 && size === 'lg' && <p className="text-[15px] text-ink-mute line-through">{formatPrice(compareAt!)}</p>}
      <p className={`${main} font-bold tracking-tight`}>
        {rate > 0 && <span className="mr-1.5 text-sale">{rate}%</span>}
        {formatPrice(price)}
      </p>
      {rate > 0 && size !== 'lg' && <p className="text-[13px] text-ink-mute line-through">{formatPrice(compareAt!)}</p>}
    </div>
  );
};

export const ProductImage: React.FC<{ src: string | null; alt: string; className?: string; rounded?: string }> = ({
  src,
  alt,
  className = '',
  rounded = 'rounded-md',
}) => {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className={`relative overflow-hidden bg-well ${rounded} ${className}`}>
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-ink-mute/60">
          <Icon name="image" className="h-1/3 w-1/3 max-h-10 max-w-10" />
        </div>
      )}
    </div>
  );
};

export const QuantityStepper: React.FC<{
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}> = ({ value, min = 1, max, onChange, disabled, size = 'md', label = '수량' }) => {
  const h = size === 'sm' ? 'h-9' : 'h-11';
  const w = size === 'sm' ? 'w-9' : 'w-11';
  return (
    <div className={`inline-flex ${h} items-stretch overflow-hidden rounded-md border border-line bg-white`} role="group" aria-label={label}>
      <button
        type="button"
        className={`${w} grid place-items-center text-ink-soft hover:bg-well disabled:text-ink-mute/40 disabled:hover:bg-white`}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="수량 줄이기"
      >
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="num w-12 border-x border-line text-center text-[15px] font-semibold focus:outline-none"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(Math.max(n, min), max));
        }}
      />
      <button
        type="button"
        className={`${w} grid place-items-center text-ink-soft hover:bg-well disabled:text-ink-mute/40 disabled:hover:bg-white`}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="수량 늘리기"
      >
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode; icon?: string }> = ({
  title,
  description,
  action,
  icon = 'box',
}) => (
  <div className="flex flex-col items-center px-6 py-16 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-well text-ink-mute">
      <Icon name={icon} className="h-7 w-7" />
    </div>
    <p className="text-lg font-semibold">{title}</p>
    {description && <p className="mt-1 max-w-sm text-ink-mute">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({
  open,
  onClose,
  title,
  children,
  wide,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white sm:rounded-xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 p-2" aria-label="닫기">
            <Icon name="x" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Field: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, label, required, optional, error, hint, children, className }) => (
  <div className={className}>
    <label htmlFor={id} className="field-label">
      {label}
      {required && (
        <span className="req" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span className="opt">(선택)</span>}
    </label>
    {children}
    {error ? (
      <p className="field-error" id={`${id}-error`} role="alert">
        {error}
      </p>
    ) : (
      hint && <p className="field-hint">{hint}</p>
    )}
  </div>
);
