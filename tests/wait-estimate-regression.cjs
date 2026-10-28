const assert=require('assert/strict'),vm=require('vm'),path=require('path');
const {makeServer,makeClient,drain,arrive}=require('./harness.cjs');
const root=path.resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const source=esbuild.buildSync({stdin:{contents:"export {estimateTicketWait} from './src/services/queueEstimate';export {DEFAULT_QUEUE_RULES} from './src/config/defaultQueueRules';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const m={exports:{}};vm.runInNewContext(source,{module:m,require,console,Date});
const {estimateTicketWait,DEFAULT_QUEUE_RULES}=m.exports;
const now=Date.parse('2026-10-26T10:00:00Z'),iso=(value)=>new Date(value).toISOString();
const categories=[{id:'cash',subOperations:[{id:'withdraw',estimatedMinutes:8},{id:'other',estimatedMinutes:10},{id:'long',estimatedMinutes:20},{id:'longest',estimatedMinutes:30}]},{id:'advice',subOperations:[{id:'advice',estimatedMinutes:15}]}];
const rules=()=>JSON.parse(JSON.stringify(DEFAULT_QUEUE_RULES)).map(r=>({...r,enabled:!['R-03','R-06','R-07','R-12'].includes(r.code)}));
const desk=(id='one',extras={})=>({id,number:id==='one'?1:2,name:id,status:'idle',currentTicketId:null,assignedCategoryIds:['cash'],...extras});
const ticket=(id,op='withdraw',extras={})=>({id,tokenNumber:id,categoryId:'cash',subOperationId:op,subOperationName:op,status:'waiting',priority:'standard',agencyId:'alger',createdAt:iso(now-60000),confirmedAt:iso(now-60000),...extras});
const target=(op='withdraw',extras={})=>ticket('target',op,{createdAt:iso(now),confirmedAt:iso(now),...extras});
const estimate=(item,queue=[],counters=[desk()],policy=rules())=>estimateTicketWait(item,queue,counters,categories,policy,now);
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
async function oneCounter(allClosed=false){
 const original=makeClient(makeServer()),cfg=original.cfg.getConfig();
 const counters=cfg.counters.map(c=>({...c,status:!allClosed&&c.id===original.desks[0].id?'idle':'closed',currentTicketId:null,serviceStartTime:null}));
 const server=makeServer(JSON.stringify({tickets:[],counters,logs:[]})),a=makeClient(server),b=makeClient(server);await drain();return {server,a,b};
}
(async()=>{
 await check('the reported 8- and 10-minute choices have the same wait behind the same customer',()=>{
  const queue=[ticket('ahead')];assert.equal(estimate(target('withdraw'),queue).estimatedMinutes,8);assert.equal(estimate(target('other'),queue).estimatedMinutes,8);
 });
 await check('two waiting tickets can both be immediate at two free counters while keeping their queue order',()=>{
  const first=ticket('first'),second=target('other'),counters=[desk(),desk('two')],queue=[first,second];
  const a=estimate(first,queue,counters),b=estimate(second,queue,counters);assert.equal(a.peopleAhead,0);assert.equal(b.peopleAhead,1);assert.equal(a.estimatedMinutes,0);assert.equal(b.estimatedMinutes,0);
 });
 await check('equal arrival timestamps keep stable queue positions during repeated estimates',()=>{
  const first=ticket('first'),second=ticket('second'),queue=[first,second],counters=[desk(),desk('two')];
  for(let i=0;i<3;i++){assert.equal(estimate(first,queue,counters).peopleAhead,0);assert.equal(estimate(second,queue,counters).peopleAhead,1)}
 });
 await check('one free counter cannot make both queued tickets immediate, including when a second counter is busy',()=>{
  const first=ticket('first'),second=target('other');assert.equal(estimate(second,[first,second],[desk()]).estimatedMinutes,8);
  const busy=ticket('busy','long',{status:'in_service',counterId:'two',serviceStartedAt:iso(now)});assert.equal(estimate(second,[first,second,busy],[desk(),desk('two',{status:'serving',currentTicketId:'busy'})]).estimatedMinutes,8);
 });
 await check('mixed operations ahead contribute their own service times',()=>{
  const result=estimate(target('other'),[ticket('a','withdraw'),ticket('b','long')]);assert.equal(result.estimatedMinutes,28);assert.equal(result.peopleAhead,2);
 });
 await check('parallel counters project actual finishing times instead of dividing by counter count',()=>{
  const queue=[ticket('a'),ticket('b','long'),ticket('c')];assert.equal(estimate(target('other'),queue,[desk(),desk('two')]).estimatedMinutes,16);
 });
 await check('different busy-counter workloads choose the earliest real opportunity',()=>{
  const busy1=ticket('busy1','longest',{status:'in_service',counterId:'one',serviceStartedAt:iso(now-10*60000)}),busy2=ticket('busy2','withdraw',{status:'in_service',counterId:'two',serviceStartedAt:iso(now-3*60000)});
  const counters=[desk('one',{status:'serving',currentTicketId:'busy1'}),desk('two',{status:'serving',currentTicketId:'busy2'})];
  assert.equal(estimate(target(),[busy1,busy2,ticket('ahead','long')],counters).estimatedMinutes,20);
 });
 await check('idle counters with unrelated specialties do not shorten the wait',()=>{
  const busy=ticket('busy','long',{status:'in_service',counterId:'one',serviceStartedAt:iso(now)});
  assert.equal(estimate(target(),[busy],[desk('one',{status:'serving',currentTicketId:'busy'}),desk('two',{assignedCategoryIds:['advice']})]).estimatedMinutes,20);
 });
 await check('an idle eligible counter allows an immediate call even while another is busy',()=>{
  const busy=ticket('busy','long',{status:'in_service',counterId:'one',serviceStartedAt:iso(now)});
  assert.equal(estimate(target(),[busy],[desk('one',{status:'serving',currentTicketId:'busy'}),desk('two')]).estimatedMinutes,0);
 });
 await check('unknown operations ahead use a stable fallback independent of the chosen operation',()=>{
  assert.equal(estimate(target(),[ticket('unknown','missing')]).estimatedMinutes,10);assert.equal(estimate(target('longest'),[ticket('unknown','missing')]).estimatedMinutes,10);
 });
 await check('called customers retain their full service workload until treatment starts',()=>{
  const called=ticket('busy','withdraw',{status:'called',counterId:'one',calledAt:iso(now-60000)});
  assert.equal(estimate(target(),[called],[desk('one',{status:'calling',currentTicketId:'busy'})]).estimatedMinutes,8);
 });
 await check('overrunning services retain a positive remaining estimate',()=>{
  const busy=ticket('busy','withdraw',{status:'in_service',counterId:'one',serviceStartedAt:iso(now-20*60000)});
  assert.equal(estimate(target(),[busy],[desk('one',{status:'serving',currentTicketId:'busy'})]).estimatedMinutes,1);
 });
 await check('closed and paused counters produce unavailable rather than immediate estimates',()=>{
  for(const status of ['closed','paused'])assert.equal(estimate(target(),[ticket('ahead')],[desk('one',{status})]).estimatedMinutes,null);
 });
 await check('priority and specialization rules are shared with the actual call policy',()=>{
  assert.equal(estimate(target('other',{priority:'pmr'}),[ticket('old')]).estimatedMinutes,0);
  assert.equal(estimate(target(),[],[desk('one',{assignedCategoryIds:['advice']})]).estimatedMinutes,null);
  const relaxed=rules();relaxed.find(r=>r.code==='R-05').enabled=false;assert.equal(estimate(target(),[],[desk('one',{assignedCategoryIds:['advice']})],relaxed).estimatedMinutes,0);
 });
 await check('configured overflow can make an otherwise ineligible counter available',()=>{
  const policy=rules(),overflow=policy.find(r=>r.code==='R-07');overflow.enabled=true;overflow.parameters.congestionThreshold.value=3;
  assert.equal(estimate(target('other',{priority:'pmr'}),[ticket('a'),ticket('b')],[desk('one',{assignedCategoryIds:['advice']})],policy).estimatedMinutes,0);
 });
 await check('other agencies and unconfirmed tickets do not consume local counter workload',()=>{
  const queue=[ticket('other-agency','long',{agencyId:'hydra'}),ticket('remote','long',{status:'pending_presence'})];assert.equal(estimate(target(),queue).estimatedMinutes,0);
 });
 await check('pending-presence projections match check-in without changing queue state',()=>{
  const queue=[ticket('ahead')],counters=[desk()],before=JSON.stringify({queue,counters}),pending=target('other',{status:'pending_presence',confirmedAt:null});
  assert.equal(estimate(pending,queue,counters).estimatedMinutes,estimate({...pending,status:'waiting',confirmedAt:iso(now)},queue,counters).estimatedMinutes);assert.equal(JSON.stringify({queue,counters}),before);
 });
 await check('server snapshots use canonical workload even when another device has a stale preview',async()=>{
  const {server,a,b}=await oneCounter();await a.create();assert.equal(b.q.getServiceEstimate(b.cat.id,b.op.id).estimatedMinutes,0);
  const second=await b.create();assert.equal(second.initialEstimatedMinutes,a.op.estimatedMinutes);assert.equal(second.initialPeopleAhead,1);
  const log=(await server.get()).logs.find(l=>l.ticketId===second.id&&l.action==='TICKET_CREATED');
  assert.equal(log.predictedWaitMinutes,a.op.estimatedMinutes);assert.equal(log.estimateComputedAt,iso(server.clock.now));assert.equal(log.estimateBasis,'queue_entry');assert.equal(log.details.waitEstimate.estimatedMinutes,a.op.estimatedMinutes);
 });
 await check('client-supplied predictions cannot forge the persisted audit estimate',async()=>{
  const {server,a}=await oneCounter();const result=await server.command('ag-alger-centre','create',{ticket:{id:'forged',agencyId:'ag-alger-centre',categoryId:a.cat.id,subOperationId:a.op.id,status:'waiting',priority:'standard',initialEstimatedMinutes:999,initialPeopleAhead:999,arrivalEstimatedMinutes:999,arrivalEstimateComputedAt:'2030-01-01T00:00:00Z'}});
  assert.equal(result.status,200);assert.equal(result.data.ticket.initialEstimatedMinutes,0);assert.equal(result.data.ticket.arrivalEstimateComputedAt,undefined);assert.equal(result.data.logs[0].predictedWaitMinutes,0);
 });
 await check('check-in saves a new estimate while preserving the original projected audit entry',async()=>{
  const {server,a}=await oneCounter();const remote=await a.create('standard','Remote',undefined,null,undefined,'client');const issuance=a.q.getLogs().find(l=>l.ticketId===remote.id&&l.action==='TICKET_CREATED');assert.equal(issuance.predictedWaitMinutes,0);assert.equal(issuance.estimateBasis,'presence_projection');
  await a.create();server.clock.now+=1000;await arrive(a,remote);
  const state=await server.get(),arrival=state.logs.find(l=>l.ticketId===remote.id&&l.action==='ARRIVAL_CONFIRMED'),old=state.logs.find(l=>l.id===issuance.id);
  assert.equal(arrival.predictedWaitMinutes,a.op.estimatedMinutes);assert.equal(arrival.estimateBasis,'check_in');assert.equal(arrival.estimateComputedAt,iso(server.clock.now));assert.equal(old.predictedWaitMinutes,0);assert.equal(old.estimateComputedAt,issuance.estimateComputedAt);
  const saved=state.tickets.find(t=>t.id===remote.id);assert.equal(saved.initialEstimatedMinutes,0);assert.equal(saved.arrivalEstimatedMinutes,a.op.estimatedMinutes);
 });
 await check('call and completion logs compare real wait with the saved check-in estimate',async()=>{
  const {server,a}=await oneCounter();const remote=await a.create('standard','Remote',undefined,null,undefined,'client');await a.create();server.clock.now+=1000;await arrive(a,remote);
  await a.q.callNext(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);server.clock.now+=120000;await a.q.callNext(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);
  const event=a.q.getLogs().find(l=>l.ticketId===remote.id&&l.action==='TICKET_COMPLETED');assert.equal(event.realWaitMinutes,2);assert.equal(event.predictedWaitMinutes,a.op.estimatedMinutes);assert.equal(event.waitDeltaMinutes,2-a.op.estimatedMinutes);assert.equal(event.estimateBasis,'check_in');
 });
 await check('computed predictions and their timestamps survive server restart',async()=>{
  const {server,a}=await oneCounter();await a.create();const second=await a.create(),restarted=makeServer(server.readCache());const state=await restarted.get();
  assert.equal(state.tickets.find(t=>t.id===second.id).initialEstimatedMinutes,a.op.estimatedMinutes);assert.equal(state.logs.find(l=>l.ticketId===second.id&&l.action==='TICKET_CREATED').estimateComputedAt,second.initialEstimateComputedAt);
 });
 await check('unavailable and immediate estimates remain distinct in saved audit data and exports',async()=>{
  const closed=await oneCounter(true);const unavailable=await closed.a.create();const log=closed.a.q.getLogs().find(l=>l.ticketId===unavailable.id);assert.equal(log.predictedWaitMinutes,null);assert.equal(unavailable.initialEstimatedMinutes,null);
  const csv=closed.a.q.exportLogs('csv');assert(csv.includes('"Indisponible";"'+log.estimateComputedAt+'";"queue_entry"'));assert(csv.includes('Date Calcul Estimation'));
  const open=await oneCounter();const immediate=await open.a.create();assert.equal(immediate.initialEstimatedMinutes,0);assert(open.a.q.exportLogs('csv').includes('"0";"'+immediate.initialEstimateComputedAt+'";"queue_entry"'));
 });
 await check('future bookings do not invent a current queue estimate',async()=>{
  const {a}=await oneCounter();const booked=await a.q.bookAppointment(a.cat.id,a.op.id,'2026-10-27','09:00');const log=a.q.getLogs().find(l=>l.ticketId===booked.id&&l.action==='APPOINTMENT_BOOKED');
  assert.equal(booked.initialEstimatedMinutes,undefined);assert.equal(log.predictedWaitMinutes,undefined);assert.equal(log.estimateComputedAt,undefined);
 });
 await check('failed saves cannot publish an estimate or leave an orphan audit event',async()=>{
  const {server,a}=await oneCounter();await a.create();const cache=server.readCache();server.failWrites=true;await assert.rejects(a.create());assert.equal(server.readCache(),cache);
  server.failWrites=false;const next=await a.create();assert.equal(next.initialEstimatedMinutes,a.op.estimatedMinutes);assert.equal(a.q.getLogs().filter(l=>l.ticketId===next.id&&l.action==='TICKET_CREATED').length,1);
 });
 console.log(checks+' workload-estimate and audit-snapshot checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
