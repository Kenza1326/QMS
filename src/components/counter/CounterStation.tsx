import {noShowPolicy} from '../../services/callLifecycle';
import {configService} from '../../services/configService';
import {notifications} from '../../services/notificationService';
import {normalizeCustomerName} from '../../utils/queueValidation';
import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Bell,
  Play,
  CheckCircle2,
  UserX,
  Clock,
  Users,
  AlertCircle,
  Building2,
  Check,
  FileText,
  ShieldCheck,
  Eye,
  X,
  Sparkles,
  MapPin,
  User,
} from 'lucide-react';
import { QueueSystemConfig, CounterStation as ICounterStation, QueueTicket, KycDossier, isEntreeEnRelationTicket } from '../../types/queueTypes';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { queueStore, QueueState } from '../../services/queueStore';
import { authService } from '../../services/authService';
import { AuthLoginModal } from '../common/AuthLoginModal';

interface CounterStationProps {
  config: QueueSystemConfig;
  queueState: QueueState;
}

export const CounterStation: React.FC<CounterStationProps> = ({
  config,
  queueState,
}) => {
  const counters = config?.counters?.length ? config.counters : DEFAULT_QUEUE_CONFIG.counters;
  const categories = config?.categories?.length ? config.categories : DEFAULT_QUEUE_CONFIG.categories;

  const [selectedCounterId, setSelectedCounterId] = useState<string>(
    counters[0]?.id || 'counter-1'
  );
  const [serviceTimerSeconds, setServiceTimerSeconds] = useState<number>(0);
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const [showKycDossierModal, setShowKycDossierModal] = useState<boolean>(false);
  const [zoomedDoc, setZoomedDoc] = useState<any>(null);
  const [kycValidationSuccess, setKycValidationSuccess] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsub = authService.subscribe((s) => {
      setCurrentUser(s?.user || null);
      if (s?.user?.assignedCounterId) {
        setSelectedCounterId(s.user.assignedCounterId);
      }
    });
    return unsub;
  }, []);

  const activeCounter =
    queueState.counters.find((c) => c.id === selectedCounterId) ||
    queueState.counters[0];

  const currentTicket = queueState.tickets.find(
    (t) => t.id === activeCounter?.currentTicketId
  );

  // Calculate waiting tickets for agency and counter assigned categories
  const totalAgencyWaitingTickets = queueState.tickets.filter(
    (t) => t.status === 'waiting'
  );

  const assignedWaitingTickets = totalAgencyWaitingTickets.filter(
    (t) => activeCounter?.assignedCategoryIds?.includes(t.categoryId)
  );

  // STRICT: Guichet can ONLY view and call tickets matching his specialization
  const waitingTickets = assignedWaitingTickets;

  // Timer for active service
  useEffect(() => {
    let interval: any = null;
    if (activeCounter?.status === 'serving' && activeCounter.serviceStartTime) {
      const updateTimer = () => {
        const start = new Date(activeCounter.serviceStartTime!).getTime();
        const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
        setServiceTimerSeconds(diffSec);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setServiceTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCounter?.status, activeCounter?.serviceStartTime]);

  const absencePolicy=noShowPolicy(configService.getRules());
  const recallLimitReached=absencePolicy.enabled&&(currentTicket?.recallCount||0)>=absencePolicy.maxRecalls;
  const operatorName = currentUser ? `${currentUser.name} (${currentUser.roleLabel})` : activeCounter?.agentName;

  const busy = React.useRef(false);
  const [isActing, setIsActing] = useState(false);
  const runAction = async (action:()=>Promise<void>) => {
    if (busy.current) return; busy.current=true; setIsActing(true);
    try { await action(); } catch(error) { notifications.error(error instanceof Error ? error.message : 'Action impossible.'); }
    finally { busy.current=false; setIsActing(false); }
  };
  const handleCallNext = () => runAction(async () => {
    if (!activeCounter) return;
    setEmptyNotice(null);
    const called = await queueStore.callNext(activeCounter.id, operatorName);
    if (!called) {
      setEmptyNotice('Aucun client en attente pour les spécialités de ce guichet.');
      setTimeout(() => setEmptyNotice(null), 4000);
    }
  });

  const handleRecall = () => runAction(async () => {
    if (!activeCounter) return;
    await queueStore.recall(activeCounter.id, operatorName);
  });

  const handleStartServing = () => runAction(async () => {
    if (!activeCounter) return;
    await queueStore.startServing(activeCounter.id, operatorName);
  });

  const handleCompleteTicket = () => runAction(async () => {
    if (!activeCounter) return;
    await queueStore.completeTicket(activeCounter.id, operatorName);
  });

  const handleMarkNoShow = () => runAction(async () => {
    if (!activeCounter) return;
    await queueStore.markNoShow(activeCounter.id, operatorName);
  });

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* COUNTER SELECTOR TABS */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            Poste :
          </span>
          {queueState.counters.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCounterId(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                selectedCounterId === c.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  c.status === 'serving'
                    ? 'bg-emerald-400 animate-pulse'
                    : c.status === 'calling'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-slate-400'
                }`}
              />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 px-2">
          {/* AGENT PROFILE SWITCHER */}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-2 py-1 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
            title="Changer d'agent ou se connecter"
          >
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
            ) : (
              <User className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="text-slate-500 font-semibold hidden sm:inline">Agent :</span>
            <strong className="text-slate-800">{currentUser ? currentUser.name : (activeCounter?.agentName || 'Non assigné')}</strong>
          </button>
        </div>
      </div>

      {/* MAIN DESK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: CURRENT TICKET & CONTROLS (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Ticket en cours de traitement
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  activeCounter?.status === 'serving'
                    ? 'bg-blue-100 text-blue-800'
                    : activeCounter?.status === 'calling'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {activeCounter?.status === 'serving'
                  ? 'Entretien en cours'
                  : activeCounter?.status === 'calling'
                  ? 'Appelé (En attente présentation)'
                  : 'Guichet Libre'}
              </span>
            </div>

            {/* CURRENT TICKET HERO */}
            {currentTicket ? (
              <div className="my-6 text-center">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  {currentTicket.subOperationName}
                </span>

                <div
                  className="font-mono text-5xl sm:text-6xl font-black my-2 tracking-wider inline-block"
                  style={{ color: config.brand.primaryColor }}
                >
                  {currentTicket.tokenNumber}
                </div>

                <div className="mt-1 flex min-w-0 items-start justify-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="min-w-0 max-w-[24rem] line-clamp-2 [overflow-wrap:anywhere]">Client : {normalizeCustomerName(currentTicket.customerName, 'Visiteur')}</span>
                  {currentTicket.priority === 'pmr' && (
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold">
                      PMR
                    </span>
                  )}
                  {currentTicket.priority === 'vip' && (
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                      VIP
                    </span>
                  )}
                </div>

                {/* SERVICE TIMER / STATUS BADGE (Fixed height container to prevent button layout shift) */}
                <div className="h-9 my-3 flex items-center justify-center">
                  {activeCounter?.status === 'serving' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-mono font-bold shadow-xs">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Durée d'entretien : {formatTimer(serviceTimerSeconds)}</span>
                    </div>
                  ) : activeCounter?.status === 'calling' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Appel en cours • En attente au guichet</span>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}
                </div>

                {/* KYC ACTIVE WAIT DOSSIER HERO BADGE FOR TELLER - ONLY AND ONLY FOR ENTRÉE EN RELATION */}
                {isEntreeEnRelationTicket(currentTicket) && (
                  currentTicket.kycDossier?.status === 'completed' ? (
                  <div className="mt-5 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-left flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                          ⚡ Attente Active • Dossier KYC Pré-rempli Reçu
                        </span>
                        <span className="text-xs font-black text-emerald-950">
                          3 pièces numérisées (CNI recto/verso + résidence)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowKycDossierModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter KYC</span>
                    </button>
                  </div>
                ) : currentTicket.kycDossier?.status === 'in_progress' ? (
                  <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-left flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                          ⚡ Attente Active • En cours sur smartphone
                        </span>
                        <span className="text-xs font-bold text-amber-950">
                          Le client est en train de numériser ses pièces
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowKycDossierModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs cursor-pointer shrink-0"
                    >
                      Aperçu
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-[11px]">Dossier KYC non complété sur mobile</span>
                    </div>
                    
                  </div>
                ))}
              </div>
            ) : (
              <div className="my-10 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-base font-bold text-slate-700">Aucun client au guichet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cliquez sur « Appeler le suivant » pour faire avancer la file
                </p>
              </div>
            )}

            {/* ACTION BUTTONS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100">
              {/* 1. APPELER LE SUIVANT */}
              <button
                onClick={handleCallNext}
                disabled={isActing}
                className="py-3 px-3 rounded-2xl font-bold text-xs text-white flex flex-col items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer hover:opacity-90"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                <Megaphone className="w-4 h-4" />
                <span>Appeler le suivant</span>
              </button>

              {/* 2. RAPPELER */}
              <button
                onClick={handleRecall}
                disabled={isActing || !currentTicket || activeCounter?.status === 'serving' || recallLimitReached}
                title={recallLimitReached ? 'Limite de rappels atteinte : déclarez le client absent ou attendez l’expiration.' : 'Rappeler le client'}
                className="py-3 px-3 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white flex flex-col items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Bell className="w-4 h-4" />
                <span>Rappeler</span>
              </button>

              {/* 3. DÉBUTER SERVICE */}
              <button
                onClick={handleStartServing}
                disabled={isActing || !currentTicket || activeCounter?.status === 'serving'}
                className="py-3 px-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                <span>Prise en charge</span>
              </button>

              {/* 4. TERMINER */}
              <button
                onClick={handleCompleteTicket}
                disabled={isActing || !currentTicket}
                className="py-3 px-3 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black text-white flex flex-col items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Terminer</span>
              </button>
            </div>

            {currentTicket?.status === 'called' && absencePolicy.enabled && <p className="mt-3 text-xs text-slate-500">Sans prise en charge, le ticket passe en Absent après {absencePolicy.timeoutSeconds} s depuis le dernier appel ou rappel.</p>}
            {/* SECONDARY ROW: NO-SHOW & QUICK ADD */}
            {currentTicket?.status === 'called' && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleMarkNoShow}
                  disabled={isActing}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold px-3 py-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Client absent (No-show)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: WAITING TICKETS QUEUE FOR THIS COUNTER (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>File d'attente dédiée ({waitingTickets.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                  Spécialité : {activeCounter?.assignedCategoryIds?.length ? activeCounter.assignedCategoryIds.map((cid) => {
                    const cat = categories.find((c) => c.id === cid);
                    return cat ? cat.labelFr : cid;
                  }).join(', ') : 'Toutes opérations'}
                </span>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                {waitingTickets.length} en attente
              </span>
            </div>

            {emptyNotice && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{emptyNotice}</span>
              </div>
            )}

            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
              {waitingTickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400 w-4">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900">
                          {ticket.tokenNumber}
                        </span>
                        {ticket.priority === 'pmr' && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold text-[9px]">
                            PMR
                          </span>
                        )}
                        {ticket.priority === 'vip' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                            VIP
                          </span>
                        )}
                        {isEntreeEnRelationTicket(ticket) && ticket.kycDossier?.status === 'completed' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[9px] flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                            <span>KYC prêt</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[170px]">
                        {ticket.subOperationName}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold">
                      {queueStore.getTicketEstimate(ticket).estimatedMinutes === null ? 'Guichets indisponibles' : queueStore.getTicketEstimate(ticket).estimatedMinutes === 0
                        ? 'Immédiat (< 1 min)'
                        : `~${queueStore.getTicketEstimate(ticket).estimatedMinutes} min`}
                    </span>
                  </div>
                </div>
              ))}

              {waitingTickets.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Aucun client en attente pour les opérations de ce guichet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* KYC DOSSIER MODAL FOR TELLER CONSULTATION */}
      {/* ============================================================ */}
      {showKycDossierModal && currentTicket?.kycDossier && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border-2 border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Dossier KYC Client • {currentTicket.tokenNumber}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Pré-rempli via smartphone durant l'attente active
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowKycDossierModal(false);
                  setKycValidationSuccess(false);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {kycValidationSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Dossier KYC validé avec succès ! Les données sont intégrées au dossier d'ouverture de compte.</span>
                </div>
              )}

              {/* 3 Document Previews */}
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-2">
                  1. Pièces Justificatives Numérisées (3 documents)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* CNI Recto */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 block">CNI Recto</span>
                    {currentTicket.kycDossier.documents.idRecto ? (
                      <div
                        onClick={() => setZoomedDoc(currentTicket.kycDossier!.documents.idRecto)}
                        className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-300"
                      >
                        <img
                          src={currentTicket.kycDossier.documents.idRecto.previewUrl}
                          alt="Recto"
                          className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          Agrandir
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        Non fourni
                      </div>
                    )}
                  </div>

                  {/* CNI Verso */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 block">CNI Verso</span>
                    {currentTicket.kycDossier.documents.idVerso ? (
                      <div
                        onClick={() => setZoomedDoc(currentTicket.kycDossier!.documents.idVerso)}
                        className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-300"
                      >
                        <img
                          src={currentTicket.kycDossier.documents.idVerso.previewUrl}
                          alt="Verso"
                          className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          Agrandir
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        Non fourni
                      </div>
                    )}
                  </div>

                  {/* Residence */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 block">Résidence</span>
                    {currentTicket.kycDossier.documents.residence ? (
                      <div
                        onClick={() => setZoomedDoc(currentTicket.kycDossier!.documents.residence)}
                        className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-300"
                      >
                        <img
                          src={currentTicket.kycDossier.documents.residence.previewUrl}
                          alt="Résidence"
                          className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          Agrandir
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                        Non fourni
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Extracted Form Table */}
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-2">
                  2. Données Formulaire Extraites par OCR
                </span>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Nom Complet</span>
                    <span className="font-black text-slate-900 text-sm">{currentTicket.kycDossier.formData.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">NIN (Identification Nationale)</span>
                    <span className="font-mono font-black text-blue-700 text-sm">{currentTicket.kycDossier.formData.nin}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">N° Pièce Identité</span>
                    <span className="font-mono font-bold text-slate-800">{currentTicket.kycDossier.formData.documentNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Date Expiration</span>
                    <span className="font-semibold text-slate-800">{currentTicket.kycDossier.formData.expiryDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Date & Lieu de Naissance</span>
                    <span className="font-semibold text-slate-800">{currentTicket.kycDossier.formData.dateOfBirth} à {currentTicket.kycDossier.formData.placeOfBirth}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Téléphone</span>
                    <span className="font-mono font-bold text-slate-800">{currentTicket.kycDossier.formData.phoneNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Adresse Légale de Résidence</span>
                    <span className="font-bold text-slate-900">{currentTicket.kycDossier.formData.address}, {currentTicket.kycDossier.formData.commune} ({currentTicket.kycDossier.formData.wilaya})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Profession</span>
                    <span className="font-semibold text-slate-800">{currentTicket.kycDossier.formData.occupation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Conforme exigences Banque d'Algérie
              </span>
              <button
                onClick={() => setKycValidationSuccess(true)}
                className="py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider conformité KYC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Teller Document Inspection */}
      {zoomedDoc && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-4 max-w-lg w-full space-y-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">{zoomedDoc.name}</span>
              <button onClick={() => setZoomedDoc(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center p-2">
              <img src={zoomedDoc.previewUrl} alt={zoomedDoc.name} className="max-h-[60vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* AUTH LOGIN MODAL */}
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
