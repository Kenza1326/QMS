import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripHorizontal,
  CheckSquare,
  Square,
  MinusSquare,
  ShieldAlert,
  Lock,
  FolderOpen,
} from 'lucide-react';
import { ColumnDef, TicketRow } from '../types';
import { STATUS_STYLES } from '../mockData';
import { TrueFalseBadge } from './TrueFalseBadge';
import { FolderDocButton, isFolderIdField, resolveTicketFolderId, openKTADocumentFolder } from './FolderDocButton';

interface TicketTableProps {
  columns: ColumnDef[];
  visibleCols: Set<string>;
  colOrder?: string[];
  colWidths?: Record<string, number>;
  rows: TicketRow[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  sort: Array<{ key: string; dir: 'asc' | 'desc' }>;
  selectedIds?: Set<string>;
  noAllowedFlux?: boolean;
  noAllowedFluxReason?: string;
  onToggleSelectRow?: (id: string) => void;
  onToggleSelectAll?: (selectAll: boolean) => void;
  onClearSelection?: () => void;
  onSortChange: (key: string, isShift: boolean) => void;
  onReorderColumn?: (newOrder: string[]) => void;
  onResizeColumn?: (key: string, newWidth: number) => void;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onOpenTicket: (ticketId: string) => void;
}

export const TicketTable: React.FC<TicketTableProps> = ({
  columns,
  visibleCols,
  colOrder,
  colWidths = {},
  rows,
  total,
  loading,
  page,
  pageSize,
  sort,
  selectedIds = new Set(),
  noAllowedFlux = false,
  noAllowedFluxReason,
  onToggleSelectRow,
  onToggleSelectAll,
  onClearSelection,
  onSortChange,
  onReorderColumn,
  onResizeColumn,
  onPageChange,
  onPageSizeChange,
  onOpenTicket,
}) => {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Column Resizing State
  const resizingColRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Compute active columns with explicit ordering applied
  const activeCols = React.useMemo(() => {
    const colMap = new Map<string, ColumnDef>(columns.map((c) => [c.key, c]));
    const result: ColumnDef[] = [];

    if (colOrder && colOrder.length > 0) {
      colOrder.forEach((key) => {
        if (visibleCols.has(key)) {
          const col = colMap.get(key);
          if (col) {
            result.push(col);
            colMap.delete(key);
          }
        }
      });
    }

    colMap.forEach((col) => {
      if (visibleCols.has(col.key)) {
        result.push(col);
      }
    });

    return result;
  }, [columns, visibleCols, colOrder]);

  // Selection calculations on visible rows
  const visibleRowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const numSelectedOnPage = visibleRowIds.filter((id) => selectedIds.has(id)).length;
  const isAllPageSelected = rows.length > 0 && numSelectedOnPage === rows.length;
  const isIndeterminate = numSelectedOnPage > 0 && numSelectedOnPage < rows.length;

  // Drag-and-drop Reordering Handlers
  const handleHeaderDragStart = (e: React.DragEvent, key: string) => {
    if (isResizing) {
      e.preventDefault();
      return;
    }
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleHeaderDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedKey && draggedKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleHeaderDragLeave = () => {
    setDragOverKey(null);
  };

  const handleHeaderDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedKey || draggedKey === targetKey || !onReorderColumn) {
      setDraggedKey(null);
      setDragOverKey(null);
      return;
    }

    const currentOrder = activeCols.map((c) => c.key);
    const fromIndex = currentOrder.indexOf(draggedKey);
    const toIndex = currentOrder.indexOf(targetKey);

    if (fromIndex > -1 && toIndex > -1) {
      const newOrder = [...currentOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);

      const allColKeys = columns.map((c) => c.key);
      const fullNewOrder = [
        ...newOrder,
        ...allColKeys.filter((k) => !newOrder.includes(k)),
      ];
      onReorderColumn(fullNewOrder);
    }

    setDraggedKey(null);
    setDragOverKey(null);
  };

  const handleHeaderDragEnd = () => {
    setDraggedKey(null);
    setDragOverKey(null);
  };

