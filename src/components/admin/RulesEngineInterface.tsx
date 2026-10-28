import {DEFAULT_QUEUE_RULES} from '../../config/defaultQueueRules';
import {notifications} from '../../services/notificationService';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  Layers,
  Clock,
  ShieldCheck,
  Zap,
  Award,
  Users,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { QueueRule, RuleScoreBreakdown, CounterStation, RuleParameter } from '../../types/queueTypes';
import { configService } from '../../services/configService';
import { queueStore } from '../../services/queueStore';

interface RulesEngineInterfaceProps {
  counters: CounterStation[];
}

export const RulesEngineInterface: React.FC<RulesEngineInterfaceProps> = ({ counters }) => {
  const [rules, setRules] = useState<QueueRule[]>(configService.getRules());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCounterId, setSelectedCounterId] = useState<string>('all');
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [queueState, setQueueState] = useState(queueStore.getState());

  useEffect(() => {
    const unsubConfig = configService.subscribe((cfg) => {
      setRules(cfg.rules || configService.getRules());
    });
    const unsubQueue = queueStore.subscribe((st) => {
      setQueueState(st);
    });
    return () => {
      unsubConfig();
      unsubQueue();
    };
  }, []);

  const saveError=(error:unknown)=>{notifications.error(error instanceof Error?error.message:'Règles non enregistrées.');setRules(configService.getRules());};
  const handleToggleRule = async (ruleId:string,currentEnabled:boolean) => {
    try{await queueStore.updateRule(ruleId,{enabled:!currentEnabled});setSaveBanner('Règle enregistrée pour cette agence.');setTimeout(()=>setSaveBanner(null),2500);}catch(error){saveError(error);}
  };
  const handleParamChange = async (ruleId:string,paramKey:string,newValue:any) => {
    const parameter=configService.getRules().find((r)=>r.id===ruleId)?.parameters[paramKey];
    setRules((current)=>current.map((r)=>r.id===ruleId?{...r,parameters:{...r.parameters,[paramKey]:{...r.parameters[paramKey],value:newValue}}}:r));
    if(parameter?.type==='number'&&(!Number.isFinite(newValue)||(parameter.min!==undefined&&newValue<parameter.min)||(parameter.max!==undefined&&newValue>parameter.max)))return;
    try{await queueStore.updateRule(ruleId,{parameterKey:paramKey,parameterValue:newValue});}catch(error){saveError(error);}
  };
  const handleResetToDefaultRules = async () => {
    if(!await notifications.confirmAction({title:'Restaurer les règles ?',message:'Les réglages de cette agence seront remplacés par les valeurs d’origine.',actionLabel:'Restaurer'}))return;
    try{await queueStore.saveRules(DEFAULT_QUEUE_RULES);setSaveBanner('Règles restaurées.');setTimeout(()=>setSaveBanner(null),3000);}catch(error){saveError(error);}
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = r.code.toLowerCase().includes(q);
        const matchName = r.name.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [rules, selectedCategory, searchQuery]);

  // Live Queue Simulator Candidate breakdown
  const candidateScores: RuleScoreBreakdown[] = useMemo(() => {
    const targetCounterId = selectedCounterId === 'all' ? undefined : selectedCounterId;
    return queueStore.evaluateTicketScores(targetCounterId);
  }, [queueState.tickets, selectedCounterId, rules]);

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* TOP BANNER */}
      {saveBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveBanner}</span>
          </div>
          <button
            onClick={() => setSaveBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER CARD: TITLE & CONTROLS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Moteur de Règles Opérationnelles & Logique de File
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
              {activeRulesCount} / {rules.length} Actives
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Configurez l'intégralité des {rules.length} règles régissant l'algorithme d'ordonnancement bancaire (PMR, VIP, Rendez-vous, FIFO, Habilitations guichet, Escalade SLA et Débordement).
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{queueStore.getPriorityPolicyDescription()}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaultRules}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Réinitialiser toutes les règles à leurs pondérations initiales"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Règles par défaut</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT: RULES CONFIG (LEFT) & LIVE SIMULATOR (RIGHT) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: RULES LIST & EDITORS (7 COLS) */}
        <div className="xl:col-span-7 space-y-4">
          {/* SEARCH & CATEGORY FILTER BAR */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Rechercher une règle (ex: PMR, SLA, FIFO, R-01)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
              {[
                { id: 'all', label: `Toutes (${rules.length})` },
                { id: 'priority', label: 'Priorités' },
                { id: 'assignment', label: 'Guichets' },
                { id: 'sla', label: 'SLA' },
                { id: 'lifecycle', label: 'Cycle & Présence' },
                { id: 'booking', label: 'RDV' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* RULES CARDS */}
          <div className="space-y-3">
            {filteredRules.map((rule) => {
              const isExpanded = expandedRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    rule.enabled
                      ? 'border-slate-200 shadow-xs'
                      : 'border-slate-200/60 bg-slate-50/50 opacity-75'
                  }`}
                >
                  {/* RULE HEADER ROW */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg border ${
                          rule.enabled
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-200 text-slate-500 border-slate-300'
                        }`}
                      >
                        {rule.code}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-slate-900">{rule.name}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">
                            {rule.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{rule.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* TOGGLE SWITCH */}
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id, rule.enabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={rule.enabled ? 'Désactiver la règle' : 'Activer la règle'}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white shadow-xs absolute top-1 transition-transform ${
                            rule.enabled ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>

                      {/* EXPAND DETAILS */}
                      <button
                        type="button"
                        onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={isExpanded ? 'Réduire' : 'Voir détails et paramètres'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED VIEW: RATIONALE, FORMULA & PARAMETERS */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 bg-slate-50/50 rounded-b-2xl">
                      {/* BANKING RATIONALE */}
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900">
                        <strong className="font-bold flex items-center gap-1 mb-0.5 text-blue-950">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          Justification Métier Bancaire :
                        </strong>
                        <p className="text-blue-800 leading-relaxed">{rule.rationale}</p>
                      </div>

                      {/* MATHEMATICAL FORMULA */}
                      <div className="p-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-[11px] font-mono text-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                          Formule Algorithmique :
                        </span>
                        {rule.formulaDescription}
                      </div>

                      {/* PARAMETERS FORM */}
                      {Object.keys(rule.parameters).length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Paramètres Ajustables en Temps Réel :
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(Object.entries(rule.parameters) as [string, RuleParameter][]).map(([key, param]) => (
                              <div
                                key={key}
                                className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1.5"
                              >
                                <div className="flex justify-between items-center text-xs">
                                  <label className="font-bold text-slate-800">{param.label}</label>
                                  {param.type === 'number' && (
                                    <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                                      {param.value} {param.unit || ''}
                                    </span>
                                  )}
                                </div>

                                {param.description && (
                                  <p className="text-[10px] text-slate-500 leading-tight">
                                    {param.description}
                                  </p>
                                )}

                                {param.type === 'number' && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <input
                                      type="range"
                                      min={param.min ?? 0}
                                      max={param.max ?? 100}
                                      step={param.step ?? 1}
                                      value={param.value}
                                      onChange={(e) =>
                                        handleParamChange(rule.id, key, parseFloat(e.target.value))
                                      }
                                      className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                                    />
                                    <input
                                      type="number"
                                      onBlur={()=>setRules(configService.getRules())}
                                      min={param.min ?? 0}
                                      max={param.max ?? 100}
                                      step={param.step ?? 1}
                                      value={param.value}
                                      onChange={(e) =>
                                        handleParamChange(rule.id, key, parseFloat(e.target.value) || 0)
                                      }
                                      className="w-16 px-2 py-1 text-xs font-mono font-bold text-center border border-slate-300 rounded-lg bg-slate-50"
                                    />
                                  </div>
                                )}

                                {param.type === 'boolean' && (
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(param.value)}
                                      onChange={(e) =>
                                        handleParamChange(rule.id, key, e.target.checked)
                                      }
                                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span>Activer ce comportement</span>
                                  </label>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE QUEUE SIMULATOR (5 COLS) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs sticky top-16 space-y-4">
            {/* SIMULATOR HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Simulateur d'Appel en Direct
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Calcul instantané du score et de l'ordre d'appel
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-black font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-800">
                {candidateScores.length} en attente
              </span>
            </div>

            {/* GUICHET FILTER SELECTOR */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Simuler pour le poste guichet :
              </label>
              <select
                value={selectedCounterId}
                onChange={(e) => setSelectedCounterId(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tous guichets confondus (Vue Globale Agence)</option>
                {counters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — Spécialité : {c.assignedCategoryIds.join(', ')}
                  </option>
                ))}
              </select>
            </div>

            {/* LIVE CANDIDATE LIST */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {candidateScores.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Aucun ticket en attente</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Émettez un ticket depuis la borne ou le portail client pour visualiser son score en direct.
                  </p>
                </div>
              ) : (
                candidateScores.map((c) => {
                  const isNext = c.calculatedRank === 1;
                  return (
                    <div
                      key={c.ticket.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isNext
                          ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {/* TOP ROW: RANK, TOKEN, PRIORITY & NEXT BADGE */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                              isNext
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            #{c.calculatedRank}
                          </span>
                          <span className="font-mono font-black text-sm text-slate-900">
                            {c.ticket.tokenNumber}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${
                              c.ticket.priority === 'pmr'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : c.ticket.priority === 'vip'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.ticket.priority}
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Score</span>
                            <span className="font-mono font-black text-base text-indigo-700">
                              {Math.round(c.totalScore)}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-bold">pts</span>
                          </div>
                          {isNext && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                              🎯 Prochain Appelé
                            </span>
                          )}
                        </div>
                      </div>

                      {/* OPERATION & CUSTOMER */}
                      <div className="text-[11px] text-slate-600 mb-2">
                        <span className="font-bold text-slate-800">{c.ticket.customerName}</span> •{' '}
                        <span>{c.ticket.subOperationName}</span>
                      </div>

                      {/* SCORE BREAKDOWN CHIPS */}
                      <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                        {c.mobileArrival && <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800">App : {c.mobileArrival.count}/{c.mobileArrival.tolerance} · {c.mobileArrival.preserved?'rang conservé':'rang à l’arrivée'}</span>}
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700" title="Attente FIFO">
                          Base FIFO: +{Math.round(c.baseWaitScore)}
                        </span>
                        {c.pmrBonus > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold" title="Règle R-01 PMR">
                            PMR: +{c.pmrBonus}
                          </span>
                        )}
                        {c.vipBonus > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold" title="Règle R-02 VIP">
                            VIP: +{c.vipBonus}
                          </span>
                        )}
                        {c.appointmentBonus > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold" title="Règle R-03 RDV">
                            RDV: +{c.appointmentBonus}
                          </span>
                        )}
                        {c.slaEscalationBonus > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold animate-pulse" title="Règle R-06 SLA Escalade">
                            SLA: +{c.slaEscalationBonus}
                          </span>
                        )}
                        {c.kycBonus > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold" title="Règle R-12 KYC Attente Active">
                            KYC: +{c.kycBonus}
                          </span>
                        )}
                      </div>

                      {/* APPLIED RULES BADGES */}
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="font-bold">Règles actives :</span>
                        {c.appliedRules.map((code) => (
                          <span key={code} className="px-1 rounded bg-slate-200/80 text-slate-700 font-mono font-bold">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
