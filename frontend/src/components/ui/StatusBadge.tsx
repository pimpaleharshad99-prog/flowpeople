import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  showDot?: boolean;
  customLabel?: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className = '',
  showDot = true,
  customLabel,
  label,
}) => {
  // Auto-detect variant if not passed explicitly
  const resolvedVariant: StatusVariant =
    variant ||
    (() => {
      const s = (status || '').toUpperCase();
      if (['ACTIVE', 'VERIFIED', 'PRESENT', 'APPROVED', 'COMPLETED', 'RESOLVED', 'SUCCESS', 'CONFIRMED'].includes(s)) {
        return 'success';
      }
      if (['PENDING', 'IN_PROGRESS', 'LATE', 'ON_LEAVE', 'PROBATION', 'REVIEW', 'WARNING'].includes(s)) {
        return 'warning';
      }
      if (['REJECTED', 'FAILED', 'SPOOF_DETECTED', 'TERMINATED', 'CANCELLED', 'OVERDUE', 'CRITICAL', 'HIGH'].includes(s)) {
        return 'danger';
      }
      if (['INFO', 'DOCUMENTS', 'IT_SETUP', 'TRAINING', 'ORIENTATION'].includes(s)) {
        return 'info';
      }
      return 'neutral';
    })();

  const styles: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
    success: {
      bg: 'rgba(16, 185, 129, 0.1)',
      text: '#059669',
      border: 'rgba(16, 185, 129, 0.25)',
      dot: '#10b981',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      text: '#d97706',
      border: 'rgba(245, 158, 11, 0.25)',
      dot: '#f59e0b',
    },
    danger: {
      bg: 'rgba(239, 68, 68, 0.1)',
      text: '#dc2626',
      border: 'rgba(239, 68, 68, 0.25)',
      dot: '#ef4444',
    },
    neutral: {
      bg: 'var(--surface-hover)',
      text: 'var(--text-secondary)',
      border: 'var(--border-glass)',
      dot: 'var(--text-subtle)',
    },
    info: {
      bg: 'rgba(15, 118, 110, 0.1)',
      text: 'var(--accent)',
      border: 'rgba(15, 118, 110, 0.25)',
      dot: 'var(--accent)',
    },
  };

  const current = styles[resolvedVariant];
  const displayLabel = customLabel || label || (status || '').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${className}`}
      style={{
        backgroundColor: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: current.dot }}
        />
      )}
      <span className="capitalize">{displayLabel.toLowerCase()}</span>
    </span>
  );
};
