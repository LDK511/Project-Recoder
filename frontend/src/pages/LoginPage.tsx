import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import '../styles/AuthPages.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 입력 검증
    if (!email.trim()) {
      setError('이메일을 입력하세요');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력하세요');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post('/api/auth/login', {
        email: email.trim(),
        password,
      });

      const { token, id, email: userEmail, name, role } = response.data;

      // 토큰 저장 및 인증 상태 업데이트
      login({
        id,
        email: userEmail,
        name,
        role,
        token,
      });

      // 로그인 성공 후 홈으로 이동
      navigate('/');
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err.response?.data?.error || '로그인에 실패했습니다';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1>로그인</h1>
          <p className="auth-subtitle">계정에 로그인하세요</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              계정이 없으신가요?{' '}
              <Link to="/register" className="link">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
