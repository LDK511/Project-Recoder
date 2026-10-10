import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CartResponse, CartItem } from '../types';
import '../styles/Cart.css';

export function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchCart();
  }, [user, navigate]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/cart');
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '장바구니를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (productId: number) => {
    try {
      setUpdating(productId);
      setError(null);
      const response = await apiClient.delete(`/api/cart/remove/${productId}`);
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '상품 제거에 실패했습니다');
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateQuantity = async (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      await handleRemoveItem(productId);
      return;
    }

    const item = cart?.items.find((i) => i.product_id === productId);
    if (!item || !item.product) return;

    if (newQuantity > item.product.stock) {
      setError(`재고 부족. 최대 ${item.product.stock}개까지 구매 가능합니다`);
      return;
    }

    try {
      setUpdating(productId);
      setError(null);
      const response = await apiClient.post('/api/cart/add', {
        product_id: productId,
        quantity: newQuantity - item.quantity,
      });
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '수량 업데이트에 실패했습니다');
    } finally {
      setUpdating(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm('장바구니를 비우시겠습니까?')) return;

    try {
      setUpdating(-1);
      setError(null);
      const response = await apiClient.post('/api/cart/clear');
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '장바구니 비우기에 실패했습니다');
    } finally {
      setUpdating(null);
    }
  };

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      setError('장바구니가 비어있습니다');
      return;
    }
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="cart-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <h1>장바구니</h1>

      {error && <div className="error-message">{error}</div>}

      {!cart || cart.items.length === 0 ? (
        <div className="empty-cart">
          <p>장바구니가 비어있습니다</p>
          <button onClick={() => navigate('/products')} className="btn btn-primary">
            상품 보러 가기
          </button>
        </div>
      ) : (
        <>
          <div className="cart-items">
            <div className="cart-header">
              <div className="col-product">상품</div>
              <div className="col-price">가격</div>
              <div className="col-quantity">수량</div>
              <div className="col-total">합계</div>
              <div className="col-action">작업</div>
            </div>

            {cart.items.map((item: CartItem) => {
              const product = item.product;
              if (!product) return null;

              const itemTotal = product.price * item.quantity;

              return (
                <div key={item.id} className="cart-item">
                  <div className="col-product">
                    <img
                      src={product.image_url || `https://placehold.co/80x80?text=${encodeURIComponent(product.name)}`}
                      alt={product.name}
                      className="item-image"
                    />
                    <div className="item-info">
                      <h3
                        className="item-name"
                        onClick={() => navigate(`/products/${product.id}`)}
                        style={{ cursor: 'pointer', color: '#0066cc' }}
                      >
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  <div className="col-price">{product.price.toLocaleString('ko-KR')}원</div>

                  <div className="col-quantity">
                    <input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(product.id, parseInt(e.target.value, 10))}
                      disabled={updating === product.id}
                      className="quantity-input"
                    />
                  </div>

                  <div className="col-total">{itemTotal.toLocaleString('ko-KR')}원</div>

                  <div className="col-action">
                    <button
                      onClick={() => handleRemoveItem(product.id)}
                      disabled={updating === product.id}
                      className="btn btn-danger btn-small"
                    >
                      {updating === product.id ? '처리 중...' : '제거'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span className="summary-label">상품 수:</span>
              <span className="summary-value">{cart.items.length}개</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">총액:</span>
              <span className="summary-value total">{cart.total_amount.toLocaleString('ko-KR')}원</span>
            </div>
          </div>

          <div className="cart-actions">
            <button
              onClick={() => navigate('/products')}
              className="btn btn-secondary"
            >
              계속 쇼핑하기
            </button>
            <button
              onClick={handleClearCart}
              disabled={updating === -1}
              className="btn btn-outline"
            >
              {updating === -1 ? '처리 중...' : '장바구니 비우기'}
            </button>
            <button
              onClick={handleCheckout}
              className="btn btn-primary"
            >
              결제하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CartPage;
