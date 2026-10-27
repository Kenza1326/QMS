import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckSquare,
  Layers,
  ListFilter,
  Hash,
} from 'lucide-react';
import { ColumnDef } from '../types';

export type ExportScope = 'selected' | 'all' | 'filtered';

interface ExportDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  columns: ColumnDef[];
  exportCols: Set<string>;
  onToggleExportCol: (key: string, isChecked: boolean) => void;
  onToggleAllExportCols?: (select: boolean) => void;
  onRunExport: (scope: ExportScope, maxRowsLimit: number) => void;
  loading: boolean;
  loadingMessage?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  isOpen,
  onToggle,
  selectedCount,
  filteredCount,
  totalCount,
  columns,
  exportCols,
  onToggleExportCol,
  onToggleAllExportCols,
  onRunExport,
  loading,
  loadingMessage,
}) => {
  // If user has items selected, default to 'selected', otherwise 'all'
  const [scope, setScope] = useState<ExportScope>('all');
  const [rowLimit, setRowLimit] = useState<number>(() => {
    if (totalCount > 0) return Math.min(totalCount, 60000);
    return 5000;
  });

  // Keep limit clamped when total changes
  useEffect(() => {
    if (totalCount > 0 && rowLimit === 5000) {
      setRowLimit(Math.min(totalCount, 60000));
    }
  }, [totalCount]);

  useEffect(() => {
    if (selectedCount > 0) {
      setScope('selected');
    } else if (scope === 'selected') {
      setScope('all');
    }
  }, [selectedCount]);

  const handleLimitChange = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) {
      setRowLimit(1);
      return;
    }
    const clamped = Math.max(1, Math.min(60000, parsed));
    setRowLimit(clamped);
  };

  const handleExportClick = () => {
    const finalLimit = Math.max(1, Math.min(60000, Number(rowLimit) || 1));
    onRunExport(scope, finalLimit);
  };

  const allColsSelected = columns.length > 0 && exportCols.size === columns.length;

  return (
    <div className="relative">
      <button
        type="button"
        id="btn-export-dropdown"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E60028] hover:bg-[#C8102E] text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
        title="Exporter les tickets au format Excel"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Exporter (.xlsx)</span>
        {selectedCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-white text-[#E60028] font-black text-[10px]">
            {selectedCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* HEADER */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#E60028]" />
              <span>Options d'export Excel</span>
            </span>
          </div>

          {/* EXPORT SCOPE SELECTION */}
          <div className="space-y-2 mb-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
              1. Périmètre de l'export
            </span>

            <div className="space-y-1.5 text-xs">
              {/* OPTION 1: SELECTED ROWS */}
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  scope === 'selected'
                    ? 'border-[#E60028] bg-rose-50/50 shadow-xs'
                    : selectedCount === 0
                    ? 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="selected"
                  checked={scope === 'selected'}
                  disabled={selectedCount === 0}
                  onChange={() => setScope('selected')}
                  className="mt-0.5 text-[#E60028] focus:ring-[#E60028]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-[#E60028]" />
                      <span>Lignes sélectionnées</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[11px] ${
                        selectedCount > 0 ? 'bg-[#E60028] text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {selectedCount} ticket{selectedCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCount > 0
                      ? 'Exporte uniquement les tickets cochés dans la table.'
                      : 'Cochez des cases dans le tableau pour activer cette option.'}
                  </p>
                </div>
              </label>

              {/* OPTION 2: ALL TICKETS VIA KTA SEARCH */}
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'border-[#E60028] bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-0.5 text-[#E60028] focus:ring-[#E60028]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tous les résultats filtrés</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Total : {totalCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Extrait l'ensemble des tickets correspondant aux filtres appliqués.
                  </p>

                  {/* USER LIMIT INPUT */}
                  {scope === 'all' && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-rose-200 space-y-2 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Hash className="w-3 h-3 text-[#E60028]" />
                          <span>Plafond de lignes :</span>
                        </label>
                        <div className="relative w-28">
                          <input
                            type="number"
                            min={1}
                            max={60000}
                            value={rowLimit}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            className="w-full px-2 py-1 text-right text-xs font-mono font-bold border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028]"
                          />
                        </div>
                      </div>

                      {/* QUICK PRESET CHIPS */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-semibold">Raccourcis :</span>
                        {[500, 1000, 5000, 10000, 60000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRowLimit(preset)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                              rowLimit === preset
                                ? 'bg-[#E60028] text-white border-[#E60028]'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {preset === 60000 ? 'Max (60k)' : preset.toLocaleString('fr-FR')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* OPTION 3: CURRENT PAGE ONLY */}
              <label
                className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                  scope === 'filtered'
                    ? 'border-[#E60028] bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === 'filtered'}
                  onChange={() => setScope('filtered')}
                  className="mt-0.5 text-[#E60028] focus:ring-[#E60028]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                      <span>Page actuelle affichée</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {filteredCount} tickets
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* COLUMNS SELECTION */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                2. Colonnes ({exportCols.size}/{columns.length})
              </span>
              {onToggleAllExportCols && (
                <button
                  type="button"
                  onClick={() => onToggleAllExportCols(!allColsSelected)}
                  className="text-[10px] font-bold text-[#E60028] hover:underline cursor-pointer"
                >
                  {allColsSelected ? 'Tout décocher' : 'Tout cocher'}
                </button>
              )}
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-200/50 p-1 rounded-md cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={exportCols.has(col.key)}
                    onChange={(e) => onToggleExportCol(col.key, e.target.checked)}
                    className="rounded border-slate-300 text-[#E60028] focus:ring-[#E60028]"
                  />
                  <span className="truncate">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SUBMIT EXPORT BUTTON */}
          <button
            type="button"
            id="btn-run-export"
            disabled={loading || exportCols.size === 0 || (scope === 'selected' && selectedCount === 0)}
            onClick={handleExportClick}
            className="w-full py-2.5 rounded-xl bg-[#E60028] hover:bg-[#C8102E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{loadingMessage || 'Génération du fichier...'}</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {scope === 'selected'
                    ? `Exporter les ${selectedCount} ligne(s) sélectionnée(s)`
                    : scope === 'all'
                    ? `Exporter tout (${rowLimit} max)`
                    : `Exporter la page (${filteredCount} tickets)`}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
