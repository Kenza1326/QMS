const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..'),esbuild=require(root+'/node_modules/esbuild');
const entry="export {BigScreenDisplay} from './src/components/bigscreen/BigScreenDisplay'; export {AdminDashboard} from './src/components/admin/AdminDashboard'; export {getQueueTrends} from './src/utils/queueMetrics'; export {feedbackRatingError} from './src/utils/queueValidation'; export {DEFAULT_QUEUE_CONFIG} from './src/config/defaultQueueConfig'; export {CounterStation} from './src/components/counter/CounterStation'; export {LandingHub} from './src/components/common/LandingHub'; export {renderToStaticMarkup} from 'react-dom/server'; export {createElement} from 'react';";
const code=esbuild.buildSync({stdin:{contents:entry,resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const moduleObject={exports:{}};
vm.runInNewContext(code,{module:moduleObject,require,console,process,queueMicrotask,setImmediate,clearImmediate,Buffer,TextEncoder,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval,URL,URLSearchParams,ReadableStream});
const x=moduleObject.exports;let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
const now=new Date('2026-10-26T10:00:00Z');
const ticket=(id,date,wait,status='completed')=>({id,createdAt:date,confirmedAt:date,status,waitTimeMinutes:wait});
check('dashboard wait comparison uses yesterday and actual waits',()=>{
 const trends=x.getQueueTrends([ticket('today','2026-10-26T08:00:00Z',4),ticket('yesterday','2026-10-25T08:00:00Z',10)],now);
 assert.equal(trends.waitDeltaMinutes,-6);assert.equal(trends.velocityPerHour,0.5);
});
check('dashboard renders missing comparison and throughput data as unavailable',()=>{
 const trends=x.getQueueTrends([],now);assert.equal(trends.waitDeltaMinutes,null);assert.equal(trends.velocityPerHour,null);
});
check('dashboard throughput responds to completed ticket count',()=>{
 const trends=x.getQueueTrends([ticket('a','2026-10-26T08:00:00Z',4),ticket('b','2026-10-26T09:00:00Z',6)],now);
 assert.equal(trends.velocityPerHour,1);
});
check('empty and partial ratings return actionable validation',()=>{
 assert(x.feedbackRatingError([0,0,0]));assert(x.feedbackRatingError([5,0,5]));assert.equal(x.feedbackRatingError([1,3,5]),null);
});
const source=fs.readFileSync(root+'/src/components/client/ClientWebApp.tsx','utf8');
const start=source.indexOf('  const handleSubmitFeedback =');
const handler=source.slice(start,source.indexOf('  const hasSubmittedFeedback',start));
check('clicking empty feedback displays an error without submitting',()=>{
 let error=null,calls=0;
 const c={myTicket:{id:'empty',status:'completed',feedback:null},feedbackRatingWait:0,feedbackRatingService:0,feedbackRatingStaff:0,feedbackSubmittedRef:{current:false},feedbackRatingError:x.feedbackRatingError,setFeedbackError:value=>error=value,queueStore:{submitFeedback:()=>calls++}};
 vm.createContext(c);vm.runInContext(handler+'\nhandleSubmitFeedback();',c);
 assert.equal(calls,0);assert.match(error,/trois critères/);assert.equal(c.feedbackSubmittedRef.current,false);
});
check('a submitted review cannot re-enter the feedback handler',()=>{
 let calls=0;
 const c={myTicket:{id:'reviewed',status:'completed',feedback:{overallSatisfaction:5}},feedbackSubmittedRef:{current:false},queueStore:{submitFeedback:()=>calls++}};
 vm.createContext(c);vm.runInContext(handler+'\nhandleSubmitFeedback();',c);assert.equal(calls,0);
});
check('rendered counter bounds a legacy 394-character name and preserves its VIP badge',()=>{
 const config=x.DEFAULT_QUEUE_CONFIG,station={...config.counters[0],status:'calling',currentTicketId:'long'};
 const q={tickets:[{id:'long',tokenNumber:'C-001',categoryId:config.categories[0].id,subOperationId:config.categories[0].subOperations[0].id,subOperationName:'Operation',status:'called',priority:'vip',customerName:'N'.repeat(394),createdAt:now.toISOString()}],counters:[station],recentCalledHistory:[],lastCalledTicket:null,logs:[]};
 const html=x.renderToStaticMarkup(x.createElement(x.CounterStation,{config,queueState:q}));
 assert(!html.includes('N'.repeat(81)));assert(html.includes('N'.repeat(80)));assert(html.includes('VIP'));assert(html.includes('overflow-wrap:anywhere'));
});
check('deployment examples include the selected agency for all three public modes',()=>{
 const config={...x.DEFAULT_QUEUE_CONFIG,selectedAgencyId:'ag-hydra'};
 const html=x.renderToStaticMarkup(x.createElement(x.LandingHub,{config,onSelectMode(){},onSelectAgency(){}}));
 for(const mode of ['screen','kiosk','client'])assert(html.includes('?mode='+mode+'&amp;agency=ag-hydra'));
});
check('unconfirmed remote tickets do not start the throughput observation clock',()=>{
 const early=ticket('remote','2026-10-26T01:00:00Z',0,'pending_presence');early.confirmedAt=null;
 const trends=x.getQueueTrends([early,ticket('served','2026-10-26T08:00:00Z',4)],now);
 assert.equal(trends.velocityPerHour,0.5);
});
check('reloading a reviewed ticket restores submitted state and hides feedback eligibility',()=>{
 const start=source.indexOf('  const updateMyTicket =');
 const helper=source.slice(start,source.indexOf('  // Load ticket',start));
 const state={myTicketRef:{current:null},feedbackSubmitted:false,setFeedbackRatingWait(){},setFeedbackRatingStaff(){},setFeedbackRatingService(){},setFeedbackComment(){},setFeedbackError(){},feedbackSubmittedRef:{current:false}};
 state.setFeedbackSubmitted=(value)=>state.feedbackSubmitted=value;
 state.setMyTicket=(value)=>state.myTicket=value;
 state.saved={id:'saved',status:'completed',feedback:{overallSatisfaction:1}};
 vm.createContext(state);vm.runInContext(esbuild.transformSync(helper+'\nupdateMyTicket(saved);',{loader:'ts'}).code,state);
 const eligibility=source.slice(source.indexOf('  const hasSubmittedFeedback ='),source.indexOf('  const estimate ='));
 vm.runInContext(eligibility+'\nglobalThis.eligible=canGiveFeedback;',state);
 assert.equal(state.feedbackSubmitted,true);assert.equal(state.feedbackSubmittedRef.current,true);assert.equal(state.eligible,false);
});
check('TV shows the newest completed call instead of a stale active call, and labels absences',()=>{
 const config=x.DEFAULT_QUEUE_CONFIG;
 const stale={id:'old',tokenNumber:'P-001',status:'noshow',calledAt:'2026-10-26T19:37:00Z',counterName:'Guichet 3',subOperationName:'Retrait'};
 const latest={id:'new',tokenNumber:'C-012',status:'completed',calledAt:'2026-10-26T21:58:00Z',counterName:'Guichet 2',subOperationName:'Compte'};
 const q={tickets:[stale,latest],counters:config.counters,lastCalledTicket:stale,logs:[],recentCalledHistory:[{ticketNumber:'P-001',status:'noshow',calledAt:stale.calledAt}]};
 const html=x.renderToStaticMarkup(x.createElement(x.BigScreenDisplay,{config,queueState:q}));
 assert(html.indexOf('C-012')<html.indexOf('P-001'));assert(html.includes('DERNIER TICKET APPELÉ'));assert(!html.includes('APPEL EN COURS'));assert(html.includes('Service terminé'));assert(html.includes('Absent'));
});
check('dashboard displays waiting, called and actually serving counts separately',()=>{
 const config=x.DEFAULT_QUEUE_CONFIG,createdAt=new Date().toISOString();
 const q={tickets:['waiting','called','called','in_service'].map((status,i)=>({id:String(i),tokenNumber:'T-'+i,status,createdAt,categoryId:config.categories[0].id})),counters:config.counters,lastCalledTicket:null,recentCalledHistory:[],logs:[]};
 const html=x.renderToStaticMarkup(x.createElement(x.AdminDashboard,{config,queueState:q,onUpdateConfig(){},onSwitchBrand(){}}));
 assert(html.includes('1 en attente • 2 appelé(s) • 1 en service'));
});
console.log(checks+' portal and metrics checks passed');


