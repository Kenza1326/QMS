import React, { useState } from 'react';

interface QrCodeViewProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
  onClick?: () => void;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 140,
  className = '',
  fgColor = '#000000',
  bgColor = '#FFFFFF',
  onClick,
}) => {
  const [hasImageError, setHasImageError] = useState(false);

  // Standard ISO compliant QR code API endpoint for camera scanners
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${Math.round(
    size * 2
  )}x${Math.round(size * 2)}&data=${encodeURIComponent(value)}&margin=1`;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    } else if (typeof window !== 'undefined') {
      window.open(value, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      title="Cliquer pour ouvrir le lien sur ordinateur"
      className={`inline-flex flex-col items-center justify-center p-2 rounded-2xl bg-white shadow-xs border border-slate-200 hover:border-blue-400 cursor-pointer transition-all hover:scale-[1.02] group ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {!hasImageError ? (
        <img
          src={qrApiUrl}
          alt={`QR Code: ${value}`}
          width={size}
          height={size}
          onError={() => setHasImageError(true)}
          className="rounded-lg object-contain"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 rounded-lg text-center p-2">
          <span className="text-[10px] font-bold text-slate-700">QR Code Link</span>
          <span className="text-[9px] text-blue-600 underline font-mono truncate max-w-full mt-1">
            {value}
          </span>
        </div>
      )}
    </div>
  );
};
