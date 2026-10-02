import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) {
          throw new Error('상품을 찾을 수 없습니다.');
        }
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product && quantity > 0) {
      addToCart(product, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (value > 0 && value <= (product?.stock || 1)) {
      setQuantity(value);
    }
  };

  if (loading) {
    return <div className="product-detail-container"><p>로딩 중...</p></div>;
  }

  if (error) {
    return (
      <div className="product-detail-container">
        <p className="error">{error}</p>
        <button onClick={() => navigate('/')}>상품 목록으로 돌아가기</button>
      </div>
    );
  }

  if (!product) {
    return <div className="product-detail-container"><p>상품 정보를 불러올 수 없습니다.</p></div>;
  }

  return (
    <div className="product-detail-container">
      <button className="back-btn" onClick={() => navigate('/')}>← 돌아가기</button>

      <div className="product-detail-content">
        <div className="product-image-section">
          <img
            src={product.image || 'https://via.placeholder.com/400'}
            alt={product.name}
            className="product-image"
          />
        </div>

        <div className="product-info-section">
          <h1 className="product-name">{product.name}</h1>
          <p className="product-description">{product.description}</p>

          <div className="product-price-section">
            <span className="product-price">{product.price.toLocaleString()}원</span>
            <span className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
            </span>
          </div>

          {product.stock > 0 && (
            <div className="purchase-section">
              <div className="quantity-selector">
                <label htmlFor="quantity">수량:</label>
                <select
                  id="quantity"
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="quantity-input"
                >
                  {Array.from({ length: product.stock }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="add-to-cart-btn"
                onClick={handleAddToCart}
              >
                장바구니에 추가
              </button>

              {addedToCart && (
                <p className="success-message">장바구니에 추가되었습니다!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}