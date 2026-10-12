import { useCallback, useState } from 'react';
import { getErrorMessage, ordersAPI } from '../api/client';
import type { Order, PaginationMeta } from '../types';

export function useOrders(limit = 10) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit, total: 0, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const r = await ordersAPI.getList(page, limit);
        setOrders(r.data.data);
        setPagination(r.data.pagination);
      } catch (err) {
        setError(getErrorMessage(err, '주문 내역을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  return { orders, pagination, isLoading, error, fetchOrders };
}
