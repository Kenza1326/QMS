import type {QueueState} from './queueStore';
import type {QueueSystemConfig, QueueTicket} from '../types/queueTypes';
import {DEFAULT_QUEUE_RULES} from '../config/defaultQueueRules';
import {estimateTicketWait, QueueWaitEstimate} from './queueEstimate';

export type PhoneQueueSnapshot = QueueState & {observedAt: number};

export function capturePhoneQueueState(state: QueueState, observedAt = Date.now()): PhoneQueueSnapshot {
  return {...state, observedAt,
    tickets: state.tickets.map((ticket) => ({...ticket, kycDossier: ticket.kycDossier ? {...ticket.kycDossier} : ticket.kycDossier})),
    counters: state.counters.map((counter) => ({...counter, assignedCategoryIds: [...(counter.assignedCategoryIds || [])]})),
  };
}

export function estimatePhoneTicket(ticket: QueueTicket | null, snapshot: PhoneQueueSnapshot, config: QueueSystemConfig): QueueWaitEstimate {
  if (!ticket) return {peopleAhead: 0, estimatedMinutes: 0};
  const current = snapshot.tickets.find((item) => item.id === ticket.id) || ticket;
  return estimateTicketWait({...current, agencyId: current.agencyId || config.selectedAgencyId}, snapshot.tickets, snapshot.counters, config.categories, config.rules || DEFAULT_QUEUE_RULES, snapshot.observedAt);
}

export function refreshPhoneQueueOnResume(refresh: () => Promise<void>, targetWindow: Window | null = typeof window === 'undefined' ? null : window, targetDocument: Document | null = typeof document === 'undefined' ? null : document): () => void {
  if (!targetWindow || !targetDocument) return () => {};
  let active = true, cycle = 0, pendingCycle: number | null = null;
  const invalidate = () => {cycle++;};
  const request = async () => {
    if (!active || pendingCycle === cycle || targetDocument.visibilityState === 'hidden') return;
    const requestedCycle = cycle;
    pendingCycle = requestedCycle;
    try {await refresh();} catch { /* The queue store reports connection errors. */ }
    finally {if (pendingCycle === requestedCycle) pendingCycle = null;}
  };
  for (const event of ['focus', 'pageshow', 'online']) targetWindow.addEventListener(event, request);
  const visibilityChanged = () => {
    // A request from before backgrounding must not block a fresh resume fetch.
    if (targetDocument.visibilityState === 'hidden') invalidate(); else void request();
  };
  for (const event of ['pagehide', 'offline']) targetWindow.addEventListener(event, invalidate);
  targetDocument.addEventListener('visibilitychange', visibilityChanged);
  return () => {
    active = false;
    for (const event of ['focus', 'pageshow', 'online']) targetWindow.removeEventListener(event, request);
    for (const event of ['pagehide', 'offline']) targetWindow.removeEventListener(event, invalidate);
    targetDocument.removeEventListener('visibilitychange', visibilityChanged);
  };
}
