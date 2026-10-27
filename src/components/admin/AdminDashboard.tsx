import {getQueueTrends} from '../../utils/queueMetrics';
import {normalizeCustomerName} from '../../utils/queueValidation';
import {notifications} from '../../services/notificationService';
import { getPublicUrl } from '../../utils/urlUtils';
import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Star,
  Download,
  Settings,
  RefreshCw,
  Palette,
  Layers,
  Save,
  Building2,
  Search,
  Filter,
  FileText,
  Printer,
  Smile,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  PieChart as PieIcon,
  Sparkles,
  Award,
  Flame,
  UserCheck,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Sliders,
  Shield,
  RotateCcw,
  User,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  QueueSystemConfig,
  BrandConfig,
  QueueTicket,
  CounterStation,
  TicketStatus,
  TicketPriority,
} from '../../types/queueTypes';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { queueStore, QueueState } from '../../services/queueStore';
import { configService } from '../../services/configService';
import { authService } from '../../services/authService';
import { RulesEngineInterface } from './RulesEngineInterface';
import { AuditLogsViewer } from './AuditLogsViewer';
import { ResetQueueButton } from '../common/ResetQueueModal';
import { AuthLoginModal } from '../common/AuthLoginModal';

interface AdminDashboardProps {
  config: QueueSystemConfig;
  queueState: QueueState;
  onUpdateConfig: (newConfig: QueueSystemConfig) => void;
  onSwitchBrand: (brandId: string) => void;
  onGoToCounter?: () => void;
}

type DashboardTab = 'kpis' | 'graphs' | 'counters' | 'satisfaction' | 'reports' | 'rules' | 'logs' | 'brand' | 'config';

