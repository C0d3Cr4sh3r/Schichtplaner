import React from 'react';

interface ArcanePixelsBrandProps {
  theme?: 'dark' | 'light' | 'auto';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'badge' | 'ghost' | 'plain' | 'prominent' | 'text';
  showLabel?: boolean;
  subtitle?: string;
  className?: string;
}

/**
 * ArcanePixels Brand Logo & Link Component
 * Displays the authentic ArcanePixels logo (Sensenmann/camera mark, name baked into the SVG)
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
  const logoSrc = isDark ? '/arcanepixels-logo-white.svg' : '/arcanepixels-logo-black.svg';

  if (variant === 'text') {
    const textColor = isDark
      ? 'text-slate-300 hover:text-[#72d2b9]'
      : 'text-slate-600 hover:text-[#0f7a6a]';
    return (
      <a
        href="https://ArcanePixels.de"
        target="_blank"
        rel="noopener noreferrer"
        title="ArcanePixels.de besuchen (Software, Web & Werkzeuge)"
        className={`font-medium transition-colors ${textColor} ${className}`}
      >
        ArcanePixels
      </a>
    );
  }

  // Logo sizes (width; height follows the SVG's own aspect ratio)
  const logoSizes = {
    xs: 'w-8',
    sm: 'w-10',
    md: 'w-14',
    lg: 'w-20',
    xl: 'w-48',
  };

  // Color schemes
  const styles = isDark
    ? {
        container:
          variant === 'prominent'
            ? 'bg-slate-800/90 border border-slate-700/90 hover:border-[#72d2b9]/60 hover:bg-slate-800 shadow-xl'
            : variant === 'badge'
            ? 'bg-slate-800/80 border border-slate-700/80 hover:border-[#72d2b9]/60 hover:bg-slate-750 shadow-xs'
            : 'hover:bg-slate-800/60',
        sub: 'text-slate-400',
        linkIcon: 'text-slate-400 group-hover:text-[#72d2b9]',
      }
    : {
        container:
          variant === 'prominent'
            ? 'bg-white border border-slate-200 hover:border-[#0f7a6a]/60 hover:bg-slate-50 shadow-md'
            : variant === 'badge'
            ? 'bg-slate-50 border border-slate-200 hover:border-[#0f7a6a]/60 hover:bg-white shadow-2xs'
            : 'hover:bg-slate-100',
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
      : size === 'lg'
      ? 'px-4 py-2.5'
      : 'px-5 py-3';

  return (
    <a
      href="https://ArcanePixels.de"
      target="_blank"
      rel="noopener noreferrer"
      title="ArcanePixels.de besuchen (Software, Web & Werkzeuge)"
      className={`inline-flex items-center gap-2.5 group transition-all duration-150 rounded-xl cursor-pointer ${padClass} ${styles.container} ${className}`}
    >
      <img
        src={logoSrc}
        alt="ArcanePixels"
        className={`shrink-0 h-auto transition-transform duration-150 group-hover:scale-105 ${logoSizes[size]}`}
      />

      {showLabel && subtitle && (
        <div className="flex flex-col text-left leading-none">
          <span className={`text-[10px] sm:text-xs mt-0.5 font-medium tracking-wide uppercase ${styles.sub}`}>
            {subtitle}
          </span>
        </div>
      )}
    </a>
  );
};
