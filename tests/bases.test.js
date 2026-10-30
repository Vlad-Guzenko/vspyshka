// базы служб: у каждой службы своя база в городе (участок, часть, больница, военная часть, коммунальное депо, стройбаза), машины
// выезжают с неё и, отработав, возвращаются на неё же; база разрушена — едут с запасной, а без неё из соседнего района (с края карты)
// node tests/bases.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '');
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(300); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
settings.services = false; // диспетчер не мешает: машины вызываем сами
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
for (const k of ['police', 'fire', 'hospital', 'base', 'kom', 'stroy']) ok(baseOk(special[k]), 'база ' + k + ' есть');
// 1. выезд: машина появляется на улице у своей базы
const far = (x, y) => { let best = null, bd = 0; for (const b of buildings) if (b.door && b.state === 'ok') { const d = Math.hypot(b.door[0] - x, b.door[1] - y); if (d > bd) { bd = d; best = b; } } return best.door; };
const types = ['police', 'fire', 'ambulance', 'sanit', 'army', 'repair', 'tow', 'plow', 'garbage', 'builder', 'dump', 'mixer', 'lowboy', 'supply', 'bus', 'delivery'];
const sent = [];
// ворота военной части стоят в глубине её территории, до сотни единиц от трассы; у остальных баз въезд прямо с улицы
const gateR = h => h.b.kind === 'basehq' ? 170 : 120;
for (const t of types) {
  // доставка берёт склад, ближайший к цели, — сверяем вид базы, а расстояние — до той, с которой выехали
  const home0 = serviceHome(t), [gx, gy] = far(home0.x, home0.y), c = spawnService(t, gx, gy, null), home = c.home;
  const d = home ? Math.hypot(c.x - home.x, c.y - home.y) : 1e9;
  ok(home && home.b.kind === home0.b.kind && d < gateR(home), t + ' выехал со своей базы (' + home0.b.kind + ', ' + (d | 0) + ' от ворот)');
  sent.push(c);
}
// 2. возвращение: отпускаем через 20 с, ждём, пока все заедут на базы; последняя точка машины — у её базы
for (let i = 0; i < 20 * 20; i++) step(.05);
for (const c of sent) if (!c.gone) { if (c.deployed || c.crew.length) { c.crew.forEach(a => { a.state = 'saved'; }); c.crew = []; } releaseUnit(c); }
const last = new Map();
for (let i = 0; i < 20 * 400 && sent.some(c => !c.gone); i++) { step(.05); for (const c of sent) if (!c.gone) last.set(c, [c.x, c.y]); }
for (const c of sent) { const p = last.get(c) || [c.x, c.y], h = c.home, d = h ? Math.hypot(p[0] - h.x, p[1] - h.y) : -1; ok(c.gone && h && d < gateR(h), c.service + ' вернулся на базу' + (h ? ' (' + h.b.kind + ', ' + (d | 0) + ' от ворот)' : ' — базы нет') + (c.gone ? '' : ' — ещё едет')); }
// 3. база разрушена: пожарные — из соседнего района (с края карты), ремонтники — со стройбазы вместо депо
special.fire.b.state = 'ruin'; special.kom.b.state = 'ruin';
const f2 = spawnService('fire', W / 2, H / 2, special.fire), r2 = spawnService('repair', W / 2, H / 2, null);
ok(f2.fromEdge && !f2.home, 'пожарная часть разрушена: расчёт едет с края карты');
ok(r2.home === special.stroy, 'депо разрушено: ремонтники выезжают со стройбазы');
releaseUnit(f2); ok(!f2.homeGoal, 'приехавший из соседнего района уезжает за край карты');
// 4. база разрушена, пока машина ехала домой: она едет на запасную
special.kom.b.state = 'ok'; const g = spawnService('garbage', W / 2, H / 2, null); releaseUnit(g); special.kom.b.state = 'ruin'; step(.05); step(.05);
ok(g.home === special.stroy || g.gone, 'депо разрушено по дороге домой: мусоровоз едет на стройбазу');
console.log(fails ? 'FAIL' : 'OK');
`;
new Function('process', stub + src + body)(process);
