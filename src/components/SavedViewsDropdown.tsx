import React, { useState } from 'react';
import { Bookmark, Star, Trash2, Check, Sparkles } from 'lucide-react';
import { SavedView } from '../types';

interface SavedViewsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  savedViews: SavedView[];
  onLoadView: (view: SavedView) => void;
  onSaveCurrentView: (name: string, isDefault?: boolean) => void;
  onDeleteView: (view: SavedView) => void;
  onSetDefaultView?: (view: SavedView) => void;
}

export const SavedViewsDropdown: React.FC<SavedViewsDropdownProps> = ({
  isOpen,
  onToggle,
  savedViews,
  onLoadView,
  onSaveCurrentView,
  onDeleteView,
  onSetDefaultView,
}) => {
  const [newViewName, setNewViewName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim()) return;
    onSaveCurrentView(newViewName.trim(), makeDefault);
    setNewViewName('');
    setMakeDefault(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
          isOpen
            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Bookmark className="w-3.5 h-3.5" />
        <span>Vues</span>
        {savedViews.length > 0 && (
          <span className="w-4 h-4 rounded-full bg-rose-100 text-[#E60028] text-[10px] flex items-center justify-center font-bold">
            {savedViews.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-92 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-40 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Vues Personnalisées
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {savedViews.length} vue{savedViews.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 mb-4 pr-0.5">
            {savedViews.length > 0 ? (
              savedViews.map((v) => {
                const isDef = Boolean(v.isDefault);
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors group cursor-pointer ${
                      isDef
                        ? 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-50'
                        : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                    }`}
                    onClick={() => onLoadView(v)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isDef ? 'text-amber-500' : 'text-[#E60028]'}`} />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#E60028] truncate">
                        {v.name}
                      </span>
                      {isDef && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9.5px] font-bold rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                          Par défaut
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* SET AS DEFAULT STAR BUTTON */}
                      {onSetDefaultView && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDefaultView(v);
                          }}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            isDef
                              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100'
                              : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-500 hover:bg-amber-50'
                          }`}
                          title={isDef ? 'Vue par défaut actuelle (chargée au démarrage)' : 'Définir comme vue par défaut au démarrage'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isDef ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      )}

                      {/* DELETE BUTTON */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(v);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
                        title="Supprimer cette vue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucune vue personnalisée enregistrée.
              </p>
            )}
          </div>

          <form onSubmit={handleSave} className="pt-3 border-t border-slate-100 space-y-2.5">
            <label className="text-[11px] font-bold text-slate-700 block">
              Enregistrer la configuration active :
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Nom de la vue (ex: Achats urgents)..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E60028]/20"
              />
              <button
                type="submit"
                disabled={!newViewName.trim()}
                className="px-3 py-1.5 bg-[#E60028] hover:bg-[#B4001F] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Sauvegarder
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="rounded border-slate-300 text-[#E60028] focus:ring-[#E60028] w-3.5 h-3.5"
              />
              <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                <Star className={`w-3 h-3 ${makeDefault ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
                Définir comme vue par défaut au démarrage
              </span>
            </label>
          </form>
        </div>
      )}
    </div>
  );
};
