export type FluxType = 'Achat' | 'Appro' | 'Facturation' | string;

export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  dataType?: 'text' | 'date' | 'currency' | 'boolean' | 'badge' | 'number';
  defaultVisible?: boolean;
}

export interface SupplierItem {
  id?: string;
  nom: string;
  email?: string;
  telephone?: string;
  siret?: string;
  adresse?: string;
  codeFournisseur?: string;
  evaluation?: number;
}

export interface CommentItem {
  id?: string;
  author: string;
  createdAt: string;
  body: string;
  isSystem?: boolean;
  isRestricted?: boolean;
  role?: string;
}

export interface AuditEventItem {
  id?: string;
  summary: string;
  actor: string;
  eventType?: 'STATUS_CHANGE' | 'FIELD_UPDATE' | 'OTHER' | 'COMMENT' | 'VALIDATION' | 'EXPORT' | string;
  eventTime: string;
  details?: string;
  [key: string]: any;
}

export interface HistoryEventItem {
  id?: string;
  activity?: string;
  eventTime: string;
  actor: string;
  status?: string;
  activityType?: string;
  eventType?: string;
  summary?: string;
  details?: string;
  [key: string]: any;
}

export interface TicketRow {
  id: string; // TicketKey / TicketId
  ticketKey?: string;
  ticketId?: string;
  ticketType?: string;
  flux: FluxType;
  objet: string; // Summary
  summary?: string;
  description?: string;
  statut: string; // Status
  status?: string;
  statusNote?: string;
  departement?: string;
  service?: string;
  division?: string;
  projet?: string;
  demandeur?: string; // ReporterResourceId
  reporterResourceId?: string;
  agentEnCharge?: string; // AssigneeResourceId
  assigneeResourceId?: string;
  responsablesList?: string;
  jobId?: string;
  responsableAchat?: string;
  responsableCDG?: string;
  responsablePMOSIOP?: string;
  responsableValidateurMetier?: string;
  dernierIntervenant?: string;
  dateCreation?: string; // CreatedAt
  createdAt?: string;
  dateModif: string; // UpdatedAt
  updatedAt?: string;
  dateCloture?: string | null;
  metadataJson?: any;
  advancedFields?: Record<string, any>;
  AdvancedFields?: Record<string, any>;
  montant: number;
  devise: string;
  urgence?: 'Basse' | 'Normale' | 'Haute' | 'Critique';
  priorite?: 'P1' | 'P2' | 'P3' | 'P4';
  delaiRequis?: string;
  centreCouts?: string;
  compteComptable?: string;
  [key: string]: any;
}

export interface DemandeComplementItem {
  id?: string;
  demandeId?: string;
  ticketId?: string;
  requestedByResourceId?: string;
  author?: string;
  message: string;
  status: 'En attente' | 'Résolu' | 'Clôturé' | 'Traité' | string;
  createdAt: string;
  resolvedAt?: string | null;
  isDeleted?: boolean;
}

export interface TicketFullDetail {
  found: boolean;
  ticketType?: string;
  flux: FluxType;
  ticket: TicketRow;
  requestDetail?: Record<string, any>;
  fournisseurs?: SupplierItem[];
  comments?: CommentItem[];
  demandesComplement?: DemandeComplementItem[];
  audit?: AuditEventItem[];
  history?: HistoryEventItem[];
  debug?: any;
}

export interface SavedView {
  id: string | number;
  name: string;
  flux: string[];
  status: string[];
  search: string;
  columns: string[];
  colOrder?: string[];
  colWidths?: Record<string, number>;
  dateField?: string;
  dateStart?: string;
  dateEnd?: string;
  ticketKey?: string;
  reporterResourceId?: string;
  assigneeResourceId?: string;
  departement?: string;
  service?: string;
  division?: string;
  projet?: string;
  resourceRole?: string;
  resourceValue?: string;
  isDefault?: boolean;
}

export interface ViewTabState {
  id: string;
  title: string;
  savedViewId: string | number | null;
  role: string;
  flux: Set<string>; // TicketType
  status: Set<string>; // Status
  ticketKey: string; // TicketKey filter
  reporterResourceId: string; // ReporterResourceId filter
  assigneeResourceId: string; // AssigneeResourceId filter
  departement: string; // Departement filter
  service: string; // Service filter
  division: string; // Division filter
  projet: string; // Projet filter
  dateField: string; // CreatedAt or UpdatedAt
  dateStart: string;
  dateEnd: string;
  resourceRole: string;
  resourceValue: string;
  fieldFilters: Array<{ field: string; value: string }>;
  search: string; // Search across TicketKey, Summary, Description, MetadataJson
  sort: Array<{ key: string; dir: 'asc' | 'desc' }>;
  page: number;
  pageSize: number;
  colOrder: string[];
  colWidths: Record<string, number>;
  visibleCols: Set<string>;
  exportCols: Set<string>;
  selectedIds: Set<string>;
  rows: TicketRow[];
  total: number;
  loading: boolean;
  viewMode?: 'table' | 'analytics';
  noAllowedFlux?: boolean;
  noAllowedFluxReason?: string;
}

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface UserInfoBudget {
  matricule?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  direction?: {
    id?: number;
    libelle?: string;
    code?: string;
    representantDirection?: any[];
    departement?: {
      id?: number;
      libelle?: string;
      code?: string;
    };
  };
  ligneBudgetaires?: any[];
  [key: string]: any;
}
