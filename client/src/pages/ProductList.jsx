import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/ProductList.css';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('상품 조회 실패');
      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container"><p>로딩 중...</p></div>;
  if (error) return <div className="container"><p className="error">오류: {error}</p></div>;

  return (
    <div className="container">
      <h1>상품 목록</h1>
      {products.length === 0 ? (
        <p>상품이 없습니다.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <Link key={product._id} to={`/product/${product._id}`} className="product-card">
              <div className="product-image">
                <img src={product.image || '/placeholder.png'} alt={product.name} />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="description">{product.description}</p>
                <p className="price">{product.price.toLocaleString()}원</p>
                <p className="stock">재고: {product.stock}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}