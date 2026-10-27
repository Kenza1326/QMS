import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

interface TrueFalseBadgeProps {
  value: boolean | string | number | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'chip' | 'fun' | 'switch';
  interactive?: boolean;
  onToggle?: (newVal: boolean) => void;
}

export const TrueFalseBadge: React.FC<TrueFalseBadgeProps> = ({
  value,
  trueLabel = 'Oui',
  falseLabel = 'Non',
  size = 'md',
  variant = 'fun',
  interactive = false,
  onToggle,
}) => {
  const isTrue = value === true || value === 'true' || value === 1 || value === '1' || value === 'Oui' || value === 'Vrai';

  const handleClick = (e: React.MouseEvent) => {
    if (interactive && onToggle) {
      e.stopPropagation();
      onToggle(!isTrue);
    }
  };

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2 py-0.5 gap-1.5 font-semibold',
    lg: 'text-sm px-3 py-1 gap-2 font-bold',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  if (variant === 'switch') {
    return (
      <div 
        onClick={handleClick}
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all select-none ${
          interactive ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${
          isTrue 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm shadow-emerald-100' 
            : 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm shadow-rose-100'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${isTrue ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
        <span className="text-xs font-bold uppercase tracking-wider">{isTrue ? trueLabel : falseLabel}</span>
      </div>
    );
  }

  if (variant === 'fun') {
    return (
      <div
        onClick={handleClick}
        className={`inline-flex items-center rounded-xl font-medium transition-all shadow-xs select-none ${sizeClasses[size]} ${
          interactive ? 'cursor-pointer hover:shadow-md hover:scale-[1.03] active:scale-95' : ''
        } ${
          isTrue
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 border border-emerald-400/30'
            : 'bg-gradient-to-r from-slate-100 to-rose-50 text-slate-700 border border-rose-200/80 shadow-slate-200/50'
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-lg ${
            isTrue ? 'bg-white/20 text-white' : 'bg-rose-200/60 text-rose-700'
          } p-0.5`}
        >
          {isTrue ? (
            <Check className={`${iconSizes[size]} stroke-[2.5]`} />
          ) : (
            <X className={`${iconSizes[size]} stroke-[2.5]`} />
          )}
        </div>
        <span className="tracking-wide">
          {isTrue ? trueLabel : falseLabel}
        </span>
        {isTrue && size === 'lg' && <Sparkles className="w-3.5 h-3.5 opacity-80" />}
      </div>
    );
  }

  // standard pill
  return (
    <span
      onClick={handleClick}
      className={`inline-flex items-center rounded-full font-semibold border transition-all ${sizeClasses[size]} ${
        interactive ? 'cursor-pointer hover:opacity-90' : ''
      } ${
        isTrue
          ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
          : 'bg-slate-100 text-slate-600 border-slate-300'
      }`}
    >
      {isTrue ? (
        <Check className={`${iconSizes[size]} text-emerald-700 stroke-[2.5]`} />
      ) : (
        <X className={`${iconSizes[size]} text-slate-500 stroke-[2.5]`} />
      )}
      <span>{isTrue ? trueLabel : falseLabel}</span>
    </span>
  );
};
