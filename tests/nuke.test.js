const fs=require('fs');
const src=['sim1.js','roads.js','layout.js','traffic.js','terrain.js','sim2.js','sim3.js','sim4.js','sim5.js','sim6.js','sim7.js','sim8.js','sim9.js','sim10.js','sim11.js','sim12.js','sim13.js','sim14.js','sim15.js','sim16.js','sim17.js','sim18.js', 'sim19.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','src',f),'utf8')).join('\n');
const stub=`let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function fxNuke(){}function onBanner(t){}
function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ''} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
new Function(stub+src+`
settings.threats=false; const _g=genCity; genCity=()=>_g('grid'); newCitySim(900); setupScenario('sandbox', agents[0]);
const t0=Date.now();
for(let i=0;i<20*600;i++){ step(.05);
  if(i===20*20) { launchNuke(W/2, H/2); }
  if(i%(20*60)===0){ const st={}; for(const b of buildings) st[b.state]=(st[b.state]||0)+1; const c=counts(); console.log((simT|0)+'s', JSON.stringify(c), JSON.stringify(st), 'topple', buildings.filter(b=>b.topple).length, 'rubble', grid.filter(v=>v===8).length, 'loaders', machines.length, 'tow', cars.filter(c=>c.service==='tow'&&!c.gone).length, 'wrecks', cars.filter(c=>c.wreck&&!c.gone).length, 'repair', cars.filter(c=>c.service==='repair'&&!c.gone).length, 'workers', agents.filter(a=>a.role==='worker'&&a.state==='alive').length, 'fires', fires.length); }
}
console.log('ms', Date.now()-t0); console.log(events.slice(0,10).map(e=>(e.t|0)+' '+e.text).join(' | '));
`)();
