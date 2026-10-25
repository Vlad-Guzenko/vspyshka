// цепочка «обрушение → экскаваторы и самосвалы → площадка чистая → строители → дом» и снос выгоревшего остова
// node tests/clearing.test.js [планировка] [секунд]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});`;
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(300); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
const apts = buildings.filter(b => b.state === 'ok' && b.kind === 'apt' && b.floors >= 5), A = apts[0], B = apts[1], C = apts[2];
// B выгорел до основания — снос; C выгорел, но каркас крепкий — ремонт
collapse(A); B.hp = B.maxHp * .2; gutBuilding(B); C.hp = C.maxHp * .4; gutBuilding(C);
const ev = [], seen = new Set(), mark = (k, t) => { if (!seen.has(k)) { seen.add(k); ev.push((simT | 0) + 's ' + t); } };
let maxLoad = 0, full = false;
for (let i = 0; i < 20 * (+process.argv[3] || 1100); i++) {
  step(.05);
  const lA = machines.filter(m => m.job && m.job.ruin === A), lB = machines.find(m => m.job && (m.job.demo === B || m.job.ruin === B));
  for (const c of cars) if (c.service === 'dump' && !c.gone) { maxLoad = Math.max(maxLoad, c.load || 0); if (c.leaving && c.load >= DUMP_CAP) full = true; }
  if (lA.length) mark('lA', 'A: выехали экскаваторы: ' + lA.length);
  if (lA.some(m => Math.hypot(m.x - (A.x0 + A.x1) / 2, m.y - (A.y0 + A.y1) / 2) < 70)) mark('lAat', 'A: экскаватор у завала');
  if (A.siteCells) mark('Af', 'A: площадку огородили');
  if (A.clearedT) mark('Acl', 'A: завал вывезен, клеток завала ' + ruinRubble(A));
  if (A.state === 'construct') mark('Acon', 'A: стройка началась, завала ' + ruinRubble(A) + ', техники у дома ' + lA.length);
  if (A.state === 'ok' && A.rebuilt) mark('Aok', 'A: дом построен, забор снят=' + !A.siteCells);
  if (lB) mark('lB', 'B: экскаватор выехал на снос');
  if (B.state === 'collapsing' || B.state === 'ruin') mark('Bdown', 'B: остов снесён, завала ' + ruinRubble(B));
  if (B.clearedT) mark('Bcl', 'B: завал вывезен');
  if (B.state === 'construct') mark('Bcon', 'B: стройка началась');
  if (B.state === 'ok' && B.rebuilt) mark('Bok', 'B: дом построен');
  if (C.state === 'construct') mark('Crep', 'C: остов ремонтируют, без сноса');
  if (C.state === 'collapsing' || C.state === 'ruin') mark('Cdemo', 'C: крепкий остов снесли — ошибка');
}
console.log(layoutKey, 'A', A.floors, 'этажей | B', B.floors, 'этажей');
for (const e of ev) console.log(e);
const ok = seen.has('Acl') && seen.has('Acon') && seen.has('Bdown') && seen.has('Crep') && !seen.has('Cdemo') && full && !seen.has('bad');
console.log('полных рейсов', full ? 'да' : 'нет', 'maxLoad', maxLoad, 'техники осталось', machines.length, 'самосвалов', cars.filter(c => c.service === 'dump' && !c.gone).length, ok ? 'OK' : 'FAIL');
process.exitCode = ok ? 0 : 1;
`;
new Function('process', stub + src + body)(process);
