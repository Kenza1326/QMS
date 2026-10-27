export type TicketStatus =
  | 'booked' // Planifié / rendez-vous non confirmé
  | 'pending_presence' // Ticket mobile émis à distance, en attente de confirmation de présence à la borne
  | 'waiting' // En attente dans la file active
  | 'called' // Appelé au guichet
  | 'in_service' // En cours de traitement au guichet
  | 'completed' // Traitement terminé
  | 'noshow' // Client absent
  | 'cancelled'; // Annulé par le client

export type TicketPriority = 'standard' | 'vip' | 'pmr';

export const STANDARD_APPOINTMENT_SLOTS = [
  '09:00',
  '09:30',
  '10:15',
  '11:00',
  '11:45',
  '14:00',
  '14:45',
  '15:30',
] as const;

export type AppointmentSlot = (typeof STANDARD_APPOINTMENT_SLOTS)[number];

export interface RequiredDocument {
  id: string;
  label: string;
  isMandatory: boolean;
  description?: string;
}

export interface SubOperation {
  id: string;
  code: string;
  labelFr: string;
  labelAr: string;
  estimatedMinutes: number;
  requiredDocuments: RequiredDocument[];
}

export interface QueueCategory {
  id: string;
  code: string; // e.g. 'CAISSE', 'PARTICULIERS', 'PRO', 'PORTEFEUILLE'
  ticketPrefix: string; // e.g. 'C', 'P', 'PRO', 'PF'
  labelFr: string;
  labelAr: string;
  iconName: string;
  color: string;
  subOperations: SubOperation[];
}

export interface CounterStation {
  id: string;
  number: number;
  name: string;
  agentName: string;
  assignedCategoryIds: string[];
  status: 'idle' | 'calling' | 'serving' | 'paused' | 'closed';
  currentTicketId?: string | null;
  serviceStartTime?: string | null;
  agencyId?: string;
}

export interface FeedbackSurvey {
  ticketId: string;
  ratingWaitTime: number; // 1 to 5
  ratingService: number; // 1 to 5
  ratingStaff: number; // 1 to 5
  overallSatisfaction: number; // 1 to 5
  comment?: string;
  submittedAt: string;
}

export interface QueueTicket {
  id: string;
  tokenNumber: string; // e.g. 'C-025'
  categoryId: string;
  subOperationId: string;
  subOperationName: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerName?: string;
  customerPhone?: string;
  appointmentDate?: string | null; // e.g. '2026-09-15'
  appointmentTime?: string | null; // e.g. '09:30'
  counterId?: string | null;
  counterName?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  calledAt?: string | null;
  lastRecalledAt?: string | null;
  recallCount?: number;
  callSequence?: number;
  serviceStartedAt?: string | null;
  completedAt?: string | null;
  waitTimeMinutes?: number;
  serviceDurationMinutes?: number;
  initialPeopleAhead?: number;
  initialEstimatedMinutes?: number;
  feedback?: FeedbackSurvey | null;
  kycDossier?: KycDossier | null;
  agencyId?: string;
}

export interface KycDocument {
  id: string;
  type: 'id_recto' | 'id_verso' | 'residence';
  name: string;
  previewUrl: string;
  uploadedAt: string;
  verified?: boolean;
}

export interface KycFormData {
  fullName: string;
  nin: string; // Numéro d'Identification National (18 chiffres)
  documentNumber: string; // N° Pièce CNI / Passeport
  dateOfBirth: string;
  placeOfBirth: string;
  expiryDate: string;
  address: string;
  commune: string;
  wilaya: string;
  phoneNumber: string;
  email?: string;
  occupation: string;
  monthlyIncome?: string;
}

export interface KycDossier {
  status: 'not_started' | 'in_progress' | 'completed';
  documents: {
    idRecto?: KycDocument;
    idVerso?: KycDocument;
    residence?: KycDocument;
  };
  formData: KycFormData;
  completedAt?: string;
}

/**
 * Strict check: Attente Active KYC is reserved ONLY AND ONLY for Entrée en relation (Ouverture de compte)
 */
export const isEntreeEnRelationTicket = (ticket?: {
  subOperationId?: string;
  subOperationName?: string;
  categoryId?: string;
} | null): boolean => {
  if (!ticket) return false;
  const subId = (ticket.subOperationId || '').toLowerCase();
  const subName = (ticket.subOperationName || '').toLowerCase();
  return (
    subId.includes('entree') ||
    subId.includes('relation') ||
    subId.includes('ouverture') ||
    subName.includes('entrée en relation') ||
    subName.includes('entree en relation') ||
    subName.includes('ouverture de compte')
  );
};

