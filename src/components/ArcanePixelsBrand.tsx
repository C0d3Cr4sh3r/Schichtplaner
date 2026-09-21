import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ArcanePixelsBrandProps {
  theme?: 'dark' | 'light' | 'auto';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'ghost' | 'plain' | 'prominent';
  showLabel?: boolean;
  subtitle?: string;
  className?: string;
}

/**
 * ArcanePixels Brand Logo & Link Component
 * Displays the authentic ArcanePixels logo (monogram badge + wordmark)
 * and links to https://ArcanePixels.de
 */
export const ArcanePixelsBrand: React.FC<ArcanePixelsBrandProps> = ({
  theme = 'auto',
  size = 'md',
  variant = 'badge',
  showLabel = true,
  subtitle,
  className = '',
}) => {
  const isDark = theme === 'dark';

  // Badge icon sizes
  const iconDimensions = {
    xs: { box: 'w-6 h-6', text: 'text-xs', rounded: 'rounded-md' },
    sm: { box: 'w-7 h-7', text: 'text-xs font-bold', rounded: 'rounded-lg' },
    md: { box: 'w-9 h-9', text: 'text-sm font-black', rounded: 'rounded-xl' },
    lg: { box: 'w-11 h-11', text: 'text-base font-black', rounded: 'rounded-2xl' },
  };

  const titleSizes = {
    xs: 'text-xs font-bold',
    sm: 'text-sm font-bold',
    md: 'text-base font-extrabold',
    lg: 'text-lg font-black',
  };

  // Color schemes
  const styles = isDark
    ? {
        badgeBg: 'bg-[#72d2b9] text-[#0f172a] shadow-md shadow-teal-950/40',
        container:
          variant === 'prominent'
            ? 'bg-slate-800/90 border border-slate-700/90 hover:border-[#72d2b9]/60 hover:bg-slate-800 shadow-xl'
            : variant === 'badge'
            ? 'bg-slate-800/80 border border-slate-700/80 hover:border-[#72d2b9]/60 hover:bg-slate-750 shadow-xs'
            : 'hover:bg-slate-800/60',
        title: 'text-white group-hover:text-[#72d2b9]',
        accent: 'text-[#72d2b9]',
        sub: 'text-slate-400',
        linkIcon: 'text-slate-400 group-hover:text-[#72d2b9]',
      }
    : {
        badgeBg: 'bg-[#0f7a6a] text-white shadow-md shadow-emerald-950/10',
        container:
          variant === 'prominent'
            ? 'bg-white border border-slate-200 hover:border-[#0f7a6a]/60 hover:bg-slate-50 shadow-md'
            : variant === 'badge'
            ? 'bg-slate-50 border border-slate-200 hover:border-[#0f7a6a]/60 hover:bg-white shadow-2xs'
            : 'hover:bg-slate-100',
        title: 'text-slate-900 group-hover:text-[#0f7a6a]',
        accent: 'text-[#0f7a6a]',
        sub: 'text-slate-500',
        linkIcon: 'text-slate-400 group-hover:text-[#0f7a6a]',
      };

  const padClass =
    variant === 'plain'
      ? 'p-0'
      : size === 'xs'
      ? 'px-2 py-1'
      : size === 'sm'
      ? 'px-2.5 py-1.5'
      : size === 'md'
      ? 'px-3.5 py-2'
      : 'px-4 py-2.5';

  return (
    <a
      href="https://ArcanePixels.de"
      target="_blank"
      rel="noopener noreferrer"
      title="ArcanePixels.de besuchen (Software, Web & Werkzeuge)"
      className={`inline-flex items-center gap-2.5 group transition-all duration-150 rounded-xl cursor-pointer ${padClass} ${styles.container} ${className}`}
    >
      {/* Official ArcanePixels Monogram Emblem (AP Badge) */}
      <div
        className={`grid place-items-center shrink-0 tracking-tight transition-transform duration-150 group-hover:scale-105 ${iconDimensions[size].box} ${iconDimensions[size].rounded} ${styles.badgeBg} font-sans select-none`}
        aria-hidden="true"
      >
        <span className={iconDimensions[size].text}>AP</span>
      </div>

      {/* Brand Wordmark */}
      {showLabel && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`tracking-tight font-sans ${titleSizes[size]} ${styles.title} transition-colors`}>
              Arcane<span className={styles.accent}>Pixels</span>
              <span className={`font-semibold ${styles.accent}`}>.de</span>
            </span>
            <ExternalLink className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ${styles.linkIcon}`} />
          </div>
          {subtitle && (
            <span className={`text-[10px] sm:text-xs mt-0.5 font-medium tracking-wide uppercase ${styles.sub}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </a>
  );
};
