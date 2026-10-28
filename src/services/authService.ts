import { UserAccount, AuthSession } from '../types/queueTypes';
import { queueStore } from './queueStore';

const AUTH_STORAGE_KEY = 'agb_queue_auth_session_v1';

export const MASTER_PIN = '9999';

// 1. UNIQUE PROFIL CLIENT (Accès Libre Borne, Écran TV & App Mobile - SANS PIN)
export const CLIENT_USER: UserAccount = {
  id: 'user-client',
  username: 'client',
  name: 'Client / Visiteur',
  role: 'client',
  roleLabel: 'Profil Client (Borne, Écran TV & App Mobile)',
  pin: '', // Aucun code PIN requis : accès 100% libre pour l'expérience client
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  isClientProfile: true,
};

// 2. COMPTES EXACTS PAR PROFIL : 1 Admin + 1 par Guichet (TOUS VERROUILLÉS PAR PIN)
export const DEMO_USERS: UserAccount[] = [
  CLIENT_USER,
  {
    id: 'user-admin',
    username: 'admin',
    name: 'Karim Benali',
    role: 'admin',
    roleLabel: 'Directeur d\'Agence & RA',
    pin: '9999',
    password: 'admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedCounterName: 'Direction de l\'Agence',
  },
  {
    id: 'user-guichet-1',
    username: 'guichet1',
    name: 'Amina Benali',
    role: 'teller',
    roleLabel: 'Guichetière 01 - Caisse Rapide',
    pin: '1111',
    password: 'caisse',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assignedCounterId: 'counter-1',
    assignedCounterName: 'Guichet 01 - Caisse Rapide',
  },
  {
    id: 'user-guichet-2',
    username: 'guichet2',
    name: 'Karim Haddad',
    role: 'teller',
    roleLabel: 'Guichetier 02 - Caisse & Devises',
    pin: '2222',
    password: 'caisse',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    assignedCounterId: 'counter-2',
    assignedCounterName: 'Guichet 02 - Caisse & Devises',
  },
  {
    id: 'user-guichet-3',
    username: 'guichet3',
    name: 'Samia Mansouri',
    role: 'teller',
    roleLabel: 'Guichetière 03 - Conseillère Particuliers',
    pin: '3333',
    password: 'conseil',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    assignedCounterId: 'counter-3',
    assignedCounterName: 'Guichet 03 - Conseiller Particuliers',
  },
  {
    id: 'user-guichet-4',
    username: 'guichet4',
    name: 'Sofiane Zerrouki',
    role: 'teller',
    roleLabel: 'Guichetier 04 - Espace Entreprises & Portefeuille',
    pin: '4444',
    password: 'pro',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    assignedCounterId: 'counter-4',
    assignedCounterName: 'Guichet 04 - Espace Entreprises & Portefeuille',
  },
];

// Alias de rétrocompatibilité pour tester rapidement
export const TEST_USER = CLIENT_USER;

class AuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    const clientSession: AuthSession = {
      user: CLIENT_USER,
      token: `token-${Date.now()}`,
      loginAt: new Date().toISOString(),
    };
    this.currentSession = clientSession;
    if (typeof window === 'undefined') return;
    try {
      // Shared legacy logins must never turn a new visitor into staff.
      localStorage.removeItem(AUTH_STORAGE_KEY);
      const mode = new URLSearchParams(window.location.search).get('mode');
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if ((mode === 'admin' || mode === 'dashboard') && stored) {
        const parsed = JSON.parse(stored);
        const user = DEMO_USERS.find((candidate) => candidate.id === parsed?.user?.id);
        if (user && !user.isClientProfile) this.currentSession = {...parsed, user};
      }
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentSession));
    } catch {
      this.currentSession = clientSession;
    }
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb(this.currentSession));
  }

  public subscribe(cb: (session: AuthSession | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentSession);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentSession?.user || null;
  }

  public isAuthenticated(): boolean {
    return !!this.currentSession?.user;
  }

  public isAdmin(): boolean {
    return this.currentSession?.user?.role === 'admin';
  }

  /**
   * Indique si la session actuelle est en mode Profil Client.
   * Le profil client a un accès 100% libre à la Borne, l'Écran TV et l'App Mobile.
   * En revanche, le Poste Guichetier et le Tableau de Bord RA lui sont VERROUILLÉS par PIN.
   */
  public isClientProfile(): boolean {
    const user = this.getCurrentUser();
    if (!user) return true;
    return !!user.isClientProfile || user.role === 'client' || user.username === 'client' || user.id === 'user-client';
  }

  // Alias conservé pour compatibilité
  public isRestrictedTester(): boolean {
    return this.isClientProfile();
  }

  /**
   * Vérifie si l'accès à un mode donné est autorisé pour l'utilisateur actuellement connecté.
   * Le profil client a accès à : screen (Écran TV), kiosk (Borne), client (Portail mobile).
   * Il n'a PAS accès à : admin (Poste Guichetier ou Tableau de bord RA) sans code PIN.
   */
  public isModeAllowed(mode: 'hub' | 'screen' | 'kiosk' | 'client' | 'admin', subView?: 'counter' | 'dashboard'): boolean {
    if (mode === 'hub' || mode === 'screen' || mode === 'kiosk' || mode === 'client') {
      return true;
    }
    const user = this.getCurrentUser();
    if (!user || this.isClientProfile()) {
      // Client profile is blocked from Guichet & Admin
      return false;
    }
    if (mode === 'admin' && subView === 'dashboard') {
      return user.role === 'admin';
    }
    return true;
  }

  /**
   * Indique si un compte requiert un code PIN pour se connecter.
   * Le profil client ('client', 'visiteur') est le SEUL compte sans PIN pour accès libre.
   * TOUS les autres comptes (admin, guichet1, guichet2, guichet3, guichet4) requièrent un code PIN.
   */
  public requiresPin(user: UserAccount | null): boolean {
    if (!user) return false;
    if (user.isClientProfile || user.role === 'client' || user.username === 'client' || user.id === 'user-client') {
      return false;
    }
    return true;
  }

  /**
   * Valide le code PIN saisi. Accepte le PIN spécifique du compte ou le Master PIN '9999'.
   */
  public verifyPin(user: UserAccount, enteredPin: string): boolean {
    if (!this.requiresPin(user)) return true;
    const clean = (enteredPin || '').trim();
    if (!clean) return false;
    return clean === user.pin || clean === MASTER_PIN;
  }

  public login(
    identifier: string,
    enteredPin?: string
  ): { success: boolean; user?: UserAccount; requirePin?: boolean; error?: string } {
    const cleanId = identifier.trim().toLowerCase().replace(/^@/, '');
    if (!cleanId) {
      return { success: false, error: 'Veuillez saisir un nom d\'utilisateur.' };
    }

    // Match client / visiteur / team alias
    let user: UserAccount | undefined;
    if (['client', 'visiteur', 'borne', 'tv', 'mobile', 'team', 'test'].includes(cleanId)) {
      user = CLIENT_USER;
    } else {
      user = DEMO_USERS.find(
        (u) =>
          u.username.toLowerCase() === cleanId ||
          u.id.toLowerCase() === cleanId ||
          u.name.toLowerCase() === cleanId ||
          u.name.toLowerCase().includes(cleanId)
      );
    }

    // Fallback if not matching predefined list
    if (!user) {
      const isSuperUser = cleanId.includes('admin') || cleanId.includes('dir');
      user = {
        id: `user-${cleanId.replace(/[^a-z0-9]/gi, '_')}`,
        username: cleanId,
        name: identifier.trim().replace(/^@/, ''),
        role: isSuperUser ? 'admin' : 'teller',
        roleLabel: isSuperUser ? 'Administrateur' : 'Guichetier',
        pin: '9999',
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(identifier.trim())}&background=0055D4&color=fff`,
        assignedCounterName: isSuperUser ? 'Direction' : 'Guichet',
      };
    }

    // Check PIN requirement for protected accounts
    if (this.requiresPin(user)) {
      if (!enteredPin) {
        return {
          success: false,
          requirePin: true,
          user,
          error: `Code PIN requis pour accéder au compte @${user.username}.`,
        };
      }

      if (!this.verifyPin(user, enteredPin)) {
        return {
          success: false,
          requirePin: true,
          user,
          error: 'Code PIN incorrect. Veuillez vérifier votre code.',
        };
      }
    }

    const session: AuthSession = {
      user,
      token: `token-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      loginAt: new Date().toISOString(),
    };

    this.currentSession = session;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch (e) {}
    }

    this.notify();

    queueStore.addLog({
      level: 'success',
      category: 'auth',
      action: 'AUTH_LOGIN',
      message: `Connexion : ${user.name} (@${user.username}) - ${user.roleLabel}${user.isClientProfile ? ' [Profil Client - Libre]' : ' [Accès PIN Validé]'}`,
      actor: { id: user.id, name: user.name, username: user.username, role: user.role, roleLabel: user.roleLabel },
      counterId: user.assignedCounterId,
      counterName: user.assignedCounterName,
      details: { agencyId: user.agencyId, loginAt: session.loginAt, isClientProfile: !!user.isClientProfile },
    });

    return { success: true, user };
  }

  public quickLogin(
    userId: string,
    enteredPin?: string
  ): { success: boolean; requirePin?: boolean; user?: UserAccount; error?: string } {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Compte introuvable.' };

    return this.login(user.username, enteredPin);
  }

  public switchToClientUser(): void {
    this.login(CLIENT_USER.username);
  }

  // Alias
  public switchToTestUser(): void {
    this.switchToClientUser();
  }

  public logout(): void {
    // Revert to Client profile instead of null so client screens remain functional
    const prevUser = this.currentSession?.user;
    this.currentSession = {
      user: CLIENT_USER,
      token: `token-${Date.now()}`,
      loginAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentSession));
      } catch (e) {}
    }

    this.notify();

    if (prevUser && prevUser.id !== CLIENT_USER.id) {
      queueStore.addLog({
        level: 'info',
        category: 'auth',
        action: 'AUTH_LOGOUT',
        message: `Déconnexion de session : ${prevUser.name} (@${prevUser.username}) -> Retour au profil Client`,
        actor: { id: prevUser.id, name: prevUser.name, username: prevUser.username, role: prevUser.role, roleLabel: prevUser.roleLabel },
        counterId: prevUser.assignedCounterId,
        counterName: prevUser.assignedCounterName,
      });
    }
  }
}

export const authService = new AuthService();
