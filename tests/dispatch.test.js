// диспетчер служб: клик инструментом — заявка, а не машина; парк на базе ограничен; ремонт ждёт, пока расчистят проезд
// node tests/dispatch.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '');
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(300); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const run = s => { for (let i = 0; i < s * 20; i++) step(.05); };
const svc = t => cars.filter(c => c.service === t && !c.gone);
const lastEv = () => events[0] ? events[0].text : '';
settings.services = false; // сам диспетчер молчит: машины — только по вызовам игрока
// 1. многократный клик по одному пожару: выезжает столько расчётов, сколько нужно, а не по машине на клик
const fb = buildings.find(b => b.state === 'ok' && b.kind === 'apt' && b.floors < 9 && b.door && !(b.occ && b.occ.length));
fb.fire = 70; const fx = (fb.x0 + fb.x1) / 2, fy = (fb.y0 + fb.y1) / 2;
for (let k = 0; k < 6; k++) { callService('fire', fx + k * 3, fy); run(.3); }
// огонь мог перекинуться на соседа — тогда к нему по делу едет второй расчёт
const fq = calls.find(q => q.type === 'fire'), nf = svc('fire').length, objN = new Set(fq.targets.map(t => t.job.b || t.job.car)).size;
ok(nf >= 1 && nf === fq.sent && nf <= objN, 'шесть кликов по пожару в доме без людей: расчётов ' + nf + ', горящих объектов ' + objN + ' — «' + lastEv() + '»');
for (const b of buildings) b.fire = 0;
// 2. полиция: повторные клики у одной точки — один наряд; у толпы зомби — больше нарядов, по их числу
const px = special.police.x + 400, py = special.police.y;
for (let k = 0; k < 5; k++) { callService('police', px, py); run(.5); }
ok(svc('police').length === 1, 'пять кликов полиции в одном месте: нарядов ' + svc('police').length);
// 3. парк: на участке шесть машин — шестая заявка последняя, седьмая ждёт; вернувшаяся машина берёт ждущую заявку
for (const c of svc('police')) { c.crew.forEach(a => { a.state = 'saved'; }); c.crew = []; releaseUnit(c); }
run(4); // освободившаяся машина пока едет на участок
const spots = []; for (let k = 0; k < 8; k++) spots.push([200 + (k % 4) * ((W - 400) / 3), k < 4 ? H * .3 : H * .7]);

const qs = spots.map(([x, y]) => callService('police', x, y).q);

ok(special.police.park.police === 0, 'на участке не осталось машин: парк ' + special.police.park.police);
ok(svc('police').length <= PARK.police, 'полицейских машин в городе ' + svc('police').length + ' — не больше парка (' + PARK.police + '), первая свободная взята с дороги');
ok(qs.some(q => q.sent === 0 && q.busy), 'лишние заявки ждут: ' + qs.filter(q => !q.sent).length + ' — «' + events.find(e => /на выездах/.test(e.text)).text + '»');
const waiting = qs.filter(q => !q.sent), freed = svc('police').find(c => qs.includes(c.call) && !c.leaving), n6 = svc('police').length;
freed.crew.forEach(a => { a.state = 'saved'; }); freed.crew = []; releaseUnit(freed);
run(4);
ok(waiting.some(q => q.sent === 1 && q.units.length === 1 && !q.units[0].leaving) && svc('police').length === n6 && special.police.park.police === 0, 'ждущую заявку взял освободившийся наряд, новой машины с участка нет');
// все возвращаются: парк снова полный
calls.length = 0;
for (const c of svc('police')) { c.crew.forEach(a => { a.state = 'saved'; }); c.crew = []; releaseUnit(c); }
for (let i = 0; i < 20 * 400 && svc('police').length; i++) step(.05);
run(1);
ok(special.police.park.police === PARK.police, 'наряды вернулись на участок: парк ' + special.police.park.police + ' из ' + PARK.police);

