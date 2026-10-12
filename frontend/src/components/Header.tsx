import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartContext } from '../context/CartContext';
import { useStoreConfig } from '../context/ConfigContext';
import { formatPrice } from '../utils/formatters';
import { Icon } from './Icon';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCartContext();
  const cfg = useStoreConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('search') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(params.get('search') ?? '');
  }, [params]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : '/');
  };

  const freeShip = cfg.shipping.free_threshold_cents;

  const searchForm = (
    <form onSubmit={submit} role="search" className="relative w-full">
      <label htmlFor="site-search" className="sr-only">
        상품 검색
      </label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="키보드, 충전기, 조명…"
        className="h-11 w-full rounded-full border border-transparent bg-well pl-11 pr-4 text-[15px] placeholder:text-ink-mute focus:border-felt focus:bg-white focus:outline-none"
      />
      <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" />
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      {freeShip > 0 && (
        <div className="bg-felt text-center text-[13px] text-white">
          <p className="shell py-1.5">{formatPrice(freeShip)} 이상 구매 시 무료배송</p>
        </div>
      )}
      <div className="shell flex h-16 items-center gap-4 sm:gap-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={`${cfg.store.name} 홈`}>
          <span className="grid h-8 w-8 place-items-center rounded-md bg-felt text-[15px] font-black text-white">D</span>
          <span className="text-lg font-extrabold tracking-tight">{cfg.store.name}</span>
        </Link>

        <div className="hidden max-w-md flex-1 md:block">{searchForm}</div>

        <nav className="ml-auto flex items-center gap-1 text-[15px]" aria-label="사용자 메뉴">
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="btn-ghost hidden px-3 sm:inline-flex">
              관리자 센터
            </NavLink>
          )}
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                className="btn-ghost px-3"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Icon name="user" className="h-5 w-5" />
                <span className="hidden max-w-[8rem] truncate sm:inline">{user?.name}</span>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                  <div className="border-b border-line px-4 py-3">
                    <p className="font-semibold">{user?.name}님</p>
                    <p className="truncate text-sm text-ink-mute">{user?.email}</p>
                  </div>
                  <Link role="menuitem" to="/orders" className="block px-4 py-2.5 hover:bg-well">
                    주문·배송 조회
                  </Link>
                  {user?.role === 'admin' && (
                    <Link role="menuitem" to="/admin" className="block px-4 py-2.5 hover:bg-well sm:hidden">
                      관리자 센터
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left text-ink-soft hover:bg-well"
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="btn-ghost px-3">
              로그인
            </Link>
          )}
          <Link to="/cart" className="btn-ghost relative px-3" aria-label={`장바구니 ${count}개`}>
            <Icon name="bag" className="h-5 w-5" />
            <span className="hidden sm:inline">장바구니</span>
            {count > 0 && (
              <span className="num absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[11px] font-bold text-white sm:static sm:ml-0.5">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
      <div className="shell pb-3 md:hidden">{searchForm}</div>
    </header>
  );
};

export default Header;
