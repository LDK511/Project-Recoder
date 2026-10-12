import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../api/client';
import type { User } from '../types';
import { clearAuthStorage, getToken, getUser, saveToken, saveUser } from '../utils/storage';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getUser());
  const [token, setToken] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getToken());

  // 저장된 토큰이 아직 유효한지 서버에 확인 (만료됐으면 로그아웃 상태로)
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    authAPI
      .me()
      .then((r) => {
        if (cancelled) return;
        setUser(r.data.user);
        saveUser(r.data.user);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthStorage();
        setUser(null);
        setToken(null);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback((u: User, t: string) => {
    saveToken(t);
    saveUser(u);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await authAPI.login(email, password);
      return apply(r.data.user, r.data.token);
    },
    [apply]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const r = await authAPI.register(email, password, name);
      return apply(r.data.user, r.data.token);
    },
    [apply]
  );

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, token, isLoading, isAuthenticated: !!token && !!user, login, register, logout }),
    [user, token, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
