import { useCallback, useState } from 'react';
import { getErrorMessage, productsAPI, ProductQuery } from '../api/client';
import type { PaginationMeta, Product } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 12, total: 0, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (q: ProductQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await productsAPI.getList(q);
      setProducts(r.data.data);
      setPagination(r.data.pagination);
    } catch (err) {
      setError(getErrorMessage(err, '상품을 불러오지 못했습니다.'));
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { products, pagination, isLoading, error, fetchProducts };
}
