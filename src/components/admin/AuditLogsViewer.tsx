import {formatWaitEstimate,waitEstimateBasisLabel} from '../../services/queueEstimate';
import {normalizeCustomerName} from '../../utils/queueValidation';
import {notifications} from '../../services/notificationService';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  Check,
  Building2,
  Sparkles,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Phone,
  Timer,
  Hash,
  X,
} from 'lucide-react';
import { queueStore } from '../../services/queueStore';
import { QueueLogEntry, LogLevel, LogCategory, TicketPriority } from '../../types/queueTypes';

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<QueueLogEntry[]>(queueStore.getState().logs || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [selectedLogForModal, setSelectedLogForModal] = useState<QueueLogEntry | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const unsub = queueStore.subscribe((state) => {
      setLogs(state.logs || []);
    });
    return unsub;
  }, []);

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'all' && log.level !== filterLevel) return false;
      if (filterCategory !== 'all' && log.category !== filterCategory) return false;
      if (filterAction !== 'all' && log.action !== filterAction) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = (log.message || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchTicket = (log.ticketNumber || '').toLowerCase().includes(q);
        const matchCounter = (log.counterName || '').toLowerCase().includes(q);
        const matchActorName = (log.actor?.name || '').toLowerCase().includes(q);
        const matchActorUsername = (log.actor?.username || '').toLowerCase().includes(q);
        const matchOp = (log.operationName || '').toLowerCase().includes(q);
        const matchCustomer = (log.customerName || '').toLowerCase().includes(q);
        if (
          !matchMsg &&
          !matchAction &&
          !matchTicket &&
          !matchCounter &&
          !matchActorName &&
          !matchActorUsername &&
          !matchOp &&
          !matchCustomer
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, filterLevel, filterCategory, filterAction, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage]);

  const stats = useMemo(() => {
    const infoCount = logs.filter((l) => l.level === 'info').length;
    const successCount = logs.filter((l) => l.level === 'success').length;
    const warnCount = logs.filter((l) => l.level === 'warn').length;
    const errorCount = logs.filter((l) => l.level === 'error').length;

    const ticketsCreated = logs.filter((l) => l.action === 'TICKET_CREATED').length;
    const ticketsCalled = logs.filter((l) => l.action === 'TICKET_CALLED').length;
    const ticketsCompleted = logs.filter((l) => l.action === 'TICKET_COMPLETED').length;

    const completedWithDuration = logs.filter((l) => l.serviceDurationMinutes !== undefined && l.serviceDurationMinutes > 0);
    const avgDuration = completedWithDuration.length > 0
      ? Math.round((completedWithDuration.reduce((acc, l) => acc + (l.serviceDurationMinutes || 0), 0) / completedWithDuration.length) * 10) / 10
      : 0;

    const calledWithWait = logs.filter((l) => l.realWaitMinutes !== undefined && l.realWaitMinutes > 0);
    const avgWait = calledWithWait.length > 0
      ? Math.round((calledWithWait.reduce((acc, l) => acc + (l.realWaitMinutes || 0), 0) / calledWithWait.length) * 10) / 10
      : 0;

    return {
      total: logs.length,
      info: infoCount,
      success: successCount,
      warn: warnCount,
      error: errorCount,
      ticketsCreated,
      ticketsCalled,
      ticketsCompleted,
      avgDuration,
      avgWait,
    };
  }, [logs]);

  const handleExportCsv = () => {
    const csvData = queueStore.exportLogs('csv');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `journal_audit_exhaustif_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const jsonData = queueStore.exportLogs('json');
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `journal_audit_exhaustif_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearLogs = async () => {
    if (await notifications.confirmAction({title: 'Effacer les journaux ?', message: 'Les entrées du journal de cette agence seront supprimées.', actionLabel: 'Effacer', destructive: true})) {
      try { await queueStore.clearLogs(); } catch(error) { notifications.error(error instanceof Error ? error.message : 'Suppression impossible.'); }
    }
  };

  const handleCopyJson = (log: QueueLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const levelBadge = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Succès
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Alerte
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Erreur
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" />
            Info
          </span>
        );
    }
  };

  const priorityBadge = (priority?: TicketPriority) => {
    if (!priority) return null;
    switch (priority) {
      case 'pmr':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">PMR</span>;
      case 'vip':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">VIP</span>;
      default:
        return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">STD</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & EXPORT TOOLBAR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Journal d'Audit Exhaustif & Traçabilité des Actions
            </h2>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              {stats.total} Événements Enregistrés
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            Traçabilité intégrale : utilisateur authentifié (<code className="text-indigo-600 font-mono">@username</code>), horodatage précis, guichet, opération bancaire, attente estimée prédite, attente réelle constatée et durée effective d'intervention.
          </p>
        </div>

        {/* ACTION BUTTONS: EXPORT & CLEAR */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="Exporter l'ensemble des colonnes en CSV compatible Microsoft Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV (Complet)</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="Exporter tous les logs bruts en JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
            title="Purger l'historique des logs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Purger</span>
          </button>
        </div>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Événements</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          <span className="text-[10px] text-slate-500 font-medium">Flux système complet</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Tickets Émis</span>
          <div className="text-xl font-black text-blue-700 mt-0.5">{stats.ticketsCreated}</div>
          <span className="text-[10px] text-slate-500 font-medium">Borne & E-Réservation</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Prises en Charge</span>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.ticketsCalled}</div>
          <span className="text-[10px] text-slate-500 font-medium">{stats.ticketsCompleted} clôturés avec succès</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Attente Réelle Moyenne</span>
          <div className="text-xl font-black text-indigo-700 mt-0.5">{stats.avgWait} <span className="text-xs font-bold">min</span></div>
          <span className="text-[10px] text-slate-500 font-medium">Temps avant guichet</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600">Durée Moy. Traitement</span>
          <div className="text-xl font-black text-violet-700 mt-0.5">{stats.avgDuration} <span className="text-xs font-bold">min</span></div>
          <span className="text-[10px] text-slate-500 font-medium">Temps passé au guichet</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Alertes & Erreurs</span>
          <div className="text-xl font-black text-amber-700 mt-0.5">{stats.warn + stats.error}</div>
          <span className="text-[10px] text-slate-500 font-medium">{stats.warn} warn · {stats.error} err</span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher par message, @username, ticket (C-021), guichet, client, opération..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Tous les niveaux</option>
            <option value="info">Info</option>
            <option value="success">Succès</option>
            <option value="warn">Avertissement</option>
            <option value="error">Erreur</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Toutes les catégories</option>
            <option value="ticket">Ticket</option>
            <option value="counter">Guichet</option>
            <option value="auth">Authentification</option>
            <option value="kiosk">Borne</option>
            <option value="client">Client Mobile</option>
            <option value="rules">Règles Métier</option>
            <option value="admin">Administration</option>
            <option value="system">Système</option>
          </select>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[180px]"
          >
            <option value="all">Toutes les actions</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* COMPREHENSIVE AUDIT LOG TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Date / Heure</th>
                <th className="py-3 px-2">Niveau</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Utilisateur / Acteur</th>
                <th className="py-3 px-3">Ticket / Client</th>
                <th className="py-3 px-3">Opération Demandée</th>
                <th className="py-3 px-3">Poste Guichet</th>
                <th className="py-3 px-3 text-center">Attente estimée</th>
                <th className="py-3 px-3 text-center">Attente réelle</th>
                <th className="py-3 px-2 text-center">Durée</th>
                <th className="py-3 px-2 text-right">Inspecter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">Aucun événement ne correspond à vos filtres</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.timestamp);
                  const isPositiveDelta = log.waitDeltaMinutes !== undefined && log.waitDeltaMinutes > 0;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setSelectedLogForModal(log)}>
                        {/* TIMESTAMP */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono text-[11px] font-bold text-slate-800">
                            {dateObj.toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </div>
                        </td>

                        {/* LEVEL */}
                        <td className="py-3 px-2 whitespace-nowrap">
                          {levelBadge(log.level)}
                        </td>

                        {/* ACTION */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-[11px] text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {log.action}
                          </span>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5 capitalize">
                            {log.category}
                          </div>
                        </td>

                        {/* USER / ACTOR (AUTHENTICATED) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="block max-w-[160px] truncate font-bold text-slate-900">{normalizeCustomerName(log.actor?.name, 'Système')}</span>
                            {log.actor?.username && (
                              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-100">
                                @{log.actor.username}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {log.actor?.roleLabel || log.actor?.role || 'système'}
                          </div>
                        </td>

                        {/* TICKET / CLIENT */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.ticketNumber ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-slate-900 bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                  {log.ticketNumber}
                                </span>
                                {priorityBadge(log.priority)}
                              </div>
                              {log.customerName && (
                                <div className="text-[10px] text-slate-600 font-medium truncate max-w-[120px]">
                                  {normalizeCustomerName(log.customerName)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* OPERATION */}
                        <td className="py-3 px-3 max-w-[180px]">
                          {log.operationName ? (
                            <div>
                              <p className="font-semibold text-slate-800 truncate" title={log.operationName}>
                                {log.operationName}
                              </p>
                              {log.categoryName && (
                                <span className="text-[10px] text-slate-400">{log.categoryName}</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-600 line-clamp-1 [overflow-wrap:anywhere]" title={log.message}>
                              {log.message}
                            </p>
                          )}
                        </td>

                        {/* GUICHET */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.counterName ? (
                            <div>
                              <div className="font-bold text-slate-800 text-[11px]">
                                {log.counterName}
                              </div>
                              {log.agentName && log.agentName !== log.actor?.name && (
                                <div className="text-[10px] text-slate-400">Agent: {log.agentName}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Immutable estimate saved at issuance or check-in. */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="font-mono text-[11px] font-bold text-indigo-700">{formatWaitEstimate(log.predictedWaitMinutes)}</div>
                          {log.estimateBasis && <div className="mt-0.5 text-[9px] text-slate-500">{waitEstimateBasisLabel(log.estimateBasis)}</div>}
                          {log.estimateComputedAt && <time dateTime={log.estimateComputedAt} className="mt-0.5 block text-[9px] font-mono text-slate-400">{new Date(log.estimateComputedAt).toLocaleTimeString('fr-FR')}</time>}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="font-mono text-[11px] font-bold text-slate-800">{log.realWaitMinutes !== undefined ? `${log.realWaitMinutes} min` : '—'}</div>
                          {log.waitDeltaMinutes !== undefined && log.waitDeltaMinutes !== 0 && (
                            <span className={`text-[9px] font-bold px-1 rounded ${isPositiveDelta ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'}`}>
                              {isPositiveDelta ? `+${log.waitDeltaMinutes} min` : `${log.waitDeltaMinutes} min`}
                            </span>
                          )}
                        </td>

                        {/* DURATION */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {log.serviceDurationMinutes !== undefined ? (
                            <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                              {log.serviceDurationMinutes} min
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* INSPECT BUTTON */}
                        <td className="py-3 px-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedLogForModal(log)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Inspecter toutes les métadonnées de cet événement"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong> ({filteredLogs.length} événements filtrés)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50"
              >
                Précédent
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED INSPECTION MODAL (BLOODY EVERYTHING INSPECTOR) */}
      {selectedLogForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* MODAL HEADER */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Détails Complets de l'Événement
                    </h3>
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {selectedLogForModal.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID: {selectedLogForModal.id} · {selectedLogForModal.timestamp}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogForModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 space-y-6">
              {/* MESSAGE BANNER */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block mb-1">
                  Message Enregistré :
                </span>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  {selectedLogForModal.message}
                </p>
              </div>

              {/* 4 CORE SECTIONS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. ACTOR & AUTHENTICATION */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Acteur & Authentification</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nom complet :</span>
                      <span className="font-bold text-slate-900">{selectedLogForModal.actor?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Identifiant (@username) :</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {selectedLogForModal.actor?.username ? `@${selectedLogForModal.actor.username}` : 'Non spécifié'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rôle :</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedLogForModal.actor?.roleLabel || selectedLogForModal.actor?.role}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ID Acteur :</span>
                      <span className="font-mono text-[10px] text-slate-500">{selectedLogForModal.actor?.id}</span>
                    </div>
                  </div>
                </div>

                {/* 2. GUICHET & POSTE */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Guichet & Opérateur</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nom du Guichet :</span>
                      <span className="font-bold text-slate-900">{selectedLogForModal.counterName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">N° de Guichet :</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedLogForModal.counterNumber ? `Guichet ${selectedLogForModal.counterNumber}` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Agent en Poste :</span>
                      <span className="font-semibold text-slate-800">{selectedLogForModal.agentName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ID Guichet :</span>
                      <span className="font-mono text-[10px] text-slate-500">{selectedLogForModal.counterId || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. TICKET & CLIENT */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Hash className="w-4 h-4 text-amber-600" />
                    <span>Ticket & Client</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">N° de Ticket :</span>
                      <span className="font-mono font-black text-sm text-slate-900">
                        {selectedLogForModal.ticketNumber || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Opération :</span>
                      <span className="font-semibold text-slate-900 text-right">{selectedLogForModal.operationName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Catégorie :</span>
                      <span className="font-semibold text-slate-800">{selectedLogForModal.categoryName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Client :</span>
                      <span className="min-w-0 font-bold text-slate-900 [overflow-wrap:anywhere]">{normalizeCustomerName(selectedLogForModal.customerName, '-')}</span>
                    </div>
                    {selectedLogForModal.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Téléphone :</span>
                        <span className="font-mono text-slate-800">{selectedLogForModal.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. PERFORMANCE & TIMING METRICS */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Timer className="w-4 h-4 text-emerald-600" />
                    <span>Attente & Performance Métier</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Attente estimée enregistrée :</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatWaitEstimate(selectedLogForModal.predictedWaitMinutes)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Calculée le :</span>
                      <span className="text-right font-mono text-[10px]">{selectedLogForModal.estimateComputedAt ? new Date(selectedLogForModal.estimateComputedAt).toLocaleString('fr-FR') : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Contexte du calcul :</span>
                      <span className="text-right font-semibold">{waitEstimateBasisLabel(selectedLogForModal.estimateBasis)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Personnes Devant :</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedLogForModal.peopleAhead !== undefined ? selectedLogForModal.peopleAhead : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Attente Réelle Constatée :</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {selectedLogForModal.realWaitMinutes !== undefined ? `${selectedLogForModal.realWaitMinutes} min` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Écart SLA (Réel - Prédit) :</span>
                      <span className={`font-mono font-black ${
                        selectedLogForModal.waitDeltaMinutes && selectedLogForModal.waitDeltaMinutes > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}>
                        {selectedLogForModal.waitDeltaMinutes !== undefined
                          ? (selectedLogForModal.waitDeltaMinutes > 0 ? `+${selectedLogForModal.waitDeltaMinutes} min` : `${selectedLogForModal.waitDeltaMinutes} min`)
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Durée Effective de Traitement :</span>
                      <span className="font-mono font-black text-emerald-600">
                        {selectedLogForModal.serviceDurationMinutes !== undefined ? `${selectedLogForModal.serviceDurationMinutes} min` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMESTAMPS TIMELINE */}
              {(selectedLogForModal.ticketCreatedAt ||
                selectedLogForModal.ticketCalledAt ||
                selectedLogForModal.ticketServiceStartedAt ||
                selectedLogForModal.ticketCompletedAt) && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Cycle de Vie Horodaté du Ticket :
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {selectedLogForModal.ticketCreatedAt && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">1. Émis le</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {new Date(selectedLogForModal.ticketCreatedAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    )}
                    {selectedLogForModal.ticketCalledAt && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">2. Appelé le</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {new Date(selectedLogForModal.ticketCalledAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    )}
                    {selectedLogForModal.ticketServiceStartedAt && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">3. Service Débuté</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {new Date(selectedLogForModal.ticketServiceStartedAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    )}
                    {selectedLogForModal.ticketCompletedAt && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">4. Clôturé le</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {new Date(selectedLogForModal.ticketCompletedAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RAW JSON INSPECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Structure Brute des Données JSON :
                  </span>
                  <button
                    onClick={() => handleCopyJson(selectedLogForModal)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === selectedLogForModal.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto shadow-inner max-h-48">
                  <pre>{JSON.stringify(selectedLogForModal, null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/70">
              <button
                onClick={() => setSelectedLogForModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
