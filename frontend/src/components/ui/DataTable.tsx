import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface RowAction<T = any> {
  label: string;
  onClick: (item: T) => void;
  isDanger?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  rowActions?: RowAction<T>[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  searchPlaceholder?: string;
  filterKey?: string;
}

export function DataTable<T = any>({
  columns,
  data,
  keyExtractor = (item: any, i: number) => item?.id ?? item?.code ?? i,
  rowActions,
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching your criteria.',
  className = '',
  searchPlaceholder,
  filterKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuKey, setActiveMenuKey] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item: any) => {
      if (filterKey && item[filterKey]) {
        return String(item[filterKey]).toLowerCase().includes(q);
      }
      return Object.values(item).some(
        (val) => typeof val === 'string' && val.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery, filterKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const res = aVal > bVal ? 1 : -1;
      return sortDir === 'asc' ? res : -res;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  return (
    <div className={`space-y-3 ${className}`}>
      {searchPlaceholder && (
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 glass-input text-xs"
          />
        </div>
      )}

      <div className="glass-panel overflow-hidden border border-[var(--border-glass)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-glass)] bg-[var(--surface-hover)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 font-medium text-[var(--text-subtle)] uppercase tracking-wider select-none ${
                      col.sortable ? 'cursor-pointer hover:text-[var(--text-main)]' : ''
                    } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[var(--text-subtle)]">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {rowActions && rowActions.length > 0 && (
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-subtle)] uppercase tracking-wider w-12">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-glass)]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (rowActions ? 1 : 0)} className="py-12">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const key = keyExtractor(item, index);
                  return (
                    <tr
                      key={key}
                      className="hover:bg-[var(--surface-hover)] transition-colors group"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-[var(--text-main)] ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${col.className || ''}`}
                        >
                          {col.render ? col.render(item) : (item as any)[col.key] ?? '—'}
                        </td>
                      ))}

                      {rowActions && rowActions.length > 0 && (
                        <td className="px-4 py-3 text-right relative">
                          <button
                            onClick={() => setActiveMenuKey(activeMenuKey === key ? null : key)}
                            className="p-1 rounded-md text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {activeMenuKey === key && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveMenuKey(null)}
                              />
                              <div className="absolute right-4 top-10 z-50 glass-dropdown w-40 py-1 shadow-lg text-left">
                                {rowActions.map((action, actionIdx) => (
                                  <button
                                    key={actionIdx}
                                    onClick={() => {
                                      setActiveMenuKey(null);
                                      action.onClick(item);
                                    }}
                                    className={`w-full px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--surface-hover)] transition-colors ${
                                      action.isDanger
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-[var(--text-main)]'
                                    }`}
                                  >
                                    {action.icon && <action.icon className="w-3.5 h-3.5" />}
                                    <span>{action.label}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {sortedData.length > pageSize && (
          <div className="px-4 py-2.5 border-t border-[var(--border-glass)] flex items-center justify-between text-xs text-[var(--text-subtle)]">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
