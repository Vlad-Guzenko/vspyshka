// службы второй волны: автобус, приёмный покой, патруль, коммунальщики, снабжение, гнёзда, объезды, гидранты
// node tests/services2.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});`;
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(400); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
const ev = [], seen = new Set(), mark = (k, t) => { if (!seen.has(k)) { seen.add(k); ev.push((simT | 0) + 's ' + t); } };
console.log(layoutKey, 'гидрантов', hydrants.length, 'больница', !!hospitalB(), 'участок', !!(special.police && special.police.b));
// укрытие с людьми, зомби у подъезда (чтобы не разошлись), лагерь — для автобуса
const sh = buildings.filter(b => b.door && b.kind === 'apt' && b.state === 'ok').sort((a, b) => (b.cap || 0) - (a.cap || 0))[0];
for (let i = 0; i < 16; i++) { const a = agents.find(a => a.role === 'civ' && a.state === 'alive' && !a.hidden); enterShelter(a, sh); }
sh.food = 0; sh.hungryT = 60; const shel = sh.occ.slice();
{ const [zx, zy] = freeNear(sh.door[0] + 70, sh.door[1], 20); const z = newAgent('zombie', zx, zy); turn(z); z.riseT = 1e9; z.hp = 1e9; z.zhp = 1e9; }
let camp = null; for (let k = 0; k < 40 && !camp; k++) { const [fx, fy] = freeNear(rnd(300, W - 300), rnd(200, H - 200), 30); if (!blocked(fx, fy) && addCamp(fx, fy)) camp = camps[camps.length - 1]; }
// раненые у больницы, тревога для снабжения, выгоревший дом для гнезда, завал у улицы для объезда, утро для коммунальщиков
const hb = hospitalB(), wounded = agents.filter(a => a.role === 'civ' && a.state === 'alive' && !a.hidden).slice(0, 3); for (const w of wounded) { w.hp = 30; const [x, y] = freeNear(hb.door[0] + 40, hb.door[1] + 20, 20); w.x = x; w.y = y; }
alert = 2; alertT = simT;
const gb = buildings.filter(b => b.kind === 'apt' && b.state === 'ok' && b !== sh && b.floors >= 4)[3]; gutBuilding(gb);
// для объезда нужен дом у самой проезжей части: берём тот, до чьих стен дорога ближе всего
const roadD = b => { let d = 1e9; for (let y = b.y0 - 24; y < b.y1 + 24; y += CS) for (let x = b.x0 - 24; x < b.x1 + 24; x += CS) { const gi = Math.floor(y / CS) * GW + Math.floor(x / CS); if (roadMask[gi] === 1) d = Math.min(d, Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1))); } return d; };
const rb = buildings.filter(b => b.kind === 'apt' && b.state === 'ok' && b !== sh && b !== gb && b.floors >= 6).sort((a, b) => roadD(a) - roadD(b))[0]; collapse(rb);
world.hour = 7; let patrol = null;
for (let i = 0; i < 20 * 700; i++) {
  step(.05); settings.curfew = true;
  // люди держатся в укрытии, пока не приедет автобус (он может задержаться в пробке)
  if (i < 20 * 220 && i % 10 === 0) for (const o of shel) if (!o.hidden && !o.busGoal && !o.onBus && o.state === 'alive' && !sh.occ.includes(o)) { o.homeGoal = false; o.dest = null; enterShelter(o, sh); }
  if (i === 20 * 200) world.hour = 10;
  if (i === 20 * 300) { alert = 0; alertT = simT; }
  const bus = cars.find(c => c.service === 'bus' && !c.gone);
  if (bus) mark('bus', 'автобус выехал к укрытию'); if (bus && bus.deployed && bus.phase === 'to') mark('busstop', 'автобус у подъезда, садятся');
  if (bus && bus.passengers && bus.passengers.length >= 8) mark('busfull', 'в автобусе ' + bus.passengers.length + ' чел.');
  if (bus && bus.phase === 'go' && bus.moving) mark('busgo', 'автобус поехал в лагерь');
  if (camp && camp.n >= 8) mark('camp', 'в лагере ' + camp.n + ' человек');
  if (wounded.some(w => w.onBus)) mark('inamb', 'раненый в скорой');
  if (hb.occ && hb.occ.some(o => o.patient)) mark('intake', 'раненый в приёмном покое, занято коек ' + (hb.patients || 0));
  const p = cars.find(c => c.service === 'police' && c.patrol && !c.gone); if (p) { patrol = p; mark('patrol', 'патруль выехал из участка'); }
  // шум рядом с патрулём — каждые 20 с, пока патруль не поедет (в повороте или на светофоре он может его пропустить)
  if (patrol && i % 400 === 0 && simT > 120 && !seen.has('patrolgo') && !seen.has('patroldep')) { noises.push({ x: patrol.x + 60, y: patrol.y, t: simT, r: 300 }); mark('noise', 'шум рядом с патрулём'); }
  if (patrol && !patrol.patrol && patrol.goal && !patrol.leaving) mark('patrolgo', 'патруль поехал на вызов');
  if (patrol && patrol.deployed) mark('patroldep', 'патруль на месте, полиция вышла');
  for (const t of ['garbage', 'sweeper', 'delivery']) { const c = cars.find(c => c.service === t && !c.gone); if (c) mark(t, SERVICE[t].name + ' выехал'); if (c && c.deployed) mark(t + 'stop', SERVICE[t].name + ': остановка'); }
  const sup = cars.find(c => c.service === 'supply' && !c.gone); if (sup) mark('supply', 'снабжение выехало: ' + sup.job.what);
  for (const c of cars) if (c.service === 'supply' && c.job && c.job.feed && c.leaving && (c.job.feed.food > 50 || (c.job.what === 'gen' && c.job.feed.fuel === c.job.feed.max))) mark('fed', 'снабжение доставлено: ' + c.job.what);
  if (gb.nest) mark('nest', 'в остове завелись зомби');
  if (RE.some(e => e.closed || e.narrow)) mark('closed', 'улица перекрыта или сужена');
  if (seen.has('closed') && !RE.some(e => e.closed || e.narrow)) mark('open', 'улицы снова открыты');
  if (cars.some(c => c.service === 'fire' && c.hydrant)) mark('hydrant', 'пожарные у гидранта');
}
for (const e of ev) console.log(e);
const need = ['busgo', 'intake', 'closed'], miss = need.filter(k => !seen.has(k)); if (!seen.has('patroldep') && !seen.has('patrolgo')) miss.push('patrol');
console.log('коммунальщики:', ['garbage', 'sweeper', 'delivery'].filter(t => seen.has(t)).join('+') || 'нет', '| снабжение', seen.has('fed'), '| гнездо', seen.has('nest'), '| объезд снят', seen.has('open'), miss.length ? 'FAIL: нет ' + miss.join(',') : 'OK');
process.exitCode = miss.length ? 1 : 0;
`;
new Function('process', stub + src + body)(process);
