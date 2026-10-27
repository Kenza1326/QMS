import React from 'react';
import { FolderOpen, ExternalLink } from 'lucide-react';
import { TA_CONFIG } from '../services/ktaService';

/**
 * Returns the base host address for TotalAgility.
 * Defaults to http://192.168.0.45, or extracts origin from custom TA_CONFIG.BASE_URL if configured.
 */
export function getKTAHostAddress(): string {
  // If runtime configuration specifies an explicit baseUrl (not localhost/preview)
  if (TA_CONFIG?.BASE_URL) {
    try {
      const parsed = new URL(TA_CONFIG.BASE_URL);
      if (!parsed.hostname.includes('run.app') && parsed.hostname !== 'localhost') {
        return parsed.origin;
      }
    } catch {}
  }

  // If in browser on an intranet IP or domain
  if (typeof window !== 'undefined') {
    const winCfg = (window as any).__KTA_CONFIG__;
    if (winCfg?.ktaBaseUrl) {
      try {
        return new URL(winCfg.ktaBaseUrl).origin;
      } catch {}
    }
    if (
      window.location.hostname &&
      !window.location.hostname.includes('run.app') &&
      window.location.hostname !== 'localhost'
    ) {
      return window.location.origin;
    }
  }

  // Default specified TotalAgility host address
  return 'http://192.168.0.45';
}

/**
 * Constructs the TotalAgility ViewDocument URL:
 * http://192.168.0.45/TotalAgility/Forms/ViewDocument.form?FolderID=folderid
 */
export function getKTADocumentFolderUrl(folderId: string | number): string {
  const cleanId = String(folderId || '').trim();
  const host = getKTAHostAddress();
  return `${host}/TotalAgility/Forms/ViewDocument.form?FolderID=${encodeURIComponent(cleanId)}`;
}

/**
 * Identifies if a field name corresponds to a TotalAgility FolderID field.
 */
export function isFolderIdField(key: string): boolean {
  if (!key) return false;
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized === 'iddossierfacturation' ||
    normalized === 'iddossierda' ||
    normalized === 'iddossier' ||
    normalized === 'folderid'
  );
}

/**
 * Resolves the FolderID of a ticket according to business rules:
 * - If flux is Facturation (invoice): IDDossierFacturation
 * - Else (Achat, Appro, etc.): [IDDossierDA]
 */
export function resolveTicketFolderId(ticket?: any, detail?: any): string | null {
  if (!ticket && !detail) return null;
  const flux = String(ticket?.flux || detail?.flux || ticket?.ticketType || '').toLowerCase();
  const isFacturation = flux.includes('factur') || flux === 'inv';

  let folderId: any = null;
  if (isFacturation) {
    folderId =
      ticket?.IDDossierFacturation ??
      ticket?.idDossierFacturation ??
      detail?.requestDetail?.IDDossierFacturation ??
      detail?.requestDetail?.idDossierFacturation ??
      ticket?.advancedFields?.IDDossierFacturation ??
      ticket?.metadataJson?.IDDossierFacturation ??
      detail?.IDDossierFacturation;

    // Fallback if IDDossierDA exists on invoice
    if (!folderId || String(folderId).trim() === '') {
      folderId =
        ticket?.IDDossierDA ??
        ticket?.idDossierDA ??
        detail?.requestDetail?.IDDossierDA ??
        detail?.requestDetail?.idDossierDA;
    }
  } else {
    // Else: [IDDossierDA]
    folderId =
      ticket?.IDDossierDA ??
      ticket?.idDossierDA ??
      detail?.requestDetail?.IDDossierDA ??
      detail?.requestDetail?.idDossierDA ??
      ticket?.advancedFields?.IDDossierDA ??
      ticket?.metadataJson?.IDDossierDA ??
      ticket?.IDDossier ??
      detail?.IDDossier;

    // Fallback to IDDossierFacturation if present
    if (!folderId || String(folderId).trim() === '') {
      folderId =
        ticket?.IDDossierFacturation ??
        ticket?.idDossierFacturation ??
        detail?.requestDetail?.IDDossierFacturation;
    }
  }

  // Generic fallback
  if (!folderId || String(folderId).trim() === '') {
    folderId = ticket?.FolderID ?? ticket?.folderId ?? detail?.FolderID ?? detail?.folderId;
  }

  if (!folderId) return null;
  const str = String(folderId).trim();
  if (!str || str === '—' || str === 'null' || str === 'undefined') return null;
  return str;
}

/**
 * Opens the TotalAgility document folder form in a popup window or new tab.
 */
export function openKTADocumentFolder(folderId: string | number) {
  if (!folderId) return;
  const cleanId = String(folderId).trim();
  if (!cleanId || cleanId === '—' || cleanId === 'null' || cleanId === 'undefined') return;

  const url = getKTADocumentFolderUrl(cleanId);
  const windowFeatures =
    'width=1150,height=850,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';
  const windowName = `KTADocViewer_${cleanId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const popup = window.open(url, windowName, windowFeatures);
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      popup.focus();
    }
  } catch (err) {
    console.warn('[KTA Popup] Failed to open popup, fallback to _blank', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

interface FolderDocButtonProps {
  folderId?: string | number | null;
  label?: string;
  variant?: 'table' | 'detail' | 'badge' | 'header';
  className?: string;
}

export const FolderDocButton: React.FC<FolderDocButtonProps> = ({
  folderId,
  label,
  variant = 'table',
  className = '',
}) => {
  if (!folderId || String(folderId).trim() === '' || String(folderId).trim() === '—' || String(folderId).trim() === 'null') {
    return <span className="text-slate-400 font-mono text-[11px]">—</span>;
  }

  const cleanId = String(folderId).trim();
  const url = getKTADocumentFolderUrl(cleanId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openKTADocumentFolder(cleanId);
  };

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E60028] hover:bg-[#B4001F] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer group ${className}`}
        title={`Ouvrir le dossier TotalAgility (${url})`}
      >
        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
        <span>{label || 'Ouvrir dossier'}</span>
        <ExternalLink className="w-3 h-3 opacity-80 group-hover:opacity-100 shrink-0 ml-0.5" />
      </button>
    );
  }

  if (variant === 'detail') {
    const displayLabel = label || 'Ouvrir dossier';
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-[#E60028] text-[#E60028] hover:text-white border border-rose-200 hover:border-[#E60028] text-xs font-semibold font-mono transition-all shadow-xs hover:shadow cursor-pointer group ${className}`}
        title={`Ouvrir le dossier TotalAgility (${url})`}
      >
        <FolderOpen className="w-3.5 h-3.5 text-[#E60028] group-hover:text-white shrink-0" />
        <span className="truncate">{displayLabel}</span>
        <ExternalLink className="w-3 h-3 text-[#E60028]/70 group-hover:text-white shrink-0 ml-0.5" />
      </button>
    );
  }

  // Table variant
  const displayLabel = label || 'Ouvrir dossier';
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-[#E60028] text-[#E60028] hover:text-white border border-rose-200 hover:border-[#E60028] font-mono text-[10.5px] font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer group ${className}`}
      title={`Ouvrir le dossier TotalAgility (${url})`}
    >
      <FolderOpen className="w-3 h-3 text-[#E60028] group-hover:text-white shrink-0" />
      <span className="truncate max-w-[130px] font-mono">{displayLabel}</span>
      <ExternalLink className="w-2.5 h-2.5 text-[#E60028]/70 group-hover:text-white shrink-0" />
    </button>
  );
};
