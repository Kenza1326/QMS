import {NotificationHost} from './components/common/NotificationHost';
import {notifications} from './services/notificationService';
import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Users, ArrowLeft, Tv, Layers, Smartphone } from 'lucide-react';
import { QueueSystemConfig } from './types/queueTypes';
import { configService } from './services/configService';
import { queueStore, QueueState } from './services/queueStore';
import { authService } from './services/authService';
import { LandingHub } from './components/common/LandingHub';
import { ModeHeader } from './components/common/ModeHeader';
import { BigScreenDisplay } from './components/bigscreen/BigScreenDisplay';
import { KioskTerminal } from './components/kiosk/KioskTerminal';
import { ClientWebApp } from './components/client/ClientWebApp';
import { CounterStation } from './components/counter/CounterStation';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthLoginModal } from './components/common/AuthLoginModal';

type AppMode = 'hub' | 'screen' | 'kiosk' | 'client' | 'admin';

export default function App() {
  const [config, setConfig] = useState<QueueSystemConfig>(configService.getConfig());
  const [queueState, setQueueState] = useState<QueueState>(queueStore.getState());
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [targetModeForAuth, setTargetModeForAuth] = useState<string | undefined>(undefined);

  const [adminSubView, setAdminSubView] = useState<'counter' | 'dashboard'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      if (view === 'dashboard' || view === 'counter') return view;
      if (params.get('mode') === 'dashboard') return 'dashboard';
    }
    return 'counter';
  });

  const [currentMode, setCurrentMode] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'dashboard') {
        return 'admin';
      }
      if (modeParam && ['screen', 'kiosk', 'client', 'admin'].includes(modeParam)) {
        return modeParam as AppMode;
      }
    }
    return 'hub';
  });

  useEffect(() => () => notifications.dismissAll(), [currentMode, config.selectedAgencyId]);

  const [clientTicketQuery, setClientTicketQuery] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('ticket');
    }
    return null;
  });

  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);

  // Initialize config, auth & listen to state changes
  useEffect(() => {
    configService.init().then((cfg) => {
      setConfig({ ...cfg });
    });

    const unsubConfig = configService.subscribe((cfg) => {
      setConfig({ ...cfg });
    });

    const unsubQueue = queueStore.subscribe((state) => {
      setQueueState({ ...state });
    });

    const unsubAuth = authService.subscribe((session) => {
      setCurrentUser(session?.user || null);
    });

    // Handle browser back/forward navigation
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode') as AppMode | null;
      if (modeParam && ['screen', 'kiosk', 'client', 'admin'].includes(modeParam)) {
        setCurrentMode(modeParam);
      } else {
        setCurrentMode('hub');
      }
      setClientTicketQuery(params.get('ticket'));
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubConfig();
      unsubQueue();
      unsubAuth();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleSelectMode = (mode: AppMode, subView?: 'counter' | 'dashboard') => {
    if (subView) {
      setAdminSubView(subView);
    }
    setCurrentMode(mode);
    // Update URL query without page reload
    const url = new URL(window.location.href);
    if (mode === 'hub') {
      url.searchParams.delete('mode');
      url.searchParams.delete('ticket');
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('mode', mode);
      if (mode === 'admin' && subView) {
        url.searchParams.set('view', subView);
      } else if (mode !== 'admin') {
        url.searchParams.delete('view');
      }
    }
    window.history.pushState({}, '', url.toString());
  };

  const handleSwitchBrand = (brandId: string) => {
    configService.switchBrand(brandId);
  };

  const handleSelectAgency = (agencyId: string) => {
    configService.selectAgency(agencyId);
  };

  const handleToggleSound = () => {
    const current = config.soundSettings.soundEnabled;
    const updated = {
      ...config,
      soundSettings: {
        ...config.soundSettings,
        soundEnabled: !current,
      },
    };
    configService.saveConfig(updated);
    setIsSoundMuted(current);
  };

  const isClient = authService.isClientProfile();
  const isAdmin = currentUser?.role === 'admin';
  const isTeller = currentUser?.role === 'teller';

  // Client profile can freely access screen, kiosk, client.
  // Client is BLOCKED from admin/guichet and dashboard unless authenticated by PIN!
  const isBlockedScreen =
    (isClient && currentMode === 'admin') ||
    (isTeller && currentMode === 'admin' && adminSubView === 'dashboard');

  const getBlockedModeLabel = () => {
    if (adminSubView === 'dashboard') return 'le Tableau de Bord RA & Paramètres';
    if (currentMode === 'admin') return 'le Poste Guichetier';
    return 'cet écran';
  };

  const isFullscreenTerminal = currentMode === 'screen' || currentMode === 'kiosk';

  return (
    <div
      className={`${
        isFullscreenTerminal && !isBlockedScreen ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'
      } bg-[#F8F9FA] text-[#1E293B] flex flex-col font-sans`}
    >
      {/* 1. LANDING HUB (NO MODE SELECTED) */}
      {currentMode === 'hub' && (
        <LandingHub
          config={config}
          onSelectMode={handleSelectMode}
          onSelectAgency={handleSelectAgency}
        />
      )}

      {/* 2. SPECIFIC MODE ACTIVE: HEADER + MODE COMPONENT */}
      {currentMode !== 'hub' && (
        <>
          {(!isFullscreenTerminal || isBlockedScreen) && (
            <ModeHeader
              config={config}
              currentMode={currentMode}
              onBackToHub={() => handleSelectMode('hub')}
              onToggleSound={handleToggleSound}
              isSoundMuted={isSoundMuted}
            />
          )}

          <div key={config.selectedAgencyId} className={`flex-1 ${isFullscreenTerminal && !isBlockedScreen ? 'h-full overflow-hidden flex flex-col' : ''}`}>
            {/* GUARD: IF CLIENT PROMPT TRIES TO ACCESS BLOCKED GUICHET/ADMIN */}
            {isBlockedScreen ? (
              <div className="flex-1 min-h-[80vh] flex items-center justify-center p-6 bg-slate-100">
                <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                    <Lock className="w-8 h-8" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black uppercase tracking-wider mb-2">
                    <span>Espace Réservé au Personnel (Code PIN Requis)</span>
                  </div>

                  <h2 className="text-xl font-black text-slate-900 mb-2">
                    Accès Protégé à {getBlockedModeLabel()}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                    Le profil actuel (<strong>{currentUser?.name || '@client'}</strong>) n'est pas autorisé à accéder à cet espace.
                    Veuillez saisir le code PIN d'un guichetier ou de l'administrateur pour déverrouiller ce poste.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setTargetModeForAuth(getBlockedModeLabel());
                        setAuthModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Saisir le Code PIN pour Déverrouiller</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <button
                        onClick={() => handleSelectMode('kiosk')}
                        className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Borne</span>
                      </button>
                      <button
                        onClick={() => handleSelectMode('screen')}
                        className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>Écran TV</span>
                      </button>
                      <button
                        onClick={() => handleSelectMode('client')}
                        className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Portail</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleSelectMode('hub')}
                      className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Retour au Hub d'accueil</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* A. BIG SCREEN TV DISPLAY (ACCESSIBLE TO CLIENT) */}
                {currentMode === 'screen' && (
                  <BigScreenDisplay
                    config={config}
                    queueState={queueState}
                    onOpenClientApp={() => handleSelectMode('client')}
                    onBackToHub={() => handleSelectMode('hub')}
                  />
                )}

                {/* B. IN-BRANCH TOUCH KIOSK (ACCESSIBLE TO CLIENT) */}
                {currentMode === 'kiosk' && (
                  <KioskTerminal
                    config={config}
                    onBackToHub={() => handleSelectMode('hub')}
                  />
                )}

                {/* C. RESPONSIVE CLIENT WEB APP (ACCESSIBLE TO CLIENT) */}
                {currentMode === 'client' && (
                  <ClientWebApp
                    config={config}
                    initialTicketNumber={clientTicketQuery}
                    onBackToHub={() => handleSelectMode('hub')}
                  />
                )}

                {/* D. COUNTER TELLER STATION & RA DASHBOARD (AUTHORIZED STAFF ONLY) */}
                {currentMode === 'admin' && (
                  <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
                    {/* Mode sub-switch: Guichetier vs RA Dashboard */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAdminSubView('counter')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            adminSubView === 'counter'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          Poste Guichetier (Appel des tickets)
                        </button>
                        <button
                          onClick={() => {
                            if (isAdmin) {
                              setAdminSubView('dashboard');
                            } else {
                              setTargetModeForAuth('le Tableau de Bord RA & Paramètres');
                              setAuthModalOpen(true);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            adminSubView === 'dashboard'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                          <span>Tableau de Bord RA & Paramètres</span>
                        </button>
                      </div>

                      {/* Current Staff Indicator */}
                      <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Connecté : <strong>{currentUser?.name}</strong> (@{currentUser?.username})</span>
                      </div>
                    </div>

                    {adminSubView === 'counter' ? (
                      <CounterStation config={config} queueState={queueState} />
                    ) : (
                      <AdminDashboard
                        config={config}
                        queueState={queueState}
                        onUpdateConfig={(cfg) => configService.saveConfig(cfg)}
                        onSwitchBrand={handleSwitchBrand}
                        onGoToCounter={() => setAdminSubView('counter')}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* GLOBAL AUTH MODAL FOR UNLOCKING OR SWITCHING */}
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
      <NotificationHost />
    </div>
  );
}
