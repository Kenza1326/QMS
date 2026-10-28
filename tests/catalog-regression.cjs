const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const code=esbuild.buildSync({stdin:{contents:"export {configService} from './src/services/configService';export {completeBankingCatalog} from './src/config/completeBankingCatalog';export {DEFAULT_QUEUE_CONFIG,BANKING_CATEGORIES,CAPTUREDOC_SERVICES_CATEGORIES} from './src/config/defaultQueueConfig';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const key='capturedoc_queue_config_v3',copy=value=>JSON.parse(JSON.stringify(value));
function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}}
function load(saved,publicConfig){const m={exports:{}},local=storage(saved?{[key]:JSON.stringify(saved)}:{});vm.runInNewContext(code,{module:m,require,console,URLSearchParams,localStorage:local,sessionStorage:storage(),window:{location:{search:''},addEventListener(){}},fetch:async()=>({ok:!!publicConfig,json:async()=>({queueConfig:publicConfig})})});return {...m.exports,local};}
const base=load(),bank=copy(base.BANKING_CATEGORIES),legacy=()=>bank.map((c,i)=>({...copy(c),subOperations:c.subOperations.slice(0,[4,2,1,1][i]).map(copy)})),counts=c=>c.map(item=>item.subOperations.length).join('/');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name)}
(async()=>{
 await check('built-in and published banking catalogues contain the same complete operations',()=>{
  const published=JSON.parse(fs.readFileSync(root+'/public/config.json','utf8')).queueConfig.categories;
  assert.deepEqual(bank,published);assert.equal(counts(bank),'4/4/3/3');
 });
 await check('legacy catalogue upgrade is complete, idempotent and leaves its input untouched',()=>{
  const old=legacy(),before=JSON.stringify(old),complete=base.completeBankingCatalog(old);assert.equal(counts(complete),'4/4/3/3');assert.equal(JSON.stringify(old),before);assert.equal(base.completeBankingCatalog(complete),complete);
 });
 await check('cached older browser settings are upgraded and persisted on initialization',async()=>{
  const config=copy(base.DEFAULT_QUEUE_CONFIG);config.categories=legacy();const client=load(config);await client.configService.init();assert.equal(counts(client.configService.getConfig().categories),'4/4/3/3');assert.equal(counts(JSON.parse(client.local.getItem(key)).categories),'4/4/3/3');
  const edited=copy(client.configService.getConfig());edited.categories=legacy();client.configService.saveConfig(edited);assert.equal(counts(client.configService.getConfig().categories),'4/4/3/3');
 });
 await check('upgrades preserve custom operations, categories and configured durations',()=>{
  const old=legacy();old[0].subOperations[0].estimatedMinutes=13;old[0].subOperations.push({...copy(old[0].subOperations[0]),id:'custom-operation'});old.push({...copy(old[0]),id:'custom-category'});
  const complete=base.completeBankingCatalog(old);assert.equal(complete[0].subOperations[0].estimatedMinutes,13);assert(complete[0].subOperations.some(o=>o.id==='custom-operation'));assert(complete.some(c=>c.id==='custom-category'));
 });
 await check('the separate multi-service catalogue keeps its own categories and operations',()=>{
  const services=copy(base.CAPTUREDOC_SERVICES_CATEGORIES);assert.equal(base.completeBankingCatalog(services),services);
 });
 await check('older banking lists also receive missing built-in categories',()=>{
  const complete=base.completeBankingCatalog(legacy().slice(0,2));assert.equal(complete.length,4);assert.equal(counts(complete),'4/4/3/3');
 });
 await check('offline defaults expose every built-in banking operation',async()=>{
  const client=load();await client.configService.init();assert.equal(counts(client.configService.getConfig().categories),'4/4/3/3');
 });
 await check('fresh public configuration loads the same complete catalogue',async()=>{
  const published=JSON.parse(fs.readFileSync(root+'/public/config.json','utf8')).queueConfig,client=load(null,published);await client.configService.init();assert.equal(counts(client.configService.getConfig().categories),'4/4/3/3');
 });
 await check('switching bank branding cannot restore a shortened menu',()=>{
  const client=load();for(const brand of client.DEFAULT_QUEUE_CONFIG.availableBrands.filter(b=>b.id!=='capturedoc-services')){client.configService.switchBrand(brand.id);assert.equal(counts(client.configService.getConfig().categories),'4/4/3/3')}
 });
 await check('the server accepts every operation from the complete built-in catalogue',async()=>{
  const {makeServer}=require('./harness.cjs'),server=makeServer();let issued=0;
  for(const category of bank)for(const operation of category.subOperations){const result=await server.command('ag-alger-centre','create',{ticket:{id:'catalog-'+(++issued),agencyId:'ag-alger-centre',categoryId:category.id,subOperationId:operation.id,status:'waiting',priority:'standard'}});assert.equal(result.status,200);assert.equal(result.data.ticket.subOperationId,operation.id)}assert.equal(issued,14);
 });
 console.log(checks+' operation-catalogue checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
