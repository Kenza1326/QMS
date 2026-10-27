import {QueueTicket} from '../types/queueTypes';

export function getQueueTrends(tickets: QueueTicket[], now = new Date()) {
  const today = now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const todayTickets = tickets.filter((t) => new Date(t.createdAt).toDateString() === today);
  const completed = todayTickets.filter((t) => t.status === 'completed');
  const previous = tickets.filter((t) => t.status === 'completed' && new Date(t.createdAt).toDateString() === yesterday.toDateString());
  const waits = (items: QueueTicket[]) => items.filter((t) => Number.isFinite(t.waitTimeMinutes));
  const currentWaits = waits(completed), previousWaits = waits(previous);
  const mean = (items: QueueTicket[]) => items.reduce((sum,t) => sum + t.waitTimeMinutes!,0) / items.length;
  const waitDeltaMinutes = currentWaits.length && previousWaits.length ? Math.round((mean(currentWaits)-mean(previousWaits))*10)/10 : null;
  const starts = todayTickets.filter((t) => t.status !== 'pending_presence' && t.status !== 'booked').map((t) => Date.parse(t.confirmedAt || t.createdAt)).filter((time) => Number.isFinite(time) && time <= now.getTime());
  const elapsedHours = starts.length ? (now.getTime() - Math.min(...starts))/3600000 : 0;
  const velocityPerHour = elapsedHours > 0 ? Math.round(completed.length/elapsedHours*10)/10 : null;
  return {waitDeltaMinutes, velocityPerHour};
}
