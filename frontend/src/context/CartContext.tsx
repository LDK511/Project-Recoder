import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartAPI } from '../api/client';
import type { CartItemWithProduct } from '../types';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItemWithProduct[];
  total_cents: number;
  count: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItemWithProduct[]>(() => {
    //: ReCoder: 장바구니를 브라우저에 보관해 새로고침·주소 이동 뒤에도 그대로 둔다.
    try {
      const saved = localStorage.getItem('recoder_cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return (Array.isArray(parsed) ? parsed : []) as CartItemWithProduct[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('recoder_cart', JSON.stringify(items));
    } catch {
      /* 저장소를 못 써도 장바구니는 동작 */
    }
  }, [items]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setTotal(0);
      return;
    }
    setIsLoading(true);
    try {
      const r = await cartAPI.getCart();
      setItems(r.data.items ?? []);
      setTotal(r.data.total_cents ?? 0);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const addItem = useCallback(
    async (productId: number, quantity: number) => {
      await cartAPI.addItem(productId, quantity);
      await refresh();
    },
    [refresh]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      // 즉시 반영 후 서버 결과로 다시 맞춤
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
      try {
        await cartAPI.updateItem(itemId, quantity);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      try {
        await cartAPI.removeItem(itemId);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      items,
      total_cents: total,
      count: items.length,
      isLoading,
      refresh,
      addItem,
      updateItem,
      removeItem,
    }),
    [items, total, isLoading, refresh, addItem, updateItem, removeItem]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCartContext(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within CartProvider');
  return ctx;
}
