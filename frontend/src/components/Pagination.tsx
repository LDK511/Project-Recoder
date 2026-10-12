import React from 'react';
import type { PaginationMeta } from '../types';
import { Icon } from './Icon';

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange, isLoading = false }) => {
  const { page, pages } = pagination;
  if (pages <= 1) return null;
  const btn = 'grid h-10 min-w-10 place-items-center rounded-md px-2 text-[15px] num';
  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="페이지 이동">
      <button
        className={`${btn} text-ink-soft hover:bg-well disabled:opacity-30`}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
        aria-label="이전 페이지"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
      </button>
      {pageWindow(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-ink-mute">
            …
          </span>
        ) : (
          <button
            key={n}
            className={`${btn} ${n === page ? 'bg-ink font-semibold text-white' : 'text-ink-soft hover:bg-well'}`}
            onClick={() => onPageChange(n)}
            disabled={isLoading}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`${n}페이지`}
          >
            {n}
          </button>
        )
      )}
      <button
        className={`${btn} text-ink-soft hover:bg-well disabled:opacity-30`}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages || isLoading}
        aria-label="다음 페이지"
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>
    </nav>
  );
};

export default Pagination;
