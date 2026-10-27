const assert=require('assert/strict');
const {makeServer,makeClient,drain}=require('./harness.cjs');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 await check('legacy snapshots are rejected instead of overwriting authoritative state',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();const result=await s.request('POST','ag-alger-centre',{tickets:[],counters:[]});assert.equal(result.status,409);assert.equal((await s.get()).tickets[0].id,ticket.id);
 });
 await check('server restarts retain tickets, audit and counter assignment',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);await a.q.startServing(a.desks[0].id);
  const restored=await makeServer(s.readCache()).get();assert.equal(restored.tickets[0].status,'in_service');assert.equal(restored.counters.find((c)=>c.id===a.desks[0].id).currentTicketId,ticket.id);assert(restored.logs.some((l)=>l.action==='SERVICE_STARTED'));
 });
 await check('old cache data loads without deleting real tickets',async()=>{
  const fixture={tickets:[{id:'legacy',tokenNumber:'C-123',status:'waiting',categoryId:'cat-caisse',subOperationId:'sub-retrait-versement-dzd',priority:'standard',createdAt:'2026-10-26T08:00:00Z',confirmedAt:'2026-10-26T08:00:00Z',customerName:'Legacy'}],counters:[],version:'old'};
  const state=await makeServer(JSON.stringify(fixture)).get();assert.equal(state.tickets[0].tokenNumber,'C-123');assert.equal(state.tickets[0].agencyId,'ag-alger-centre');
 });
 await check('reset generations block commands from stale devices',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create();await a.q.resetQueue();const stale=await s.request('POST','ag-alger-centre',{action:'create',commandId:'stale-command',resetAt:0,ticket});assert.equal(stale.status,409);assert.equal((await s.get()).tickets.length,0);
 });
 await check('reset affects only the selected agency',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s,{agency:'ag-hydra'});await drain();await a.create();await b.create();await a.q.resetQueue();assert.equal((await s.get()).tickets.length,0);assert.equal((await s.get('ag-hydra')).tickets.length,1);
 });
 await check('the same command ID cannot call another ticket or duplicate an audit event',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.create();await a.create();const body={action:'callNext',commandId:'retry-call',resetAt:0,counterId:a.desks[0].id,expectedTicketId:null};
  const first=await s.request('POST','ag-alger-centre',body),second=await s.request('POST','ag-alger-centre',body);assert.equal(first.data.ticket.id,second.data.ticket.id);assert.equal((await s.get()).logs.filter((l)=>l.action==='TICKET_CALLED').length,1);
 });
 await check('simultaneous creation receives unique agency-specific numbers',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();const tickets=await Promise.all([a.create(),b.create()]);assert.notEqual(tickets[0].tokenNumber,tickets[1].tokenNumber);assert.equal((await s.get()).tickets.length,2);
 });
 await check('server rejects invalid booking input even when the form is bypassed',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket={id:'invalid-booking',agencyId:'ag-alger-centre',categoryId:a.cat.id,subOperationId:a.op.id,status:'booked',priority:'standard',appointmentDate:'2026-02-31',appointmentTime:'99:99'};
  const result=await s.command('ag-alger-centre','create',{ticket});assert.equal(result.status,400);assert.equal((await s.get()).tickets.length,0);
 });
 await check('server requires its agency-specific presence token',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s,{agency:'ag-hydra'});await drain();const ticket=await a.create('standard','Mobile',undefined,null,undefined,'client');const wrong=await b.q.getKioskPresenceToken();await assert.rejects(a.q.confirmArrival(ticket.id,wrong),/QR/);assert.equal((await s.get()).tickets[0].status,'pending_presence');
 });
 await check('a failed clear or reset preserves existing data',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();await a.create();const cache=s.readCache();s.failWrites=true;await assert.rejects(a.q.clearLogs(),/Enregistrement/);await assert.rejects(a.q.resetQueue(),/Enregistrement/);assert.equal(s.readCache(),cache);assert.equal((await s.get()).tickets.length,1);
 });
 await check('unstarted service does not invent five minutes of treatment',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const first=await a.create();await a.create();await a.q.callNext(a.desks[0].id);await a.q.callNext(a.desks[0].id);assert.equal(first.status,'completed');assert.equal(first.serviceDurationMinutes,0);
 });
 await check('server keeps VIP weighting and strict PMR head-of-line',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const old=await a.create();s.clock.now+=30*60000;await a.create('vip');const access=await a.create('pmr');assert.equal((await a.q.callNext(a.desks[0].id)).id,access.id);await a.q.completeTicket(a.desks[0].id);assert.equal((await a.q.callNext(a.desks[0].id)).id,old.id);
 });
 console.log(checks+' API regression checks passed');
})().catch((error)=>{console.error(error);process.exitCode=1});
