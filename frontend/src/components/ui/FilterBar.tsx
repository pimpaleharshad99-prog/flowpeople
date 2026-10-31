import React from 'react';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  children,
  onClearFilters,
  hasActiveFilters = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 glass-panel ${className}`}>
      <div className="flex-1 flex flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs glass-input"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {children}
      </div>

      {hasActiveFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 flex items-center gap-1 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
};

