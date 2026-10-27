// маршрутные автобусы (sim20.js): маршруты замкнуты и проходят через остановки, автобусы делают остановки,
// пассажиры садятся и выходят, ни один автобус не стоит дольше минуты вне остановки
// node tests/buses.test.js [планировка] [секунд]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});`;
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(400); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; } // без зомби: проверяем мирную работу маршрутов
const T = +process.argv[3] || 300;
console.log(layoutKey, 'остановок', busStops.length, 'маршрутов', busLines.length, busLines.map(L => L.stops.length + ' ост./' + L.edges.length + ' рёбер').join(', '));
let bad = [];
// маршруты: не меньше трёх остановок, замкнутая цепочка рёбер (от последней остановки путь ведёт к первой), каждая остановка — на ребре маршрута
for (const L of busLines) {
  if (L.stops.length < 3) bad.push('маршрут короче трёх остановок');
  const es = new Set(L.edges); for (const k of L.stops) if (!es.has(busStops[k].e.id)) bad.push('остановка не на ребре маршрута');
  const last = busStops[L.stops[L.stops.length - 1]], first = busStops[L.stops[0]];
  if (busLeg(last, first) >= 1e11) bad.push('маршрут не замкнут');
}
const buses = () => cars.filter(c => c.bus && !c.service && !c.gone);
console.log('автобусов', buses().length, 'по маршрутам', busLines.map((L, i) => buses().filter(c => c.line === i).length).join('/'));
let maxIdle = 0, idleWhere = null, maxWait = 0, waitWhere = null, waiters = 0;
for (let i = 0; i < 20 * T; i++) {
  step(.05);
  if (i % 20 === 0) {
    waiters = Math.max(waiters, agents.filter(a => a.busWait).length);
    for (const c of buses()) {
      // стоит (не на остановке) — копим время; сдвинулся — сбрасываем
      if (c.wreck || c.stopped) continue; // разбитый или брошенный — не «стоит в пути»
      if (c.v < 1 && !c.park) { c.idleT = (c.idleT || 0) + 1; if (c.idleT > maxIdle) { maxIdle = c.idleT; idleWhere = c; } } else c.idleT = 0;
      // c.wait — сколько подряд стоит по счёту самой симуляции (сбрасывается, как только тронулся); на остановке он обнуляется
      if (!c.park && c.wait > maxWait) { maxWait = c.wait; waitWhere = c; }
    }
  }
}
const stops = buses().reduce((a, c) => a + (c.stopsMade || 0), 0), boarded = buses().reduce((a, c) => a + (c.boarded || 0), 0), alighted = buses().reduce((a, c) => a + (c.alighted || 0), 0);
const wrecked = cars.filter(c => c.bus && !c.service && (c.wreck || c.stopped)).length, aboard = buses().reduce((a, c) => a + ((c.passengers || []).length), 0), gaveUp = busStops.reduce((a, s) => a + (s.gaveUp || 0), 0);
console.log('за', T, 'с: остановок сделано', stops, '| сели', boarded, '| вышли', alighted, '| едут сейчас', aboard, '| ждали на остановках (макс.)', waiters, '| не дождались', gaveUp, '| автобусов разбито или брошено', wrecked);
console.log('дольше всего автобус стоял вне остановки:', maxWait | 0, 'с', waitWhere ? 'на ' + (waitWhere.turn ? 'перекрёстке' : waitWhere.lane ? waitWhere.lane.e.kind : '-') : '', '| полз медленнее 1 ед./с подряд до', maxIdle, 'с');
console.log('nan', agents.filter(a => isNaN(a.x)).length, cars.filter(c => isNaN(c.x)).length, '| скрытых без укрытия и автобуса', agents.filter(a => a.hidden && !a.hideB && !a.onBus && !a.detained).length);
if (!busLines.length) bad.push('нет маршрутов');
if (stops < busLines.length * 2) bad.push('автобусы почти не останавливаются');
if (!boarded) bad.push('никто не сел'); if (!alighted) bad.push('никто не вышел');
if (wrecked > 1) bad.push('в спокойном городе разбилось автобусов: ' + wrecked);
if (maxWait > 60) bad.push('автобус стоял вне остановки ' + (maxWait | 0) + ' с');
if (agents.some(a => isNaN(a.x)) || cars.some(c => isNaN(c.x))) bad.push('NaN');
console.log(bad.length ? 'FAIL: ' + bad.join('; ') : 'OK');
process.exitCode = bad.length ? 1 : 0;
`;
new Function('process', stub + src + body)(process);