// 4. эвакуатор: сначала машина, перекрывшая проезжую часть (пусть и дальше от депо), потом брошенная во дворе
{
  const K = special.kom; let yx = 0, yy = 0; for (let r = 20; r < 200 && !yx; r += 6) for (let a = 0; a < 6.28 && !yx; a += .3) { const x = K.x + Math.cos(a) * r, y = K.y + Math.sin(a) * r; if (!blocked(x, y) && !onRoadway(x, y) && cellAt(x, y) === 0) { yx = x; yy = y; } }
  const yard = { ...newCar(), moving: false, stopped: true, stopT: simT - 200, lane: null }; yard.x = yx; yard.y = yy; cars.push(yard);
  const rl = RL.filter(l => !l.e.rural && !l.from.exit).sort((a, b) => Math.hypot(lanePos(b, b.e.len / 2).x - K.x, lanePos(b, b.e.len / 2).y - K.y) - Math.hypot(lanePos(a, a.e.len / 2).x - K.x, lanePos(a, a.e.len / 2).y - K.y))[0];
  const road = { ...newCar() }; placeOnLane(road, rl, rl.e.len / 2); cars.push(road); abandonCar(road, 'crash'); road.stopT = simT - 200;
  const t1 = serviceTarget('tow'), t2 = serviceTarget('tow');
  ok(yx && t1 && t1.job.tow === road && t1.road && t2 && t2.job.tow === yard && !t2.road, 'эвакуатор: сначала машина на проезжей части (' + (Math.hypot(road.x - K.x, road.y - K.y) | 0) + ' от депо), потом во дворе (' + (Math.hypot(yx - K.x, yy - K.y) | 0) + ')');
  for (const c of [yard, road]) { clearCarCells(c); c.gone = true; }
}
// 5. порядок работ: выгоревший дом ждёт ремонта, а на проезжей части перед ним разбитая машина — сначала эвакуатор, потом ремонтники
settings.services = true;
const G1 = buildings.filter(b => b.state === 'ok' && b.kind === 'apt' && b.door && b !== fb && gEdgeNear(...siteGoal(b), 60, e => e.rural)).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - special.kom.x, (a.y0 + a.y1) / 2 - special.kom.y) - Math.hypot((b.x0 + b.x1) / 2 - special.kom.x, (b.y0 + b.y1) / 2 - special.kom.y))[3];
const [hx, hy] = siteGoal(G1), g = gEdgeNear(hx, hy, 60, e => e.rural), l = g.e.L[0] || g.e.L[1];
const w = { ...newCar(), wreck: true }; placeOnLane(w, l, clamp(g.t, laneStart(l) + 5, laneEnd(l) - 5)); w.v = 0; cars.push(w); abandonCar(w, 'crash'); w.stopT = simT;
G1.hp = G1.maxHp * .5; gutBuilding(G1);
let blockT = -1, towT = -1, repT = -1;
for (let i = 0; i < 20 * 400 && repT < 0; i++) {
  step(.05);
  if (blockT < 0 && calls.some(q => q.type === 'repair' && q.targets[0].job && q.targets[0].job.gut === G1 && q.blockBy && q.blockBy.car === w)) blockT = simT;
  if (towT < 0 && (w.towedBy || w.gone)) towT = simT;
  if (repT < 0 && cars.some(c => c.service === 'repair' && !c.gone && c.job && c.job.gut === G1)) repT = simT;
}
ok(blockT >= 0, 'ремонт дома ждёт: проезд перекрыт разбитой машиной (' + (blockT | 0) + ' с)');
ok(towT >= 0 && repT >= towT, 'сначала эвакуатор увёз машину (' + (towT | 0) + ' с), потом выехали ремонтники (' + (repT | 0) + ' с)');

// 6. завал на дороге к дому: сначала расчищают проезд, потом ремонтируют
const roadD = b => { let d = 1e9; for (let y = b.y0 - 24; y < b.y1 + 24; y += CS) for (let x = b.x0 - 24; x < b.x1 + 24; x += CS) { const gi = Math.floor(y / CS) * GW + Math.floor(x / CS); if (roadMask[gi] === 1) d = Math.min(d, Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1))); } return d; };
let R = null, G2 = null;
for (const b of buildings.filter(b => b.kind === 'apt' && b.state === 'ok' && b.floors >= 6 && b !== G1 && b !== fb).sort((a, b) => roadD(a) - roadD(b)).slice(0, 8)) {
  collapse(b); for (let i = 0; i < 20 * 15 && b.state !== 'ruin'; i++) step(.05);
  updateClosedRoads();
  // дом, к которому ведёт улица под завалом этого дома
  const es = RE.filter(e => (e.closed || e.narrow) && !e.rural);
  G2 = buildings.find(o => o.state === 'ok' && o !== b && o !== G1 && o.door && !o.gutted && ['apt', 'house', 'oldhouse', 'shop'].includes(o.kind) && (() => { const [x, y] = siteGoal(o), ob = accessBlock(x, y); return ob && ob.ruin === b; })());
  if (G2) { R = b; break; }
}
ok(!!R, 'нашёлся дом, к которому проезд завален обрушением соседнего');
if (R) {
  G2.hp = G2.maxHp * .5; gutBuilding(G2);
  // игрок вызывает ремонтников к этому дому
  const [x2, y2] = siteGoal(G2), rq = callService('repair', x2, y2).q;
  ok(rq.targets[0].job.gut === G2 && rq.sent === 0 && rq.blockBy && rq.blockBy.ruin === R, 'клик ремонтников у дома за завалом: «' + lastEv() + '»');
  let b2 = -1, clr = -1, rep2 = -1;
  for (let i = 0; i < 20 * 900 && rep2 < 0; i++) {
    step(.05);
    if (b2 < 0 && calls.some(q => q.type === 'repair' && q.targets[0].job && q.targets[0].job.gut === G2 && q.blockBy && q.blockBy.ruin === R)) b2 = simT;
    if (b2 >= 0 && clr < 0 && !accessBlock(x2, y2)) clr = simT;
    if (rep2 < 0 && cars.some(c => c.service === 'repair' && !c.gone && c.job && c.job.gut === G2)) rep2 = simT;
  }
  ok(b2 >= 0, 'ремонт ждёт: проезд перекрыт завалом (' + (b2 | 0) + ' с)');
  ok(clr >= 0 && rep2 >= clr, 'сначала расчистили проезд (' + (clr | 0) + ' с), потом выехали ремонтники (' + (rep2 | 0) + ' с)');
}
console.log(fails ? 'FAIL' : 'OK');
process.exitCode = fails ? 1 : 0;
`;
new Function('process', stub + src + body)(process);
