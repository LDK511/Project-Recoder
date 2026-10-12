import React from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { Price, ProductImage } from './ui';

interface ProductCardProps {
  product: Product;
}

const LOW_STOCK = 5;

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock <= LOW_STOCK;
  return (
    <Link to={`/products/${product.id}`} className="group block" aria-label={`${product.name} 상세 보기`}>
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className={`aspect-square transition-transform duration-300 group-hover:scale-[1.015] ${soldOut ? 'opacity-50' : ''}`}
          rounded="rounded-lg"
        />
        {soldOut && (
          <span className="absolute left-2.5 top-2.5 rounded bg-ink px-2 py-1 text-xs font-semibold text-white">품절</span>
        )}
        {low && (
          <span className="absolute left-2.5 top-2.5 rounded bg-white px-2 py-1 text-xs font-semibold text-sale">
            {product.stock}개 남음
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {product.category && <p className="text-[13px] text-ink-mute">{product.category}</p>}
        <h3 className="line-clamp-2 text-[15px] leading-snug text-ink group-hover:underline group-hover:underline-offset-2">
          {product.name}
        </h3>
        <Price price={product.price_cents} compareAt={product.compare_at_price_cents} size="sm" />
      </div>
    </Link>
  );
};

export default ProductCard;
