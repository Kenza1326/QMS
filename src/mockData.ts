import { ColumnDef, FluxType, TicketRow, TicketFullDetail } from './types';

export const COMMON_COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'N° Ticket (Clé)', width: 140 },
  { key: 'flux', label: 'Type de demande', width: 135 },
  { key: 'objet', label: 'Résumé / Objet', width: 280 },
  { key: 'statut', label: 'Statut', width: 140 },
  { key: 'demandeur', label: 'Demandeur', width: 160 },
  { key: 'agentEnCharge', label: 'Assigné à', width: 160 },
  { key: 'departement', label: 'Département', width: 150 },
  { key: 'service', label: 'Service', width: 140 },
  { key: 'division', label: 'Division', width: 140 },
  { key: 'projet', label: 'Projet', width: 160 },
  { key: 'dateCreation', label: 'Date création', width: 135, dataType: 'date' },
  { key: 'dateModif', label: 'Dernière modif.', width: 135, dataType: 'date' },
  { key: 'metadataJson', label: 'Métadonnées (MetadataJson)', width: 220, dataType: 'text' },
  { key: 'jobId', label: 'N° Job KTA', width: 120 },
  { key: 'montant', label: 'Montant Total', width: 140, dataType: 'currency' },
];

export const FLUX_SPECIFIC_COLUMNS: Record<string, ColumnDef[]> = {
  Achat: [
    { key: 'prStatus', label: 'Statut PR', width: 140, dataType: 'text' },
    { key: 'fournisseurRecommande', label: 'Fournisseur recommandé', width: 180, dataType: 'text' },
    { key: 'montantDepense', label: 'Montant dépense', width: 140, dataType: 'currency' },
    { key: 'currency', label: 'Devise PR', width: 100, dataType: 'text' },
    { key: 'justification', label: 'Justification', width: 220, dataType: 'text' },
    { key: 'requiredByDate', label: 'Date besoin', width: 130, dataType: 'date' },
    { key: 'typeDepense', label: 'Type de dépense', width: 140, dataType: 'text' },
    { key: 'refContrat', label: 'Réf. contrat', width: 140, dataType: 'text' },
    { key: 'IDDossierDA', label: 'N° dossier DA', width: 140, dataType: 'text' },
    { key: 'bdcNumero', label: 'N° Bon de commande', width: 150, dataType: 'text' },
    { key: 'bdcMontant', label: 'Montant BDC', width: 130, dataType: 'currency' },
    { key: 'bdcNomFournisseur', label: 'Fournisseur (BDC)', width: 160, dataType: 'text' },
    { key: 'LigneBudgetaireLibelle', label: 'Ligne budgétaire', width: 180, dataType: 'text' },
    { key: 'MatriculeAcheteur', label: 'Matricule acheteur', width: 140, dataType: 'text' },
  ],
  Appro: [
    { key: 'prStatus', label: 'Statut Appro', width: 140, dataType: 'text' },
    { key: 'IDDossierDA', label: 'N° dossier DA', width: 140, dataType: 'text' },
    { key: 'fournisseurRecommande', label: 'Fournisseur', width: 180, dataType: 'text' },
    { key: 'bdcNumero', label: 'N° BDC', width: 150, dataType: 'text' },
    { key: 'bdcMontant', label: 'Montant BDC', width: 130, dataType: 'currency' },
    { key: 'requiredByDate', label: 'Date requise', width: 130, dataType: 'date' },
  ],
  Facturation: [
    { key: 'numeroFacture', label: 'N° Facture', width: 140, dataType: 'text' },
    { key: 'IDDossierFacturation', label: 'N° dossier Facturation', width: 160, dataType: 'text' },
    { key: 'IDDossierDA', label: 'N° dossier DA', width: 140, dataType: 'text' },
    { key: 'prestataire', label: 'Prestataire / Fournisseur', width: 180, dataType: 'text' },
    { key: 'dateFacture', label: 'Date facture', width: 130, dataType: 'date' },
    { key: 'montantHT', label: 'Montant HT', width: 130, dataType: 'currency' },
    { key: 'montantTTC', label: 'Montant TTC', width: 130, dataType: 'currency' },
    { key: 'devise', label: 'Devise', width: 90, dataType: 'text' },
    { key: 'objetFacture', label: 'Objet facture', width: 220, dataType: 'text' },
    { key: 'numBDC', label: 'N° BDC associé', width: 140, dataType: 'text' },
    { key: 'rattachementTicketDA', label: 'Ticket DA rattaché', width: 150, dataType: 'text' },
    { key: 'status', label: 'Statut Facturation', width: 140, dataType: 'text' },
    { key: 'dateReglement', label: 'Date règlement', width: 130, dataType: 'date' },
    { key: 'modeReglement', label: 'Mode règlement', width: 140, dataType: 'text' },
    { key: 'montantRegle', label: 'Montant réglé', width: 130, dataType: 'currency' },
    { key: 'LigneBudgetaireLibelle', label: 'Ligne budgétaire', width: 180, dataType: 'text' },
  ],
};

