const assert=require('assert/strict');
const {makeServer,makeClient,drain}=require('./harness.cjs');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 await check('called tickets expire exactly at the default 180-second boundary',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);
  s.clock.now+=179999;await a.poll();assert.equal(ticket.status,'called');s.clock.now++;await a.poll();assert.equal(ticket.status,'noshow');
  assert.equal(a.q.getState().counters.find((c)=>c.id===a.desks[0].id).status,'idle');assert.equal(ticket.serviceDurationMinutes,0);
  const entry=a.q.getLogs().find((l)=>l.action==='TICKET_NOSHOW');assert.equal(entry.details.automatic,true);assert.equal(entry.details.timeoutSeconds,180);
 });
 await check('background sweep persists expiry without a browser poll',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.create();await a.q.callNext(a.desks[0].id);s.clock.now+=180000;
  assert.equal(s.sweep(),true);assert.equal(JSON.parse(s.readCache()).agencies['ag-alger-centre'].tickets[0].status,'noshow');
  const count=s.writes;s.sweep();s.sweep();assert.equal(s.writes,count);assert.equal((await s.get()).logs.filter((l)=>l.action==='TICKET_NOSHOW').length,1);
 });
 await check('started services never expire as absent',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);await a.q.startServing(a.desks[0].id);s.clock.now+=8*3600000;s.sweep();await a.poll();
  assert.equal(ticket.status,'in_service');assert.equal(a.q.getLogs().filter((l)=>l.action==='TICKET_NOSHOW').length,0);
 });
 await check('recalls grant a fresh full presentation window without erasing the first call',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);const first=ticket.calledAt;
  s.clock.now+=120000;await a.q.recall(a.desks[0].id);assert.equal(ticket.calledAt,first);assert.equal(ticket.recallCount,1);
  s.clock.now+=179999;await a.poll();assert.equal(ticket.status,'called');s.clock.now++;await a.poll();assert.equal(ticket.status,'noshow');
 });
 await check('disabled R-09 stops automatic expiry but staff can still mark absent',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.q.updateRule('rule-09-noshow',{enabled:false});const ticket=await a.create();await a.q.callNext(a.desks[0].id);s.clock.now+=24*3600000;s.sweep();await a.poll();assert.equal(ticket.status,'called');
  await a.q.markNoShow(a.desks[0].id);assert.equal(ticket.status,'noshow');assert.equal(a.q.getLogs().find((l)=>l.action==='TICKET_NOSHOW').details?.automatic,undefined);
 });
 await check('configured timeout persists across restart and is shared with another device',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();await a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:60});await b.poll();
  assert.equal(b.cfg.getRules().find((r)=>r.code==='R-09').parameters.noShowTimeoutSeconds.value,60);
  const ticket=await a.create();await a.q.callNext(a.desks[0].id);const restarted=makeServer(s.readCache());restarted.clock.now=s.clock.now+60000;
  const state=await restarted.get();assert.equal(state.tickets[0].status,'noshow');assert.equal(state.rules.find((r)=>r.code==='R-09').parameters.noShowTimeoutSeconds.value,60);
 });
 await check('recall limit allows the last recall a full grace period',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:60});const ticket=await a.create();await a.q.callNext(a.desks[0].id);
  for(let i=0;i<3;i++){s.clock.now+=1000;await a.q.recall(a.desks[0].id)}assert.equal(ticket.recallCount,3);await assert.rejects(a.q.recall(a.desks[0].id),/maximal/);
  s.clock.now+=59999;await a.poll();assert.equal(ticket.status,'called');s.clock.now++;await a.poll();assert.equal(ticket.status,'noshow');
 });
 await check('expiry is isolated per agency and respects each saved timeout',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s,{agency:'ag-hydra'});await drain();await a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:60});
  await a.create();await b.create();await a.q.callNext(a.desks[0].id);await b.q.callNext(b.desks[0].id);s.clock.now+=60000;s.sweep();
  assert.equal((await s.get()).tickets[0].status,'noshow');assert.equal((await s.get('ag-hydra')).tickets[0].status,'called');
 });
 await check('failed expiry saving is not acknowledged and retries without duplicate events',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.create();await a.q.callNext(a.desks[0].id);const saved=s.readCache();s.clock.now+=180000;s.failWrites=true;
  assert.equal(s.sweep(),false);assert.equal(s.readCache(),saved);assert.equal((await s.request('GET','ag-alger-centre')).status,503);
  s.failWrites=false;assert.equal(s.sweep(),true);assert.equal((await s.get()).tickets[0].status,'noshow');assert.equal((await s.get()).logs.filter((l)=>l.action==='TICKET_NOSHOW').length,1);
 });
 await check('the reported old calls expire and C-012 remains the latest TV call',async()=>{
  const base=makeClient(makeServer()),config=base.cfg.getConfig(),cat=config.categories[0],op=cat.subOperations[0];
  const fixture=(id,token,calledAt,counterId,status='called')=>({id,tokenNumber:token,categoryId:cat.id,subOperationId:op.id,subOperationName:op.labelFr,priority:'standard',agencyId:'ag-alger-centre',status,createdAt:calledAt,confirmedAt:calledAt,calledAt,counterId});
  const raw={tickets:[fixture('old-c','C-005','2026-10-26T19:34:00Z',config.counters[0].id),fixture('old-p','P-001','2026-10-26T19:37:00Z',config.counters[2].id),fixture('new','C-012','2026-10-26T21:58:00Z',config.counters[1].id,'completed')],counters:config.counters,logs:[],version:'legacy'};
  const s=makeServer(JSON.stringify(raw));s.clock.now=Date.parse('2026-10-26T22:00:00Z');const a=makeClient(s);await drain();const state=a.q.getState();
  assert.equal(state.tickets.filter((t)=>t.status==='noshow').length,2);assert.equal(state.lastCalledTicket.tokenNumber,'C-012');assert.equal(state.lastCalledTicket.status,'completed');assert.equal(state.tickets.filter((t)=>t.status==='called'||t.status==='in_service').length,0);
 });
 await check('an expired older ticket never frees a counter serving another customer',async()=>{
  const a=makeClient(makeServer()),c=a.cfg.getConfig(),op=c.categories[0].subOperations[0];
  const t=(id,time,status)=>({id,tokenNumber:id,categoryId:c.categories[0].id,subOperationId:op.id,subOperationName:op.labelFr,priority:'standard',status,counterId:c.counters[0].id,createdAt:time,calledAt:time,...(status==='in_service'?{serviceStartedAt:time}:{})});
  const s=makeServer(JSON.stringify({tickets:[t('old','2026-10-26T08:00:00Z','called'),t('serving','2026-10-26T09:59:00Z','in_service')],counters:c.counters,logs:[]}));
  const state=await s.get();assert.equal(state.tickets.find((t)=>t.id==='old').status,'noshow');assert.equal(state.counters[0].currentTicketId,'serving');assert.equal(state.counters[0].status,'serving');
 });
 await check('call sequence breaks ties and completed recent calls stay ahead of old active calls',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const first=await a.create(),second=await a.create();await a.q.callNext(a.desks[0].id);await a.q.callNext(a.desks[1].id);await a.q.completeTicket(a.desks[1].id);
  assert.equal(a.q.getState().lastCalledTicket.id,second.id);assert.equal(first.status,'called');s.clock.now+=1000;await a.q.recall(a.desks[0].id);assert.equal(a.q.getState().lastCalledTicket.id,first.id);
 });
 await check('old calls and finished services never start a new call pulse after reload',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const now=s.clock.now;
  const ticket={status:'called',calledAt:new Date(now-60000).toISOString()};assert.equal(a.isLiveCall(ticket,now),false);
  assert.equal(a.isLiveCall({...ticket,calledAt:new Date(now-1000).toISOString()},now),true);assert.equal(a.isLiveCall({...ticket,status:'completed',calledAt:new Date(now).toISOString()},now),false);
 });
 await check('saved legacy rule descriptions are updated without resetting enabled flags or bonuses',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const cfg=JSON.parse(JSON.stringify(a.cfg.getConfig())),vip=cfg.rules.find((r)=>r.code==='R-02');vip.description='Old vague description';vip.enabled=false;vip.parameters.boostFactor.value=75;
  a.context.localStorage.setItem('capturedoc_queue_config_v3',JSON.stringify(cfg));await a.cfg.init();const updated=a.cfg.getRules().find((r)=>r.code==='R-02');assert.match(updated.description,/ancienneté/);assert.equal(updated.enabled,false);assert.equal(updated.parameters.boostFactor.value,75);
 });
 await check('concurrent rule parameter edits merge without overwriting each other',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();
  await Promise.all([a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:90}),b.q.updateRule('rule-09-noshow',{parameterKey:'maxRecallsBeforeNoShow',parameterValue:2})]);
  const state=await s.get(),rule=state.rules.find((r)=>r.code==='R-09');assert.equal(rule.parameters.noShowTimeoutSeconds.value,90);assert.equal(rule.parameters.maxRecallsBeforeNoShow.value,2);
 });
 await check('invalid timeout edits fail without altering saved policy',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:90});
  await assert.rejects(a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:-1}));
  assert.equal((await s.get()).rules.find((r)=>r.code==='R-09').parameters.noShowTimeoutSeconds.value,90);
 });
 await check('switching agencies restores that agency policy instead of carrying a previous timeout',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.q.updateRule('rule-09-noshow',{parameterKey:'noShowTimeoutSeconds',parameterValue:90});
  a.cfg.selectAgency('ag-hydra');await drain();assert.equal(a.cfg.getRules().find((r)=>r.code==='R-09').parameters.noShowTimeoutSeconds.value,180);
  const t=await a.create();await a.q.callNext(a.desks[0].id);s.clock.now+=90000;await a.poll();assert.equal(t.status,'called');
  a.cfg.selectAgency('ag-alger-centre');await drain();assert.equal(a.cfg.getRules().find((r)=>r.code==='R-09').parameters.noShowTimeoutSeconds.value,90);
 });
 console.log(checks+' no-show and call-history regression checks passed');
})().catch((error)=>{console.error(error);process.exitCode=1});
