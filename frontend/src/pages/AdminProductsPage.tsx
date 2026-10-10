import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Product, PaginatedResponse } from '../types';
import '../styles/AdminProductsPage.css';

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image_url: '',
  });

  // 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // 상품 목록 조회
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<PaginatedResponse<Product>>(
        `/api/products?page=${page}&limit=${limit}`,
      );
      setProducts(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || '상품 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      price: '',
      stock: '',
      image_url: '',
    });
    setEditingId(null);
    setShowForm(false);
  }, []);

  // 상품 편집 시작
  const handleEdit = useCallback((product: Product) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      image_url: product.image_url || '',
    });
    setEditingId(product.id);
    setShowForm(true);
  }, []);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // 입력 검증
      if (!formData.name.trim()) {
        setError('상품명을 입력하세요');
        return;
      }
      if (!formData.price || Number(formData.price) <= 0) {
        setError('유효한 가격을 입력하세요');
        return;
      }
      if (!formData.stock || Number(formData.stock) < 0) {
        setError('유효한 재고를 입력하세요');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Math.round(Number(formData.price)),
        stock: Math.round(Number(formData.stock)),
        image_url: formData.image_url.trim(),
      };

      if (editingId) {
        // 상품 수정
        await apiClient.put(`/api/products/${editingId}`, payload);
      } else {
        // 상품 생성
        await apiClient.post('/api/products', payload);
      }

      resetForm();
      await fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || '작업 중 오류가 발생했습니다');
    }
  };

  // 상품 삭제
  const handleDelete = async (productId: number) => {
    if (!window.confirm('이 상품을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError(null);
      await apiClient.delete(`/api/products/${productId}`);
      await fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || '상품 삭제 중 오류가 발생했습니다');
    }
  };

  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (authLoading) {
    return <div className="admin-products-page"><p>로딩 중...</p></div>;
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="admin-products-page">
      <div className="admin-products-container">
        <div className="admin-products-header">
          <h1>상품 관리</h1>
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            새 상품 추가
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showForm && (
          <div className="product-form-container">
            <div className="product-form">
              <h2>{editingId ? '상품 수정' : '새 상품 추가'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">상품명 *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="상품명을 입력하세요"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">설명</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="상품 설명을 입력하세요"
                    rows={4}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="price">가격 (원) *</label>
                    <input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="stock">재고 *</label>
                    <input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="image_url">이미지 URL</label>
                  <input
                    id="image_url"
                    type="url"
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, image_url: e.target.value })
                    }
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {editingId ? '수정' : '추가'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : products.length === 0 ? (
          <p className="no-products">상품이 없습니다</p>
        ) : (
          <>
            <div className="products-table-container">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>상품명</th>
                    <th>가격</th>
                    <th>재고</th>
                    <th>이미지</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.id}</td>
                      <td className="product-name">{product.name}</td>
                      <td className="product-price">
                        {product.price.toLocaleString()} 원
                      </td>
                      <td className="product-stock">{product.stock}</td>
                      <td className="product-image">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="thumbnail"
                          />
                        ) : (
                          <span className="no-image">이미지 없음</span>
                        )}
                      </td>
                      <td className="product-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(product)}
                        >
                          수정
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(product.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  이전
                </button>
                <span className="page-info">
                  {page} / {totalPages}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
