// кампания: три дня подряд без ошибок, итоги считаются, лимиты переносятся, сохранение и загрузка между днями работают
// node tests/campaign.test.js [планировка] [секунд в сутках]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js', 'campaign.js', 'save.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
// заглушки графики и интерфейса; для save.js — страница, сцена и кнопки
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function fxNuke(){}function onBanner(t){}
let RES=null;function onResult(w,t){RES=[w,t]} function onRadio(){} const world={hour:13,target:13,cycle:false}; function hourLabel(){return ''} function mmss(t){return t|0} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});
const el={checked:false,value:'',textContent:'',innerHTML:'',hidden:false,addEventListener(){},querySelector(){return this},setAttribute(){}};
const document={getElementById:()=>el}; const fps={on:false}; function stopFps(){} function syncDayButton(){} function clearDecals(){} function clearDebris(){} const tankObjs=new Map(); const scene={remove(){}}; function buildCity(){} function renderTools(){} function warn(){}
let followA=null,hoverA=null,gridDirtyMini=false; const PS_ADD={list:[]},PS_SMOKE={list:[]}; let DAYEND=null; function onDayEnd(s){DAYEND=s} let patientZero=null, editRoads=[];`;
new Function('process', stub + src + `
const DAY = +process.argv[3] || 150; // сутки за столько секунд игры: быстрее настоящих 720
settings.fast = true; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid');
const p0 = newCitySim(700); patientZero = p0; setupScenario('campaign', p0); genCity = _g;
const ok = [], bad = [], check = (c, t) => (c ? ok : bad).push(t);
const errs = []; const _step = step;
console.log(layoutKey, 'кампания: день', camp && camp.day, '| бюджет', JSON.stringify(scen.limits));
check(camp && camp.day === 1 && dayN === 1, 'день 1 начат');
check(limitLeft('army') < Infinity && limitLeft('police') < Infinity && limitLeft('supply') < Infinity, 'лимиты выданы');
check(world.hour === 8 && world.cycle, 'утро 8:00, часы идут');
// день: шаги симуляции и часы (в игре их двигает кадр), до экрана итогов
function runDay(maxS) {
  if (!camp) return null; world.rate = 24 / DAY; const n0 = camp.days.length;
  for (let i = 0; i < 20 * maxS; i++) {
    try { step(.05); } catch (e) { errs.push(e); break; }
    world.hour = (world.hour + .05 * world.rate) % 24;
    if (camp.days.length > n0 || scenDone) break;
  }
  return camp.days.length > n0 ? camp.days[camp.days.length - 1] : null;
}
uses.army = 1; uses.police = 2; // кое-что потрачено: проверим перенос остатка
const d1 = runDay(DAY * 3);
check(!errs.length, 'день 1 без ошибок' + (errs.length ? ': ' + errs[0].stack : ''));
check(d1 && d1.day === 1 && !d1.event, 'день 1 завершён (без события): ' + JSON.stringify(d1));
if (d1) {
  check(d1.alive > 0 && d1.dead >= 0 && d1.zkills >= 0 && d1.spent.army === 1 && d1.spent.police === 2 && typeof d1.trust === 'number', 'итоги посчитаны: погибло ' + d1.dead + ', зомби уничтожено ' + d1.zkills + ', потрачено ' + JSON.stringify(d1.spent));
  check(DAYEND === d1 && camp.pending, 'экран итогов вызван, утро ждёт');
  check(!agents.some(a => a.state === 'dead'), 'ночью тела вывезены');
  check(!fires.length && !buildings.some(b => b.fire > 0), 'пожары потушены');
  check(!agents.some(a => a.state === 'alive' && a.role !== 'zombie' && a.bitten && !a.post), 'укушенных к утру нет: ' + JSON.stringify(camp.night));
  check(!cars.some(c => !c.gone && (c.service || c.wreck || c.stopped)), 'служебные и брошенные машины убраны');
  const leftArmy = limitLeft('army'), wantArmy = camp.next.budget.army;
  check(wantArmy >= Math.floor(leftArmy * .5) && wantArmy > Math.floor(leftArmy * .5), 'остаток переносится в бюджет: осталось ' + leftArmy + ', завтра ' + wantArmy);
  check(campNextDay() && camp.day === 2 && dayN === 2 && world.hour === 8 && !(uses.army || 0), 'день 2: утро, траты обнулены, лимиты ' + JSON.stringify(scen.limits));
  check(scen.limits.army === wantArmy, 'лимит дня — из плана на утро');
}
// сохранение и загрузка между днями: как слот кампании, через JSON
let d2 = null;
if (camp && camp.day === 2) {
  const rep = hq.rep, lim = JSON.stringify(scen.limits), nDays = camp.days.length, strainL = strain.lvl, pop = counts();
  let S = null; try { S = JSON.parse(JSON.stringify(serializeGame(), (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v)); } catch (e) { errs.push(e); }
  check(S && S.camp && S.camp.day === 2, 'сохранение содержит кампанию');
  camp = null; hq.rep = 0; scen.limits = {}; // сбиваем, чтобы увидеть восстановление
  try { loadGame(S); } catch (e) { errs.push(e); console.log('ошибка загрузки:', e.stack); }
  check(!errs.length, 'загрузка без ошибок' + (errs.length ? ': ' + errs[0].stack : ''));
  check(camp && camp.day === 2 && camp.days.length === nDays && dayN === 2, 'кампания загружена: день ' + (camp && camp.day) + ', итогов ' + (camp && camp.days.length));
  check(hq.rep === rep, 'доверие штаба перенесено: ' + hq.rep);
  check(JSON.stringify(scen.limits) === lim, 'лимиты после загрузки те же: ' + JSON.stringify(scen.limits));
  check(scenKey === 'campaign' && !scenDone && strain.lvl === strainL, 'сценарий кампании и штамм на месте');
  const c2 = counts(); check(c2.H + c2.I === pop.H + pop.I, 'живые на месте: ' + (c2.H + c2.I));
  d2 = runDay(DAY * 3);
  check(!errs.length, 'день 2 без ошибок' + (errs.length ? ': ' + errs[0].stack : ''));
  check(d2 && d2.day === 2, 'день 2 завершён после загрузки: ' + JSON.stringify(d2));
}
let d3 = null;
if (d2) {
  check(campNextDay() && camp.day === 3, 'день 3: утро, событие «' + camp.event + '», бюджет ' + JSON.stringify(scen.limits));
  d3 = runDay(DAY * 3);
  check(!errs.length, 'день 3 без ошибок' + (errs.length ? ': ' + errs[0].stack : ''));
  check(d3 && d3.day === 3 && camp.days.length === 3, 'день 3 завершён, три дня в хронике');
  const ch = chronicle().find(p => p.h === 'Дни кампании');
  check(ch && ch.lines.length >= 3, 'хроника по дням: ' + (ch ? ch.lines.length : 0) + ' строк');
}
for (const d of camp ? camp.days : []) console.log('день', d.day, d.event || '-', '| живых', d.alive, 'погибло', d.dead, 'спасено', d.saved, 'зомби уничтожено', d.zkills, 'к утру зомби', d.Z, 'разрушено', d.ruinedNew, 'доверие', d.trust, d.early ? '(досрочно)' : '');
if (RES) console.log('итог кампании:', JSON.stringify(RES));
for (const t of ok) console.log('  ok ', t);
for (const t of bad) console.log('  FAIL', t);
console.log(bad.length ? 'FAIL' : 'OK');
process.exitCode = bad.length ? 1 : 0;
`)(process);
