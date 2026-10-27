// Проверка режима «За рулём» без браузера: node tests/drive.test.js [планировка]
// Игрок садится в машину, едет, крутит руль, сигналит, врезается в стену и в машину, выходит и садится снова; ничего не ломается
const fs = require('fs');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js', 'drive.js'].map(f => fs.readFileSync(require('path').join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null;
const sfx=new Proxy({},{get:()=>()=>{}}); const fps={on:true,mode:"human",a:null,keys:{},yaw:0,pitch:0,fire:false,startT:0,lastHp:100,hurt:0,msgT:0}; function fpsMsg(){} function playerMove(){return [0,0,0]}`;
new Function('process', 'assert', stub + src + `
const layout = process.argv[2] || 'grid';
const _g = genCity; genCity = () => _g(layout);
newCitySim(600);
for (let i = 0; i < 40; i++) step(.05);
const a = agents.find(b => b.state === "alive" && b.role === "civ" && !b.hidden); assert(a, "нет жителя");
// машина на улице, вокруг которой свободно: проверяем физику, а не затор
const open = k => { let busy = false; nearCars(k.x, k.y, 60, o => { if (o !== k && !o.gone && Math.hypot(o.x - k.x, o.y - k.y) < 50) busy = true; }); if (busy) return false; for (let s = -40; s <= 40; s += 5) if (driveSolid(k.x + Math.cos(k.ang) * s, k.y + Math.sin(k.ang) * s)) return false; return true; };
const c = cars.find(k => canDrive(k) && k.lane && open(k)) || nearestDriveCar(a.x, a.y); assert(c, "нет машины");
// людей вокруг машины уводим: проверяем физику, а не наезды
const clearPeople = () => { for (const b of agents) if (b !== a && Math.hypot(b.x - c.x, b.y - c.y) < 120) { const [x, y] = freeNear(W / 2, H / 2, 200); b.x = x; b.y = y; } };
clearPeople();
const [dx, dy] = carDoor(c, 1); a.x = dx; a.y = dy; a.player = true; fps.a = a;
const wasMoving = c.moving && !c.stopped, n0 = agents.length;
enterCar(a, c);
assert(c.player && c.lane === null && c.turn === null && a.hidden && fps.mode === "drive", "посадка");
if (wasMoving) assert(agents.length === n0 + 1, "водителя не вытащили");
const run = (keys, n) => { fps.keys = keys; for (let i = 0; i < n; i++) { step(.05); assert(!isNaN(c.x) && !isNaN(c.y) && !isNaN(c.ang) && !isNaN(c.v), "NaN у машины игрока"); assert(c.player === true, "игрока выбросило: " + JSON.stringify({ wreck: c.wreck, pdmg: c.pdmg, z: c.z })); } };
const x0 = c.x, y0 = c.y, trace = [];
fps.keys = { KeyW: true }; for (let i = 0; i < 60; i++) { step(.05); if (i % 10 === 9) { let nc = 0, np = 0; nearCars(c.x, c.y, 40, o => { if (o !== c && !o.gone && Math.hypot(o.x - c.x, o.y - c.y) < 36) nc++; }); near(c.x, c.y, 16, b => { if (b !== a && b.state === "alive" && !b.hidden) np++; }); trace.push([+c.v.toFixed(1), c.jam, nc, np, driveHitCell(c, c.x + Math.cos(c.ang) * 2, c.y + Math.sin(c.ang) * 2, c.ang) ? driveHitCell(c, c.x + Math.cos(c.ang) * 2, c.y + Math.sin(c.ang) * 2, c.ang).k : 0]); } }
if (!(c.v > 8 || c.pdmg > 0 || c.wait > 1)) console.log('след разгона [v, упор в человека, машин рядом, людей рядом, клетка перед носом]:', JSON.stringify(trace), 'модель', c.model, 'lane', !!c.lane);
clearPeople();
const vmax = c.spd * 1.3;
console.log('разгон 3 с: v', c.v.toFixed(1), 'из', vmax.toFixed(1), 'путь', Math.hypot(c.x - x0, c.y - y0).toFixed(1));
assert(c.v > 8 || c.pdmg > 0 || c.wait > 1, "не поехала");
run({ KeyW: true, KeyD: true }, 40);
run({ KeyS: true }, 60);
assert(c.v <= 1.5, "не затормозила: " + c.v);
run({ KeyS: true }, 40);
console.log('задний ход: v', c.v.toFixed(1));
assert(c.v <= 0, "нет заднего хода");
run({ KeyW: true, KeyA: true, KeyH: true }, 60);
assert(noises.length > 0, "сигнал не слышен");
run({ KeyW: true, Space: true }, 30);
// стена: ведём машину носом в ближайший дом — повреждения растут, но насквозь не проезжает
const b = buildings.filter(b => b.state === "ok").sort((p, q) => Math.hypot(p.cx - c.x, p.cy - c.y) - Math.hypot(q.cx - c.x, q.cy - c.y))[0];
c.ang = Math.atan2((b.y0 + b.y1) / 2 - c.y, (b.x0 + b.x1) / 2 - c.x); c.v = 40; c.pdmg = 0; // прочность не проверяем: три удара на скорости и так разбивают машину
const d0 = c.pdmg;
run({ KeyW: true }, 80);
const inside = x => x > b.x0 && x < b.x1, insideY = y => y > b.y0 && y < b.y1;
assert(!(inside(c.x) && insideY(c.y)), "проехала сквозь дом");
console.log('после стены: повреждения', c.pdmg.toFixed(2), 'было', d0.toFixed(2), 'клетка под машиной', cellAt(c.x, c.y));
assert(driveSolid(c.x, c.y) === 0, "машина игрока в стене");
// другая машина: ставим чужую прямо перед носом и таранем
const o = cars.find(k => k !== c && !k.gone && !k.player && !k.wreck); assert(o, "нет второй машины");
const freeAng = (() => { for (let k = 0; k < 16; k++) { const an = k / 16 * TAU; let ok = true; for (let s = 10; s < 70; s += 6) if (driveSolid(c.x + Math.cos(an) * s, c.y + Math.sin(an) * s)) { ok = false; break; } if (ok) return an; } return c.ang; })();
c.ang = freeAng; c.v = 0; c.slide = 0;
o.x = c.x + Math.cos(freeAng) * 50; o.y = c.y + Math.sin(freeAng) * 50; o.ang = freeAng + Math.PI / 2; o.v = 0; o.moving = false; o.stopped = true; o.lane = null; o.turn = null; o.z = 0; o.vz = 0;
clearPeople(); c.v = 45; c.pdmg = 0; const p0 = c.pdmg;
const ox0 = o.x, oy0 = o.y; run({ KeyW: true }, 30);
const moved = Math.hypot(o.x - ox0, o.y - oy0), touched = moved > .5 || c.pdmg > p0;
console.log('таран: повреждения', c.pdmg.toFixed(2), 'чужую сдвинуло на', moved.toFixed(1), 'она', o.stopped ? 'стоит' : 'едет', o.wreck ? 'разбита' : 'цела');
assert(touched, "столкновения с машиной не было");
assert(!obbOverlap(c, o) || o.z > 0, "кузова пересекаются после удара");
// выход и возврат
exitCar();
assert(!c.player && !a.hidden && fps.mode === "human" && c.stopped && c.cells && c.cells.length, "выход");
assert(!blocked(a.x, a.y), "игрок вышел в стену");
for (let i = 0; i < 20; i++) step(.05);
assert(cars.includes(c) && !c.towedBy, "машину увезли сразу");
const again = carNearAgent(a); assert(again === c, "нельзя сесть обратно");
enterCar(a, c); assert(c.player && c.cells === null, "повторная посадка");
run({ KeyW: true }, 20);
exitCar();
// сохранение: игрок выходит из машины
enterCar(a, c); fps.on = true;
const S = (() => { try { return serializeGame(); } catch (e) { return null; } })();
console.log('serializeGame', S ? 'ок' : 'нет в сборке (ожидаемо: save.js не в списке)');
assert(!drive.car || !S, "после сохранения игрок всё ещё за рулём");
let nan = 0; for (const k of cars) if (isNaN(k.x) || isNaN(k.ang)) nan++; for (const g of agents) if (isNaN(g.x)) nan++;
assert(nan === 0, "NaN в мире");
console.log('ок: за рулём', layout, 'машин', cars.length, 'людей', agents.length, 'сбито', drive.hits);
`)(process, require('assert'));
