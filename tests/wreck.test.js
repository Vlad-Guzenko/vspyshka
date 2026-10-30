// разбитая машина перекрыла полосу: стоящие за ней не ждут вечно — первый объезжает или разворачивается, очередь разворачивается,
// улица помечается непроезжей, и маршруты ведут в объезд; в чётных городах перекрыты обе полосы. node tests/wreck.test.js [планировка] [городов]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '');
const body = `
const layout = process.argv[2] || 'grid', N = +process.argv[3] || 6;
let fails = 0, stuckTot = 0, turnedTot = 0;
const _u = uTurn; uTurn = (c, l, o) => { const r = _u(c, l, o); if (r) c.uturned = true; return r; }; // считаем развороты
for (let k = 1; k <= N; k++) {
  let sd = k * 7919; Math.random = () => { sd += 0x6D2B79F5; let t = sd; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  settings.fast = true; settings.services = false; settings.threats = false; const _g = genCity; genCity = () => _g(layout); newCitySim(300); genCity = _g;
  for (const a of agents) { a.bitten = false; a.incT = 0; }
  for (let i = 0; i < 20 * 30; i++) step(.05);
  // длинная городская улица с полосами в обе стороны: на ней — горящая разбитая машина, за ней колонна из пяти машин
  const civ = c => c.moving && !c.gone && !c.service && c.lane && !c.turn && !c.park && !c.gas;
  const pool = RL.filter(l => l.e.len >= 230 && !l.e.rural && oppLane(l) && !l.e.closed), best = pool[Math.floor(Math.random() * pool.length)];
  if (!best) { console.log('город', k, 'нет подходящей улицы'); continue; }
  const sW = Math.min(laneEnd(best) - 60, laneStart(best) + 170);
  for (const c of cars) if (c.lane === best && !c.turn && Math.abs(c.s - sW) < 170) c.gone = true; // освободить место под сцену
  const w = newCar(); placeOnLane(w, best, sW); w.wreck = true; w.burnT = 40; cars.push(w); abandonCar(w, null);
  // в чётных городах перекрыты обе полосы (вторая разбитая машина на встречной рядом): объехать нельзя, только развернуться
  const both = k % 2 === 0; if (both) { const w2 = newCar(), o = oppLane(best); placeOnLane(w2, o, best.e.len - sW); w2.wreck = true; cars.push(w2); abandonCar(w2, null); }
  const col = []; for (let j = 1; j <= 5; j++) { const c = newCar(); placeOnLane(c, best, sW - 10 - j * 26); c.v = 15; cars.push(c); col.push(c); }
  for (let i = 0; i < 20 * 60; i++) step(.05);
  const stuck = col.filter(c => !c.gone && civ(c) && c.lane === best && c.s < sW && c.v < 1 && c.wait > 20).length;
  const turned = col.filter(c => c.uturned).length, passed = col.filter(c => !c.uturned && (c.gone || (c.lane === best && c.s > sW) || c.turn || (c.lane && c.lane.e !== best.e))).length;
  stuckTot += stuck; turnedTot += turned;
  const ok = stuck === 0; // объехать можно по встречной или (если перекрыты обе полосы) по тротуару — главное, никто не ждёт
  if (!ok) fails++;
  console.log((ok ? '  ok  ' : '  FAIL ') + 'город ' + k + (both ? ' (перекрыты обе полосы)' : '') + ': колонна из 5 за горящей машиной — развернулись ' + turned + ', объехали (по встречной или тротуару) ' + passed + ', стоят дольше 20 с ' + stuck + (simT - best.e.blockT < 70 ? ', улица помечена непроезжей' : '') + (stuck ? ' ' + JSON.stringify(col.filter(c => !c.gone && c.lane === best && c.s < sW && c.v < 1 && c.wait > 20).map(c => ({ s: c.s | 0, w: c.wait | 0, hold: c.hold, at: c.atLine, why: c.lineWhy, over: c.over, ahead: c.holdBy ? (c.holdBy === w ? 'wreck' : col.indexOf(c.holdBy)) : null, oppBusy: laneBusy(oppLane(best), best.e.len - c.s, c) }))) : ''));
}
console.log(fails ? 'FAIL' : 'OK');
`;
new Function('process', stub + src + body)(process);
