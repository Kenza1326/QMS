const assert=require('assert/strict');
const {makeServer,makeClient,drain,arrive}=require('./harness.cjs');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 await check('two devices cannot reserve the same appointment slot',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();
  const out=await Promise.allSettled([a.q.bookAppointment(a.cat.id,a.op.id,'2026-10-27','09:00'),b.q.bookAppointment(b.cat.id,b.op.id,'2026-10-27','09:00')]);
  assert.equal(out.filter((r)=>r.status==='fulfilled').length,1);assert.equal((await s.get()).tickets.length,1);
 });
 await check('two tellers cannot claim the same customer',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();await a.create();await b.poll();
  const calls=await Promise.all([a.q.callNext(a.desks[0].id),b.q.callNext(b.desks[1].id)]);
  assert.equal(calls.filter(Boolean).length,1);assert.equal((await s.get()).counters.filter((c)=>c.currentTicketId).length,1);
 });
 await check('concurrent tellers select distinct customers when two are waiting',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();await a.create();await a.create();await b.poll();
  const calls=await Promise.all([a.q.callNext(a.desks[0].id),b.q.callNext(b.desks[1].id)]);assert(calls.every(Boolean));assert.notEqual(calls[0].id,calls[1].id);
 });
 await check('a delayed allocation cannot restore a ticket after reset',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();a.controls.holdAllocation=true;const pending=a.create();await drain();s.clock.now+=1000;await a.q.resetQueue('Test');a.controls.releaseAllocation();await assert.rejects(pending,/changé/);
  assert.equal((await s.get()).tickets.length,0);assert.equal(a.q.getState().tickets.length,0);
 });
 await check('deleted audit events do not return through another device',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();const ticket=await a.create();await b.poll();await a.q.clearLogs();await b.poll();await a.poll();
  assert(!a.q.getLogs().some((l)=>l.ticketId===ticket.id));assert(!b.q.getLogs().some((l)=>l.ticketId===ticket.id));assert.equal(a.q.getLogs()[0].action,'LOGS_CLEARED');
 });
 await check('disabled R-08 preserves the current customer',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const first=await a.create();await a.create();await a.q.callNext(a.desks[0].id);a.cfg.toggleRule('rule-08-auto-complete',false);
  await assert.rejects(a.q.callNext(a.desks[0].id),/auto-clôture/);assert.equal(first.status,'called');assert.equal((await s.get()).tickets.filter((t)=>t.status==='completed').length,0);
  a.cfg.toggleRule('rule-08-auto-complete',true);a.cfg.updateRuleParameter('rule-08-auto-complete','autoCompletePrevious',false);await assert.rejects(a.q.callNext(a.desks[0].id),/auto-clôture/);
 });
 await check('a stale cancellation cannot rewrite a completed ticket',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();const ticket=await a.create();await b.poll();await a.q.callNext(a.desks[0].id);await a.q.startServing(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);
  assert.equal(await b.q.cancelTicket(ticket.id),false);assert.equal((await s.get()).tickets[0].status,'completed');
 });
 await check('repeated service start preserves timestamp and one event',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);await b.poll();await a.q.startServing(a.desks[0].id);const start=ticket.serviceStartedAt;s.clock.now+=180000;
  await b.q.startServing(b.desks[0].id);await a.poll();assert.equal(ticket.serviceStartedAt,start);assert.equal(a.q.getLogs().filter((l)=>l.action==='SERVICE_STARTED').length,1);
 });
 await check('HTTP 500 fails without creating an unshared local ticket',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();a.controls.failStatus=500;await assert.rejects(a.create(),/Server unavailable/);assert.equal(a.q.getState().tickets.length,0);assert.equal((await s.get()).tickets.length,0);
  a.controls.failStatus=0;await a.create();assert.equal((await s.get()).tickets.length,1);
 });
 await check('failed saving does not commit memory or disk',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();s.failWrites=true;await assert.rejects(a.create(),/Enregistrement impossible/);assert.equal(s.writes,0);assert.equal((await s.get()).tickets.length,0);
  s.failWrites=false;await a.create();assert.equal((await s.get()).tickets.length,1);assert.equal((await makeServer(s.readCache()).get()).tickets.length,1);
 });
 await check('closed counters yield unavailable instead of immediate service',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();for(const c of a.q.counters)c.status='closed';assert.equal(a.q.getServiceEstimate(a.cat.id,a.op.id).estimatedMinutes,null);
 });
 await check('invalid dates, impossible slots and past bookings are rejected',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();for(const [date,time] of [['2026-02-31','09:00'],['2026-10-27','99:99'],['2026-10-25','09:00'],['2026-10-26','09:00']])await assert.rejects(a.q.bookAppointment(a.cat.id,a.op.id,date,time));assert.equal((await s.get()).tickets.length,0);
 });
 await check('unrelated, wrong-agency and wrong-origin QRs are rejected',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create('standard','Mobile',undefined,null,undefined,'client');
  for(const code of ['not-a-qr','https://unrelated.example/?action=confirm-presence&agency=ag-alger-centre&kiosk=ag-alger-centre&proof=12345678901234567890','https://example.test/?action=confirm-presence&agency=ag-hydra&kiosk=ag-hydra&proof=12345678901234567890'])assert.throws(()=>a.kioskPresenceToken(code,'ag-alger-centre',['https://example.test']));
  await assert.rejects(a.q.confirmArrival(ticket.id,'12345678901234567890'),/QR/);assert.equal(ticket.status,'pending_presence');
  const proof=await a.q.getKioskPresenceToken(),code='https://example.test/?action=confirm-presence&agency=ag-alger-centre&kiosk=ag-alger-centre&proof='+proof;
  await a.q.confirmArrival(ticket.id,a.kioskPresenceToken(code,'ag-alger-centre',['https://example.test']));assert.equal(ticket.status,'waiting');
 });
 await check('presence proofs are invalidated by reset',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();const old=await a.q.getKioskPresenceToken();await a.q.resetQueue();const ticket=await a.create('standard','Mobile',undefined,null,undefined,'client');await assert.rejects(a.q.confirmArrival(ticket.id,old),/QR/);const next=await a.q.getKioskPresenceToken();assert.notEqual(next,old);await a.q.confirmArrival(ticket.id,next);
 });
 await check('agency change during allocation cannot contaminate another queue',async()=>{
  const s=makeServer(),a=makeClient(s);await drain();a.controls.holdAllocation=true;const pending=a.create();await drain();a.cfg.selectAgency('ag-hydra');await drain();a.controls.releaseAllocation();await assert.rejects(pending,/changé/);assert.equal(a.q.getState().tickets.length,0);assert.equal((await s.get()).tickets.length,1);
 });
 await check('concurrent feedback creates one review and one event',async()=>{
  const s=makeServer(),a=makeClient(s),b=makeClient(s);await drain();const ticket=await a.create();await a.q.callNext(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);await b.poll();
  const f={ratingWaitTime:1,ratingService:1,ratingStaff:1,overallSatisfaction:1};const out=await Promise.all([a.q.submitFeedback(ticket.id,f),b.q.submitFeedback(ticket.id,{...f,ratingStaff:5})]);assert.equal(out.filter(Boolean).length,1);assert.equal((await s.get()).logs.filter((l)=>l.action==='FEEDBACK_SUBMITTED').length,1);
 });
 console.log(checks+' concurrency and failure regression checks passed');
})().catch((error)=>{console.error(error);process.exitCode=1});
