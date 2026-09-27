import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);

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
    try {
      const userId = localStorage.getItem('userId') || 'guest';
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          productId: product._id,
          quantity,
        }),
      });
      if (!response.ok) throw new Error('장바구니 추가 실패');
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      alert('장바구니 추가 중 오류: ' + err.message);
    }
  };

  const handleQuantityChange = (e) => {
    const value = Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1));
    setQuantity(value);
  };

  if (loading) return <div className="container"><p>로딩 중...</p></div>;
  if (error) return <div className="container"><p className="error">오류: {error}</p></div>;
  if (!product) return <div className="container"><p>상품을 찾을 수 없습니다.</p></div>;

  return (
    <div className="container">
      <button className="back-button" onClick={() => navigate('/')}>← 목록으로</button>
      <div className="product-detail">
        <div className="product-image-section">
          <img src={product.image || '/placeholder.png'} alt={product.name} />
        </div>
        <div className="product-info-section">
          <h1>{product.name}</h1>
          <p className="description">{product.description}</p>
          <p className="price">{product.price.toLocaleString()}원</p>
          <p className="stock">재고: {product.stock}개</p>
          
          <div className="purchase-section">
            <div className="quantity-selector">
              <label htmlFor="quantity">수량:</label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={handleQuantityChange}
              />
            </div>
            
            <button
              className="add-to-cart-button"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {product.stock === 0 ? '품절' : '장바구니 추가'}
            </button>
            
            {addedToCart && <p className="success-message">장바구니에 추가되었습니다!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}