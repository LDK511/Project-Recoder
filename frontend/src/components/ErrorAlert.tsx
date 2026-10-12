import React from 'react';
import { Icon } from './Icon';

export interface ErrorAlertProps {
  message: string | null;
  onDismiss?: () => void;
  tone?: 'error' | 'info' | 'warning';
  className?: string;
}

const tones = {
  error: 'border-sale/25 bg-sale/[0.06] text-sale',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-felt/25 bg-felt-light text-felt-dark',
};

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss, tone = 'error', className = '' }) => {
  if (!message) return null;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md border px-4 py-3 text-[15px] ${tones[tone]} ${className}`}>
      <Icon name={tone === 'info' ? 'check' : 'alert'} className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="닫기" className="opacity-60 hover:opacity-100">
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
