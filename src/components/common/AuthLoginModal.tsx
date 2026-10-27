import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  AtSign,
  Lock,
  KeyRound,
  ArrowLeft,
  Delete,
  Check,
  Smartphone,
  Tv,
  Layers,
} from 'lucide-react';
import { authService, DEMO_USERS, CLIENT_USER } from '../../services/authService';
import { UserAccount, AuthSession } from '../../types/queueTypes';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (session: AuthSession) => void;
  targetMode?: string; // Optional context why modal opened
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  targetMode,
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(authService.getCurrentUser());
  const [usernameInput, setUsernameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PIN Entry state for protected accounts
  const [selectedUserForPin, setSelectedUserForPin] = useState<UserAccount | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');

  useEffect(() => {
    const unsub = authService.subscribe((session) => {
      setCurrentUser(session?.user || null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setSelectedUserForPin(null);
      setEnteredPin('');
      setUsernameInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectUser = (user: UserAccount) => {
    setErrorMsg(null);

    // If account requires PIN, go to PIN entry screen
    if (authService.requiresPin(user)) {
      setSelectedUserForPin(user);
      setEnteredPin('');
      return;
    }

    // Account does not require PIN (e.g. @client)
    proceedLogin(user.username, '');
  };

  const handleUsernameFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = usernameInput.trim();
    if (!clean) {
      setErrorMsg('Veuillez renseigner un nom d\'utilisateur.');
      return;
    }

    // Check if it's the client account
    const cleanLower = clean.toLowerCase().replace(/^@/, '');
    if (['client', 'visiteur', 'borne', 'tv', 'mobile', 'team', 'test'].includes(cleanLower)) {
      proceedLogin(CLIENT_USER.username, '');
      return;
    }

    // Look up user
    const matched = DEMO_USERS.find(
      (u) =>
        u.username.toLowerCase() === cleanLower ||
        u.id.toLowerCase() === cleanLower ||
        u.name.toLowerCase() === cleanLower
    );

    if (matched && authService.requiresPin(matched)) {
      setSelectedUserForPin(matched);
      setEnteredPin('');
      return;
    }

    // Attempt direct login
    const res = authService.login(clean);
    if (res.requirePin && res.user) {
      setSelectedUserForPin(res.user);
      setEnteredPin('');
    } else if (res.success && res.user) {
      finishSuccessfulLogin(res.user);
    } else {
      setErrorMsg(res.error || 'Erreur lors de la connexion.');
    }
  };

  const handlePinSubmit = (pinToSubmit?: string) => {
    const pin = pinToSubmit !== undefined ? pinToSubmit : enteredPin;
    if (!selectedUserForPin) return;

    setErrorMsg(null);
    if (!pin || pin.length < 4) {
      setErrorMsg('Veuillez saisir le code PIN à 4 chiffres.');
      return;
    }

    const res = authService.login(selectedUserForPin.username, pin);
    if (res.success && res.user) {
      finishSuccessfulLogin(res.user);
    } else {
      setErrorMsg(res.error || 'Code PIN incorrect. Veuillez vérifier votre code.');
      setEnteredPin('');
    }
  };

  const proceedLogin = (username: string, pin?: string) => {
    const res = authService.login(username, pin);
    if (res.success && res.user) {
      finishSuccessfulLogin(res.user);
    } else if (res.requirePin && res.user) {
      setSelectedUserForPin(res.user);
      setEnteredPin('');
    } else {
      setErrorMsg(res.error || 'Erreur de connexion.');
    }
  };

  const finishSuccessfulLogin = (user: UserAccount) => {
    setSuccessMsg(`Connecté avec succès : ${user.name} (@${user.username})`);
    const session = authService.getCurrentSession();
    if (session && onLoginSuccess) onLoginSuccess(session);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 600);
  };

  const handlePinDigit = (digit: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    if (nextPin.length === 4) {
      handlePinSubmit(nextPin);
    }
  };

  const handlePinDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleQuickSwitchToClient = () => {
    setErrorMsg(null);
    setSelectedUserForPin(null);
    setEnteredPin('');
    authService.switchToClientUser();
    const session = authService.getCurrentSession();
    if (session && onLoginSuccess) onLoginSuccess(session);
    setSuccessMsg('Session Profil Client activée (accès libre sans PIN).');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-150">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {selectedUserForPin ? <KeyRound className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {selectedUserForPin ? 'Saisie du Code PIN' : 'Authentification & Profils'}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedUserForPin
                  ? `Compte protégé @${selectedUserForPin.username}`
                  : 'Profil Client libre • Admin & Guichets verrouillés par PIN'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TARGET MODE BANNER (IF OPENED FROM RESTRICTED CLICK) */}
        {targetMode && !selectedUserForPin && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              L'accès à <strong>{targetMode}</strong> est protégé. Saisissez le code PIN d'un guichetier ou de l'administrateur.
            </span>
          </div>
        )}

        {/* FEEDBACK NOTIFICATIONS */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW 1: PIN ENTRY KEYPAD FOR PROTECTED USER */}
        {selectedUserForPin ? (
          <div className="mt-4 space-y-4">
            {/* Target Account Badge */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={selectedUserForPin.avatarUrl}
                  alt={selectedUserForPin.name}
                  className="w-10 h-10 rounded-full object-cover border border-white shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{selectedUserForPin.name}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      @{selectedUserForPin.username}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">{selectedUserForPin.roleLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                <Lock className="w-3.5 h-3.5" />
                <span>Code PIN Requis</span>
              </div>
            </div>

            {/* PIN Dots Display */}
            <div className="flex flex-col items-center py-2">
              <span className="text-xs font-bold text-slate-600 mb-3">
                Entrez le code PIN (4 chiffres) :
              </span>
              <div className="flex items-center gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = enteredPin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-11 h-12 rounded-xl flex items-center justify-center text-lg font-mono font-black border-2 transition-all ${
                        filled
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 scale-105 shadow-xs'
                          : 'border-slate-300 bg-slate-50 text-slate-400'
                      }`}
                    >
                      {filled ? '●' : ''}
                    </div>
                  );
                })}
              </div>

              {/* Native keyboard hidden input */}
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={enteredPin}
                onChange={(e) => {
                  const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setEnteredPin(clean);
                  if (clean.length === 4) {
                    handlePinSubmit(clean);
                  }
                }}
                className="opacity-0 w-1 h-1 pointer-events-none absolute"
              />
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="h-12 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-800 font-mono font-black text-lg transition-all active:scale-95 cursor-pointer border border-slate-200 shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinDelete}
                className="h-12 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer border border-slate-200"
                title="Effacer le dernier chiffre"
              >
                <Delete className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className="h-12 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-800 font-mono font-black text-lg transition-all active:scale-95 cursor-pointer border border-slate-200 shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handlePinSubmit()}
                className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20"
                title="Valider"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>

            {/* Footer Navigation */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedUserForPin(null);
                  setEnteredPin('');
                  setErrorMsg(null);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Changer de profil</span>
              </button>

              <button
                type="button"
                onClick={handleQuickSwitchToClient}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Revenir au Profil Client (Sans PIN)</span>
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: ACCOUNT SELECTION & TEST USER */
          <div className="mt-4 space-y-4">
            {/* CURRENT USER STATUS BADGE */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-xs bg-slate-200 shrink-0">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-full h-full p-2 text-slate-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {currentUser ? currentUser.name : 'Profil Client'}
                    </span>
                    {currentUser?.username && (
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                        @{currentUser.username}
                      </span>
                    )}
                    {currentUser?.isClientProfile || currentUser?.role === 'client' ? (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                        Libre sans PIN
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                        {currentUser?.role === 'admin' ? 'Direction' : 'Guichetier'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {currentUser ? currentUser.roleLabel : 'Borne, Écran TV & App Mobile libres'}
                  </p>
                </div>
              </div>

              {currentUser && currentUser.username !== 'client' && (
                <button
                  onClick={handleQuickSwitchToClient}
                  className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 border border-slate-200"
                  title="Revenir au profil client libre"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Mode Client</span>
                </button>
              )}
            </div>

            {/* UNLOCKED CLIENT PROFILE CARD (BORNE, ECRAN GEANT & APP MOBILE) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-2 border-blue-300 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900">Profil Client & Visiteur</h4>
                      <span className="text-[10px] font-mono font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                        @client
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Accès Libre
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Accès <strong>sans code PIN</strong> à l'<strong>Écran Géant</strong>, la <strong>Borne Tactile</strong> et l'<strong>App Mobile</strong>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickSwitchToClient}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Activer</span>
                </button>
              </div>
            </div>

            {/* DIRECT USERNAME INPUT */}
            <form onSubmit={handleUsernameFormSubmit} className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Ou connectez-vous avec un profil sécurisé :
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Ex: admin, guichet1, guichet2, guichet3, guichet4..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <span>Continuer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* LOCKED PROFILES (ADMIN & ONE FOR EACH GUICHET) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Profils Verrouillés (Code PIN requis) :
                </span>
                <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> PIN Requis
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {DEMO_USERS.filter((u) => !u.isClientProfile).map((user) => {
                  const isActive = currentUser?.id === user.id;
                  const isAdmin = user.role === 'admin';
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-600/20'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-white shadow-2xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">{user.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="font-mono text-indigo-600 font-bold">@{user.username}</span>
                            <span>•</span>
                            <span className="truncate">{isAdmin ? 'Direction / RA' : user.assignedCounterName?.split('-')[0] || user.role}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0 ml-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>PIN</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