export interface ExchangeRate {
  currencyCode: string; // 'EUR', 'USD', 'GBP', 'CAD', 'SAR'
  currencyName: string;
  flag: string;
  buyRate: number; // DZD
  sellRate: number; // DZD
  trend: 'up' | 'down' | 'neutral';
  lastUpdated: string;
}

export interface AgencyBranch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  openingHours: string;
  hourlyAffluence: { hour: string; percentage: number; isPeak?: boolean }[];
}

export interface BrandConfig {
  id: string;
  name: string;
  arabicName: string;
  tagline: string;
  taglineAr: string;
  primaryColor: string;
  primaryHover: string;
  primaryDark: string;
  secondaryColor: string; // e.g. gold for AGB
  secondaryLight: string;
  accentColor: string;
  logoUrl?: string;
  websiteUrl: string;
  appDownloadUrl?: string;
}

export interface QueueSystemConfig {
  brand: BrandConfig;
  availableBrands: BrandConfig[];
  selectedAgencyId: string;
  agencies: AgencyBranch[];
  categories: QueueCategory[];
  counters: CounterStation[];
  exchangeRates: ExchangeRate[];
  advertisingBanners: {
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    ctaText: string;
    bgGradient: string;
  }[];
  soundSettings: {
    soundEnabled: boolean;
    speechEnabled: boolean;
    volume: number;
    speechLang: 'fr-FR' | 'ar-SA';
  };
  rules?: QueueRule[];
}

/**
 * Structured Audit Trail & Event Logging Data Model
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LogCategory = 'ticket' | 'counter' | 'kiosk' | 'admin' | 'auth' | 'system' | 'rules' | 'client';

export interface QueueLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  level: LogLevel;
  category: LogCategory;
  action: string; // e.g. 'TICKET_CREATED', 'TICKET_CALLED', 'TICKET_RECALLED', 'SERVICE_STARTED', 'TICKET_COMPLETED', 'TICKET_NOSHOW', 'TICKET_CANCELLED', 'QUEUE_RESET', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'RULE_APPLIED', 'CONFIG_UPDATED'
  message: string;
  actor: {
    id: string;
    name: string;
    username?: string;
    role: 'admin' | 'teller' | 'kiosk' | 'kiosk_operator' | 'client' | 'system';
    roleLabel?: string;
  };
  // Ticket & Operation context
  ticketNumber?: string;
  ticketId?: string;
  operationName?: string;
  categoryName?: string;
  priority?: TicketPriority;
  customerName?: string;
  customerPhone?: string;
  // Predictions & Operational Performance Metrics
  predictedWaitMinutes?: number;
  peopleAhead?: number;
  realWaitMinutes?: number;
  serviceDurationMinutes?: number;
  waitDeltaMinutes?: number; // realWaitMinutes - predictedWaitMinutes
  // Counter & Staff
  counterId?: string;
  counterName?: string;
  counterNumber?: number;
  agentName?: string;
  // Lifecycle Timestamps
  ticketCreatedAt?: string;
  ticketCalledAt?: string;
  ticketServiceStartedAt?: string;
  ticketCompletedAt?: string;
  // Raw Details & Metadata
  details?: Record<string, any>;
}

/**
 * Authentication & Staff User Account Model
 */
export type UserRole = 'admin' | 'teller' | 'kiosk_operator' | 'client';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  pin: string;
  password?: string;
  avatarUrl?: string;
  assignedCounterId?: string;
  assignedCounterName?: string;
  agencyId?: string;
  isClientProfile?: boolean; // Client-facing profile: access to Borne, Ecran TV & App Mobile; Guichet & Admin are locked
  isRestrictedTester?: boolean;
}

export interface AuthSession {
  user: UserAccount;
  token: string;
  loginAt: string;
}

/**
 * Rule Engine Data Model for Queue Prioritization & Flow Control
 */
export type RuleCategory = 'priority' | 'assignment' | 'sla' | 'lifecycle' | 'booking';

export interface RuleParameter {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select' | 'text';
  value: any;
  options?: { label: string; value: any }[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface QueueRule {
  id: string;
  code: string; // e.g. 'R-01', 'R-02'
  name: string;
  category: RuleCategory;
  description: string;
  rationale: string; // Explication métier bancaire
  enabled: boolean;
  priorityOrder: number;
  formulaDescription: string;
  parameters: Record<string, RuleParameter>;
}

export interface RuleScoreBreakdown {
  ticket: QueueTicket;
  baseWaitScore: number;
  pmrBonus: number;
  vipBonus: number;
  appointmentBonus: number;
  slaEscalationBonus: number;
  kycBonus: number;
  totalScore: number;
  appliedRules: string[];
  calculatedRank: number;
}

