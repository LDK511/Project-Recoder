const API_URL = import.meta.env.VITE_API_URL || '';

const apiClient = {
  async request(method, endpoint, data = null) {
    const url = `${API_URL}/api${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },
  get(endpoint) {
    return this.request('GET', endpoint);
  },
  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },
  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },
  delete(endpoint) {
    return this.request('DELETE', endpoint);
  },
};

// 상품 API
export async function getProducts() {
  return apiClient.request('GET', '/products');
}

export async function getProduct(id) {
  return apiClient.request('GET', `/products/${id}`);
}

// 장바구니 API
export async function getCart(userId) {
  return apiClient.request('GET', `/cart/${userId}`);
}

export async function addToCart(userId, productId, quantity) {
  return apiClient.request('POST', '/cart', {
    userId,
    productId,
    quantity,
  });
}

export async function updateCartItem(userId, productId, quantity) {
  return apiClient.request('PUT', `/cart/${userId}/${productId}`, {
    quantity,
  });
}

export async function removeFromCart(userId, productId) {
  return apiClient.request('DELETE', `/cart/${userId}/${productId}`);
}

export async function clearCart(userId) {
  return apiClient.request('DELETE', `/cart/${userId}`);
}

// 주문 API
export async function createOrder(userId, items, totalPrice) {
  return apiClient.request('POST', '/orders', {
    userId,
    items,
    totalPrice,
  });
}

export async function getOrder(orderId) {
  return apiClient.request('GET', `/orders/${orderId}`);
}

export async function getUserOrders(userId) {
  return apiClient.request('GET', `/orders/user/${userId}`);
}

// 결제 API
export async function verifyPayment(orderId, impUid, merchantUid) {
  return apiClient.request('POST', '/payment/verify', {
    orderId,
    impUid,
    merchantUid,
  });
}

export async function getPaymentStatus(orderId) {
  return apiClient.request('GET', `/payment/status/${orderId}`);
}

export { apiClient };
export default apiClient;