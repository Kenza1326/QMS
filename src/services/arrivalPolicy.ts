import {QueueRule,QueueTicket} from '../types/queueTypes';
export interface MobileArrivalDecision {ruleCode:'R-13';enabled:boolean;count:number;tolerance:number;preserved:boolean;effectiveAt:string;effectiveSequence?:number}
export function isAppTicket(ticket:QueueTicket):boolean {
 if(ticket.origin)return ticket.origin==='app';
 if(ticket.appointmentTime||ticket.appointmentDate||ticket.status==='booked')return false;
 return ticket.status==='pending_presence'||ticket.initialEstimateBasis==='presence_projection'||Boolean(ticket.arrivalEstimateComputedAt)||Boolean(ticket.confirmedAt&&Date.parse(ticket.confirmedAt)>Date.parse(ticket.createdAt));
}
export function mobileArrivalDecision(ticket:QueueTicket,tickets:QueueTicket[],rules:QueueRule[],now=Date.now()):MobileArrivalDecision|null {
 if(!isAppTicket(ticket))return null;
 const rule=rules.find(r=>r.code==='R-13'),raw=Number(rule?.parameters?.peopleTolerance?.value??2);
 const tolerance=Number.isFinite(raw)?Math.max(0,Math.min(50,Math.floor(raw))):2;
 const cutoff=ticket.confirmedAt?Date.parse(ticket.confirmedAt):now;
 const count=ticket.mobileArrivalCount??tickets.filter(other=>{
  if(other.id===ticket.id||other.agencyId!==ticket.agencyId||other.categoryId!==ticket.categoryId||!other.confirmedAt||['pending_presence','booked'].includes(other.status))return false;
  const arrival=Date.parse(other.confirmedAt);
  const afterIssue=other.arrivalSequence!=null&&ticket.issuedSequence!=null?other.arrivalSequence>ticket.issuedSequence:arrival>Date.parse(ticket.createdAt);
  const beforeConfirmation=other.arrivalSequence!=null&&ticket.arrivalSequence!=null?other.arrivalSequence<ticket.arrivalSequence:arrival<=cutoff;
  return afterIssue&&beforeConfirmation;
 }).length;
 const enabled=rule?.enabled===true,preserved=enabled&&count<=tolerance;
 return {ruleCode:'R-13',enabled,count,tolerance,preserved,effectiveAt:preserved?ticket.createdAt:ticket.confirmedAt||new Date(now).toISOString(),effectiveSequence:preserved?ticket.issuedSequence:ticket.arrivalSequence};
}
export function appointmentWithinTolerance(ticket:QueueTicket,rules:QueueRule[],now:number):boolean {
 const rule=rules.find(r=>r.code==='R-03');
 if(!rule?.enabled||!ticket.confirmedAt||!/^\d{2}:\d{2}$/.test(ticket.appointmentTime||''))return false;
 const agencyDate=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
 const date=ticket.appointmentDate||agencyDate(Date.parse(ticket.confirmedAt)),slot=Date.parse(`${date}T${ticket.appointmentTime}:00+01:00`);
 const tolerance=Number(rule.parameters?.arrivalToleranceMinutes?.value??15)*60000;
 return Number.isFinite(slot)&&date===agencyDate(now)&&now>=slot-tolerance&&Date.parse(ticket.confirmedAt)<=slot+tolerance;
}
