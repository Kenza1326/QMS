const fs=require('fs'),vm=require('vm'),http=require('http'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const source=esbuild.buildSync({stdin:{contents:"export {createQueueApi} from './server/queueApi';export {DEFAULT_QUEUE_CONFIG} from './src/config/defaultQueueConfig';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const m={exports:{}};vm.runInNewContext(source,{module:m,require,URL,console,Date});
const {createQueueApi,DEFAULT_QUEUE_CONFIG:cfg}=m.exports;
let saved=null,fail=false,count=0;
const middleware=createQueueApi({read:()=>null,write:value=>{if(fail)throw Error('simulated disk failure');saved=JSON.parse(value)},id:()=> 'http-id-'+(++count)});
const server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end()}));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/queue-state?agency=smoke';
 const category=cfg.categories[0],op=category.subOperations[0];
 const create=id=>({action:'create',commandId:'command-'+id,resetAt:0,ticket:{id,categoryId:category.id,subOperationId:op.id,status:'waiting',priority:'standard',agencyId:'smoke',customerName:'HTTP smoke'}});
 const post=async body=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 const created=await Promise.all([post(create('a')),post(create('b'))]);assert(created.every(r=>r.status===200));assert.notEqual(created[0].data.ticket.tokenNumber,created[1].data.ticket.tokenNumber);assert.equal(saved.agencies.smoke.tickets.length,2);console.log('PASS real HTTP concurrent issuance and durable acknowledgment');
 fail=true;const broken=await post(create('c'));assert.equal(broken.status,503);const state=await (await fetch(url)).json();assert.equal(state.tickets.length,2);console.log('PASS real HTTP failed-save response and state rollback');
 fail=false;const legacy=await post({tickets:[]});assert.equal(legacy.status,409);console.log('PASS real HTTP rejection of legacy snapshot writes');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
