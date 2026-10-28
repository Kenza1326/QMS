import {mobileArrivalDecision} from '../src/services/arrivalPolicy';
import {estimateTicketWait,formatWaitEstimate} from '../src/services/queueEstimate';
import {noShowPolicy,callTime} from '../src/services/callLifecycle';
import {describeQueueRules} from '../src/config/ruleDescriptions';
import {DEFAULT_QUEUE_CONFIG} from '../src/config/defaultQueueConfig';
import {QueueTicket, CounterStation, QueueLogEntry, QueueRule} from '../src/types/queueTypes';
import {evaluateTickets} from '../src/services/queuePolicy';
import {normalizeCustomerName, feedbackRatingError, bookingError} from '../src/utils/queueValidation';

type State = {rules?:QueueRule[]; noShowRule?:QueueRule; tickets: QueueTicket[]; counters: CounterStation[]; logs: QueueLogEntry[]; revision: number; resetAt: number; presenceToken: string; commands: Record<string,{ticketId?:string; changed?:boolean}>};
type Options = {read:()=>string|null; write:(value:string)=>void; now?:()=>number; id:()=>string};
class CommandError extends Error {constructor(public status:number,message:string){super(message)}}
const copy = <T>(value:T):T => JSON.parse(JSON.stringify(value));
const terminal = (ticket:QueueTicket) => ['completed','cancelled','noshow'].includes(ticket.status);
const idle = (counter:CounterStation):CounterStation => ({...counter,status:'idle',currentTicketId:null,serviceStartTime:null});
const publicState = (state:State) => ({tickets:state.tickets,counters:state.counters,logs:state.logs,rules:state.rules||describeQueueRules(DEFAULT_QUEUE_CONFIG.rules.map((rule)=>rule.code==='R-09'&&state.noShowRule?state.noShowRule:rule)),revision:state.revision,resetAt:state.resetAt,version:String(state.revision)});

