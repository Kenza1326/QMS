const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {makeServer,makeClient,drain,root}=require('./harness.cjs');
const esbuild=require(root+'/node_modules/esbuild');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 const s=makeServer(),a=makeClient(s);await drain();const ticket=await a.create('standard','Visitor',undefined,null,undefined,'client');
 const source=fs.readFileSync(root+'/src/components/client/ClientWebApp.tsx','utf8');
 const start=source.indexOf('  const handleConfirmArrival ='),handler=source.slice(start,source.indexOf('  useEffect(',start));
 const errors=[];let closed=0,attempt=0;
 const c={myTicketRef:{current:ticket},queueStore:a.q,config:a.cfg.getConfig(),kioskPresenceToken:a.kioskPresenceToken,window:{location:{origin:'https://example.test'}},getPublicUrl:()=> 'https://example.test/?mode=client',URL,notifications:{error:message=>errors.push(message)},updateMyTicket(value){c.myTicketRef.current=value},setView(){},setConfirmationSuccessMsg(){},setTimeout(){},onClose(){closed++},setAttempt(fn){attempt=fn(attempt)}};
 vm.createContext(c);vm.runInContext(esbuild.transformSync(handler,{loader:'ts'}).code,c);c.onSuccess=vm.runInContext('handleConfirmArrival',c);
 const modal=fs.readFileSync(root+'/src/components/client/QrScannerModal.tsx','utf8');
 const body=modal.match(/onScan=\{async \(code\) => \{([\s\S]*?)\}\}/)[1];
 const scan=vm.runInContext('(async (code)=>{'+body+'})',c);
 await check('actual scanner callback rejects unrelated QR data and stays open',async()=>{
  await scan('https://unrelated.example/not-a-kiosk');assert.equal(ticket.status,'pending_presence');assert.equal(closed,0);assert.equal(attempt,1);assert(errors.length>0);
 });
 const proof=await a.q.getKioskPresenceToken(),code='https://example.test/?mode=client&action=confirm-presence&agency=ag-alger-centre&kiosk=ag-alger-centre&proof='+proof;
 await check('actual scanner callback accepts the current kiosk proof',async()=>{
  await scan(code);assert.equal(ticket.status,'waiting');assert.equal(closed,1);
 });
 await check('valid presence is idempotent and preserves arrival time',async()=>{
  const first=ticket.confirmedAt;s.clock.now+=60000;await scan(code);assert.equal(ticket.confirmedAt,first);
 });
 await check('presence cannot reopen a completed ticket through the actual handler',async()=>{
  await a.q.callNext(a.desks[0].id);await a.q.completeTicket(a.desks[0].id);const count=closed;await scan(code);assert.equal(ticket.status,'completed');assert.equal(closed,count);
 });
 await check('native alert, confirm and prompt dialogs remain absent',()=>{
  const path=require('path');function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(/\.tsx?$/.test(file))assert(!/(?:window\.)?\b(?:alert|confirm|prompt)\s*\(/.test(fs.readFileSync(file,'utf8')),file)}}visit(root+'/src');
 });
 await check('a reused ticket number cannot attach an old portal to a new customer',async()=>{
  const server=makeServer(),owner=makeClient(server),portal=makeClient(server);await drain();
  const old=await owner.create();await portal.poll();
  portal.context.localStorage.setItem('agb_active_client_ticket:ag-alger-centre',old.tokenNumber);
  portal.context.localStorage.setItem('agb_active_client_ticket:ag-alger-centre:id',old.id);
  server.clock.now+=1000;await owner.q.resetQueue();const replacement=await owner.create();await portal.poll();
  assert.equal(replacement.tokenNumber,old.tokenNumber);assert.notEqual(replacement.id,old.id);
  assert.equal(portal.context.localStorage.getItem('agb_active_client_ticket:ag-alger-centre'),null);
  assert.equal(portal.matchesClientTicket(replacement,old.tokenNumber,old.id),false);
  assert.equal(portal.matchesClientTicket(replacement,old.tokenNumber,null,old.createdAt),false);
  assert.equal(portal.matchesClientTicket(replacement,replacement.tokenNumber,replacement.id),true);
 });
 await check('legacy active tracking migrates to the cached unique ticket identity',async()=>{
  const server=makeServer(),client=makeClient(server);await drain();const ticket=await client.create();
  client.context.localStorage.setItem('agb_active_client_ticket:ag-alger-centre',ticket.tokenNumber);
  client.context.localStorage.removeItem('agb_active_client_ticket:ag-alger-centre:id');client.q.loadFromStorage();
  assert.equal(client.context.localStorage.getItem('agb_active_client_ticket:ag-alger-centre:id'),ticket.id);
 });
 console.log(checks+' presence and UI interaction checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
