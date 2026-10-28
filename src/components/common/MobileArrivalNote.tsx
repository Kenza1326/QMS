import {QueueTicket,QueueRule} from '../../types/queueTypes';
import {mobileArrivalDecision} from '../../services/arrivalPolicy';
export function MobileArrivalNote({ticket,tickets,rules,now=Date.now()}:{ticket:QueueTicket;tickets:QueueTicket[];rules:QueueRule[];now?:number}){
 if(!['pending_presence','waiting'].includes(ticket.status))return null;
 const d=mobileArrivalDecision(ticket,tickets,rules,now);if(!d)return null;
 return <p className="mt-3 text-sm leading-relaxed text-slate-600" data-mobile-arrival-note>
 {ticket.status==='pending_presence'?'Si vous confirmez votre présence maintenant : ':''}
 {d.preserved?'rang FIFO d’émission conservé':'rang FIFO à la confirmation de présence'}.
 {' '}{d.count} client(s) entré(s) {ticket.status==='pending_presence'?'depuis l’émission':'entre l’émission et votre confirmation'} ; tolérance : {d.tolerance}{!d.enabled?' (désactivée)':''}.
 {' '}Les autres priorités restent applicables.{ticket.status==='pending_presence'?' Présence obligatoire avant tout appel.':''}
 </p>;
}

