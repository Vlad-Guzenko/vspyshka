// блокпосты: КПП штаба пропускает машины после досмотра; рубеж против орды закрывается, когда орда подходит, и машины
// разворачиваются; внешнее оцепление не выпускает из города. node tests/posts.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '') + ';function slowMo(){}';
const body = `
settings.fast = true; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(600); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
threat.hordeT = 1e9; threat.refT = 1e9;
const res = {};
// 1. КПП штаба на оживлённой улице: машины досматривают и пропускают, пробки не стоят
const av = RE.filter(e => !e.rural && e.kind !== 'ring' && e.len > 120 && e.L[0] && e.L[1]).sort((a, b) => b.hw - a.hw || b.len - a.len)[0];
const p = edgePos(av, av.len / 2); addCheckpoint(p.x, p.y);
const kpp = cps.find(c => c.road && c.kind === 'police');
let maxWait = 0;
for (let i = 0; i < 20 * 150; i++) { step(.05); if (i > 20 * 60) for (const c of cars) if (!c.gone && !c.service && c.lane && c.lane.e.id === kpp.e && c.moving) maxWait = Math.max(maxWait, c.wait || 0); }
res.kpp = { checked: kpp.checked, staff: kpp.staff, maxWait: Math.round(maxWait), cells: kpp.cells.length };
console.log('КПП штаба: досмотрено машин и людей', kpp.checked, '| на посту', kpp.staff, '| дольше всех ждала', Math.round(maxWait), 'с | блоков на обочинах', kpp.cells.length);
// 2. орда: рубеж — армейский блокпост; закрывается, когда орда подходит; маршруты его объезжают
settings.threats = true; threat.hordeT = 1;
let shutT = 0, line = null, shutSeen = false, routeAvoid = null, removed = false, turned = 0;
for (let i = 0; i < 20 * 420; i++) {
  step(.05);
  const h = threat.hordes[0];
  if (h && h.line) { line = h.line; if (h.emergeT > simT + 5) h.emergeT = simT + 5; }
  if (line && line.shut && !shutSeen) { shutSeen = true; shutT = simT; const e = RE.find(x => x.id === line.e); routeAvoid = e.L.filter(Boolean).every(l => postLaneShut(line, l)); }
  // через минуту после закрытия добиваем остаток орды, чтобы проверить снятие поста
  if (shutSeen && simT - shutT > 60 && h && !h.done) for (const a of agents) if (a.horde === h.id && a.state === 'alive' && a.role === 'zombie') destroyZombie(a, false);
  if (line) turned = Math.max(turned, line.turned);
  if (h && h.done) { removed = !cps.includes(line) || !line.own || !line.own['h' + h.id]; break; }
}
res.horde = { post: !!line, kind: line && line.kind, shut: shutSeen, lanesShut: routeAvoid, turned, removed };
console.log('орда: блокпост', line ? line.kind : 'нет', '| закрылся при подходе', shutSeen, '| обе полосы закрыты для маршрутов', routeAvoid, '| развернули машин', turned, '| снят после орды', removed);
// 3. внешнее оцепление: выезды закрыты в сторону из города, въезд открыт
while (simT < 300) step(.05);
hq.known = 200; alert = Math.max(alert, 4);
for (let i = 0; i < 20 * 120 && !threat.fed; i++) step(.05);
let fedOk = false, fedIn = true, fedTurned = 0;
if (threat.fed) {
  const bl = threat.fed.blocks;
  fedOk = bl.length > 0 && bl.every(cp => cp.closeOut && !cp.closeIn);
  for (const cp of bl) { const e = RE.find(x => x.id === cp.e); for (const l of e.L) if (l && !postLaneOut(cp, l) && postLaneShut(cp, l)) fedIn = false; }
  for (let i = 0; i < 20 * 90; i++) step(.05);
  fedTurned = bl.reduce((s, cp) => s + cp.turned, 0);
}
res.fed = { posts: threat.fed ? threat.fed.blocks.length : 0, closeOutOnly: fedOk, inboundOpen: fedIn, turned: fedTurned };
console.log('оцепление: постов', res.fed.posts, '| закрыт только выезд', fedOk, '| въезд открыт', fedIn, '| развернули машин', fedTurned);
// по тихой улице за две минуты может проехать всего пара машин, поэтому главное — никто не застревает у поста
const ok = res.kpp.maxWait < 40 && res.horde.post && res.horde.kind === 'army' && res.horde.shut && res.horde.lanesShut && res.horde.removed && res.fed.posts > 0 && fedOk && fedIn;
console.log(ok ? 'OK' : 'FAIL');
process.exitCode = ok ? 0 : 1;
`;
new Function('process', stub + src + body)(process);
