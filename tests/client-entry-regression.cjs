const vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
(async()=>{
const code=(await esbuild.build({stdin:{contents:"export {authService} from './src/services/authService';export {resolveAppRoute} from './src/utils/appRoute';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'isolate-auth-audit',setup(build){build.onResolve({filter:/queueStore$/},()=>({path:'audit-stub',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const queueStore={addLog:()=>{}}',loader:'js'}));}}]})).outputFiles[0].text;
const key='agb_queue_auth_session_v1';let checks=0;
function storage(seed={}){const data=new Map(Object.entries(seed));return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
function load(search='',local=storage(),session=storage()){
 const m={exports:{}};vm.runInNewContext(code,{module:m,require,console,Date,URLSearchParams,localStorage:local,sessionStorage:session,window:{location:{search}}});return {...m.exports,local,session};
}
function check(name,fn){fn();checks++;console.log('PASS '+name)}
check('new visits and unrecognized routes open the client portal',()=>{
 const {resolveAppRoute:route}=load();for(const search of ['', '?agency=ag-hydra','?mode=invalid','?ticket=C-001'])assert.equal(route(search).mode,'client');
});
check('explicit hub, kiosk, TV and staff links still resolve, including the dashboard alias',()=>{
 const {resolveAppRoute:route}=load();for(const mode of ['hub','kiosk','screen','client','admin'])assert.equal(route('?mode='+mode).mode,mode);
 assert.equal(route('?mode=dashboard').mode,'admin');assert.equal(route('?mode=dashboard').adminSubView,'dashboard');assert.equal(route('?mode=admin&view=dashboard').adminSubView,'dashboard');
});
check('fresh sessions start as Client even on a direct admin link',()=>{
 for(const mode of ['', '?mode=admin','?mode=dashboard']){const a=load(mode);assert.equal(a.authService.getCurrentUser().role,'client');assert.equal(a.authService.isModeAllowed('admin','dashboard'),false)}
});
check('legacy shared admin sessions cannot elevate a new visitor',()=>{
 const local=storage({[key]:JSON.stringify({user:{id:'user-admin',username:'admin'}})}),a=load('',local);
 assert.equal(a.authService.getCurrentUser().role,'client');assert.equal(local.getItem(key),null);
});
check('staff access requires a correct PIN and stays in session storage',()=>{
 const a=load();assert.equal(a.authService.login('admin').success,false);assert.equal(a.authService.login('admin','0000').success,false);assert.equal(a.authService.getCurrentUser().role,'client');
 assert.equal(a.authService.login('admin','9999').success,true);assert.equal(a.authService.getCurrentUser().role,'admin');assert.equal(a.local.getItem(key),null);assert.equal(JSON.parse(a.session.getItem(key)).user.role,'admin');
});
check('another tab starts as Client after staff signs in',()=>{
 const a=load();a.authService.login('admin','9999');const b=load('?mode=admin',a.local);assert.equal(b.authService.getCurrentUser().role,'client');assert.equal(a.authService.getCurrentUser().role,'admin');
});
check('an explicitly opened staff screen retains the PIN session on refresh',()=>{
 const a=load();a.authService.login('admin','9999');const b=load('?mode=admin&view=dashboard',a.local,a.session);assert.equal(b.authService.getCurrentUser().role,'admin');
});
check('returning to the default URL resets a saved tab session to Client',()=>{
 const a=load();a.authService.login('admin','9999');const b=load('',a.local,a.session);assert.equal(b.authService.getCurrentUser().role,'client');
});
check('logout clears staff access in the current tab',()=>{
 const a=load();a.authService.login('admin','9999');a.authService.logout();assert.equal(a.authService.getCurrentUser().role,'client');assert.equal(JSON.parse(a.session.getItem(key)).user.role,'client');
});
check('incorrect PIN messages never disclose credential values or recovery hints',()=>{
 const a=load();for(const account of ['admin','guichet1','guichet2','guichet3','guichet4']){const result=a.authService.login(account,'0000');assert.equal(result.success,false);assert.equal(result.error,'Code PIN incorrect. Veuillez vérifier votre code.');assert(!/\d{4}|master/i.test(result.error))}
});
console.log(checks+' client-entry and profile checks passed');

})().catch(error=>{console.error(error);process.exitCode=1});
