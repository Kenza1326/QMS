import React, { useState } from 'react';
import { Columns3, ChevronUp, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ColumnDef } from '../types';

interface ColumnPickerDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  columns: ColumnDef[];
  visibleCols: Set<string>;
  colOrder?: string[];
  colWidths?: Record<string, number>;
  onToggleColumn: (key: string, isVisible: boolean) => void;
  onReorderColumn?: (newOrder: string[]) => void;
  onResizeColumn?: (key: string, newWidth: number) => void;
  onResetOrder?: () => void;
}

export const ColumnPickerDropdown: React.FC<ColumnPickerDropdownProps> = ({
  isOpen,
  onToggle,
  columns,
  visibleCols,
  colOrder,
  colWidths = {},
  onToggleColumn,
  onReorderColumn,
  onResizeColumn,
  onResetOrder,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Compute ordered columns
  const orderedColumns = React.useMemo(() => {
    if (!colOrder || colOrder.length === 0) return columns;
    const colMap = new Map<string, ColumnDef>(columns.map((c) => [c.key, c]));
    const result: ColumnDef[] = [];

    // First add columns in colOrder
    colOrder.forEach((key) => {
      const col = colMap.get(key);
      if (col) {
        result.push(col);
        colMap.delete(key);
      }
    });

    // Append remaining columns
    colMap.forEach((col) => {
      result.push(col);
    });

    return result;
  }, [columns, colOrder]);

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if (!onReorderColumn) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedColumns.length) return;

    const newCols = [...orderedColumns];
    const [moved] = newCols.splice(index, 1);
    newCols.splice(targetIndex, 0, moved);
    onReorderColumn(newCols.map((c) => c.key));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !onReorderColumn) {
      setDraggedIndex(null);
      return;
    }
    const newCols = [...orderedColumns];
    const [moved] = newCols.splice(draggedIndex, 1);
    newCols.splice(dropIndex, 0, moved);
    onReorderColumn(newCols.map((c) => c.key));
    setDraggedIndex(null);
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
        <Columns3 className="w-3.5 h-3.5" />
        <span>Colonnes</span>
        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] flex items-center justify-center font-bold">
          {visibleCols.size}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-88 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-40 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Colonnes, Ordre & Tailles
              </span>
              <span className="text-[10px] text-slate-400">
                Glissez ou utilisez les flèches / largeurs
              </span>
            </div>
            {onResetOrder && (
              <button
                type="button"
                onClick={onResetOrder}
                className="text-[11px] font-semibold text-slate-500 hover:text-[#E60028] flex items-center gap-1 transition-colors cursor-pointer"
                title="Rétablir l'ordre et les largeurs par défaut"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Rétablir</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {orderedColumns.map((col, idx) => {
              const isChecked = visibleCols.has(col.key);
              const currentW = colWidths[col.key] || col.width || 140;

              return (
                <div
                  key={col.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`flex flex-col p-2 rounded-xl transition-all select-none ${
                    draggedIndex === idx
                      ? 'bg-rose-50 border border-rose-300 opacity-60'
                      : isChecked
                      ? 'bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/60'
                      : 'bg-white hover:bg-slate-50 border border-dashed border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Up/Down buttons */}
                    <div className="flex flex-col -space-y-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveColumn(idx, 'up')}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer p-0.5"
                        title="Monter la colonne"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedColumns.length - 1}
                        onClick={() => moveColumn(idx, 'down')}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer p-0.5"
                        title="Descendre la colonne"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Toggle Checkbox */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onToggleColumn(col.key, e.target.checked)}
                      className="rounded border-slate-300 text-[#E60028] focus:ring-[#E60028] cursor-pointer"
                    />

                    {/* Label */}
                    <span
                      className={`text-xs font-medium flex-1 truncate ${
                        isChecked ? 'text-slate-800 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {col.label}
                    </span>

                    {/* Quick Width Selection */}
                    {isChecked && onResizeColumn && (
                      <select
                        value={currentW}
                        onChange={(e) => onResizeColumn(col.key, Number(e.target.value))}
                        className="text-[10px] font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:border-[#E60028]"
                        title="Changer la largeur de cette colonne"
                      >
                        <option value={100}>Étroit (100px)</option>
                        <option value={140}>Normal (140px)</option>
                        <option value={200}>Large (200px)</option>
                        <option value={300}>Très large (300px)</option>
                      </select>
                    )}

                    {/* Data Type Badge */}
                    {col.dataType && !isChecked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                        {col.dataType}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
