// Замер трафика без браузера: доля стоящих машин по минутам и причины простоя, цепочки «кто кого ждёт», самые тяжёлые перекрёстки.
// node tests/traffic.test.js [планировка] [секунд] [tripShare] [плотность] [сид]
// Переменная окружения TRACE=<номер машины> печатает её состояние каждые 2 с (с секунды TFROM), EXIT=1 — цепочки только для
// едущих за город. Зомби нет: нулевой пациент не заражён. Стоянка у бордюра, заправка и службы не считаются
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}});`;
const body = `
const [layout, secs, tripShare, density, seed] = [process.argv[2] || 'suburb', +process.argv[3] || 240, process.argv[4] !== undefined && process.argv[4] !== '' ? +process.argv[4] : TRAFFIC_TUNE.tripShare, +process.argv[5] || 1, +process.argv[6] || 1];
// свой генератор случайных чисел с сидом: один и тот же город и поток от прогона к прогону
let sd = seed >>> 0 || 1; Math.random = () => { sd += 0x6D2B79F5; let t = sd; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
settings.fast = true; TRAFFIC_TUNE.tripShare = tripShare; TRAFFIC_TUNE.density = density;
const _g = genCity; genCity = () => _g(layout);
const p0 = newCitySim(900); p0.bitten = false; p0.zero = false;
const civ = c => c.moving && !c.gone && !c.service && !c.park && !c.gas;
// причина простоя машины: повторяет проверки stepTurnCar / stepRoadCar / canEnter в том же порядке и возвращает [причина, кого ждёт]
function why(c) {
  if (c.jamS > 0 || c.jam) return [(c.turn ? 'turn' : 'lane') + ':jam', null]; // упёрлась в чужой кузов (sim16.js)
  if (c.turn) {
    const T = c.turn, p = plPos(T.pts, T.cum, T.u), m = T.to;
    if (c.yieldTo && simT < c.yieldUntil && !c.yieldTo.gone) return ['turn:yieldTo', c.yieldTo];
    const A = scanAhead(c, c.x, c.y, p.tx, p.ty, null);
    if (A.clear < 13.5) return [A.ahead ? (A.ahead.turn ? 'turn:aheadTurn' : 'turn:aheadLane') : 'turn:people', A.ahead];
    if (nextLaneGap(c, m, laneStart(m) - (T.len - T.u)) < 13) return ['turn:nextLaneGap', gapCar(c, m)];
    if (peopleOnArc(c) < 13) return ['turn:peopleOnArc', null];
    if (zebraStopTurn(c, 1e9) < 13) return ['turn:zebra', null];
    return ['turn:other', null];
  }
  const l = c.lane, sE = laneEnd(l), p = lanePos(l, c.s), A = scanAhead(c, c.x, c.y, p.tx, p.ty, l);
  for (let k = 10; k < 40; k += 6) { const q = lanePos(l, Math.min(c.s + k, l.e.len)), cc = cellAt(q.x + q.ty * (c.latOff || 0), q.y - q.tx * (c.latOff || 0)); if (cc === 5 && !c.over && k - 6 < 13) return ['lane:cell5', null]; if ((cc === 3 || cc === 4 || cc === 6 || cc === 8 || cc === 9) && k < 13) return ['lane:cell' + cc, null]; }
  if (A.clear < 13.5) return [A.ahead ? (A.ahead.turn ? 'lane:aheadTurn' : A.ahead.lane === l ? 'lane:queue' : 'lane:aheadOther') : 'lane:people', A.ahead];
  if (zebraStop(c, l, 1e9) < 13) return ['lane:zebra', null];
  // у стоп-линии: причину отказа сообщает сам canEnter (enterWhy, enterBy)
  if (!l.to.exit && sE - c.s < Math.max(34, c.v * c.v / 45 + 18) && (!c.next || !canEnter(c, l, c.next))) {
    if (!c.next) return ['line:noNext', null];
    return ['line:' + enterWhy, enterBy || (enterWhy === 'nextLaneGap' ? gapCar(c, c.next) : null)];
  }
  return ['lane:other', null];
}
// ближайшая машина в очереди на следующей полосе (та, по которой nextLaneGap считает место)
function gapCar(c, m) {
  const sv = laneStart(m), p = lanePos(m, sv + 22), myL = 10 * (c.len || 1) + 3; let gap = 1e9, who = null;
  nearCars(p.x, p.y, 50, o => { if (o === c || o.gone || o.towedBy || o.lane !== m || o.turn || o.park || !(o.moving || o.stopped)) return; if (Math.abs((o.latOff || 0) - (c.latOff || 0)) >= 9.1) return; if (o.s + 10 * (o.len || 1) < sv - myL) return; const g = o.s - 10 * (o.len || 1) - sv - myL; if (g < gap) { gap = g; who = o; } });
  return who;
}
const id = c => '#' + cars.indexOf(c) + (c.turn ? 'T' : 'L') + '@' + (c.turn ? c.turn.n.id : c.lane.to.id) + (c.lane ? ('/e' + c.lane.e.id + ' s' + (c.s | 0) + '/' + (laneEnd(c.lane) | 0)) : '') + ' w' + (c.wait | 0) + ' st' + ((c.stallT || 0) | 0) + (c.trip && !c.trip.wander ? (c.trip.exit ? ' exit' : ' trip') : '');
const det = c => { const o = { v: +c.v.toFixed(2), over: c.over, lat: +(c.latOff || 0).toFixed(1), gh: c.ghostT && +(c.ghostT - simT).toFixed(1), jamS: c.jamS, sq: !!c.squeeze }; if (c.turn) { const T = c.turn, p = plPos(T.pts, T.cum, T.u); o.u = T.u.toFixed(0) + '/' + T.len.toFixed(0); o.A = scanAhead(c, c.x, c.y, p.tx, p.ty, null).clear.toFixed(0); o.gap = nextLaneGap(c, T.to, laneStart(T.to) - (T.len - T.u)).toFixed(0); o.arc = peopleOnArc(c); } else { const p = lanePos(c.lane, c.s); o.A = scanAhead(c, c.x, c.y, p.tx, p.ty, c.lane).clear.toFixed(0); o.atLine = c.atLine; } return JSON.stringify(o); };
const chain = c => { let x = c; const s = [], seen = new Set(); while (x && !seen.has(x) && s.length < 10) { seen.add(x); const [w, o] = why(x); s.push(id(x) + ' ' + w); x = o; } return s.join('  ->  '); };
const mins = [], longest = {}, nodeStat = new Map(), TR = +process.env.TRACE; let cur = null;
for (let i = 0; i < 20 * secs; i++) {
  step(0.05);
  if (TR >= 0 && cars[TR] && i % 40 === 0 && simT > +(process.env.TFROM || 0)) { const c = cars[TR]; console.log('t', simT.toFixed(0), id(c), why(c)[0], det(c)); console.log('   ' + chain(c)); }
  const mi = Math.floor(simT / 60); if (!cur || cur.m !== mi) { cur = { m: mi, n: 0, s: 0, why: {} }; mins.push(cur); }
  if (i % 4 !== 0) continue;
  const cs = cars.filter(civ); cur.n += cs.length;
  for (const c of cs) {
    if (c.v >= 1) continue;
    cur.s++; const w = why(c)[0]; cur.why[w] = (cur.why[w] || 0) + 1;
    // стоит у стоп-линии на зелёный (или у погасшего светофора): то, на что жалуются игроки
    if (!c.turn && sigOn(c.lane.to) && laneEnd(c.lane) - c.s < 34 && lightFor(c.lane.to, c.lane.e) === 'g') { cur.g = (cur.g || 0) + 1; cur.gw = cur.gw || {}; cur.gw[w] = (cur.gw[w] || 0) + 1; }
    if (i % 40 === 0) { const st = c.stallT || 0; if (!longest[w] || longest[w].st < st) longest[w] = { st, i: cars.indexOf(c), t: simT | 0 }; }
    if (simT > 120) { const nd = c.turn ? c.turn.n : c.lane.to; let o = nodeStat.get(nd); if (!o) nodeStat.set(nd, o = { n: 0, why: {} }); o.n++; o.why[w] = (o.why[w] || 0) + 1; }
  }
}
console.log('layout', layoutKey, 'cars', cars.filter(civ).length, 'nodes', RN.length, 'sig', RN.filter(n => n.sig).length, 'trip', tripShare, 'dens', density, 'seed', seed);
for (const m of mins) { if (!m.n) continue; const tot = Object.values(m.why).reduce((a, b) => a + b, 0) || 1; console.log('min', m.m, 'stopped', (m.s / m.n).toFixed(3), Object.entries(m.why).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + (v / tot * 100).toFixed(0) + '%').join('  ')); }
// JSON=1 — одна строка со сводкой для пакетного прогона по многим городам (tests/traffic-batch.js)
if (process.env.JSON) { console.log('JSON ' + JSON.stringify({ layout: layoutKey, seed, mins: mins.map(m => ({ n: m.n, s: m.s, g: m.g || 0, why: m.why, gw: m.gw || {} })) })); return; }
// самые тяжёлые перекрёстки с третьей минуты: номер, светофор, степень, доля простоя, рёбра (вид, ширина/длина[полоса между стоп-линиями])
const tot = [...nodeStat.values()].reduce((a, o) => a + o.n, 0) || 1;
for (const [nd, o] of [...nodeStat.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5)) console.log('node', nd.id, 'sig', nd.sig ? 1 : 0, 'deg', nd.ed.length, 'share', (o.n / tot).toFixed(2), 'edges', nd.ed.map(e => e.kind + e.hw + '/' + (e.len | 0) + '[' + ((e.len - e.ra - e.rb) | 0) + ']').join(' '), Object.entries(o.why).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + (v / o.n * 100).toFixed(0) + '%').join('  '));
console.log('longest', Object.entries(longest).sort((a, b) => b[1].st - a[1].st).slice(0, 12).map(([k, v]) => k + ' #' + v.i + ' st' + (v.st | 0) + ' t' + v.t).join('  '));
// цепочки: кого ждут самые долго стоящие машины
for (const c of cars.filter(c => civ(c) && c.v < 1 && (!process.env.EXIT || (c.trip && c.trip.exit))).sort((a, b) => b.wait - a.wait).slice(0, 6)) console.log(chain(c));
`;
new Function('process', stub + src + body)(process);
