import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/ProductList.css';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

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

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });

  return (
    <div className="product-list-container">
      <h1>상품 목록</h1>
      
      <div className="filters">
        <input
          type="text"
          placeholder="상품 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="sort-select"
        >
          <option value="name">이름순</option>
          <option value="price-asc">가격 낮은순</option>
          <option value="price-desc">가격 높은순</option>
        </select>
      </div>

      {loading && <p className="loading">상품을 불러오는 중...</p>}
      {error && <p className="error">오류: {error}</p>}

      {!loading && !error && filteredProducts.length === 0 && (
        <p className="no-products">상품이 없습니다.</p>
      )}

      <div className="products-grid">
        {filteredProducts.map(product => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            className="product-card-link"
          >
            <div className="product-card">
              <img
                src={product.image_url || `https://placehold.co/300x200?text=${encodeURIComponent(product.name)}`}
                alt={product.name}
                className="product-image"
              />
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="description">{product.description}</p>
                <div className="product-footer">
                  <span className="price">₩{parseInt(product.price).toLocaleString()}</span>
                  <span className={`stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                    {product.stock > 0 ? `재고: ${product.stock}` : '품절'}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}