import {estimateTicketWait} from './queueEstimate';
import {calledTicketsNewestFirst,callTime} from './callLifecycle';
import {QueueTicket, TicketStatus, TicketPriority, CounterStation, FeedbackSurvey, KycDossier, QueueLogEntry, LogLevel, LogCategory, RuleScoreBreakdown, QueueRule, UserAccount, STANDARD_APPOINTMENT_SLOTS} from '../types/queueTypes';
import {configService} from './configService';
import {audioService} from './audioService';
import {notifications} from './notificationService';
import {evaluateTickets} from './queuePolicy';
import {normalizeCustomerName, feedbackRatingError, bookingError} from '../utils/queueValidation';
const QUEUE_STORAGE_KEY='capturedoc_queue_tickets_v3',COUNTERS_STORAGE_KEY='capturedoc_queue_counters_v3',LOGS_STORAGE_KEY='capturedoc_queue_audit_logs_v1';
export function getActiveAuthUser():UserAccount|null {
  if(typeof window==='undefined')return null;
  try{return JSON.parse(sessionStorage.getItem('agb_queue_auth_session_v1')||'null')?.user||null;}catch{return null;}
}
export interface QueueState {
  tickets:QueueTicket[];counters:CounterStation[];lastCalledTicket:QueueTicket|null;logs?:QueueLogEntry[];resetAt?:number;syncStatus?:'connecting'|'online'|'offline';
  recentCalledHistory:{ticketNumber:string;counterName:string;categoryLabel:string;calledAt:string;status:TicketStatus}[];
}
export type AddLogInput = {
  level: LogLevel;
  category: LogCategory;
  action: string;
  message: string;
  actor?: {
    id: string;
    name: string;
    username?: string;
    role: 'admin' | 'teller' | 'kiosk' | 'kiosk_operator' | 'client' | 'system';
    roleLabel?: string;
  };
  ticketNumber?: string;
  ticketId?: string;
  operationName?: string;
  categoryName?: string;
  priority?: TicketPriority;
  customerName?: string;
  customerPhone?: string;
  predictedWaitMinutes?: number | null;
  estimateComputedAt?: string;
  estimateBasis?: QueueLogEntry['estimateBasis'];
  peopleAhead?: number;
  realWaitMinutes?: number;
  serviceDurationMinutes?: number;
  waitDeltaMinutes?: number;
  counterId?: string;
  counterName?: string;
  counterNumber?: number;
  agentName?: string;
  ticketCreatedAt?: string;
  ticketCalledAt?: string;
  ticketServiceStartedAt?: string;
  ticketCompletedAt?: string;
  details?: Record<string, any>;
};

