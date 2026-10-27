// разрушения без цепной реакции: авиабомба и бензовоз каменные дома не валят; после метеорита дома не рушатся волнами
// одно за другим (никакого домино). node tests/collapse.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '') + ';function slowMo(){}';
const body = `
settings.fast = true; settings.threats = false; settings.services = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'old'); newCitySim(300); genCity = _g;
const log = []; const _c = collapse; collapse = function (b, demo) { log.push({ t: simT, b, kind: b.kind }); return _c(b, demo); };
const stone = b => b.kind !== 'house' && b.state === 'ok';
// самая плотная точка: центр высокого дома, вокруг которого больше всего соседей
let best = null, bn = 0; for (const b of buildings) { if (!stone(b) || b.floors < 5) continue; const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; let n = 0; for (const o of buildings) if (o !== b && stone(o) && Math.hypot((o.x0 + o.x1) / 2 - cx, (o.y0 + o.y1) / 2 - cy) < 120) n++; if (n > bn) { bn = n; best = [cx, cy + (b.y1 - b.y0) / 2 + 6]; } }
const res = {};
// 1. авиабомба у стены многоэтажки
let n0 = log.length; boom(best[0], best[1], 70, true); for (let i = 0; i < 20 * 20; i++) step(.05);
res.bomb = log.slice(n0).filter(e => e.kind !== 'house').length;
// 2. бензовоз взрывается рядом с домами
n0 = log.length; const c = cars.find(c => !c.gone && !c.wreck); c.tanker = true; c.x = best[0] + 60; c.y = best[1]; boom(c.x, c.y, 64, true); for (let i = 0; i < 20 * 20; i++) step(.05);
res.tanker = log.slice(n0).filter(e => e.kind !== 'house').length;
// 3. метеорит: сам рушит дома, но после первых секунд новых обрушений нет
n0 = log.length; const t0 = simT; boom(best[0] - 200, best[1], 120, true); for (const b of buildings) { const d = Math.hypot(Math.max(b.x0 - best[0] + 200, 0, best[0] - 200 - b.x1), Math.max(b.y0 - best[1], 0, best[1] - b.y1)); if (d < 160) { b.bigHit = true; damageBuilding(b, 500 * (1 - d / 160), best[0] - 200, best[1]); } }
for (let i = 0; i < 20 * 40; i++) step(.05);
const met = log.slice(n0); res.meteor = met.length; res.late = met.filter(e => e.t - t0 > 1 && e.kind !== 'house').length; res.topple = met.filter(e => e.b.topple).length;
console.log('соседей у цели', bn, '| бомба: обрушено каменных', res.bomb, '| бензовоз:', res.tanker, '| метеорит: обрушено', res.meteor, ', набок', res.topple, ', позже первой секунды', res.late);
const ok = res.bomb === 0 && res.tanker === 0 && res.late === 0;
console.log(ok ? 'OK' : 'FAIL'); process.exitCode = ok ? 0 : 1;
`;
new Function('process', stub + src + body)(process);
