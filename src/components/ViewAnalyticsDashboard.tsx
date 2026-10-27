import React, { useState, useMemo, useCallback } from 'react';
import {
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Building2,
  Users,
  Coins,
  Download,
  Filter,
  Eye,
  Shuffle,
  Palette,
  Search,
  CheckCircle2,
  X,
  Layers,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { TicketRow, ViewTabState, ColumnDef } from '../types';
import { exportTableRowsToExcel } from '../utils/exportUtils';

interface ViewAnalyticsDashboardProps {
  currentTab: ViewTabState;
  allColumns: ColumnDef[];
  onOpenTicket: (ticketId: string) => void;
  onFetchGlobalDataset: (limit: number) => Promise<TicketRow[]>;
}

// Predefined harmonious color palettes for randomized & theme-based graphing
const COLOR_THEMES: Record<string, { label: string; colors: string[] }> = {
  vibrant: {
    label: 'Éclatant Moderne',
    colors: ['#E60028', '#2563EB', '#059669', '#7C3AED', '#D97706', '#0891B2', '#DB2777', '#4F46E5', '#10B981', '#EA580C'],
  },
  sunset: {
    label: 'Coucher de Soleil',
    colors: ['#F43F5E', '#FB923C', '#FBBF24', '#A855F7', '#EC4899', '#E11D48', '#C026D3', '#F97316', '#EAB308', '#6366F1'],
  },
  ocean: {
    label: 'Océan & Émeraude',
    colors: ['#0284C7', '#0D9488', '#10B981', '#06B6D4', '#3B82F6', '#14B8A6', '#6366F1', '#059669', '#38BDF8', '#818CF8'],
  },
  neon: {
    label: 'Néon Électrique',
    colors: ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#F43F5E', '#3B82F6', '#84CC16'],
  },
  pastel: {
    label: 'Pastel Chaud',
    colors: ['#FB7185', '#38BDF8', '#34D399', '#A78BFA', '#FBBF24', '#F472B6', '#2DD4BF', '#818CF8', '#FB923C', '#A3E635'],
  },
  corporate: {
    label: 'Corporate & Graphite',
    colors: ['#E60028', '#334155', '#2563EB', '#0F766E', '#B45309', '#6B21A8', '#475569', '#1D4ED8', '#047857', '#991B1B'],
  },
};

// Generates an array of distinct, vibrant randomized HSL colors
function generateRandomColorPalette(count: number = 16): string[] {
  const colors: string[] = [];
  const goldenRatio = 0.618033988749895;
  let hue = Math.random();

  for (let i = 0; i < count; i++) {
    hue = (hue + goldenRatio) % 1;
    const h = Math.floor(hue * 360);
    const s = 70 + Math.floor(Math.random() * 20); // 70% - 90% saturation
    const l = 45 + Math.floor(Math.random() * 15); // 45% - 60% lightness
    colors.push(`hsl(${h}, ${s}%, ${l}%)`);
  }
  return colors;
}

// Math helpers for SVG Donut / Pie rendering
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
  // Cap slice angle slightly below 360 to prevent SVG arc degenerate zero-length bugs
  const delta = endAngle - startAngle;
  const safeEndAngle = delta >= 360 ? startAngle + 359.999 : endAngle;

  const startOuter = polarToCartesian(x, y, outerRadius, safeEndAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, startAngle);
  const endInner = polarToCartesian(x, y, innerRadius, safeEndAngle);

  const largeArcFlag = delta <= 180 ? '0' : '1';

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

export const ViewAnalyticsDashboard: React.FC<ViewAnalyticsDashboardProps> = ({
  currentTab,
  allColumns,
  onOpenTicket,
  onFetchGlobalDataset,
}) => {
  // SCOPE STATE: 'page' (current page rows) | 'global' (full filtered dataset)
  const [dataScope, setDataScope] = useState<'page' | 'global'>('page');
  const [globalRows, setGlobalRows] = useState<TicketRow[] | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(false);

  // COLOR RANDOMIZER & PALETTE ENGINE
  const [activeTheme, setActiveTheme] = useState<string>('vibrant');
  const [customPalette, setCustomPalette] = useState<string[]>(COLOR_THEMES.vibrant.colors);
  const [paletteSeed, setPaletteSeed] = useState<number>(0);

  // Re-randomize colors handler
  const handleRandomizeColors = useCallback(() => {
    const newColors = generateRandomColorPalette(18);
    setCustomPalette(newColors);
    setActiveTheme('custom');
    setPaletteSeed((prev) => prev + 1);
  }, []);

  const handleSelectTheme = useCallback((themeKey: string) => {
    if (COLOR_THEMES[themeKey]) {
      setActiveTheme(themeKey);
      setCustomPalette(COLOR_THEMES[themeKey].colors);
      setPaletteSeed((prev) => prev + 1);
    }
  }, []);

  // INTERACTIVE FILTER / DRILLDOWN STATE
  const [selectedCategory, setSelectedCategory] = useState<{
    type: 'status' | 'flux' | 'departement' | 'montantTier' | 'all';
    value: string;
  }>({ type: 'all', value: 'Tous' });

  // DRILLDOWN TABLE SEARCH
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');

  // TIME & CHART DISPLAY TOGGLES
  const [timeGrouping, setTimeGrouping] = useState<'day' | 'month'>('day');
  const [fluxMetric, setFluxMetric] = useState<'count' | 'montant'>('count');

  // INTERACTIVE HOVER TOOLTIP STATE
  const [hoveredSlice, setHoveredSlice] = useState<{
    name: string;
    value: number;
    percent: number;
    montant: number;
    color: string;
  } | null>(null);

  const [hoveredBar, setHoveredBar] = useState<{
    name: string;
    count: number;
    montant: number;
    color: string;
  } | null>(null);

  const [hoveredTimePoint, setHoveredTimePoint] = useState<{
    date: string;
    total: number;
    valid: number;
    enCours: number;
    montantTotal: number;
  } | null>(null);

  // LOAD GLOBAL DATASET ON DEMAND
  const handleLoadGlobalData = async (limit: number = 5000) => {
    setLoadingGlobal(true);
    try {
      const rows = await onFetchGlobalDataset(limit);
      setGlobalRows(rows);
      setDataScope('global');
    } catch (err) {
      console.error('[Analytics] Failed to fetch full dataset:', err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  // ACTIVE DATASET ACCORDING TO SCOPE
  const activeDataset = useMemo(() => {
    if (dataScope === 'global' && globalRows && globalRows.length > 0) {
      return globalRows;
    }
    return currentTab.rows;
  }, [dataScope, globalRows, currentTab.rows]);

  // Color generator helper mapped to index
  const getColorForIndex = useCallback(
    (index: number) => {
      return customPalette[index % customPalette.length];
    },
    [customPalette]
  );

  // ==================== AGGREGATIONS ====================

  // 1. STATUS DISTRIBUTION
  const statusData = useMemo(() => {
    const counts: Record<string, { count: number; montantTotal: number }> = {};
    activeDataset.forEach((t) => {
      const st = t.statut || t.status || 'Non défini';
      if (!counts[st]) counts[st] = { count: 0, montantTotal: 0 };
      counts[st].count++;
      counts[st].montantTotal += Number(t.montant) || 0;
    });

    const totalTickets = activeDataset.length || 1;

    return Object.entries(counts)
      .map(([name, data], idx) => ({
        name,
        value: data.count,
        montant: data.montantTotal,
        percent: data.count / totalTickets,
        color: getColorForIndex(idx),
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeDataset, getColorForIndex, paletteSeed]);

  // Compute SVG Donut Slices
  const donutSlices = useMemo(() => {
    const total = statusData.reduce((acc, s) => acc + s.value, 0) || 1;
    let currentAngle = 0;

    return statusData.map((s) => {
      const sliceAngle = (s.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle += sliceAngle;

      return {
        ...s,
        startAngle,
        endAngle,
      };
    });
  }, [statusData]);

  // 2. FLUX DISTRIBUTION
  const fluxData = useMemo(() => {
    const counts: Record<string, { count: number; montantTotal: number }> = {};
    activeDataset.forEach((t) => {
      const fl = t.flux || 'Autre';
      if (!counts[fl]) counts[fl] = { count: 0, montantTotal: 0 };
      counts[fl].count++;
      counts[fl].montantTotal += Number(t.montant) || 0;
    });

    return Object.entries(counts).map(([name, data], idx) => ({
      name,
      count: data.count,
      montant: Math.round(data.montantTotal),
      color: getColorForIndex(idx + 2),
    }));
  }, [activeDataset, getColorForIndex, paletteSeed]);

  // 3. TIMELINE EVOLUTION
  const timeData = useMemo(() => {
    const map: Record<string, { date: string; total: number; valid: number; enCours: number; montantTotal: number }> = {};

    activeDataset.forEach((t) => {
      const rawDate = t.dateCreation || t.createdAt || '';
      if (!rawDate) return;

      let key = rawDate.slice(0, 10);
      if (timeGrouping === 'month') {
        key = rawDate.slice(0, 7); // YYYY-MM
      }

      if (!map[key]) {
        map[key] = { date: key, total: 0, valid: 0, enCours: 0, montantTotal: 0 };
      }

      map[key].total++;
      map[key].montantTotal += Number(t.montant) || 0;

      const s = (t.statut || t.status || '').toLowerCase();
      if (
        s.includes('valid') ||
        s.includes('approuv') ||
        s.includes('payé') ||
        s.includes('clôtur')
      ) {
        map[key].valid++;
      } else {
        map[key].enCours++;
      }
    });

    const list = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [activeDataset, timeGrouping]);

  // 4. DEPARTMENT BREAKDOWN
  const departementData = useMemo(() => {
    const counts: Record<string, { count: number; montant: number }> = {};
    activeDataset.forEach((t) => {
      const d = t.departement || 'Non spécifié';
      if (!counts[d]) counts[d] = { count: 0, montant: 0 };
      counts[d].count++;
      counts[d].montant += Number(t.montant) || 0;
    });

    return Object.entries(counts)
      .map(([name, data], idx) => ({
        name: name.length > 24 ? `${name.substring(0, 22)}…` : name,
        fullName: name,
        count: data.count,
        montant: data.montant,
        color: getColorForIndex(idx + 4),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [activeDataset, getColorForIndex, paletteSeed]);

  // 5. FINANCIAL AMOUNT TIERS (HISTOGRAM/TIERS IN DZD)
  const montantTiersData = useMemo(() => {
    const tiers = [
      { label: '< 500k DZD', min: 0, max: 500000, count: 0, sum: 0 },
      { label: '500k – 1.5M DZD', min: 500000, max: 1500000, count: 0, sum: 0 },
      { label: '1.5M – 3M DZD', min: 1500000, max: 3000000, count: 0, sum: 0 },
      { label: '> 3M DZD', min: 3000000, max: Infinity, count: 0, sum: 0 },
    ];

    activeDataset.forEach((t) => {
      const amt = Number(t.montant) || 0;
      for (const tier of tiers) {
        if (amt >= tier.min && amt < tier.max) {
          tier.count++;
          tier.sum += amt;
          break;
        }
      }
    });

    return tiers.map((tier, idx) => ({
      name: tier.label,
      count: tier.count,
      sum: tier.sum,
      color: getColorForIndex(idx + 6),
    }));
  }, [activeDataset, getColorForIndex, paletteSeed]);

  // 6. FILTERED DRILLDOWN TICKETS LIST
  const filteredDrilldownTickets = useMemo(() => {
    let list = activeDataset;

    if (selectedCategory.type === 'status') {
      list = list.filter((t) => (t.statut || t.status) === selectedCategory.value);
    } else if (selectedCategory.type === 'flux') {
      list = list.filter((t) => t.flux === selectedCategory.value);
    } else if (selectedCategory.type === 'departement') {
      list = list.filter((t) => (t.departement || '') === selectedCategory.value);
    } else if (selectedCategory.type === 'montantTier') {
      if (selectedCategory.value === '< 500k DZD') {
        list = list.filter((t) => (Number(t.montant) || 0) < 500000);
      } else if (selectedCategory.value === '500k – 1.5M DZD') {
        list = list.filter((t) => (Number(t.montant) || 0) >= 500000 && (Number(t.montant) || 0) < 1500000);
      } else if (selectedCategory.value === '1.5M – 3M DZD') {
        list = list.filter((t) => (Number(t.montant) || 0) >= 1500000 && (Number(t.montant) || 0) < 3000000);
      } else if (selectedCategory.value === '> 3M DZD') {
        list = list.filter((t) => (Number(t.montant) || 0) >= 3000000);
      }
    }

    if (drilldownSearch.trim()) {
      const q = drilldownSearch.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.id && t.id.toLowerCase().includes(q)) ||
          (t.objet && t.objet.toLowerCase().includes(q)) ||
          (t.demandeur && t.demandeur.toLowerCase().includes(q)) ||
          (t.departement && t.departement.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeDataset, selectedCategory, drilldownSearch]);

  // EXPORT SUMMARY REPORT TO EXCEL (OFFLINE)
  const handleExportSummary = () => {
    exportTableRowsToExcel(
      activeDataset,
      allColumns,
      currentTab.exportCols,
      `Rapport-Analytique-Vue-${activeDataset.length}-tickets`
    );
  };

  if (currentTab.noAllowedFlux) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Accès restreint aux flux de processus
        </h2>
        <div className="my-3 px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center gap-2 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <code>{`{"reason": "${currentTab.noAllowedFluxReason || 'No allowed flux for user groups or filter.'}"}`}</code>
        </div>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Aucun flux de processus (Achat, Approvisionnement, Facturation) n'est autorisé pour vos groupes d'utilisateurs ou pour les filtres sélectionnés.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          La vue graphique nécessite des droits de consultation sur au moins un flux.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
      {/* TOP CONTROL BAR: SCOPE, COLOR PALETTE RANDOMIZER & ACTIONS */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Scope Selection & Counts */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setDataScope('page')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                dataScope === 'page'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Page Active ({currentTab.rows.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (!globalRows) {
                  handleLoadGlobalData(5000);
                } else {
                  setDataScope('global');
                }
              }}
              disabled={loadingGlobal}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                dataScope === 'global'
                  ? 'bg-[#E60028] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {loadingGlobal && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>
                Filtre Global {globalRows ? `(${globalRows.length})` : `(~${currentTab.total})`}
              </span>
            </button>
          </div>

          {dataScope === 'global' && globalRows && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{globalRows.length} tickets analysés en mode hors-ligne</span>
            </span>
          )}
        </div>

        {/* Right: Color Randomizer & Theme Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Palette Randomizer Button */}
          <button
            type="button"
            onClick={handleRandomizeColors}
            title="Générer de nouvelles couleurs aléatoires pour tous les graphiques"
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1.5 border border-slate-200/90 transition-all cursor-pointer active:scale-95"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#E60028]" />
            <span>Randomiser les Couleurs</span>
          </button>

          {/* Preset Theme Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg text-xs">
            <Palette className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <select
              value={activeTheme}
              onChange={(e) => handleSelectTheme(e.target.value)}
              className="bg-transparent text-slate-700 text-xs font-semibold py-1 px-1.5 rounded outline-none cursor-pointer"
            >
              {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                <option key={key} value={key}>
                  {theme.label}
                </option>
              ))}
              {activeTheme === 'custom' && <option value="custom">Palette Aléatoire 🔀</option>}
            </select>
          </div>

          {/* Active Filter Indicator */}
          {selectedCategory.type !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory({ type: 'all', value: 'Tous' })}
              className="text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-[#E60028] px-2.5 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Filter className="w-3 h-3" />
              <span>Filtre : {selectedCategory.value}</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}

          {/* Excel Export */}
          <button
            type="button"
            onClick={handleExportSummary}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter ({activeDataset.length})</span>
          </button>
        </div>
      </div>

      {/* CHARTS GRID - ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART 1: INTERACTIVE SVG DONUT CHART (STATUT) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-[#E60028]" />
                <span>Répartition par Statut</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Survolez ou cliquez sur un secteur pour filtrer</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {statusData.length} statuts
            </span>
          </div>

          {/* Native SVG Donut Chart */}
          <div className="relative w-full h-56 flex items-center justify-center my-auto">
            <svg viewBox="0 0 240 240" className="w-56 h-56 transform transition-transform duration-300">
              <g transform="translate(120, 120)">
                {donutSlices.map((slice, idx) => {
                  const isHovered = hoveredSlice?.name === slice.name;
                  const isSelected = selectedCategory.type === 'status' && selectedCategory.value === slice.name;
                  const outerR = isHovered || isSelected ? 92 : 84;
                  const innerR = 56;
                  const pathD = describeDonutSlice(0, 0, innerR, outerR, slice.startAngle, slice.endAngle);

                  return (
                    <path
                      key={`donut-slice-${idx}`}
                      d={pathD}
                      fill={slice.color}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer hover:opacity-90"
                      style={{
                        filter: isHovered || isSelected ? 'drop-shadow(0px 4px 10px rgba(0,0,0,0.2))' : 'none',
                      }}
                      onMouseEnter={() => setHoveredSlice(slice)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() =>
                        setSelectedCategory({
                          type: 'status',
                          value: slice.name,
                        })
                      }
                    />
                  );
                })}
              </g>
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredSlice ? (
                <>
                  <span className="text-lg font-black text-slate-900 tracking-tight">
                    {hoveredSlice.value}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px] text-center">
                    {hoveredSlice.name}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {Math.round(hoveredSlice.percent * 100)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {activeDataset.length.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tickets</span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend Tags */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-slate-100 max-h-24 overflow-y-auto">
            {statusData.map((st) => (
              <button
                key={st.name}
                type="button"
                onMouseEnter={() => setHoveredSlice(st)}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setSelectedCategory({ type: 'status', value: st.name })}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                  selectedCategory.type === 'status' && selectedCategory.value === st.name
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                <span>{st.name}</span>
                <span className="font-mono text-[10px] opacity-75">({st.value})</span>
              </button>
            ))}
          </div>
        </div>

        {/* CHART 2: INTERACTIVE SVG BAR CHART (FLUX) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Volume par Type de Flux</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribution par typologie métier</p>
            </div>

            {/* Metric Toggle: Count vs Amount */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setFluxMetric('count')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  fluxMetric === 'count' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Nombre
              </button>
              <button
                type="button"
                onClick={() => setFluxMetric('montant')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  fluxMetric === 'montant' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Montant (DZD)
              </button>
            </div>
          </div>

          {/* Native SVG Bar Chart */}
          <div className="relative w-full h-56 my-auto flex flex-col justify-end">
            {fluxData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                Aucune donnée de flux
              </div>
            ) : (
              <div className="w-full h-44 flex items-end gap-3 px-2 pb-6 border-b border-slate-200">
                {(() => {
                  const maxVal = Math.max(
                    ...fluxData.map((f) => (fluxMetric === 'count' ? f.count : f.montant)),
                    1
                  );

                  return fluxData.map((f, idx) => {
                    const currentVal = fluxMetric === 'count' ? f.count : f.montant;
                    const heightPercent = Math.max(8, (currentVal / maxVal) * 100);
                    const isSelected = selectedCategory.type === 'flux' && selectedCategory.value === f.name;

                    return (
                      <div
                        key={`bar-${idx}`}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                        onMouseEnter={() => setHoveredBar(f)}
                        onMouseLeave={() => setHoveredBar(null)}
                        onClick={() => setSelectedCategory({ type: 'flux', value: f.name })}
                      >
                        {/* Bar Pillar */}
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isSelected ? 'ring-2 ring-slate-800' : 'group-hover:opacity-85'
                          }`}
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: f.color,
                          }}
                        />

                        {/* Label beneath bar */}
                        <span className="absolute -bottom-5 text-[10px] font-bold text-slate-600 truncate max-w-full text-center">
                          {f.name}
                        </span>

                        {/* Top value */}
                        <span className="text-[10px] font-mono font-bold text-slate-700 mb-1 opacity-90">
                          {fluxMetric === 'count'
                            ? f.count
                            : f.montant >= 1000000
                            ? `${(f.montant / 1000000).toFixed(1)}M`
                            : `${(f.montant / 1000).toFixed(0)}k`}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Hover Tooltip display */}
            {hoveredBar && (
              <div className="absolute top-1 right-2 bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700 pointer-events-none z-10">
                <span className="font-bold">{hoveredBar.name}</span> : {hoveredBar.count} tickets (
                {hoveredBar.montant.toLocaleString('fr-FR')} DZD)
              </div>
            )}
          </div>

          <div className="flex items-center justify-around pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {fluxData.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelectedCategory({ type: 'flux', value: f.name })}
                className="text-center hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className="font-black block text-slate-800 text-xs">{f.count}</span>
                <span className="text-[10px] text-slate-400">{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CHART 3: TOP DÉPARTEMENTS (HORIZONTAL BARS WITH INTERACTIVE DRILLDOWN) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Top Départements</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Répartition organisationnelle</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {departementData.length} directions
            </span>
          </div>

          {/* Interactive Progress Rows */}
          <div className="flex flex-col gap-2.5 my-auto max-h-56 overflow-y-auto pr-1">
            {departementData.map((dept) => {
              const maxCount = Math.max(...departementData.map((d) => d.count), 1);
              const ratio = (dept.count / maxCount) * 100;
              const isSelected = selectedCategory.type === 'departement' && selectedCategory.value === dept.fullName;

              return (
                <div
                  key={dept.fullName}
                  onClick={() =>
                    setSelectedCategory({ type: 'departement', value: dept.fullName })
                  }
                  className={`flex flex-col gap-1 p-1.5 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border border-emerald-300 shadow-xs'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      <span className="font-semibold text-slate-700 truncate">{dept.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900">{dept.count}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(6, ratio)}%`,
                        backgroundColor: dept.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cliquez sur une ligne pour filtrer</span>
            <span className="font-semibold text-slate-700">
              {departementData.reduce((acc, d) => acc + d.count, 0)} tickets cumulés
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS GRID - ROW 2: TIMELINE TREND & FINANCIAL TIERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART 4: TIMELINE EVOLUTION (NATIVE SVG AREA GRAPH) */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between min-h-[320px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Évolution Temporelle des Créations</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tendances chronologiques des volumes de tickets
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTimeGrouping('day')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  timeGrouping === 'day' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                Par Jour
              </button>
              <button
                type="button"
                onClick={() => setTimeGrouping('month')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  timeGrouping === 'month' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                Par Mois
              </button>
            </div>
          </div>

          {/* Native SVG Area/Line Chart */}
          <div className="relative w-full h-56 my-auto">
            {timeData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Calendar className="w-8 h-8 text-slate-300 mb-1" />
                <span>Aucune date de création exploitable</span>
              </div>
            ) : (
              (() => {
                const maxVal = Math.max(...timeData.map((d) => d.total), 1);
                const width = 600;
                const height = 180;
                const padLeft = 30;
                const padBottom = 25;
                const chartW = width - padLeft - 10;
                const chartH = height - padBottom - 10;

                const points = timeData.map((d, idx) => {
                  const x =
                    timeData.length === 1
                      ? padLeft + chartW / 2
                      : padLeft + (idx / (timeData.length - 1)) * chartW;
                  const y = height - padBottom - (d.total / maxVal) * chartH;
                  const yValid = height - padBottom - (d.valid / maxVal) * chartH;
                  return { x, y, yValid, data: d };
                });

                const totalPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const totalAreaPath = `${totalPath} L ${points[points.length - 1].x} ${height - padBottom} L ${
                  points[0].x
                } ${height - padBottom} Z`;

                const validPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yValid}`).join(' ');

                return (
                  <div className="w-full h-full relative">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="timeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={customPalette[0] || '#E60028'} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={customPalette[0] || '#E60028'} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      {/* Gridlines */}
                      <line
                        x1={padLeft}
                        y1={height - padBottom}
                        x2={width - 10}
                        y2={height - padBottom}
                        stroke="#E2E8F0"
                        strokeWidth="1"
                      />
                      <line
                        x1={padLeft}
                        y1={height - padBottom - chartH / 2}
                        x2={width - 10}
                        y2={height - padBottom - chartH / 2}
                        stroke="#F1F5F9"
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={padLeft}
                        y1={height - padBottom - chartH}
                        x2={width - 10}
                        y2={height - padBottom - chartH}
                        stroke="#F1F5F9"
                        strokeDasharray="4 4"
                      />

                      {/* Shaded Area */}
                      <path d={totalAreaPath} fill="url(#timeAreaGradient)" />

                      {/* Total Line */}
                      <path
                        d={totalPath}
                        fill="none"
                        stroke={customPalette[0] || '#E60028'}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Valid Line */}
                      <path
                        d={validPath}
                        fill="none"
                        stroke={customPalette[2] || '#10B981'}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        strokeLinecap="round"
                      />

                      {/* Points */}
                      {points.map((p, idx) => (
                        <g key={`pt-${idx}`}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill="#FFFFFF"
                            stroke={customPalette[0] || '#E60028'}
                            strokeWidth={2}
                            className="cursor-pointer hover:r-6 transition-all"
                            onMouseEnter={() => setHoveredTimePoint(p.data)}
                            onMouseLeave={() => setHoveredTimePoint(null)}
                          />
                          {/* Label on X Axis */}
                          {(timeData.length <= 8 || idx % Math.ceil(timeData.length / 8) === 0) && (
                            <text
                              x={p.x}
                              y={height - 5}
                              fontSize="10"
                              fill="#64748B"
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {timeGrouping === 'day' ? p.data.date.slice(5) : p.data.date}
                            </text>
                          )}
                        </g>
                      ))}
                    </svg>

                    {/* Active Hover Tooltip */}
                    {hoveredTimePoint && (
                      <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-10">
                        <p className="font-bold text-white mb-0.5">{hoveredTimePoint.date}</p>
                        <p className="text-slate-300">
                          Total créés : <strong className="text-white">{hoveredTimePoint.total}</strong>
                        </p>
                        <p className="text-emerald-400">
                          Validés : <strong>{hoveredTimePoint.valid}</strong>
                        </p>
                        {hoveredTimePoint.montantTotal > 0 && (
                          <p className="text-amber-300 mt-0.5">
                            Volume : {hoveredTimePoint.montantTotal.toLocaleString('fr-FR')} DZD
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: customPalette[0] || '#E60028' }}
                />
                Volume de créations
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: customPalette[2] || '#10B981' }}
                />
                Tickets validés
              </span>
            </div>
            <span className="font-semibold text-slate-700">{timeData.length} dates enregistrées</span>
          </div>
        </div>

        {/* CHART 5: TRANCHES FINANCIÈRES & MONTANTS (DZD) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between min-h-[320px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>Tranches Financières (DZD)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribution par palier de montant</p>
            </div>
          </div>

          {/* Native SVG Bar Chart for Amount Tiers */}
          <div className="w-full h-56 my-auto flex flex-col justify-end">
            <div className="w-full h-44 flex items-end gap-3 px-2 pb-6 border-b border-slate-200">
              {(() => {
                const maxVal = Math.max(...montantTiersData.map((t) => t.count), 1);

                return montantTiersData.map((tier, idx) => {
                  const heightPercent = Math.max(8, (tier.count / maxVal) * 100);
                  const isSelected = selectedCategory.type === 'montantTier' && selectedCategory.value === tier.name;

                  return (
                    <div
                      key={`tier-bar-${idx}`}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      onClick={() =>
                        setSelectedCategory({
                          type: 'montantTier',
                          value: tier.name,
                        })
                      }
                    >
                      {/* Bar */}
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isSelected ? 'ring-2 ring-slate-800' : 'group-hover:opacity-85'
                        }`}
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: tier.color,
                        }}
                      />

                      {/* Label beneath */}
                      <span className="absolute -bottom-5 text-[9px] font-bold text-slate-600 truncate max-w-full text-center">
                        {tier.name}
                      </span>

                      {/* Value atop */}
                      <span className="text-[10px] font-mono font-bold text-slate-700 mb-1 opacity-90">
                        {tier.count}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cliquez sur une tranche pour filtrer</span>
            <span className="font-semibold text-amber-700">Paliers en Dinars (DZD)</span>
          </div>
        </div>
      </div>

      {/* DRILLDOWN TICKETS PREVIEW TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header with Search & Filter Badge */}
        <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#E60028]" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Aperçu des Tickets Filtrés :{' '}
              <span className="text-[#E60028]">
                {selectedCategory.type === 'all'
                  ? 'Échantillon Global'
                  : `${selectedCategory.type.toUpperCase()} : ${selectedCategory.value}`}
              </span>{' '}
              ({filteredDrilldownTickets.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick In-Table Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={drilldownSearch}
                onChange={(e) => setDrilldownSearch(e.target.value)}
                placeholder="Recherche rapide dans l'aperçu..."
                className="bg-white text-xs pl-7 pr-3 py-1 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#E60028] w-48 sm:w-64"
              />
              {drilldownSearch && (
                <button
                  type="button"
                  onClick={() => setDrilldownSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {selectedCategory.type !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory({ type: 'all', value: 'Tous' })}
                className="text-xs font-medium text-slate-600 hover:text-[#E60028] underline cursor-pointer"
              >
                Réinitialiser le filtre
              </button>
            )}
          </div>
        </div>

        {/* Tickets Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">N° Ticket</th>
                <th className="py-2.5 px-3">Flux</th>
                <th className="py-2.5 px-3">Objet</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-3">Demandeur</th>
                <th className="py-2.5 px-3">Département</th>
                <th className="py-2.5 px-3 text-right">Montant</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDrilldownTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                    Aucun ticket ne correspond au filtre sélectionné.
                  </td>
                </tr>
              ) : (
                filteredDrilldownTickets.slice(0, 20).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{t.id}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {t.flux}
                      </span>
                    </td>
                    <td className="py-2 px-3 max-w-xs truncate font-medium text-slate-700">
                      {t.objet}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-block bg-slate-100 text-slate-700 border border-slate-200">
                        {t.statut}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 truncate">{t.demandeur || '—'}</td>
                    <td className="py-2 px-3 text-slate-600 truncate">{t.departement || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                      {t.montant ? `${Number(t.montant).toLocaleString('fr-FR')} DZD` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onOpenTicket(t.ticketKey || t.id)}
                        className="px-2.5 py-1 rounded bg-[#E60028] hover:bg-[#B4001F] text-white font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
