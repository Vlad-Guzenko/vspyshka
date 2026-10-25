const fs=require('fs');
const src=['sim1.js','roads.js','layout.js','traffic.js','terrain.js','sim2.js','sim3.js','sim4.js','sim5.js','sim6.js','sim7.js','sim8.js','sim9.js','sim10.js','sim11.js','sim12.js','sim13.js','sim14.js','sim15.js','sim16.js','sim17.js','sim18.js', 'sim19.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..','src',f),'utf8')).join('\n');
const stub=`let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){}
let RES=null;function onResult(w,t){RES=[w,t]} function onRadio(){} const world={hour:13,target:13,cycle:false}; function hourLabel(){return ''} function mmss(t){return t|0} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
new Function('process',stub+src+`
const key=process.argv[2]; const lay=SCENARIOS[key].layout||'grid';
const _g=genCity; genCity=()=>_g(lay); const p0=newCitySim(900); setupScenario(key,p0);
for(let i=0;i<20*(+process.argv[3]||120);i++){ step(.05); if(world.cycle) world.hour+=0.05*(world.rate||0); if(RES) break; }
const c=counts(); console.log(key, (simT|0)+'s', JSON.stringify(c), 'saved',saved,'res',JSON.stringify(RES), scenarioHud().slice(0,80));
`)(process);