export const FLUX_DEFINITIONS = [
  {
    FluxLabel: 'Achat',
    Description: 'Demandes d’achats généraux, prestations intellectuelles, matériels informatiques et équipements',
    Statuses: [
      { Status: 'Nouveau', Order: 1 },
      { Status: 'En validation', Order: 2 },
      { Status: 'En traitement', Order: 3 },
      { Status: 'Approuvé', Order: 4 },
      { Status: 'Rejeté', Order: 5 },
      { Status: 'Clôturé', Order: 6 },
    ],
  },
  {
    FluxLabel: 'Appro',
    Description: 'Gestion des commandes fournisseurs, livraisons, réceptions de stocks et logistique',
    Statuses: [
      { Status: 'Nouveau', Order: 1 },
      { Status: 'En traitement', Order: 2 },
      { Status: 'Expédié', Order: 3 },
      { Status: 'Reçu', Order: 4 },
      { Status: 'Litige', Order: 5 },
      { Status: 'Clôturé', Order: 6 },
    ],
  },
  {
    FluxLabel: 'Facturation',
    Description: 'Rapprochement des factures fournisseurs, contrôle 3-way matching, validation BAP et paiement',
    Statuses: [
      { Status: 'Reçue', Order: 1 },
      { Status: 'En contrôle', Order: 2 },
      { Status: 'Validée', Order: 3 },
      { Status: 'Payée', Order: 4 },
      { Status: 'Litige', Order: 5 },
      { Status: 'Clôturé', Order: 6 },
    ],
  },
];

