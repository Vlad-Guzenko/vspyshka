// ловушки, КПП, фракции, штаб, инфраструктура, санитары: node tests/world2.test.js [layout]
const fs=require('fs');
const src=['sim1.js','roads.js','layout.js','layout2.js','traffic.js','terrain.js','sim2.js','sim3.js','sim4.js','sim5.js','sim6.js','sim7.js','sim8.js','sim9.js','sim10.js','sim11.js','sim12.js','sim13.js','sim14.js','sim15.js','sim16.js','sim17.js','sim18.js', 'sim19.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','src',f),'utf8')).join('\n');
const stub=`let dn=0;function addDecal(){return dn++}function setDecal(){}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){console.log("BANNER",t)} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
new Function('process',stub+src+`
const layout=process.argv[2]||'grid';
settings.fast=true; settings.threats=false; const _g=genCity; genCity=()=>_g(layout);
newCitySim(900);
const log=(...a)=>console.log((simT|0)+'s',...a);
log('infra', Object.keys(INFRA).map(k=>k+':'+(special[k]?special[k].b.kind:'-')).join(' '));
const cx=W/2, cy=H/2;
// ловушки у центра
const [mx,my]=freeNear(cx+30,cy,20); console.log('mine',addMine(mx,my));
const [bx,by]=freeNear(cx-40,cy+20,20); console.log('barrels',addBarrels(bx,by));
console.log('wire',addWire(cx-20,cy-30,cx+20,cy-30));
const [gx,gy]=freeNear(cx,cy+60,20); console.log('gen',addGen(gx,gy));
// электрозабор: линия клеток
let ef=0; for(let x=cx-40;x<=cx+40;x+=CS){const gi=Math.floor((cy+40)/CS)*GW+Math.floor(x/CS); if([0,1,2,7].includes(grid[gi])){grid[gi]=6;bhp[gi]=60;elecMask[gi]=1;ef++;}} barrDirty=true; fieldT=0; console.log('efence cells',ef);
console.log('cp',addCheckpoint(cx+120,cy));
console.log('gather',broadcastGather(cx,cy),'danger',broadcastDanger(cx-200,cy-200),'home',broadcastHome());
for(let k=0;k<8;k++){const z=newAgent('zombie',cx+rnd(-60,60),cy-80+rnd(-30,30)); turn(z); z.riseT=0;}
let errs=0;
for(let i=0;i<20*330;i++){
  try{step(0.05);}catch(e){errs++; if(errs<3)console.log('ERR',simT|0,e.stack.slice(0,400));}
  if(i===20*60){ if(special.power){const b=special.power.b; b.state='ruin'; log('power plant ruined ->', 'blackout', !!blackout);} }
  if(i===20*150){ if(special.power){special.power.b.state='ok';} if(special.radio){special.radio.b.state='ruin';} log('radio ruined');}
  if(i===20*200){ log('gather w/o radio', broadcastGather(cx,cy)); if(special.radio) special.radio.b.state='ok'; }
  if(i===20*240){ const f=factions.find(f=>f.kind==='commune'); log('commune?', !!f, f?f.members.length:0); if(f) supplyFaction(f); hqRep(1,'test'); hqRep(1,'test'); }
  if(i===20*300){ hqRep(-1,'test'); hqRep(-1,'test'); hqRep(-1,'test'); hqRep(-1,'test'); log('withdrawn', hq.withdrawnT, agents.filter(a=>a.withdraw).length); }
  if(i%(20*60)===0){const c=counts();log(JSON.stringify(c),'traps',traps.map(t=>t.k).join(','),'gens',gens.map(g=>g.fuel|0).join(','),'cps',cps.map(c=>'q'+c.queue+'/chk'+c.checked+'/det'+c.detained+(c.broken?'/broken':'')).join(' '),'fac',factions.map(f=>f.kind+f.members.length).join(','),'rep',hq.rep,'day',dayN,'dead',agents.filter(a=>a.state==='dead').length,'removed',agents.filter(a=>a.removed).length,'sanit',cars.filter(c=>c.service==='sanit'&&!c.gone).length,'noWater',settings.noWater,'noRadio',settings.noRadio,'dangers',dangers.length);}
}
console.log('errors',errs,'nan',agents.filter(a=>isNaN(a.x)).length);
console.log(events.filter(e=>/мин|растяж|бочк|Генератор|КПП|коммун|Коммун|Доверие|Санитар|Банда|станци|вышк|Оповещ|Слух|Радио|током|Штаб/i.test(e.text)).slice(0,40).map(e=>(e.t|0)+' '+e.text).join(' || '));
`)(process);
