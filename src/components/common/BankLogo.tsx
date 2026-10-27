import React, { useState } from 'react';
import { BrandConfig } from '../../types/queueTypes';

interface BankLogoProps {
  brand: BrandConfig;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'color';
  showTagline?: boolean;
}

export const BankLogo: React.FC<BankLogoProps> = ({
  brand,
  size = 'md',
  variant = 'color',
  showTagline = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Resolve official logo image path based on brand ID or name
  const getLogoSrc = (): string => {
    if (brand.logoUrl) return brand.logoUrl;
    const id = brand.id?.toLowerCase() || '';
    if (id.includes('capturedoc')) return '/logos/capturedoc.png';
    if (id === 'agb' || id.includes('gulf')) return '/logos/agb.png';
    if (id === 'sga' || id.includes('generale') || id.includes('societe')) return '/logos/sga.png';
    return '';
  };

  const logoSrc = getLogoSrc();

  // Responsive height classes per size
  const heightClasses = {
    sm: 'h-7 max-h-7',
    md: 'h-9 max-h-9 sm:h-10 sm:max-h-10',
    lg: 'h-13 max-h-13 sm:h-16 sm:max-h-16',
    xl: 'h-18 max-h-18 sm:h-20 sm:max-h-20',
  };

  const isServices = brand.id === 'capturedoc-services';

  return (
    <div className="flex items-center gap-3 select-none shrink-0">
      {logoSrc && !imageError ? (
        <div
          className={`shrink-0 flex items-center transition-all ${
            variant === 'dark'
              ? 'bg-white rounded-xl px-2.5 py-1 shadow-sm border border-white/30'
              : ''
          }`}
        >
          <img
            src={logoSrc}
            alt={brand.name}
            onError={() => setImageError(true)}
            className={`${heightClasses[size]} w-auto object-contain block`}
          />
        </div>
      ) : (
        /* Fallback text mark */
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-xs"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.name.charAt(0)}
          </div>
          <span className={`font-black text-base ${variant === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {brand.name}
          </span>
        </div>
      )}

      {/* Services Publics badge for CaptureDoc Services template */}
      {isServices && showTagline && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 shadow-xs hidden sm:inline-block uppercase tracking-wider">
          Services Publics
        </span>
      )}
    </div>
  );
};