export const STATUS_STYLES: Record<string, { tone: string; bg: string; text: string; border: string }> = {
  'Nouveau': { tone: 'neutral', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'Reçue': { tone: 'neutral', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'En validation': { tone: 'warn', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'En traitement': { tone: 'warn', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  'En contrôle': { tone: 'warn', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  'Approuvé': { tone: 'ok', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Expédié': { tone: 'ok', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300' },
  'Validée': { tone: 'ok', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Payée': { tone: 'ok', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300' },
  'Reçu': { tone: 'ok', bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
  'Clôturé': { tone: 'neutral', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  'Rejeté': { tone: 'danger', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' },
  'Litige': { tone: 'danger', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
};

// Offline default dataset providing rich, realistic records when disconnected from KTA
export const INITIAL_TICKETS: TicketRow[] = [
  {
    id: 'INV-2026-00100',
    ticketKey: 'INV-2026-00100',
    ticketId: '8CEA55A9-DB0B-4A2D-B698-34D3BAD82C21',
    flux: 'Facturation',
    ticketType: 'INV',
    objet: 'Facture N° 141 - tyrdy',
    statut: 'Facture reçue',
    status: 'Facture reçue',
    demandeur: '',
    agentEnCharge: '',
    departement: 'ACHAT',
    prestataire: 'tyrdy',
    numeroFacture: '141',
    dateFacture: '2026-05-03',
    montantHT: 14242.00,
    montantTTC: 0.00,
    montant: 14242.00,
    devise: 'CHF',
    dateReceptionCourrier: '2026-05-04',
    datePrevueTransmission: '2026-05-04',
    dateCreation: '2026-05-12T17:11:46',
    createdAt: '2026-05-12T17:11:46',
    dateModif: '2026-05-12T17:11:46',
    updatedAt: '2026-05-12T17:11:46',
    IDDossierFacturation: 'INV-2026-00100',
  }
];

export function getMockTicketDetails(ticketId: string): TicketFullDetail {
  const cleanId = String(ticketId || '').toLowerCase().trim();
  const matched = INITIAL_TICKETS.find(
    (t) => t.id.toLowerCase() === cleanId || t.ticketKey?.toLowerCase() === cleanId || (t.ticketId && t.ticketId.toLowerCase() === cleanId)
  );

  const fallbackTicket: TicketRow = matched || {
    id: ticketId,
    ticketKey: ticketId,
    flux: ticketId.startsWith('INV') ? 'Facturation' : ticketId.startsWith('APP') ? 'Appro' : 'Achat',
    objet: `Consultation du ticket ${ticketId}`,
    statut: 'En cours',
    departement: '',
    service: '',
    division: '',
    projet: '',
    demandeur: '',
    agentEnCharge: '',
    dateCreation: new Date().toISOString(),
    dateModif: new Date().toISOString(),
    montant: 0,
    devise: 'EUR',
  };

  // If this is the specific invoice ticket INV-2026-00100, return its exact real details
  if (fallbackTicket.id === 'INV-2026-00100' || fallbackTicket.ticketKey === 'INV-2026-00100') {
    return {
      found: true,
      flux: 'Facturation',
      ticket: fallbackTicket,
      requestDetail: {
        InvoiceRequestId: 100,
        ticketId: '8CEA55A9-DB0B-4A2D-B698-34D3BAD82C21',
        IDDossierFacturation: 'INV-2026-00100',
        structure: 'ACHAT',
        status: 'Facture reçue',
        prestataire: 'tyrdy',
        numeroFacture: '141',
        dateFacture: '2026-05-03T00:00:00',
        montantHT: 14242.00,
        montantTTC: 0.00,
        devise: 'CHF',
        dateReceptionCourrier: '2026-05-04T00:00:00',
        datePrevueTransmission: '2026-05-04T00:00:00',
        requestedDate: '2026-05-12T17:11:46.090',
        CreatedAt: '2026-05-12T17:11:46.090',
        UpdatedAt: '2026-05-12T17:11:46.090',
        isDeviseEtrangere: false,
        deviseTaxeTDB: false,
        deviseFormulaireTdbRecu: false,
        deviseFormulaireTdbSigne: false,
        deviseDepotTDB: false,
        deviseAtfDeposee: false,
        deviseAtfRecue: false,
        reglementIsConforme: false,
        LigneBudgetaireId: 0,
        LigneBudgetaireMontantRestantAvantFacture: 0.00,
      },
      fournisseurs: [],
      comments: [],
      demandesComplement: [
        {
          demandeId: '55EE3E5C-4CD8-43D9-B17E-0F49A71107C0',
          id: '55EE3E5C-4CD8-43D9-B17E-0F49A71107C0',
          ticketId: '8CEA55A9-DB0B-4A2D-B698-34D3BAD82C21',
          requestedByResourceId: 'Khenouna Chahrazad',
          author: 'Khenouna Chahrazad',
          message: 'Ok',
          status: 'Fournisseurs à valider',
          createdAt: '2026-05-05T10:40:35.7849080',
          resolvedAt: null,
          isDeleted: false,
        },
      ],
      history: [],
    };
  }

  // Pure data from ticket without inventing unrequested data
  const reqDetail: Record<string, any> = {};
  if (fallbackTicket.numeroFacture) reqDetail['N° Facture'] = fallbackTicket.numeroFacture;
  if (fallbackTicket.prestataire) reqDetail['Prestataire'] = fallbackTicket.prestataire;
  if (fallbackTicket.montantHT !== undefined) reqDetail['Montant HT'] = fallbackTicket.montantHT;
  if (fallbackTicket.montantTTC !== undefined) reqDetail['Montant TTC'] = fallbackTicket.montantTTC;
  if (fallbackTicket.devise) reqDetail['Devise'] = fallbackTicket.devise;

  return {
    found: true,
    flux: fallbackTicket.flux,
    ticket: fallbackTicket,
    requestDetail: reqDetail,
    fournisseurs: [],
    comments: [],
    demandesComplement: [],
    history: [],
  };
}