export function createQueueApi(options:Options) {
  const now = options.now || Date.now;
  let agencies:Record<string,State> = Object.create(null), loadError = false;
  const blank = ():State => ({tickets:[],counters:DEFAULT_QUEUE_CONFIG.counters.map(idle),logs:[],revision:0,resetAt:0,presenceToken:'',commands:{}});
  try {
    const raw = options.read();
    if (raw) {
      const parsed=JSON.parse(raw), saved=parsed.agencies || {'ag-alger-centre':parsed};
      for (const [agency,value] of Object.entries(saved)) {
        const item=value as any, state={...blank(),...item,revision:Number(item.revision)||0,commands:item.commands||{}};
        if(state.rules)state.rules=describeQueueRules(state.rules);
        state.tickets=(item.tickets||[]).filter((t:any)=>!t.id?.startsWith('tkt-demo-')).map((t:any)=>({...t,agencyId:t.agencyId||agency,customerName:normalizeCustomerName(t.customerName)}));
        state.counters=(item.counters?.length?item.counters:state.counters).map((c:CounterStation)=>({...c}));
        for(const counter of state.counters){
          const active=state.tickets.filter((t:QueueTicket)=>t.counterId===counter.id&&['called','in_service'].includes(t.status)).sort((a:QueueTicket,b:QueueTicket)=>Number(b.status==='in_service')-Number(a.status==='in_service')||callTime(b)-callTime(a));
          const ticket=active[0];counter.currentTicketId=ticket?.id||null;counter.serviceStartTime=ticket?.serviceStartedAt||null;
          counter.status=ticket?(ticket.status==='in_service'?'serving':'calling'):(counter.status==='closed'||counter.status==='paused'?counter.status:'idle');
        }
        agencies[agency]=state;
      }
    }
  } catch {loadError=true;}
  function event(state:State,request:any,action:string,ticket?:QueueTicket,counter?:CounterStation,details?:any){
    const stamp=new Date(now()).toISOString(), actor=request.actor||{id:'system',name:'Système Agence',role:'system'};
    const hasArrival = Boolean(ticket?.arrivalEstimateComputedAt);
    const prediction = hasArrival ? ticket?.arrivalEstimatedMinutes : ticket?.initialEstimatedMinutes;
    const peopleAhead = hasArrival ? ticket?.arrivalPeopleAhead : ticket?.initialPeopleAhead;
    const estimateComputedAt = hasArrival ? ticket?.arrivalEstimateComputedAt : ticket?.initialEstimateComputedAt;
    const estimateBasis = hasArrival ? 'check_in' as const : ticket?.initialEstimateBasis;
    const entry:QueueLogEntry={id:options.id(),timestamp:stamp,level:action==='QUEUE_RESET'||action==='LOGS_CLEARED'?'warn':'info',category:counter?'counter':ticket?'ticket':'system',action,
      message:({TICKET_CREATED:'Ticket émis',APPOINTMENT_BOOKED:'Rendez-vous réservé',TICKET_CALLED:'Ticket appelé',SERVICE_STARTED:'Prise en charge',TICKET_COMPLETED:'Ticket clôturé',TICKET_CANCELLED:'Ticket annulé',TICKET_NOSHOW:'Client absent',ARRIVAL_CONFIRMED:'Présence confirmée',FEEDBACK_SUBMITTED:'Avis enregistré',TICKET_RECALLED:'Ticket rappelé',QUEUE_RESET:'File réinitialisée',LOGS_CLEARED:'Journal vidé',KYC_DOSSIER_UPDATED:'Dossier KYC enregistré',RULES_UPDATED:'Règles opérationnelles enregistrées'} as any)[action]+(ticket?` : ${ticket.tokenNumber} — ${ticket.subOperationName} (${ticket.customerName || 'Visiteur'})`:''),
      actor:{...actor,name:normalizeCustomerName(actor.name,'Système')},ticketId:ticket?.id,ticketNumber:ticket?.tokenNumber,customerName:ticket?.customerName,customerPhone:ticket?.customerPhone,priority:ticket?.priority,operationName:ticket?.subOperationName,
      counterId:counter?.id,counterName:counter?.name,counterNumber:counter?.number,agentName:counter?.agentName,
      predictedWaitMinutes:prediction,peopleAhead,estimateComputedAt,estimateBasis,realWaitMinutes:ticket?.waitTimeMinutes,serviceDurationMinutes:ticket?.serviceDurationMinutes,
      ticketCreatedAt:ticket?.createdAt,ticketCalledAt:ticket?.calledAt||undefined,ticketServiceStartedAt:ticket?.serviceStartedAt||undefined,ticketCompletedAt:ticket?.completedAt||undefined,details:estimateComputedAt?{...details,...(ticket?.mobileArrivalDecision?{mobileArrival:ticket.mobileArrivalDecision}:{}),waitEstimate:{estimatedMinutes:prediction,peopleAhead,computedAt:estimateComputedAt,basis:estimateBasis,method:'counter-workload-v1'}}:details};
    if(ticket?.mobileArrivalDecision&&['ARRIVAL_CONFIRMED','TICKET_CALLED'].includes(action)){const d=ticket.mobileArrivalDecision;entry.message+=` | R-13 : ${d.count}/${d.tolerance} clients ; ${d.preserved?'rang d’émission conservé':'rang de confirmation'}`;}
    if(details?.automatic)entry.message+=` (R-09 : délai de ${details.timeoutSeconds} s expiré)`;
    if (estimateComputedAt && ['TICKET_CREATED','ARRIVAL_CONFIRMED'].includes(action)) entry.message += ` | Attente estimée : ${formatWaitEstimate(prediction)} ; ${peopleAhead} personne(s) devant`;
    if(ticket?.waitTimeMinutes!==undefined&&typeof prediction==='number')entry.waitDeltaMinutes=ticket.waitTimeMinutes-prediction;
    state.logs=[entry,...state.logs].slice(0,500);
  }
  function sweepAgency(agency:string):void {
    const current=Object.prototype.hasOwnProperty.call(agencies,agency)?agencies[agency]:null;if(!current)return;
    const policy=noShowPolicy(current.rules||[current.noShowRule||DEFAULT_QUEUE_CONFIG.rules.find((r)=>r.code==='R-09')!]);
    if(!policy.enabled)return;
    const expired=current.tickets.filter((t)=>t.status==='called'&&!t.serviceStartedAt&&Number.isFinite(callTime(t))&&now()-callTime(t)>=policy.timeoutSeconds*1000);
    if(!expired.length)return;
    const draft=copy(current);
    for(const old of expired){
      const ticket=draft.tickets.find((t)=>t.id===old.id)!;
      ticket.status='noshow';ticket.completedAt=new Date(callTime(ticket)+policy.timeoutSeconds*1000).toISOString();ticket.serviceDurationMinutes=0;
      const counter=draft.counters.find((c)=>c.id===ticket.counterId);
      if(counter?.currentTicketId===ticket.id)Object.assign(counter,idle(counter));
      event(draft,{actor:{id:'queue-timer',name:'Expiration automatique',role:'system',roleLabel:'Règle R-09'}},'TICKET_NOSHOW',ticket,counter,{automatic:true,ruleCode:'R-09',timeoutSeconds:policy.timeoutSeconds,lastCallAt:new Date(callTime(ticket)).toISOString()});
    }
    draft.revision=current.revision+1;
    const all={...agencies,[agency]:draft};
    options.write(JSON.stringify({schema:2,agencies:all},null,2));agencies=all;
  }
  function sweep():boolean {
    if(loadError)return false;
    let saved=true;for(const agency of Object.keys(agencies)){try{sweepAgency(agency);}catch{saved=false;}}return saved;
  }
  function execute(state:State,request:any,agency:string):{ticketId?:string; changed?:boolean} {
    const action=request.action, stamp=new Date(now()).toISOString(), rules:QueueRule[]=describeQueueRules(state.rules||request.policy?.rules||DEFAULT_QUEUE_CONFIG.rules);
    const categories=request.policy?.categories||DEFAULT_QUEUE_CONFIG.categories;
    for(const definition of request.policy?.counters||[]){
      const existing=state.counters.find((c)=>c.id===definition.id);
      const metadata={id:definition.id,number:definition.number,name:definition.name,agentName:definition.agentName,assignedCategoryIds:definition.assignedCategoryIds};
      if(existing)Object.assign(existing,metadata);else state.counters.push(idle(metadata as CounterStation));
    }
    if(action==='configureRules'){
      let updated:QueueRule[];
      if(request.rules){
        if(!Array.isArray(request.rules)||new Set(request.rules.map((r:any)=>r.code)).size!==request.rules.length||request.rules.some((r:any)=>!DEFAULT_QUEUE_CONFIG.rules.some(d=>d.code===r.code))||!DEFAULT_QUEUE_CONFIG.rules.filter(r=>r.code!=='R-13').every((rule)=>request.rules.some((r:any)=>r.code===rule.code&&r.parameters)))throw new CommandError(400,'Base de règles invalide.');
        updated=copy(request.rules);if(!updated.some(r=>r.code==='R-13'))updated.push(copy(rules.find(r=>r.code==='R-13')!));
      }else{
        updated=copy(rules);const selected=updated.find((r)=>r.id===request.ruleId);if(!selected)throw new CommandError(400,'Règle inconnue.');
        if(typeof request.enabled==='boolean')selected.enabled=request.enabled;
        if(request.parameterKey){
          const parameter=selected.parameters[request.parameterKey];if(!parameter)throw new CommandError(400,'Paramètre inconnu.');
          const value=request.parameterValue;
          if(parameter.type==='number'&&(!Number.isFinite(value)||(parameter.min!==undefined&&value<parameter.min)||(parameter.max!==undefined&&value>parameter.max)))throw new CommandError(400,'Valeur hors limites.');
          if(parameter.type==='boolean'&&typeof value!=='boolean')throw new CommandError(400,'Valeur invalide.');
          parameter.value=value;
        }
      }
      const mobile=updated.find(r=>r.code==='R-13')?.parameters?.peopleTolerance?.value;
      if(!Number.isInteger(mobile)||mobile<0||mobile>50)throw new CommandError(400,'La tolérance doit être un nombre entier entre 0 et 50 clients.');
      state.rules=describeQueueRules(updated);event(state,request,'RULES_UPDATED');return {};
    }
    if(action==='presenceToken'){if(!state.presenceToken)state.presenceToken=options.id();return {};}
    if(action==='reset'){
      state.tickets=[];state.counters=state.counters.map(idle);state.resetAt=Math.max(now(),state.resetAt+1);state.presenceToken=options.id();event(state,request,'QUEUE_RESET');return {};
    }
    if(action==='clearLogs'){state.logs=[];event(state,request,'LOGS_CLEARED');return {};}
    if(action==='appendLog'){
      const log=request.log;if(!log?.id||!log.action)throw new CommandError(400,'Événement invalide.');
      if(!state.logs.some((l)=>l.id===log.id))state.logs=[{...log,actor:{...log.actor,name:normalizeCustomerName(log.actor?.name)},customerName:normalizeCustomerName(log.customerName)} as QueueLogEntry,...state.logs].slice(0,500);
      return {};
    }
    if(action==='create'){
      const incoming=copy(request.ticket||{}), existing=state.tickets.find((t)=>t.id===incoming.id);
      if(existing)return {ticketId:existing.id,changed:false};
      if(!incoming.id||incoming.agencyId!==agency||!['waiting','pending_presence','booked'].includes(incoming.status))throw new CommandError(400,'Ticket invalide pour cette agence.');
      const category=categories.find((c:any)=>c.id===incoming.categoryId),operation=category?.subOperations.find((op:any)=>op.id===incoming.subOperationId);
      if(!category||!operation)throw new CommandError(400,'Opération inconnue.');
      if(incoming.status==='booked'){
        const error=bookingError(incoming.appointmentDate,incoming.appointmentTime,new Date(now()));if(error)throw new CommandError(400,error);
        if(state.tickets.some((t)=>t.appointmentDate===incoming.appointmentDate&&t.appointmentTime===incoming.appointmentTime&&!['cancelled','noshow'].includes(t.status)))throw new CommandError(409,'Ce créneau vient d’être réservé. Choisissez un autre horaire.');
      }
      if(!['standard','vip','pmr'].includes(incoming.priority))throw new CommandError(400,'Priorité invalide.');
      const prefix=category.ticketPrefix,max=Math.max(0,...state.tickets.filter((t)=>t.tokenNumber.startsWith(prefix+'-')).map((t)=>Number(t.tokenNumber.slice(prefix.length+1))||0));
      const ticket:QueueTicket={...incoming,origin:incoming.status==='booked'?'appointment':incoming.status==='pending_presence'?'app':request.actor?.role==='teller'?'counter':'kiosk',issuedSequence:state.revision+1,arrivalSequence:incoming.status==='waiting'?state.revision+1:undefined,mobileArrivalCount:undefined,mobileArrivalDecision:undefined,tokenNumber:`${prefix}-${String(max+1).padStart(3,'0')}`,subOperationName:operation.labelFr,createdAt:stamp,confirmedAt:incoming.status==='waiting'?stamp:null,customerName:normalizeCustomerName(incoming.customerName,'Visiteur'),feedback:null,counterId:null,counterName:null,calledAt:null,serviceStartedAt:null,completedAt:null,initialEstimatedMinutes:undefined,initialPeopleAhead:undefined,initialEstimateComputedAt:undefined,initialEstimateBasis:undefined,arrivalEstimatedMinutes:undefined,arrivalPeopleAhead:undefined,arrivalEstimateComputedAt:undefined};
      if (ticket.status !== 'booked') {
        const estimate = estimateTicketWait(ticket,state.tickets,state.counters,categories,rules,now());
        ticket.initialEstimatedMinutes=estimate.estimatedMinutes;ticket.initialPeopleAhead=estimate.peopleAhead;ticket.initialEstimateComputedAt=stamp;
        ticket.initialEstimateBasis=ticket.status==='pending_presence'?'presence_projection':'queue_entry';
      }
      state.tickets.push(ticket);event(state,request,ticket.status==='booked'?'APPOINTMENT_BOOKED':'TICKET_CREATED',ticket);return {ticketId:ticket.id,changed:true};
    }
    const counter=state.counters.find((c)=>c.id===request.counterId);
    if(action==='callNext'){
      if(!counter||['paused','closed'].includes(counter.status))throw new CommandError(409,'Ce guichet est indisponible.');
      const expiredPrevious=state.tickets.find((t)=>t.id===request.expectedTicketId&&t.status==='noshow'&&t.counterId===counter.id);
      if((counter.currentTicketId||null)!==(request.expectedTicketId||null)&&!(counter.currentTicketId==null&&expiredPrevious))throw new CommandError(409,'Le client au guichet a changé. Actualisez avant de continuer.');
      const activeNoShowRule=rules.find((r)=>r.code==='R-09');if(activeNoShowRule)state.noShowRule=copy(activeNoShowRule);
      const next=evaluateTickets(state.tickets,state.counters,rules,counter.id,now())[0]?.ticket;
      if(!next)return {changed:false};
      const previous=state.tickets.find((t)=>t.id===counter.currentTicketId);
      if(previous&&!terminal(previous)){
        const rule=rules.find((r)=>r.code==='R-08');
        if(!rule?.enabled||rule.parameters?.autoCompletePrevious?.value===false)throw new CommandError(409,'Terminez le client actuel avant d’appeler le suivant (auto-clôture désactivée).');
        previous.status='completed';previous.completedAt=stamp;previous.serviceDurationMinutes=previous.serviceStartedAt?Math.max(0,Math.round((now()-Date.parse(previous.serviceStartedAt))/60000)):0;
        event(state,request,'TICKET_COMPLETED',previous,counter,{autoCompletedOnNextCall:true});
      }
      next.mobileArrivalDecision=mobileArrivalDecision(next,state.tickets,rules,now())||undefined;
      Object.assign(next,{status:'called',calledAt:stamp,lastRecalledAt:null,recallCount:0,callSequence:state.revision+1,counterId:counter.id,counterName:counter.name,waitTimeMinutes:Math.max(0,Math.round((now()-Date.parse(next.confirmedAt||next.createdAt))/60000))});
      Object.assign(counter,{status:'calling',currentTicketId:next.id,serviceStartTime:null});event(state,request,'TICKET_CALLED',next,counter);return {ticketId:next.id,changed:true};
    }
    const ticket=state.tickets.find((t)=>t.id===request.ticketId);
    if(!ticket)throw new CommandError(404,'Ce ticket n’existe plus dans cette agence.');
    if(action==='confirmArrival'){
      if(!request.presenceToken||request.presenceToken!==state.presenceToken)throw new CommandError(403,'QR de présence invalide ou expiré. Scannez la borne de cette agence.');
      if(ticket.status==='waiting')return {ticketId:ticket.id,changed:false};
      if(!['booked','pending_presence'].includes(ticket.status))return {changed:false};
      if(ticket.appointmentDate&&ticket.appointmentDate!==new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now())))throw new CommandError(409,'La présence pour un rendez-vous doit être confirmée le jour prévu.');
      ticket.status='waiting';ticket.confirmedAt=stamp;ticket.arrivalSequence=state.revision+1;
      const decision=mobileArrivalDecision(ticket,state.tickets,rules,now());
      if(decision){ticket.mobileArrivalCount=decision.count;ticket.mobileArrivalDecision=decision;}
      const estimate=estimateTicketWait(ticket,state.tickets,state.counters,categories,rules,now());
      ticket.arrivalEstimatedMinutes=estimate.estimatedMinutes;ticket.arrivalPeopleAhead=estimate.peopleAhead;ticket.arrivalEstimateComputedAt=stamp;
      event(state,request,'ARRIVAL_CONFIRMED',ticket);return {ticketId:ticket.id,changed:true};
    }
    if(action==='cancel'){
      if(terminal(ticket)||ticket.status==='in_service')return {ticketId:ticket.id,changed:false};
      ticket.status='cancelled';ticket.completedAt=stamp;
      for(const desk of state.counters)if(desk.currentTicketId===ticket.id)Object.assign(desk,idle(desk));
      event(state,request,'TICKET_CANCELLED',ticket);return {ticketId:ticket.id,changed:true};
    }
    if(action==='feedback'){
      if(ticket.status!=='completed')throw new CommandError(409,'L’avis est disponible après la fin du service.');
      if(ticket.feedback)return {ticketId:ticket.id,changed:false};
      const f=request.feedback||{},error=feedbackRatingError([f.ratingWaitTime,f.ratingService,f.ratingStaff]);if(error)throw new CommandError(400,error);
      ticket.feedback={ticketId:ticket.id,ratingWaitTime:f.ratingWaitTime,ratingService:f.ratingService,ratingStaff:f.ratingStaff,overallSatisfaction:Math.round((f.ratingWaitTime+f.ratingService+f.ratingStaff)/3),comment:String(f.comment||'').slice(0,2000),submittedAt:stamp};
      event(state,request,'FEEDBACK_SUBMITTED',ticket,undefined,ticket.feedback);return {ticketId:ticket.id,changed:true};
    }
    if(action==='kyc'){
      if(terminal(ticket))throw new CommandError(409,'Ce dossier ne peut plus être modifié.');
      ticket.kycDossier=request.dossier;
      if(request.dossier?.formData?.fullName&&['Visiteur','Visiteur Borne','Client Mobile'].includes(ticket.customerName||''))ticket.customerName=normalizeCustomerName(request.dossier.formData.fullName);
      event(state,request,'KYC_DOSSIER_UPDATED',ticket);return {ticketId:ticket.id,changed:true};
    }
    if(!counter||counter.currentTicketId!==ticket.id||ticket.counterId!==counter.id){
      if(terminal(ticket))return {ticketId:ticket.id,changed:false};
      throw new CommandError(409,'L’affectation du ticket a changé. Actualisez le guichet.');
    }
    if(action==='start'){
      if(ticket.status==='in_service')return {ticketId:ticket.id,changed:false};
      if(ticket.status!=='called')throw new CommandError(409,'Ce ticket ne peut pas être pris en charge.');
      ticket.status='in_service';ticket.serviceStartedAt=stamp;counter.status='serving';counter.serviceStartTime=stamp;
      event(state,request,'SERVICE_STARTED',ticket,counter);return {ticketId:ticket.id,changed:true};
    }
    if(action==='recall'){
      if(ticket.status!=='called')return {ticketId:ticket.id,changed:false};
      const policy=noShowPolicy(rules);
      if(policy.enabled&&(ticket.recallCount||0)>=policy.maxRecalls)throw new CommandError(409,'Nombre maximal de rappels atteint. Utilisez « Client absent » ou attendez le délai d’absence.');
      ticket.recallCount=(ticket.recallCount||0)+1;ticket.lastRecalledAt=stamp;ticket.callSequence=state.revision+1;event(state,request,'TICKET_RECALLED',ticket,counter);return {ticketId:ticket.id,changed:true};
    }
    if(action==='complete'||action==='noShow'){
      if(!['called','in_service'].includes(ticket.status)||(action==='noShow'&&ticket.status!=='called'))return {ticketId:ticket.id,changed:false};
      ticket.status=action==='complete'?'completed':'noshow';ticket.completedAt=stamp;
      ticket.serviceDurationMinutes=ticket.serviceStartedAt?Math.max(0,Math.round((now()-Date.parse(ticket.serviceStartedAt))/60000)):0;
      Object.assign(counter,idle(counter));event(state,request,action==='complete'?'TICKET_COMPLETED':'TICKET_NOSHOW',ticket,counter);return {ticketId:ticket.id,changed:true};
    }
    throw new CommandError(400,'Action inconnue.');
  }
  const middleware=(req:any,res:any,next:()=>void) => {
    if(req.url?.split('?')[0]!=='/api/queue-state'){next();return;}
    const agency=new URL(req.url,'http://localhost').searchParams.get('agency')||'ag-alger-centre';
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(status:number,data:any)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    if(loadError){send(503,{error:'Le fichier de file d’attente ne peut pas être chargé. Aucune modification appliquée.'});return;}
    if(req.method==='GET'){try{sweepAgency(agency);}catch{send(503,{error:'Enregistrement des absences impossible. Aucune expiration confirmée.'});return;}send(200,publicState(Object.prototype.hasOwnProperty.call(agencies,agency)?agencies[agency]:blank()));return;}
    if(req.method!=='POST'){send(405,{error:'Méthode non autorisée.'});return;}
    let body='',tooLarge=false;
    req.on('data',(chunk:any)=>{body+=chunk.toString();if(body.length>15000000)tooLarge=true;});
    req.on('end',()=>{
      if(tooLarge){send(413,{error:'Données trop volumineuses.'});return;}
      let request:any;
      try{request=JSON.parse(body);}catch{send(400,{error:'JSON invalide.'});return;}
      try{sweepAgency(agency);}catch{send(503,{error:'Enregistrement des absences impossible. Réessayez.'});return;}
      const current=Object.prototype.hasOwnProperty.call(agencies,agency)?agencies[agency]:blank();
      if(!request.action||!request.commandId){send(409,{error:'Rechargez l’application : cet ancien format de synchronisation est désactivé.',state:publicState(current)});return;}
      const cached=Object.prototype.hasOwnProperty.call(current.commands,request.commandId)?current.commands[request.commandId]:null;
      if(cached){send(200,{success:true,...publicState(current),ticket:current.tickets.find((t)=>t.id===cached.ticketId)||null,changed:cached.changed||false,...(request.action==='presenceToken'?{presenceToken:current.presenceToken}:{})});return;}
      if(Number(request.resetAt||0)!==current.resetAt){send(409,{error:'La file a été réinitialisée. Réessayez sur la file actualisée.',state:publicState(current)});return;}
      const draft=copy(current);
      try{
        const result=execute(draft,request,agency);
        draft.revision=current.revision+1;draft.commands[request.commandId]=result;
        for(const key of Object.keys(draft.commands).slice(0,-500))delete draft.commands[key];
        const all={...agencies,[agency]:draft};
        try{options.write(JSON.stringify({schema:2,agencies:all},null,2));}catch{send(503,{error:'Enregistrement impossible. L’action n’a pas été appliquée.'});return;}
        agencies=all;
        send(200,{success:true,...publicState(draft),ticket:draft.tickets.find((t)=>t.id===result.ticketId)||null,changed:result.changed||false,...(request.action==='presenceToken'?{presenceToken:draft.presenceToken}:{})});
      }catch(error){send(error instanceof CommandError?error.status:400,{error:error instanceof Error?error.message:'Commande invalide.',state:publicState(current)});}
    });
  };
  return Object.assign(middleware,{sweep});
}
