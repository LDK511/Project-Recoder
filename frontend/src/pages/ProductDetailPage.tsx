import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Product } from '../types';
import '../styles/ProductDetail.css';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/products/${id}`);
        setProduct(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || '상품을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value > 0) {
      setQuantity(value);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!product) return;

    if (quantity > product.stock) {
      setError(`재고 부족. 최대 ${product.stock}개까지 구매 가능합니다`);
      return;
    }

    try {
      setAdding(true);
      setError(null);
      await apiClient.post('/api/cart/add', {
        product_id: product.id,
        quantity,
      });
      setSuccessMessage('장바구니에 추가되었습니다');
      setQuantity(1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '장바구니 추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!product) return;

    if (quantity > product.stock) {
      setError(`재고 부족. 최대 ${product.stock}개까지 구매 가능합니다`);
      return;
    }

    try {
      setAdding(true);
      setError(null);
      await apiClient.post('/api/cart/add', {
        product_id: product.id,
        quantity,
      });
      navigate('/checkout');
    } catch (err: any) {
      setError(err.response?.data?.error || '장바구니 추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="product-detail-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/products')} className="btn btn-primary">
          상품 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-container">
        <div className="error-message">상품을 찾을 수 없습니다</div>
        <button onClick={() => navigate('/products')} className="btn btn-primary">
          상품 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="product-detail-container">
      <button onClick={() => navigate('/products')} className="back-button">
        ← 돌아가기
      </button>

      <div className="product-detail-content">
        <div className="product-image-section">
          <img
            src={product.image_url || `https://placehold.co/400x400?text=${encodeURIComponent(product.name)}`}
            alt={product.name}
            className="product-detail-image"
          />
        </div>

        <div className="product-info-section">
          <h1 className="product-title">{product.name}</h1>

          <div className="product-price">
            <span className="price-label">가격:</span>
            <span className="price-value">{product.price.toLocaleString('ko-KR')}원</span>
          </div>

          <div className="product-stock">
            <span className="stock-label">재고:</span>
            <span className={`stock-value ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0 ? `${product.stock}개 남음` : '품절'}
            </span>
          </div>

          {product.description && (
            <div className="product-description">
              <h3>상품 설명</h3>
              <p>{product.description}</p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <div className="product-actions">
            <div className="quantity-selector">
              <label htmlFor="quantity">수량:</label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={handleQuantityChange}
                disabled={product.stock === 0}
                className="quantity-input"
              />
            </div>

            <div className="action-buttons">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || adding}
                className="btn btn-secondary"
              >
                {adding ? '추가 중...' : '장바구니 추가'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0 || adding}
                className="btn btn-primary"
              >
                {adding ? '진행 중...' : '지금 구매'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
