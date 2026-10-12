import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productsAPI } from '../api/client';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import ErrorAlert from '../components/ErrorAlert';
import { EmptyState } from '../components/ui';
import type { Category } from '../types';
import { useStoreConfig } from '../context/ConfigContext';
import { formatPrice } from '../utils/formatters';

const SORTS = [
  { value: 'newest', label: '신상품순' },
  { value: 'popular', label: '판매많은순' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
];

/** 책상 매트 위에 상품을 올려 둔 첫 화면 — 매장의 성격을 한눈에 보여주는 유일한 장식 요소 */
const DeskHero: React.FC = () => {
  const cfg = useStoreConfig();
  const items = [
    { src: '/products/keyboard.svg', cls: 'left-[6%] top-[18%] w-[34%] rotate-[-4deg]' },
    { src: '/products/mouse.svg', cls: 'left-[43%] top-[30%] w-[14%] rotate-[8deg]' },
    { src: '/products/headphones.svg', cls: 'right-[5%] top-[6%] w-[26%] rotate-[6deg]' },
    { src: '/products/lamp.svg', cls: 'right-[30%] top-[2%] w-[15%] rotate-[-3deg]' },
    { src: '/products/charger.svg', cls: 'right-[9%] bottom-[6%] w-[17%] rotate-[-7deg]' },
    { src: '/products/hub.svg', cls: 'left-[20%] bottom-[4%] w-[17%] rotate-[3deg]' },
  ];
  return (
    <section className="shell pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-felt text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,.35) 1px, transparent 1px), radial-gradient(rgba(0,0,0,.35) 1px, transparent 1px)',
            backgroundSize: '5px 5px, 7px 7px',
            backgroundPosition: '0 0, 2px 3px',
          }}
          aria-hidden="true"
        />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col justify-center px-6 pb-2 pt-8 sm:px-10 md:py-14">
            <h1 className="text-[28px] font-extrabold leading-[1.25] tracking-tight sm:text-[40px]">
              하루 아홉 시간,
              <br />
              손이 닿는 자리부터
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/80 sm:text-base">
              키보드, 조명, 충전기. 오래 앉아 일하는 사람의 책상을 기준으로 직접 써 보고 고른 도구만 팝니다.
            </p>
            {cfg.shipping.free_threshold_cents > 0 && (
              <p className="mt-6 text-sm text-white/70">{formatPrice(cfg.shipping.free_threshold_cents)} 이상 무료배송 · 수령 후 7일 이내 교환·반품</p>
            )}
          </div>
          <div className="relative mx-4 mb-4 aspect-[16/10] md:m-0 md:aspect-auto md:min-h-[340px]" aria-hidden="true">
            {items.map((it) => (
              <img
                key={it.src}
                src={it.src}
                alt=""
                className={`absolute rounded-xl shadow-[0_18px_30px_-12px_rgba(0,0,0,.45)] ${it.cls}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const HomePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  const { products, pagination, isLoading, error, fetchProducts } = useProducts();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    productsAPI
      .getCategories()
      .then((r) => setCategories(r.data.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchProducts({ page, limit: 12, search: search || undefined, category: category || undefined, sort });
  }, [fetchProducts, page, search, category, sort]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const showHero = !search && !category && page === 1;
  const total = categories.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      {showHero && <DeskHero />}

      <section className="shell mt-10" aria-labelledby="list-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="list-title" className="text-xl font-bold tracking-tight sm:text-2xl">
              {search ? `'${search}' 검색 결과` : category || '전체 상품'}
            </h2>
            {!isLoading && <p className="num mt-1 text-sm text-ink-mute">상품 {pagination.total}개</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">정렬</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
              className="h-10 rounded-md border border-line bg-white px-3 pr-8 text-sm focus:border-felt focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {categories.length > 0 && (
          <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 pb-1" role="tablist" aria-label="카테고리">
              {[{ name: '', count: total }, ...categories].map((c) => {
                const active = c.name === category;
                return (
                  <button
                    key={c.name || 'all'}
                    role="tab"
                    aria-selected={active}
                    onClick={() => update({ category: c.name || null })}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
                      active ? 'border-ink bg-ink font-semibold text-white' : 'border-line bg-white text-ink-soft hover:border-ink'
                    }`}
                  >
                    {c.name || '전체'}
                    <span className={`num ml-1 ${active ? 'text-white/70' : 'text-ink-mute'}`}>{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <ErrorAlert message={error} className="mt-6" />}

        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="상품을 불러오는 중">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square animate-pulse rounded-lg bg-well" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-well" />
                <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-well" />
              </div>
            ))}
          </div>
        ) : products.length === 0 && !error ? (
          <EmptyState
            icon="search"
            title={search ? `'${search}'에 맞는 상품이 없어요` : '이 카테고리에 상품이 없어요'}
            description="철자를 확인하거나 더 짧은 단어로 검색해 보세요."
            action={
              <button className="btn-outline" onClick={() => setParams(new URLSearchParams())}>
                전체 상품 보기
              </button>
            }
          />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <Pagination
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={(p) => {
            update({ page: p === 1 ? null : String(p) });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </section>
    </div>
  );
};

export default HomePage;
