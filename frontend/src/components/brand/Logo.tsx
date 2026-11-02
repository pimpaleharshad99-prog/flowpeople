import { useId } from 'react';

export type LogoProps = {
  variant?: 'full' | 'icon';
  size?: number;           // icon size in px
  className?: string;
  showTagline?: boolean;   // "by FlowCraft"
  customLogoUrl?: string;  // White-label organization logo
  customTitle?: string;    // White-label organization software title
  colorMode?: 'light' | 'dark' | 'auto';
};

export function Logo({
  variant = 'full',
  size = 36,
  className = '',
  showTagline = true,
  customLogoUrl,
  customTitle,
  colorMode = 'auto'
}: LogoProps) {
  const id = useId().replace(/:/g, '');

  const iconElement = customLogoUrl ? (
    <img
      src={customLogoUrl}
      alt={customTitle || 'Organization Logo'}
      className="shrink-0 object-contain rounded-xl border border-[var(--border-glass)] bg-white/50 shadow-md"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 96 96" 
      aria-hidden="true" 
      className="shrink-0 transition-transform duration-200 hover:scale-105"
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0, 213, 160, 0.3)) drop-shadow(0 2px 6px rgba(99, 102, 241, 0.25))'
      }}
    >
      <defs>
        {/* Rich Multi-Chromatic Gradient: Mint -> Cyan -> Royal Blue -> Neon Purple */}
        <linearGradient id={`bg-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D5A0" />
          <stop offset="35%" stopColor="#06B6D4" />
          <stop offset="70%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        {/* Luminous Specular Top Sheen */}
        <linearGradient id={`sh-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Dual Border Ring for high-contrast separation on both pure black & pure white */}
        <linearGradient id={`br-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Main Gradient Badge */}
      <rect width="96" height="96" rx="26" fill={`url(#bg-${id})`} />
      
      {/* Glossy Top Reflection */}
      <rect width="96" height="48" rx="26" fill={`url(#sh-${id})`} />
      
      {/* High-Definition Contrast Ring */}
      <rect 
        x="1" 
        y="1" 
        width="94" 
        height="94" 
        rx="25" 
        fill="none" 
        stroke={`url(#br-${id})`} 
        strokeWidth="2" 
      />

      {/* Stylized 'F' & Connected Human Flow Curves */}
      <path 
        d="M34 74V52C34 40 42 33 54 33H59" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeWidth="9" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M34 56C44 56 50 52 62 52" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeOpacity="0.9" 
        strokeWidth="9" 
        strokeLinecap="round" 
      />
      
      {/* Empathic Human / Biometric Eye Node */}
      <circle cx="71" cy="33" r="8" fill="#FFFFFF" />
      <circle cx="71" cy="33" r="3.5" fill="#06B6D4" />
    </svg>
  );

  // Dynamic Typography Styles Optimized for High Contrast on BOTH Black & White Backgrounds
  const getTypography = () => {
    if (colorMode === 'dark') {
      return {
        brandFlow: 'bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent font-extrabold',
        brandPeople: 'text-white font-bold',
        tagline: 'text-slate-400',
        flowCraft: 'text-teal-300 font-bold'
      };
    }
    if (colorMode === 'light') {
      return {
        brandFlow: 'bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent font-extrabold',
        brandPeople: 'text-slate-900 font-bold',
        tagline: 'text-slate-500',
        flowCraft: 'text-teal-700 font-bold'
      };
    }
    // Auto (adaptive to parent dark mode)
    return {
      brandFlow: 'bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 dark:from-teal-400 dark:via-cyan-300 dark:to-teal-200 bg-clip-text text-transparent font-extrabold',
      brandPeople: 'text-slate-900 dark:text-white font-bold',
      tagline: 'text-slate-500 dark:text-slate-400',
      flowCraft: 'text-teal-700 dark:text-teal-300 font-bold'
    };
  };

  const typo = getTypography();

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="img" aria-label={customTitle || "FlowPeople by FlowCraft"}>
      {iconElement}
      {variant === 'full' && (
        <div className="leading-tight select-none min-w-0 text-left">
          {customTitle ? (
            <div className="text-[17px] font-bold tracking-tight text-[var(--text-main)] truncate max-w-[155px]" title={customTitle}>
              {customTitle}
            </div>
          ) : (
            <div className="text-[20px] tracking-tight flex items-center gap-0.5">
              <span className={typo.brandFlow}>Flow</span>
              <span className={typo.brandPeople}>People</span>
            </div>
          )}
          {showTagline && (
            <div className={`text-[10.5px] font-medium tracking-tight ${typo.tagline}`}>
              by <span className={typo.flowCraft}>FlowCraft</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Logo;