  // Resize Mouse Events
  const handleResizeStart = (e: React.MouseEvent, key: string, currentWidth: number) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizingColRef.current = {
      key,
      startX: e.clientX,
      startWidth: currentWidth,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizingColRef.current || !onResizeColumn) return;
      const deltaX = e.clientX - resizingColRef.current.startX;
      const newWidth = Math.max(70, resizingColRef.current.startWidth + deltaX);
      onResizeColumn(resizingColRef.current.key, newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        resizingColRef.current = null;
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResizeColumn]);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const fmtAmount = (amount?: number, currency?: string) => {
    if (amount === undefined || amount === null) return '—';
    return (
      amount.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ` ${currency || 'EUR'}`
    );
  };

  const renderCellContent = (ticket: TicketRow, col: ColumnDef) => {
    let val = ticket[col.key];
    if (val === undefined || val === null) {
      val = (ticket as any).advancedFields?.[col.key] ??
            (ticket as any).AdvancedFields?.[col.key] ??
            (ticket as any).metadataJson?.[col.key] ??
            (ticket as any).MetadataJson?.[col.key];
    }

    if (col.key === 'id') {
      return (
        <span className="font-mono font-semibold text-[#0052CC] hover:text-[#E60028] text-[11px] group-hover:underline flex items-center gap-1">
          <span>{ticket.id}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-slate-400" />
        </span>
      );
    }

    if (isFolderIdField(col.key)) {
      const folderVal = val || (col.key === 'IDDossierFacturation' ? ticket.IDDossierFacturation : ticket.IDDossierDA) || resolveTicketFolderId(ticket);
      return <FolderDocButton folderId={folderVal} variant="table" />;
    }

    if (col.key === 'metadataJson' || col.key === 'MetadataJson') {
      const displayJson = typeof val === 'object' ? JSON.stringify(val) : String(val || '—');
      return (
        <span className="font-mono text-[10px] text-slate-600 truncate block max-w-xs" title={displayJson}>
          {displayJson}
        </span>
      );
    }

    if (col.dataType === 'boolean' || typeof val === 'boolean') {
      return (
        <TrueFalseBadge
          value={Boolean(val)}
          variant="fun"
          size="sm"
          trueLabel={col.key === 'estUrgent' ? 'Urgent' : col.key === 'validationDgRequise' ? 'Requise' : 'Oui'}
          falseLabel={col.key === 'estUrgent' ? 'Non' : col.key === 'validationDgRequise' ? 'Non' : 'Non'}
        />
      );
    }

    if (col.key === 'statut') {
      const style = STATUS_STYLES[ticket.statut] || {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        border: 'border-slate-300',
      };
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight ${style.bg} ${style.text} whitespace-nowrap`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          <span>{ticket.statut}</span>
        </span>
      );
    }

    if (col.dataType === 'currency' || col.key === 'montant') {
      return (
        <span className="font-mono text-[10.5px] font-medium text-slate-900 bg-slate-100/80 px-1.5 py-0.5 rounded">
          {fmtAmount(ticket.montant, ticket.devise)}
        </span>
      );
    }

    if (col.dataType === 'date' || ['dateCreation', 'dateModif', 'dateCloture'].includes(col.key)) {
      return <span className="text-slate-600 font-mono text-[10.5px]">{fmtDate(val)}</span>;
    }

    if (col.key === 'objet') {
      return (
        <span className="font-normal text-slate-900 text-[11px] max-w-sm line-clamp-1" title={String(val || '')}>
          {String(val || '—')}
        </span>
      );
    }

    return <span className="text-slate-700 text-[11px] truncate block">{val !== undefined && val !== null ? String(val) : '—'}</span>;
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* SELECTION BAR BANNER (WHEN ROWS ARE SELECTED) */}
      {selectedIds.size > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 px-3 py-1.5 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E60028] animate-pulse" />
            <span className="font-bold text-[#E60028] text-xs">
              {selectedIds.size} ligne{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-rose-700 hidden sm:inline">
              (sur {total} total)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size === 1 && (() => {
              const selId = Array.from(selectedIds)[0];
              const selTicket = rows.find((t) => t.id === selId || t.ticketKey === selId);
              const folderId = selTicket ? resolveTicketFolderId(selTicket) : null;
              if (!folderId) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openKTADocumentFolder(folderId);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#E60028] hover:bg-[#B4001F] text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                  title={`Ouvrir le dossier TotalAgility (FolderID: ${folderId})`}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Ouvrir dossier</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </button>
              );
            })()}
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] font-bold text-rose-700 hover:text-[#E60028] hover:underline cursor-pointer px-1.5 py-0.5"
              >
                Tout désélectionner
              </button>
            )}
          </div>
        </div>
      )}

      {/* SCROLLABLE TABLE WRAPPER - JIRA COMPACT DENSITY & RESIZABLE */}
      <div className="overflow-x-auto min-h-[340px] select-text">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              {/* CHECKBOX SELECTION HEADER */}
              <th className="w-9 px-2 py-1.5 text-center align-middle border-r border-slate-200/50 shrink-0 select-none bg-slate-100/95">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  checked={isAllPageSelected}
                  onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  disabled={loading || rows.length === 0}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#E60028] focus:ring-[#E60028] cursor-pointer disabled:opacity-40"
                  title={isAllPageSelected ? 'Tout désélectionner sur cette page' : 'Sélectionner toutes les lignes de cette page'}
                />
              </th>

              {activeCols.map((col) => {
                const sortIndex = sort.findIndex((s) => s.key === col.key);
                const currentSort = sortIndex > -1 ? sort[sortIndex] : null;
                const isDraggingThis = draggedKey === col.key;
                const isDragOverThis = dragOverKey === col.key;
                const width = colWidths[col.key] || col.width || 140;

                return (
                  <th
                    key={col.key}
                    draggable={!isResizing}
                    onDragStart={(e) => handleHeaderDragStart(e, col.key)}
                    onDragOver={(e) => handleHeaderDragOver(e, col.key)}
                    onDragLeave={handleHeaderDragLeave}
                    onDrop={(e) => handleHeaderDrop(e, col.key)}
                    onDragEnd={handleHeaderDragEnd}
                    style={{ width: `${width}px`, minWidth: '90px' }}
                    onClick={(e) => {
                      if (!isResizing) {
                        onSortChange(col.key, e.shiftKey);
                      }
                    }}
                    className={`relative py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer transition-colors group bg-slate-100/95 ${
                      isDraggingThis
                        ? 'bg-rose-100/70 text-[#E60028] opacity-50'
                        : isDragOverThis
                        ? 'bg-rose-50 border-l-2 border-[#E60028] text-[#E60028]'
                        : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-900'
                    }`}
                    title="Cliquer pour trier, glisser pour réordonner, étirer le bord droit pour redimensionner"
                  >
                    <div className="flex items-center justify-between gap-1 overflow-hidden pr-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <GripHorizontal className="w-2.5 h-2.5 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0 cursor-grab active:cursor-grabbing" />
                        <span className="truncate">{col.label}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-slate-400">
                          {currentSort ? (
                            currentSort.dir === 'asc' ? (
                              <ChevronUp className="w-3 h-3 text-[#E60028] stroke-[2.5]" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-[#E60028] stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-25 group-hover:opacity-80" />
                          )}
                        </span>
                        {sort.length > 1 && sortIndex > -1 && (
                          <span className="text-[9px] font-bold bg-rose-100 text-[#E60028] w-3 h-3 rounded-full flex items-center justify-center">
                            {sortIndex + 1}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RESIZE HANDLE */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col.key, width)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-[#E60028]/40 active:bg-[#E60028] transition-colors flex items-center justify-center z-10 group/handle"
                      title="Redimensionner la colonne"
                    >
                      <div className="w-[1.5px] h-3 bg-slate-300 group-hover/handle:bg-[#E60028] rounded-full" />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={activeCols.length + 1} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-rose-200 border-t-[#E60028] rounded-full animate-spin" />
                    <span className="text-xs font-medium">Chargement des tickets en cours…</span>
                  </div>
                </td>
              </tr>
            ) : noAllowedFlux ? (
              <tr>
                <td colSpan={activeCols.length + 1} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center max-w-lg mx-auto text-slate-700 px-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mb-3.5 text-amber-600 shadow-xs">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      Accès restreint aux flux de processus
                    </h3>
                    <div className="my-2 px-3 py-1.5 bg-slate-100/90 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center gap-2 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <code>{`{"reason": "${noAllowedFluxReason || 'No allowed flux for user groups or filter.'}"}`}</code>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Aucun flux de processus (Achat, Approvisionnement, Facturation) n'est autorisé pour vos groupes d'utilisateurs ou pour les filtres sélectionnés.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Veuillez contacter votre administrateur Kofax TotalAgility pour obtenir les habilitations nécessaires.
                    </p>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={activeCols.length + 1} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto text-slate-500">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Aucun ticket ne correspond aux critères</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Essayez d'élargir la période de dates, d'ajuster les filtres ou de vider la barre de recherche.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((ticket, idx) => {
                const isSelected = selectedIds.has(ticket.id);
                return (
                  <tr
                    key={ticket.id || idx}
                    onClick={() => onOpenTicket(ticket.ticketKey || ticket.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-rose-50/80 hover:bg-rose-100/60 font-medium'
                        : 'hover:bg-slate-50/90'
                    }`}
                  >
                    {/* CHECKBOX CELL */}
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectRow?.(ticket.id);
                      }}
                      className={`w-9 px-2 py-1 text-center align-middle border-r transition-colors cursor-pointer ${
                        isSelected ? 'border-rose-200 bg-rose-100/40' : 'border-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelectRow?.(ticket.id);
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-[#E60028] focus:ring-[#E60028] cursor-pointer"
                      />
                    </td>

                    {activeCols.map((col) => {
                      const width = colWidths[col.key] || col.width || 140;
                      return (
                        <td
                          key={col.key}
                          style={{ width: `${width}px` }}
                          className="py-1 px-2 align-middle overflow-hidden text-ellipsis text-[11px]"
                        >
                          {renderCellContent(ticket, col)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* COMPACT PAGINATION BAR */}
      <div className="bg-slate-50 border-t border-slate-200/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span>Lignes :</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded-md border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-slate-400 font-mono text-[11px]">
            ({from}–{to} / {total})
          </span>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || loading}
            title="Première page"
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            title="Page précédente"
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>

          <span className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-200 rounded-md text-slate-800 font-mono">
            {page} / {maxPage}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= maxPage || loading}
            title="Page suivante"
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
          <button
            onClick={() => onPageChange(maxPage)}
            disabled={page >= maxPage || loading}
            title="Dernière page"
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>
      </div>
    </div>
  );
};
