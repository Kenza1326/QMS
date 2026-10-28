import {ParallelServiceNote} from '../common/ParallelServiceNote';
import {matchesClientTicket} from '../../utils/queueValidation';
import {kioskPresenceToken} from '../../utils/queueValidation';
import {CUSTOMER_NAME_MAX_LENGTH, feedbackRatingError} from '../../utils/queueValidation';
import {notifications} from '../../services/notificationService';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileCheck,
  Star,
  ArrowLeft,
  ChevronRight,
  Bell,
  X,
  Sparkles,
  QrCode,
  Building2,
  Check,
  Camera,
  Scan,
  Receipt,
  HelpCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  QueueSystemConfig,
  QueueTicket,
  QueueCategory,
  SubOperation,
  TicketPriority,
  isEntreeEnRelationTicket,
  STANDARD_APPOINTMENT_SLOTS,
} from '../../types/queueTypes';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { queueStore } from '../../services/queueStore';
import { audioService } from '../../services/audioService';
import { BankLogo } from '../common/BankLogo';
import { QrCodeView } from '../common/QrCodeView';
import { QrScannerModal } from './QrScannerModal';
import { ActiveWaitKycModule } from './ActiveWaitKycModule';
import { getPublicUrl } from '../../utils/urlUtils';

interface ClientWebAppProps {
  config: QueueSystemConfig;
  initialTicketNumber?: string | null;
  onBackToHub?: () => void;
}

