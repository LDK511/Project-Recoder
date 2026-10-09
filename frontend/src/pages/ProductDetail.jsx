import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CartContext } from '../contexts/CartContext';
import { AuthContext } from '../contexts/AuthContext';
import '../styles/ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error('상품 조회 실패');
      const data = await response.json();
      setProduct(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (quantity < 1 || quantity > product.stock) {
      alert('유효한 수량을 입력하세요.');
      return;
    }

    try {
      setAddingToCart(true);
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: parseInt(quantity),
        }),
      });

      if (!response.ok) throw new Error('장바구니 추가 실패');
      
      addToCart({ ...product, quantity: parseInt(quantity) });
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
      setQuantity(1);
    } catch (err) {
      alert(`오류: ${err.message}`);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 0 && value <= product.stock) {
      setQuantity(value);
    }
  };

  if (loading) return <p className="loading">상품을 불러오는 중...</p>;
  if (error) return <p className="error">오류: {error}</p>;
  if (!product) return <p className="error">상품을 찾을 수 없습니다.</p>;

  return (
    <div className="product-detail-container">
      <button className="back-button" onClick={() => navigate(-1)}>← 뒤로가기</button>
      
      <div className="product-detail">
        <div className="product-image-section">
          <img
            src={product.image_url || `https://placehold.co/500x400?text=${encodeURIComponent(product.name)}`}
            alt={product.name}
            className="product-image"
          />
        </div>

        <div className="product-info-section">
          <h1>{product.name}</h1>
          
          <div className="product-meta">
            <span className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
            </span>
          </div>

          <p className="description">{product.description}</p>

          <div className="price-section">
            <span className="price">₩{parseInt(product.price).toLocaleString()}</span>
          </div>

          <div className="purchase-section">
            <div className="quantity-selector">
              <label htmlFor="quantity">수량:</label>
              <select
                id="quantity"
                value={quantity}
                onChange={handleQuantityChange}
                disabled={product.stock === 0}
              >
                {Array.from({ length: Math.min(product.stock, 10) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="add-to-cart-button"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || addingToCart}
            >
              {addingToCart ? '추가 중...' : '장바구니 추가'}
            </button>
          </div>

          {addSuccess && (
            <p className="success-message">✓ 장바구니에 추가되었습니다!</p>
          )}

          {!user && (
            <p className="login-prompt">
              <button onClick={() => navigate('/login')} className="link-button">
                로그인
              </button>
              하여 구매하세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}