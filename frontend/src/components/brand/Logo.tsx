import { useId } from 'react';

export type LogoProps = {
  variant?: 'full' | 'icon';
  size?: number;           // icon size in px
  className?: string;
  showTagline?: boolean;   // "by FlowCraft"
};

export function Logo({ variant = 'full', size = 36, className = '', showTagline = true }: LogoProps) {
  const id = useId().replace(/:/g, '');
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="img" aria-label="FlowPeople by FlowCraft">
      <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14B8A6" /><stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id={`sh-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="26" fill={`url(#bg-${id})`} />
        <rect width="96" height="48" rx="26" fill={`url(#sh-${id})`} />
        <rect x=".75" y=".75" width="94.5" height="94.5" rx="25.5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
        <path d="M34 74V52C34 40 42 33 54 33H59" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 56C44 56 50 52 62 52" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="9" strokeLinecap="round" />
        <circle cx="71" cy="33" r="7" fill="#fff" />
      </svg>
      {variant === 'full' && (
        <div className="leading-none select-none">
          <div className="text-[20px] font-bold tracking-tight bg-gradient-to-r from-teal-700 to-indigo-800 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
            Flow<span className="font-medium">People</span>
          </div>
          {showTagline && (
            <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              by <span className="font-bold text-slate-700 dark:text-slate-200">FlowCraft</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Logo;

