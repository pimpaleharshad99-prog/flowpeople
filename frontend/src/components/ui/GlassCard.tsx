import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  title?: string;
  subtitle?: string;
  noPadding?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  header,
  actions,
  action,
  title,
  subtitle,
  noPadding = false,
}) => {
  const headerActions = actions || action;

  return (
    <div className={`glass-panel transition-all duration-200 ${className}`}>
      {(header || title) && (
        <div className="px-6 py-4 border-b border-[var(--border-glass)] flex items-center justify-between gap-4">
          {header ? (
            header
          ) : (
            <div>
              {title && <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>}
              {subtitle && <p className="text-xs text-[var(--text-subtle)] mt-0.5">{subtitle}</p>}
            </div>
          )}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
};
