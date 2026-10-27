import {STANDARD_APPOINTMENT_SLOTS} from '../types/queueTypes';
export const CUSTOMER_NAME_MAX_LENGTH = 80;

export function normalizeCustomerName(value: unknown, fallback = ''): string {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return Array.from(name || fallback).slice(0, CUSTOMER_NAME_MAX_LENGTH).join('');
}

export function feedbackRatingError(ratings: number[]): string | null {
  return ratings.length === 3 && ratings.every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)
    ? null
    : 'Veuillez choisir une note de 1 à 5 pour chacun des trois critères avant d’envoyer votre avis.';
}

export function bookingError(date: string, time: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return 'Date ou créneau invalide.';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || !(STANDARD_APPOINTMENT_SLOTS as readonly string[]).includes(time)) return 'Date ou créneau invalide.';
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get = (type:string) => parts.find((part) => part.type === type)!.value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  return date < today || (date === today && time < `${get('hour')}:${get('minute')}`) ? 'Veuillez choisir un créneau à venir.' : null;
}

export function kioskPresenceToken(code: string, agencyId: string, allowedOrigins: string[]): string {
  let url: URL;
  try { url = new URL(code); } catch { throw new Error('Scannez le QR de présence de la borne de cette agence.'); }
  const proof = url.searchParams.get('proof');
  if (!allowedOrigins.includes(url.origin) || url.searchParams.get('action') !== 'confirm-presence' || url.searchParams.get('agency') !== agencyId || url.searchParams.get('kiosk') !== agencyId || !proof || proof.length < 16) throw new Error('Ce QR ne correspond pas à la borne de cette agence.');
  return proof;
}

export function matchesClientTicket(ticket: {id:string;tokenNumber:string;createdAt:string}, token:string, id?:string|null, createdAt?:string|null):boolean {
  if (ticket.tokenNumber.toUpperCase()!==token.toUpperCase()) return false;
  if (id) return ticket.id===id;
  return Boolean(createdAt && Number.isFinite(Date.parse(createdAt)) && Date.parse(ticket.createdAt)===Date.parse(createdAt));
}
