import React from 'react';

export interface TimelineItem {
  id?: string | number;
  date?: string;
  timestamp?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  isCurrent?: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={`relative pl-6 border-l border-[var(--border-glass)] space-y-6 ${className}`}>
      {items.map((item, index) => {
        const key = item.id ?? index;
        const displayDate = item.date || item.timestamp;
        return (
          <div key={key} className="relative">
            {/* Dot */}
            <div
              className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-canvas)] ${
                item.isCurrent 
                  ? 'bg-[var(--accent)] ring-4 ring-[var(--accent)]/20' 
                  : 'bg-[var(--border-glass)]'
              }`}
            />

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {displayDate && (
                  <span className="text-[11px] font-mono text-[var(--text-subtle)]">{displayDate}</span>
                )}
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-glass)] text-[var(--text-secondary)]">
                    {item.badge}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-semibold text-[var(--text-main)]">{item.title}</h4>
              {item.description && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
