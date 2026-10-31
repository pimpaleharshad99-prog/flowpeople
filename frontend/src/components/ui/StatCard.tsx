import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  icon?: LucideIcon | React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  className = '',
}) => {
  return (
    <div className={`glass-panel p-3.5 sm:p-4 flex items-center justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden ${className}`}>
      <div className="space-y-0.5 min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[var(--text-subtle)] truncate" title={label}>{label}</p>
        <p className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-main)] truncate">{value}</p>
        {(subtext || trend) && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-subtle)]">
            {trend && (
              <span
                className={`font-semibold shrink-0 ${
                  trend.positive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.value}
              </span>
            )}
            {subtext && <span className="truncate" title={subtext}>{subtext}</span>}
          </div>
        )}
      </div>

      {icon && (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[var(--surface-hover)] border border-[var(--border-glass)] flex items-center justify-center shrink-0 text-[var(--accent)]">
          {React.isValidElement(icon) ? (
            icon
          ) : typeof icon === 'function' ? (
            React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'w-4 h-4 stroke-[1.5]' })
          ) : null}
        </div>
      )}
    </div>
  );
};
