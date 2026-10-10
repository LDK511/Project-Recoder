import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Axios HTTP 클라이언트 — 인증 토큰 자동 처리
 */

const API_BASE_URL = '/api';
const HEALTH_URL = '/health';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 요청 인터셉터 — Authorization 헤더에 토큰 추가
 */
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 응답 인터셉터 — 401 에러 시 로그아웃 처리
 */
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/**
 * 헬스 체크 — 서버 상태 및 결제 모드 확인
 */
export async function checkHealth(): Promise<{ status: string; test_payment_mode: boolean }> {
  try {
    const response = await axios.get(HEALTH_URL);
    return response.data;
  } catch (error) {
    console.error('[health] check failed', error);
    return { status: 'error', test_payment_mode: false };
  }
}

/**
 * 회원가입
 */
export async function register(data: {
  email: string;
  password: string;
  name: string;
}): Promise<{ id: number; email: string; name: string; token: string }> {
  const response = await client.post('/auth/register', data);
  return response.data;
}

/**
 * 로그인
 */
export async function login(data: {
  email: string;
  password: string;
}): Promise<{ id: number; email: string; name: string; role: string; token: string }> {
  const response = await client.post('/auth/login', data);
  return response.data;
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<{
  id: number;
  email: string;
  name: string;
  role: string;
}> {
  const response = await client.get('/auth/me');
  return response.data;
}

/**
 * 상품 목록 조회
 */
export async function getProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const response = await client.get('/products', { params });
  return response.data;
}

/**
 * 상품 상세 조회
 */
export async function getProduct(id: number): Promise<any> {
  const response = await client.get(`/products/${id}`);
  return response.data;
}

/**
 * 상품 생성 (관리자)
 */
export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
}): Promise<any> {
  const response = await client.post('/products', data);
  return response.data;
}

/**
 * 상품 수정 (관리자)
 */
export async function updateProduct(
  id: number,
  data: {
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
    image_url?: string;
  },
): Promise<any> {
  const response = await client.put(`/products/${id}`, data);
  return response.data;
}

/**
 * 장바구니 조회
 */
export async function getCart(): Promise<{
  items: any[];
  total_amount: number;
}> {
  const response = await client.get('/cart');
  return response.data;
}

/**
 * 장바구니에 상품 추가
 */
export async function addToCart(data: {
  product_id: number;
  quantity: number;
}): Promise<{
  items: any[];
  total_amount: number;
}> {
  const response = await client.post('/cart/add', data);
  return response.data;
}

/**
 * 장바구니에서 상품 제거
 */
export async function removeFromCart(productId: number): Promise<{
  items: any[];
  total_amount: number;
}> {
  const response = await client.delete(`/cart/remove/${productId}`);
  return response.data;
}

/**
 * 장바구니 비우기
 */
export async function clearCart(): Promise<{
  items: any[];
  total_amount: number;
}> {
  const response = await client.post('/cart/clear');
  return response.data;
}

/**
 * 주문 생성
 */
export async function createOrder(data: {
  idempotency_key: string;
}): Promise<{
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
  items: any[];
  created_at: string;
}> {
  const response = await client.post('/orders', data);
  return response.data;
}

/**
 * 주문 목록 조회
 */
export async function getOrders(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const response = await client.get('/orders', { params });
  return response.data;
}

/**
 * 주문 상세 조회
 */
export async function getOrder(id: number): Promise<any> {
  const response = await client.get(`/orders/${id}`);
  return response.data;
}

/**
 * 주문 취소
 */
export async function cancelOrder(id: number): Promise<any> {
  const response = await client.post(`/orders/${id}/cancel`);
  return response.data;
}

/**
 * 결제 의도 생성 (결제 시작)
 */
export async function initiatePayment(data: {
  order_id: number;
}): Promise<{
  payment_id: string;
  order_id: number;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string | null;
  test_mode: boolean;
}> {
  const response = await client.post('/payment/checkout', data);
  return response.data;
}

/**
 * 관리자 주문 목록 조회
 */
export async function getAdminOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const response = await client.get('/admin/orders', { params });
  return response.data;
}

export default client;
