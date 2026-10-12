import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage, productsAPI } from '../api/client';
import { useToast } from '../context/ToastContext';
import AdminLayout from '../components/AdminLayout';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import { EmptyState, Field, Modal, ProductImage } from '../components/ui';
import type { PaginationMeta, Product } from '../types';
import { discountRate, formatPrice } from '../utils/formatters';

interface FormState {
  name: string;
  category: string;
  description: string;
  price_cents: string;
  compare_at_price_cents: string;
  stock: string;
  is_active: boolean;
  image: File | null;
}

const EMPTY: FormState = { name: '', category: '', description: '', price_cents: '', compare_at_price_cents: '', stock: '0', is_active: true, image: null };

const AdminProductsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const search = params.get('search') ?? '';
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(search);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await productsAPI.adminList({ page, limit: 20, search: search || undefined });
      setProducts(r.data.data);
      setPagination(r.data.pagination);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const doDelete = async () => {
    if (!deleting) return;
    try {
      const r = await productsAPI.delete(deleting.id);
      toast.show(r.data.message);
      setDeleting(null);
      load();
    } catch (e) {
      toast.show(getErrorMessage(e), { tone: 'error' });
    }
  };

  return (
    <AdminLayout
      title="상품 관리"
      actions={
        <button className="btn-primary" onClick={() => setEditing('new')}>
          상품 등록
        </button>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(query.trim() ? { search: query.trim() } : {});
        }}
      >
        <input className="input max-w-sm" type="search" placeholder="상품명, 카테고리" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="상품 검색" />
        <button className="btn-dark">검색</button>
      </form>
      {error && <ErrorAlert message={error} className="mt-4" />}

      <div className="panel mt-4 overflow-hidden">
        {loading && products.length === 0 ? (
          <LoadingSpinner />
        ) : products.length === 0 ? (
          <EmptyState
            title="등록된 상품이 없어요"
            action={
              <button className="btn-primary" onClick={() => setEditing('new')}>
                첫 상품 등록하기
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="bg-well text-sm text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">상품</th>
                  <th className="px-4 py-3 text-right font-semibold">판매가</th>
                  <th className="px-4 py-3 text-right font-semibold">재고</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr key={p.id} className={p.is_active ? '' : 'bg-well/40 text-ink-mute'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage src={p.image_url} alt={p.name} className="h-12 w-12 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-sm text-ink-mute">
                            #{p.id} {p.category && `· ${p.category}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="num px-4 py-3 text-right">
                      {discountRate(p.price_cents, p.compare_at_price_cents) > 0 && (
                        <span className="mr-1.5 text-sm text-sale">{discountRate(p.price_cents, p.compare_at_price_cents)}%</span>
                      )}
                      {formatPrice(p.price_cents)}
                    </td>
                    <td className={`num px-4 py-3 text-right font-semibold ${p.stock === 0 ? 'text-sale' : p.stock <= 5 ? 'text-amber-700' : ''}`}>
                      {p.stock === 0 ? '품절' : p.stock.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[13px] font-semibold ${p.is_active ? 'bg-felt-light text-felt-dark' : 'bg-line text-ink-mute'}`}>
                        {p.is_active ? '판매중' : '판매중지'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button className="btn-outline btn-sm" onClick={() => setEditing(p)}>
                        수정
                      </button>
                      <button className="btn-ghost btn-sm ml-1 text-sale" onClick={() => setDeleting(p)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        pagination={pagination}
        isLoading={loading}
        onPageChange={(p) => {
          const n = new URLSearchParams(params);
          p === 1 ? n.delete('page') : n.set('page', String(p));
          setParams(n);
        }}
      />

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p, isNew) => {
            toast.show(isNew ? `'${p.name}' 상품을 등록했어요.` : '변경 내용을 저장했어요.');
            setEditing(null);
            load();
          }}
        />
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="상품 삭제">
        <p className="text-[15px] text-ink-soft">
          '{deleting?.name}' 상품을 삭제할까요? 주문 이력이 있는 상품은 주문서를 보존하기 위해 삭제 대신 판매중지(숨김) 처리됩니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={() => setDeleting(null)}>
            취소
          </button>
          <button className="btn-dark" onClick={doDelete}>
            삭제
          </button>
        </div>
      </Modal>
    </AdminLayout>
  );
};

const ProductForm: React.FC<{ product: Product | null; onClose: () => void; onSaved: (p: Product, isNew: boolean) => void }> = ({
  product,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(() =>
    product
      ? {
          name: product.name,
          category: product.category ?? '',
          description: product.description ?? '',
          price_cents: String(product.price_cents),
          compare_at_price_cents: product.compare_at_price_cents ? String(product.compare_at_price_cents) : '',
          stock: String(product.stock),
          is_active: product.is_active !== false,
          image: null,
        }
      : EMPTY
  );
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.image) return;
    const url = URL.createObjectURL(form.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '상품명을 입력해 주세요.';
    const price = parseInt(form.price_cents, 10);
    if (!(price >= 100)) errs.price_cents = '판매가는 100원 이상이어야 해요.';
    const stock = parseInt(form.stock, 10);
    if (!(stock >= 0)) errs.stock = '재고는 0 이상이어야 해요.';
    if (form.compare_at_price_cents && !(parseInt(form.compare_at_price_cents, 10) > price))
      errs.compare_at_price_cents = '정가는 판매가보다 커야 할인으로 표시돼요.';
    if (form.image && form.image.size > 5 * 1024 * 1024) errs.image = '이미지는 5MB 이하만 올릴 수 있어요.';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('category', form.category.trim());
    fd.append('description', form.description);
    fd.append('price_cents', String(price));
    fd.append('compare_at_price_cents', form.compare_at_price_cents ? String(parseInt(form.compare_at_price_cents, 10)) : '');
    fd.append('stock', String(stock));
    fd.append('is_active', String(form.is_active));
    if (form.image) fd.append('image', form.image);

    setBusy(true);
    setError(null);
    try {
      const r = product ? await productsAPI.update(product.id, fd) : await productsAPI.create(fd);
      onSaved(r.data, !product);
    } catch (err) {
      setError(getErrorMessage(err, '저장하지 못했습니다.'));
      setBusy(false);
    }
  };

  const rate = discountRate(parseInt(form.price_cents, 10) || 0, parseInt(form.compare_at_price_cents, 10) || 0);

  return (
    <Modal open onClose={onClose} title={product ? '상품 수정' : '상품 등록'} wide>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <div>
            <p className="field-label">대표 이미지</p>
            <label className="block cursor-pointer">
              <ProductImage src={preview} alt="미리보기" className="aspect-square w-full border border-dashed border-line" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => set('image', e.target.files?.[0] ?? null)}
              />
              <span className="mt-2 block text-center text-sm font-semibold text-felt">{preview ? '이미지 바꾸기' : '이미지 선택'}</span>
            </label>
            {errors.image ? <p className="field-error">{errors.image}</p> : <p className="field-hint">JPG·PNG·WEBP, 5MB 이하, 정사각형 권장</p>}
          </div>
          <div className="space-y-4">
            <Field id="p-name" label="상품명" required error={errors.name}>
              <input id="p-name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={255} />
            </Field>
            <Field id="p-category" label="카테고리" optional>
              <input id="p-category" className="input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="예: 오디오" maxLength={50} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="p-price" label="판매가(원)" required error={errors.price_cents}>
                <input id="p-price" inputMode="numeric" className={`input num ${errors.price_cents ? 'input-error' : ''}`} value={form.price_cents} onChange={(e) => set('price_cents', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field id="p-compare" label="정가(원)" optional error={errors.compare_at_price_cents} hint={rate > 0 ? `${rate}% 할인으로 표시돼요` : undefined}>
                <input id="p-compare" inputMode="numeric" className={`input num ${errors.compare_at_price_cents ? 'input-error' : ''}`} value={form.compare_at_price_cents} onChange={(e) => set('compare_at_price_cents', e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <Field id="p-stock" label="재고(개)" required error={errors.stock}>
              <input id="p-stock" inputMode="numeric" className={`input num max-w-[10rem] ${errors.stock ? 'input-error' : ''}`} value={form.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        </div>
        <Field id="p-desc" label="상품 설명" optional hint="줄바꿈이 그대로 표시돼요. 소재, 크기, 구성품, 주의사항을 적어 주세요.">
          <textarea id="p-desc" className="input min-h-[140px]" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="h-[18px] w-[18px] accent-felt" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          <span>판매중으로 공개</span>
          <span className="text-sm text-ink-mute">(끄면 쇼핑몰에서 숨겨지고 장바구니에서도 빠져요)</span>
        </label>
        {error && <ErrorAlert message={error} />}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-outline" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '저장하는 중…' : product ? '변경 내용 저장' : '상품 등록'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminProductsPage;
