// уличная жизнь в мирное время: водитель выходит из машины у дома и возвращается, фургон доставки с курьером, заглохшая машина
// (аварийка, эвакуатор или завелась сама), такси с пассажиром, час пик и ночь, жёлтое мигание светофоров ночью.
// node tests/life.test.js [планировка] [секунд]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '').replace('const world={hour:13}', 'const world={hour:13,cycle:false}') + ';function slowMo(){}';
const body = `
settings.fast = true; settings.threats = false; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); const p0 = newCitySim(600); genCity = _g;
p0.bitten = false; p0.zero = false; for (const a of agents) { a.bitten = false; a.incT = 0; }
const secs = +process.argv[3] || 420, ev = [], seen = new Set(), mark = (k, t) => { if (!seen.has(k)) { seen.add(k); ev.push((simT | 0) + 's ' + t); } };
const res = {};
// 1. час пик и ночь: машин на улицах по часу; ночью светофоры мигают жёлтым, днём работают
const sig = RN.find(n => n.sig), sigE = sig && sig.ed[0];
world.hour = 2; res.night = { act: activity(), light: sig ? lightFor(sig, sigE) : 'нет', on: sig ? sigOn(sig) : false };
world.hour = 8.5; res.rush = { act: activity(), light: sig ? lightFor(sig, sigE) : 'нет', on: sig ? sigOn(sig) : false };
world.hour = 13; res.day = { act: activity() };
console.log('ночь (2:00): машин', res.night.act, 'от нормы, светофор', res.night.light, sig ? (res.night.on ? 'работает' : 'выключен, едут по старшинству') : '', '| час пик (8:30): машин', res.rush.act, 'от нормы, светофор', res.rush.light, '| день (13:00):', res.day.act);
// 2. поломки: одну машину заводит сам водитель, другую увозит эвакуатор
const st = { errandStart: 0, errandDone: 0, courierStart: 0, courierDone: 0, hails: 0, boarded: 0, dropped: 0, stranded: 0 };
const errandSeen = new Set(), hailSeen = new Set(), rideSeen = new Set(), dropSeen = new Set();
let bk = [], towed = null, fixed = null, hazard = 0, driverSeen = false, driverNear = false;
for (let i = 0; i < 20 * secs; i++) {
  step(.05);
  if (i === 20 * 20) { const n0 = cars.filter(c => c.broken).length; for (let k = 0; k < 6 && cars.filter(c => c.broken).length < 2; k++) breakDown(); bk = cars.filter(c => c.broken); if (bk[0]) bk[0].broken.fix = 0; if (bk[1]) bk[1].broken.fix = 40; mark('bk', 'заглохли: ' + bk.length + ' машины (было ' + n0 + ')'); }
  for (const c of bk) {
    if (c.stopped && !c.moving && !c.service) hazard++; // аварийка: blinkSide в render13.js мигает двумя сторонами у стоящей целой машины
    if (c.broken && c.broken.driver) { driverSeen = true; const a = c.broken.driver; if (a.waitCar === c && Math.hypot(a.x - c.x, a.y - c.y) < 18 && a.state === 'alive') driverNear = true; } // водитель стоит сбоку или у бампера: от центра машины до 14 ед.
    if (c.towedBy && !towed) { towed = c; mark('tow', 'эвакуатор забрал заглохшую машину через ' + ((simT - c.stopT) | 0) + ' с; водитель ' + (c.broken ? 'ещё рядом' : 'уехал с ним')); }
    if (c === bk[1] && !c.broken && c.moving && !fixed) { fixed = c; mark('fix', 'водитель завёл машину и поехал дальше'); }
  }
  // 3. по делам и доставка: водители и курьеры выходят из машин и возвращаются
  for (const a of agents) {
    if (a.errand && !errandSeen.has(a)) { errandSeen.add(a); if (a.errand.car.service) { st.courierStart++; mark('cour', 'курьер доставки вышел из фургона у ' + a.errand.b.kind); } else { st.errandStart++; mark('err', 'водитель вышел из машины и пошёл в ' + a.errand.b.kind); } }
    if (a.hail && !hailSeen.has(a)) { hailSeen.add(a); st.hails++; mark('hail', 'прохожий поймал такси'); }
    if (a.onBus && a.onBus.model === 'taxi' && !rideSeen.has(a)) { rideSeen.add(a); st.boarded++; rideSeen[a.id] = [a.x, a.y]; mark('ride', 'пассажир сел в такси'); }
    if (rideSeen.has(a) && !a.onBus && !dropSeen.has(a) && a.state === 'alive') { dropSeen.add(a); st.dropped++; const p = rideSeen[a.id]; mark('drop', 'такси высадило пассажира в ' + (Math.hypot(a.x - p[0], a.y - p[1]) | 0) + ' ед. от посадки'); }
  }
}
for (const a of errandSeen) if (a.state === 'saved' && a.drove) { if (a.cloth === '#2a4a7a' && a.hat === 'cap') st.courierDone++; else st.errandDone++; } // курьер — в синей форме и кепке
st.stranded = cars.filter(c => c.stopped && !c.moving && !c.broken && !c.wreck && !c.service && !c.gone && !c.towedBy).length;
const alive = agents.filter(a => a.state === 'alive').length, tmpLeft = agents.filter(a => a.lifeTmp && a.state === 'alive').length, nanN = agents.filter(a => isNaN(a.x)).length + cars.filter(c => isNaN(c.x)).length;
for (const e of ev) console.log(e);
console.log('по делам: вышли', st.errandStart, 'вернулись в машину', st.errandDone, '| курьеры: вышли', st.courierStart, 'вернулись', st.courierDone, '| брошенных без водителя', st.stranded);
console.log('такси: поймали', st.hails, 'сели', st.boarded, 'высадили', st.dropped);
console.log('поломки: аварийка кадров', hazard, '| водитель у машины', driverNear, '| эвакуатор', !!towed, '| завёлся сам', !!fixed, '| временных людей на улице', tmpLeft, '| живых', alive, '| nan', nanN);
const ok = res.night.light === 'yb' && !res.night.on && res.rush.light !== 'yb' && res.rush.act > res.day.act && res.night.act < res.day.act
  && bk.length === 2 && hazard > 0 && driverNear && (!!towed || !!fixed) // чинится ли сама — монетка на каждую поломку, достаточно любого исхода
  && st.errandStart > 0 && st.errandDone > 0 && st.boarded > 0 && st.dropped > 0 && nanN === 0 && st.stranded <= 1;
console.log(ok ? 'OK' : 'FAIL');
process.exitCode = ok ? 0 : 1;
`;
new Function('process', stub + src + body)(process);
