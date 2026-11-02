import React, { useId } from 'react';

export type LogoProps = {
  variant?: 'full' | 'icon' | 'compact' | 'monochrome';
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

  const isDarkBg = colorMode === 'dark';
  const isMono = variant === 'monochrome';

  // Badge Palette:
  // 1. Muted Sage Grey: #A5A79B
  // 2. Warm Cream Beige: #E8D2B5
  // 3. Deep Burgundy: #590907
  const badgeBg = isDarkBg 
    ? '#400605' 
    : isMono 
    ? '#590907' 
    : '#E8D2B5';

  const badgeInnerBg = isDarkBg
    ? '#590907'
    : isMono
    ? '#450605'
    : '#F5EBE1';

  const stemColor = isDarkBg
    ? '#E8D2B5'
    : isMono
    ? '#FFFFFF'
    : '#590907';

  const armSecondaryColor = isDarkBg
    ? '#A5A79B'
    : isMono
    ? '#DFE1D8'
    : '#A5A79B';

  const primaryNodeColor = isDarkBg
    ? '#E8D2B5'
    : isMono
    ? '#FFFFFF'
    : '#590907';

  const primaryNodeCenter = isDarkBg
    ? '#590907'
    : isMono
    ? '#590907'
    : '#E8D2B5';

  const borderColor = isDarkBg
    ? 'rgba(232, 210, 181, 0.3)'
    : isMono
    ? 'rgba(255, 255, 255, 0.2)'
    : '#A5A79B';

  const iconElement = customLogoUrl ? (
    <img
      src={customLogoUrl}
      alt={customTitle || 'Organization Logo'}
      className="shrink-0 object-contain rounded-xl border border-[#DFE1D8] bg-[#FAF6F0] shadow-sm"
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
        filter: isDarkBg 
          ? 'drop-shadow(0 4px 12px rgba(89, 9, 7, 0.35))'
          : 'drop-shadow(0 2px 8px rgba(89, 9, 7, 0.12))'
      }}
    >
      <defs>
        {/* Soft Luxury Cream Inset Gradient */}
        <radialGradient id={`glow-${id}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDarkBg ? "0.15" : "0.7"} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Base Badge Container in Warm Cream Beige (#E8D2B5) / Deep Burgundy (#590907) */}
      <rect width="96" height="96" rx="24" fill={badgeBg} />
      <rect x="4" y="4" width="88" height="88" rx="20" fill={badgeInnerBg} />
      <rect x="4" y="4" width="88" height="88" rx="20" fill={`url(#glow-${id})`} />

      {/* Precision Hairline Muted Sage Border */}
      <rect 
        x="0.75" 
        y="0.75" 
        width="94.5" 
        height="94.5" 
        rx="23.5" 
        fill="none" 
        stroke={borderColor} 
        strokeWidth="1.5" 
      />

      {/* ABSTRACT GEOMETRIC 'F' & WORKFORCE CONNECTION MOTIF */}
      {/* 1. Main Foundation Pillar & Upper Curved Arm: Deep Burgundy (#590907) */}
      <path 
        d="M32 72V45C32 35 39 31 51 31H57" 
        fill="none" 
        stroke={stemColor} 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* 2. Secondary Collaborative Arm: Muted Sage Grey (#A5A79B) */}
      <path 
        d="M32 53C41 53 47 49 57 49H60" 
        fill="none" 
        stroke={armSecondaryColor} 
        strokeWidth="7" 
        strokeLinecap="round" 
      />

      {/* 3. Human Connection Apex Node (Primary Talent Lead) */}
      <circle cx="68" cy="31" r="7" fill={primaryNodeColor} />
      <circle cx="68" cy="31" r="2.8" fill={primaryNodeCenter} />

      {/* 4. Secondary Connection Node (Workforce Synergy) */}
      <circle cx="68" cy="49" r="5" fill={armSecondaryColor} />

      {/* 5. Minimal Harmonic Workforce Link */}
      <path 
        d="M68 38V44" 
        stroke={armSecondaryColor} 
        strokeWidth="1.5" 
        strokeDasharray="2 2" 
        opacity="0.8" 
      />
    </svg>
  );

  // Typography Styles: Deep Burgundy & Dark Neutral / Warm Cream
  const getTypography = () => {
    if (isDarkBg) {
      return {
        brandFlow: 'text-[#E8D2B5] font-black',
        brandPeople: 'text-[#FAF6F0] font-extrabold',
        tagline: 'text-[#A5A79B]',
        flowCraft: 'text-[#E8D2B5] font-bold'
      };
    }
    return {
      brandFlow: 'text-[#590907] font-black',
      brandPeople: 'text-[#2E3029] font-extrabold',
      tagline: 'text-[#6B6D62]',
      flowCraft: 'text-[#590907] font-bold'
    };
  };

  const typo = getTypography();

  if (variant === 'icon' || variant === 'compact') {
    return (
      <div className={`inline-flex items-center ${className}`} role="img" aria-label={customTitle || "FlowPeople"}>
        {iconElement}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="img" aria-label={customTitle || "FlowPeople by FlowCraft"}>
      {iconElement}
      <div className="leading-tight select-none min-w-0 text-left">
        {customTitle ? (
          <div className="text-[17px] font-bold tracking-tight text-[#2E3029] truncate max-w-[155px]" title={customTitle}>
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
    </div>
  );
}

export default Logo;