class QueueStore {
  private agencyId=configService.getConfig().selectedAgencyId;
  private tickets:QueueTicket[]=[];private counters:CounterStation[]=[];private logs:QueueLogEntry[]=[];
  private serverResetAt=0;private revision=-1;private generation=0;private syncStatus:QueueState['syncStatus']='connecting';
  private listeners=new Set<(state:QueueState)=>void>();private channel:BroadcastChannel|null=null;
  private pendingCreations=new Map<string,{ticket:QueueTicket;commandId:string}>();
  private storageKey(key:string){return `${key}:${this.agencyId}`;}
  private id(){return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;}
  constructor(){
    this.loadFromStorage();
    if(typeof window!=='undefined'){
      if('BroadcastChannel' in window){this.channel=new BroadcastChannel('capturedoc_queue_sync_channel_v3');this.channel.onmessage=(event)=>{if(event.data?.agencyId===this.agencyId)void this.fetchServerState();};}
      window.addEventListener('storage',(event)=>{if(event.key===this.storageKey(QUEUE_STORAGE_KEY))void this.fetchServerState();});
      setInterval(()=>void this.fetchServerState(),800);void this.fetchServerState();
      configService.subscribe((cfg)=>{
        if(cfg.selectedAgencyId===this.agencyId)return;
        this.agencyId=cfg.selectedAgencyId;this.generation++;this.pendingCreations.clear();this.revision=-1;
        this.tickets=[];this.logs=[];this.counters=[];this.serverResetAt=0;this.loadFromStorage();this.notify();void this.fetchServerState();
      });
    }
  }
  private loadFromStorage():void {
    this.counters=configService.getConfig().counters.map((c)=>({...c,status:'idle',currentTicketId:null,serviceStartTime:null}));
    if(typeof window==='undefined')return;
    try{
      this.tickets=JSON.parse(localStorage.getItem(this.storageKey(QUEUE_STORAGE_KEY))||'[]').map((t:QueueTicket)=>({...t,customerName:normalizeCustomerName(t.customerName)}));
      this.counters=JSON.parse(localStorage.getItem(this.storageKey(COUNTERS_STORAGE_KEY))||'null')||this.counters;
      this.logs=JSON.parse(localStorage.getItem(this.storageKey(LOGS_STORAGE_KEY))||'[]');
      this.serverResetAt=Number(localStorage.getItem(this.storageKey('queue_reset_epoch'))||0);
      const token=localStorage.getItem(`agb_active_client_ticket:${this.agencyId}`),identityKey=`agb_active_client_ticket:${this.agencyId}:id`;
      if(token&&!localStorage.getItem(identityKey)){
        const cached=this.tickets.find((t)=>t.tokenNumber===token);
        if(cached)localStorage.setItem(identityKey,cached.id);else localStorage.removeItem(`agb_active_client_ticket:${this.agencyId}`);
      }
    }catch{this.tickets=[];this.logs=[];}
  }
  private persist(){
    if(typeof window==='undefined')return;
    try{
      localStorage.setItem(this.storageKey(QUEUE_STORAGE_KEY),JSON.stringify(this.tickets));localStorage.setItem(this.storageKey(COUNTERS_STORAGE_KEY),JSON.stringify(this.counters));
      localStorage.setItem(this.storageKey(LOGS_STORAGE_KEY),JSON.stringify(this.logs));localStorage.setItem(this.storageKey('queue_reset_epoch'),String(this.serverResetAt));
    }catch{}
  }
  private applyState(data:any){
    if(!Array.isArray(data?.tickets)||data.resetAt<this.serverResetAt)return;
    if(data.resetAt===this.serverResetAt&&Number(data.revision)<this.revision)return;
    if((data.resetAt||0)!==this.serverResetAt){
      this.generation++;this.pendingCreations.clear();
      if(typeof window!=='undefined'){localStorage.removeItem(`agb_active_client_ticket:${this.agencyId}`);localStorage.removeItem(`agb_active_client_ticket:${this.agencyId}:id`);}
    }
    const byId=new Map(this.tickets.map((t)=>[t.id,t]));
    this.tickets=data.tickets.map((t:QueueTicket)=>Object.assign(byId.get(t.id)||{},{...t,customerName:normalizeCustomerName(t.customerName)}));
    if(Array.isArray(data.rules)&&JSON.stringify(data.rules)!==JSON.stringify(configService.getRules()))configService.saveConfig({...configService.getConfig(),rules:data.rules});
    this.counters=data.counters||[];this.logs=data.logs||[];this.serverResetAt=data.resetAt||0;this.revision=data.revision||0;this.syncStatus='online';this.persist();this.notify();
  }
  public async fetchServerState():Promise<void>{
    if(typeof window==='undefined')return;
    const agency=this.agencyId,generation=this.generation;
    try{
      const response=await fetch(`/api/queue-state?agency=${encodeURIComponent(agency)}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Synchronisation indisponible.');
      const data=await response.json();if(agency===this.agencyId&&generation===this.generation)this.applyState(data);
    }catch{if(agency===this.agencyId&&generation===this.generation&&this.syncStatus!=='offline'){this.syncStatus='offline';this.notify();}}
  }
  private actor(source?:'kiosk'|'client'|'counter',name?:string){
    const user=getActiveAuthUser();if(source==='client')return {id:'client',name:normalizeCustomerName(name,'Client Mobile'),role:'client',username:'client_mobile',roleLabel:'Portail Client Web'};
    if(source==='kiosk')return {id:'kiosk',name:'Borne d’accueil',role:'kiosk',roleLabel:'Borne Libre-Service'};
    return user?{id:user.id,name:user.name,username:user.username,role:user.role,roleLabel:user.roleLabel}:{id:'system',name:name||'Système Agence',role:'system'};
  }
  private async command(action:string,payload:any={},commandId=this.id()):Promise<any>{
    const agency=this.agencyId,generation=this.generation,resetAt=this.serverResetAt,cfg=configService.getConfig();
    let response:Response;
    const controller=typeof AbortController==='undefined'?undefined:new AbortController();
    const timeout=controller?setTimeout(()=>controller.abort(),12000):undefined;
    try{response=await fetch(`/api/queue-state?agency=${encodeURIComponent(agency)}`,{method:'POST',signal:controller?.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action,commandId,resetAt,actor:this.actor(),policy:{rules:configService.getRules(),categories:cfg.categories,counters:cfg.counters.map(({id,number,name,agentName,assignedCategoryIds})=>({id,number,name,agentName,assignedCategoryIds}))},...payload})});}
    catch{throw new Error('Connexion au serveur impossible. L’action n’a pas pu être confirmée. Réessayez après reconnexion.');}
    finally{if(timeout!==undefined)clearTimeout(timeout);}
    let data:any;try{data=await response.json();}catch{throw new Error('Réponse du serveur illisible. L’action n’a pas pu être confirmée.');}
    if(agency!==this.agencyId||generation!==this.generation||(data.resetAt!==undefined&&data.resetAt<this.serverResetAt))throw new Error('La file ou l’agence a changé pendant l’action. Actualisez avant de réessayer.');
    if(!response.ok){if(data.state)this.applyState(data.state);throw new Error(data.error||'L’action n’a pas été enregistrée. Réessayez.');}
    if(!data.success||!Array.isArray(data.tickets))throw new Error('Réponse du serveur invalide. L’action ne peut pas être confirmée.');
    this.applyState(data);this.channel?.postMessage({agencyId:agency,type:'QUEUE_STATE_CHANGED'});
    return {...data,ticket:data.ticket?this.tickets.find((t)=>t.id===data.ticket.id)||null:null};
  }
  public getState():QueueState {
    const rank=new Map(this.evaluateTicketScores().map((r,i)=>[r.ticket.id,i]));
    const called=calledTicketsNewestFirst(this.tickets);
    return {tickets:[...this.tickets].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity)||Date.parse(a.createdAt)-Date.parse(b.createdAt)),counters:[...this.counters],logs:[...this.logs],resetAt:this.serverResetAt,syncStatus:this.syncStatus,
      lastCalledTicket:called[0]||null,
      recentCalledHistory:called.slice(0,6).map((t)=>({ticketNumber:t.tokenNumber,counterName:t.counterName||'Guichet',categoryLabel:configService.getConfig().categories.find((c)=>c.id===t.categoryId)?.labelFr||t.subOperationName,calledAt:new Date(callTime(t)).toISOString(),status:t.status}))};
  }
  public subscribe(cb:(state:QueueState)=>void){this.listeners.add(cb);cb(this.getState());return ()=>{this.listeners.delete(cb);};}
  private notify(){const state=this.getState();this.listeners.forEach((cb)=>cb(state));}
  public evaluateTicketScores(counterId?:string):RuleScoreBreakdown[]{return evaluateTickets(this.tickets,this.counters,configService.getRules(),counterId);}
  public async createTicket(categoryId:string,subOperationId:string,priority:TicketPriority='standard',customerName?:string,customerPhone?:string,confirmedAt:string|null=new Date().toISOString(),agencyId?:string,source:'kiosk'|'client'|'counter'='kiosk'):Promise<QueueTicket>{
    if(agencyId&&agencyId!==this.agencyId)throw new Error('Sélectionnez cette agence avant de créer le ticket.');
    const cfg=configService.getConfig(),category=cfg.categories.find((c)=>c.id===categoryId),op=category?.subOperations.find((s)=>s.id===subOperationId);
    if(!op)throw new Error('Opération inconnue.');
    const signature=JSON.stringify([this.agencyId,categoryId,subOperationId,priority,customerName,customerPhone,confirmedAt===null,source]);
    let pending=this.pendingCreations.get(signature);
    if(!pending){const ticket:QueueTicket={id:this.id(),tokenNumber:'',categoryId,subOperationId,subOperationName:op.labelFr,priority,customerName:normalizeCustomerName(customerName,source==='kiosk'?'Visiteur Borne':'Client Mobile'),customerPhone,agencyId:this.agencyId,status:confirmedAt===null?'pending_presence':'waiting',confirmedAt,createdAt:new Date().toISOString(),feedback:null};pending={ticket,commandId:this.id()};this.pendingCreations.set(signature,pending);}
    const result=await this.command('create',{ticket:pending.ticket,actor:this.actor(source,pending.ticket.customerName)},pending.commandId);
    this.pendingCreations.delete(signature);if(!result.ticket)throw new Error('Le ticket n’existe plus après la réinitialisation.');return result.ticket;
  }
  public async adoptTicket(ticket:QueueTicket):Promise<void>{await this.command('create',{ticket:{...ticket,agencyId:this.agencyId,customerName:normalizeCustomerName(ticket.customerName)}});}
  public getBookedSlots(date:string):string[]{return this.tickets.filter((t)=>t.appointmentDate===date&&t.appointmentTime&&!['cancelled','noshow'].includes(t.status)).map((t)=>t.appointmentTime!);}
  public isSlotAvailable(date:string,time:string){return !bookingError(date,time)&&!this.getBookedSlots(date).includes(time);}
  public getAvailableSlots(date:string,slots:readonly string[]=STANDARD_APPOINTMENT_SLOTS){return slots.filter((time)=>this.isSlotAvailable(date,time));}
  public async bookAppointment(categoryId:string,subOperationId:string,date:string,timeSlot:string,priority:TicketPriority='standard',customerName?:string,customerPhone?:string):Promise<QueueTicket>{
    const error=bookingError(date,timeSlot);if(error)throw new Error(error);
    const op=configService.getConfig().categories.find((c)=>c.id===categoryId)?.subOperations.find((s)=>s.id===subOperationId);if(!op)throw new Error('Opération inconnue.');
    const ticket:QueueTicket={id:this.id(),tokenNumber:'',categoryId,subOperationId,subOperationName:op.labelFr,priority,status:'booked',customerName:normalizeCustomerName(customerName,'Client Réservation'),customerPhone,agencyId:this.agencyId,appointmentDate:date,appointmentTime:timeSlot,createdAt:new Date().toISOString(),confirmedAt:null,feedback:null};
    const result=await this.command('create',{ticket,actor:this.actor('client',ticket.customerName)});if(!result.ticket)throw new Error('Réservation annulée par la réinitialisation.');return result.ticket;
  }
  public async getKioskPresenceToken():Promise<string>{const result=await this.command('presenceToken');return result.presenceToken;}
  public async confirmArrival(ticketId:string,presenceToken?:string):Promise<QueueTicket|null>{
    const ticket=this.tickets.find((t)=>t.id===ticketId||t.tokenNumber.toUpperCase()===ticketId.toUpperCase());
    if(!ticket||!['waiting','pending_presence','booked'].includes(ticket.status))return null;
    const result=await this.command('confirmArrival',{ticketId:ticket.id,presenceToken,actor:this.actor('kiosk')});return result.ticket;
  }
  private sound(ticket:QueueTicket){
    const cfg=configService.getConfig();if(!cfg.soundSettings.soundEnabled&&!cfg.soundSettings.speechEnabled)return;
    audioService.speakTicketCall(ticket.tokenNumber,ticket.counterName||'Guichet',cfg.soundSettings.speechLang||'fr-FR',cfg.soundSettings.speechEnabled);
  }
  public async callNext(counterId:string,actorName?:string):Promise<QueueTicket|null>{
    const counter=this.counters.find((c)=>c.id===counterId);if(!counter)return null;
    const result=await this.command('callNext',{counterId,expectedTicketId:counter.currentTicketId||null,actor:this.actor('counter',actorName)});
    if(result.ticket&&result.changed)this.sound(result.ticket);return result.ticket;
  }
  private async counterAction(action:string,counterId:string,actorName?:string):Promise<QueueTicket|null>{
    const counter=this.counters.find((c)=>c.id===counterId);if(!counter?.currentTicketId)return null;
    const result=await this.command(action,{counterId,ticketId:counter.currentTicketId,actor:this.actor('counter',actorName)});return result.ticket;
  }
  public async recall(counterId:string,actorName?:string):Promise<void>{const ticket=await this.counterAction('recall',counterId,actorName);if(ticket)this.sound(ticket);}
  public async startServing(counterId:string,actorName?:string):Promise<void>{await this.counterAction('start',counterId,actorName);}
  public completeTicket(counterId:string,actorName?:string):Promise<QueueTicket|null>{return this.counterAction('complete',counterId,actorName);}
  public async markNoShow(counterId:string,actorName?:string):Promise<void>{await this.counterAction('noShow',counterId,actorName);}
  public async cancelTicket(ticketId:string,actorName?:string):Promise<boolean>{
    const ticket=this.tickets.find((t)=>t.id===ticketId);if(!ticket||['completed','cancelled','noshow','in_service'].includes(ticket.status))return false;
    const result=await this.command('cancel',{ticketId,actor:this.actor('client',actorName||ticket.customerName)});return result.ticket?.status==='cancelled';
  }
  public async submitFeedback(ticketId:string,feedback:Omit<FeedbackSurvey,'ticketId'|'submittedAt'>):Promise<boolean>{
    const ticket=this.tickets.find((t)=>t.id===ticketId);if(!ticket||ticket.status!=='completed'||ticket.feedback)return false;
    const error=feedbackRatingError([feedback.ratingWaitTime,feedback.ratingService,feedback.ratingStaff]);if(error)throw new Error(error);
    const result=await this.command('feedback',{ticketId,feedback,actor:this.actor('client',ticket.customerName)});return Boolean(result.changed);
  }
  public async updateTicketKycDossier(ticketId:string,dossier:KycDossier):Promise<QueueTicket|null>{return (await this.command('kyc',{ticketId,dossier,actor:this.actor('client')})).ticket;}
  public async saveRules(rules:QueueRule[]):Promise<void>{await this.command('configureRules',{rules});}
  public async updateRule(ruleId:string,change:{enabled?:boolean;parameterKey?:string;parameterValue?:any}):Promise<void>{await this.command('configureRules',{ruleId,...change});}
  public async clearLogs():Promise<void>{await this.command('clearLogs');}
  public async resetQueue(actorName?:string):Promise<void>{
    this.generation++;this.pendingCreations.clear();
    await this.command('reset',{actor:this.actor('counter',actorName)});
    if(typeof window!=='undefined')localStorage.removeItem(`agb_active_client_ticket:${this.agencyId}`);
  }
  public addLog(input:AddLogInput):QueueLogEntry{
    const log={...input,id:this.id(),timestamp:new Date().toISOString(),actor:input.actor||this.actor(),customerName:normalizeCustomerName(input.customerName)} as QueueLogEntry;
    void this.command('appendLog',{log}).catch((error)=>notifications.error(error.message));return log;
  }
  public getLogs(filters?: {
    level?: LogLevel;
    category?: LogCategory;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): QueueLogEntry[] {
    let result = [...this.logs];

    // Ensure logs are ALWAYS sorted strictly newest-first by timestamp
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (!filters) return result;

    if (filters.level && filters.level !== ('all' as any)) {
      result = result.filter((l) => l.level === filters.level);
    }

    if (filters.category && filters.category !== ('all' as any)) {
      result = result.filter((l) => l.category === filters.category);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter((l) =>
        (l.message && l.message.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.ticketNumber && l.ticketNumber.toLowerCase().includes(q)) ||
        (l.counterName && l.counterName.toLowerCase().includes(q)) ||
        (l.actor.name && l.actor.name.toLowerCase().includes(q)) ||
        (l.actor.username && l.actor.username.toLowerCase().includes(q)) ||
        (l.operationName && l.operationName.toLowerCase().includes(q)) ||
        (l.customerName && l.customerName.toLowerCase().includes(q))
      );
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      result = result.filter((l) => new Date(l.timestamp).getTime() >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      result = result.filter((l) => new Date(l.timestamp).getTime() <= end);
    }

    return result;
  }


  public exportLogs(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    const headers = [
      'Timestamp ISO',
      'Date Heure Locale',
      'Niveau',
      'Catégorie',
      'Action',
      'Message',
      'Acteur Nom',
      'Acteur Username (@)',
      'Acteur Rôle',
      'N° Ticket',
      'Priorité',
      'Catégorie Opération',
      'Opération Demandée',
      'Nom Client',
      'Téléphone Client',
      'Attente Estimée Prédite (min)',
      'Date Calcul Estimation',
      'Contexte Estimation',
      'Personnes Devant',
      'Attente Réelle Constatée (min)',
      'Écart Attente (min)',
      'Durée Traitement Guichet (min)',
      'N° Guichet',
      'Nom Guichet',
      'Agent Guichetier',
      'Date Création Ticket',
      'Date Appel Guichet',
      'Date Début Prise en Charge',
      'Date Clôture Ticket',
      'Détails Métadonnées JSON'
    ];

    const rows = this.logs.map((l) => [
      `"${l.timestamp}"`,
      `"${new Date(l.timestamp).toLocaleString('fr-FR')}"`,
      `"${l.level}"`,
      `"${l.category}"`,
      `"${l.action}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      `"${(l.actor?.name || '').replace(/"/g, '""')}"`,
      `"${(l.actor?.username ? `@${l.actor.username}` : '').replace(/"/g, '""')}"`,
      `"${(l.actor?.role || '').replace(/"/g, '""')}"`,
      `"${l.ticketNumber || '-'}"`,
      `"${l.priority || '-'}"`,
      `"${(l.categoryName || '').replace(/"/g, '""')}"`,
      `"${(l.operationName || '').replace(/"/g, '""')}"`,
      `"${(l.customerName || '').replace(/"/g, '""')}"`,
      `"${(l.customerPhone || '').replace(/"/g, '""')}"`,
      `"${l.predictedWaitMinutes === null ? 'Indisponible' : l.predictedWaitMinutes !== undefined ? l.predictedWaitMinutes : '-'}"`,
      `"${l.estimateComputedAt || '-'}"`,
      `"${l.estimateBasis || '-'}"`,
      `"${l.peopleAhead !== undefined ? l.peopleAhead : '-'}"`,
      `"${l.realWaitMinutes !== undefined ? l.realWaitMinutes : '-'}"`,
      `"${l.waitDeltaMinutes !== undefined ? (l.waitDeltaMinutes > 0 ? `+${l.waitDeltaMinutes}` : l.waitDeltaMinutes) : '-'}"`,
      `"${l.serviceDurationMinutes !== undefined ? l.serviceDurationMinutes : '-'}"`,
      `"${l.counterNumber !== undefined ? l.counterNumber : '-'}"`,
      `"${(l.counterName || '').replace(/"/g, '""')}"`,
      `"${(l.agentName || '').replace(/"/g, '""')}"`,
      `"${l.ticketCreatedAt || '-'}"`,
      `"${l.ticketCalledAt || '-'}"`,
      `"${l.ticketServiceStartedAt || '-'}"`,
      `"${l.ticketCompletedAt || '-'}"`,
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);

    return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  }


  public getPriorityPolicyDescription(): string {
    const rules = configService.getRules();
    const pmr = rules.find((r) => r.code === 'R-01'), vip = rules.find((r) => r.code === 'R-02');
    const pmrText = pmr?.enabled ? (pmr.parameters?.headOfLine?.value !== false ? 'PMR : passage en tête.' : 'PMR : priorité pondérée.') : 'Priorité PMR désactivée.';
    return `${pmrText} ${vip?.enabled ? `VIP : bonus de ${Number(vip.parameters?.boostFactor?.value ?? 50)} points ; l’ancienneté et les délais peuvent maintenir un autre client devant.` : 'Priorité VIP désactivée.'}`;
  }

  public getServiceEstimate(categoryId: string, subOperationId: string, priority: TicketPriority = 'standard') {
    return this.getTicketEstimate({ id: 'preview', tokenNumber: '', categoryId, subOperationId,
      subOperationName: '', priority, status: 'waiting', createdAt: new Date().toISOString(),
      agencyId: this.agencyId, confirmedAt: new Date().toISOString() });
  }

  public getHourlyAffluence() {
    const tickets = this.tickets.filter((t) => new Date(t.createdAt).toDateString() === new Date().toDateString());
    const counts = Array.from({length:24},(_,h) => tickets.filter((t) => new Date(t.createdAt).getHours()===h).length);
    const max = Math.max(1,...counts);
    return counts.map((count,h) => ({hour:`${String(h).padStart(2,'0')}:00`, count, percentage:Math.round(count*100/max),isPeak:count>0 && count===max}));
  }

  public getPeakHourLabel(): string {
    const today = this.tickets.filter((t) => new Date(t.createdAt).toDateString() === new Date().toDateString());
    if (!today.length) return 'Affluence : aucune donnée aujourd’hui';
    const hours = Array.from({length:24},(_,h) => today.filter((t) => new Date(t.createdAt).getHours()===h).length);
    const peak = hours.indexOf(Math.max(...hours));
    return `Pointe observée : ${peak}h–${peak+1}h`;
  }

  public getTicketEstimate(ticket: QueueTicket): {peopleAhead: number; estimatedMinutes: number | null} {
    const cfg = configService.getConfig();
    return estimateTicketWait({...ticket, agencyId: ticket.agencyId || cfg.selectedAgencyId}, this.tickets, this.counters, cfg.categories, configService.getRules());
  }


}
export const queueStore=new QueueStore();
