import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <Link to="/" className="logo-link">
            🛍️ 쇼핑몰
          </Link>
        </div>

        <nav className="header-nav">
          <Link to="/" className="nav-link">
            홈
          </Link>
          <Link to="/products" className="nav-link">
            상품
          </Link>
          {user && (
            <>
              <Link to="/cart" className="nav-link">
                장바구니
              </Link>
              <Link to="/orders" className="nav-link">
                주문 내역
              </Link>
              {user.role === 'admin' && (
                <>
                  <Link to="/admin/products" className="nav-link admin-link">
                    상품 관리
                  </Link>
                  <Link to="/admin/orders" className="nav-link admin-link">
                    주문 관리
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        <div className="header-auth">
          {user ? (
            <div className="user-menu">
              <span className="user-name">{user.name}</span>
              {user.role === 'admin' && <span className="admin-badge">관리자</span>}
              <button className="btn-logout" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn-login">
                로그인
              </Link>
              <Link to="/register" className="btn-register">
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
