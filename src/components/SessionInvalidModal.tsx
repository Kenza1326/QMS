import React from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { redirectToLogin } from '../services/ktaService';

interface SessionInvalidModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const SessionInvalidModal: React.FC<SessionInvalidModalProps> = ({
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="session-invalid-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="session-invalid-modal"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* HEADER */}
        <div className="bg-[#181818] p-6 text-white text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-[#E60028] border border-rose-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">
            Session Expirée ou Invalide
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Votre session n'est plus active. Veuillez vous authentifier pour accéder à l'application.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="p-6">
          <button
            id="btn-session-reconnect"
            type="button"
            onClick={() => redirectToLogin(window.location.href)}
            className="w-full py-3 px-4 rounded-xl bg-[#E60028] hover:bg-[#B4001F] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Se Reconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
