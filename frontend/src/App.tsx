import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ConfigProvider } from './context/ConfigContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import HomePage from './pages/HomePage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PolicyPage from './pages/PolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import './styles/index.css';

// 관리자 화면은 일반 고객에게 필요 없으므로 따로 불러옵니다(첫 화면 용량 절약).
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'));
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'));

/** 페이지 이동 시 맨 위로 (같은 페이지 안의 쿼리 변경은 유지) */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const guard = (el: React.ReactNode, role?: 'admin') => <ProtectedRoute requiredRole={role}>{el}</ProtectedRoute>;

const AppContent: React.FC = () => (
  <div className="flex min-h-screen flex-col">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
      본문으로 건너뛰기
    </a>
    <ScrollToTop />
    <Header />
    <main id="main" className="flex-1">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/policy/:kind" element={<PolicyPage />} />

          <Route path="/cart" element={guard(<CartPage />)} />
          <Route path="/checkout" element={guard(<CheckoutPage />)} />
          <Route path="/orders" element={guard(<OrdersPage />)} />
          <Route path="/orders/:id" element={guard(<OrderDetailPage />)} />

          <Route path="/admin" element={guard(<AdminDashboardPage />, 'admin')} />
          <Route path="/admin/orders" element={guard(<AdminOrdersPage />, 'admin')} />
          <Route path="/admin/products" element={guard(<AdminProductsPage />, 'admin')} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </main>
    <Footer />
  </div>
);

const App: React.FC = () => (
  <Router>
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  </Router>
);

export default App;
