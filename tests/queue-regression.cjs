const assert=require('assert/strict');
const {makeServer,makeClient,drain,arrive}=require('./harness.cjs');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 const server=makeServer(),a=makeClient(server);await drain();
 await check('fresh queue has no tickets or fabricated events',()=>{assert.equal(a.q.getState().tickets.length,0);assert.equal(a.q.getLogs().length,0)});
 const first=await a.create('standard','N'.repeat(394)),pmr=await a.create('pmr','PMR');
 await check('name length is enforced by store and API',async()=>{assert.equal(first.customerName.length,80);assert.equal((await server.get()).tickets[0].customerName.length,80)});
 await check('priority list and estimates agree',()=>{assert.equal(a.q.getState().tickets[0].id,pmr.id);assert.equal(a.q.getTicketEstimate(first).peopleAhead,1)});
 const called=await a.q.callNext(a.desks[0].id);
 await check('calling connects exactly one ticket to its counter',()=>{assert.equal(called.id,pmr.id);assert.equal(a.q.getState().counters.find((c)=>c.id===a.desks[0].id).currentTicketId,pmr.id)});
 const mobile=await a.create('vip','Mobile',undefined,null,undefined,'client');
 await check('mobile tickets require presence',()=>{assert.equal(mobile.status,'pending_presence');assert(!a.q.evaluateTicketScores().some((r)=>r.ticket.id===mobile.id))});
 await check('unproven presence is rejected by the API',async()=>{await assert.rejects(a.q.confirmArrival(mobile.id),/QR/);assert.equal(mobile.status,'pending_presence')});
 await a.q.startServing(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);
 await check('completed tickets cannot re-enter the queue',async()=>assert.equal(await arrive(a,pmr),null));
 const feedback={ratingWaitTime:1,ratingService:1,ratingStaff:1,overallSatisfaction:1,comment:'<script>test</script>'};
 await check('feedback is recorded once and survives reload',async()=>{
  assert.equal(await a.q.submitFeedback(pmr.id,feedback),true);assert.equal(await a.q.submitFeedback(pmr.id,{...feedback,ratingService:5}),false);
  a.q.loadFromStorage();await a.poll();assert.equal(a.q.getState().tickets.find((t)=>t.id===pmr.id).feedback.overallSatisfaction,1);
  assert.equal(a.q.getLogs().filter((l)=>l.action==='FEEDBACK_SUBMITTED').length,1);
 });
 await arrive(a,mobile);
 await check('proven mobile presence joins the ranked queue',()=>assert(a.q.evaluateTicketScores().some((r)=>r.ticket.id===mobile.id)));
 a.cfg.selectAgency('ag-hydra');await drain();
 await check('Hydra has separate tickets, counters, history and audit logs',()=>{const s=a.q.getState();assert.equal(s.tickets.length,0);assert.equal(s.logs.length,0);assert.equal(s.recentCalledHistory.length,0);assert(s.counters.every((c)=>!c.currentTicketId))});
 const hydra=await a.create();assert.equal(hydra.tokenNumber,first.tokenNumber);
 a.cfg.selectAgency('ag-alger-centre');await drain();
 await check('switching back restores only the original agency',()=>{assert(a.q.getState().tickets.some((t)=>t.id===first.id));assert(!a.q.getState().tickets.some((t)=>t.id===hydra.id))});
 await check('portal creation has client attribution',()=>assert.equal(a.q.getLogs().find((l)=>l.ticketId===mobile.id&&l.action==='TICKET_CREATED').actor.role,'client'));
 await check('preview never creates a ticket',()=>{const n=a.q.getState().tickets.length;a.q.getServiceEstimate(a.cat.id,a.op.id);assert.equal(a.q.getState().tickets.length,n)});
 for(const time of ['2026-10-26T20:30:00Z','2026-10-30T10:00:00Z']){
  const s=makeServer(),c=makeClient(s,{now:time});await drain();const kiosk=await c.create(),remote=await c.create('standard','Mobile',undefined,null,undefined,'client');await arrive(c,remote);
  await check('tickets and presence remain available at '+time,()=>{assert.equal(kiosk.status,'waiting');assert.equal(remote.status,'waiting')});
 }
 const s=makeServer(),p=makeClient(s);await drain();await p.create();await p.create();const pending=await p.create('standard','Mobile',undefined,null,undefined,'client');const estimate=p.q.getTicketEstimate(pending);
 await check('pending projection counts people ahead without activating the ticket',()=>{assert.equal(estimate.peopleAhead,2);assert(estimate.estimatedMinutes>0);assert(!p.q.evaluateTicketScores().some((r)=>r.ticket.id===pending.id))});
 await arrive(p,pending);
 await check('stable pre-presence projection matches actual arrival',()=>assert.deepEqual(p.q.getTicketEstimate(pending),estimate));
 const policyServer=makeServer(),policy=makeClient(policyServer);await drain();const old=await policy.create();policyServer.clock.now+=30*60000;const vip=await policy.create('vip');
 await check('VIP is weighted and older SLA tickets may rank higher',()=>{assert.equal(policy.q.evaluateTicketScores()[0].ticket.id,old.id);assert(policy.q.evaluateTicketScores().find((r)=>r.ticket.id===vip.id).vipBonus>0)});
 policyServer.clock.now+=1000*60000;const access=await policy.create('pmr');
 await check('configured PMR head-of-line is absolute',()=>assert.equal(policy.q.evaluateTicketScores()[0].ticket.id,access.id));
 await check('feedback before completion is rejected',async()=>assert.equal(await p.q.submitFeedback(pending.id,feedback),false));
 console.log(checks+' queue regression checks passed');
})().catch((error)=>{console.error(error);process.exitCode=1});