// Math helpers for SVG Donut rendering
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const delta = endAngle - startAngle;
  const safeEndAngle = delta >= 360 ? startAngle + 359.999 : endAngle;
  const startOuter = polarToCartesian(x, y, outerRadius, safeEndAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, startAngle);
  const endInner = polarToCartesian(x, y, innerRadius, safeEndAngle);
  const largeArcFlag = safeEndAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', startOuter.x, startOuter.y,
    'A', outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    'L', startInner.x, startInner.y,
    'A', innerRadius, innerRadius, 0, largeArcFlag, 1, endInner.x, endInner.y,
    'Z',
  ].join(' ');
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  config,
  queueState,
  onUpdateConfig,
  onSwitchBrand,
  onGoToCounter,
}) => {
  const categories = config?.categories?.length ? config.categories : DEFAULT_QUEUE_CONFIG.categories;
  const [activeTab, setActiveTab] = useState<DashboardTab>('kpis');
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('today');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Reports table filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Donut chart hover selection
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  // Editable brand state
  const [editBrand, setEditBrand] = useState<BrandConfig>({ ...(config?.brand || DEFAULT_QUEUE_CONFIG.brand) });

  // Authentication state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

  React.useEffect(() => {
    const unsub = authService.subscribe((session) => {
      setCurrentUser(session?.user || null);
    });
    return unsub;
  }, []);

  React.useEffect(() => {
    if (config?.brand) {
      setEditBrand({ ...config.brand });
    }
  }, [config?.brand?.id]);

  const allTickets = useMemo(() => queueState.tickets.filter((t) =>
    new Date(t.createdAt).toDateString() === new Date().toDateString()
  ), [queueState.tickets]);

  const [metricsTime, setMetricsTime] = useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setMetricsTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const trends = useMemo(() => getQueueTrends(queueState.tickets, new Date(metricsTime)), [queueState.tickets, metricsTime]);

  // Primary Metrics
  const totalWaiting = queueState.tickets.filter((t) => t.status === 'waiting').length;
  const totalCalled = queueState.tickets.filter((t) => t.status === 'called').length;
  const totalInService = queueState.tickets.filter((t) => t.status === 'in_service').length;
  const totalCompleted = allTickets.filter((t) => t.status === 'completed').length;
  const totalNoShow = allTickets.filter((t) => t.status === 'noshow' || t.status === 'cancelled').length;
  const totalProcessedToday = totalCompleted + totalNoShow;

  const completedTickets = useMemo(() => allTickets.filter((t) => t.status === 'completed'), [allTickets]);

  const avgWaitMinutes = useMemo(() => {
    if (completedTickets.length === 0) return 0;
    const total = completedTickets.reduce((acc, t) => acc + (t.waitTimeMinutes ?? 0), 0);
    return Math.round(total / completedTickets.length);
  }, [completedTickets]);

  const avgServiceMinutes = useMemo(() => {
    if (completedTickets.length === 0) return 0;
    const total = completedTickets.reduce((acc, t) => acc + (t.serviceDurationMinutes ?? 0), 0);
    return Math.round(total / completedTickets.length);
  }, [completedTickets]);

  // SLA Compliance: Tickets served in under 15 minutes
  const slaComplianceRate = useMemo(() => {
    if (completedTickets.length === 0) return 0;
    const withinSla = completedTickets.filter((t) => (t.waitTimeMinutes || 0) <= 15).length;
    return Math.round((withinSla / completedTickets.length) * 100);
  }, [completedTickets]);

  // CSAT Score (%) & NPS calculation
  const csatMetrics = useMemo(() => {
    const feedbackList = allTickets
      .map((t) => t.feedback)
      .filter((f): f is NonNullable<typeof f> => Boolean(f && f.overallSatisfaction));

    const count = feedbackList.length;
    if (count === 0) {
      return {
        overallPercent: 0,
        avgRating: 0,
        count: 0,
        starDist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        nps: 0,
      };
    }

    const totalStars = feedbackList.reduce((acc, f) => acc + f.overallSatisfaction, 0);
    const avgRating = Number((totalStars / count).toFixed(1));
    const overallPercent = Math.round((totalStars / (count * 5)) * 100);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackList.forEach((f) => {
      const s = Math.min(5, Math.max(1, f.overallSatisfaction));
      counts[s] = (counts[s] || 0) + 1;
    });

    const starDist: Record<number, number> = {};
    let allocated = 0;
    const fractions = [1,2,3,4,5].map((star) => {
      const exact = counts[star] * 100 / count;
      starDist[star] = Math.floor(exact); allocated += starDist[star];
      return { star, fraction: exact - Math.floor(exact) };
    }).sort((a,b) => b.fraction-a.fraction);
    for (let i=0; i<100-allocated; i++) starDist[fractions[i].star]++;


    // NPS: promoters (5) - detractors (1, 2)
    const promoters = counts[5] || 0;
    const detractors = (counts[1] || 0) + (counts[2] || 0);
    const nps = Math.round(((promoters - detractors) / count) * 100);

    return { overallPercent, avgRating, count, starDist, nps };
  }, [allTickets]);

  // Category breakdown for Donut Chart & bars
  const categoryStats = useMemo(() => {
    const total = allTickets.length || 1;
    return categories.map((cat, idx) => {
      const ticketsInCat = allTickets.filter((t) => t.categoryId === cat.id);
      const count = ticketsInCat.length;
      const percent = Math.round((count / total) * 100);
      const completed = ticketsInCat.filter((t) => t.status === 'completed');
      const avgWait = completed.length > 0
        ? Math.round(completed.reduce((a, b) => a + (b.waitTimeMinutes ?? 0), 0) / completed.length)
        : 0;
      const avgService = completed.length > 0
        ? Math.round(completed.reduce((a, b) => a + (b.serviceDurationMinutes ?? 0), 0) / completed.length)
        : 0;

      const colors = ['#003B73', '#00A3E0', '#FFB800', '#10B981', '#8B5CF6', '#F43F5E'];
      const color = cat.color || colors[idx % colors.length];

      return {
        id: cat.id,
        label: cat.labelFr,
        code: cat.code,
        count,
        percent,
        avgWait,
        avgService,
        color,
      };
    });
  }, [categories, allTickets]);

  const slaBands = useMemo(() => {
    if (!completedTickets.length) return [0,0,0];
    const fast = Math.round(completedTickets.filter((t) => (t.waitTimeMinutes ?? 0) < 10).length * 100 / completedTickets.length);
    return [fast, slaComplianceRate-fast, 100-slaComplianceRate];
  }, [completedTickets, slaComplianceRate]);

  const hourlyData = useMemo(() => Array.from({length:24}, (_,h) => {
    const tickets = allTickets.filter((t) => new Date(t.createdAt).getHours() === h);
    return {slot: `${String(h).padStart(2,'0')}h-${String(h+1).padStart(2,'0')}h`, count: tickets.length,
      avgWait: tickets.length ? Math.round(tickets.reduce((n,t) => n+(t.waitTimeMinutes ?? 0),0)/tickets.length) : 0,
      isPeak: tickets.length > 0 && tickets.length === Math.max(...Array.from({length:24},(_,i) => allTickets.filter((t) => new Date(t.createdAt).getHours() === i).length))};
  }), [allTickets]);

  const volumeHistory7Days = useMemo(() => Array.from({length:7},(_,i) => {
    const date = new Date(); date.setDate(date.getDate()-6+i);
    const tickets = queueState.tickets.filter((t) => new Date(t.createdAt).toDateString() === date.toDateString());
    const completed = tickets.filter((t) => t.status === 'completed');
    return {day: date.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'}) + (i===6 ? ' (Auj.)' : ''),
      count: tickets.length, sla: completed.length ? Math.round(completed.filter((t) => (t.waitTimeMinutes ?? 0)<=15).length*100/completed.length) : 0};
  }), [queueState.tickets]);

  const counterProductivity = useMemo(() => queueState.counters.map((c) => {
    const tickets = completedTickets.filter((t) => t.counterId === c.id);
    const duration = tickets.reduce((n,t) => n+(t.serviceDurationMinutes ?? 0),0);
    const feedback = tickets.filter((t) => t.feedback);
    const elapsed = Math.max(1, (Date.now()-new Date().setHours(0,0,0,0))/60000);
    return {...c, servedCount: tickets.length, avgDuration: tickets.length ? Math.round(duration/tickets.length) : 0,
      occupancyRate: Math.min(100,Math.round(duration*100/elapsed)),
      satisfactionRating: feedback.length ? Number((feedback.reduce((n,t) => n+t.feedback!.overallSatisfaction,0)/feedback.length).toFixed(1)) : 0};
  }), [queueState.counters, completedTickets]);

  // Filtered tickets for audit table
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchToken = t.tokenNumber.toLowerCase().includes(q);
        const matchCustomer = (t.customerName || '').toLowerCase().includes(q);
        const matchCounter = (t.counterName || '').toLowerCase().includes(q);
        const matchOp = (t.subOperationName || '').toLowerCase().includes(q);
        if (!matchToken && !matchCustomer && !matchCounter && !matchOp) return false;
      }
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      return true;
    });
  }, [allTickets, searchQuery, filterCategory, filterStatus, filterPriority]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage]);

  // Professional Multi-Sheet Excel Export (.xlsx)
  const handleExportProExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. KPI Sheet
    const kpiRows = [
      { Métrique: 'Banque & Réseau', Valeur: config.brand.name },
      { Métrique: 'Agence Active', Valeur: config.agencies.find((a) => a.id === config.selectedAgencyId)?.name || 'Direction Réseau' },
      { Métrique: 'Date d\'Extraction', Valeur: new Date().toLocaleDateString('fr-FR') },
      { Métrique: 'Total Visiteurs Aujourd\'hui', Valeur: allTickets.length },
      { Métrique: 'Clients Clôturés / Servis', Valeur: totalCompleted },
      { Métrique: 'Clients Actuellement en Attente', Valeur: totalWaiting },
      { Métrique: 'Clients Appelés Sans Prise en Charge', Valeur: totalCalled },
      { Métrique: 'Clients en Cours de Prise en Charge', Valeur: totalInService },
      { Métrique: 'Temps d\'Attente Moyen (minutes)', Valeur: avgWaitMinutes },
      { Métrique: 'Durée Moyenne de Traitement (minutes)', Valeur: avgServiceMinutes },
      { Métrique: 'Taux de Respect SLA (≤15 min)', Valeur: `${slaComplianceRate}%` },
      { Métrique: 'Score de Satisfaction CSAT', Valeur: `${csatMetrics.overallPercent}%` },
      { Métrique: 'Net Promoter Score (NPS)', Valeur: `+${csatMetrics.nps}` },
    ];
    const wsKpis = XLSX.utils.json_to_sheet(kpiRows);
    XLSX.utils.book_append_sheet(wb, wsKpis, 'Synthèse_Exécutive');

    // 2. All Processed Tickets
    const ticketRows = filteredTickets.map((t) => ({
      'N° Ticket': t.tokenNumber,
      'Client': t.customerName || 'Visiteur Agence',
      'Catégorie': config.categories.find((c) => c.id === t.categoryId)?.labelFr || t.categoryId,
      'Opération Demandée': t.subOperationName,
      'Priorité': t.priority.toUpperCase(),
      'Statut': t.status,
      'Guichet Assigné': t.counterName || '-',
      'Heure Émission': new Date(t.createdAt).toLocaleTimeString('fr-FR'),
      'Attente (min)': t.waitTimeMinutes ?? '-',
      'Durée Service (min)': t.serviceDurationMinutes ?? '-',
      'Note Satisfaction': t.feedback?.overallSatisfaction ? `${t.feedback.overallSatisfaction}/5` : '-',
      'Commentaire Client': t.feedback?.comment || '-',
    }));
    const wsTickets = XLSX.utils.json_to_sheet(ticketRows);
    XLSX.utils.book_append_sheet(wb, wsTickets, 'Registre_Tickets');

    // 3. Counter Performance Sheet
    const counterRows = counterProductivity.map((c) => ({
      'Poste': c.number,
      'Nom Guichet': c.name,
      'Guichetier': c.agentName,
      'Tickets Traités': c.servedCount,
      'Durée Moyenne (min)': c.avgDuration,
      'Taux d\'Occupation': `${c.occupancyRate}%`,
      'Score CSAT': `${c.satisfactionRating} / 5`,
      'Statut': c.status,
    }));
    const wsCounters = XLSX.utils.json_to_sheet(counterRows);
    XLSX.utils.book_append_sheet(wb, wsCounters, 'Performance_Guichets');

    const fileName = `${config.brand.id.toUpperCase()}_Rapport_FileAttente_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Quick CSV Export
  const handleExportCsv = () => {
    const headers = ['Token', 'Customer', 'Category', 'Operation', 'Priority', 'Status', 'Counter', 'Created', 'WaitMin', 'ServiceMin', 'CSAT'];
    const rows = filteredTickets.map((t) => [
      t.tokenNumber,
      `"${t.customerName || 'Visiteur'}"`,
      `"${config.categories.find((c) => c.id === t.categoryId)?.labelFr || t.categoryId}"`,
      `"${t.subOperationName}"`,
      t.priority,
      t.status,
      `"${t.counterName || '-'}"`,
      new Date(t.createdAt).toLocaleTimeString('fr-FR'),
      t.waitTimeMinutes ?? '',
      t.serviceDurationMinutes ?? '',
      t.feedback?.overallSatisfaction ?? '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.map((value) => {
      let text = String(value).replace(/^"|"$/g, '');
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.brand.id}_tickets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleSaveBrand = () => {
    configService.updateBrandConfig(editBrand);
    setSaveSuccessMsg('Marque mise à jour avec succès !');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* EXECUTIVE HEADER & SUB-NAVIGATION BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* TAB BUTTONS */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'kpis'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>KPIs & Affluence</span>
          </button>

          <button
            onClick={() => setActiveTab('graphs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'graphs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Graphiques & Flux</span>
          </button>

          <button
            onClick={() => setActiveTab('counters')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'counters'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Guichets ({queueState.counters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('satisfaction')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'satisfaction'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span>Satisfaction ({csatMetrics.overallPercent}%)</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Rapports</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Règles Métier (12)</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>Logs & Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'brand'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Marque</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Paramètres</span>
          </button>
        </div>

        {/* QUICK EXPORT & ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* UNIQUE UNIVERSAL RESET QUEUE BUTTON */}
          <ResetQueueButton variant="danger" size="md" />

          {onGoToCounter && (
            <button
              onClick={onGoToCounter}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Basculer vers l'écran d'appel guichetier"
            >
              <span>Poste Guichetier</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          )}

          <button
            onClick={handleExportProExcel}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-xs transition-transform active:scale-98 cursor-pointer"
            title="Générer un rapport Excel multi-onglets structuré"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Pro (.xlsx)</span>
          </button>

          <a
            href="/guide_test_equipe.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Consulter ou imprimer le guide de test équipe en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Guide Test (PDF)</span>
          </a>

          {/* STAFF USER AUTH BADGE */}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Gérer la session de l'agent bancaire"
          >
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <User className="w-4 h-4 text-slate-500" />
            )}
            <div className="text-left hidden sm:block">
              <span className="block text-[11px] font-bold text-slate-900 leading-tight">
                {currentUser?.name || 'Connexion'}
              </span>
              <span className="block text-[9px] text-slate-500 font-semibold leading-tight">
                {currentUser?.roleLabel || 'Agent'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: KPIS & AFFLUENCE (PAGE D'ACCUEIL DECISIONNELLE) */}
      {/* ========================================================================= */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* 5 EXECUTIVE KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Présents en agence */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Présents en agence
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-slate-900 block tracking-tight">
                  {totalWaiting + totalCalled + totalInService}
                </span>
                <span className="text-xs text-amber-700 font-semibold mt-0.5 block">
                  {totalWaiting} en attente • {totalCalled} appelé(s) • {totalInService} en service
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Total visites jour</span>
                <strong className="text-slate-800 font-mono">{allTickets.length}</strong>
              </div>
            </div>

            {/* 2. Temps d'attente moyen */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Attente Moyenne
                </span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-slate-900 block tracking-tight">
                  {avgWaitMinutes} min
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {trends.waitDeltaMinutes !== null && (trends.waitDeltaMinutes > 0 ? <TrendingUp className="w-3.5 h-3.5 text-rose-600" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />)}
                  <span className={`text-xs font-bold ${trends.waitDeltaMinutes === null ? 'text-slate-400' : trends.waitDeltaMinutes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{trends.waitDeltaMinutes === null ? 'Pas de données comparables hier' : `${trends.waitDeltaMinutes > 0 ? '+' : ''}${trends.waitDeltaMinutes} min vs hier`}</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Cible Agence</span>
                <strong className="text-emerald-700">≤ 15 min</strong>
              </div>
            </div>

            {/* 3. Prise en charge guichet */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Durée au Guichet
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-slate-900 block tracking-tight">
                  {avgServiceMinutes} min
                </span>
                <span className="text-xs text-slate-500 font-semibold mt-0.5 block">
                  {totalCompleted} dossiers traités
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span title="Visites émises aujourd’hui et clôturées, divisées par les heures écoulées depuis la première arrivée confirmée du jour.">Débit observé aujourd’hui</span>
                <strong className="text-emerald-700 font-mono">{trends.velocityPerHour === null ? '—' : `${trends.velocityPerHour} clients/h`}</strong>
              </div>
            </div>

            {/* 4. Respect SLA */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Conformité SLA
                </span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-indigo-700 block tracking-tight">
                  {slaComplianceRate}%
                </span>
                <span className="text-xs text-indigo-600 font-semibold mt-0.5 block">
                  Pris en charge ≤ 15 min
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Seuil critique</span>
                <strong className="text-slate-700">&gt; 90%</strong>
              </div>
            </div>

            {/* 5. Satisfaction Client CSAT */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Satisfaction (CSAT)
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-emerald-600 block tracking-tight">
                  {csatMetrics.overallPercent}%
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-[11px] font-bold text-slate-600 ml-1">
                    {csatMetrics.avgRating}/5
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Score NPS</span>
                <strong className="text-emerald-700 font-mono">{csatMetrics.nps > 0 ? '+' : ''}{csatMetrics.nps}</strong>
              </div>
            </div>
          </div>

          {/* MAIN CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* HOURLY AFFLUENCE BAR & WAIT TIME CURVE */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Affluence & Délais par Tranche Horaire (Aujourd’hui)</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Distribution des arrivées et temps d'attente moyen constaté par heure
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                    <Flame className="w-3 h-3 text-amber-600" />
                    <span>{queueStore.getPeakHourLabel()}</span>
                  </span>
                </div>
              </div>

              {/* Graphic container */}
              <div className="h-64 pt-6 flex items-end justify-between gap-2 sm:gap-3 border-b border-slate-100 px-2">
                {hourlyData.map((item) => {
                  const maxCount = Math.max(1,...hourlyData.map((h) => h.count));
                  const heightPercent = Math.min(100, Math.round((item.count / maxCount) * 100));

                  return (
                    <div key={item.slot} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap shadow-lg z-10 font-mono">
                        {item.count} clients • {item.avgWait} min attente
                      </div>

                      {/* Wait time badge on top of bar */}
                      <span className="text-[10px] font-bold font-mono text-slate-600 mb-1 group-hover:text-blue-600">
                        {item.count}
                      </span>

                      {/* Bar with gradient and peak hour highlight */}
                      <div
                        className={`w-full max-w-[42px] rounded-t-xl transition-all duration-300 group-hover:scale-y-105 origin-bottom shadow-xs ${
                          item.isPeak
                            ? 'bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400'
                            : 'bg-gradient-to-t from-[#003B73] via-blue-600 to-blue-400'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />

                      {/* Hour label */}
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-2 font-mono truncate">
                        {item.slot}
                      </span>

                      {/* Wait badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md mt-0.5 ${
                          item.avgWait > 14
                            ? 'bg-rose-50 text-rose-700'
                            : item.avgWait > 10
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.avgWait}m
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                    <span>Affluence normale</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                    <span>Tranche de pointe</span>
                  </span>
                </div>
                <span>Capacité nominale agence : <strong>65 clients / heure</strong></span>
              </div>
            </div>

            {/* SLA GAUGE & BREAKDOWN CARD */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Respect des Engagements Délais (SLA)</span>
                </h3>
                <span className="text-xs text-slate-500 mb-5 block">
                  Distribution des temps d'attente réels avant appel
                </span>

                {/* Stacked Progress Bar */}
                <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                  <div className="bg-emerald-500 h-full" style={{ width: `${slaBands[0]}%` }} title={`${slaBands[0]}%`} />
                  <div className="bg-blue-500 h-full" style={{ width: `${slaBands[1]}%` }} title={`${slaBands[1]}%`} />
                  <div className="bg-rose-500 h-full" style={{ width: `${slaBands[2]}%` }} title={`${slaBands[2]}%`} />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-bold text-slate-800">Pris en &lt; 10 min</span>
                    </div>
                    <strong className="font-mono text-emerald-800">{slaBands[0]}% des clients</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="font-bold text-slate-800">Entre 10 et 15 min</span>
                    </div>
                    <strong className="font-mono text-blue-800">{slaBands[1]}% des clients</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="font-bold text-slate-800">Au-delà de 15 min</span>
                    </div>
                    <strong className="font-mono text-rose-800">{slaBands[2]}% (Alerte RA)</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
                <span>Taux de désistement (No-Show)</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                  {allTickets.length ? Math.round(totalNoShow * 100 / allTickets.length) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 7-DAY VOLUME EVOLUTION */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Évolution Quotidienne du Volume (7 Derniers Jours)</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Total de tickets pris en charge par jour avec benchmark objectif
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Données enregistrées des 7 derniers jours
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-3">
              {volumeHistory7Days.map((item, idx) => {
                const isToday = idx === volumeHistory7Days.length - 1;
                return (
                  <div
                    key={item.day}
                    className={`p-4 rounded-2xl border transition-all ${
                      isToday
                        ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {item.day}
                    </span>
                    <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">
                      {item.count}
                    </span>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">SLA &lt;15m</span>
                      <strong className={`font-mono ${item.sla >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {item.sla}%
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GRAPHIQUES & ANALYSE DETAILLEE DES FLUX */}
      {/* ========================================================================= */}
      {activeTab === 'graphs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* INTERACTIVE SVG DONUT CHART */}
            <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-emerald-600" />
                      <span>Répartition des Demandes par Pôle Métier</span>
                    </h3>
                    <span className="text-xs text-slate-500">
                      Survolez un segment pour afficher le détail volumétrique
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    {allTickets.length} tickets analysés
                  </span>
                </div>

                {/* Donut SVG Rendering */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-4">
                  <div className="relative w-48 h-48 shrink-0">
                    <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                      {(() => {
                        let currentAngle = 0;
                        const total = categoryStats.reduce((acc, c) => acc + c.count, 0) || 1;
                        return categoryStats.map((cat) => {
                          const angle = (cat.count / total) * 360;
                          const startAngle = currentAngle;
                          const endAngle = currentAngle + angle;
                          currentAngle += angle;

                          if (angle <= 0.5) return null;

                          const isHovered = hoveredSlice === cat.id;

                          return (
                            <path
                              key={cat.id}
                              d={describeDonutSlice(100, 100, 58, isHovered ? 88 : 82, startAngle, endAngle)}
                              fill={cat.color}
                              className="transition-all duration-200 cursor-pointer hover:opacity-90"
                              onMouseEnter={() => setHoveredSlice(cat.id)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      {hoveredSlice ? (
                        <>
                          <span className="text-xl font-black font-mono text-slate-900">
                            {categoryStats.find((c) => c.id === hoveredSlice)?.count}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {categoryStats.find((c) => c.id === hoveredSlice)?.code}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-black font-mono text-slate-900">
                            {allTickets.length}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Flux
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 space-y-2 w-full">
                    {categoryStats.map((cat) => (
                      <div
                        key={cat.id}
                        onMouseEnter={() => setHoveredSlice(cat.id)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          hoveredSlice === cat.id ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-slate-800 truncate">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 font-mono text-slate-600">
                          <span>{cat.count}</span>
                          <span className="text-[11px] font-bold text-slate-400 w-8 text-right">
                            {cat.percent}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Service le plus sollicité</span>
                {(() => {
                  const sorted = [...categoryStats].sort((a, b) => b.count - a.count);
                  const top = sorted[0];
                  if (!top || top.count === 0) {
                    return <strong className="text-slate-600">—</strong>;
                  }
                  return (
                    <strong className="text-blue-700">
                      {top.label} ({top.percent}%)
                    </strong>
                  );
                })()}
              </div>
            </div>

            {/* SERVICE TIME VS WAIT TIME COMPARATIVE BARS */}
            <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Attente vs Durée de Traitement par Opération</span>
                </h3>
                <span className="text-xs text-slate-500 mb-4 block">
                  Comparaison des minutes passées en file vs au guichet
                </span>

                <div className="space-y-4">
                  {categories.flatMap((cat) => cat.subOperations.map((op) => {
                    const records = completedTickets.filter((t) => t.subOperationId === op.id);
                    return {label:op.labelFr, color:cat.color, wait:records.length ? Math.round(records.reduce((n,t) => n+(t.waitTimeMinutes ?? 0),0)/records.length) : 0,
                      service:records.length ? Math.round(records.reduce((n,t) => n+(t.serviceDurationMinutes ?? 0),0)/records.length) : 0};
                  })).map((op) => (
                    <div key={op.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{op.label}</span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          Attente: {op.wait}m • Guichet: {op.service}m
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Wait bar */}
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-slate-400 rounded-full"
                            style={{ width: `${Math.min(100, (op.wait / 30) * 100)}%` }}
                          />
                        </div>
                        {/* Service bar */}
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (op.service / 30) * 100)}%`,
                              backgroundColor: op.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-slate-400" />
                    <span>Temps d'Attente</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-600" />
                    <span>Prise en charge guichet</span>
                  </span>
                </div>
                <span>Temps max constaté : <strong>26 min (Crédits)</strong></span>
              </div>
            </div>
          </div>

          {/* WEEKLY AFFLUENCE HEATMAP (PAGE 3 SOW STAFFING MATRIX) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Matrice d'Intensité d'Affluence Hebdomadaire (Heatmap)</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Outil d'aide à la décision pour le dimensionnement des effectifs guichetiers
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100" /> Calme</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200" /> Modéré</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300" /> Chargé</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500 text-white font-bold" /> Forte Affluence</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-2.5 text-left pl-3">Jour de la Semaine</th>
                    <th className="py-2.5">Avant 11h</th>
                    <th className="py-2.5">Midi (11h00 - 14h00)</th>
                    <th className="py-2.5">Après 14h</th>
                    <th className="py-2.5">Statut de Charge Global</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {Array.from({length:7},(_,i) => {
                    const d = new Date(); d.setDate(d.getDate()-6+i);
                    const tickets = queueState.tickets.filter((t) => new Date(t.createdAt).toDateString()===d.toDateString());
                    const cell = (lo:number,hi:number) => ({val: `${tickets.filter((t) => {const h=new Date(t.createdAt).getHours(); return h>=lo && h<hi;}).length} clients`,cls:'bg-blue-50 text-blue-900'});
                    return {day:d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'2-digit'}),m1:cell(0,11),m2:cell(11,14),m3:cell(14,24),status:`${tickets.length} clients observés`};
                  }).map((row) => (
                    <tr key={row.day} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 text-left pl-3 font-bold text-slate-900">{row.day}</td>
                      <td className="py-2 px-1"><span className={`inline-block w-full py-1.5 rounded-lg text-xs ${row.m1.cls}`}>{row.m1.val}</span></td>
                      <td className="py-2 px-1"><span className={`inline-block w-full py-1.5 rounded-lg text-xs ${row.m2.cls}`}>{row.m2.val}</span></td>
                      <td className="py-2 px-1"><span className={`inline-block w-full py-1.5 rounded-lg text-xs ${row.m3.cls}`}>{row.m3.val}</span></td>
                      <td className="py-3 text-slate-600 text-xs font-medium">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUPERVISION DES GUICHETS & PRODUCTIVITE */}
      {/* ========================================================================= */}
      {activeTab === 'counters' && (
        <div className="space-y-6">
          {/* COUNTERS LIVE STATUS GRID */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Supervision en Direct des Guichets ({queueState.counters.length})</span>
                </h3>
                <span className="text-xs text-slate-500">
                  État instantané, agent affecté et ticket actuellement en cours de service
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Synchronisation temps réel (LAN)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {queueState.counters.map((c) => {
                const currentTkt = queueState.tickets.find((t) => t.id === c.currentTicketId);
                const isServing = c.status === 'serving';
                const isCalling = c.status === 'calling';

                return (
                  <div
                    key={c.id}
                    className={`p-5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                      isServing
                        ? 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                        : isCalling
                        ? 'border-amber-300 bg-amber-50/20 animate-pulse'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-slate-400">
                          Guichet N° {c.number}
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            isServing
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse'
                              : isCalling
                              ? 'bg-amber-400 animate-ping'
                              : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900">{c.name}</h4>
                      <span className="text-xs text-slate-600 block mt-0.5">
                        Agent : <strong>{c.agentName}</strong>
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Client en cours
                      </span>
                      {currentTkt ? (
                        <div className="mt-1">
                          <span className="font-mono font-black text-lg text-blue-600 block">
                            Ticket {currentTkt.tokenNumber}
                          </span>
                          <span className="text-xs text-slate-700 font-semibold block truncate">
                            {currentTkt.subOperationName}
                          </span>
                          <span className="text-[11px] text-emerald-700 font-mono mt-0.5 block">
                            En service • {currentTkt.customerName || 'Visiteur'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 mt-1 block">
                          Guichet libre / En attente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COUNTER PRODUCTIVITY CHART & TABLE */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Productivité & Vélocité par Guichetier</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                    <th className="pb-3">Poste</th>
                    <th className="pb-3">Agent</th>
                    <th className="pb-3">Tickets Traités</th>
                    <th className="pb-3">Durée Moyenne</th>
                    <th className="pb-3">Taux d'Occupation</th>
                    <th className="pb-3">Satisfaction CSAT</th>
                    <th className="pb-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {counterProductivity.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 font-semibold text-slate-700">{c.agentName}</td>
                      <td className="py-3 font-mono font-bold text-blue-700">{c.servedCount} clients</td>
                      <td className="py-3 font-mono text-slate-600">{c.avgDuration} min</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.occupancyRate}%` }} />
                          </div>
                          <span className="font-mono text-[11px] text-slate-600">{c.occupancyRate}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{c.satisfactionRating} / 5</span>
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'serving'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'calling'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.status === 'serving' ? 'En service' : c.status === 'calling' ? 'Appel en cours' : 'Disponible'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SATISFACTION CLIENT & VOC (VOICE OF CUSTOMER) */}
      {/* ========================================================================= */}
      {activeTab === 'satisfaction' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CSAT & NPS OVERVIEW CARD */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>Indice de Satisfaction Globale (CSAT)</span>
                </h3>
                <span className="text-xs text-slate-500 mb-6 block">
                  Évaluations à chaud recueillies en agence et sur Web App
                </span>

                <div className="text-center py-4">
                  <span className="text-5xl font-black font-mono text-emerald-600 tracking-tight">
                    {csatMetrics.overallPercent}%
                  </span>
                  <div className="flex justify-center gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-600 mt-2 block">
                    Moyenne : <strong>{csatMetrics.avgRating} / 5</strong> ({csatMetrics.count} avis exprimés)
                  </span>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Net Promoter Score (NPS)</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {csatMetrics.nps > 0 ? '+' : ''}{csatMetrics.nps}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Taux de retour sur questionnaire : <strong>{allTickets.length ? Math.round(csatMetrics.count * 100 / allTickets.length) : 0}% des visiteurs</strong>
              </div>
            </div>

            {/* STAR RATING DISTRIBUTION & CRITERIA */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 mb-1">
                  Distribution des Notes par Étoiles
                </h3>
                <span className="text-xs text-slate-500 mb-4 block">
                  Proportion de clients par palier de satisfaction
                </span>

                <div className="space-y-2.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = csatMetrics.starDist[star as keyof typeof csatMetrics.starDist] || 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-xs">
                        <span className="w-14 font-bold text-slate-700 flex items-center gap-1 shrink-0">
                          <span>{star}</span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-400' : 'bg-rose-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono font-bold text-slate-600 text-xs">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-criteria breakdown */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Accueil & Politesse</span>
                  <strong className="text-base font-black text-slate-900 font-mono mt-1 block">{csatMetrics.count ? (allTickets.reduce((n,t) => n+(t.feedback?.ratingStaff ?? 0),0)/csatMetrics.count).toFixed(1) : '—'} / 5</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Qualité du service</span>
                  <strong className="text-base font-black text-slate-900 font-mono mt-1 block">{csatMetrics.count ? (allTickets.reduce((n,t) => n+(t.feedback?.ratingService ?? 0),0)/csatMetrics.count).toFixed(1) : '—'} / 5</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Vitesse de Prise</span>
                  <strong className="text-base font-black text-slate-900 font-mono mt-1 block">{csatMetrics.count ? (allTickets.reduce((n,t) => n+(t.feedback?.ratingWaitTime ?? 0),0)/csatMetrics.count).toFixed(1) : '—'} / 5</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Satisfaction globale</span>
                  <strong className="text-base font-black text-slate-900 font-mono mt-1 block">{csatMetrics.avgRating} / 5</strong>
                </div>
              </div>
            </div>
          </div>

          {/* RECENT FEEDBACK LOG */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Smile className="w-4 h-4 text-emerald-600" />
              <span>Derniers Avis & Témoignages Clients</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {allTickets.filter((t) => t.feedback).sort((a,b) => Date.parse(b.feedback!.submittedAt)-Date.parse(a.feedback!.submittedAt)).slice(0,3).map((t) => ({
                author: normalizeCustomerName(t.customerName, 'Client'), ticket: t.tokenNumber, stars: t.feedback!.overallSatisfaction,
                sentiment: t.feedback!.overallSatisfaction >= 4 ? 'Positif' : 'À améliorer',
                comment: t.feedback!.comment || 'Sans commentaire', date: new Date(t.feedback!.submittedAt).toLocaleString('fr-FR')
              })).map((fb, idx) => (
                <div key={idx} className="min-w-0 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(fb.stars)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {fb.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 italic line-clamp-4 [overflow-wrap:anywhere]">"{fb.comment}"</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere]">{fb.author} ({fb.ticket})</span>
                    <span className="shrink-0">{fb.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: REGISTRE DES TICKETS & RAPPORTS D'ACTIVITE (AUDIT & EXPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Registre d'Audit & Rapports d'Activité</span>
              </h3>
              <p className="text-xs text-slate-500">
                Traçabilité intégrale des passages en agence, délais et feedback client
              </p>
            </div>

            {/* EXPORT BUTTONS */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintReport}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Imprimer</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportProExcel}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel Pro (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Rechercher ticket, client, guichet..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelFr}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Clôturés / Traités</option>
              <option value="in_service">En cours de service</option>
              <option value="waiting">En attente active</option>
              <option value="noshow">Absents (No-Show)</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Toutes les priorités</option>
              <option value="standard">Standard (Grand Public)</option>
              <option value="vip">VIP / Entreprises</option>
              <option value="pmr">PMR / Prioritaire</option>
            </select>
          </div>

          {/* AUDIT DATA TABLE */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Opération</th>
                  <th className="py-3 px-3">Priorité</th>
                  <th className="py-3 px-3">Guichet</th>
                  <th className="py-3 px-3">Heure Arrivée</th>
                  <th className="py-3 px-3">Attente</th>
                  <th className="py-3 px-3">Traitement</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-4">Note CSAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTickets.length > 0 ? (
                  paginatedTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                        {t.tokenNumber}
                      </td>
                      <td className="py-3 px-3 max-w-[200px] font-semibold text-slate-800 [overflow-wrap:anywhere]">
                        {normalizeCustomerName(t.customerName, 'Visiteur Agence')}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={t.subOperationName}>
                        {t.subOperationName}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            t.priority === 'vip'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : t.priority === 'pmr'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {t.counterName || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {new Date(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {t.waitTimeMinutes !== undefined ? (
                          <span className={t.waitTimeMinutes > 15 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                            {t.waitTimeMinutes} min
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {t.serviceDurationMinutes ? `${t.serviceDurationMinutes} min` : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'in_service' || t.status === 'called'
                              ? 'bg-blue-100 text-blue-800'
                              : t.status === 'waiting'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.status === 'completed'
                            ? 'Clôturé'
                            : t.status === 'called'
                              ? 'Appelé'
                            : t.status === 'pending_presence'
                              ? 'Présence à confirmer'
                            : t.status === 'in_service'
                            ? 'En service'
                            : t.status === 'waiting'
                            ? 'En attente'
                            : t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {t.feedback?.overallSatisfaction ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{t.feedback.overallSatisfaction}/5</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs font-semibold">
                      Aucun ticket ne correspond aux critères de recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>
              Affichage de <strong>{paginatedTickets.length}</strong> sur <strong>{filteredTickets.length}</strong> tickets
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-slate-800">
                Page {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CHARTE & MARQUES (AGB / SGA / CUSTOM) */}
      {/* ========================================================================= */}
      {activeTab === 'brand' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Personnalisation de la Marque & Thème
              </h3>
              <p className="text-xs text-slate-500">
                Changez facilement de banque (AGB Bank, Société Générale, ou marque sur-mesure).
              </p>
            </div>

            {saveSuccessMsg && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fade-in">
                {saveSuccessMsg}
              </span>
            )}
          </div>

          {/* Quick preset selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Préréglage de banque :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {config.availableBrands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSwitchBrand(b.id);
                    setEditBrand({ ...b });
                  }}
                  className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                    config.brand.id === b.id
                      ? 'border-slate-900 bg-slate-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-sm text-slate-900 block">{b.name}</span>
                  <span className="text-xs text-slate-500 block">{b.arabicName}</span>
                  <div className="flex gap-1.5 mt-2">
                    <span
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: b.primaryColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: b.secondaryColor }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Brand detail fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nom officiel de la banque
              </label>
              <input
                type="text"
                value={editBrand.name}
                onChange={(e) => setEditBrand({ ...editBrand, name: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nom en Arabe (الاسم بالعربية)
              </label>
              <input
                type="text"
                value={editBrand.arabicName}
                onChange={(e) => setEditBrand({ ...editBrand, arabicName: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-semibold"
                dir="rtl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Couleur Primaire (Hex)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editBrand.primaryColor}
                  onChange={(e) => setEditBrand({ ...editBrand, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={editBrand.primaryColor}
                  onChange={(e) => setEditBrand({ ...editBrand, primaryColor: e.target.value })}
                  className="flex-1 text-xs p-3 rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Couleur Secondaire / Accent (Hex)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editBrand.secondaryColor}
                  onChange={(e) => setEditBrand({ ...editBrand, secondaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={editBrand.secondaryColor}
                  onChange={(e) => setEditBrand({ ...editBrand, secondaryColor: e.target.value })}
                  className="flex-1 text-xs p-3 rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Slogan institutionnel
              </label>
              <input
                type="text"
                value={editBrand.tagline}
                onChange={(e) => setEditBrand({ ...editBrand, tagline: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveBrand}
              className="py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-black shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer les paramètres de marque</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: CONFIGURATION DYNAMIQUE */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Paramètres Système & Données Métier
              </h3>
              <p className="text-xs text-slate-500">
                Configuration enregistrée et indicateurs calculés à partir des tickets de cette agence.
              </p>
            </div>

            <button
              onClick={async () => {
                if (await notifications.confirmAction({title: 'Restaurer la configuration ?', message: 'Les paramètres personnalisés seront remplacés par les valeurs d’origine.', actionLabel: 'Restaurer'})) configService.resetToDefault();
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Restaurer config.json d'origine
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Catégories & Opérations</span>
              <p className="text-slate-500 mb-2">
                {config.categories.length} catégories configurées avec sous-opérations et pièces requises.
              </p>
              <span className="text-[10px] font-mono text-slate-400">
                {config.categories.map((c) => c.labelFr).join(', ')}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Agences Actives</span>
              <p className="text-slate-500 mb-2">
                {config.agencies.length} agences avec profil d'affluence horaire.
              </p>
              <span className="text-[10px] font-mono text-slate-400">
                {config.agencies.map((a) => a.name).join(' • ')}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Devises DZD</span>
              <p className="text-slate-500 mb-2">
                {config.exchangeRates.length} devises actualisées en direct.
              </p>
              <span className="text-[10px] font-mono text-slate-400">
                {config.exchangeRates.map((r) => r.currencyCode).join(', ')}
              </span>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 md:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900 block mb-1">
                    Adresse IP Réseau LAN (QR Codes & Mobiles)
                  </span>
                  <p className="text-slate-600 text-xs">
                    Adresse IP locale intégrée dans les QR codes pour permettre aux clients d'accéder au portail depuis leur smartphone sur le réseau d'agence.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-white text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl shadow-xs">
                    {getPublicUrl('?mode=client')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: RULES ENGINE INTERFACE (TOUTES LES 12 RÈGLES BANCAIRES) */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <RulesEngineInterface counters={queueState.counters} />
      )}

      {/* ========================================================================= */}
      {/* TAB: AUDIT LOGS & SYSTEM EVENTS */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <AuditLogsViewer />
      )}

      {/* AUTHENTICATION LOGIN MODAL */}
      <AuthLoginModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(session) => {
          setCurrentUser(session.user);
        }}
      />
    </div>
  );
};
