import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentUser, login as apiLogin, register as apiRegister } from '../api/client';

/**
 * 사용자 정보 타입
 */
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

/**
 * 인증 컨텍스트 타입
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 인증 상태 제공자
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 저장된 토큰과 사용자 정보로 인증 상태 복구
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('[auth] Failed to get current user', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 로그인
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const response = await apiLogin({ email, password });
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user', JSON.stringify(response));
      setUser({
        id: response.id,
        email: response.email,
        name: response.name,
        role: response.role as 'user' | 'admin',
      });
    } catch (error) {
      console.error('[auth] Login failed', error);
      throw error;
    }
  }, []);

  /**
   * 회원가입
   */
  const register = useCallback(
    async (email: string, password: string, name: string): Promise<void> => {
      try {
        const response = await apiRegister({ email, password, name });
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
        setUser({
          id: response.id,
          email: response.email,
          name: response.name,
          role: 'user',
        });
      } catch (error) {
        console.error('[auth] Register failed', error);
        throw error;
      }
    },
    [],
  );

  /**
   * 로그아웃
   */
  const logout = useCallback((): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  /**
   * 마운트 시 인증 상태 복구
   */
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isAuthenticated = user !== null;

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
      checkAuth,
    }),
    [user, isLoading, isAuthenticated, login, register, logout, checkAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 인증 컨텍스트 훅
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
