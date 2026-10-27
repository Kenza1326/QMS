import React, { useState } from 'react';
import {
  Filter,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  User,
  Layers,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Hash,
  Building2,
  Briefcase,
  FolderGit2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { ColumnDef } from '../types';
import { FLUX_DEFINITIONS } from '../mockData';
import { SearchableTagSelector } from './SearchableTagSelector';

interface SidebarFiltersProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  ticketKey: string;
  fluxSelection: Set<string>;
  statusSelection: Set<string>;
  reporterResourceId: string;
  assigneeResourceId: string;
  departement: string;
  service: string;
  division: string;
  projet: string;
  fluxList?: Array<{ FluxLabel?: string; Name?: string }>;
  hasNoAllowedFlux?: boolean;
  dateField: string;
  dateStart: string;
  dateEnd: string;
  fieldFilters: Array<{ field: string; value: string }>;
  availableColumns: ColumnDef[];
  statusList: string[];
  onTicketKeyChange: (key: string) => void;
  onFluxToggle: (flux: string, isSelected: boolean) => void;
  onStatusToggle: (status: string, isSelected: boolean) => void;
  onReporterChange: (reporter: string) => void;
  onAssigneeChange: (assignee: string) => void;
  onDepartementChange: (dep: string) => void;
  onServiceChange: (srv: string) => void;
  onDivisionChange: (div: string) => void;
  onProjetChange: (prj: string) => void;
  onDateFieldChange: (field: string) => void;
  onDateStartChange: (date: string) => void;
  onDateEndChange: (date: string) => void;
  onFieldFilterChange: (index: number, field: string, value: string) => void;
  onAddFieldFilter: () => void;
  onRemoveFieldFilter: (index: number) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  ticketKey,
  fluxSelection,
  statusSelection,
  reporterResourceId,
  assigneeResourceId,
  departement,
  service,
  division,
  projet,
  fluxList,
  hasNoAllowedFlux = false,
  dateField,
  dateStart,
  dateEnd,
  fieldFilters,
  availableColumns,
  statusList,
  onTicketKeyChange,
  onFluxToggle,
  onStatusToggle,
  onReporterChange,
  onAssigneeChange,
  onDepartementChange,
  onServiceChange,
  onDivisionChange,
  onProjetChange,
  onDateFieldChange,
  onDateStartChange,
  onDateEndChange,
  onFieldFilterChange,
  onAddFieldFilter,
  onRemoveFieldFilter,
  onApplyFilters,
  onResetFilters,
}) => {
  const [showOrgSection, setShowOrgSection] = useState(true);
  const [showActorsSection, setShowActorsSection] = useState(true);

  const allFlux = hasNoAllowedFlux || (fluxList && fluxList.length === 0)
    ? []
    : fluxList && fluxList.length > 0
    ? fluxList.map((f) => f.FluxLabel || f.Name || '').filter(Boolean)
    : FLUX_DEFINITIONS.map((f) => f.FluxLabel);

  const activeFiltersCount =
    (ticketKey ? 1 : 0) +
    fluxSelection.size +
    statusSelection.size +
    (reporterResourceId ? 1 : 0) +
    (assigneeResourceId ? 1 : 0) +
    (departement ? 1 : 0) +
    (service ? 1 : 0) +
    (division ? 1 : 0) +
    (projet ? 1 : 0) +
    (dateStart || dateEnd ? 1 : 0) +
    fieldFilters.filter((f) => f.field && f.value).length;

  // COLLAPSED VIEW (COMPACT VERTICAL BAR)
  if (isCollapsed) {
    return (
      <aside
        id="sidebar-filters-collapsed"
        className="w-12 shrink-0 bg-white border border-slate-200/90 rounded-xl shadow-xs p-2 flex flex-col items-center gap-4 h-fit select-none transition-all duration-200 lg:sticky lg:top-16 z-10 self-start"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-[#E60028] hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          title="Déplier le panneau de filtres"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {activeFiltersCount > 0 && (
          <span
            className="w-5 h-5 rounded-full bg-[#E60028] text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
            title={`${activeFiltersCount} filtre(s) actif(s)`}
          >
            {activeFiltersCount}
          </span>
        )}

        <div
          onClick={onToggleCollapse}
          className="writing-vertical-rl flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-500 hover:text-slate-900 uppercase cursor-pointer py-2"
          style={{ writingMode: 'vertical-rl' }}
          title="Cliquer pour afficher les filtres"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 rotate-90 text-[#E60028]" />
          <span>Filtres</span>
        </div>
      </aside>
    );
  }

  // EXPANDED VIEW (JIRA COMPACT DENSITY)
  return (
    <aside
      id="sidebar-filters-expanded"
      className="w-full lg:w-72 xl:w-80 bg-white border border-slate-200/90 rounded-xl shadow-xs p-3.5 flex flex-col gap-3.5 shrink-0 transition-all duration-200 lg:sticky lg:top-16 z-10 self-start max-h-[calc(100vh-4.8rem)] overflow-y-auto"
    >
      {/* HEADER WITH COLLAPSE & CLEAR BUTTONS */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs tracking-tight">
          <Filter className="w-3.5 h-3.5 text-[#E60028]" />
          <span>Filtres de recherche</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-[#E60028] text-[10px] font-bold">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onResetFilters}
            title="Réinitialiser tous les filtres"
            className="px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-[#E60028] hover:bg-slate-50 rounded flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Effacer</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Replier le panneau de filtres"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1. CLÉ DE TICKET (TicketKey) */}
      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Hash className="w-3 h-3 text-[#E60028]" />
          <span>N° / Clé Ticket</span>
        </label>
        <input
          type="text"
          value={ticketKey}
          onChange={(e) => onTicketKeyChange(e.target.value)}
          placeholder="Ex: PR-2024-001, ACH-..."
          className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028]"
        />
      </div>

      {/* 2. TYPE DE DEMANDE (TicketType) */}
      {hasNoAllowedFlux || allFlux.length === 0 ? (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Type de demande</span>
          </label>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 flex items-start gap-2 shadow-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-snug">
              <span className="font-semibold block text-amber-900">Aucun flux autorisé</span>
              Vos groupes d'utilisateurs ne disposent pas de droits sur les flux de processus.
            </div>
          </div>
        </div>
      ) : (
        <SearchableTagSelector
          label="Type de demande"
          placeholder="Filtrer les types…"
          options={allFlux}
          selectedSet={fluxSelection}
          onToggle={onFluxToggle}
          icon={<Layers className="w-3 h-3 text-[#E60028]" />}
        />
      )}

      {/* 3. STATUT DU TICKET (Status) */}
      <SearchableTagSelector
        label="Statut du ticket"
        placeholder="Filtrer les statuts…"
        options={statusList}
        selectedSet={statusSelection}
        onToggle={onStatusToggle}
        icon={<Tag className="w-3 h-3 text-rose-600" />}
      />

      {/* 4. ACTEURS (ReporterResourceId & AssigneeResourceId) */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowActorsSection((prev) => !prev)}
          className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-emerald-600" />
            <span>Demandeur & Assigné</span>
            {(reporterResourceId || assigneeResourceId) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60028]" />
            )}
          </div>
          {showActorsSection ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
        </button>

        {showActorsSection && (
          <div className="space-y-2 pt-1">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Demandeur (Reporter)</span>
              <input
                type="text"
                value={reporterResourceId}
                onChange={(e) => onReporterChange(e.target.value)}
                placeholder="ID ou nom du créateur…"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Assigné à (Assignee)</span>
              <input
                type="text"
                value={assigneeResourceId}
                onChange={(e) => onAssigneeChange(e.target.value)}
                placeholder="ID ou nom du responsable…"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. ORGANISATION (Departement, Service, Division, Projet) */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowOrgSection((prev) => !prev)}
          className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-indigo-600" />
            <span>Organisation & Projet</span>
            {(departement || service || division || projet) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60028]" />
            )}
          </div>
          {showOrgSection ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
        </button>

        {showOrgSection && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Département</span>
              <input
                type="text"
                value={departement}
                onChange={(e) => onDepartementChange(e.target.value)}
                placeholder="Ex: IT, Finance…"
                className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Service</span>
              <input
                type="text"
                value={service}
                onChange={(e) => onServiceChange(e.target.value)}
                placeholder="Ex: Achat…"
                className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Division</span>
              <input
                type="text"
                value={division}
                onChange={(e) => onDivisionChange(e.target.value)}
                placeholder="Ex: Ops…"
                className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5">Projet</span>
              <input
                type="text"
                value={projet}
                onChange={(e) => onProjetChange(e.target.value)}
                placeholder="Ex: Refonte…"
                className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. FILTRE PAR DATE (CreatedAt / UpdatedAt) */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-blue-600" />
          <span>Période & Date</span>
        </label>
        <select
          value={dateField}
          onChange={(e) => onDateFieldChange(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028]"
        >
          <option value="CreatedAt">Date de création (CreatedAt)</option>
          <option value="UpdatedAt">Dernière modification (UpdatedAt)</option>
        </select>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">Du</span>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => onDateStartChange(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">Au</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => onDateEndChange(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E60028]"
            />
          </div>
        </div>
      </div>

      {/* 7. FILTRES ADDITIONNELS PAR CHAMP */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Champs personnalisés
        </label>

        {availableColumns.length === 0 ? (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
            <p className="text-[11px] text-slate-500">
              Sélectionnez un type de demande pour activer les champs spécifiques.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {fieldFilters.map((f, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select
                  value={f.field}
                  onChange={(e) => onFieldFilterChange(idx, e.target.value, f.value)}
                  className="w-1/2 px-1.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-[#E60028]"
                >
                  <option value="">— Champ —</option>
                  {availableColumns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => onFieldFilterChange(idx, f.field, e.target.value)}
                  placeholder="Valeur…"
                  className="w-1/2 px-1.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-[#E60028]"
                />
                {fieldFilters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveFieldFilter(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                    title="Supprimer ce filtre"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={onAddFieldFilter}
              className="w-full py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Ajouter un filtre</span>
            </button>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="pt-2 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          onClick={onResetFilters}
          className="w-1/2 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
        >
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={onApplyFilters}
          className="w-1/2 py-1.5 rounded-lg bg-[#E60028] hover:bg-[#B4001F] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
        >
          Appliquer
        </button>
      </div>
    </aside>
  );
};
