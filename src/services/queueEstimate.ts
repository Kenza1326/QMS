import {CounterStation, QueueCategory, QueueRule, QueueTicket, WaitEstimateBasis} from '../types/queueTypes';
import {counterEligibility, evaluateTickets} from './queuePolicy';

export interface QueueWaitEstimate {peopleAhead: number; estimatedMinutes: number | null}

export function estimateTicketWait(ticket: QueueTicket, tickets: QueueTicket[], counters: CounterStation[], categories: QueueCategory[], rules: QueueRule[], now = Date.now()): QueueWaitEstimate {
  if (!['waiting', 'pending_presence'].includes(ticket.status)) return {peopleAhead: 0, estimatedMinutes: 0};
  const candidate = ticket.status === 'pending_presence' ? {...ticket, status: 'waiting' as const, confirmedAt: new Date(now).toISOString()} : ticket;
  const inAgency = (item: QueueTicket) => !candidate.agencyId || !item.agencyId || item.agencyId === candidate.agencyId;
  const agencyTickets = tickets.filter(inAgency);
  const activeCounters = counters.filter((counter) => !['paused', 'closed'].includes(counter.status));
  // Replace an existing queue member in place: moving it to the end would
  // change FIFO order when two arrivals have the same timestamp.
  const waiting = agencyTickets.filter((item) => item.status === 'waiting').map((item) => item.id === candidate.id ? candidate : item);
  if (!waiting.some((item) => item.id === candidate.id)) waiting.push(candidate);
  const ranked = evaluateTickets(waiting, activeCounters, rules, undefined, now, agencyTickets).map((score) => score.ticket);
  const counts = new Map<string, number>();
  for (const item of waiting) counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1);
  const eligible = (item: QueueTicket, counter: CounterStation) => counterEligibility(item, counter, rules, counts.get(item.categoryId) || 0).allowed;
  const targetCounters = activeCounters.filter((counter) => eligible(candidate, counter));
  const rank = ranked.findIndex((item) => item.id === candidate.id);
  const peopleAhead = ranked.slice(0, Math.max(0, rank)).filter((item) => item.categoryId === candidate.categoryId || targetCounters.some((counter) => eligible(item, counter))).length;
  if (!targetCounters.length) return {peopleAhead, estimatedMinutes: null};

  // Durations belong to the customers occupying counters or waiting ahead.
  // The requested customer's duration is never used before their projected call.
  const duration = (item: QueueTicket) => {
    const value = categories.find((category) => category.id === item.categoryId)?.subOperations.find((operation) => operation.id === item.subOperationId)?.estimatedMinutes;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 10;
  };
  const work = activeCounters.map((counter) => {
    const busy = agencyTickets.find((item) => item.id === counter.currentTicketId && ['called', 'in_service'].includes(item.status))
      || agencyTickets.find((item) => item.counterId === counter.id && ['called', 'in_service'].includes(item.status));
    let available = 0;
    if (busy) {
      const started = Date.parse(busy.serviceStartedAt || counter.serviceStartTime || '');
      const elapsed = busy.status === 'in_service' && Number.isFinite(started) ? Math.max(0, (now - started) / 60000) : 0;
      available = Math.max(1, duration(busy) - elapsed);
    } else if (counter.status === 'calling' || counter.status === 'serving') available = 1;
    return {counter, available};
  });
  const remaining = [...ranked];
  while (remaining.length) {
    let next: {desk: typeof work[number]; index: number} | undefined;
    for (const desk of work) {
      const index = remaining.findIndex((item) => eligible(item, desk.counter));
      if (index !== -1 && (!next || desk.available < next.desk.available)) next = {desk, index};
    }
    if (!next) break;
    const [scheduled] = remaining.splice(next.index, 1);
    if (scheduled.id === candidate.id) return {peopleAhead, estimatedMinutes: Math.ceil(next.desk.available)};
    next.desk.available += duration(scheduled);
    counts.set(scheduled.categoryId, (counts.get(scheduled.categoryId) || 1) - 1);
  }
  return {peopleAhead, estimatedMinutes: null};
}

export function formatWaitEstimate(value: number | null | undefined): string {
  return value === null ? 'Indisponible' : value === undefined ? '—' : `${value} min`;
}

export function waitEstimateBasisLabel(basis?: WaitEstimateBasis): string {
  return basis === 'check_in' ? 'Présence confirmée' : basis === 'presence_projection' ? 'Projection avant présence' : basis === 'queue_entry' ? 'Entrée dans la file' : 'Historique';
}
