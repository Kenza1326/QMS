import {QueueTicket, QueueRule} from '../types/queueTypes';
export function noShowPolicy(rules:QueueRule[]) {
  const rule=rules.find((r)=>r.code==='R-09');
  const positive=(value:unknown,fallback:number,max:number)=>Number.isFinite(Number(value))&&Number(value)>0?Math.min(max,Number(value)):fallback;
  return {enabled:Boolean(rule?.enabled),timeoutSeconds:positive(rule?.parameters?.noShowTimeoutSeconds?.value,180,86400),maxRecalls:Math.floor(positive(rule?.parameters?.maxRecallsBeforeNoShow?.value,3,100))};
}
export function callTime(ticket:QueueTicket):number {return Date.parse(ticket.lastRecalledAt||ticket.calledAt||'');}
export function calledTicketsNewestFirst(tickets:QueueTicket[]):QueueTicket[] {
  return tickets.filter((t)=>Number.isFinite(callTime(t))).sort((a,b)=>callTime(b)-callTime(a)||(b.callSequence||0)-(a.callSequence||0));
}
export function isLiveCall(ticket:QueueTicket|null,now=Date.now()):boolean {
  if(!ticket||ticket.status!=='called')return false;
  const age=now-callTime(ticket);return age>=0&&age<8000;
}
