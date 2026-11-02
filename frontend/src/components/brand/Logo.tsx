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
      className="shrink-0 transition-transform duration-200 hover:scale-105 select-none"
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0, 229, 153, 0.35)) drop-shadow(0 2px 6px rgba(255, 51, 102, 0.25)) drop-shadow(0 6px 18px rgba(0, 0, 0, 0.22))'
      }}
    >
      <defs>
        {/* Full Chromatic Spectrum Gradient: Coral Pink -> Electric Amber -> Luminous Mint -> Cyan -> Violet */}
        <linearGradient id={`bg-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3366" />
          <stop offset="25%" stopColor="#FF9100" />
          <stop offset="50%" stopColor="#00E599" />
          <stop offset="75%" stopColor="#00D2FF" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Luminous Specular Top Sheen */}
        <linearGradient id={`sh-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Dual Border Ring for high-contrast separation on both pure black & pure white */}
        <linearGradient id={`br-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#FFE066" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#67E8F9" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#E9D5FF" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Main Chromatic Spectrum Badge */}
      <rect width="96" height="96" rx="26" fill={`url(#bg-${id})`} />
      
      {/* Glossy Top Reflection */}
      <rect width="96" height="48" rx="26" fill={`url(#sh-${id})`} />
      
      {/* Precision Hairline Outer Contrast for snow-white backgrounds */}
      <rect 
        x="0.5" 
        y="0.5" 
        width="95" 
        height="95" 
        rx="26" 
        fill="none" 
        stroke="rgba(15, 23, 42, 0.16)" 
        strokeWidth="1" 
      />

      {/* Luminous High-Definition Inner Ring for black/dark backgrounds */}
      <rect 
        x="1.5" 
        y="1.5" 
        width="93" 
        height="93" 
        rx="25" 
        fill="none" 
        stroke={`url(#br-${id})`} 
        strokeWidth="1.5" 
      />

      {/* Stylized 'F' & Connected Human Flow Curves with 3D depth */}
      <path 
        d="M34 74V52C34 40 42 33 54 33H59" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeWidth="9" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }}
      />
      <path 
        d="M34 56C44 56 50 52 62 52" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeOpacity="0.95" 
        strokeWidth="9" 
        strokeLinecap="round" 
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }}
      />
      
      {/* Biometric Eye & Pulse Node with Multi-Ring Focus */}
      <circle cx="71" cy="33" r="8" fill="#FFFFFF" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }} />
      <circle cx="71" cy="33" r="4" fill="#00D2FF" />
      <circle cx="71" cy="33" r="1.5" fill="#FFFFFF" />
    </svg>
  );

  // Dynamic Typography Styles Optimized for High Contrast on BOTH Black & White Backgrounds
  const getTypography = () => {
    if (colorMode === 'dark') {
      return {
        brandFlow: 'bg-gradient-to-r from-[#00E599] via-[#00D2FF] to-[#A78BFA] bg-clip-text text-transparent font-black',
        brandPeople: 'text-white font-extrabold',
        tagline: 'text-slate-400',
        flowCraft: 'bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent font-bold'
      };
    }
    if (colorMode === 'light') {
      return {
        brandFlow: 'bg-gradient-to-r from-[#059669] via-[#0284C7] to-[#6366F1] bg-clip-text text-transparent font-black',
        brandPeople: 'text-slate-950 font-extrabold',
        tagline: 'text-slate-500',
        flowCraft: 'text-teal-700 font-bold'
      };
    }
    // Auto (adaptive to parent dark mode)
    return {
      brandFlow: 'bg-gradient-to-r from-[#059669] via-[#0284C7] to-[#6366F1] dark:from-[#00E599] dark:via-[#00D2FF] dark:to-[#A78BFA] bg-clip-text text-transparent font-black',
      brandPeople: 'text-slate-950 dark:text-white font-extrabold',
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

