import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-10 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-[var(--surface-hover)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-subtle)]">
        {React.isValidElement(icon) ? (
          icon
        ) : typeof icon === 'function' ? (
          React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'w-6 h-6 stroke-[1.5]' })
        ) : (
          <Inbox className="w-6 h-6 stroke-[1.5]" />
        )}
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
        <p className="text-xs text-[var(--text-subtle)]">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
