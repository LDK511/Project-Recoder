import React from 'react';
import type { OrderStatus } from '../types';
import { ORDER_STATUS_LABEL } from '../utils/formatters';

const color: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-felt-light text-felt-dark ring-felt/20',
  preparing: 'bg-felt-light text-felt-dark ring-felt/20',
  shipping: 'bg-sky-50 text-sky-800 ring-sky-200',
  completed: 'bg-well text-ink ring-line',
  cancelled: 'bg-white text-ink-mute ring-line',
  expired: 'bg-white text-ink-mute ring-line',
  refunded: 'bg-white text-ink-mute ring-line',
};

const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => (
  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset ${color[status] ?? color.completed}`}>
    {ORDER_STATUS_LABEL[status] ?? status}
  </span>
);

export default OrderStatusBadge;
