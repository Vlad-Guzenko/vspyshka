// электросеть по кварталам: после удара по ТЭЦ свет гаснет волной от ТЭЦ к окраинам за 20–40 с, светофоры гаснут только
// в обесточенных кварталах (там перекрёсток — по старшинству), генератор держит свой квартал, подстанция гасит свой район,
// включение — тоже волной; состояние сети переживает сохранение и загрузку посреди волны
// node tests/power.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '');
const body = `
settings.fast = true; settings.threats = false; settings.services = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(300); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
firsts.blackoutDone = true; settings.night = true; // случайной аварии не будет: свет гасим сами
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const run = s => { for (let i = 0; i < s * 20; i++) step(.05); };
const city = () => blocks.map((b, i) => i).filter(i => !blocks[i].rural);
const pl = special.power; ok(!!pl, 'ТЭЦ есть');
run(2);
ok(pwOffK === 0 && city().every(i => pwOn[i]), 'до удара свет во всех кварталах (' + blocks.length + ')');
ok(pwSubs.length >= 3, 'подстанции по районам: ' + pwSubs.length + ' (' + pwSubs.map(s => s.b.kind).join(', ') + ')');
// светофоры: узел и полоса к нему, на которой сейчас красный
const redLane = n => { if (n.ph === undefined) return null; for (const e of n.ed) { const l = e.b === n ? e.L[0] : e.L[1]; if (l && lightFor(n, e) === 'r') return l; } return null; };
const car = cars.find(c => !c.gone && c.lane);
const enterAt = l => { const m = l.to.ed.map(e => e.a === l.to ? e.L[0] : e.L[1]).find(m => m && m.e !== l.e); if (!m) return 'нет выезда'; const c = { ...car, lane: l, s: laneEnd(l) - 4, v: 0, wait: 0, stallT: 0, panic: false, flee: false, service: null, siren: false, next2: null, turn: null }; canEnter(c, l, m); return enterWhy; };
// удар по ТЭЦ
pl.b.state = 'ruin';
const dist = i => Math.hypot(blocks[i].cx - pl.x, blocks[i].cy - pl.y);
let mid = null, offAt = new Map();
for (let t = 0; t < 50; t += .5) {
  run(.5);
  for (const i of city()) if (!pwOn[i] && !offAt.has(i)) offAt.set(i, simT);
  if (!mid && pwOffK > .3 && pwOffK < .7) {
    mid = { t: simT, k: pwOffK };
    const dark = city().filter(i => !pwOn[i]), lit = city().filter(i => pwOn[i]), avg = a => a.reduce((s, i) => s + dist(i), 0) / a.length;
    ok(avg(dark) < avg(lit), 'волна идёт от ТЭЦ: тёмные кварталы в среднем ближе к ней (' + (avg(dark) | 0) + ' < ' + (avg(lit) | 0) + ')');
    // светофоры посреди волны: в тёмном квартале погасли — на «красный» не стоят; в светлом — горят
    const sig = RN.filter(n => n.sig && n.ph !== undefined), sd = sig.filter(n => !powerAt(n.x, n.y) && redLane(n)), sl = sig.filter(n => powerAt(n.x, n.y) && redLane(n));
    ok(sd.length > 0 && sl.length > 0, 'посреди волны есть и тёмные (' + sd.length + '), и горящие (' + sl.length + ') светофоры');
    if (sd.length) { const n = sd[0]; ok(!sigOn(n) && enterAt(redLane(n)) !== 'red', 'обесточенный светофор не держит на красный (причина: ' + (enterAt(redLane(n)) || 'едет') + ')'); }
    if (sl.length) { const n = sl[0]; ok(sigOn(n) && enterAt(redLane(n)) === 'red', 'в квартале со светом красный держит'); }
    // сохранение и загрузка посреди волны: тот же свет, те же сроки
    const on0 = Array.from(pwOn), pend0 = Array.from(pwSw).filter(x => x >= 0).length, P = JSON.parse(JSON.stringify(pwSave()));
    resetBuild(); pwLoad = P; pwReady();
    ok(on0.every((v, i) => pwOn[i] === v) && Array.from(pwSw).filter(x => x >= 0).length === pend0, 'после загрузки посреди волны свет и очередь кварталов те же (' + pend0 + ' ждут)');
  }
}
ok(!!mid, 'было полуобесточенное состояние' + (mid ? ' (через ' + (mid.t - offAt.size * 0 - [...offAt.values()].reduce((a, b) => Math.min(a, b), 1e9)).toFixed(1) + ' с после первого квартала)' : ''));
const t0 = Math.min(...offAt.values()), t1 = Math.max(...offAt.values());
ok(pwOffK === 1 && t1 - t0 >= 12 && t1 - t0 <= 42, 'весь город без света; волна шла ' + (t1 - t0).toFixed(1) + ' с');
// ближние к ТЭЦ гаснут раньше дальних
const byD = city().sort((a, b) => dist(a) - dist(b)), q = Math.floor(byD.length / 4), tq = a => a.reduce((s, i) => s + offAt.get(i), 0) / a.length;
ok(tq(byD.slice(0, q)) < tq(byD.slice(-q)), 'ближняя к ТЭЦ четверть кварталов гаснет раньше дальней');
ok(RN.filter(n => n.sig).every(n => !sigOn(n)), 'все светофоры погасли');
// генератор держит свет в своём квартале
const gi = city().find(i => blocks[i].n > 30), gb = blocks[gi]; gens.push({ x: gb.cx, y: gb.cy, fuel: 300, max: 300 }); run(.5);
ok(powerAt(gb.cx, gb.cy) && pwOffK < 1, 'генератор: свет в его квартале есть, в остальных нет');
gens.length = 0; run(.5); ok(!powerAt(gb.cx, gb.cy), 'генератор убрали — квартал погас');
// ТЭЦ отстроили: включение тоже волной
pl.b.state = 'ok'; let part = false; for (let t = 0; t < 50; t += .5) { run(.5); if (pwOffK > .1 && pwOffK < .9) part = true; }
ok(part && pwOffK === 0, 'ТЭЦ отстроили: свет вернулся квартал за кварталом');
ok(RN.filter(n => n.sig).every(n => sigOn(n)), 'светофоры снова горят');
// подстанция: обесточен только её район
const s0 = pwSubs[0]; s0.b.state = 'ruin'; run(16);
const mine = city().filter(i => pwSubOf[i] === 0), rest = city().filter(i => pwSubOf[i] !== 0);
ok(mine.length > 0 && mine.every(i => !pwOn[i]) && rest.every(i => pwOn[i]), 'разрушена подстанция: погас её район (' + mine.length + ' кв.), остальные (' + rest.length + ') со светом');
s0.b.state = 'ok'; run(16); ok(pwOffK === 0, 'подстанцию отстроили — район снова со светом');
console.log(fails ? 'FAIL' : 'OK');
`;
new Function('process', stub + src + body)(process);
