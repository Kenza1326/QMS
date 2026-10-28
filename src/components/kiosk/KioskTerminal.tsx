import {ParallelServiceNote} from '../common/ParallelServiceNote';
import {notifications} from '../../services/notificationService';
import React, { useState, useEffect, useRef } from 'react';
import {
  Banknote,
  UserCheck,
  Briefcase,
  FileText,
  Accessibility,
  ArrowLeft,
  Printer,
  QrCode,
  CheckCircle,
  Clock,
  Users,
  Sparkles,
  Search,
  RotateCcw,
  Camera,
  Receipt,
  HelpCircle,
  Smartphone,
  Keyboard,
  X,
} from 'lucide-react';
import {
  QueueSystemConfig,
  QueueCategory,
  SubOperation,
  QueueTicket,
  TicketPriority,
} from '../../types/queueTypes';
import { queueStore } from '../../services/queueStore';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { BankLogo } from '../common/BankLogo';
import { QrCodeView } from '../common/QrCodeView';
import { RealQrCameraScanner } from '../common/RealQrCameraScanner';
import { getPublicUrl } from '../../utils/urlUtils';

interface KioskTerminalProps {
  config: QueueSystemConfig;
  onTicketGenerated?: (ticket: QueueTicket) => void;
  onBackToHub?: () => void;
}