export const ClientWebApp: React.FC<ClientWebAppProps> = ({
  config,
  initialTicketNumber,
  onBackToHub,
}) => {
  // Storage key for keeping active client ticket persistent across refresh/navigation
  const CLIENT_ACTIVE_TICKET_KEY = `agb_active_client_ticket:${config.selectedAgencyId}`;
  const CLIENT_ACTIVE_ID_KEY = `${CLIENT_ACTIVE_TICKET_KEY}:id`;

  // Navigation tabs within client portal
  const [view, setView] = useState<'home' | 'select_op' | 'plan_visit' | 'ticket_status' | 'feedback'>('home');
  const [selectedCategory, setSelectedCategory] = useState<QueueCategory | null>(null);
  const [selectedSubOp, setSelectedSubOp] = useState<SubOperation | null>(null);
  const [myTicket, setMyTicket] = useState<QueueTicket | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('standard');
  const [appointmentDate, setAppointmentDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [appointmentTime, setAppointmentTime] = useState<string>('09:30');
  const [ticketsList, setTicketsList] = useState<QueueTicket[]>(() => queueStore.getState().tickets);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Live calculation of booked exclusive slots for the chosen date (1 person max per slot)
  const bookedSlotsForDate = useMemo(() => {
    return queueStore.getBookedSlots(appointmentDate);
  }, [appointmentDate, ticketsList]);

  // If the current appointmentTime gets booked on this date, automatically switch to first available slot
  useEffect(() => {
    if (bookedSlotsForDate.includes(appointmentTime)) {
      const nextFree = STANDARD_APPOINTMENT_SLOTS.find((s) => !bookedSlotsForDate.includes(s));
      if (nextFree) {
        setAppointmentTime(nextFree);
      }
    }
  }, [appointmentDate, bookedSlotsForDate, appointmentTime]);

  // Modals & feedback
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [confirmationSuccessMsg, setConfirmationSuccessMsg] = useState<string | null>(null);
  const [feedbackRatingWait, setFeedbackRatingWait] = useState<number>(0);
  const [feedbackRatingStaff, setFeedbackRatingStaff] = useState<number>(0);
  const [feedbackRatingService, setFeedbackRatingService] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const feedbackSubmittedRef = React.useRef<boolean>(false);

  const lastCallAnnouncedRef = React.useRef<string>('');
  const myTicketRef = React.useRef<QueueTicket | null>(null);

  const agencies = config?.agencies?.length ? config.agencies : DEFAULT_QUEUE_CONFIG.agencies;
  const agency = agencies.find((a) => a.id === config?.selectedAgencyId) || agencies[0];
  const categories = config?.categories?.length ? config.categories : DEFAULT_QUEUE_CONFIG.categories;

  // Helper to keep state, ref and localStorage in sync
  const updateMyTicket = (ticket: QueueTicket | null) => {
    const changedTicket = myTicketRef.current?.id !== ticket?.id;
    if (changedTicket) {
      setFeedbackRatingWait(0); setFeedbackRatingStaff(0); setFeedbackRatingService(0);
      setFeedbackComment(''); setFeedbackError(null);
      setFeedbackSubmitted(Boolean(ticket?.feedback));
      feedbackSubmittedRef.current = Boolean(ticket?.feedback);
    } else if (ticket?.feedback) {
      setFeedbackSubmitted(true); feedbackSubmittedRef.current = true;
    }
    myTicketRef.current = ticket;
    setMyTicket(ticket);
    if (typeof window !== 'undefined') {
      try {
        if (ticket && ticket.tokenNumber) {
          localStorage.setItem(CLIENT_ACTIVE_TICKET_KEY, ticket.tokenNumber);
          localStorage.setItem(CLIENT_ACTIVE_ID_KEY, ticket.id);
        } else {
          localStorage.removeItem(CLIENT_ACTIVE_TICKET_KEY);
          localStorage.removeItem(CLIENT_ACTIVE_ID_KEY);
        }
      } catch (e) {}
    }
  };

  // Load ticket if passed via URL or stored in localStorage
  useEffect(() => {
    let targetToken = initialTicketNumber;
    if (!targetToken && typeof window !== 'undefined') {
      try {
        targetToken = localStorage.getItem(CLIENT_ACTIVE_TICKET_KEY) || null;
      } catch (e) {}
    }

    if (targetToken) {
      const tokenUpper = targetToken.toUpperCase();
      const params=new URLSearchParams(window.location.search);
      const expectedTime=params.get('time');
      const expectedId=params.get('ticketId')||(initialTicketNumber&&expectedTime?null:localStorage.getItem(CLIENT_ACTIVE_ID_KEY));
      if(!expectedId&&!expectedTime){updateMyTicket(null);setView('home');return;}
      const matches=(ticket:QueueTicket)=>matchesClientTicket(ticket,tokenUpper,expectedId,expectedTime);

      // 1. Fetch fresh server state immediately across LAN
      queueStore.fetchServerState().then(() => {
        const freshState = queueStore.getState();
        const found = freshState.tickets.find(
          (t) => matches(t)
        );
        if (found) {
          updateMyTicket(found);
          if (found.status === 'completed' && !found.feedback && !feedbackSubmittedRef.current) {
            setView('feedback');
          } else {
            setView('ticket_status');
            if (found.status === 'called') {
              notifications.announce(`call-${found.id}-${found.calledAt || ''}`, 'C’est votre tour', `${found.tokenNumber} · ${found.counterName || 'Guichet'} — merci de vous présenter au guichet.`);
            }
          }
        }
      });

      const state = queueStore.getState();
      const existing = state.tickets.find(
        (t) => matches(t)
      );
      if (existing) {
        updateMyTicket(existing);
        if (existing.status === 'completed' && !existing.feedback && !feedbackSubmittedRef.current) {
          setView('feedback');
        } else {
          setView('ticket_status');
          if (existing.status === 'called') {
            notifications.announce(`call-${existing.id}-${existing.calledAt || ''}`, 'C’est votre tour', `${existing.tokenNumber} · ${existing.counterName || 'Guichet'} — merci de vous présenter au guichet.`);
          }
        }
      } else {
        // Read URL query parameters passed by the Kiosk QR Code
        // Unknown QR codes must never create tickets. Resolve the shared queue first.
        queueStore.fetchServerState().then(() => {
          const found = queueStore.getState().tickets.find((t) => matches(t));
          if (found) { updateMyTicket(found); setView('ticket_status'); }
          else setView('home');
        });
      }
    }
  }, [initialTicketNumber]);

  // Subscribe to queue changes to keep myTicket live and react IMMEDIATELY to teller calls
  useEffect(() => {
    const unsub = queueStore.subscribe((state) => {
      setTicketsList([...state.tickets]);

      let activeToken = myTicketRef.current?.tokenNumber;
      if (!activeToken && typeof window !== 'undefined') {
        try {
          activeToken = localStorage.getItem(CLIENT_ACTIVE_TICKET_KEY) || undefined;
        } catch (e) {}
      }

      if (!activeToken) return;

      const activeId=myTicketRef.current?.id||localStorage.getItem(CLIENT_ACTIVE_ID_KEY);
      const fresh = state.tickets.find((t)=>matchesClientTicket(t,activeToken!,activeId));

      if (fresh) {
        if (fresh.status !== 'called') notifications.dismiss(`call-${fresh.id}-${fresh.calledAt || ''}`);
        if (fresh.status === 'completed') {
          if (!fresh.feedback && !feedbackSubmittedRef.current) {
            setView('feedback');

          }
        } else if (fresh.status === 'called') {
          // Immediately bring user to ticket status view so call is never missed
          setView('ticket_status');

          const callIdentifier = `${fresh.status}_${fresh.calledAt || fresh.id}_${fresh.counterId || ''}`;
          if (lastCallAnnouncedRef.current !== callIdentifier) {
            lastCallAnnouncedRef.current = callIdentifier;
            notifications.announce(`call-${fresh.id}-${fresh.calledAt || ''}`, 'C’est votre tour', `${fresh.tokenNumber} · ${fresh.counterName || 'Guichet'} — merci de vous présenter au guichet.`);
            audioService.playChime(1.0);
            audioService.speakTicketCall(
              fresh.tokenNumber,
              fresh.counterName || 'Guichet',
              'fr-FR',
              true
            );
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([500, 200, 500, 200, 800]);
              } catch (e) {}
            }
          }
        }

        updateMyTicket({ ...fresh });
      } else {
        // Ticket no longer exists (e.g. queue was reset)
        updateMyTicket(null);
        setView('home');
      }
    });
    return unsub;
  }, [view]);

  // Handle immediate ticket creation
  const issuingTicket = React.useRef(false);
  const handleCreateImmediateTicket = async () => {
    if (issuingTicket.current) return;
    if (!selectedCategory || !selectedSubOp) return;
    issuingTicket.current = true;
    try {
    const ticket = await queueStore.createTicket(
      selectedCategory.id,
      selectedSubOp.id,
      priority,
      customerName || 'Client Mobile',
      customerPhone,
      null, undefined, 'client' // Requires physical presence confirmation
    );
    updateMyTicket(ticket);
    setView('ticket_status');
    } catch (error) { notifications.error(error instanceof Error ? error.message : 'Impossible de créer le ticket.'); } finally { issuingTicket.current = false; }
  };

  // Handle booking appointment with strict exclusivity enforcement (1 person max per slot)
  const handleBookAppointment = async () => {
    if (!selectedCategory || !selectedSubOp) return;
    setBookingError(null);

    if (!queueStore.isSlotAvailable(appointmentDate, appointmentTime)) {
      setBookingError(
        `Le créneau de ${appointmentTime} le ${appointmentDate} est déjà réservé par un autre client (créneau exclusif 1 personne max). Veuillez choisir un autre horaire.`
      );
      return;
    }

    try {
      const ticket = await queueStore.bookAppointment(
        selectedCategory.id,
        selectedSubOp.id,
        appointmentDate,
        appointmentTime,
        priority,
        customerName || 'Rendez-vous Mobile',
        customerPhone
      );
      updateMyTicket(ticket);
      setView('ticket_status');
    } catch (err: any) {
      setBookingError(err?.message || 'Erreur lors de la réservation du créneau.');
    }
  };

  // Confirm arrival in branch (moves booked ticket to waiting queue, or activates ticket)
  const handleConfirmArrival = async (code?:string):Promise<boolean> => {
    try {
      const ticket=myTicketRef.current;
      if (!ticket) { setView('select_op'); notifications.error('Prenez un ticket avant de confirmer votre présence.'); return false; }
      const proof=kioskPresenceToken(code||'',config.selectedAgencyId,[window.location.origin,new URL(getPublicUrl('?mode=client')).origin]);
      const confirmed=await queueStore.confirmArrival(ticket.id,proof);
      if (!confirmed) { notifications.error('Ce ticket ne peut plus être activé.'); return false; }
      updateMyTicket({...confirmed});setConfirmationSuccessMsg('Présence confirmée. Votre ticket est maintenant dans la file active.');
      setView('ticket_status');setTimeout(()=>setConfirmationSuccessMsg(null),7000);return true;
    } catch(error) { notifications.error(error instanceof Error ? error.message : 'Confirmation impossible.'); return false; }
  };
  useEffect(() => {
    if (typeof window==='undefined'||new URLSearchParams(window.location.search).get('action')!=='confirm-presence') return;
    const code=window.location.href;
    void (async()=>{
      await queueStore.fetchServerState();
      const token=myTicketRef.current?.tokenNumber||localStorage.getItem(CLIENT_ACTIVE_TICKET_KEY);
      const identity=myTicketRef.current?.id||localStorage.getItem(CLIENT_ACTIVE_ID_KEY);
      const target=queueStore.getState().tickets.find((t)=>token&&matchesClientTicket(t,token,identity));
      if(target) updateMyTicket(target);
      await handleConfirmArrival(code);
      const clean=new URL(window.location.href);clean.searchParams.delete('action');clean.searchParams.delete('proof');window.history.replaceState({},'',clean);
    })();
  }, []);

  // Cancel / leave queue
  const handleConfirmCancel = async () => {
    const ticket=myTicketRef.current;if (!ticket) return;
    try {
      if(!await queueStore.cancelTicket(ticket.id)){notifications.error('Ce ticket ne peut plus être annulé : son service a commencé ou est terminé.');return;}
      if(myTicketRef.current?.id===ticket.id){updateMyTicket(null);setView('home');}
    } catch(error){notifications.error(error instanceof Error ? error.message : 'Annulation impossible.');}
  };

  // Submit feedback survey
  const handleSubmitFeedback = async () => {
    if (!myTicket || myTicket.status !== 'completed') return;
    if (myTicket.feedback || feedbackSubmittedRef.current) return;
    const error = feedbackRatingError([feedbackRatingWait, feedbackRatingService, feedbackRatingStaff]);
    if (error) { setFeedbackError(error); return; }
    setFeedbackError(null);
    feedbackSubmittedRef.current = true;
    try {
      await queueStore.submitFeedback(myTicket.id, {
        ratingWaitTime: feedbackRatingWait, ratingService: feedbackRatingService, ratingStaff: feedbackRatingStaff,
        overallSatisfaction: Math.round((feedbackRatingWait+feedbackRatingService+feedbackRatingStaff)/3), comment: feedbackComment,
      });
      const saved = queueStore.getState().tickets.find((t) => t.id === myTicket.id);
      if (!saved?.feedback) {
        feedbackSubmittedRef.current = false;
        setFeedbackError('Votre avis n’a pas pu être enregistré. Veuillez réessayer.');
        return;
      }
      updateMyTicket(saved);
      setFeedbackSubmitted(true);
    } catch (error) {
      feedbackSubmittedRef.current = false;
      setFeedbackError(error instanceof Error ? error.message : 'Enregistrement impossible. Veuillez réessayer.');
    }
  };

  const hasSubmittedFeedback = feedbackSubmitted || Boolean(myTicket?.feedback);
  const canGiveFeedback = myTicket?.status === 'completed' && !hasSubmittedFeedback;
  const estimate = myTicket ? queueStore.getTicketEstimate(myTicket) : { peopleAhead: 0, estimatedMinutes: 0 };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
      {/* MOBILE APP HEADER */}
      <header
        className="text-white sticky top-0 z-30 shadow-md transition-colors"
        style={{ backgroundColor: config.brand.primaryColor }}
      >
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'home' && !myTicket && (
              <button
                onClick={() => setView('home')}
                className="p-1 -ml-1 text-white/80 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <BankLogo brand={config.brand} size="sm" variant="dark" showTagline={false} />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-amber-300 block tracking-wider">
                {agency?.name}
              </span>
              <span className="text-xs text-white/80 font-mono">
                {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-xl mx-auto w-full flex-1 p-4 sm:p-6 flex flex-col">
        {/* ============================================================ */}
        {/* VIEW 1: HOME PORTAL (CHOICE BETWEEN IMMEDIATE OR APPOINTMENT) */}
        {/* ============================================================ */}
        {view === 'home' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Welcome banner */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 text-center">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 mb-2">
                Bienvenue dans votre agence
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Prenez place dans la file d'attente
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Accédez aux guichets en toute simplicité et suivez votre tour depuis votre smartphone.
              </p>
            </div>

            {/* COMPLETED VISIT FEEDBACK INVITATION CARD */}
            {myTicket && canGiveFeedback && (
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white rounded-3xl p-5 shadow-lg flex items-center justify-between gap-3 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Star className="w-6 h-6 text-amber-300 fill-amber-300" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-200 block">
                      Visite terminée • {myTicket.tokenNumber} ({myTicket.counterName || 'Guichet'})
                    </span>
                    <h4 className="text-sm font-black text-white">Donnez votre avis</h4>
                    <p className="text-[11px] text-blue-100">Votre évaluation nous aide à nous améliorer.</p>
                  </div>
                </div>
                <button
                  onClick={() => setView('feedback')}
                  className="px-4 py-2.5 rounded-xl bg-white text-blue-900 font-extrabold text-xs shadow-md hover:bg-blue-50 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <span>Évaluer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ACTIVE TICKET SHORTCUT ON HOME */}
            {myTicket && (myTicket.status === 'waiting' || myTicket.status === 'called' || myTicket.status === 'in_service' || myTicket.status === 'booked') && (
              <div
                onClick={() => setView('ticket_status')}
                className="bg-white border-2 border-[#0055D4] rounded-3xl p-4 shadow-md flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0055D4] text-white font-mono font-black text-base flex items-center justify-center shadow-sm">
                    {myTicket.tokenNumber}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#0055D4] block">
                      {myTicket.status === 'called'
                        ? '🔔 Appel en cours au ' + (myTicket.counterName || 'guichet')
                        : myTicket.status === 'in_service'
                        ? '🟢 Prise en charge au ' + (myTicket.counterName || 'guichet')
                        : myTicket.status === 'booked'
                        ? '📅 Rendez-vous programmé'
                        : '⏳ En attente dans la file'}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-[#0055D4] transition-colors">
                      {myTicket.subOperationName}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#0055D4]">
                  <span>Voir mon ticket</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            )}

            {/* PRIMARY ACTIONS: TICKET OR APPOINTMENT */}
            <div className="space-y-3">
              {/* ACTION 1: Rejoindre la file maintenant */}
              <button
                onClick={() => {
                  if (categories.length > 0) {
                    setSelectedCategory(categories[0]);
                    setSelectedSubOp(categories[0].subOperations[0]);
                    setView('select_op');
                  }
                }}
                className="w-full p-5 rounded-3xl text-left bg-white border-2 border-slate-200 hover:border-slate-400 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-3.5 rounded-2xl text-white shadow-sm"
                    style={{ backgroundColor: config.brand.primaryColor }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Sans réservation
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-slate-950">
                      Prendre un ticket maintenant
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confirmez votre présence en agence pour rejoindre la file active
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* ACTION 3: Planifier une visite (Rendez-vous) - Page 5 SoW */}
              <button
                onClick={() => {
                  if (categories.length > 0) {
                    setSelectedCategory(categories[1] || categories[0]);
                    setSelectedSubOp(categories[1]?.subOperations[0] || categories[0].subOperations[0]);
                    setView('plan_visit');
                  }
                }}
                className="w-full p-5 rounded-3xl text-left bg-white border-2 border-slate-200 hover:border-slate-400 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-3.5 rounded-2xl text-white shadow-sm"
                    style={{ backgroundColor: config.brand.secondaryColor || '#C99700' }}
                  >
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      À l'avance
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-slate-950">
                      Planifier une visite (Rendez-vous)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Réservez un créneau et confirmez votre arrivée en agence
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* HOURLY AFFLUENCE CHART (PAGE 1 & 4 SoW) */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Affluence moyenne aujourd'hui</span>
                </span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  {queueStore.getPeakHourLabel()}
                </span>
              </div>

              {/* Bar chart */}
              <div className="grid grid-cols-12 gap-1.5 items-end h-24 pt-4 border-b border-slate-100">
                {queueStore.getHourlyAffluence().map((slot) => (
                  <div key={slot.hour} className="flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        slot.isPeak
                          ? 'bg-rose-500'
                          : slot.percentage > 60
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ height: `${slot.percentage}%` }}
                      title={`${slot.hour} : ${slot.count} arrivées`}
                    />
                    <span className="text-[8px] font-mono text-slate-400 rotate-[-45deg] origin-top-left mt-2">
                      {slot.hour}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-4 pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Calme
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Modéré
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Forte affluence
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: SELECT OPERATION & ATTENTE ACTIVE (PAGE 2, 4 SoW) */}
        {/* ============================================================ */}
        {view === 'select_op' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour</span>
              </button>
              <span className="text-xs font-bold text-slate-500">Étape 1 sur 2</span>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <h2 className="text-lg font-black text-slate-900 mb-1">
                Choisissez votre opération
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Sélectionnez le service bancaire souhaité pour votre visite.
              </p>

              {/* Category pills */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedSubOp(cat.subOperations[0]);
                    }}
                    className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      selectedCategory?.id === cat.id
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block truncate">{cat.labelFr}</span>
                    <span className="text-[10px] opacity-75 block" dir="rtl">
                      {cat.labelAr}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sub-operations list */}
              {selectedCategory && (
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Précisez la démarche :
                  </span>
                  {selectedCategory.subOperations.map((subOp) => (
                    <button
                      key={subOp.id}
                      onClick={() => setSelectedSubOp(subOp)}
                      className={`w-full p-3.5 rounded-2xl text-left border flex items-center justify-between text-xs transition-all cursor-pointer ${
                        selectedSubOp?.id === subOp.id
                          ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span>{subOp.labelFr}</span>
                        <span className="block text-[10px] opacity-75 mt-0.5" dir="rtl">
                          {subOp.labelAr}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-80 shrink-0 font-mono">
                        {queueStore.getServiceEstimate(selectedCategory.id, subOp.id, priority).estimatedMinutes === null ? 'Guichets indisponibles' : `${queueStore.getServiceEstimate(selectedCategory.id, subOp.id, priority).estimatedMinutes} min d’attente estimée`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ATTENTE ACTIVE : DOCUMENTS REQUIRED CHECKLIST (PAGE 1 & 4 SoW) */}
            {selectedSubOp && (
              <div className="bg-amber-50/80 rounded-3xl p-5 border border-amber-200/80 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="w-5 h-5 text-amber-700 shrink-0" />
                  <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                    Attente active : Pièces à fournir pour votre passage
                  </h4>
                </div>
                <p className="text-xs text-amber-800/80 mb-3">
                  Préparez ces documents afin d'accélérer votre traitement au guichet :
                </p>

                <ul className="space-y-2">
                  {selectedSubOp.requiredDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-start gap-2 bg-white/90 p-2.5 rounded-xl border border-amber-200 text-xs text-slate-800"
                    >
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{doc.label}</span>
                        {doc.description && (
                          <span className="block text-[10px] text-slate-500">
                            {doc.description}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-600">{queueStore.getPriorityPolicyDescription()}</p>
            {/* Priority & info inputs */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Votre nom (optionnel, 80 caractères maximum)
                </label>
                <input
                  type="text"
                  value={customerName}
                  maxLength={CUSTOMER_NAME_MAX_LENGTH}
                  autoComplete="name"
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex : Karim B."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Priority badge */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Profil & Accessibilité
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPriority('standard')}
                    className={`py-2 px-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                      priority === 'standard'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('vip')}
                    className={`py-2 px-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                      priority === 'vip'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    VIP / Première
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('pmr')}
                    className={`py-2 px-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                      priority === 'pmr'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    PMR / Mobilité
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleCreateImmediateTicket}
                className="w-full mt-2 py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md transition-transform active:scale-98 cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                Rejoindre la file d'attente maintenant →
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: PLAN A VISIT (PAGE 5 SoW) */}
        {/* ============================================================ */}
        {view === 'plan_visit' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour</span>
              </button>
              <span className="text-xs font-bold text-amber-700">Planifier une visite</span>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
              <h2 className="text-lg font-black text-slate-900">
                Programmer votre rendez-vous
              </h2>
              <p className="text-xs text-slate-500">
                Sélectionnez le jour et l'heure de votre visite pour obtenir un numéro de réservation.
              </p>

              {/* Category picker */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Opération
                </label>
                <select
                  value={selectedCategory?.id}
                  onChange={(e) => {
                    const cat = categories.find((c) => c.id === e.target.value);
                    if (cat) {
                      setSelectedCategory(cat);
                      setSelectedSubOp(cat.subOperations[0]);
                    }
                  }}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date selection & Exclusive Slot guarantee */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Date de visite
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={appointmentDate}
                    onChange={(e) => {
                      setAppointmentDate(e.target.value);
                      setBookingError(null);
                    }}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>

                {/* Exclusivity Guarantee Banner */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-950">Créneau Exclusif Garanti</span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-black px-1.5 py-0.2 rounded">
                          1 pers. max / créneau
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-800 leading-tight">
                        Une seule personne par horaire. Votre place vous est strictement réservée.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-900 block font-mono">
                      {Math.max(0, STANDARD_APPOINTMENT_SLOTS.length - bookedSlotsForDate.length)}/{STANDARD_APPOINTMENT_SLOTS.length}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700">
                      Libres
                    </span>
                  </div>
                </div>

                {/* Interactive Time Slot Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      Sélectionnez votre créneau horaire
                    </label>
                    {bookedSlotsForDate.length > 0 && (
                      <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {bookedSlotsForDate.length} créneau(x) déjà occupé(s)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STANDARD_APPOINTMENT_SLOTS.map((slot) => {
                      const isBooked = bookedSlotsForDate.includes(slot);
                      const isSelected = appointmentTime === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          onClick={() => {
                            if (!isBooked) {
                              setAppointmentTime(slot);
                              setBookingError(null);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                            isBooked
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                              : isSelected
                              ? 'text-white shadow-md ring-2 ring-blue-300 font-bold cursor-pointer scale-102'
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-800 font-semibold cursor-pointer'
                          }`}
                          style={
                            isSelected && !isBooked
                              ? { backgroundColor: config.brand.primaryColor, borderColor: config.brand.primaryColor }
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-1 font-mono text-xs font-bold">
                            <Clock
                              className={`w-3.5 h-3.5 ${
                                isSelected && !isBooked ? 'text-white' : isBooked ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            />
                            <span>{slot}</span>
                          </div>
                          {isBooked ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                              <Lock className="w-2.5 h-2.5" /> Complet (1/1)
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-bold ${
                                isSelected ? 'text-blue-100' : 'text-emerald-600'
                              }`}
                            >
                              ✓ 1 place libre
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Warning if all slots full */}
                {bookedSlotsForDate.length >= STANDARD_APPOINTMENT_SLOTS.length && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                      Tous les créneaux sont complets pour le <strong>{appointmentDate}</strong>. Veuillez sélectionner une autre date de visite.
                    </span>
                  </div>
                )}

                {/* Booking Error Banner */}
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span className="font-semibold">{bookingError}</span>
                  </div>
                )}
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nom & Prénom
                  </label>
                  <input
                    type="text"
                    value={customerName}
                  maxLength={CUSTOMER_NAME_MAX_LENGTH}
                  autoComplete="name"
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full text-xs p-3 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Téléphone (SMS de rappel)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="05 / 06 / 07..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Important note per page 5 SoW */}
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <strong>Note importante :</strong> En ayant planifié une visite, vous n'êtes pas
                encore intégré dans la file principale. Une fois en agence, vous devrez confirmer
                votre présence physique via votre téléphone ou la borne pour activer votre passage.
              </div>

              {/* Confirm Booking */}
              <button
                onClick={handleBookAppointment}
                disabled={
                  bookedSlotsForDate.length >= STANDARD_APPOINTMENT_SLOTS.length ||
                  bookedSlotsForDate.includes(appointmentTime) ||
                  !selectedCategory ||
                  !selectedSubOp
                }
                className={`w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md transition-all ${
                  bookedSlotsForDate.length >= STANDARD_APPOINTMENT_SLOTS.length ||
                  bookedSlotsForDate.includes(appointmentTime)
                    ? 'bg-slate-300 cursor-not-allowed opacity-60'
                    : 'active:scale-98 cursor-pointer'
                }`}
                style={
                  !(
                    bookedSlotsForDate.length >= STANDARD_APPOINTMENT_SLOTS.length ||
                    bookedSlotsForDate.includes(appointmentTime)
                  )
                    ? { backgroundColor: config.brand.primaryColor }
                    : undefined
                }
              >
                {bookedSlotsForDate.length >= STANDARD_APPOINTMENT_SLOTS.length
                  ? 'Journée complète - Choisissez une autre date'
                  : bookedSlotsForDate.includes(appointmentTime)
                  ? 'Créneau déjà réservé'
                  : 'Valider ma réservation exclusive →'}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 4: LIVE TICKET STATUS (FAITHFUL TO PAGE 6 MOCKUP) */}
        {/* ============================================================ */}
        {view === 'ticket_status' && myTicket && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* MASSIVE URGENT BANNER IF CALLED: LEVEZ-VOUS ET VENEZ ÊTRE SERVI ! */}
            {myTicket.status === 'called' && (
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white p-5 rounded-3xl shadow-2xl border-4 border-amber-300 animate-pulse flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white text-red-600 flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                    <Bell className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-200 block">
                      Appel en cours • C'est votre tour !
                    </span>
                    <h3 className="font-black text-xl sm:text-2xl text-white uppercase tracking-tight leading-tight">
                      Levez-vous et venez être servi !
                    </h3>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-xs p-4 rounded-2xl border border-white/40 text-center shadow-inner">
                  <span className="text-xs font-black text-amber-100 uppercase tracking-wider block">
                    Veuillez vous présenter immédiatement au :
                  </span>
                  <span className="font-black text-2xl sm:text-3xl text-white block mt-1 tracking-wide underline decoration-amber-300">
                    {myTicket.counterName || 'Guichet d\'accueil'}
                  </span>
                </div>
              </div>
            )}

            {/* IN-SERVICE NOTIFICATION BANNER */}
            {myTicket.status === 'in_service' && (
              <div className="bg-emerald-600 text-white p-4 sm:p-5 rounded-3xl shadow-xl flex items-center gap-3.5 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-emerald-200 animate-spin" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 block">
                    Entretien en cours au guichet
                  </span>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    Vous êtes pris en charge au {myTicket.counterName || 'guichet'}
                  </h3>
                  <p className="text-xs text-emerald-100 font-medium mt-0.5">
                    Votre conseiller traite actuellement votre demande.
                  </p>
                </div>
              </div>
            )}

            {/* MASSIVE COMPLETED BANNER: DONNEZ VOTRE AVIS */}
            {myTicket.status === 'completed' && (
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white p-5 rounded-3xl shadow-2xl border-2 border-white/20 flex flex-col gap-3.5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-lg">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
                      Prestation terminée • Fin de l'opération
                    </span>
                    <h3 className="font-black text-lg sm:text-xl text-white leading-tight">
                      Merci pour votre visite !
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-blue-100 font-medium leading-relaxed">
                  Votre consultation au <strong>{myTicket.counterName || 'guichet'}</strong> est désormais terminée. {hasSubmittedFeedback ? 'Merci, votre avis a déjà été enregistré.' : 'Vous pouvez donner votre avis ci-dessous.'}
                </p>


              </div>
            )}

            {/* SUCCESS BANNER WHEN PRESENCE IS CONFIRMED */}
            {confirmationSuccessMsg && (
              <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded-3xl shadow-md flex items-center gap-3 animate-in fade-in duration-300">
                <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
                <div>
                  <h4 className="font-black text-sm text-emerald-950">Présence validée avec succès !</h4>
                  <p className="text-xs text-emerald-800 font-medium">
                    {confirmationSuccessMsg}
                  </p>
                </div>
              </div>
            )}


            {/* MAIN TICKET CARD (MATCHING EXACT SCREENSHOT ON PAGE 6) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-slate-200 text-center relative overflow-hidden">
              {/* Brand Logo in card header */}
              <div className="flex justify-center mb-4">
                <BankLogo brand={config.brand} size="md" showTagline={false} />
              </div>

              {/* Status Header */}
              <div className="mb-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block">
                  {myTicket.status === 'completed' ? 'Opération terminée' : 'Numéro du ticket'}
                </span>

                {/* BIG RED/BRAND OVAL PILL (PAGE 6 SCREENSHOT: e.g. 93) */}
                <div
                  className="inline-flex items-center justify-center px-10 py-3.5 my-3 rounded-full font-mono font-black text-5xl sm:text-6xl text-white shadow-lg tracking-wider"
                  style={{
                    backgroundColor:
                      myTicket.status === 'called'
                        ? '#E60028'
                        : myTicket.status === 'completed'
                        ? '#059669'
                        : config.brand.primaryColor,
                  }}
                >
                  {myTicket.tokenNumber}
                </div>

                <h4 className="text-sm font-bold text-slate-800">
                  {myTicket.subOperationName}
                </h4>

                {myTicket.status === 'completed' && (
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✓ Traitement achevé au {myTicket.counterName || 'guichet'}
                  </span>
                )}
              </div>

              {/* LIVE QUEUE STATS OR COMPLETED RECAP */}
              {myTicket.status === 'completed' ? (
                <div className="my-6 py-4 border-y border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Guichet assigné</span>
                    <span className="font-black text-slate-900 font-sans">{myTicket.counterName || 'Guichet'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Statut de la visite</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                      Terminé avec succès
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Durée de prise en charge</span>
                    <span className="font-black text-slate-900 font-mono">{myTicket.serviceDurationMinutes ?? 0} min</span>
                  </div>
                </div>
              ) : (
                <div className="my-6 py-4 border-y border-slate-100 space-y-4">
                  {/* Personnes restantes */}
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">
                      {myTicket.status === 'pending_presence' ? 'Tickets avant vous si présence validée maintenant' : 'Tickets avant vous (ordre de file)'}
                    </span>
                    <span className="font-mono text-2xl font-black text-slate-900">
                      {myTicket.status === 'booked' ? 'Sur rendez-vous' : estimate.peopleAhead}
                    </span>
                  </div>

                  {/* Temps d'attente estimatif */}
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">
                      {myTicket.status === 'pending_presence' ? 'Attente estimée après validation de présence' : 'Temps d’attente estimatif'}
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="font-mono text-xl font-black text-slate-900">
                        {myTicket.status === 'booked'
                          ? `RDV à ${myTicket.appointmentTime || '--:--'}`
                          : estimate.estimatedMinutes === null ? 'Guichets indisponibles' : estimate.estimatedMinutes === 0
                          ? 'Immédiat (< 1 min)'
                          : `~${estimate.estimatedMinutes} min`}
                      </span>
                    </div>
                    {myTicket.status === 'pending_presence' ? <p className="mt-2 text-xs leading-relaxed text-amber-700">Projection si vous validez votre présence maintenant. Votre place sera attribuée à la borne et peut évoluer avant votre arrivée.</p> : myTicket.status !== 'booked' && (
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {estimate.estimatedMinutes === null ? 'L’attente sera estimée à la réouverture d’un guichet.' : estimate.estimatedMinutes === 0
                          ? 'Un guichet peut vous appeler dès maintenant'
                          : 'Estimation en direct'}
                      </span>
                    )}
                  </div>
                  <ParallelServiceNote {...estimate} requiresPresence={myTicket.status === 'pending_presence'} />
                </div>
              )}

              {/* Exclusive Appointment confirmation card */}
              {myTicket.status === 'booked' && (
                <div className="my-4 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-blue-900">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Créneau Exclusif Garanti (1/1 personne)</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Date : <strong>{myTicket.appointmentDate}</strong> • Heure réservée : <strong>{myTicket.appointmentTime}</strong>
                  </p>
                  <p className="text-[10px] text-blue-600">
                    Ce créneau horaire vous est réservé en exclusivité. Scannez le QR code à la borne à votre arrivée pour activer votre passage prioritaire.
                  </p>
                </div>
              )}

              {/* PRESENCE VALIDATION / SCAN QR CODE (IF NOT COMPLETED) */}
              {myTicket.status !== 'completed' && (
                myTicket.confirmedAt ? (
                  <div className="my-5 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center flex items-center justify-center gap-2.5 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-black text-emerald-950">
                      Présence validée en agence ({new Date(myTicket.confirmedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </div>
                ) : (
                  <div className="my-5 p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <Scan className="w-4 h-4 text-amber-600 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                        Validation à la Borne d'Accueil
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/80 mb-3 font-medium">
                      Validez votre présence à votre arrivée en agence :
                    </p>

                    {/* OPTION 1: QR Code to show to la borne */}
                    <div className="p-3 bg-white rounded-2xl border border-amber-200 shadow-xs flex flex-col items-center gap-1.5 mb-3">
                      <QrCodeView value={myTicket.tokenNumber} size={120} />
                      <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200">
                        {myTicket.tokenNumber}
                      </span>
                      <p className="text-[11px] text-slate-600 font-bold">
                        1. Présentez ce QR Code face à la caméra de la borne tactile
                      </p>
                    </div>

                    <div className="flex items-center gap-2 my-2.5">
                      <div className="h-px bg-amber-300/80 flex-1" />
                      <span className="text-[10px] uppercase font-extrabold text-amber-800">Ou avec votre téléphone</span>
                      <div className="h-px bg-amber-300/80 flex-1" />
                    </div>

                    {/* OPTION 2: Open phone camera to scan the borne */}
                    <button
                      onClick={() => setShowScannerModal(true)}
                      className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 ring-2 ring-amber-300/60"
                    >
                      <Camera className="w-4 h-4 text-slate-950" />
                      <span>2. Scanner l'écran de la borne avec ce téléphone</span>
                    </button>
                  </div>
                )
              )}

              {/* SYNCHRONIZATION PULSE BADGE */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium mb-6">
                <span className={`w-2 h-2 rounded-full ${queueStore.getState().syncStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{queueStore.getState().syncStatus === 'online' ? 'Synchronisé avec le serveur de l’agence' : queueStore.getState().syncStatus === 'offline' ? 'Connexion interrompue — actions indisponibles' : 'Connexion au serveur…'}</span>
              </div>

              {/* ACTION BUTTONS: FEEDBACK IF COMPLETED, LEAVE QUEUE IF WAITING */}
              {myTicket.status === 'completed' ? (
                <div className="space-y-2.5">
                  {canGiveFeedback ? (
                  <button
                    onClick={() => setView('feedback')}
                    className="w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    style={{ backgroundColor: config.brand.primaryColor }}
                  >
                    <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>Donner mon avis sur le service →</span>
                  </button>
                  ) : <p className="text-sm font-semibold text-emerald-700">Avis déjà enregistré. Merci !</p>}
                  <button
                    onClick={() => {
                      updateMyTicket(null);
                      setView('home');
                    }}
                    className="w-full py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    Prendre un nouveau ticket
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const ticketId = myTicket.id;
                    if (await notifications.confirmAction({title: 'Quitter la file ?', message: `Votre ticket ${myTicket.tokenNumber} sera annulé.`, actionLabel: 'Quitter la file', destructive: true})) {
                      if (myTicketRef.current?.id === ticketId) await handleConfirmCancel();
                    }
                  }}
                  className="w-full py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                >
                  Quitter la file d'attente
                </button>
              )}
            </div>

            {/* ATTENTE ACTIVE KYC MODULE: STRICTLY AND ONLY FOR ENTRÉE EN RELATION */}
            {isEntreeEnRelationTicket(myTicket) ? (
              <ActiveWaitKycModule
                ticket={myTicket}
                primaryColor={config.brand.primaryColor}
                onDossierUpdated={(updated) => updateMyTicket(updated)}
              />
            ) : (
              <div className="bg-slate-100 rounded-3xl p-4 text-xs text-slate-600 flex items-start gap-3">
                <FileCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 block">Attente active</span>
                  <span>
                    Gardez vos pièces justificatives à portée de main avant d'accéder au guichet.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 5: CLIENT FEEDBACK SURVEY (PAGE 4 & 7 SoW) */}
        {/* ============================================================ */}
        {view === 'feedback' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-5 animate-in fade-in duration-300">
            {!hasSubmittedFeedback ? (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  {myTicket && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#0055D4] mb-3">
                      <span className="font-mono font-black">{myTicket.tokenNumber}</span>
                      <span>•</span>
                      <span>{myTicket.counterName || 'Guichet'}</span>
                      {myTicket.subOperationName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[150px]">{myTicket.subOperationName}</span>
                        </>
                      )}
                    </div>
                  )}
                  <h2 className="text-xl font-black text-slate-900">
                    Votre avis compte pour nous !
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Merci pour votre visite. Aidez-nous à améliorer la qualité de nos services en
                    partageant votre ressenti.
                  </p>
                </div>

                {/* Rating 1: Temps d'attente */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Délai d'attente en agence
                  </span>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRatingWait(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= feedbackRatingWait
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating 2: Accueil et professionnalisme */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Accueil et amabilité du personnel
                  </span>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRatingStaff(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= feedbackRatingStaff
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating 3: Qualité du traitement */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Clarté et satisfaction de la prestation
                  </span>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRatingService(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= feedbackRatingService
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional comment */}
                <div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Une remarque ou suggestion ? (Optionnel)"
                    rows={2}
                    className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {feedbackError && <p id="feedback-rating-error" role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{feedbackError}</p>}
                <button
                  disabled={hasSubmittedFeedback}
                  aria-describedby={feedbackError ? 'feedback-rating-error' : undefined}
                  onClick={handleSubmitFeedback}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md transition-transform active:scale-98 cursor-pointer"
                  style={{ backgroundColor: config.brand.primaryColor }}
                >
                  Envoyer mon évaluation →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateMyTicket(null);
                    setView('home');
                  }}
                  className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer py-1"
                >
                  Passer cette étape (Retour à l'accueil)
                </button>
              </>
            ) : (
              <div className="py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Merci pour votre confiance !
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Votre retour a bien été enregistré. Toute l'équipe de{' '}
                  <strong>{config.brand.name}</strong> vous souhaite une excellente journée.
                </p>
                <button
                  onClick={() => {
                    updateMyTicket(null);
                    setFeedbackSubmitted(false);
                    setView('home');
                  }}
                  className="mt-4 px-6 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Retour à l'accueil
                </button>
              </div>
            )}
          </div>
        )}
      </main>


      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-400">
        <span>© {config.brand.name} • Portail Client Web</span>
      </footer>

      {/* ============================================================ */}
      {/* FULL-SCREEN URGENT CALL MODAL: GET UP AND GET SERVED */}
      {/* ============================================================ */}
      {/* IN-APP SCANNER MODAL FOR BORNE QR CODE */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onSuccess={handleConfirmArrival}
        ticketNumber={myTicket?.tokenNumber}
      />
    </div>
  );
};

