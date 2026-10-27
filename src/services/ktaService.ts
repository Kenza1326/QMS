/**
 * TotalAgility (KTA) Backend SDK Connector
 * Replicates the exact process calls, variable extraction, and JSON payload parsing
 * from the TotalAgility consultation architecture.
 */

import { UserInfoBudget } from '../types';

export interface RuntimeKtaConfig {
  ktaBaseUrl?: string;
  ktaLoginUrl?: string;
  sessionCookie?: string;
  devAllowBypass?: boolean;
}

export const TA_CONFIG = {
  // Dynamically resolve base URL:
  // 1. If explicit config provided, use it
  // 2. Otherwise auto-derive from current origin (e.g., https://sga/Totalagility or http://192.168.0.45/Totalagility)
  BASE_URL: (typeof window !== 'undefined' && window.location.origin)
    ? `${window.location.origin}/Totalagility`
    : 'http://192.168.0.45/Totalagility',
  SESSION_COOKIE: 'session_id',
  LOGIN_URL: (typeof window !== 'undefined' && window.location.origin)
    ? `${window.location.origin}/TotalAgility/Forms/ManualLogon.form`
    : 'http://192.168.0.45/TotalAgility/Forms/ManualLogon.form',
  PROCESS_NAMES: {
    FLUX_LIST: 'SYNC PROCESS SET APP',
    SAVED_VIEWS: 'GET_USER_SAVED_VIEWS',
    CREATE_SAVED_VIEW: 'CREATE_USER_SAVED_VIEW',
    DELETE_SAVED_VIEW: 'DELETE_USER_SAVED_VIEW',
    SEARCH_TICKETS: 'SEARCH_TICKETS_CONSULTATION',
    TICKET_DETAIL: 'GET_TICKET_DETAIL_CONSULTATION',
    ADD_COMMENT: 'ADD_COMMENT_TICKETS_CONSULTATION',
    USER_INFO_BUDGET: 'GET_USER_INFO_BUDGET',
    SET_DEFAULT_SAVED_VIEW: 'SET_DEFAULT_SAVED_VIEW',
  },
  DEV_ALLOW_BYPASS: false,
};

let configLoaded = false;

/**
 * Loads runtime configuration from config.json (or window.__KTA_CONFIG__)
 * Allows zero-recompile deployment across Dev, UAT, Preprod, and Prod.
 */
export async function loadRuntimeConfig(): Promise<void> {
  if (configLoaded || typeof window === 'undefined') return;
  configLoaded = true;

  try {
    // 1. Check window.__KTA_CONFIG__ global injection
    const winConfig = (window as any).__KTA_CONFIG__ as RuntimeKtaConfig | undefined;
    if (winConfig) {
      applyConfig(winConfig);
      return;
    }

    // 2. Fetch external config.json from root
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as RuntimeKtaConfig;
      applyConfig(cfg);
      console.info('[KTA] Runtime config loaded successfully:', TA_CONFIG);
    }
  } catch (err) {
    console.warn('[KTA] Could not load config.json, using auto-detected origin defaults:', err);
  }
}

function applyConfig(cfg: RuntimeKtaConfig) {
  if (cfg.ktaBaseUrl && cfg.ktaBaseUrl.trim() !== '') {
    TA_CONFIG.BASE_URL = cfg.ktaBaseUrl.trim().replace(/\/+$/, '');
  } else if (typeof window !== 'undefined' && window.location.origin) {
    TA_CONFIG.BASE_URL = `${window.location.origin}/Totalagility`;
  }

  if (cfg.ktaLoginUrl && cfg.ktaLoginUrl.trim() !== '') {
    TA_CONFIG.LOGIN_URL = cfg.ktaLoginUrl.trim();
  } else if (typeof window !== 'undefined' && window.location.origin) {
    TA_CONFIG.LOGIN_URL = `${window.location.origin}/TotalAgility/Forms/ManualLogon.form`;
  }

  if (cfg.sessionCookie) {
    TA_CONFIG.SESSION_COOKIE = cfg.sessionCookie;
  }
  if (typeof cfg.devAllowBypass === 'boolean') {
    TA_CONFIG.DEV_ALLOW_BYPASS = cfg.devAllowBypass;
  }
}

// Auto-trigger config load in browser environment
if (typeof window !== 'undefined') {
  loadRuntimeConfig();
}

// Resource ID and Name captured from ValidateSession
let CURRENT_RESOURCE_ID: string | null = null;
let CURRENT_RESOURCE_NAME: string | null = null;

export function getCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function getSessionId(): string | null {
  // 1. Try URL param (e.g. ?sessionId=... or ?session_id=...)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSession = urlParams.get('sessionId') || urlParams.get('session_id') || urlParams.get('SessionId');
    if (paramSession) return paramSession;
  }

  // 2. Try document.cookie
  const cookieSession = getCookie(TA_CONFIG.SESSION_COOKIE) || getCookie('SessionId') || getCookie('SESSION_ID');
  if (cookieSession) return cookieSession;

  // 3. Try localStorage / sessionStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('kta_session_id') || sessionStorage.getItem('kta_session_id');
    if (stored) return stored;
  }

  return null;
}

export function getCurrentUser() {
  return {
    resourceId: CURRENT_RESOURCE_ID,
    resourceName: CURRENT_RESOURCE_NAME,
  };
}

/**
 * Redirects user to TotalAgility Manual Logon Form
 */
export function redirectToLogin(returnUrl?: string) {
  if (typeof window === 'undefined') return;
  const target = returnUrl 
    ? `${TA_CONFIG.LOGIN_URL}?returnUrl=${encodeURIComponent(returnUrl)}` 
    : TA_CONFIG.LOGIN_URL;
  console.info('[KTA] Redirecting to logon form:', target);
  window.location.href = target;
}

/**
 * Calls UserService.svc/json/ValidateSession with session_id
 */
