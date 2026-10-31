// столкновения: подброшенная взрывом машина сбивает человека и стоящую машину, отскакивает от стены дома, не приземляется
// в чужой кузов; отброшенное тело не пролетает сквозь машину. node tests/collide.test.js [планировка] [городов]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '');
const body = `
const layout = process.argv[2] || 'grid', N = +process.argv[3] || 3;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
for (let k = 1; k <= N; k++) {
  let sd = k * 7919; Math.random = () => { sd += 0x6D2B79F5; let t = sd; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  settings.fast = true; settings.services = false; settings.threats = false; const _g = genCity; genCity = () => _g(layout); newCitySim(300); genCity = _g;
  for (const a of agents) { a.bitten = false; a.incT = 0; }
  for (let i = 0; i < 20 * 5; i++) step(.05);
  // прямая городская улица: на ней стоит машина B, человек перед ней, сзади летит машина A
  const lane = RL.filter(l => l.e.len >= 220 && !l.e.rural && !l.e.closed && !l.e.bridge).sort((a, b) => b.e.len - a.e.len)[k - 1];
  if (!lane) { console.log('город', k, 'нет подходящей улицы'); continue; }
  const P = s => lanePos(lane, laneStart(lane) + s);
  const free = cars.filter(c => !c.gone && !c.service && !c.bus && !c.player && !(c.len > 1.2)), A = free[0], B = free[1];
  const park = (c, q) => { if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); c.turn = null; } clearCarCells(c); c.moving = false; c.stopped = true; c.wreck = false; c.x = q.x; c.y = q.y; c.ang = Math.atan2(q.ty, q.tx); c.z = 0; c.vz = 0; c.vx = 0; c.vy = 0; c.roll = 0; c.sr = 0; c.sy = 0; };
  // вокруг — никого и ничего: чужие машины и люди не мешают опыту
  for (const c of cars) if (c !== A && c !== B && Math.hypot(c.x - P(110).x, c.y - P(110).y) < 120) c.gone = true;
  for (const a of agents) if (Math.hypot(a.x - P(110).x, a.y - P(110).y) < 120) { a.x = 5; a.y = 5; }
  park(B, P(102)); markCarCells(B); const b0 = [B.x, B.y];
  park(A, P(70));
  const man = agents.find(a => a.state === 'alive' && a.role === 'civ' && !a.hidden); const q = P(86); man.x = q.x; man.y = q.y; man.hp = 100; man.vx = man.vy = 0;
  A.vx = q.tx * 38; A.vy = q.ty * 38; A.vz = 16; A.z = .1; A.sr = 0; A.sy = 0; A.wreck = true;
  let inB = 0;
  for (let i = 0; i < 20 * 4 && (A.z > 0 || A.vz); i++) { step(.05); if (!A.gone && obbOverlap(A, B) && Math.abs((A.z || 0) - (B.z || 0)) < 4) inB++; }
  ok(man.state !== 'alive' || man.hp < 100, 'город ' + k + ': летящая машина сбила человека (hp ' + Math.round(man.hp) + ', ' + man.state + ')');
  ok(B.wreck && Math.hypot(B.x - b0[0], B.y - b0[1]) > 2, 'город ' + k + ': стоящую машину отбросило на ' + Math.hypot(B.x - b0[0], B.y - b0[1]).toFixed(1) + ' и она разбита');
  for (let i = 0; i < 20 * 3; i++) step(.05);
  ok(!obbOverlap(A, B), 'город ' + k + ': машины после удара не стоят одна в другой (кадров внутри: ' + inB + ')');
  // стена: машину бросило в дом — отскакивает и остаётся снаружи
  const geo = b => b.rot !== undefined ? { cx: b.cx, cy: b.cy, w: b.w, r: b.rot } : { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, r: 0 };
  const start = b => { const g = geo(b), ux = Math.cos(g.r), uy = Math.sin(g.r); return [g.cx - ux * (g.w / 2 + 30), g.cy - uy * (g.w / 2 + 30), ux, uy, g]; };
  const clearRun = b => { const [x, y, ux, uy, g] = start(b); for (let t = 0; t < 26; t += 2) if (cellAt(x + ux * t, y + uy * t) === 3) return false; return g.w > 24; };
  const bld = buildings.filter(b => b.state === 'ok' && clearRun(b)).sort((a, b) => Math.hypot(geo(a).cx - A.x, geo(a).cy - A.y) - Math.hypot(geo(b).cx - A.x, geo(b).cy - A.y))[0];
  const [sx0, sy0, ux, uy, g] = start(bld); park(A, { x: sx0, y: sy0, tx: ux, ty: uy }); A.vx = ux * 40; A.vy = uy * 40; A.vz = 6; A.z = .1; A.wreck = true;
  let inside = 0;
  for (let i = 0; i < 20 * 3 && (A.z > 0 || A.vz); i++) { step(.05); if (cellAt(A.x, A.y) === 3) inside++; }
  const along = (A.x - g.cx) * ux + (A.y - g.cy) * uy;
  ok(inside === 0 && along < -g.w / 2 + 2, 'город ' + k + ': машина отскочила от стены дома (' + (along + g.w / 2).toFixed(1) + ' от стены, в доме кадров ' + inside + ')');
  // приземление сверху на стоящую машину: съезжает с неё
  park(A, { x: B.x + 3, y: B.y + 1, tx: Math.cos(B.ang), ty: Math.sin(B.ang) }); A.z = 12; A.vz = 0; A.vx = 0; A.vy = 0; A.wreck = true;
  for (let i = 0; i < 20 * 2 && (A.z > 0 || A.vz); i++) step(.05);
  ok(!obbOverlap(A, B), 'город ' + k + ': упавшая сверху машина не стоит внутри другой');
  // тело, отброшенное взрывом, не пролетает сквозь кузов
  const dead = agents.find(a => a.state === 'alive' && a.role === 'civ' && !a.hidden && a !== man); kill(dead, false, 'blast'); dead.reanimate = false;
  const ca = Math.cos(B.ang), sa = Math.sin(B.ang); dead.x = B.x - sa * 14; dead.y = B.y + ca * 14; dead.vx = sa * 40; dead.vy = -ca * 40; dead.vz = 2; dead.z = .5;
  let through = 0;
  for (let i = 0; i < 20 * 2; i++) { step(.05); if (insideCar(B, dead.x, dead.y)) through++; }
  const side = -(dead.x - B.x) * sa + (dead.y - B.y) * ca;
  ok(through === 0 && side > 0, 'город ' + k + ': тело отскочило от борта (внутри кузова кадров ' + through + ', сторона ' + side.toFixed(1) + ')');
}
console.log(fails ? 'FAIL' : 'OK');
`;
new Function(stub + src + body)();
