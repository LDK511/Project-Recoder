import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const NAV = [
  { to: '/admin', label: '대시보드', icon: 'home', end: true },
  { to: '/admin/orders', label: '주문 관리', icon: 'list' },
  { to: '/admin/products', label: '상품 관리', icon: 'grid' },
];

const AdminLayout: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <div className="shell pt-6">
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="관리자 메뉴" className="-mx-4 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:border-0 lg:px-0">
        <p className="mb-3 hidden text-sm font-semibold text-ink-mute lg:block">관리자</p>
        <ul className="flex gap-1 lg:flex-col">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-[15px] ${
                    isActive ? 'bg-ink font-semibold text-white' : 'text-ink-soft hover:bg-well'
                  }`
                }
              >
                <Icon name={n.icon} className="h-[18px] w-[18px]" />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </div>
  </div>
);

export default AdminLayout;
