import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Product, PaginatedResponse } from '../types';
import '../styles/HomePage.css';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<PaginatedResponse<Product>>('/api/products', {
          params: { page: 1, limit: 6 },
        });
        setProducts(response.data.items);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('상품을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>쇼핑몰에 오신 것을 환영합니다</h1>
          <p>최고의 상품을 최저의 가격으로 만나보세요</p>
          <Link to="/products" className="btn btn-primary btn-lg">
            쇼핑 시작하기
          </Link>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="featured-products">
        <div className="container">
          <h2>인기 상품</h2>
          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <p>상품이 없습니다</p>
              <Link to="/products" className="btn btn-secondary">
                전체 상품 보기
              </Link>
            </div>
          ) : (
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
                    <p className="price">{product.price.toLocaleString()}원</p>
                    <p className="stock">
                      {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">🚚</div>
              <h3>빠른 배송</h3>
              <p>주문 후 빠르게 배송됩니다</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💳</div>
              <h3>안전한 결제</h3>
              <p>안전한 결제 시스템으로 보호됩니다</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔄</div>
              <h3>쉬운 반품</h3>
              <p>30일 이내 무료 반품 가능</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💬</div>
              <h3>고객 지원</h3>
              <p>24/7 고객 지원 서비스</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>지금 바로 시작하세요</h2>
          <p>최고의 상품을 최저의 가격으로 만나보세요</p>
          <div className="cta-buttons">
            <Link to="/products" className="btn btn-primary btn-lg">
              쇼핑하기
            </Link>
            <Link to="/register" className="btn btn-secondary btn-lg">
              회원가입
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
