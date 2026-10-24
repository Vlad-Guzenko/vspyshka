const fs=require('fs');
const src=['sim1.js','roads.js','layout.js','traffic.js','terrain.js','sim2.js','sim3.js','sim4.js','sim5.js','sim6.js','sim7.js','sim8.js','sim9.js','sim10.js','sim11.js','sim12.js','sim13.js','sim14.js','sim15.js','sim16.js','sim17.js','sim18.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','src',f),'utf8')).join('\n');
const stub=`let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){console.log("BANNER",t)} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
new Function('process',stub+src+`
const [mode, layout] = [process.argv[2]||'base', process.argv[3]||'random'];
settings.fast = mode!=='slow';
const _g=genCity; genCity=()=>_g(layout);
newCitySim(900);
console.log('layout',layoutKey,'blocks',blocks.length,'b',buildings.length,'cars',cars.length,'moving',cars.filter(c=>c.moving).length,'lanes',RL.length,'nodes',RN.length,'waters',waters.length,'bridges',bridges.length);
if(mode==='tank'){const z=agents[5];addTank(...freeNear(W/2,H/2,40));}
const t0=Date.now();
for(let i=0;i<20*(+process.argv[4]||300);i++){step(0.05);
  if(i===20*60 && mode==='strike'){const b=buildings.find(b=>b.kind==='tower')||buildings[0];strikes.push({x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2,t:3});}
  if(i===20*120&&mode==='tank'){for(let k=0;k<3;k++)addTank(...freeNear(W/2,H/2,60));}
  if(i%(20*60)===0){const c=counts();console.log((simT|0)+"s",JSON.stringify(c),"svc",JSON.stringify(Object.fromEntries(Object.keys(SERVICE).map(k=>[k,cars.filter(x=>x.service===k&&!x.gone).length]))),"crew",agents.filter(a=>a.unit&&a.state==="alive").length,'zk',zkills,'moving',cars.filter(c=>c.moving).length,'abandoned',cars.filter(c=>c.stopped).length,'ruins',buildings.filter(b=>b.state!=='ok').length);} }
console.log('ms',Date.now()-t0);
let inside=0;for(const a of agents)if(a.state==='alive'&&blocked(a.x,a.y))inside++;console.log('inside',inside, 'nan', agents.filter(a=>isNaN(a.x)).length, cars.filter(c=>isNaN(c.x)).length);
console.log(events.slice(0,14).map(e=>(e.t|0)+' '+e.text).join(' | '));
`)(process);
