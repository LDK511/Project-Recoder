import React from 'react';

export interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, size = 'medium', inline }) => {
  const dim = { small: 'h-4 w-4 border-2', medium: 'h-7 w-7 border-[3px]', large: 'h-10 w-10 border-4' }[size];
  const spinner = <span className={`inline-block animate-spin rounded-full border-line border-t-felt ${dim}`} aria-hidden="true" />;
  if (inline) return spinner;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-mute" role="status">
      {spinner}
      <p className="text-sm">{message ?? '불러오는 중'}</p>
    </div>
  );
};

export default LoadingSpinner;
