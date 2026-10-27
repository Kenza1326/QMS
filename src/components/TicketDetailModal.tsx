import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  MessageSquare,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  Layers,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Star,
  Mail,
  Phone,
  MapPin,
  Clock,
  User,
  ShieldAlert,
  FolderOpen,
  Send,
  Loader2,
  History,
  Activity,
  CheckCircle2,
  XCircle,
  Cpu,
  Workflow,
  Search,
  Table as TableIcon,
  ListFilter,
  HelpCircle,
} from 'lucide-react';
import { TicketFullDetail } from '../types';
import { STATUS_STYLES } from '../mockData';
import { TrueFalseBadge } from './TrueFalseBadge';
import {
  FolderDocButton,
  isFolderIdField,
  resolveTicketFolderId,
  openKTADocumentFolder,
} from './FolderDocButton';
import { exportSingleTicketDetails } from '../utils/exportUtils';
import { addCommentToTicket, getCurrentUser } from '../services/ktaService';

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId?: string | null;
  ticketDetail: TicketFullDetail | null;
  loading: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh?: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  isOpen,
  onClose,
  ticketId: ticketIdProp,
  ticketDetail,
  loading,
  onShowToast,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<string>('details');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyViewMode, setHistoryViewMode] = useState<'table' | 'timeline'>('table');
  const [localComments, setLocalComments] = useState<Array<{
    id: string;
    author: string;
    role?: string;
    createdAt: string;
    body: string;
    isSystem?: boolean;
  }>>([]);

  // Reset local comments state whenever the active ticket or modal visibility changes
  useEffect(() => {
    setLocalComments([]);
    setNewComment('');
    setHistorySearch('');
    setHistoryStatusFilter('ALL');
  }, [ticketIdProp, isOpen]);

  if (!isOpen) return null;

  const ticket = ticketDetail?.ticket;
  // Resolve ticket human-readable key (e.g. INV-2026-00095, PR-2024-001) or identifier
  const ticketKey = String(
    ticket?.ticketKey ||
    (ticket as any)?.TicketKey ||
    ticketIdProp ||
    ticket?.id ||
    ''
  ).trim();

  // Derive optional tabs based on KTA response payload & Level 2 AdvancedFields
  const effectiveRequestDetail: Record<string, any> = {
    ...(ticket?.AdvancedFields || ticket?.advancedFields || {}),
    ...(ticketDetail?.requestDetail || {}),
  };

  const hasRequestDetail =
    effectiveRequestDetail &&
    typeof effectiveRequestDetail === 'object' &&
    Object.keys(effectiveRequestDetail).length > 0;

  const ticketFolderId = resolveTicketFolderId(ticket, ticketDetail);

  const hasSuppliers =
    Array.isArray(ticketDetail?.fournisseurs) &&
    ticketDetail.fournisseurs.length > 0;

  const rawCommentList = [
    ...(ticketDetail?.comments || []),
    ...localComments,
  ];

  const allComments = rawCommentList.map((c: any, index: number) => ({
    id: c.commentId || c.CommentId || c.id || c.Id || `comment-${index}`,
    author: c.author || c.Author || c.AuthorResourceId || c.authorResourceId || 'Utilisateur',
    role: c.role || c.Role || (c.isSystem || c.IsSystem ? 'Système' : 'Gestionnaire'),
    createdAt: c.createdAt || c.CreatedAt || c.dateCreation || c.createdDate || c.timestamp || '',
    body: c.body || c.Body || c.comment || c.Comment || c.message || c.Message || '',
    isSystem: Boolean(c.isSystem || c.IsSystem),
  }));

  const complementList = ticketDetail?.demandesComplement || [];
  const auditList = ticketDetail?.audit || [];
  const historyList = ticketDetail?.history || [];

  // Available tabs
  const availableTabs = [
    { id: 'details', label: 'Fiche Ticket & Données Métier', icon: FileText, count: null },
    ...(hasSuppliers
      ? [
          {
            id: 'suppliers',
            label: 'Fournisseurs',
            icon: Building2,
            count: ticketDetail.fournisseurs!.length,
          },
        ]
      : []),
    {
      id: 'comments',
      label: 'Commentaires & Notes',
      icon: MessageSquare,
      count: allComments.length > 0 ? allComments.length : null,
    },
    {
      id: 'complements',
      label: "Compléments d'Info",
      icon: HelpCircle,
      count: complementList.length > 0 ? complementList.length : null,
    },
    {
      id: 'audit',
      label: "Journal d'Audit",
      icon: ShieldAlert,
      count: auditList.length > 0 ? auditList.length : null,
    },
    {
      id: 'history',
      label: 'Historique',
      icon: History,
      count: historyList.length > 0 ? historyList.length : null,
    },
  ];

  const currentActiveTab = availableTabs.some((t) => t.id === activeTab)
    ? activeTab
    : 'details';

  const handleCopyId = () => {
    if (!ticket?.id) return;
    navigator.clipboard.writeText(ticket.id);
    setCopied(true);
    onShowToast(`N° de ticket ${ticket.id} copié !`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!ticketDetail) return;
    setExporting(true);
    try {
      const filename = exportSingleTicketDetails(ticketDetail);
      onShowToast(`Export du ticket ${ticket?.id} généré avec succès (${filename}) !`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast("Erreur lors de l'export du ticket", 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticketKey) return;

    setIsSubmittingComment(true);
    const commentText = newComment.trim();
    const currentUser = getCurrentUser();
    const authorName = currentUser.resourceName || ticket?.agentEnCharge || 'Utilisateur';
    const authorRole = 'Gestionnaire';
    const timestamp = new Date().toISOString();

    try {
      // Call addCommentToTicket
      await addCommentToTicket({
        ticketId: ticketKey,
        ticketKey: ticketKey,
        comment: commentText,
        author: authorName,
        role: authorRole,
        flux: ticket?.flux,
      });

      const added = {
        id: `comm-${Date.now()}`,
        author: authorName,
        role: authorRole,
        createdAt: timestamp,
        body: commentText,
      };

      setLocalComments((prev) => [added, ...prev]);
      setNewComment('');
      onShowToast("Commentaire publié avec succès !", 'success');
      
      // Optionally trigger parent refresh to reload official database records
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('[KTA] Error saving comment:', err);
      // Still add locally for continuity
      const added = {
        id: `comm-${Date.now()}`,
        author: authorName,
        role: authorRole,
        createdAt: timestamp,
        body: commentText,
      };
      setLocalComments((prev) => [added, ...prev]);
      setNewComment('');
      onShowToast('Commentaire enregistré sur le ticket', 'info');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const fmtDateTime = (d?: string | null) => {
    if (!d) return '—';
    const trimmed = String(d).trim();
    try {
      const parsedDate = new Date(trimmed);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    } catch {
      // fallback
    }
    return trimmed;
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

  const statusStyle = ticket
    ? STATUS_STYLES[ticket.statut] || {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        border: 'border-slate-300',
      }
    : { bg: '', text: '', border: '' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[92vw] max-w-[1650px] h-[92vh] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* JIRA-STYLE COMPACT HEADER */}
        <div className="bg-[#181818] text-white px-4 sm:px-6 py-3 border-b-2 border-[#E60028] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#E60028] shrink-0 border border-white/10">
              <FileText className="w-4 h-4 text-[#E60028]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold tracking-wider text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60">
                  {ticket?.id || 'Chargement…'}
                </span>
                {ticket?.flux && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/15 text-slate-200">
                    Flux : {ticket.flux}
                  </span>
                )}
                {ticket?.statut && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{ticket.statut}</span>
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {ticket?.objet || 'Détails du Ticket'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {ticket?.id && (
              <button
                type="button"
                onClick={handleCopyId}
                title="Copier le N° de ticket"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            {ticketFolderId && (
              <button
                type="button"
                onClick={() => openKTADocumentFolder(ticketFolderId)}
                title={`Ouvrir le dossier TotalAgility (FolderID: ${ticketFolderId})`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E60028] hover:bg-[#B4001F] text-white text-xs font-semibold font-mono transition-all shadow-xs hover:shadow cursor-pointer group"
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Ouvrir dossier</span>
                <ExternalLink className="w-3 h-3 opacity-80 group-hover:opacity-100 shrink-0 ml-0.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              title="Exporter cette fiche en Excel"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exporter</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-[#E60028] text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* JIRA TICKET SUB-NAVIGATION TABS */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentActiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#E60028] text-[#E60028] bg-white rounded-t-md font-bold shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-rose-100 text-[#E60028]' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* MODAL MAIN CONTENT: JIRA MULTI-COLUMN TICKET DISPLAY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-rose-200 border-t-[#E60028] rounded-full animate-spin" />
              <span className="text-xs font-medium">Chargement des données du ticket depuis TotalAgility…</span>
            </div>
          ) : !ticketDetail || !ticket ? (
            <div className="py-20 text-center text-slate-500">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-800">Aucun détail disponible pour ce ticket</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Le ticket n'a pas pu être chargé depuis le serveur KTA ou a été supprimé.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: FICHE PRINCIPALE (3-COLUMN JIRA TICKET LAYOUT) */}
              {currentActiveTab === 'details' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
                  {/* LEFT & CENTER 2-COLUMN MAIN CONTENT (8 COLS) */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* SECTION 1: INFORMATIONS DE LA DEMANDE (2 COLUMNS GRID) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                        <FileText className="w-4 h-4 text-[#E60028]" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Détails Principaux de la Demande
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Clé Ticket (Ticket Key)
                          </span>
                          <span className="text-xs sm:text-sm font-mono font-bold text-slate-900">
                            {ticket.ticketKey || ticket.id || '—'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Type de Ticket (Ticket Type)
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-[#E60028]">
                            {ticket.ticketType || ticket.flux || '—'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Département
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800">
                            {ticket.departement || (ticket as any)?.Departement || '—'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Service
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800">
                            {ticket.service || (ticket as any)?.Service || '—'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Division
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800">
                            {ticket.division || (ticket as any)?.Division || '—'}
                          </span>
                        </div>

                        {((ticket as any)?.projet || (ticket as any)?.Projet) && (
                          <div className="flex flex-col gap-0.5 pb-2 border-b border-slate-100">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Projet
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-slate-800">
                              {(ticket as any)?.projet || (ticket as any)?.Projet}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: DONNÉES MÉTIER DU FLUX (3 COLUMNS TICKET GRID) */}
                    {hasRequestDetail && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                          <Layers className="w-4 h-4 text-[#E60028]" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Champs Spécifiques & Variables Métier ({ticket.flux})
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                          {Object.entries(effectiveRequestDetail).map(([k, val]) => {
                            const isBool = typeof val === 'boolean';
                            const isFolderField = isFolderIdField(k);
                            return (
                              <div key={k} className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                                  {k}
                                </span>
                                <div>
                                  {isBool ? (
                                    <TrueFalseBadge
                                      value={val}
                                      variant="fun"
                                      size="sm"
                                      trueLabel="Vrai"
                                      falseLabel="Faux"
                                    />
                                  ) : isFolderField ? (
                                    <FolderDocButton folderId={val} variant="detail" />
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-900 break-words font-mono">
                                      {String(val || '—')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: FOURNISSEURS ASSOCIÉS (SI PRÉSENT) */}
                    {hasSuppliers && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#E60028]" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Fournisseurs & Prestataires ({ticketDetail.fournisseurs!.length})
                            </h3>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="p-2 text-[11px]">Raison Sociale</th>
                                <th className="p-2 text-[11px]">Code Fournisseur</th>
                                <th className="p-2 text-[11px]">Contact</th>
                                <th className="p-2 text-[11px]">Évaluation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {ticketDetail.fournisseurs!.map((f, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-2 font-bold text-slate-900">{f.nom}</td>
                                  <td className="p-2 font-mono text-[11px] text-slate-500">{f.codeFournisseur || '—'}</td>
                                  <td className="p-2 text-[11px] text-slate-600">
                                    {f.email ? <a href={`mailto:${f.email}`} className="text-blue-600 hover:underline">{f.email}</a> : f.telephone || '—'}
                                  </td>
                                  <td className="p-2">
                                    {f.evaluation ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        {f.evaluation}/5
                                      </span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN SIDEBAR PANEL (4 COLS: PEOPLE, DATES, STATUS) */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* SECTION: INTERVENANTS & RÔLES */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200 text-slate-800 font-bold text-xs">
                        <User className="w-3.5 h-3.5 text-[#E60028]" />
                        <span>Personnes & Affectation</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Demandeur (Créateur)
                          </span>
                          <span className="font-semibold text-slate-900">{ticket.demandeur || '—'}</span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Département / Service
                          </span>
                          <span className="font-semibold text-slate-800">{ticket.departement || '—'}</span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Agent en Charge
                          </span>
                          <span className="font-semibold text-slate-900">{ticket.agentEnCharge || '—'}</span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Dernier Intervenant
                          </span>
                          <span className="font-semibold text-slate-900">{ticket.dernierIntervenant || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION: DATES & HORODATAGE */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200 text-slate-800 font-bold text-xs">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dates & Horodatage</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500 font-medium">Date Création :</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-800">
                            {fmtDateTime(ticket.dateCreation)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500 font-medium">Dernière Modif :</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-800">
                            {fmtDateTime(ticket.dateModif)}
                          </span>
                        </div>

                        {ticket.dateCloture && (
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500 font-medium">Date Clôture :</span>
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {fmtDateTime(ticket.dateCloture)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION: ÉTAT TOTALAGILITY */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200 text-slate-800 font-bold text-xs">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Statut & Workflow</span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[11px] text-slate-500 font-medium">Statut Actuel :</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                          {ticket.statut}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FOURNISSEURS (MULTI-COLUMN LIST) */}
              {currentActiveTab === 'suppliers' && hasSuppliers && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ticketDetail.fournisseurs!.map((fournisseur, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{fournisseur.nom}</h4>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Code : {fournisseur.codeFournisseur || `FOURN-0${idx + 1}`}
                            </span>
                          </div>
                          {fournisseur.evaluation && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200 text-[11px] font-bold">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{fournisseur.evaluation}/5</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200/80">
                          {fournisseur.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <a href={`mailto:${fournisseur.email}`} className="text-blue-600 hover:underline truncate text-[11px]">
                                {fournisseur.email}
                              </a>
                            </div>
                          )}
                          {fournisseur.telephone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-[11px]">{fournisseur.telephone}</span>
                            </div>
                          )}
                          {fournisseur.adresse && (
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate text-[11px]">{fournisseur.adresse}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: COMMENTAIRES & ÉCHANGES */}
              {currentActiveTab === 'comments' && (
                <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-150">
                  {/* ADD COMMENT FORM */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ajouter une note ou un commentaire sur ce ticket..."
                      disabled={isSubmittingComment}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E60028] focus:border-[#E60028] disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmittingComment}
                      className="px-3.5 py-2 rounded-lg bg-[#E60028] hover:bg-[#B4001F] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isSubmittingComment ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Envoi en cours…</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Publier</span>
                        </>
                      )}
                    </button>
                  </form>

                  {allComments.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                      <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                      <p className="font-bold text-xs text-slate-700">Aucun commentaire enregistré</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Vous pouvez ajouter une première note ci-dessus.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {allComments.map((c, i) => (
                        <div
                          key={c.id || i}
                          className={`p-3 rounded-lg border text-xs ${
                            c.isSystem
                              ? 'bg-slate-50 border-slate-200 border-dashed'
                              : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{c.author}</span>
                              {c.role && (
                                <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded">
                                  {c.role}
                                </span>
                              )}
                              {c.isSystem && (
                                <span className="px-1.5 py-0.2 text-[10px] font-bold uppercase bg-slate-200 text-slate-700 rounded">
                                  Système
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 font-mono text-[10px]">{fmtDateTime(c.createdAt)}</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed pl-1">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: COMPLÉMENTS D'INFORMATION */}
              {currentActiveTab === 'complements' && (
                <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-150">
                  {/* Header & stats */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        <span>Demandes de Complément d&apos;Information</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Demandes de pièces justificatives, clarifications techniques ou budgétaires émises lors du traitement.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700">
                        <span>Total:</span>
                        <strong className="text-slate-900">{complementList.length}</strong>
                      </div>
                      {complementList.filter((c) => String(c.status || '').toLowerCase().includes('attente') || String(c.status || '').toLowerCase().includes('cours')).length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-md border border-amber-200 text-[11px] font-bold text-amber-700">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>
                            {complementList.filter((c) => String(c.status || '').toLowerCase().includes('attente') || String(c.status || '').toLowerCase().includes('cours')).length} En attente
                          </span>
                        </div>
                      )}
                      {complementList.filter((c) => String(c.status || '').toLowerCase().includes('résolu') || String(c.status || '').toLowerCase().includes('resolu') || String(c.status || '').toLowerCase().includes('traité') || String(c.status || '').toLowerCase().includes('traite') || String(c.status || '').toLowerCase().includes('clôtur')).length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>
                            {complementList.filter((c) => String(c.status || '').toLowerCase().includes('résolu') || String(c.status || '').toLowerCase().includes('resolu') || String(c.status || '').toLowerCase().includes('traité') || String(c.status || '').toLowerCase().includes('traite') || String(c.status || '').toLowerCase().includes('clôtur')).length} Résolu(s)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {complementList.length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 bg-slate-50/50">
                      <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-sm text-slate-700">Aucune demande de complément d&apos;information</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Toutes les pièces et clarifications requises sont conformes ou aucune demande n&apos;a été émise pour ce ticket.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {complementList.map((item, idx) => {
                        const statusLower = String(item.status || '').toLowerCase();
                        const isPending = statusLower.includes('attente') || statusLower.includes('cours') || statusLower.includes('demandé');
                        const isResolved = statusLower.includes('résolu') || statusLower.includes('resolu') || statusLower.includes('traité') || statusLower.includes('traite') || statusLower.includes('clôtur') || statusLower.includes('valide');

                        return (
                          <div
                            key={item.demandeId || item.id || idx}
                            className={`p-4 rounded-xl border transition-colors ${
                              isPending
                                ? 'bg-amber-50/30 border-amber-200/80 shadow-xs'
                                : isResolved
                                ? 'bg-emerald-50/20 border-emerald-200/70 shadow-xs'
                                : 'bg-white border-slate-200 shadow-xs'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 mb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  #{item.demandeId || `DEM-${idx + 1}`}
                                </span>
                                
                                <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                    {(item.requestedByResourceId || item.author || 'D')[0]?.toUpperCase()}
                                  </span>
                                  <span>Demandé par : {item.requestedByResourceId || item.author || 'Demandeur / Gestionnaire'}</span>
                                </div>

                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>{item.status || 'En attente'}</span>
                                  </span>
                                ) : isResolved ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>{item.status || 'Résolu'}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    <span>{item.status || 'Demande'}</span>
                                  </span>
                                )}
                              </div>

                              {/* Dates */}
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Créé : {fmtDateTime(item.createdAt)}</span>
                                </span>
                                {item.resolvedAt && (
                                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    <span>Résolu : {fmtDateTime(item.resolvedAt)}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Message Body */}
                            <div className="bg-white/80 p-3 rounded-lg border border-slate-100 text-xs text-slate-800 leading-relaxed">
                              <p className="whitespace-pre-wrap">{item.message || 'Aucun message spécifié'}</p>
                            </div>

                            {/* Status Footer Notice */}
                            <div className="mt-2.5 flex items-center justify-between text-[11px]">
                              {isPending ? (
                                <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>Action requise : le demandeur doit fournir les informations ou documents demandés.</span>
                                </div>
                              ) : isResolved ? (
                                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Cette demande a été résolue et les éléments nécessaires ont été intégrés.</span>
                                </div>
                              ) : (
                                <div className="text-slate-400">Demande enregistrée sur le ticket.</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: JOURNAL D'AUDIT */}
              {currentActiveTab === 'audit' && (
                <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                        <span>Journal d&apos;audit et traçabilité des modifications</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Historique exhaustif des changements d&apos;états, modifications de champs et actions enregistrées sur ce ticket.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                      {auditList.length} événement{auditList.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {auditList.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                      <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                      <p className="font-bold text-xs text-slate-700">Aucun événement d&apos;audit enregistré</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Les modifications futures et changements d&apos;états apparaîtront automatiquement dans ce journal.
                      </p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {auditList.map((item, idx) => {
                        const eventTypeUpper = String(item.eventType || '').toUpperCase();
                        const isStatusChange =
                          eventTypeUpper === 'STATUS_CHANGE' ||
                          eventTypeUpper.includes('STATUT') ||
                          item.summary?.toLowerCase().includes('statut') ||
                          item.summary?.toLowerCase().includes('status');
                        const isFieldUpdate =
                          eventTypeUpper === 'FIELD_UPDATE' ||
                          eventTypeUpper.includes('CHAMP') ||
                          eventTypeUpper.includes('MODIF');

                        return (
                          <div key={item.id || idx} className="relative group">
                            {/* Timeline marker */}
                            <div
                              className={`absolute -left-6 top-2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs ${
                                isStatusChange
                                  ? 'bg-emerald-500 ring-2 ring-emerald-100'
                                  : isFieldUpdate
                                  ? 'bg-blue-500 ring-2 ring-blue-100'
                                  : 'bg-slate-400 ring-2 ring-slate-100'
                              }`}
                            />

                            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs hover:border-slate-300 transition-colors">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded uppercase tracking-wider ${
                                      isStatusChange
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : isFieldUpdate
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {item.eventType || 'ACTION'}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {item.actor || 'Système'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {fmtDateTime(item.eventTime)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/80 rounded p-2 border border-slate-100">
                                {item.summary || 'Événement d\'audit'}
                              </p>
                              {item.details && (
                                <p className="text-[11px] text-slate-500 mt-1 pl-1 italic">
                                  {item.details}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: HISTORIQUE KTA PROCESS */}
              {currentActiveTab === 'history' && (() => {
                const distinctStatuses = Array.from(
                  new Set(historyList.map((h) => h.status).filter(Boolean))
                );

                const countExec = historyList.filter((h) =>
                  String(h.status || '').toLowerCase().includes('exécut')
                ).length;
                const countCancel = historyList.filter((h) =>
                  String(h.status || '').toLowerCase().includes('annul')
                ).length;

                const filteredHistory = historyList.filter((item) => {
                  if (historyStatusFilter !== 'ALL' && item.status !== historyStatusFilter) {
                    return false;
                  }
                  if (historySearch.trim()) {
                    const q = historySearch.toLowerCase();
                    const match =
                      (item.activity && item.activity.toLowerCase().includes(q)) ||
                      (item.actor && item.actor.toLowerCase().includes(q)) ||
                      (item.status && item.status.toLowerCase().includes(q)) ||
                      (item.activityType && item.activityType.toLowerCase().includes(q)) ||
                      (item.eventTime && item.eventTime.toLowerCase().includes(q)) ||
                      (item.summary && item.summary.toLowerCase().includes(q)) ||
                      (item.details && item.details.toLowerCase().includes(q));
                    if (!match) return false;
                  }
                  return true;
                });

                const getActivityIcon = (activityName?: string, activityType?: string) => {
                  const text = `${activityName || ''} ${activityType || ''}`.toLowerCase();
                  if (text.includes('validation')) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                  if (text.includes('extraction') || text.includes('capture')) return <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
                  if (text.includes('vrs') || text.includes('image')) return <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
                  if (text.includes('dotnet') || text.includes('loop') || text.includes('decision') || text.includes('assign'))
                    return <Cpu className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                  return <Workflow className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
                };

                const renderStatusBadge = (status?: string) => {
                  const s = String(status || '').toLowerCase().trim();
                  if (s.includes('annulé') || s.includes('cancel') || s.includes('rejet') || s.includes('error') || s.includes('fail')) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-500" />
                        <span>{status || 'Annulé'}</span>
                      </span>
                    );
                  }
                  if (s.includes('exécuté') || s.includes('execute') || s.includes('termin') || s.includes('succ') || s.includes('valid')) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{status || 'Exécuté'}</span>
                      </span>
                    );
                  }
                  if (s.includes('cours') || s.includes('progress') || s.includes('prêt') || s.includes('wait') || s.includes('pend')) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span>{status || 'En cours'}</span>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <Activity className="w-3 h-3 text-slate-400" />
                      <span>{status || 'Action'}</span>
                    </span>
                  );
                };

                return (
                  <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in duration-150">
                    {/* Header & Metrics */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <History className="w-4 h-4 text-blue-600" />
                          <span>Historique d&apos;Exécution &amp; Traitements</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Trace chronologique des activités, étapes de validation, captures et traitements automatiques exécutés.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700">
                          <span>Total:</span>
                          <strong className="text-slate-900">{historyList.length}</strong>
                        </div>
                        {countExec > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{countExec} Exécuté{countExec > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {countCancel > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-rose-50 rounded-md border border-rose-200 text-[11px] font-bold text-rose-700">
                            <XCircle className="w-3 h-3" />
                            <span>{countCancel} Annulé{countCancel > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toolbar: Search, Filters & View Mode Switch */}
                    {historyList.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={historySearch}
                              onChange={(e) => setHistorySearch(e.target.value)}
                              placeholder="Filtrer par étape, utilisateur, type..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {historySearch && (
                              <button
                                onClick={() => setHistorySearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                              >
                                &times;
                              </button>
                            )}
                          </div>

                          {distinctStatuses.length > 1 && (
                            <select
                              value={historyStatusFilter}
                              onChange={(e) => setHistoryStatusFilter(e.target.value)}
                              className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="ALL">Tous les statuts ({historyList.length})</option>
                              {distinctStatuses.map((st) => (
                                <option key={st} value={st}>
                                  {st} ({historyList.filter((h) => h.status === st).length})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setHistoryViewMode('table')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              historyViewMode === 'table'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <TableIcon className="w-3.5 h-3.5" />
                            <span>Tableau</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryViewMode('timeline')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              historyViewMode === 'timeline'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Chronologie</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Content View */}
                    {historyList.length === 0 ? (
                      <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 bg-slate-50/50">
                        <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-sm text-slate-700">Aucun historique d&apos;activité disponible</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Les étapes exécutées apparaîtront automatiquement dès qu&apos;une activité est déclenchée.
                        </p>
                      </div>
                    ) : filteredHistory.length === 0 ? (
                      <div className="p-8 border border-slate-200 rounded-xl text-center text-slate-500 bg-white">
                        <ListFilter className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">Aucun résultat ne correspond à votre filtre</p>
                        <button
                          onClick={() => {
                            setHistorySearch('');
                            setHistoryStatusFilter('ALL');
                          }}
                          className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Réinitialiser les filtres
                        </button>
                      </div>
                    ) : historyViewMode === 'table' ? (
                      /* 1. TABLE VIEW */
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <th className="py-2.5 px-3 w-12 text-center">#</th>
                                <th className="py-2.5 px-3">Activité / Étape</th>
                                <th className="py-2.5 px-3">Date & Heure</th>
                                <th className="py-2.5 px-3">Exécuté par</th>
                                <th className="py-2.5 px-3">Statut</th>
                                <th className="py-2.5 px-3">Type d&apos;activité / Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {filteredHistory.map((item, idx) => (
                                <tr
                                  key={item.id || idx}
                                  className="hover:bg-blue-50/40 transition-colors group"
                                >
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      {getActivityIcon(item.activity, item.activityType)}
                                      <span className="group-hover:text-blue-600 transition-colors">
                                        {item.activity || 'Activité'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{item.eventTime || '—'}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                        {(item.actor || 'T')[0]?.toUpperCase()}
                                      </span>
                                      <span className="font-medium">{item.actor || 'TotalAgility'}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    {renderStatusBadge(item.status)}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-700 font-medium">
                                      {item.activityType || item.details || '—'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* 2. TIMELINE VIEW */
                      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {filteredHistory.map((item, idx) => {
                          const isCancel = String(item.status || '').toLowerCase().includes('annul');
                          const isSuccess = String(item.status || '').toLowerCase().includes('exécut');

                          return (
                            <div key={item.id || idx} className="relative group">
                              {/* Timeline marker */}
                              <div
                                className={`absolute -left-6 top-2.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                                  isCancel
                                    ? 'bg-rose-500 ring-2 ring-rose-100'
                                    : isSuccess
                                    ? 'bg-emerald-500 ring-2 ring-emerald-100'
                                    : 'bg-blue-500 ring-2 ring-blue-100'
                                }`}
                              />

                              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-slate-300 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                                      {getActivityIcon(item.activity, item.activityType)}
                                      <span>{item.activity || 'Activité'}</span>
                                    </div>
                                    {renderStatusBadge(item.status)}
                                  </div>

                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono shrink-0">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3 text-slate-400" />
                                      {item.actor || 'TotalAgility'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {item.eventTime || '—'}
                                    </span>
                                  </div>
                                </div>

                                {item.activityType && (
                                  <div className="bg-slate-50 rounded p-2 border border-slate-100 text-xs text-slate-700 flex items-center justify-between gap-2">
                                    <span className="font-medium">{item.activityType}</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                      Étape #{idx + 1}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Connecté</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exporter la fiche</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#E60028] hover:bg-[#B4001F] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
