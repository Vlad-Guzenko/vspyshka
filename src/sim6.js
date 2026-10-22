/* ---------- сценарии: цели, ограничения, события по рации ---------- */
const SCENARIOS = {
  sandbox: { n: "Нулевой пациент", tag: "Свободная игра", brief: "Один заражённый где-то в городе. Он ещё не знает, что болен. Смотри, как всё начнётся, и вмешивайся, когда захочешь.", limits: null },
  hospital: { n: "Вспышка в больнице", tag: "10 минут · сдерживание", brief: "Из городской больницы сообщают о буйных пациентах, которые кусают персонал. Удержи заразу: через 10 минут зомби должно быть меньше 15, а погибших меньше 200.", limits: { army: 3, tank: 1, strike: 1, nuke: 0 }, time: 600 },
  bridges: { hidden: true, n: "Мосты", tag: "8 минут · оборона", layout: "river", brief: "Орда идёт по одному берегу реки. Удержи мосты: если хотя бы один зомби перейдёт на другой берег, город обречён. Продержись 8 минут.", limits: { army: 4, tank: 1, strike: 2, nuke: 0 }, time: 480 },
  night: { n: "Ночь живых мертвецов", tag: "до рассвета · выживание", brief: "Полночь. По улицам уже бродят полсотни зомби, света почти нет. Продержись до рассвета: к 6 утра в живых должно остаться хотя бы 300 человек.", limits: { army: 3, strike: 0, nuke: 0 } },
  evac: { n: "Эвакуация", tag: "вывезти 150 · спасение", brief: "Город уже не удержать. Вывези вертолётами 150 человек, пока не стало поздно. Вертолётов всего пять, авиаударов нет.", limits: { evac: 5, strike: 0, army: 2, nuke: 0 } },
  mall: { n: "Последний рубеж", tag: "10 минут · волны", brief: "Выжившие собрались у торгового центра. С окраин идут волны зомби, каждая больше прежней. Сохрани хотя бы 40 человек у ТЦ в течение 10 минут.", limits: { army: 3, tank: 1, strike: 1, nuke: 0 }, time: 600 },
  purge: { n: "Зачистка", tag: "без лимита · охота", brief: "Вспышка уже везде: 150 зомби по всему городу. Уничтожь всех до последнего, но не потеряй больше 400 мирных.", limits: { army: 6, tank: 2, strike: 3, nuke: 1 } },
};
let scen = null, scenKey = "sandbox", uses = {}, scenT = 0, scenDone = false, radioQ = [], waveT = 0, wave = 0;
function limitLeft(tool) { if (!scen || !scen.limits || scen.limits[tool] === undefined) return Infinity; return scen.limits[tool] - (uses[tool] || 0); }
function spendLimit(tool) { uses[tool] = (uses[tool] || 0) + 1; }
function radio(text, delay = 0) { radioQ.push({ t: simT + delay, text }); }
function spawnZombieAt(x, y) { const [zx, zy] = freeNear(x, y, 30); const a = newAgent("zombie", zx, zy); turn(a); a.riseT = 0; return a; }
function riverSide(x, y) { if (river) return riverSideOf(x, y); const w = waters[0]; if (!w) return 0; return w.v ? (x < w.x0 ? -1 : x > w.x1 ? 1 : 0) : (y < w.y0 ? -1 : y > w.y1 ? 1 : 0); }
function setupScenario(key, p0) {
  scenKey = key; scen = SCENARIOS[key]; uses = {}; scenT = 0; scenDone = false; radioQ = []; wave = 0; waveT = 40;
  const S = scen;
  if (key === "hospital") {
    p0.bitten = false; p0.zero = false;
    const h = special.hospital || { x: W / 2, y: H / 2 };
    for (let i = 0; i < 4; i++) spawnZombieAt(h.x, h.y);
    for (let i = 0; i < 6; i++) { const [x, y] = freeNear(h.x, h.y, 40); const a = newAgent("civ", x, y); a.bitten = true; a.incT = rnd(10, 40); }
    radio("Диспетчер: в больнице нападения на персонал, есть укушенные", 1);
    radio("Диспетчер: полиция, выезжайте к больнице", 6);
  }
  if (key === "bridges") {
    p0.bitten = false; p0.zero = false;
    const w = waters[0];
    if (w) { let n = 0; for (let k = 0; k < 5000 && n < 70; k++) { const [x, y] = randomFree(); if (riverSide(x, y) === -1 && riverD(x, y) > 60) { const a = newAgent("zombie", x, y); turn(a); a.riseT = 0; n++; } } }
    radio("Штаб: орда на северном берегу. Мосты — единственный путь. Перекройте их", 1);
  }
  if (key === "night") {
    p0.bitten = false; p0.zero = false;
    world.hour = 0; world.target = 0; world.cycle = true; world.rate = 6 / 420; // до рассвета около 7 минут
    for (let i = 0; i < 50; i++) { const [x, y] = randomFree(); spawnZombieAt(x, y); }
    radio("Диспетчер: сообщения о нападениях со всех районов. Держитесь до рассвета", 1);
  }
  if (key === "evac") {
    for (let i = 0; i < 30; i++) { const [x, y] = randomFree(); spawnZombieAt(x, y); }
    radio("Штаб: город потерян. Пять вертолётов в вашем распоряжении. Вывозите людей", 1);
  }
  if (key === "mall") {
    const m = special.mall || { x: W / 2, y: H / 2 };
    let n = 0; for (const a of agents) if (a.role === "civ" && n < 220 && Math.random() < .5) { const [x, y] = freeNear(m.x, m.y, 90); a.x = x; a.y = y; n++; }
    p0.bitten = false; p0.zero = false;
    radio("Выжившие у торгового центра. Разведка видит движение на окраинах", 1);
  }
  if (key === "purge") {
    p0.bitten = false; p0.zero = false;
    for (let i = 0; i < 150; i++) { const [x, y] = randomFree(); spawnZombieAt(x, y); }
    firsts.titan = true; spawnTitan();
    radio("Штаб: зачистить город. Беречь мирных", 1);
  }
}
function scenarioHud() {
  if (!scen || scenKey === "sandbox") return "";
  const c = lastCounts || counts(), left = scen.time ? Math.max(0, scen.time - scenT) : null, mm = left !== null ? mmss(left) : "";
  if (scenKey === "hospital") return `Осталось ${mm} · зомби ${c.Z} (нужно < 15) · погибших ${deaths} (не больше 200)`;
  if (scenKey === "bridges") return `Осталось ${mm} · держите мосты`;
  if (scenKey === "night") return `Время ${hourLabel()} · до рассвета в 6:00 · живых ${c.H + c.I} (нужно 300)`;
  if (scenKey === "evac") return `Спасено ${saved} из 150 · вертолётов ${Math.max(0, limitLeft("evac"))}`;
  if (scenKey === "mall") return `Осталось ${mm} · у ТЦ ${atMall()} (нужно 40) · волна ${wave}`;
  if (scenKey === "purge") return `Зомби осталось ${c.Z} · погибших ${deaths} (не больше 400)`;
  return "";
}
function atMall() { const m = special.mall; if (!m) return 0; let n = 0; near(m.x, m.y - 40, 150, a => { if (a.state === "alive" && a.role !== "zombie") n++; }); return n; }
function endScenario(win, text) { if (scenDone) return; scenDone = true; logE(text, win ? "good" : "bad"); onResult(win, text); }
function stepScenario(dt) {
  for (const r of radioQ) if (!r.done && simT >= r.t) { r.done = true; logE("Рация: " + r.text); onRadio(r.text); sfx.radio(); }
  if (!scen || scenDone || scenKey === "sandbox") return;
  scenT += dt;
  const c = counts();
  if (scenKey === "hospital") { if (scenT >= scen.time) endScenario(c.Z < 15 && deaths <= 200, c.Z < 15 && deaths <= 200 ? "Вспышка сдержана. Город спасён" : "Не удалось сдержать вспышку"); else if (deaths > 200) endScenario(false, "Слишком много погибших"); }
  if (scenKey === "bridges") {
    for (const a of agents) if (a.state === "alive" && a.role === "zombie" && riverSide(a.x, a.y) === 1) { endScenario(false, "Зомби перешли реку"); break; }
    if (!scenDone && scenT >= scen.time) endScenario(true, "Мосты удержаны");
  }
  if (scenKey === "night") { if (world.hour >= 6 && world.hour < 12) endScenario(c.H + c.I >= 300, c.H + c.I >= 300 ? "Рассвет. Город пережил ночь" : "Рассвет, но выживших слишком мало"); else if (c.H + c.I < 300) endScenario(false, "Выживших меньше 300"); }
  if (scenKey === "evac") { if (saved >= 150) endScenario(true, "Эвакуация завершена: 150 человек спасены"); else if (c.H === 0 || (limitLeft("evac") <= 0 && !evac && saved < 150)) endScenario(false, "Эвакуация провалена"); }
  if (scenKey === "mall") {
    waveT -= dt;
    if (waveT <= 0) { wave++; waveT = 55; const n = 12 + wave * 10; for (let i = 0; i < n; i++) { const e = edgeLanePoint(); spawnZombieAt(e.l.s.v ? e.l.c : e.along, e.l.s.v ? e.along : e.l.c); } radio(`Разведка: волна ${wave}, около ${n} зомби`); }
    if (scenT > 30 && atMall() < 40) endScenario(false, "У торгового центра почти никого не осталось");
    else if (scenT >= scen.time) endScenario(true, "Рубеж удержан");
  }
  if (scenKey === "purge") { if (c.Z === 0 && !agents.some(a => (a.state === "alive" && a.bitten) || (a.state === "dead" && a.reanimate && !a.burnt))) endScenario(true, "Город зачищен"); else if (deaths > 400) endScenario(false, "Слишком много погибших мирных"); }
}