export const KioskTerminal: React.FC<KioskTerminalProps> = ({
  config,
  onTicketGenerated,
  onBackToHub,
}) => {
  const issuingTicket = useRef(false);
  const [presenceProof,setPresenceProof]=useState('');
  const [queueEpoch,setQueueEpoch]=useState(queueStore.getState().resetAt||0);
  const [selectedCategory, setSelectedCategory] = useState<QueueCategory | null>(null);
  const [selectedSubOp, setSelectedSubOp] = useState<SubOperation | null>(null);
  const [generatedTicket, setGeneratedTicket] = useState<QueueTicket | null>(null);
  const [isPmrMode, setIsPmrMode] = useState<boolean>(false);
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [checkInTab, setCheckInTab] = useState<'camera' | 'qr_phone' | 'manual'>('camera');
  const [checkInCode, setCheckInCode] = useState<string>('');
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number>(15);
  const [queueTickets, setQueueTickets] = useState<QueueTicket[]>(() => queueStore.getState().tickets);

  useEffect(() => {
    return queueStore.subscribe((state) => {
      setQueueTickets([...state.tickets]);
      setQueueEpoch(state.resetAt||0);
    });
  }, []);

  const agencies = config?.agencies?.length ? config.agencies : DEFAULT_QUEUE_CONFIG.agencies;
  const agency = agencies.find((a) => a.id === config?.selectedAgencyId) || agencies[0];
  const categories = config?.categories?.length ? config.categories : DEFAULT_QUEUE_CONFIG.categories;

  useEffect(()=>{
    let active=true;setPresenceProof('');
    queueStore.getKioskPresenceToken().then((proof)=>{if(active)setPresenceProof(proof);}).catch(()=>{if(active)setPresenceProof('');});
    return ()=>{active=false;};
  },[config.selectedAgencyId,queueEpoch]);

  // Auto-reset when ticket is displayed
  useEffect(() => {
    if (!generatedTicket) return;
    setResetCountdown(15);
    const interval = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          handleResetToMenu();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedTicket]);

  const handleResetToMenu = () => {
    setSelectedCategory(null);
    setSelectedSubOp(null);
    setGeneratedTicket(null);
    setCheckInResult(null);
    setCheckInCode('');
  };

  const handleSelectCategory = (cat: QueueCategory) => {
    setSelectedCategory(cat);
  };

  const handleSelectSubOpAndPrint = async (subOp: SubOperation) => {
    if (!selectedCategory || generatedTicket || issuingTicket.current) return;
    issuingTicket.current = true;
    setSelectedSubOp(subOp);

    const priority: TicketPriority = isPmrMode ? 'pmr' : 'standard';
    try {
    const ticket = await queueStore.createTicket(
      selectedCategory.id,
      subOp.id,
      priority,
      isPmrMode ? 'Visiteur PMR' : 'Visiteur Borne'
    );

    setGeneratedTicket(ticket);
    onTicketGenerated?.(ticket);
    } catch (error) { notifications.error(error instanceof Error ? error.message : 'Impossible de créer le ticket.'); } finally { issuingTicket.current = false; }
  };

  const handleCheckInSubmit = async (codeToUse?: string) => {
    try {
    const raw = codeToUse || checkInCode;
    if (!raw.trim()) return;

    // Parse payload: could be "P-001" or a URL like "http://.../?ticket=P-001..." or JSON
    let parsedToken = raw.trim();
    if (parsedToken.includes('ticket=')) {
      try {
        const url = new URL(parsedToken, window.location.origin);
        parsedToken = url.searchParams.get('ticket') || parsedToken;
      } catch (e) {
        const match = parsedToken.match(/[?&]ticket=([^&]+)/);
        if (match) parsedToken = decodeURIComponent(match[1]);
      }
    } else if (parsedToken.includes('token=')) {
      try {
        const url = new URL(parsedToken, window.location.origin);
        parsedToken = url.searchParams.get('token') || parsedToken;
      } catch (e) {
        const match = parsedToken.match(/[?&]token=([^&]+)/);
        if (match) parsedToken = decodeURIComponent(match[1]);
      }
    } else if (parsedToken.startsWith('{') && parsedToken.includes('tokenNumber')) {
      try {
        const obj = JSON.parse(parsedToken);
        parsedToken = obj.tokenNumber || obj.id || parsedToken;
      } catch (e) {}
    }

    const cleanToken = parsedToken.trim().toUpperCase();
    const cleanNorm = cleanToken.replace(/[-\s]/g, '');

    const findMatch = (ticketList: QueueTicket[]) => {
      return ticketList.find((t) => {
        if (!t) return false;
        const tNum = (t.tokenNumber || '').toUpperCase();
        const tNorm = tNum.replace(/[-\s]/g, '');
        return (
          tNum === cleanToken ||
          tNorm === cleanNorm ||
          t.id === parsedToken
        );
      });
    };

    // 1. Check local state first
    let ticket = findMatch(queueStore.getState().tickets);

    // 2. If not found locally, force fresh fetch from central server across LAN
    if (!ticket) {
      await queueStore.fetchServerState();
      ticket = findMatch(queueStore.getState().tickets);
    }

    if (ticket) {
      const proof=await queueStore.getKioskPresenceToken();
      const confirmed = await queueStore.confirmArrival(ticket.id,proof);
      if (confirmed) {
        setCheckInResult(`✓ Présence confirmée pour le ticket ${ticket.tokenNumber} ! Vous êtes maintenant dans la file active.`);
        setTimeout(() => {
          setShowCheckInModal(false);
          setGeneratedTicket(confirmed);
        }, 1200);
        return;
      }
    }

    setCheckInResult(`Aucune réservation active trouvée pour le code "${cleanToken}" dans cette agence.`);
    } catch (error) { setCheckInResult(error instanceof Error ? error.message : 'Confirmation impossible.'); }
  };

  const getCategoryIcon = (iconName: string) => {
    const iconClass = isPmrMode ? 'w-12 h-12' : 'w-9 h-9';
    switch (iconName) {
      case 'Banknote':
        return <Banknote className={iconClass} />;
      case 'UserCheck':
        return <UserCheck className={iconClass} />;
      case 'Briefcase':
        return <Briefcase className={iconClass} />;
      case 'Receipt':
        return <Receipt className={iconClass} />;
      case 'HelpCircle':
        return <HelpCircle className={iconClass} />;
      case 'FileText':
      default:
        return <FileText className={iconClass} />;
    }
  };

  // Live wait time calculation for kiosk sub-operations
  const getSubOpWaitTime = (subOp: SubOperation): { text: string; count: number } => {
    if (!selectedCategory) return { text: 'Immédiat (< 1 min)', count: 0 };
    const estimate = queueStore.getServiceEstimate(selectedCategory.id, subOp.id, isPmrMode ? 'pmr' : 'standard');
    return {text: estimate.estimatedMinutes === null ? 'Guichets indisponibles' : estimate.estimatedMinutes === 0 ? 'Immédiat (< 1 min)' : `~${estimate.estimatedMinutes} min`, count: estimate.peopleAhead};
  };

  const generatedEstimate = generatedTicket ? queueStore.getTicketEstimate(generatedTicket) : null;

  // Public LAN URLs (never localhost)
  const clientTrackingUrl = generatedTicket
    ? getPublicUrl(
        `?mode=client&ticket=${generatedTicket.tokenNumber}&ticketId=${generatedTicket.id}&cat=${generatedTicket.categoryId}&sub=${generatedTicket.subOperationId}&time=${encodeURIComponent(generatedTicket.createdAt)}&ahead=${queueStore.getTicketEstimate(generatedTicket).peopleAhead}`
      )
    : getPublicUrl('?mode=client');

  const kioskPresenceQrUrl = getPublicUrl(`?mode=client&action=confirm-presence&kiosk=${agency.id}&proof=${encodeURIComponent(presenceProof)}`);

  return (
    <div
      className={`h-screen max-h-screen w-full flex flex-col justify-between overflow-hidden select-none ${
        isPmrMode ? 'bg-amber-50/50 text-slate-900 text-lg' : 'bg-slate-100 text-slate-800'
      }`}
    >
      {/* 1. KIOSK BRAND HEADER */}
      <header className="bg-white border-b-2 border-slate-200/90 px-4 sm:px-6 py-2 sm:py-2.5 shadow-xs flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              title="Retourner au Hub"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hub</span>
            </button>
          )}
          <BankLogo brand={config.brand} size="sm" showTagline={false} />
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-extrabold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Borne Libre-Service
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
              Agence
            </span>
            <span className="text-xs font-bold text-slate-800">{agency?.name}</span>
          </div>

          {/* PMR TOGGLE */}
          <button
            onClick={() => setIsPmrMode((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
              isPmrMode
                ? 'bg-[#0055D4] text-white border-blue-700 shadow-sm ring-2 ring-blue-400'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Accessibility className="w-4 h-4" />
            <span>Mobilité réduite / سهولة الوصول</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN KIOSK BODY */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-2 flex flex-col justify-start overflow-y-auto min-h-0">
        {/* STEP 1: MAIN MENU */}
        {!selectedCategory && !generatedTicket && (
          <div className="space-y-3 sm:space-y-4 my-auto">
            <div className="text-center">
              <h1
                className={`font-black text-slate-900 tracking-tight ${
                  isPmrMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl lg:text-3xl'
                }`}
              >
                Bienvenue / مرحباً بكم
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600 font-bold">
                Veuillez sélectionner le type d'opération souhaité / يرجى اختيار الخدمة
              </p>
            </div>

            {/* CATEGORY TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-left border-2 shadow-xs hover:shadow-lg transition-all duration-200 flex items-center justify-between group active:scale-98 cursor-pointer relative overflow-hidden ${
                    isPmrMode
                      ? 'bg-white border-slate-400 hover:border-[#0055D4]'
                      : 'bg-white border-slate-200/90 hover:border-slate-400'
                  }`}
                >
                  <div
                    className="absolute top-0 left-0 bottom-0 w-2"
                    style={{ backgroundColor: cat.color || config.brand.primaryColor }}
                  />

                  <div className="flex items-center gap-3.5 pl-1.5">
                    <div
                      className="p-3 rounded-2xl transition-transform group-hover:scale-105 shrink-0"
                      style={{
                        backgroundColor: `${cat.color || config.brand.primaryColor}15`,
                        color: cat.color || config.brand.primaryColor,
                      }}
                    >
                      {getCategoryIcon(cat.iconName)}
                    </div>

                    <div>
                      <h3
                        className={`font-black text-slate-900 ${
                          isPmrMode ? 'text-lg sm:text-xl' : 'text-sm sm:text-base lg:text-lg'
                        }`}
                      >
                        {cat.labelFr}
                      </h3>
                      {cat.labelAr && (
                        <p className="text-xs font-semibold text-slate-400 mt-0.5" dir="rtl">
                          {cat.labelAr}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-slate-300 group-hover:text-slate-700 font-black text-xl pr-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
              ))}
            </div>

            {/* CHECK-IN FOR PRE-BOOKED VISITORS VIA QR CODE SCAN */}
            <div className="pt-1 flex flex-col items-center gap-1">
              <button
                onClick={() => {
                  setCheckInResult(null);
                  setShowCheckInModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border-2 border-[#0055D4] hover:bg-blue-50/50 shadow-xs text-xs sm:text-sm font-black text-[#0055D4] transition-all cursor-pointer group"
              >
                <QrCode className="w-4 h-4 text-[#0055D4] group-hover:scale-110 transition-transform" />
                <span>Déjà réservé sur l'application ? Confirmer ma présence (QR Code)</span>
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                Scannez le QR Code de la borne avec votre téléphone ou tapez votre numéro de réservation
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: SUB-OPERATION MENU */}
        {selectedCategory && !generatedTicket && (
          <div className="space-y-3 my-auto flex flex-col max-h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour au menu principal</span>
              </button>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Catégorie choisie
                </span>
                <h2 className="text-xs sm:text-sm font-black text-slate-900">{selectedCategory.labelFr}</h2>
              </div>
            </div>

            <div className="text-center shrink-0">
              <h2
                className={`font-black text-slate-900 ${
                  isPmrMode ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg lg:text-xl'
                }`}
              >
                Précisez votre demande
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 font-semibold">
                Sélectionnez l'opération pour imprimer votre ticket
              </p>
            </div>

            {/* SUB-OPERATIONS LIST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[55vh] pr-1 py-1">
              {selectedCategory.subOperations.map((subOp) => (
                <button
                  key={subOp.id}
                  onClick={() => handleSelectSubOpAndPrint(subOp)}
                  className={`p-3.5 sm:p-4 rounded-2xl text-left border-2 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group active:scale-98 cursor-pointer relative ${
                    isPmrMode
                      ? 'bg-white border-slate-400 hover:border-[#0055D4]'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <h4
                      className={`font-black text-slate-900 ${
                        isPmrMode ? 'text-base' : 'text-xs sm:text-sm'
                      }`}
                    >
                      {subOp.labelFr}<span className="block mt-1" lang="ar" dir="rtl">{subOp.labelAr}</span>
                    </h4>
                    {subOp.requiredDocuments && subOp.requiredDocuments.length > 0 && (
                      <span className="text-base font-semibold text-slate-500 mt-1 block whitespace-normal break-words">
                        Documents requis : {subOp.requiredDocuments.map((d) => d.label).join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span className="flex items-center gap-1 text-slate-700 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        Attente estimée :{' '}
                        <strong className="text-slate-900 font-mono">
                          {getSubOpWaitTime(subOp).text}
                        </strong>
                      </span>
                    </span>
                    <span
                      className="font-black group-hover:underline text-xs"
                      style={{ color: config.brand.primaryColor }}
                    >
                      Prendre ce ticket →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: TICKET GENERATED & PRINT SIMULATION */}
        {generatedTicket && (
          <div className="max-w-sm mx-auto w-full my-4 shrink-0">
            {/* REALISTIC PRINTED TICKET SLIP */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xl border-2 border-slate-200 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              {/* Decorative ticket notch edges */}
              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 border-r border-slate-300" />
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 border-l border-slate-300" />

              <div className="flex justify-center mb-1">
                <BankLogo brand={config.brand} size="sm" showTagline={false} />
              </div>

              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {agency?.name}
              </span>

              <div className="my-2 py-1.5 border-y-2 border-dashed border-slate-300">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Numéro de Ticket
                </span>

                {/* BIG TOKEN NUMBER */}
                <div
                  className="font-mono text-4xl sm:text-5xl font-black my-1 tracking-wider"
                  style={{ color: config.brand.primaryColor }}
                >
                  {generatedTicket.tokenNumber}
                </div>

                <span className="text-base font-black text-slate-800 block whitespace-normal">
                  {generatedTicket.subOperationName}
                </span>
              </div>

              {/* ESTIMATE & PEOPLE AHEAD */}
              <div className="grid grid-cols-2 gap-2 my-2 text-xs font-semibold">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] font-bold">Tickets avant vous (ordre de file)</span>
                  <span className="text-slate-900 text-sm font-black font-mono">
                    {generatedEstimate?.peopleAhead ?? 0} ticket(s)
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] font-bold">Temps estimé</span>
                  <span className="text-[#0055D4] text-sm font-black font-mono">
                    {generatedEstimate?.estimatedMinutes === null ? 'Guichets indisponibles' : generatedEstimate?.estimatedMinutes === 0
                      ? 'Immédiat'
                      : `~${generatedEstimate?.estimatedMinutes} min`}
                  </span>
                </div>
              </div>

              {generatedEstimate && <ParallelServiceNote {...generatedEstimate} />}

              {/* QR CODE TO LINK WITH MOBILE APP */}
              <div className="my-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Suivre votre ticket sur smartphone
                </span>
                <div className="flex justify-center">
                  <QrCodeView value={clientTrackingUrl} size={85} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  Scannez ce QR Code pour suivre votre tour en direct
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-mono font-bold">
                <span>{new Date(generatedTicket.createdAt).toLocaleTimeString('fr-FR')}</span>
                <span>Ticket Imprimé</span>
              </div>

              {/* FINISH BUTTON WITH AUTO COUNTDOWN */}
              <button
                onClick={handleResetToMenu}
                className="mt-3 w-full py-2.5 rounded-xl text-xs font-black text-white shadow-xs transition-transform active:scale-98 cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                Terminer / Nouveau ticket ({resetCountdown}s)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. KIOSK FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-2 px-6 text-center text-xs text-slate-600 flex justify-between items-center font-bold shrink-0 select-none">
        <span>© {config.brand.name} • Borne interactive d'accueil</span>
        <span className="text-slate-800">En cas de besoin, adressez-vous à l'accueil</span>
      </footer>

      {/* CHECK-IN MODAL FOR ONLINE RESERVATIONS (WITH REAL CAMERA SCANNER OR BORNE QR CODE) */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl border-2 border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Validation de Présence en Agence
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Activez votre ticket ou rendez-vous pris sur l'application
                </p>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setCheckInTab('camera');
                  setCheckInResult(null);
                }}
                className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  checkInTab === 'camera'
                    ? 'bg-white text-[#0055D4] shadow-xs font-black'
                    : 'hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-[#0055D4]" />
                <span className="truncate">Caméra Borne</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckInTab('qr_phone');
                  setCheckInResult(null);
                }}
                className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  checkInTab === 'qr_phone'
                    ? 'bg-white text-[#0055D4] shadow-xs font-black'
                    : 'hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate">Scanner borne</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckInTab('manual');
                  setCheckInResult(null);
                }}
                className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  checkInTab === 'manual'
                    ? 'bg-white text-[#0055D4] shadow-xs font-black'
                    : 'hover:text-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-600" />
                <span className="truncate">Code manuel</span>
              </button>
            </div>

            {/* TAB 1: REAL CAMERA SCANNER ON LA BORNE */}
            {checkInTab === 'camera' && (
              <div className="space-y-3">
                <RealQrCameraScanner
                  title="Scanner de la Borne"
                  subtitle="Placez l'écran de votre smartphone (ou votre billet QR) face à la caméra"
                  preferredFacingMode="user"
                  showCloseButton={false}
                  allowFileUpload={true}
                  onScan={(code) => handleCheckInSubmit(code)}
                />

                {checkInResult && (
                  <p role="status" className={`text-sm font-bold p-2.5 rounded-xl border ${checkInResult.startsWith('✓') ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-800 bg-rose-50 border-rose-200'}`}>
                    {checkInResult}
                  </p>
                )}
              </div>
            )}

            {/* TAB 2: QR CODE OF LA BORNE FOR PHONE SCAN */}
            {checkInTab === 'qr_phone' && (
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-[#0055D4] flex flex-col items-center">
                <span className="text-xs font-black uppercase tracking-wider text-[#0055D4] mb-2">
                  Scannez ce QR Code avec votre smartphone
                </span>
                {presenceProof ? <QrCodeView value={kioskPresenceQrUrl} size={150} /> : <p role="status" className="text-sm text-amber-800">QR de présence indisponible. Vérifiez la connexion au serveur.</p>}
                <p className="text-[11px] text-slate-600 mt-3 font-semibold max-w-xs leading-relaxed">
                  Ouvrez votre ticket sur votre smartphone et appuyez sur <span className="text-[#0055D4] font-black">"Scanner le QR Code de la borne"</span> pour flasher ce code.
                </p>
              </div>
            )}

            {/* TAB 3: MANUAL NUMERIC / CODE ENTRY */}
            {checkInTab === 'manual' && (
              <div className="space-y-3 py-2">
                <label className="text-xs font-bold text-slate-700 block text-left">
                  Saisissez votre numéro de ticket ou réservation :
                </label>
                <input
                  type="text"
                  value={checkInCode}
                  onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCheckInSubmit(); }}
                  placeholder="Ex : P-001, R-102, C-021..."
                  className="w-full text-center font-mono font-black text-xl p-3.5 rounded-2xl border-2 border-slate-300 focus:outline-none focus:border-[#0055D4] uppercase tracking-wider"
                  autoFocus
                />

                {checkInResult && (
                  <p role="status" className={`text-sm font-bold p-2.5 rounded-xl border ${checkInResult.startsWith('✓') ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-800 bg-rose-50 border-rose-200'}`}>
                    {checkInResult}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleCheckInSubmit()}
                  disabled={!checkInCode.trim()}
                  className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black text-white shadow-sm cursor-pointer disabled:opacity-40 transition-all active:scale-98"
                  style={{ backgroundColor: config.brand.primaryColor }}
                >
                  Valider le code
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
