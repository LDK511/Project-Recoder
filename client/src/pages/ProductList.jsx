import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/ProductList.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE}/products`);
        setProducts(response.data);
        setError(null);
      } catch (err) {
        setError(err.message || '상품을 불러올 수 없습니다.');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <div className="product-list-container"><p>로딩 중...</p></div>;
  }

  if (error) {
    return <div className="product-list-container"><p className="error">오류: {error}</p></div>;
  }

  return (
    <div className="product-list-container">
      <h1>상품 목록</h1>
      {products.length === 0 ? (
        <p>상품이 없습니다.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="product-card"
            >
              <div className="product-image">
                <img src={product.image} alt={product.name} />
              </div>
              <div className="product-info">
                <h2>{product.name}</h2>
                <p className="description">{product.description}</p>
                <p className="price">${product.price.toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
