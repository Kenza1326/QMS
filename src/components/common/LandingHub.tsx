import {notifications} from '../../services/notificationService';
import React, { useState, useEffect } from 'react';
import {
  Tv,
  Smartphone,
  Layers,
  Users,
  Building2,
  Volume2,
  Sparkles,
  ExternalLink,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  Lock,
  KeyRound,
  Check,
  Unlock,
} from 'lucide-react';
import { QueueSystemConfig, BrandConfig } from '../../types/queueTypes';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { BankLogo } from './BankLogo';
import { QrCodeView } from './QrCodeView';
import { audioService } from '../../services/audioService';
import { authService } from '../../services/authService';
import { getPublicUrl } from '../../utils/urlUtils';
import { AuthLoginModal } from './AuthLoginModal';

interface LandingHubProps {
  config: QueueSystemConfig;
  onSelectMode: (mode: 'screen' | 'kiosk' | 'client' | 'admin', subView?: 'counter' | 'dashboard') => void;
  onSelectAgency: (agencyId: string) => void;
}

export const LandingHub: React.FC<LandingHubProps> = ({
  config,
  onSelectMode,
  onSelectAgency,
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [targetModeForAuth, setTargetModeForAuth] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsub = authService.subscribe((s) => {
      setCurrentUser(s?.user || null);
    });
    return unsub;
  }, []);

  const isClient = authService.isClientProfile();
  const isAdmin = currentUser?.role === 'admin';
  const isTeller = currentUser?.role === 'teller';

  const agencies = config?.agencies?.length ? config.agencies : DEFAULT_QUEUE_CONFIG.agencies;
  const activeAgency = agencies.find((a) => a.id === config?.selectedAgencyId) || agencies[0];
  const brand = config?.brand || DEFAULT_QUEUE_CONFIG.brand;

  const clientUrl = getPublicUrl('?mode=client');

  const handleTestAudio = () => {
    audioService.playChime(config.soundSettings?.volume || 0.8);
    audioService.speakTicketCall('C-025', 'Guichet 2', 'fr-FR', true);
    setAudioFeedback(true);
    setTimeout(() => setAudioFeedback(false), 2000);
  };

  const handleOpenInNewTab = (mode: string) => {
    // If client tries to open admin tabs in new tab, intercept with PIN modal
    if (isClient && (mode === 'admin' || mode === 'counter' || mode === 'dashboard')) {
      handleProtectedModeClick(mode === 'dashboard' ? 'le Tableau de Bord RA' : 'le Poste Guichetier');
      return;
    }
    const url = getPublicUrl(`?mode=${mode}`);
    window.open(url, '_blank', 'noopener');
  };

  const handleProtectedModeClick = (modeName: string) => {
    setTargetModeForAuth(modeName);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <BankLogo brand={config.brand} size="md" />

          {/* QUICK CONTROLS: AGENCY & AUDIO */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">

            {/* Agency Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-200 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-600 hidden sm:inline">Agence :</span>
              <select
                value={config.selectedAgencyId}
                onChange={(e) => onSelectAgency(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[170px] truncate"
              >
                {config.agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Test */}
            <button
              onClick={handleTestAudio}
              title="Tester le carillon et l'annonce vocale"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                audioFeedback
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 scale-95'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{audioFeedback ? 'Carillon actif !' : 'Test Son'}</span>
            </button>

            {/* PROFILE SWITCHER / AUTH BUTTON */}
            <button
              onClick={() => {
                setTargetModeForAuth(undefined);
                setAuthModalOpen(true);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer text-xs ${
                isClient
                  ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                  : 'bg-slate-900 border-slate-900 text-white hover:bg-black'
              }`}
              title="Changer de profil ou saisir un code PIN"
            >
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <Users className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="font-bold">
                {currentUser ? `${currentUser.name}` : 'Profil Client'}
              </span>
              {isClient ? (
                <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-mono font-bold">
                  Libre
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-bold">
                  PIN OK
                </span>
              )}
            </button>

            {/* Direct Dashboard Link (Protected if Client or Teller) */}
            <button
              onClick={() => {
                if (isAdmin) {
                  onSelectMode('admin', 'dashboard');
                } else {
                  handleProtectedModeClick('le Tableau de Bord RA & Paramètres');
                }
              }}
              title={isAdmin ? 'Ouvrir le tableau de bord décisionnel' : 'Code PIN requis pour le Tableau de Bord RA'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                isAdmin
                  ? 'text-white bg-slate-900 hover:bg-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              {isAdmin && <BarChart3 className="w-3.5 h-3.5 text-blue-400" />}
              <span>Tableau de Bord RA</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border shadow-sm"
            style={{
              backgroundColor: `${config.brand.primaryColor}15`,
              color: config.brand.primaryColor,
              borderColor: `${config.brand.primaryColor}30`,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plateforme de Gestion des Files d'Attente</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Système d'Accueil & Gestion de File d'Attente
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Sélectionnez ci-dessous l'application ou l'écran à démarrer pour votre agence{' '}
            <span className="font-semibold text-slate-800">{activeAgency?.name}</span>.
          </p>
        </div>

        {/* ACTIVE STATUS BANNER */}
        {isClient ? (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-2 border-blue-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Profil Client Actif (@client) • Accès Libre Ouvert
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Borne, TV & Mobile Disponibles
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  L'<strong>Écran Géant TV</strong>, la <strong>Borne Tactile</strong> et le <strong>Portail Mobile</strong> sont en accès libre sans code PIN pour vos tests. Le <strong>Poste Guichetier</strong> et le <strong>Tableau de Bord</strong> sont protégés par code PIN.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setTargetModeForAuth('le Poste Guichetier ou Direction');
                setAuthModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer shrink-0 transition-transform active:scale-95"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Connexion Staff (Code PIN)</span>
            </button>
          </div>
        ) : (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    Session Staff Validée : {currentUser?.name} (@{currentUser?.username})
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    {currentUser?.roleLabel}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Votre session est authentifiée par code PIN. Vous avez accès à l'ensemble des fonctionnalités opérationnelles de votre poste.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                authService.switchToClientUser();
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0 transition-transform active:scale-95"
            >
              Basculer en Mode Client Libre
            </button>
          </div>
        )}

        {/* 4 LARGE SELECTION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. ÉCRAN D'AFFICHAGE DYNAMIQUE (ACCÈS LIBRE CLIENT) */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200/80 hover:border-slate-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: config.brand.primaryColor }}
            />
            <div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 shadow-sm"
                style={{
                  backgroundColor: `${config.brand.primaryColor}15`,
                  color: config.brand.primaryColor,
                }}
              >
                <Tv className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Hall d'Agence
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Accès Libre
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-slate-950">
                Écran d'Affichage Dynamique
              </h2>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Affichage grand écran pour le hall d'agence avec appel sonore du prochain ticket,
                historique en direct, taux de change DZD et bannières promotionnelles.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => onSelectMode('screen')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                <Tv className="w-4 h-4" />
                <span>Démarrer l'Écran TV</span>
              </button>

              <button
                onClick={() => handleOpenInNewTab('screen')}
                className="w-full py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Ouvrir dans un nouvel onglet</span>
              </button>
            </div>
          </div>

          {/* 2. BORNE TACTILE D'ACCUEIL (ACCÈS LIBRE CLIENT) */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200/80 hover:border-slate-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: config.brand.secondaryColor || '#C99700' }}
            />
            <div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 shadow-sm"
                style={{
                  backgroundColor: `${config.brand.secondaryColor || '#C99700'}20`,
                  color: config.brand.secondaryColor || '#C99700',
                }}
              >
                <Layers className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Entrée Agence
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Accès Libre
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-slate-950">
                Borne Libre-Service
              </h2>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Interface tactile bilingue (Français / Arabe) pour sélection de l'opération,
                génération du ticket imprimé avec QR code et confirmation de présence physique.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => onSelectMode('kiosk')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                <Layers className="w-4 h-4" />
                <span>Lancer la Borne Tactile</span>
              </button>

              <button
                onClick={() => handleOpenInNewTab('kiosk')}
                className="w-full py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Ouvrir dans un nouvel onglet</span>
              </button>
            </div>
          </div>

          {/* 3. PORTAIL CLIENT WEB RESPONSIVE (ACCÈS LIBRE CLIENT) */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200/80 hover:border-slate-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600"
            />
            <div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 shadow-sm bg-blue-50 text-blue-600">
                <Smartphone className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Visiteurs & Clients
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Accès Libre
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-slate-950">
                Portail Client Web (QR Code)
              </h2>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Web App accessible sans installation par scan de QR code : prise de ticket, pièces
                à fournir (« attente active »), suivi de position en temps réel et feedback.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => onSelectMode('client')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                <Smartphone className="w-4 h-4" />
                <span>Ouvrir le Portail Client</span>
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="w-full py-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3 h-3" />
                <span>Afficher le QR code à scanner</span>
              </button>
            </div>
          </div>

          {/* 4. POSTE GUICHETIER & ADMIN (VERROUILLÉ PAR PIN POUR LE CLIENT) */}
          <div
            className={`bg-white rounded-2xl p-6 border-2 transition-all duration-200 flex flex-col justify-between group relative overflow-hidden ${
              isClient
                ? 'border-slate-200 bg-slate-50/70'
                : 'border-slate-200/80 hover:border-slate-400 hover:shadow-xl'
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-2 ${
                isClient ? 'bg-slate-400' : 'bg-slate-900'
              }`}
            />
            <div>
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform shadow-sm ${
                  isClient ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-800 group-hover:scale-105'
                }`}
              >
                {isClient ? <Lock className="w-7 h-7" /> : <Users className="w-7 h-7" />}
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Personnel & Direction
                </span>
                {isClient ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> PIN Requis
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {currentUser?.roleLabel}
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-slate-950">
                Poste Guichet & Admin
              </h2>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Appel des tickets pour chaque guichetier (bouton suivant, prise en charge, clôture)
                et tableau de bord décisionnel RA (temps moyen, affluence, satisfaction).
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              {/* ACTION: POSTE GUICHETIER (PIN REQUIS SI CLIENT) */}
              <button
                onClick={() => {
                  if (isClient) {
                    handleProtectedModeClick('le Poste Guichetier');
                  } else {
                    onSelectMode('admin', 'counter');
                  }
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer ${
                  isClient
                    ? 'bg-slate-700 hover:bg-slate-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isClient ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <Users className="w-3.5 h-3.5" />}
                <span>Poste Guichetier {isClient ? '(Code PIN Requis)' : '(Appels)'}</span>
              </button>

              {/* ACTION: TABLEAU DE BORD RA (PIN REQUIS SI PAS ADMIN) */}
              <button
                onClick={() => {
                  if (isAdmin) {
                    onSelectMode('admin', 'dashboard');
                  } else {
                    handleProtectedModeClick('le Tableau de Bord RA & Paramètres');
                  }
                }}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
              >
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                {isAdmin && <BarChart3 className="w-3.5 h-3.5 text-blue-600" />}
                <span>Tableau de Bord RA {!isAdmin ? '(PIN Admin)' : ''}</span>
              </button>

              <button
                onClick={() => handleOpenInNewTab('admin')}
                className="w-full py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Ouvrir dans un nouvel onglet</span>
              </button>
            </div>
          </div>
        </div>

        {/* PRODUCTION DEPLOYMENT HINT */}
        <div className="mt-10 p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Déploiement en agence :</strong> Écran TV (<code className="bg-slate-100 px-1 py-0.5 rounded">{`?mode=screen&agency=${activeAgency.id}`}</code>), Borne (<code className="bg-slate-100 px-1 py-0.5 rounded">{`?mode=kiosk&agency=${activeAgency.id}`}</code>), et Portail (<code className="bg-slate-100 px-1 py-0.5 rounded">{`?mode=client&agency=${activeAgency.id}`}</code>) sont ouverts aux clients. Conservez le paramètre agency pour chaque poste.
            </span>
          </div>
          <span className="text-slate-400">{config.brand.name} Queue Management</span>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <span>© {new Date().getFullYear()} {config.brand.name} • Tous droits réservés</span>
      </footer>

      {/* QR CODE MODAL FOR MOBILE CLIENT */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Scan Mobile Client
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Accédez au Portail Client Web
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Scannez ce QR code avec l'appareil photo de votre smartphone pour tester l'expérience
              visiteur en agence.
            </p>

            <div className="flex justify-center mb-4">
              <QrCodeView value={clientUrl} size={180} />
            </div>

            <p className="text-[11px] font-mono text-slate-500 bg-slate-100 p-2 rounded-lg break-all mb-4">
              {clientUrl}
            </p>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(clientUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  } catch { notifications.error('Impossible de copier le lien. Sélectionnez l’adresse affichée pour la copier.'); }
                }}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {linkCopied ? 'Copié ✓' : 'Copier le lien'}
              </button>
              <button
                onClick={() => {
                  setShowQrModal(false);
                  onSelectMode('client');
                }}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: config.brand.primaryColor }}
              >
                Tester ici
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH LOGIN MODAL */}
      <AuthLoginModal
        isOpen={authModalOpen}
        targetMode={targetModeForAuth}
        onClose={() => {
          setAuthModalOpen(false);
          setTargetModeForAuth(undefined);
        }}
        onLoginSuccess={(session) => {
          setCurrentUser(session.user);
          setTargetModeForAuth(undefined);
        }}
      />
    </div>
  );
};
