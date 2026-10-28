const assert=require('assert/strict'),vm=require('vm'),path=require('path');
const {makeServer,drain}=require('./harness.cjs'),root=path.resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const code=esbuild.buildSync({stdin:{contents:"export {capturePhoneQueueState,estimatePhoneTicket,refreshPhoneQueueOnResume} from './src/services/phoneQueueState';export {DEFAULT_QUEUE_CONFIG} from './src/config/defaultQueueConfig';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const m={exports:{}};vm.runInNewContext(code,{module:m,require,console,Date});const x=m.exports,cfg={...x.DEFAULT_QUEUE_CONFIG,rules:x.DEFAULT_QUEUE_CONFIG.rules.map(r=>({...r,enabled:r.code==='R-13'?false:r.enabled}))},category=cfg.categories[0],op=category.subOperations[0],firstDesk=cfg.counters.find(c=>c.assignedCategoryIds.includes(category.id)),now=Date.parse('2026-10-26T10:00:00Z'),iso=n=>new Date(n).toISOString();
const ticket=(id,extras={})=>({id,tokenNumber:id,categoryId:category.id,subOperationId:op.id,subOperationName:op.labelFr,priority:'standard',status:'waiting',createdAt:iso(now-120000),confirmedAt:iso(now-120000),agencyId:cfg.selectedAgencyId,...extras});
const counters=()=>cfg.counters.map(c=>({...c,status:c.id===firstDesk.id?'idle':'closed',currentTicketId:null}));
const state=(tickets,desks=counters())=>({tickets,counters:desks,logs:[],recentCalledHistory:[],lastCalledTicket:null,syncStatus:'online',rules:cfg.rules.map(r=>({...r,enabled:r.code==='R-13'?false:r.enabled}))});
function events(){const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';return {window,document,emit:(target,event)=>target.dispatchEvent(new Event(event))};}
async function fixture(){const server=makeServer(JSON.stringify(state([])));const create=async(id,priority='standard')=>(await server.command(cfg.selectedAgencyId,'create',{ticket:ticket(id,{status:'pending_presence',priority})})).data.ticket;const arrive=async id=>{const proof=(await server.command(cfg.selectedAgencyId,'presenceToken')).data.presenceToken;return server.command(cfg.selectedAgencyId,'confirmArrival',{ticketId:id,presenceToken:proof})};return {server,create,arrive};}
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 await check('phone snapshots cannot be changed by later mutable-store updates',()=>{
  const original=state([ticket('a',{kycDossier:{status:'not_started'}})]),snap=x.capturePhoneQueueState(original,now);original.tickets[0].status='cancelled';original.tickets[0].kycDossier.status='completed';original.counters[0].assignedCategoryIds.push('other');
  assert.equal(snap.tickets[0].status,'waiting');assert.equal(snap.tickets[0].kycDossier.status,'not_started');assert(!snap.counters[0].assignedCategoryIds.includes('other'));
 });
 await check('estimates use the latest confirmed ticket rather than a stale pre-presence copy',()=>{
  const current=ticket('a'),newer=ticket('b',{createdAt:iso(now-60000),confirmedAt:iso(now-60000)}),stale={...current,status:'pending_presence',confirmedAt:null};
  const result=x.estimatePhoneTicket(stale,x.capturePhoneQueueState(state([current,newer]),now),cfg);assert.equal(result.peopleAhead,0);assert.equal(result.estimatedMinutes,0);
 });
 await check('another kiosk check-in refreshes the projected phone position and waiting time together',async()=>{
  const f=await fixture(),a=await f.create('a'),b=await f.create('b');const before=x.estimatePhoneTicket(a,x.capturePhoneQueueState(await f.server.get(),f.server.clock.now),cfg);assert.equal(before.peopleAhead,0);assert.equal(before.estimatedMinutes,0);
  f.server.clock.now+=1000;await f.arrive(b.id);const after=x.estimatePhoneTicket(a,x.capturePhoneQueueState(await f.server.get(),f.server.clock.now),cfg);assert.equal(after.peopleAhead,1);assert.equal(after.estimatedMinutes,op.estimatedMinutes);
 });
 await check('priority check-in refreshes the waiting phone even when its own ticket has not changed',async()=>{
  const f=await fixture(),a=await f.create('a');await f.arrive(a.id);const cached=(await f.server.get()).tickets[0];const c=await f.create('priority','pmr');f.server.clock.now+=1000;await f.arrive(c.id);
  const after=x.estimatePhoneTicket(cached,x.capturePhoneQueueState(await f.server.get(),f.server.clock.now),cfg);assert.equal(after.peopleAhead,1);assert.equal(after.estimatedMinutes,op.estimatedMinutes);
 });
 await check('phone estimates account for elapsed service time on each observed update',()=>{
  const busy=ticket('busy',{status:'in_service',counterId:firstDesk.id,serviceStartedAt:iso(now)}),a=ticket('a',{createdAt:iso(now),confirmedAt:iso(now)}),desks=counters().map(c=>c.id===firstDesk.id?{...c,status:'serving',currentTicketId:busy.id}:c),queue=state([busy,a],desks);
  assert.equal(x.estimatePhoneTicket(a,x.capturePhoneQueueState(queue,now),cfg).estimatedMinutes,op.estimatedMinutes);assert.equal(x.estimatePhoneTicket(a,x.capturePhoneQueueState(queue,now+60000),cfg).estimatedMinutes,Math.max(1,op.estimatedMinutes-1));
 });
 await check('focus, restored pages and reconnection each request a fresh phone queue',async()=>{
  const e=events();let calls=0;const stop=x.refreshPhoneQueueOnResume(async()=>{calls++},e.window,e.document);for(const event of ['focus','pageshow','online']){e.emit(e.window,event);await drain()}assert.equal(calls,3);stop();
 });
 await check('background events wait for the phone to become visible before refreshing',async()=>{
  const e=events();let calls=0;e.document.visibilityState='hidden';const stop=x.refreshPhoneQueueOnResume(async()=>{calls++},e.window,e.document);e.emit(e.window,'focus');e.emit(e.document,'visibilitychange');await drain();assert.equal(calls,0);e.document.visibilityState='visible';e.emit(e.document,'visibilitychange');await drain();assert.equal(calls,1);stop();
 });
 await check('simultaneous resume events share one in-flight refresh',async()=>{
  const e=events();let calls=0,release;const stop=x.refreshPhoneQueueOnResume(()=>{calls++;return new Promise(r=>release=r)},e.window,e.document);e.emit(e.window,'focus');e.emit(e.window,'pageshow');e.emit(e.window,'online');assert.equal(calls,1);release();await drain();stop();
 });
 await check('resuming starts a fresh fetch even while an older background request is pending',async()=>{
  const e=events(),releases=[];let calls=0;const stop=x.refreshPhoneQueueOnResume(()=>{calls++;return new Promise(resolve=>releases.push(resolve))},e.window,e.document);
  e.emit(e.window,'focus');assert.equal(calls,1);e.document.visibilityState='hidden';e.emit(e.document,'visibilitychange');e.document.visibilityState='visible';e.emit(e.document,'visibilitychange');assert.equal(calls,2);
  releases[0]();await drain();e.emit(e.window,'focus');assert.equal(calls,2);e.emit(e.window,'offline');e.emit(e.window,'online');assert.equal(calls,3);releases[1]();releases[2]();await drain();stop();
 });
 await check('leaving the phone screen removes its refresh listeners',async()=>{
  const e=events();let calls=0;const stop=x.refreshPhoneQueueOnResume(async()=>{calls++},e.window,e.document);stop();e.emit(e.window,'focus');e.emit(e.window,'online');e.emit(e.document,'visibilitychange');await drain();assert.equal(calls,0);
 });
 await check('a failed resume refresh can retry when the phone reconnects',async()=>{
  const e=events();let calls=0;const stop=x.refreshPhoneQueueOnResume(async()=>{if(++calls===1)throw Error('offline')},e.window,e.document);e.emit(e.window,'focus');await drain();e.emit(e.window,'online');await drain();assert.equal(calls,2);stop();
 });
 console.log(checks+' phone live-estimate checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
