import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * 관리자 권한이 있는 사용자만 접근 가능한 라우트 보호 컴포넌트
 * 인증되지 않았거나 관리자가 아니면 홈 페이지로 리다이렉트합니다.
 */
export function AdminRoute({ children }: AdminRouteProps): React.ReactElement {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default AdminRoute;
