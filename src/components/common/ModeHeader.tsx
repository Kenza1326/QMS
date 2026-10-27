import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Clock,
  Building2,
  Tv,
  Layers,
  Smartphone,
  Users,
} from 'lucide-react';
import { QueueSystemConfig } from '../../types/queueTypes';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { BankLogo } from './BankLogo';
import { AuthLoginModal } from './AuthLoginModal';
import { authService } from '../../services/authService';

interface ModeHeaderProps {
  config: QueueSystemConfig;
  currentMode: 'screen' | 'kiosk' | 'client' | 'admin';
  onBackToHub: () => void;
  onToggleSound?: () => void;
  isSoundMuted?: boolean;
}

export const ModeHeader: React.FC<ModeHeaderProps> = ({
  config,
  currentMode,
  onBackToHub,
  onToggleSound,
  isSoundMuted = false,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsub = authService.subscribe((s) => {
      setCurrentUser(s?.user || null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const agencies = config?.agencies?.length ? config.agencies : DEFAULT_QUEUE_CONFIG.agencies;
  const agency = agencies.find((a) => a.id === config?.selectedAgencyId) || agencies[0];

  const modeIcons = {
    screen: <Tv className="w-3.5 h-3.5" />,
    kiosk: <Layers className="w-3.5 h-3.5" />,
    client: <Smartphone className="w-3.5 h-3.5" />,
    admin: <Users className="w-3.5 h-3.5" />,
  };

  const modeLabels = {
    screen: 'Écran TV d\'Affichage',
    kiosk: 'Borne Tactile Libre-Service',
    client: 'Portail Client Mobile',
    admin: 'Poste Guichet & Admin',
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 py-2.5 shadow-xs select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* LEFT: BACK TO HUB & BRAND LOGO */}
        <div className="flex items-center gap-3">
          <button
            hidden={currentMode === 'client'} onClick={onBackToHub}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Revenir au choix des écrans"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </button>

          <BankLogo brand={config.brand} size="sm" showTagline={false} />

          {/* Current Mode Badge */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
            style={{
              backgroundColor: `${config.brand.primaryColor}10`,
              color: config.brand.primaryColor,
              borderColor: `${config.brand.primaryColor}25`,
            }}
          >
            {modeIcons[currentMode]}
            <span>{modeLabels[currentMode]}</span>
          </div>
        </div>

        {/* CENTER: AGENCY NAME */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{agency?.name}</span>
        </div>

        {/* RIGHT: TIME, FULLSCREEN, SOUND */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Date & Time */}
          <div className="flex items-center gap-2 text-right">
            <Clock className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <div className="flex flex-col text-right leading-none">
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                {currentTime}
              </span>
              <span className="text-[10px] text-slate-500 capitalize hidden sm:inline">
                {currentDate}
              </span>
            </div>
          </div>

          {/* Sound Toggle */}
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isSoundMuted ? 'Activer le son' : 'Couper le son'}
            >
              {isSoundMuted ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-700" />
              )}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Plein écran"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-slate-700" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Staff Auth Button */}
          <button
            hidden={currentMode === 'client'} onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
            title="Connexion agent / session"
          >
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
            ) : (
              <Users className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="font-bold text-slate-800 hidden md:inline text-[11px]">
              {currentUser ? currentUser.name : 'Connexion'}
            </span>
          </button>
        </div>
      </div>

      {/* AUTH LOGIN MODAL */}
      <AuthLoginModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(session) => {
          setCurrentUser(session.user);
        }}
      />
    </header>
  );
};
