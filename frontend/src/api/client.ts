import axios, { AxiosError, AxiosInstance } from 'axios';
import { clearAuthStorage, getToken } from '../utils/storage';
import type { ShippingForm } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20_000,
});

apiClient.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.set('Authorization', `Bearer ${token}`);
  return cfg;
});

apiClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    // 토큰 만료 등으로 인증이 풀리면 로그인 화면으로 (로그인 요청 자체의 실패는 제외)
    if (error.response?.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      clearAuthStorage();
      const here = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(here)}&expired=1`;
      }
    }
    return Promise.reject(error);
  }
);

/** 서버 오류 응답에서 사용자에게 보여줄 메시지를 꺼냅니다. */
export function getErrorMessage(err: unknown, fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.error?.message === 'string') return data.error.message;
    if (!err.response) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  }
  return fallback;
}

/** 필드별 검증 오류 { field: message } */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (axios.isAxiosError(err)) {
    const fields = (err.response?.data as any)?.details?.fields;
    if (Array.isArray(fields)) {
      return Object.fromEntries(fields.map((f: any) => [f.field, f.message]));
    }
  }
  return {};
}

export const authAPI = {
  login: (email: string, password: string) => apiClient.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) => apiClient.post('/auth/register', { email, password, name }),
  me: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
}

export const productsAPI = {
  getList: (q: ProductQuery = {}) => apiClient.get('/products', { params: q }),
  getCategories: () => apiClient.get('/products/categories'),
  getDetail: (id: number) => apiClient.get(`/products/${id}`),
  adminList: (q: ProductQuery = {}) => apiClient.get('/admin/products', { params: q }),
  create: (data: FormData) => apiClient.post('/products', data),
  update: (id: number, data: FormData) => apiClient.put(`/products/${id}`, data),
  delete: (id: number) => apiClient.delete(`/products/${id}`),
};

export const cartAPI = {
  getCart: () => apiClient.get('/cart'),
  addItem: (product_id: number, quantity: number) => apiClient.post('/cart/items', { product_id, quantity }),
  updateItem: (id: number, quantity: number) => apiClient.put(`/cart/items/${id}`, { quantity }),
  removeItem: (id: number) => apiClient.delete(`/cart/items/${id}`),
};

export const ordersAPI = {
  checkout: (
    idempotency_key: string,
    cart_items: Array<{ product_id: number; quantity: number }>,
    shipping: ShippingForm
  ) => apiClient.post('/orders/checkout', { idempotency_key, cart_items, shipping }),
  getList: (page = 1, limit = 10) => apiClient.get('/orders', { params: { page, limit } }),
  getDetail: (id: number) => apiClient.get(`/orders/${id}`),
  cancel: (id: number, reason?: string) => apiClient.post(`/orders/${id}/cancel`, { reason }),
  resumePayment: (id: number) => apiClient.post(`/payment/orders/${id}`),
};

export const adminAPI = {
  stats: () => apiClient.get('/admin/stats'),
  orders: (params: { page?: number; limit?: number; status?: string; q?: string }) => apiClient.get('/admin/orders', { params }),
  order: (id: number) => apiClient.get(`/admin/orders/${id}`),
  updateStatus: (id: number, body: { status: string; tracking_carrier?: string; tracking_number?: string; note?: string }) =>
    apiClient.put(`/admin/orders/${id}/status`, body),
};

export const configAPI = {
  get: () => apiClient.get('/config'),
};

export const healthAPI = {
  check: () => apiClient.get('/health'),
};
