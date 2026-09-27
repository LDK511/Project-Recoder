import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../context/CartContext';
import '../styles/ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:3001/api/products/${id}`);
        setProduct(response.data);
        setError(null);
      } catch (err) {
        setError('상품을 불러올 수 없습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product.id, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (value > 0) {
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
        <button onClick={() => navigate('/')}>상품 목록으로</button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-container">
        <p>상품을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>상품 목록으로</button>
      </div>
    );
  }

  return (
    <div className="product-detail-container">
      <button className="back-button" onClick={() => navigate('/')}>← 뒤로가기</button>
      <div className="product-detail">
        <div className="product-image">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="price">₩{product.price.toLocaleString()}</p>
          <p className="description">{product.description}</p>
          <div className="quantity-selector">
            <label htmlFor="quantity">수량:</label>
            <select id="quantity" value={quantity} onChange={handleQuantityChange}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
          <button className="add-to-cart-btn" onClick={handleAddToCart}>
            장바구니에 추가
          </button>
          {addedToCart && <p className="success-message">✓ 장바구니에 추가되었습니다!</p>}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;