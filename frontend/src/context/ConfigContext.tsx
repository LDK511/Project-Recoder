import React, { createContext, useContext, useEffect, useState } from 'react';
import { configAPI } from '../api/client';
import type { StoreConfig } from '../types';

/** 서버 설정을 받기 전/실패 시 사용할 기본값 */
const FALLBACK: StoreConfig = {
  store: {
    name: '데일리데스크',
    companyName: '(주)데일리데스크',
    ceo: '-',
    businessNumber: '-',
    mailOrderNumber: '-',
    address: '-',
    phone: '-',
    email: '-',
    privacyOfficer: '-',
    hostingProvider: '-',
    csHours: '-',
  },
  shipping: { fee_cents: 3000, free_threshold_cents: 50000 },
  order_payment_timeout_minutes: 30,
  test_payment_mode: false,
  stripe_publishable_key: null,
};

const ConfigContext = createContext<StoreConfig>(FALLBACK);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<StoreConfig>(FALLBACK);
  useEffect(() => {
    configAPI
      .get()
      .then((r) => setConfig(r.data))
      .catch(() => undefined);
  }, []);
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
};

export const useStoreConfig = () => useContext(ConfigContext);

export function shippingFeeFor(subtotal: number, cfg: StoreConfig): number {
  if (subtotal <= 0) return 0;
  const { fee_cents, free_threshold_cents } = cfg.shipping;
  if (free_threshold_cents > 0 && subtotal >= free_threshold_cents) return 0;
  return fee_cents;
}
