import React from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { ViewTabState } from '../types';

interface ViewTabsProps {
  tabs: ViewTabState[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
}

export const ViewTabs: React.FC<ViewTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
}) => {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const canClose = tabs.length > 1;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-semibold transition-all cursor-pointer select-none max-w-[220px] ${
              isActive
                ? 'bg-white text-slate-900 border-t-2 border-x border-[#E60028] border-b-transparent shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isActive ? 'bg-[#E60028]' : 'bg-slate-300'
              }`}
            />
            <span className="truncate">{tab.loading ? `${tab.title}…` : tab.title}</span>
            {tab.total > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                {tab.total}
              </span>
            )}
            {canClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-40 group-hover:opacity-100 hover:bg-rose-100 hover:text-[#E60028] transition-all cursor-pointer"
                title="Fermer cet onglet"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddTab}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer ml-1"
        title="Ouvrir un nouvel onglet de vue"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
