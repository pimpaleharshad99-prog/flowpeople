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
      bg: 'rgba(74, 90, 63, 0.12)',
      text: '#4A5A3F',
      border: 'rgba(74, 90, 63, 0.28)',
      dot: '#4A5A3F',
    },
    warning: {
      bg: 'rgba(140, 72, 32, 0.12)',
      text: '#8C4820',
      border: 'rgba(140, 72, 32, 0.28)',
      dot: '#8C4820',
    },
    danger: {
      bg: 'rgba(89, 9, 7, 0.1)',
      text: '#590907',
      border: 'rgba(89, 9, 7, 0.25)',
      dot: '#590907',
    },
    neutral: {
      bg: 'rgba(165, 167, 155, 0.15)',
      text: '#55574D',
      border: 'rgba(165, 167, 155, 0.3)',
      dot: '#8E9084',
    },
    info: {
      bg: 'rgba(165, 167, 155, 0.2)',
      text: '#4B4D44',
      border: 'rgba(165, 167, 155, 0.4)',
      dot: '#590907',
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