export async function checkTotalAgilitySession(): Promise<{ isValid: boolean; resourceId?: string | null; displayName?: string | null }> {
  const sessionId = getSessionId();
  if (!sessionId) {
    console.info('[KTA] No session_id found in cookies, query parameters, or storage.');
    return { isValid: false };
  }

  try {
    const res = await fetch(`${TA_CONFIG.BASE_URL}/Services/Sdk/UserService.svc/json/ValidateSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      console.warn(`[KTA] ValidateSession HTTP error: ${res.status}`);
      return { isValid: false };
    }

    const payload = await res.json();
    const session = payload && payload.d ? payload.d : payload;
    if (!session || session.IsValid !== true) {
      console.warn('[KTA] Session is not valid according to ValidateSession:', session);
      return { isValid: false };
    }

    CURRENT_RESOURCE_ID = session.ResourceId || session.Resource?.Id || null;
    CURRENT_RESOURCE_NAME = session.DisplayName || session.Resource?.Name || null;

    console.log('[KTA] Session validated successfully! User:', CURRENT_RESOURCE_NAME, 'ResourceId:', CURRENT_RESOURCE_ID);

    return {
      isValid: true,
      resourceId: CURRENT_RESOURCE_ID,
      displayName: CURRENT_RESOURCE_NAME,
    };
  } catch (err) {
    console.warn('[KTA] ValidateSession network/CORS error:', err);
    return { isValid: false };
  }
}

/**
 * Generic JobService.svc/json/CreateJobSync caller
 */
async function callCreateJobSync<T = any>(
  processName: string,
  inputVariables: Array<{ Id: string; Value: string }> = [],
  customVariablesToReturn?: Array<{ Id: string }>
): Promise<T> {
  const sessionId = getSessionId();
  if (!sessionId) throw new Error('no-session-cookie');

  // Output variables requested: exact list or default to JSONOUTPUT
  const variablesToReturn = customVariablesToReturn && customVariablesToReturn.length > 0
    ? customVariablesToReturn
    : [{ Id: 'JSONOUTPUT' }];

  const body = {
    jobInitialization: {
      InputVariables: inputVariables,
      StartDate: null,
    },
    processIdentity: { Id: '', Name: processName, Version: 0.0 },
    variablesToReturn,
    sessionId,
  };

  console.log(`[KTA] Executing Process: "${processName}" with inputs:`, inputVariables, 'variablesToReturn:', variablesToReturn);

  const res = await fetch(`${TA_CONFIG.BASE_URL}/Services/Sdk/JobService.svc/json/CreateJobSync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[KTA] CreateJobSync (${processName}) error body:`, errText);
    throw new Error(`http-${res.status}: ${errText.slice(0, 300)}`);
  }

  const payload = await res.json();
  const result = payload && payload.d ? payload.d : payload;
  const returnedVariables = result?.ReturnedVariables || result?.returnedVariables || [];
  
  // Index all returned variables by Id (if present) and by requested positional index
  const varMap: Record<string, any> = {};
  returnedVariables.forEach((v: any, idx: number) => {
    const idFromObj = (v.Id || v.id || '').trim();
    const idFromReq = (variablesToReturn[idx]?.Id || '').trim();
    const val = v.Value ?? v.value;

    if (idFromObj && val !== undefined && val !== null) {
      varMap[idFromObj] = val;
      varMap[idFromObj.toLowerCase()] = val;
    }
    if (idFromReq && val !== undefined && val !== null) {
      varMap[idFromReq] = val;
      varMap[idFromReq.toLowerCase()] = val;
    }
    // Also store by index position
    varMap[`_index_${idx}`] = val;
  });

  // Look for primary JSONOUTPUT or general output variable (variable 0)
  let raw: any = null;
  for (const key of ['JSONOUTPUT', 'JsonOutput', 'jsonOutput', 'OUTPUT', 'Output', 'RESPONSE', 'Response', 'response', 'result', 'Result']) {
    if (varMap[key.toLowerCase()] !== undefined) {
      raw = varMap[key.toLowerCase()];
      break;
    }
  }

  if (raw === null && varMap['_index_0'] !== undefined) {
    raw = varMap['_index_0'];
  }

  if (raw === null) {
    const foundVar = returnedVariables.find((v: any) => 
      (v.Value || v.value) && (v.Found ?? v.found ?? true)
    );
    if (foundVar) {
      raw = foundVar.Value ?? foundVar.value;
    }
  }

  if (raw === null && Object.keys(varMap).length === 0) {
    console.warn(`[KTA] No return variable found in process ${processName}. Response:`, result);
    throw new Error('missing-json-output-variable');
  }

  let parsed: any = null;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  } else {
    parsed = raw;
  }

  // Handle double-stringified JSON (common in WCF/KTA process string outputs)
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      // preserve parsed
    }
  }
  if (parsed && typeof parsed === 'object' && parsed.d) {
    parsed = parsed.d;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // preserve parsed
      }
    }
  }

  // If a separate HISTORY variable is returned by TotalAgility (variable 1 or Id "HISTORY"), attach it
  const separateHistory = varMap['HISTORY'] ?? varMap['history'] ?? varMap['History'] ?? varMap['historyjson'] ?? varMap['_index_1'];
  if (separateHistory !== undefined && separateHistory !== null && separateHistory !== raw) {
    let parsedHistory = separateHistory;
    if (typeof separateHistory === 'string') {
      try {
        parsedHistory = JSON.parse(separateHistory);
      } catch {
        parsedHistory = separateHistory;
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed._ktaHistory = parsedHistory;
      parsed.ktaHistory = parsedHistory;
    } else if (!parsed) {
      parsed = { _ktaHistory: parsedHistory };
    }
  }

  console.log(`[KTA] Process "${processName}" returned:`, parsed);
  return parsed;
}

/**
 * 1. Fetch Flux list (SYNC PROCESS SET APP)
 */
export async function fetchFluxList(): Promise<any[]> {
  try {
    const fluxList = await callCreateJobSync<any>(TA_CONFIG.PROCESS_NAMES.FLUX_LIST, []);
    if (!fluxList) return [];
    if (Array.isArray(fluxList)) {
      return [...fluxList].sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0));
    }
    if (typeof fluxList === 'object') {
      const candidate = fluxList.flux || fluxList.Flux || fluxList.items || fluxList.Items || [];
      if (Array.isArray(candidate)) {
        return [...candidate].sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0));
      }
      if (fluxList.reason && String(fluxList.reason).toLowerCase().includes('no allowed flux')) {
        return [];
      }
    }
    return [];
  } catch (err) {
    console.info('[KTA] fetchFluxList handled error:', err);
    return [];
  }
}

/**
 * 2. Fetch User Saved Views (GET_USER_SAVED_VIEWS)
 */
export async function fetchUserSavedViews(): Promise<any[]> {
  if (!CURRENT_RESOURCE_ID) throw new Error('no-resource-id');
  const views = await callCreateJobSync<any[]>(TA_CONFIG.PROCESS_NAMES.SAVED_VIEWS, []);
  if (!Array.isArray(views)) throw new Error('unexpected-json-output-shape');

  return views
    .slice()
    .sort((a, b) => {
      // Default view first, then display order, then alphabetically
      if (a.IsDefault && !b.IsDefault) return -1;
      if (!a.IsDefault && b.IsDefault) return 1;
      return (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0);
    })
    .map((v) => ({
      id: v.Id,
      name: v.ViewName,
      flux: v.Flux || [],
      status: v.Statuses || [],
      search: v.SearchText || '',
      columns: v.Columns || [],
      colOrder: v.Columns || [],
      isDefault: Boolean(v.IsDefault ?? v.isDefault ?? false),
    }));
}

/**
 * 3. Create User Saved View (CREATE_USER_SAVED_VIEW)
 */
export async function createSavedView(view: {
  name: string;
  flux: string[];
  status: string[];
  columns: string[];
  search: string;
  isDefault?: boolean;
}): Promise<any> {
  if (!CURRENT_RESOURCE_ID) throw new Error('no-resource-id');
  const inputVariables = [
    { Id: 'VIEWNAME', Value: view.name },
    { Id: 'FLUXJSON', Value: JSON.stringify(view.flux) },
    { Id: 'STATUSJSON', Value: JSON.stringify(view.status) },
    { Id: 'COLUMNJSON', Value: JSON.stringify(view.columns) },
    { Id: 'SEARCHTEXT', Value: view.search || '' },
    { Id: 'ISDEFAULT', Value: view.isDefault ? 'true' : 'false' },
  ];
  return callCreateJobSync(TA_CONFIG.PROCESS_NAMES.CREATE_SAVED_VIEW, inputVariables);
}

/**
 * 4. Set Default User Saved View (SET_DEFAULT_SAVED_VIEW)
 */
export async function setDefaultSavedView(viewId: string | number, isDefault: boolean = true): Promise<boolean> {
  const inputVariables = [
    { Id: 'VIEWID', Value: String(viewId) },
    { Id: 'ISDEFAULT', Value: isDefault ? 'true' : 'false' },
  ];
  const parsed = await callCreateJobSync(TA_CONFIG.PROCESS_NAMES.SET_DEFAULT_SAVED_VIEW, inputVariables);
  return Boolean(parsed?.Success ?? true);
}

/**
 * 5. Delete User Saved View (DELETE_USER_SAVED_VIEW)
 */
export async function deleteSavedView(viewId: string | number): Promise<boolean> {
  if (!CURRENT_RESOURCE_ID) throw new Error('no-resource-id');
  const inputVariables = [
    { Id: 'Id', Value: String(viewId) },
    { Id: 'ResourceId', Value: CURRENT_RESOURCE_ID },
  ];
  const parsed = await callCreateJobSync(TA_CONFIG.PROCESS_NAMES.DELETE_SAVED_VIEW, inputVariables);
  return Boolean(parsed?.Success);
}

/**
 * 5. Search Tickets (SEARCH_TICKETS_CONSULTATION / sp_SearchTickets_Consultation2)
 */
export async function fetchTickets(filtersJson: any, groupNamesCsv?: string): Promise<{
  total: number;
  page: number;
  pageSize: number;
  rows: any[];
  debug?: any;
  reason?: string;
  noAllowedFlux?: boolean;
  fromServer?: boolean;
}> {
  // 1. Resolve Level 1 Base Ticket Fields for sp_SearchTickets_Consultation2
  const ticketFields: Record<string, string> = {};
  
  const ticketKeyVal = (filtersJson.TicketKey ?? filtersJson.ticketKey ?? '').trim();
  if (ticketKeyVal) ticketFields.TicketKey = ticketKeyVal;

  const rawStatus = filtersJson.Status || filtersJson.Statuses || filtersJson.status;
  const statusList = Array.isArray(rawStatus)
    ? rawStatus.map((s: any) => String(s).trim()).filter(Boolean)
    : (rawStatus ? [String(rawStatus).trim()] : []);

  if (statusList.length === 1) {
    ticketFields.Status = statusList[0];
  }

  const reporterVal = (filtersJson.ReporterResourceId ?? filtersJson.reporterResourceId ?? filtersJson.demandeur ?? '').trim();
  if (reporterVal) ticketFields.ReporterResourceId = reporterVal;

  const assigneeVal = (filtersJson.AssigneeResourceId ?? filtersJson.assigneeResourceId ?? filtersJson.agentEnCharge ?? '').trim();
  if (assigneeVal) ticketFields.AssigneeResourceId = assigneeVal;

  const depVal = (filtersJson.Departement ?? filtersJson.departement ?? '').trim();
  if (depVal) ticketFields.Departement = depVal;

  const srvVal = (filtersJson.Service ?? filtersJson.service ?? '').trim();
  if (srvVal) ticketFields.Service = srvVal;

  const divVal = (filtersJson.Division ?? filtersJson.division ?? '').trim();
  if (divVal) ticketFields.Division = divVal;

  const prjVal = (filtersJson.Projet ?? filtersJson.projet ?? '').trim();
  if (prjVal) ticketFields.Projet = prjVal;

  // MetadataJson search handling - ONLY when explicitly specified by a field filter
  const metaVal = (filtersJson.MetadataJson ?? filtersJson.metadataJson ?? '').trim();
  if (metaVal) ticketFields.MetadataJson = metaVal;

  const dateFieldName = filtersJson.DateField || filtersJson.dateField || 'CreatedAt';
  // Note: DateStart and DateEnd are passed as top-level properties (DateStart/DateEnd) for range queries,
  // do NOT inject them as strict single-day equality in ticketFields.

  // 2. Resolve Level 2 Advanced Custom Fields for sp_SearchTickets_Consultation2
  const advancedFields: Record<string, string> = {};
  if (filtersJson.AdvancedFields && typeof filtersJson.AdvancedFields === 'object') {
    Object.entries(filtersJson.AdvancedFields).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim()) {
        advancedFields[k] = String(v).trim();
      }
    });
  }

  const rawFieldFilters = filtersJson.FieldFilters || filtersJson.fieldFilters || [];
  if (Array.isArray(rawFieldFilters)) {
    rawFieldFilters.forEach((f: any) => {
      const fieldKey = f.Field || f.field;
      const fieldVal = f.Value ?? f.value;
      if (fieldKey && fieldVal !== undefined && fieldVal !== null && String(fieldVal).trim()) {
        const valTrimmed = String(fieldVal).trim();
        const baseFieldMap: Record<string, string> = {
          ticketkey: 'TicketKey',
          id: 'TicketKey',
          status: 'Status',
          statut: 'Status',
          reporterresourceid: 'ReporterResourceId',
          demandeur: 'ReporterResourceId',
          assigneeresourceid: 'AssigneeResourceId',
          agentencharge: 'AssigneeResourceId',
          departement: 'Departement',
          department: 'Departement',
          service: 'Service',
          division: 'Division',
          projet: 'Projet',
          project: 'Projet',
          createdat: 'CreatedAt',
          datecreation: 'CreatedAt',
          updatedat: 'UpdatedAt',
          datemodif: 'UpdatedAt',
          metadatajson: 'MetadataJson',
          metadata: 'MetadataJson',
        };
        const normalizedKey = String(fieldKey).toLowerCase();
        if (baseFieldMap[normalizedKey]) {
          ticketFields[baseFieldMap[normalizedKey]] = valTrimmed;
        } else {
          advancedFields[fieldKey] = valTrimmed;
        }
      }
    });
  }

  // 3. Resolve SortBy & SortDirection for Level 1 & Level 2
  let sortBy = '';
  let sortDir = 'DESC';
  const sortList = filtersJson.Sort || filtersJson.sort || [];
  if (Array.isArray(sortList) && sortList.length > 0) {
    const primarySort = sortList[0];
    const key = primarySort.Key || primarySort.key || '';
    const colMap: Record<string, string> = {
      id: 'TicketKey',
      ticketKey: 'TicketKey',
      flux: 'TicketType',
      statut: 'Status',
      demandeur: 'ReporterResourceId',
      agentEnCharge: 'AssigneeResourceId',
      departement: 'Departement',
      service: 'Service',
      division: 'Division',
      projet: 'Projet',
      dateCreation: 'CreatedAt',
      dateModif: 'UpdatedAt',
    };
    sortBy = colMap[key] || key;
    sortDir = String(primarySort.Dir || primarySort.dir || 'DESC').toUpperCase();
  } else if (filtersJson.SortBy || filtersJson.sortBy) {
    sortBy = filtersJson.SortBy || filtersJson.sortBy;
    sortDir = String(filtersJson.SortDirection || filtersJson.sortDirection || 'DESC').toUpperCase();
  }

  // 4. Resolve Flux Array
  const fluxArray = Array.isArray(filtersJson.Flux || filtersJson.TicketType || filtersJson.flux)
    ? Array.from(filtersJson.Flux || filtersJson.TicketType || filtersJson.flux)
    : (filtersJson.Flux || filtersJson.flux) ? [String(filtersJson.Flux || filtersJson.flux)] : [];

  // 5. Complete JSON Payload for sp_SearchTickets_Consultation2
  const exactPayload = {
    Page: filtersJson.Page || filtersJson.page || 1,
    PageSize: filtersJson.PageSize || filtersJson.pageSize || 25,
    SortBy: sortBy || 'CreatedAt',
    SortDirection: sortDir === 'ASC' ? 'ASC' : 'DESC',
    Flux: fluxArray,
    TicketFields: ticketFields,
    AdvancedFields: advancedFields,
    // Backward compatibility keys
    TicketKey: ticketKeyVal,
    TicketType: fluxArray,
    Status: statusList,
    ReporterResourceId: reporterVal,
    AssigneeResourceId: assigneeVal,
    Departement: depVal,
    Service: srvVal,
    Division: divVal,
    Projet: prjVal,
    DateField: dateFieldName,
    DateStart: filtersJson.DateStart || filtersJson.dateStart || null,
    DateEnd: filtersJson.DateEnd || filtersJson.dateEnd || null,
    ResourceRole: filtersJson.ResourceRole || filtersJson.resourceRole || 'agentEnCharge',
    ResourceValue: (filtersJson.ResourceValue ?? filtersJson.resourceValue ?? '').trim(),
    FieldFilters: rawFieldFilters,
    Search: (filtersJson.Search ?? filtersJson.SearchText ?? filtersJson.search ?? '').trim(),
    SearchText: (filtersJson.SearchText ?? filtersJson.Search ?? filtersJson.search ?? '').trim(),
    Sort: sortList,
    ColumnOrder: filtersJson.ColumnOrder || filtersJson.ColOrder || filtersJson.colOrder || [],
    Role: filtersJson.Role || filtersJson.role || 'global',
  };

  const resolvedGroupNames = groupNamesCsv ?? filtersJson.GroupNamesCsv ?? filtersJson.groupNamesCsv ?? '';

  const inputVariables: Array<{ Id: string; Value: string }> = [
    { Id: 'FiltersJson', Value: JSON.stringify(exactPayload) },
  ];

  if (resolvedGroupNames) {
    inputVariables.push({ Id: 'GroupNamesCsv', Value: resolvedGroupNames });
  }

  const parsed = await callCreateJobSync(TA_CONFIG.PROCESS_NAMES.SEARCH_TICKETS, inputVariables);

  let effectiveParsed: any = parsed;
  if (typeof effectiveParsed === 'string') {
    try {
      effectiveParsed = JSON.parse(effectiveParsed);
    } catch {
      // keep raw
    }
  }
  if (effectiveParsed && typeof effectiveParsed === 'object' && effectiveParsed.d) {
    effectiveParsed = effectiveParsed.d;
    if (typeof effectiveParsed === 'string') {
      try {
        effectiveParsed = JSON.parse(effectiveParsed);
      } catch {
        // keep raw
      }
    }
  }

  let rawRows: any[] = [];
  let totalCount = 0;

  if (Array.isArray(effectiveParsed)) {
    rawRows = effectiveParsed;
    totalCount = effectiveParsed.length;
  } else if (effectiveParsed && typeof effectiveParsed === 'object') {
    let candidateRows =
      effectiveParsed.rows ??
      effectiveParsed.Rows ??
      effectiveParsed.data ??
      effectiveParsed.Data ??
      effectiveParsed.tickets ??
      effectiveParsed.Tickets ??
      effectiveParsed.items ??
      effectiveParsed.Items ??
      effectiveParsed.result ??
      effectiveParsed.Result ??
      [];

    if (typeof candidateRows === 'string') {
      try {
        candidateRows = JSON.parse(candidateRows);
      } catch {
        candidateRows = [];
      }
    }

    rawRows = Array.isArray(candidateRows) ? candidateRows : [];
    totalCount = Number(
      effectiveParsed.total ??
      effectiveParsed.Total ??
      effectiveParsed.count ??
      effectiveParsed.Count ??
      effectiveParsed.totalCount ??
      effectiveParsed.TotalCount ??
      rawRows.length
    );
  }

  const rows = rawRows.map(normalizeTicketRow);

  const rawReason =
    effectiveParsed?.reason ??
    effectiveParsed?.Reason ??
    effectiveParsed?.message ??
    effectiveParsed?.Message ??
    effectiveParsed?.error ??
    effectiveParsed?.Error;
  const reason = typeof rawReason === 'string' ? rawReason.trim() : undefined;
  const noAllowedFlux = Boolean(
    (reason && reason.toLowerCase().includes('no allowed flux')) ||
    effectiveParsed?.noAllowedFlux ||
    effectiveParsed?.noAccess ||
    effectiveParsed?.accessDenied
  );

  console.log(`[KTA] fetchTickets extracted ${rows.length} rows (total: ${totalCount}):`, {
    rawRowsCount: rawRows.length,
    totalCount,
    reason,
    noAllowedFlux,
    debug: effectiveParsed?.debug || effectiveParsed?.Debug,
  });

  return {
    total: totalCount,
    page: effectiveParsed?.page ?? effectiveParsed?.Page ?? exactPayload.Page ?? 1,
    pageSize: effectiveParsed?.pageSize ?? effectiveParsed?.PageSize ?? exactPayload.PageSize ?? 25,
    rows,
    debug: effectiveParsed?.debug || effectiveParsed?.Debug,
    reason,
    noAllowedFlux,
    fromServer: true,
  };
}

/**
 * 6. Get Ticket Detail (GET_TICKET_DETAIL_CONSULTATION)
 * The input variable of this process is TICKETKEY (not ticketid).
 */
export async function fetchTicketDetail(ticketKeyOrRow: string | any): Promise<any> {
  const cleanKey = typeof ticketKeyOrRow === 'object' && ticketKeyOrRow !== null
    ? String(ticketKeyOrRow.ticketKey || ticketKeyOrRow.TicketKey || ticketKeyOrRow.id || ticketKeyOrRow.ticketId || '').trim()
    : String(ticketKeyOrRow || '').trim();

  const inputVariables = [
    { Id: 'TICKETKEY', Value: cleanKey },
  ];
  const ticketDetailVarsToReturn = [
    { Id: 'JSONOUTPUT' },
    { Id: 'HISTORY' },
  ];

  let parsed: any;
  try {
    parsed = await callCreateJobSync(
      TA_CONFIG.PROCESS_NAMES.TICKET_DETAIL,
      inputVariables,
      ticketDetailVarsToReturn
    );
  } catch (err: any) {
    console.warn('[KTA] fetchTicketDetail failed with TICKETKEY, attempting TicketKey fallback:', err?.message);
    try {
      parsed = await callCreateJobSync(
        TA_CONFIG.PROCESS_NAMES.TICKET_DETAIL,
        [{ Id: 'TicketKey', Value: cleanKey }],
        ticketDetailVarsToReturn
      );
    } catch {
      parsed = await callCreateJobSync(
        TA_CONFIG.PROCESS_NAMES.TICKET_DETAIL,
        [{ Id: 'ticketKey', Value: cleanKey }],
        ticketDetailVarsToReturn
      );
    }
  }

  if (!parsed) return null;

  const rawTicket = parsed.ticket || parsed.Ticket || parsed;
  const normalizedTicket = normalizeTicketRow(rawTicket);

  // Preserve resolved flux from SP root level
  const rootFlux = parsed.flux || parsed.Flux || (parsed.ticketType === 'INV' ? 'Facturation' : parsed.ticketType === 'PR' ? 'Achat' : parsed.ticketType);
  if (rootFlux) {
    normalizedTicket.flux = rootFlux;
  }

  // Parse requestDetail safely if returned as stringified JSON
  let rawRequestDetail = parsed.requestDetail || parsed.RequestDetail || parsed.details || parsed.Details || {};
  if (typeof rawRequestDetail === 'string') {
    try {
      rawRequestDetail = JSON.parse(rawRequestDetail);
    } catch {
      rawRequestDetail = {};
    }
  }

  // Enrich ticket with exact real properties from requestDetail if empty on base ticket
  if (rawRequestDetail && typeof rawRequestDetail === 'object') {
    if (rawRequestDetail.structure && !normalizedTicket.departement) {
      normalizedTicket.departement = rawRequestDetail.structure;
    }
    if (rawRequestDetail.prestataire && !normalizedTicket.prestataire) {
      normalizedTicket.prestataire = rawRequestDetail.prestataire;
      normalizedTicket.fournisseurRecommande = rawRequestDetail.prestataire;
    }
    if (rawRequestDetail.numeroFacture && !normalizedTicket.numeroFacture) {
      normalizedTicket.numeroFacture = rawRequestDetail.numeroFacture;
    }
    if (rawRequestDetail.montantHT !== undefined && (!normalizedTicket.montant || normalizedTicket.montant === 0)) {
      normalizedTicket.montant = Number(rawRequestDetail.montantHT);
    }
    if (rawRequestDetail.devise && (!normalizedTicket.devise || normalizedTicket.devise === 'EUR')) {
      normalizedTicket.devise = rawRequestDetail.devise;
    }
    if ((!normalizedTicket.objet || normalizedTicket.objet === '-' || normalizedTicket.objet === '') && (rawRequestDetail.numeroFacture || rawRequestDetail.prestataire)) {
      normalizedTicket.objet = `Facture N° ${rawRequestDetail.numeroFacture || '—'} - ${rawRequestDetail.prestataire || '—'}`;
    }
  }

  // Parse comments safely if returned as stringified JSON from SQL/KTA
  let rawComments = parsed.comments || parsed.Comments || [];
  if (typeof rawComments === 'string') {
    try {
      rawComments = JSON.parse(rawComments);
    } catch {
      rawComments = [];
    }
  }

  // Parse demandes de complément d'information safely if returned as stringified JSON from SQL/KTA
  let rawDemandesComplement =
    parsed.demandesComplement ||
    parsed.DemandesComplement ||
    parsed.demandes_complement ||
    parsed.Demandes_Complement ||
    parsed.complementsInfo ||
    parsed.ComplementsInfo ||
    parsed.complements ||
    parsed.Complements ||
    [];
  if (typeof rawDemandesComplement === 'string') {
    try {
      rawDemandesComplement = JSON.parse(rawDemandesComplement);
    } catch {
      rawDemandesComplement = [];
    }
  }

  const normalizedDemandesComplement = (Array.isArray(rawDemandesComplement) ? rawDemandesComplement : []).map(
    (dc: any, index: number) => ({
      id: dc.demandeId || dc.DemandeId || dc.id || `dc-${index}`,
      demandeId: dc.demandeId || dc.DemandeId || dc.id || `dc-${index}`,
      ticketId: dc.ticketId || dc.TicketId || '',
      requestedByResourceId:
        dc.requestedByResourceId ||
        dc.RequestedByResourceId ||
        dc.author ||
        dc.Author ||
        dc.demandeur ||
        'Demandeur',
      author:
        dc.requestedByResourceId ||
        dc.RequestedByResourceId ||
        dc.author ||
        dc.Author ||
        dc.demandeur ||
        'Demandeur',
      message: dc.message || dc.Message || dc.body || dc.Body || '',
      status: dc.status || dc.Status || dc.statut || dc.Statut || 'En attente',
      createdAt: dc.createdAt || dc.CreatedAt || dc.dateCreation || '',
      resolvedAt: dc.resolvedAt || dc.ResolvedAt || dc.dateResolution || null,
      isDeleted: Boolean(dc.isDeleted || dc.IsDeleted),
    })
  );

  // Parse fournisseurs safely if returned as stringified JSON
  let rawFournisseurs = parsed.fournisseurs || parsed.Fournisseurs || parsed.suppliers || parsed.Suppliers || [];
  if (typeof rawFournisseurs === 'string') {
    try {
      rawFournisseurs = JSON.parse(rawFournisseurs);
    } catch {
      rawFournisseurs = [];
    }
  }

  // 1. Parse AUDIT LOG: found inside JSONOUTPUT (e.g. parsed.audit, parsed.auditLog, or parsed.history when containing FIELD_UPDATE objects)
  let rawAudit: any =
    parsed.auditLog ||
    parsed.AuditLog ||
    parsed.audit_log ||
    parsed.Audit_Log ||
    parsed.auditLogs ||
    parsed.AuditLogs ||
    parsed.audit ||
    parsed.Audit ||
    parsed.auditTrail ||
    parsed.AuditTrail ||
    parsed.journal ||
    parsed.Journal ||
    parsed.events ||
    parsed.Events;

  if (!rawAudit && Array.isArray(parsed.history) && parsed.history.length > 0) {
    // If parsed.history items are objects with eventType, summary, or FIELD_UPDATE, it's the audit log inside JSONOUTPUT
    const first = parsed.history[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      rawAudit = parsed.history;
    }
  }

  if (typeof rawAudit === 'string') {
    try {
      rawAudit = JSON.parse(rawAudit);
    } catch {
      rawAudit = [];
    }
  }
  if (!rawAudit) rawAudit = [];

  const normalizedAudit = (Array.isArray(rawAudit) ? rawAudit : []).map((item: any, index: number) => {
    if (item && typeof item === 'object') {
      const actor =
        item.actor ||
        item.Actor ||
        item.user ||
        item.User ||
        item.createdBy ||
        item.CreatedBy ||
        item.changedBy ||
        item.ChangedBy ||
        item.author ||
        item.Author ||
        item.resource ||
        item.Resource ||
        'Système';
      const eventType =
        item.eventType ||
        item.EventType ||
        item.type ||
        item.Type ||
        item.actionType ||
        item.ActionType ||
        'ACTION';
      const eventTime =
        item.eventTime ||
        item.EventTime ||
        item.date ||
        item.Date ||
        item.timestamp ||
        item.Timestamp ||
        item.createdAt ||
        item.CreatedAt ||
        item.time ||
        item.Time ||
        '';
      const summary =
        item.summary ||
        item.Summary ||
        item.action ||
        item.Action ||
        item.message ||
        item.Message ||
        item.description ||
        item.Description ||
        item.event ||
        item.Event ||
        item.change ||
        item.Change ||
        '';
      const details =
        item.details ||
        item.Details ||
        item.comment ||
        item.Comment ||
        item.note ||
        item.Note ||
        '';

      // Clean up escaped slashes from KTA if present (e.g. \/ -> /)
      const cleanSummary = String(summary || `${eventType} effectué`).replace(/\\\//g, '/');

      return {
        id: item.id || item.Id || `audit-${index}`,
        actor: actor ? String(actor).trim() : 'Système',
        eventType,
        eventTime,
        summary: cleanSummary,
        details: details ? String(details).replace(/\\\//g, '/') : '',
      };
    }
    return {
      id: `audit-${index}`,
      actor: 'Système',
      eventType: 'ACTION',
      eventTime: '',
      summary: String(item).replace(/\\\//g, '/'),
    };
  });

  // 2. Parse PROCESS EXECUTION HISTORY: returned in the separate HISTORY variable (2D array [["Validation", ...], ...])
  let rawHistory: any =
    parsed._ktaHistory ||
    parsed.ktaHistory ||
    parsed.processHistory ||
    parsed.ProcessHistory;

  if (!rawHistory) {
    if (Array.isArray(parsed.history) && (parsed.history.length === 0 || Array.isArray(parsed.history[0]))) {
      rawHistory = parsed.history;
    } else {
      rawHistory = parsed.jobHistory || parsed.JobHistory || [];
    }
  }

  if (typeof rawHistory === 'string') {
    try {
      rawHistory = JSON.parse(rawHistory);
    } catch {
      rawHistory = [];
    }
  }
  if (!rawHistory) rawHistory = [];

  // Normalize history entries (supports 2D array from KTA and object array from SQL)
  const normalizedHistory = (Array.isArray(rawHistory) ? rawHistory : []).map((item: any, index: number) => {
    if (Array.isArray(item)) {
      // 2D Array format: [Activity, DateTime, User/Resource, Status/Result, Type/Description]
      const activity = String(item[0] ?? '').trim();
      const eventTime = String(item[1] ?? '').trim();
      const actor = String(item[2] ?? '').trim();
      const status = String(item[3] ?? '').trim();
      const activityType = String(item[4] ?? '').trim();
      return {
        id: `hist-${index}`,
        activity: activity || 'Activité',
        eventTime: eventTime,
        actor: actor || 'TotalAgility',
        status: status || 'Exécuté',
        activityType: activityType,
        eventType: status || activity,
        summary: activity ? `${activity} (${activityType || status})` : activityType,
        details: activityType,
      };
    }
    if (item && typeof item === 'object') {
      return {
        id: item.id || `hist-${index}`,
        activity: item.activity || item.Activity || item.node || item.Node || item.eventType || item.EventType || 'Activité',
        eventTime: item.eventTime || item.EventTime || item.date || item.Date || item.dateTime || item.DateTime || '',
        actor: item.actor || item.Actor || item.user || item.User || item.resource || item.Resource || 'TotalAgility',
        status: item.status || item.Status || item.state || item.State || item.result || item.Result || 'Exécuté',
        activityType: item.activityType || item.ActivityType || item.type || item.Type || item.details || item.Details || '',
        eventType: item.eventType || item.EventType || item.status || 'ACTION',
        summary: item.summary || item.Summary || (item.activity ? `${item.activity} - ${item.status || ''}` : ''),
        details: item.details || item.Details || '',
      };
    }
    return {
      id: `hist-${index}`,
      activity: String(item),
      eventTime: '',
      actor: 'TotalAgility',
      status: 'Exécuté',
      activityType: '',
      summary: String(item),
    };
  });

  return {
    found: true,
    flux: normalizedTicket.flux || parsed.flux || parsed.Flux || 'Achat',
    ticket: normalizedTicket,
    requestDetail: rawRequestDetail,
    fournisseurs: rawFournisseurs,
    comments: Array.isArray(rawComments) ? rawComments : [],
    demandesComplement: normalizedDemandesComplement,
    audit: normalizedAudit,
    history: normalizedHistory,
    debug: parsed.debug || parsed.Debug || null,
  };
}

/**
 * 7. Add Comment to Ticket (Calls process "ADD_COMMENT_TICKETS_CONSULTATION")
 */
export async function addCommentToTicket(params: {
  ticketId: string;
  comment: string;
  author?: string;
  role?: string;
  flux?: string;
  ticketKey?: string;
}): Promise<{
  success: boolean;
  comment?: any;
  debug?: any;
}> {
  const currentUser = getCurrentUser();
  const authorName = params.author || currentUser.resourceName || 'Administrator';
  const timestamp = new Date().toISOString();
  const ticketIdValue = String(params.ticketId || params.ticketKey || '').trim();

  const commentPayload = {
    ticketId: ticketIdValue,
    comment: params.comment,
    author: authorName,
    role: params.role || 'Gestionnaire',
    flux: params.flux || '',
    timestamp: timestamp,
  };

  // EXACT initialization parameters expected by KTA process ADD_COMMENT_TICKETS_CONSULTATION:
  // ONLY AUTHOR, BODY, TICKETID without extra aliases to avoid -2147199722 error
  const inputVariables = [
    { Id: 'AUTHOR', Value: String(authorName) },
    { Id: 'BODY', Value: String(params.comment) },
    { Id: 'TICKETID', Value: String(ticketIdValue) },
  ];

  try {
    const parsed = await callCreateJobSync(TA_CONFIG.PROCESS_NAMES.ADD_COMMENT, inputVariables);
    console.log(`[KTA] Process "${TA_CONFIG.PROCESS_NAMES.ADD_COMMENT}" executed successfully:`, parsed);
    return {
      success: true,
      comment: parsed?.comment || parsed?.Comment || commentPayload,
      debug: parsed?.debug || parsed,
    };
  } catch (err: any) {
    console.warn(`[KTA] Process "${TA_CONFIG.PROCESS_NAMES.ADD_COMMENT}" call returned:`, err?.message);
    throw err;
  }
}

/**
 * Normalizes ticket row date fields and case sensitivity
 */
export function normalizeTicketRow(row: any) {
  if (!row || typeof row !== 'object') return row;
  const out: any = { ...row };

  // Primary identifier: TicketKey (e.g. INV-2026-00095, PR-2024-001) > TicketId > Id
  if (out.TicketKey) out.id = out.TicketKey;
  else if (out.ticketKey) out.id = out.ticketKey;
  else if (out.TicketId) out.id = out.TicketId;
  else if (out.ticketId) out.id = out.ticketId;
  else if (out.TICKETID) out.id = out.TICKETID;
  else if (out.Id) out.id = out.Id;
  else if (out.ID) out.id = out.ID;

  if (!out.flux && out.Flux) out.flux = out.Flux;
  if (!out.flux && out.TicketType) out.flux = out.TicketType;
  if (!out.ticketType && out.TicketType) out.ticketType = out.TicketType;
  if (!out.ticketType && out.flux) out.ticketType = out.flux;

  if (!out.objet && out.Objet) out.objet = out.Objet;
  if (!out.objet && out.Subject) out.objet = out.Subject;
  if (!out.objet && out.Summary) out.objet = out.Summary;
  if (!out.summary && out.Summary) out.summary = out.Summary;
  if (!out.summary && out.objet) out.summary = out.objet;
  if (!out.description && out.Description) out.description = out.Description;

  if (!out.statut && out.Statut) out.statut = out.Statut;
  if (!out.statut && out.Status) out.statut = out.Status;
  if (!out.status && out.Status) out.status = out.Status;
  if (!out.status && out.statut) out.status = out.statut;
  if (!out.statusNote && out.StatusNote) out.statusNote = out.StatusNote;

  if (!out.demandeur && out.Demandeur) out.demandeur = out.Demandeur;
  if (!out.demandeur && out.Creator) out.demandeur = out.Creator;
  if (!out.demandeur && out.ReporterResourceId) out.demandeur = out.ReporterResourceId;
  if (!out.reporterResourceId && out.ReporterResourceId) out.reporterResourceId = out.ReporterResourceId;
  if (!out.reporterResourceId && out.demandeur) out.reporterResourceId = out.demandeur;

  if (!out.agentEnCharge && out.AgentEnCharge) out.agentEnCharge = out.AgentEnCharge;
  if (!out.agentEnCharge && out.Assignee) out.agentEnCharge = out.Assignee;
  if (!out.agentEnCharge && out.AssigneeResourceId) out.agentEnCharge = out.AssigneeResourceId;
  if (!out.assigneeResourceId && out.AssigneeResourceId) out.assigneeResourceId = out.AssigneeResourceId;
  if (!out.assigneeResourceId && out.agentEnCharge) out.assigneeResourceId = out.agentEnCharge;

  if (!out.dernierIntervenant && out.DernierIntervenant) out.dernierIntervenant = out.DernierIntervenant;
  if (!out.departement && out.Departement) out.departement = out.Departement;
  if (!out.departement && out.Department) out.departement = out.Department;

  if (!out.service && out.Service) out.service = out.Service;
  if (!out.division && out.Division) out.division = out.Division;
  if (!out.projet && out.Projet) out.projet = out.Projet;
  if (!out.jobId && out.JobID) out.jobId = out.JobID;
  if (!out.jobId && out.JobId) out.jobId = out.JobId;

  if (!out.responsableAchat && out['Responsable achat']) out.responsableAchat = out['Responsable achat'];
  if (!out.responsableCDG && out['Responsable CDG']) out.responsableCDG = out['Responsable CDG'];
  if (!out.responsablePMOSIOP && out['Responsable PMO SIOP']) out.responsablePMOSIOP = out['Responsable PMO SIOP'];
  if (!out.responsableValidateurMetier && out['Responsable Validateur Metier']) out.responsableValidateurMetier = out['Responsable Validateur Metier'];

  if (out.montant === undefined && out.Montant !== undefined) out.montant = out.Montant;
  if (out.montant === undefined && out.Amount !== undefined) out.montant = out.Amount;
  if (out.montant === undefined) out.montant = 0;

  if (!out.devise && out.Devise) out.devise = out.Devise;
  if (!out.devise && out.Currency) out.devise = out.Currency;
  if (!out.devise) out.devise = 'EUR';

  if (!out.dateCreation && out.DateCreation) out.dateCreation = out.DateCreation;
  if (!out.dateCreation && out.CreationDate) out.dateCreation = out.CreationDate;
  if (!out.dateCreation && out.CreatedAt) out.dateCreation = out.CreatedAt;
  if (!out.createdAt && out.CreatedAt) out.createdAt = out.CreatedAt;

  if (!out.dateModif && out.DateModif) out.dateModif = out.DateModif;
  if (!out.dateModif && out.LastModifiedDate) out.dateModif = out.LastModifiedDate;
  if (!out.dateModif && out.UpdatedAt) out.dateModif = out.UpdatedAt;
  if (!out.updatedAt && out.UpdatedAt) out.updatedAt = out.UpdatedAt;

  if (!out.dateCloture && out.DateCloture) out.dateCloture = out.DateCloture;
  if (!out.dateCloture && out.ClosedDate) out.dateCloture = out.ClosedDate;

  const dateKeys = ['dateCreation', 'dateModif', 'dateCloture', 'createdAt', 'updatedAt'];
  dateKeys.forEach((k) => {
    if (out[k] && typeof out[k] === 'string') {
      try {
        const d = new Date(out[k]);
        if (!isNaN(d.getTime())) {
          out[k] = d.toISOString();
        }
      } catch (e) {
        // preserve raw
      }
    }
  });

  // Level 1 / Process MetadataJson (JSON string or object)
  let metaObj = out.MetadataJson || out.metadataJson;
  if (typeof metaObj === 'string') {
    try {
      metaObj = JSON.parse(metaObj);
    } catch {
      metaObj = null;
    }
  }
  if (metaObj && typeof metaObj === 'object') {
    out.MetadataJson = metaObj;
    out.metadataJson = metaObj;
    if (!out.objet && (metaObj.objet || metaObj.Objet || metaObj.Summary || metaObj.summary || metaObj.Description || metaObj.description)) {
      out.objet = metaObj.objet || metaObj.Objet || metaObj.Summary || metaObj.summary || metaObj.Description || metaObj.description;
    }
    Object.keys(metaObj).forEach((k) => {
      if (out[k] === undefined) {
        out[k] = metaObj[k];
      }
    });
  }

  // Level 2 Custom Columns (sp_SearchTickets_Consultation2 DetailJson / AdvancedFields)
  let advancedObj = out.AdvancedFields || out.advancedFields || out.DetailJson || out.detailJson;
  if (typeof advancedObj === 'string') {
    try {
      advancedObj = JSON.parse(advancedObj);
    } catch {
      advancedObj = null;
    }
  }
  if (advancedObj && typeof advancedObj === 'object') {
    out.AdvancedFields = advancedObj;
    out.advancedFields = advancedObj;
    // Spread custom columns into ticket row properties for direct column binding & filtering
    Object.keys(advancedObj).forEach((k) => {
      if (out[k] === undefined) {
        out[k] = advancedObj[k];
      }
    });
  }

  return out;
}

/**
 * Fetches User Info and Budget assignments from process GET_USER_INFO_BUDGET
 * with return variable "RESPONSE".
 */
export async function fetchUserInfoBudget(): Promise<UserInfoBudget | null> {
  try {
    const raw = await callCreateJobSync(
      TA_CONFIG.PROCESS_NAMES.USER_INFO_BUDGET,
      [],
      [{ Id: 'RESPONSE' }]
    );

    // raw can be { code: 0, messageClient: '', messageDetails: '', objet: { ... } } or directly { objet: { ... } }
    let obj = raw?.objet || raw?.Objet || raw;
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch {
        // keep obj as string or raw
      }
    }
    if (obj?.objet || obj?.Objet) {
      obj = obj.objet || obj.Objet;
    }

    if (obj && typeof obj === 'object') {
      // Find surname if stored as property name like "Kaddour": "" or "nom": ""
      let surname = obj.nom || obj.Nom || obj.lastName || obj.LastName || '';
      if (!surname) {
        const excludedKeys = new Set([
          'matricule',
          'prenom',
          'Prenom',
          'firstName',
          'FirstName',
          'email',
          'Email',
          'direction',
          'Direction',
          'departement',
          'Departement',
          'ligneBudgetaires',
          'LigneBudgetaires',
          'code',
          'Code',
          'messageClient',
          'messageDetails',
          'id',
          'Id',
        ]);
        for (const k of Object.keys(obj)) {
          if (!excludedKeys.has(k) && typeof obj[k] === 'string') {
            surname = k;
            break;
          }
        }
      }

      return {
        matricule: obj.matricule || obj.Matricule || '',
        nom: surname || 'Kaddour',
        prenom: obj.prenom || obj.Prenom || obj.firstName || 'Hadjer',
        email: obj.email || obj.Email || 'hkaddour@capturedoc.com',
        direction: {
          id: obj.direction?.id ?? obj.direction?.Id ?? 0,
          libelle: obj.direction?.libelle || obj.direction?.Libelle || obj.direction?.code || 'SiOP',
          code: obj.direction?.code || obj.direction?.Code || '',
          representantDirection: obj.direction?.representantDirection || [],
          departement: {
            id: obj.direction?.departement?.id ?? obj.direction?.departement?.Id ?? 0,
            libelle: obj.direction?.departement?.libelle || obj.direction?.departement?.Libelle || obj.direction?.departement?.code || 'MOA',
            code: obj.direction?.departement?.code || obj.direction?.departement?.Code || '',
          },
        },
        ligneBudgetaires: obj.ligneBudgetaires || obj.LigneBudgetaires || [],
      };
    }
  } catch (err: any) {
    console.warn('[KTA] fetchUserInfoBudget returned:', err?.message);
  }

  // Fallback to sample user if offline / local dev
  return {
    matricule: '',
    nom: 'Kaddour',
    prenom: 'Hadjer',
    email: 'hkaddour@capturedoc.com',
    direction: {
      id: 0,
      libelle: 'SiOP',
      code: '',
      representantDirection: [],
      departement: {
        id: 0,
        libelle: 'MOA',
        code: '',
      },
    },
    ligneBudgetaires: [],
  };
}
