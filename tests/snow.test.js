// снег на дорогах: куча из нескольких кликов закрывает улицу, снегоуборщик её расчищает, зимой снег не тает сам;
// засыпанного человека откапывают спасатели, у огня он вытаивает обмороженным, засыпанный зомби замерзает
// node tests/snow.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13, season:"winter"}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(400); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
for (let i = 0; i < 20 * 20; i++) step(.05);
const es = RE.filter(e => !e.rural && !e.dead && e.len > 140 && e.L.filter(Boolean).length === 2 && e.pts.length === 2);
const e = es[Math.floor(es.length / 2)], mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
for (let k = 0; k < 4; k++) pourSnow(mx, my, 2.4, 22);
let maxD = 0; for (const i of snowCells) maxD = Math.max(maxD, snowD[i]);
console.log('куча: клеток', snowCells.size, 'глубина до', maxD.toFixed(1));
let shutT = -1, openT = -1, slow = 0; const t0 = simT;
for (let i = 0; i < 20 * 900; i++) {
  const s0 = Date.now(); step(.05); const ms = Date.now() - s0; if (ms > 200) { slow++; if (slow < 4) console.log('медленный шаг', ms, 'мс на', (simT - t0) | 0, 'с'); }
  if (shutT < 0 && e.closed) shutT = simT - t0;
  if (shutT >= 0 && openT < 0 && !e.closed && !e.narrow) { openT = simT - t0; break; }
  if (i % (20 * 60) === 0) console.log(((simT - t0) | 0) + 's', e.closed ? 'закрыта' : e.narrow ? 'сужена' : 'открыта', 'уборщики', cars.filter(c => c.service === 'plow' && !c.gone).map(c => c.plowPass + (c.plowIn ? 'на улице' : '')).join(','));
}
console.log('закрылась через', shutT | 0, 'с, расчищена через', openT | 0, 'с');
// засыпанные: человек (откопают), человек у костра (вытает обмороженным), зомби (замёрзнет)
const pickFree = (role, far) => agents.find(a => a.role === role && a.state === 'alive' && !a.hidden && !a.unit && !a.bitten && (!far || Math.hypot(a.x - far.x, a.y - far.y) > 300));
const h1 = pickFree('civ'); h1.post = { x: h1.x, y: h1.y }; pourSnow(h1.x, h1.y, 3, 14); h1.post = null;
const h2 = pickFree('civ', h1); h2.post = { x: h2.x, y: h2.y }; pourSnow(h2.x, h2.y, 3, 14); h2.post = null; startFire(h2.x + 34, h2.y); // огонь рядом, но не по человеку: снег тает быстро
let z = pickFree('zombie'); if (!z) { z = newAgent('zombie', h1.x + 400, h1.y); } z.post = { x: z.x, y: z.y }; pourSnow(z.x, z.y, 6, 16); pourSnow(z.x, z.y, 6, 16); z.post = null;
console.log('засыпаны:', h1.buried, h2.buried, z.buried);
const st = a => a.state !== 'alive' ? (a.frozen ? 'замёрз' : 'погиб') : a.buried ? 'засыпан ' + (a.cold || 0).toFixed(2) : a.frost ? 'обморожен hp' + (a.hp | 0) + (a.ambAssigned ? ', скорая' : '') : 'цел';
for (let i = 0; i < 20 * 240; i++) { step(.05); if (i % (20 * 30) === 0) console.log(((i / 20) | 0) + 's', 'откапывают:', st(h1), '| у огня:', st(h2), '| зомби:', st(z), '| спасателей', cars.filter(c => c.job && c.job.dig && !c.gone).length); }
console.log('итог:', st(h1), '|', st(h2), '|', st(z));
console.log(shutT >= 0 && openT > 0 && h1.state === 'alive' && !h1.frost && !h2.frozen && z.state !== 'alive' ? 'OK' : 'FAIL');
`;
new Function('process', stub + src + body)(process);
