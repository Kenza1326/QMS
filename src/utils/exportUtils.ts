import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { TicketFullDetail, TicketRow, ColumnDef } from '../types';

export function triggerConfetti() {
  try {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#E60028', '#1A1A1A', '#3B82F6', '#10B981'],
    });
  } catch {
    // Ignore if canvas-confetti is not available
  }
}

/**
 * Single Ticket Full Detail Export
 */
export function exportSingleTicketDetails(ticketDetail: TicketFullDetail) {
  const wb = XLSX.utils.book_new();
  const ticket = ticketDetail.ticket;

  // Sheet 1: General Info
  const generalData: Array<[string, any]> = [
    ['FICHE DE CONSULTATION DU TICKET', ''],
    ['', ''],
    ['N° Ticket', ticket.id],
    ['Type de Flux', ticket.flux],
    ['Statut', ticket.statut],
    ['Objet', ticket.objet],
    ['Demandeur', ticket.demandeur],
    ['Agent en Charge', ticket.agentEnCharge],
    ['Dernier Intervenant', ticket.dernierIntervenant],
    ['Département', ticket.departement],
    ['Service', ticket.service],
    ['Division', ticket.division],
    ['Projet', ticket.projet],
    ['Date Création', ticket.dateCreation ? new Date(ticket.dateCreation).toLocaleDateString('fr-FR') : '—'],
    ['Dernière Modification', ticket.dateModif ? new Date(ticket.dateModif).toLocaleDateString('fr-FR') : '—'],
    ['Date Clôture', ticket.dateCloture ? new Date(ticket.dateCloture).toLocaleDateString('fr-FR') : '—'],
    ['Montant', `${ticket.montant?.toLocaleString('fr-FR')} ${ticket.devise || 'DZD'}`],
    ['Urgence', ticket.urgence],
    ['Priorité', ticket.priorite],
    ['Centre de Coûts', ticket.centreCouts],
    ['Compte Comptable', ticket.compteComptable],
  ];

  if (ticketDetail.requestDetail && Object.keys(ticketDetail.requestDetail).length > 0) {
    generalData.push(['', '']);
    generalData.push(['DONNÉES COMPLÉMENTAIRES', '']);
    Object.entries(ticketDetail.requestDetail).forEach(([key, val]) => {
      let displayVal = val;
      if (typeof val === 'boolean') displayVal = val ? 'Vrai' : 'Faux';
      else if (val instanceof Date) displayVal = val.toLocaleDateString('fr-FR');
      else if (typeof val === 'object' && val !== null) displayVal = JSON.stringify(val);
      generalData.push([formatKeyLabel(key), displayVal ?? '—']);
    });
  }

  const wsGeneral = XLSX.utils.aoa_to_sheet(generalData);
  wsGeneral['!cols'] = [{ wch: 28 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsGeneral, 'Synthèse Ticket');

  // Sheet 2: Fournisseurs
  if (ticketDetail.fournisseurs && ticketDetail.fournisseurs.length > 0) {
    const suppliersData = ticketDetail.fournisseurs.map((f) => ({
      'Nom': f.nom,
      'Email': f.email || '—',
      'Téléphone': f.telephone || '—',
      'SIRET / NIF': f.siret || '—',
      'Code Fournisseur': f.codeFournisseur || '—',
      'Adresse': f.adresse || '—',
    }));
    const wsSuppliers = XLSX.utils.json_to_sheet(suppliersData);
    XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Fournisseurs');
  }

  // Sheet 3: Commentaires
  if (ticketDetail.comments && ticketDetail.comments.length > 0) {
    const commentsData = ticketDetail.comments.map((c) => ({
      'Auteur': c.author,
      'Date': c.createdAt ? new Date(c.createdAt).toLocaleString('fr-FR') : '—',
      'Type': c.isSystem ? 'Système' : (c.isRestricted ? 'Restreint' : 'Public'),
      'Rôle': c.role || '—',
      'Commentaire': c.body,
    }));
    const wsComments = XLSX.utils.json_to_sheet(commentsData);
    XLSX.utils.book_append_sheet(wb, wsComments, 'Commentaires');
  }

  // Sheet 4: Compléments d'information
  if (ticketDetail.demandesComplement && ticketDetail.demandesComplement.length > 0) {
    const complementData = ticketDetail.demandesComplement.map((dc) => ({
      'Réf Demande': dc.demandeId || dc.id || '—',
      'Demandé par': dc.requestedByResourceId || dc.author || '—',
      'Statut': dc.status || 'En attente',
      'Date Demande': dc.createdAt ? new Date(dc.createdAt).toLocaleString('fr-FR') : '—',
      'Date Résolution': dc.resolvedAt ? new Date(dc.resolvedAt).toLocaleString('fr-FR') : '—',
      'Message / Précisions': dc.message || '',
    }));
    const wsComplement = XLSX.utils.json_to_sheet(complementData);
    XLSX.utils.book_append_sheet(wb, wsComplement, "Compléments d'Info");
  }

  // Sheet 5: Audit
  if (ticketDetail.audit && ticketDetail.audit.length > 0) {
    const auditData = ticketDetail.audit.map((a) => ({
      'Action': a.summary,
      'Acteur': a.actor,
      'Type': a.eventType,
      'Date': a.eventTime || '—',
      'Détails': a.details || '—',
    }));
    const wsAudit = XLSX.utils.json_to_sheet(auditData);
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Journal Audit');
  }

  const filename = `Ticket-${ticket.id}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  triggerConfetti();
  return filename;
}

/**
 * Multi-ticket Table Export
 */
export function exportTableRowsToExcel(
  rows: TicketRow[],
  columns: ColumnDef[],
  exportCols: Set<string>,
  fileNamePrefix: string = 'Export-Tickets'
) {
  const activeCols = columns.filter((c) => exportCols.has(c.key));

  const data = rows.map((t) => {
    const rowObj: Record<string, any> = {};

    activeCols.forEach((c) => {
      let val = t[c.key];
      if (val === undefined || val === null) {
        val = (t as any).advancedFields?.[c.key] ??
              (t as any).AdvancedFields?.[c.key] ??
              (t as any).metadataJson?.[c.key] ??
              (t as any).MetadataJson?.[c.key];
      }

      if (val instanceof Date) {
        val = val.toLocaleDateString('fr-FR');
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        val = new Date(val).toLocaleDateString('fr-FR');
      } else if (typeof val === 'boolean' || c.dataType === 'boolean') {
        val = val ? 'Oui' : 'Non';
      } else if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      rowObj[c.label] = val ?? '—';
    });

    return rowObj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  const colWidths = activeCols.map((c) => ({
    wch: Math.max(c.label.length + 4, 14),
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

  const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const filename = `${fileNamePrefix}-${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  triggerConfetti();
  return filename;
}

function formatKeyLabel(k: string): string {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
