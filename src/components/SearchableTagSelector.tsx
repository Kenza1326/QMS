import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';

interface SearchableTagSelectorProps {
  label: string;
  placeholder?: string;
  options: string[];
  selectedSet: Set<string>;
  onToggle: (option: string, selected: boolean) => void;
  icon?: React.ReactNode;
}

export const SearchableTagSelector: React.FC<SearchableTagSelectorProps> = ({
  label,
  placeholder = 'Rechercher…',
  options,
  selectedSet,
  onToggle,
  icon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedList = Array.from(selectedSet);
  const availableOptions = options.filter(
    (opt) =>
      !selectedSet.has(opt) &&
      opt.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </label>
        {selectedList.length > 0 && (
          <span className="text-[10px] font-bold text-rose-600">
            {selectedList.length} actif{selectedList.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Selected Pills */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
          {selectedList.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-[#E60028] border border-rose-200"
            >
              <span className="truncate max-w-[180px]">{item}</span>
              <button
                type="button"
                onClick={() => onToggle(item, false)}
                className="p-0.5 hover:bg-rose-200/60 rounded transition-colors cursor-pointer"
                title="Retirer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input with dropdown */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-7 pr-6 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028]"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-0.5 max-h-44 overflow-y-auto z-30">
            {availableOptions.length === 0 ? (
              <div className="px-2.5 py-1.5 text-[11px] text-slate-400 text-center">
                {options.length === selectedSet.size
                  ? 'Tous les éléments sont sélectionnés'
                  : 'Aucun résultat'}
              </div>
            ) : (
              availableOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onToggle(opt, true);
                    setSearchTerm('');
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-[#E60028] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="truncate">{opt}</span>
                  <Check className="w-3 h-3 text-transparent group-hover:text-[#E60028]" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
