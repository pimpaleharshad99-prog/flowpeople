import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };

  const displayName = name || 'User';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={displayName}
        className={`${sizeClasses[size]} rounded-full object-cover border border-[var(--border-glass)] shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[var(--surface-hover)] text-[var(--accent)] border border-[var(--border-glass)] font-semibold flex items-center justify-center shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
};
