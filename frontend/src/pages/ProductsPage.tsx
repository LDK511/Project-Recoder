import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Product, PaginatedResponse } from '../types';
import '../styles/products.css';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(12);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchProducts = async (pageNum: number, searchQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        page: pageNum,
        limit,
      };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await apiClient.get<PaginatedResponse<Product>>('/api/products', {
        params,
      });
      setProducts(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || '상품을 불러올 수 없습니다';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(page, search);
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setPage(1);
    setSearch('');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="products-container">
      <div className="products-header">
        <h1>상품</h1>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="상품 검색..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            검색
          </button>
          {search && (
            <button type="button" onClick={handleClearSearch} className="clear-button">
              초기화
            </button>
          )}
        </form>
      </div>

      {search && (
        <div className="search-info">
          검색 결과: "{search}" ({total}개)
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">상품을 불러오는 중...</div>
      ) : products.length === 0 ? (
        <div className="no-products">
          {search ? '검색 결과가 없습니다' : '상품이 없습니다'}
        </div>
      ) : (
        <>
          <div className="products-grid">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="product-card"
              >
                <div className="product-image">
                  <img
                    src={product.image_url || `https://placehold.co/300x200?text=${encodeURIComponent(product.name)}`}
                    alt={product.name}
                  />
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-description">
                    {product.description ? product.description.substring(0, 100) + '...' : '설명 없음'}
                  </p>
                  <div className="product-footer">
                    <span className="product-price">{product.price.toLocaleString()}원</span>
                    <span className={`product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                      {product.stock > 0 ? `재고: ${product.stock}` : '품절'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="pagination-button"
              >
                이전
              </button>
              <div className="pagination-info">
                {page} / {totalPages}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="pagination-button"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProductsPage;
