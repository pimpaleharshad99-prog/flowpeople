import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-button)] bg-[var(--status-neutral-bg)] ${className}`}
    />
  );
};

