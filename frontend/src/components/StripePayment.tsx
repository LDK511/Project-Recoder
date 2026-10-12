/**
 * 실결제 모드(Stripe)용 결제 폼.
 * STRIPE_PUBLISHABLE_KEY 가 백엔드에 설정되어 있고 모의 결제 모드가 아닐 때 주문 상세 화면에 표시됩니다.
 * 결제 확정은 브라우저가 하지만, 주문을 '결제완료'로 바꾸는 것은 서버의 서명 검증된 웹훅뿐입니다.
 */
import React, { useMemo, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatPrice } from '../utils/formatters';

const cache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(key: string) {
  if (!cache.has(key)) cache.set(key, loadStripe(key));
  return cache.get(key)!;
}

const Inner: React.FC<{ amount: number; returnUrl: string }> = ({ amount, returnUrl }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
    if (err) setError(err.message ?? '결제에 실패했습니다. 결제 수단을 확인해 주세요.');
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="field-error">{error}</p>}
      <button type="submit" className="btn-primary btn-lg w-full" disabled={!stripe || busy}>
        {busy ? '결제 진행 중…' : `${formatPrice(amount)} 결제하기`}
      </button>
    </form>
  );
};

const StripePayment: React.FC<{ publishableKey: string; clientSecret: string; amount: number; returnUrl: string }> = ({
  publishableKey,
  clientSecret,
  amount,
  returnUrl,
}) => {
  const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        locale: 'ko',
        appearance: { theme: 'stripe', variables: { colorPrimary: '#2E5B4F', borderRadius: '6px' } },
      }}
    >
      <Inner amount={amount} returnUrl={returnUrl} />
    </Elements>
  );
};

export default StripePayment;
