import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  category?: string;
  action?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  category,
  action,
  secondaryActions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-[var(--border-subtle)]">
      <div className="space-y-1">
        {category && (
          <div className="text-xs font-semibold tracking-wider uppercase text-[var(--accent)]">
            {category}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--text-muted)] max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryActions) && (
        <div className="flex items-center gap-3 shrink-0">
          {secondaryActions}
          {action}
        </div>
      )}
    </div>
  );
};

