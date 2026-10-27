const fs=require('fs'),vm=require('vm'),path=require('path'),{EventEmitter}=require('events');
const root=path.resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const bundle=(contents)=>esbuild.buildSync({stdin:{contents,resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const queueCode=bundle("export {calledTicketsNewestFirst,callTime,isLiveCall,noShowPolicy} from './src/services/callLifecycle';export {queueStore} from './src/services/queueStore';export {configService} from './src/services/configService';export {kioskPresenceToken,bookingError,matchesClientTicket} from './src/utils/queueValidation';");
const apiCode=bundle("export {createQueueApi} from './server/queueApi';");
function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}}
function clock(){const c={now:Date.parse('2026-10-26T10:00:00Z')};c.Date=class extends Date{constructor(...args){super(...(args.length?args:[c.now]))}static now(){return c.now}};return c;}
async function drain(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}
function makeServer(initial=null){
 const c=clock(),module={exports:{}};vm.runInNewContext(apiCode,{module,require,console,Date:c.Date,URL,URLSearchParams});
 let cache=initial;const server={clock:c,failWrites:false,writes:0,readCache:()=>cache};
 const api=module.exports.createQueueApi({read:()=>cache,write:(value)=>{if(server.failWrites)throw Error('disk full');cache=value;server.writes++},now:()=>c.now,id:()=>`srv-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`});
 server.sweep=api.sweep;
 server.request=(method,agency,body)=>new Promise(resolve=>{
  const request=new EventEmitter();request.url='/api/queue-state?agency='+encodeURIComponent(agency);request.method=method;
  const response={statusCode:200,setHeader(){},end(text){resolve({status:this.statusCode,data:text?JSON.parse(text):null})}};
  api(request,response,()=>resolve({status:404}));if(method==='POST'){request.emit('data',Buffer.from(JSON.stringify(body)));request.emit('end')}
 });
 server.get=async(agency='ag-alger-centre')=>(await server.request('GET',agency)).data;
 server.command=async(agency,action,payload={})=>server.request('POST',agency,{action,commandId:'test-'+Math.random().toString(36).slice(2),resetAt:(await server.get(agency)).resetAt,...payload});
 return server;
}
function makeClient(server,{agency='ag-alger-centre',now}={}){
 if(now)server.clock.now=Date.parse(now);
 const controls={holdAllocation:false,releaseAllocation:null,failStatus:0};
 const localStorage=storage(),sessionStorage=storage(),location={href:'https://example.test/?agency='+agency,origin:'https://example.test',search:'?agency='+agency,hostname:'example.test',host:'example.test',pathname:'/',protocol:'https:',port:''};
 const fetch=async(url,options={})=>{
  if(!String(url).startsWith('/api/queue-state'))return {ok:false,status:404,json:async()=>({error:'not found'})};
  if(controls.failStatus)return {ok:false,status:controls.failStatus,json:async()=>({error:'Server unavailable'})};
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;
  const response=await server.request(method,new URL(url,'https://example.test').searchParams.get('agency'),body);
  const wrapped={ok:response.status>=200&&response.status<300,status:response.status,json:async()=>response.data};
  if(method==='POST'&&body?.action==='create'&&controls.holdAllocation){controls.holdAllocation=false;return new Promise(resolve=>controls.releaseAllocation=()=>resolve(wrapped))}
  return wrapped;
 };
 const context={module:{exports:{}},console,localStorage,sessionStorage,URL,URLSearchParams,Date:server.clock.Date,Math,Set,Map,JSON,setInterval:()=>0,setTimeout:()=>0,clearInterval(){},clearTimeout(){},fetch,window:{location,addEventListener(){},removeEventListener(){},history:{replaceState(a,b,url){location.href=String(url);location.search=new URL(url).search}}}};
 vm.runInNewContext(queueCode,context);
 const {queueStore:q,configService:cfg,kioskPresenceToken,bookingError,matchesClientTicket,calledTicketsNewestFirst,callTime,isLiveCall,noShowPolicy}=context.module.exports;
 const cat=cfg.getConfig().categories[0],op=cat.subOperations[0],desks=cfg.getConfig().counters.filter((d)=>d.assignedCategoryIds.includes(cat.id));
 return {q,cfg,cat,op,desks,controls,context,kioskPresenceToken,bookingError,matchesClientTicket,calledTicketsNewestFirst,callTime,isLiveCall,noShowPolicy,create:(...args)=>q.createTicket(cat.id,op.id,...args),poll:()=>q.fetchServerState()};
}
async function arrive(client,ticket){const proof=await client.q.getKioskPresenceToken();return client.q.confirmArrival(ticket.id,proof);}
module.exports={makeServer,makeClient,drain,arrive,root};
