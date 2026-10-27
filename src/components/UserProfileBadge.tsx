import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Layers,
  ChevronDown,
  LogIn,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Hash,
  Shield,
  CreditCard,
  X,
} from 'lucide-react';
import { UserInfoBudget } from '../types';

interface UserProfileBadgeProps {
  userInfo: UserInfoBudget | null;
  ktaSession: {
    checked: boolean;
    isValid: boolean;
    resourceId: string | null;
    displayName: string | null;
  };
  onReconnect: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  userInfo,
  ktaSession,
  onReconnect,
  onRefresh,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Compute displayed values safely
  const prenom = userInfo?.prenom || '';
  const nom = userInfo?.nom || '';
  const fullName = `${prenom} ${nom}`.trim() || 'Hadjer Kaddour';
  const email = userInfo?.email || 'hkaddour@capturedoc.com';
  const directionName = userInfo?.direction?.libelle || userInfo?.direction?.code || 'SiOP';
  const departementName =
    userInfo?.direction?.departement?.libelle ||
    userInfo?.direction?.departement?.code ||
    'MOA';
  const matricule = userInfo?.matricule || '';
  const lignesBudgetaires = Array.isArray(userInfo?.ligneBudgetaires)
    ? userInfo.ligneBudgetaires
    : [];

  // Initials for avatar
  const initials = `${prenom.charAt(0) || 'H'}${nom.charAt(0) || 'K'}`.toUpperCase();

  return (
    <div className="relative" ref={popoverRef}>
      {/* HEADER COMPACT SUMMARY PILL */}
      <div
        id="user-profile-badge"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#282828] border border-slate-700/80 text-xs text-slate-200 transition-all cursor-pointer select-none shadow-sm group"
        title="Cliquez pour afficher les informations de profil et budget"
      >
        {/* AVATAR WITH INITIALS */}
        <div className="relative flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-[#E60028] text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
            {initials}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#1A1A1A] ${
              ktaSession.isValid ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
            title={ktaSession.isValid ? 'Session active' : 'Session non connectée'}
          />
        </div>

        {/* USER NAME */}
        <div className="flex flex-col text-left">
          <span className="font-semibold text-white text-[11px] leading-tight group-hover:text-slate-100 flex items-center gap-1">
            {fullName}
          </span>
          <span className="text-[10px] text-slate-400 leading-tight hidden sm:inline">
            {directionName} · {departementName}
          </span>
        </div>

        {/* DIRECTION BADGE */}
        <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 text-sky-300 text-[10.5px] font-medium">
          <Building2 className="w-3 h-3 text-sky-400" />
          <span className="text-slate-400 text-[10px]">Dir:</span>
          <span className="font-semibold text-sky-200">{directionName}</span>
        </div>

        {/* DEPARTEMENT BADGE */}
        <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-medium">
          <Layers className="w-3 h-3 text-emerald-400" />
          <span className="text-slate-400 text-[10px]">Dép:</span>
          <span className="font-semibold text-emerald-200">{departementName}</span>
        </div>

        {/* EMAIL PILL */}
        <div className="hidden xl:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2A2A2A] border border-slate-700 text-slate-300 text-[10.5px]">
          <Mail className="w-3 h-3 text-slate-400" />
          <span className="truncate max-w-[150px]">{email}</span>
        </div>

        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </div>

      {/* EXPANDED PROFILE FLYOUT / POPOVER */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#202020] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-200">
          {/* POPOVER HEADER */}
          <div className="p-3.5 bg-[#181818] border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E60028] text-white font-bold text-sm flex items-center justify-center shadow-md">
                {initials}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{fullName}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>{email}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* DETAILS GRID */}
          <div className="p-3.5 space-y-3 text-xs">
            {/* DIRECTION & DEPARTEMENT ROW */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-[#272727] border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                  <Building2 className="w-3 h-3 text-sky-400" />
                  Direction
                </span>
                <span className="font-semibold text-white text-xs block">
                  {directionName}
                </span>
                {userInfo?.direction?.code && (
                  <span className="text-[10px] text-slate-400">
                    Code: {userInfo.direction.code}
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-[#272727] border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  Département
                </span>
                <span className="font-semibold text-white text-xs block">
                  {departementName}
                </span>
                {userInfo?.direction?.departement?.code && (
                  <span className="text-[10px] text-slate-400">
                    Code: {userInfo.direction.departement.code}
                  </span>
                )}
              </div>
            </div>

            {/* MATRICULE & EMAIL */}
            <div className="p-2.5 rounded-lg bg-[#272727] border border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  Matricule :
                </span>
                <span className="font-mono font-medium text-slate-200">
                  {matricule || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  Email :
                </span>
                <span className="font-medium text-slate-200 select-all">
                  {email}
                </span>
              </div>
            </div>

            {/* LIGNES BUDGETAIRES IF AVAILABLE */}
            {lignesBudgetaires.length > 0 && (
              <div className="p-2.5 rounded-lg bg-[#272727] border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1.5">
                  <CreditCard className="w-3 h-3 text-amber-400" />
                  Lignes Budgétaires ({lignesBudgetaires.length})
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {lignesBudgetaires.map((lb: any, idx: number) => (
                    <div
                      key={idx}
                      className="px-2 py-1 rounded bg-[#1f1f1f] text-[11px] text-slate-300 flex justify-between"
                    >
                      <span>{lb.libelle || lb.nom || lb.code || `Ligne #${idx + 1}`}</span>
                      {lb.montant && <span className="font-mono text-slate-400">{lb.montant}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SESSION STATUS */}
            <div className="p-2.5 rounded-lg bg-[#272727] border border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    ktaSession.isValid ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                />
                <div>
                  <span className="text-[11px] font-medium text-slate-200 block">
                    {ktaSession.isValid ? 'Statut de connexion' : 'Non connecté'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {ktaSession.isValid ? 'Authentifié' : 'Veuillez vous authentifier'}
                  </span>
                </div>
              </div>

              {ktaSession.isValid ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Connecté
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onReconnect}
                  className="px-2 py-1 rounded bg-[#E60028] hover:bg-[#c90022] text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  Connexion
                </button>
              )}
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="p-2.5 bg-[#181818] border-t border-slate-700/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 text-[10px]">
              Consultation des tickets
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="px-2 py-1 rounded bg-[#2A2A2A] hover:bg-[#333] text-slate-200 border border-slate-700 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualiser profil</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
