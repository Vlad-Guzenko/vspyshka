/* ---------- кампания: город живёт несколько дней подряд ----------
   Один город на всю кампанию. День идёт с восьми утра до шести утра следующего дня (сутки — 12 минут игры), в шесть —
   экран итогов. «Ночь» проматывается: тела вывозят, пожары тушат, часть завалов разбирают и часть домов чинят,
   жители расходятся по домам, беженцы в большинстве остаются жить, укушенных без вакцины уже не спасти.
   Утром штаб выдаёт бюджет на день (лимиты инструментов) по доверию и по тому, что осталось со вчера, и присылает
   событие дня — с каждым днём тяжелее. Цель — продержаться CAMP_DAYS дней или получить вакцину и зачистить город;
   поражение — живых меньше CAMP_MIN_POP или доверие штаба (звёзды) упало до нуля.
   Штамм вируса, вакцина, карантины, посты, лагеря и доверие штаба между днями не сбрасываются */
const CAMP_DAYS = 7, CAMP_MIN_POP = 150, CAMP_HOUR0 = 8, CAMP_REP0 = 3;
const CAMP_BASE = { police: 6, army: 4, tank: 1, strike: 2, evac: 2, supply: 3, nuke: 0 };
const CAMP_TOOL_N = { police: "полиция", army: "военные", tank: "танки", strike: "авиаудары", evac: "вертолёты", supply: "припасы", nuke: "ядерный удар" };
// события по дням (индекс — день минус один; дальше последнего — последнее): орда идёт через внешние угрозы (sim19.js),
// очаг — зомби и укушенные в случайном квартале, ультиматум — внешнее оцепление федерального центра
const CAMP_EVENTS = [null, ["refugees"], ["horde"], ["outbreak"], ["horde", "refugees"], ["outbreak", "ultimatum"], ["horde", "outbreak"]];
const CAMP_EVENT_N = { refugees: "беженцы на въездах", horde: "орда с окраин", outbreak: "новый очаг в районе", ultimatum: "ультиматум федерального центра" };
let camp = null;
function campStars() { return clamp(Math.round(hq.rep), 0, 5); }
function campStarsText(rep) { const s = clamp(Math.round(rep === undefined ? hq.rep : rep), 0, 5); return "★".repeat(s) + "☆".repeat(5 - s); }
function campRuined() { let n = 0; for (const b of buildings) if (b.state !== "ok" || b.gutted) n++; return n; }
function campSnap() { const c = counts(); return { deaths, saved, zkills, bites, cured, alive: c.H + c.I, ruined: campRuined() }; }
// бюджет дня: база × доверие (от 0,6 при нуле звёзд до 1,6 при пяти) × рост по дням; половина неизрасходованного переносится;
// ядерный удар штаб доверяет с пятого дня и только при пяти звёздах
function campBudget(day, left) {
  const k = (.6 + .2 * campStars()) * (1 + .08 * (day - 1)), b = {};
  for (const t in CAMP_BASE) b[t] = Math.round(CAMP_BASE[t] * k) + Math.floor(((left && left[t]) || 0) * .5);
  b.nuke = day >= 5 && campStars() >= 5 ? 1 : 0;
  return b;
}
function campBudgetText(b) { return Object.keys(b).filter(t => b[t] > 0).map(t => `${CAMP_TOOL_N[t]} ${b[t]}`).join(", ") || "ничего"; }
function startCampaign() {
  camp = { day: 0, days: [], budget: {}, event: "", kinds: null, over: false, won: false, pending: false, dayT0: 0, start: null, night: null, next: null, chkT: 0 };
  hq.rep = CAMP_REP0; // аванс доверия: три звезды
  world.cycle = true; world.rate = 24 / 720;
  if (threat) threat.hordeT = Math.max(threat.hordeT, 900); // первый день без орды: вспышка только начинается
  campNewDay();
  logE(`Кампания: продержаться ${CAMP_DAYS} дней или получить вакцину и зачистить город. Живых должно оставаться не меньше ${CAMP_MIN_POP}`, "good");
  radio("Штаб: вы назначены руководить обороной города. Отчёт каждое утро в шесть, бюджет на день — по результатам", 2);
}
// утро: новый день, бюджет, событие
function campNewDay() {
  camp.day++; dayN = camp.day; camp.pending = false;
  const nx = camp.next || campPlanNext(camp.day); camp.next = null;
  camp.budget = nx.budget; camp.kinds = nx.kinds; scen.limits = { ...camp.budget }; uses = {};
  camp.dayT0 = simT; camp.chkT = 0; camp.start = campSnap();
  world.hour = world.target = CAMP_HOUR0; world.cycle = true; if (!world.rate) world.rate = 24 / 720;
  camp.event = nx.kinds ? campEvent(nx.kinds) : "";
  if (threat && !(nx.kinds || []).includes("horde")) threat.hordeT = Math.max(threat.hordeT, 420); // без события — орда не с самого утра
  logE(`День ${camp.day} из ${CAMP_DAYS}. Бюджет штаба: ${campBudgetText(camp.budget)}${camp.event ? ". " + camp.event[0].toUpperCase() + camp.event.slice(1) : ""}`, "good");
  if (camp.day > 1) { radio(`Штаб: доброе утро, день ${camp.day}. Доверие ${campStarsText()}. ${camp.event ? "Разведка: " + camp.event : "Разведка: окраины спокойны"}`, 1); if (typeof onBanner === "function") onBanner(`День ${camp.day}`); }
  if (typeof renderTools === "function") renderTools();
}
// что ждёт завтра: бюджет с учётом остатка и событие — считается на экране итогов, применяется утром
function campPlanNext(day) {
  const left = {};
  if (scen && scen.limits) for (const t in scen.limits) left[t] = Math.max(0, limitLeft(t));
  const kinds = CAMP_EVENTS[Math.min(day - 1, CAMP_EVENTS.length - 1)];
  return { budget: campBudget(day, day > 1 ? left : null), kinds: kinds ? kinds.slice() : null };
}
function campEvent(kinds) {
  const names = [], canThreat = typeof threatsOn === "function" && threatsOn() && threat;
  for (let k of kinds) {
    if ((k === "horde" || k === "refugees") && !canThreat) k = "outbreak"; // угрозы выключены или въездов нет — очаг в городе
    if (k === "horde") { threat.hordeT = rnd(20, 60); }
    else if (k === "refugees") { threat.refT = rnd(20, 60); }
    else if (k === "outbreak") campOutbreak();
    else if (k === "ultimatum") {
      // внешнее оцепление ставится по числу известных штабу зомби (stepFederal): подаём ему повод
      if (canThreat) { threat.fed = null; threat.fedDone = false; hq.known = Math.max(hq.known || 0, 150); }
      else campOutbreak();
    }
    if (!names.includes(CAMP_EVENT_N[k])) names.push(CAMP_EVENT_N[k]);
  }
  return names.join(", ");
}
// новый очаг: зомби и несколько укушенных в случайном городском квартале подальше от центра
function campOutbreak() {
  const cand = blocks.filter(b => !b.rural && b.kind !== "plaza" && b.kind !== "lot" && cityK(b.cx, b.cy) > .45);
  const b = cand.length ? pick(cand) : { cx: W / 2 + rnd(-300, 300), cy: H / 2 + rnd(-200, 200) };
  const n = 6 + camp.day * 4;
  for (let i = 0; i < n; i++) spawnZombieAt(b.cx + rnd(-40, 40), b.cy + rnd(-40, 40));
  for (let i = 0; i < 4; i++) { const [x, y] = freeNear(b.cx, b.cy, 60); const a = newAgent("civ", x, y); nameFor(a); a.local = true; a.bitten = true; a.incT = rnd(20, 90); }
  const where = typeof placeName === "function" ? placeName(b.cx, b.cy) : "в городе";
  logE(`Новый очаг ${where}: около ${n} зомби`, "bad"); radio(`Диспетчер: нападения ${where}, звонят со всего квартала. Это новый очаг`, 3); interest(b.cx, b.cy, 8);
}
function stepCampaign(dt) {
  if (!camp || camp.over || camp.pending) return;
  dayN = camp.day; world.cycle = true; // в кампании время идёт само
  camp.chkT -= dt; if (camp.chkT > 0) return; camp.chkT = 1;
  const c = counts();
  if (c.H + c.I < CAMP_MIN_POP) return campOver(false, `Город потерян: живых осталось меньше ${CAMP_MIN_POP}`);
  if (hq.rep <= 0) return campOver(false, "Штаб отстранил вас от руководства: доверие упало до нуля");
  if (vaccineReady && c.Z === 0 && c.I === 0 && !agents.some(a => a.state === "dead" && a.reanimate && !a.burnt)) return campOver(true, "Вакцина получена, город зачищен", "vac");
  // утро: день кончается в шесть (не раньше чем через две минуты после начала — часы могли стоять на утре)
  if (world.hour >= 6 && world.hour < CAMP_HOUR0 && simT - camp.dayT0 > 120) campEndDay(false);
}
function campOver(win, text, by) { camp.over = true; camp.won = win; camp.wonBy = win ? by || "days" : ""; dayN = camp.day; endScenario(win, text); }
// «Закончить день» раньше утра: только когда зомби в городе не осталось
function campEndEarly() {
  if (!camp || camp.over || camp.pending || scenDone) return false;
  if (counts().Z > 0) return false;
  campEndDay(true); return true;
}
// шесть утра: итоги дня, оценка штаба, ночь и план на завтра; дальше — экран итогов, утро начинается по «Следующий день»
function campEndDay(early) {
  const c = counts(), s = camp.start, spent = {}; for (const t in scen.limits) spent[t] = uses[t] || 0;
  const ruined = campRuined();
  const sum = { day: camp.day, event: camp.event, early: !!early, alive: c.H + c.I, dead: deaths - s.deaths, saved: saved - s.saved, zkills: zkills - s.zkills, bites: bites - s.bites, cured: cured - s.cured, Z: c.Z, ruined, ruinedNew: Math.max(0, ruined - s.ruined), spent, trust0: hq.rep };
  // оценка штаба: спокойный день — звезда; много погибших или к утру полно зомби — минус звезда
  const pop = Math.max(1, s.alive); let d = 0, why = "";
  if (sum.dead <= pop * .03 && c.Z < 10) { d = 1; why = "спокойный день: мало погибших, зомби почти нет"; }
  else if (sum.dead > pop * .15 || c.Z > 60) { d = -1; why = sum.dead > pop * .15 ? "за день погибло слишком много людей" : "к утру в городе слишком много зомби"; }
  if (d) { hq.rep = clamp(hq.rep + d, -5, 5); logE(`Доверие штаба ${d > 0 ? "выросло" : "упало"}: ${why}. Сейчас ${campStarsText()}`, d > 0 ? "good" : "bad"); }
  sum.trust = hq.rep; sum.trustD = d; sum.why = why;
  camp.days.push(sum); camp.pending = true;
  logE(`Итоги дня ${camp.day}: живых ${sum.alive}, погибло ${sum.dead}, спасено ${sum.saved}, зомби уничтожено ${sum.zkills}, разрушено домов ${sum.ruinedNew}, доверие ${campStarsText()}`, "good");
  if (hq.rep <= 0) return campOver(false, "Штаб отстранил вас от руководства: доверие упало до нуля");
  if (camp.day >= CAMP_DAYS) return campOver(true, `Город выстоял ${CAMP_DAYS} дней`);
  camp.night = campNight(); camp.next = campPlanNext(camp.day + 1);
  if (typeof onDayEnd === "function") onDayEnd(sum);
  return sum;
}
function campNextDay() { if (!camp || camp.over || !camp.pending) return false; campNewDay(); return true; }
// ночь: город приходит в себя. Возвращает отчёт для экрана итогов
function campNight() {
  const R = { bodies: 0, cars: 0, rubble: 0, repaired: 0, home: 0, refStay: 0, refLeft: 0, turned: 0, cured: 0, forces: 0 };
  // пожары потушены, тела вывезены
  fires = []; for (const b of buildings) b.fire = 0; for (const c of cars) { c.burnT = 0; c.boomT = 0; }
  for (const a of agents) if (a.state === "dead") { collectBody(a, null); R.bodies++; }
  // укушенные: с вакциной — вылечены, без неё — обратились за ночь
  for (const a of agents) {
    if (a.state !== "alive" || a.role === "zombie" || !a.bitten || a.post) continue;
    if (vaccineReady) { a.bitten = false; a.immune = true; a.incT = 0; cured++; R.cured++; continue; }
    if (a.hideB) campLeave(a); if (a.detained) { a.detained.detained = Math.max(0, (a.detained.detained || 1) - 1); a.detained = null; } a.hidden = false; a.onBus = null;
    deaths++; turn(a); a.riseT = 0; R.turned++;
  }
  // завалы: разобрана половина руин, треть из них отстроена; половина выгоревших остовов отремонтирована; стройки завершены
  const ruins = buildings.filter(b => b.state === "ruin" || b.state === "collapsing").sort(() => Math.random() - .5);
  ruins.slice(0, Math.ceil(ruins.length / 2)).forEach(b => { campClearRuin(b); R.rubble++; if (Math.random() < .35) { campRestore(b); R.repaired++; } });
  for (const b of buildings) if (b.state === "construct") { campRestore(b); R.repaired++; }
  for (const b of buildings) if (b.gutted && b.state === "ok" && Math.random() < .5) { campRestore(b); R.repaired++; }
  for (const b of buildings) if (b.state === "ok" && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - b.hp) * .4);
  // еда и боеприпасы подвезены
  for (const b of buildings) if (b.cap) { b.food = b.cap * 1.2; b.hungryT = 0; }
  for (const c of camps) { c.food = Math.max(c.food, 240); c.hungryT = 0; }
  for (const d of depots) d.ammo = d.max; for (const g of gens) g.fuel = g.max;
  // люди: по домам, паника прошла; беженцы (без семьи в городе) в большинстве остаются и получают жильё
  const homes = buildings.map((b, i) => [b, i]).filter(([b]) => b.door && b.state === "ok" && !b.gutted && (b.kind === "apt" || b.kind === "house"));
  for (const a of agents) {
    if (a.state !== "alive" || a.role === "zombie") continue;
    if (a.role === "civ") {
      if (a.hideB) campLeave(a); if (a.onBus) a.onBus = null; if (!a.detained) a.hidden = false;
      a.panic = 0; a.alert = false; a.homeGoal = false; a.dest = null; a.hideGoal = null; a.campGoal = null; a.forage = null; a.busGoal = null; a.grabT = 0; a.refCol = 0; a.hp = Math.min(100, a.hp + 40);
      if (!a.fam && !a.local && !a.zero) {
        if (Math.random() < .7 && homes.length) { a.local = true; a.home = pick(homes)[1]; R.refStay++; }
        else { a.state = "saved"; a.leftCity = true; R.refLeft++; continue; }
      }
      const hb = a.home >= 0 ? buildings[a.home] : null;
      if (hb && hb.door && hb.state === "ok" && !hb.gutted && !a.detained && Math.random() < .8) { const [x, y] = freeNear(hb.door[0], hb.door[1], 20); a.x = x; a.y = y; R.home++; }
      continue;
    }
    // силовики и службы на базы; остаются посты, вышки, КПП, палатки, герои и федеральные войска
    if (a.hero || a.post || a.cp || a.tent || a.fed || a.detained || a.player) continue;
    if (["army", "police", "medic", "fire", "worker", "builder", "sanitar"].includes(a.role) && !camps.some(c => Math.abs(c.x - a.x) < c.r + 30 && Math.abs(c.y - a.y) < c.r + 30)) { if (a.hideB) campLeave(a); a.state = "saved"; a.leftCity = true; a.hidden = false; a.unit = null; a.withdraw = false; R.forces++; }
  }
  // служебные машины уехали, брошенные и разбитые увезены, техника вывезена
  for (const c of cars) {
    if (c.gone) continue;
    if (c.service) { for (const a of c.crew || []) if (a.unit === c && a.state === "alive") { a.state = "saved"; a.leftCity = true; a.unit = null; } c.crew = []; c.gone = true; c.moving = false; continue; }
    if (c.wreck || c.stopped || c.towedBy) { clearCarCells(c); c.gone = true; c.moving = false; R.cars++; }
  }
  for (const m of machines) m.gone = true; machines = [];
  evac = null; strikes = []; resetSquads();
  // штаб: тревога снята, директив нет, внешнее оцепление и шум города — тоже
  resetResponse(); alertT = simT; hq.known = 0; hq.withdrawnT = 0; challenge = null; chT = 60;
  if (threat) { threat.noise = 0; if (threat.fed) { threat.fed.phase = "lifting"; threat.fed.liftT = simT; } }
  fieldT = 0; barrDirty = true; gridDirty = true;
  logE(`Ночь: тела вывезены (${R.bodies}), машины убраны (${R.cars}), завалы разобраны у ${R.rubble} домов, отремонтировано ${R.repaired}, жители вернулись домой (${R.home}), беженцев осталось ${R.refStay}, уехало ${R.refLeft}${R.turned ? ", обратились за ночь " + R.turned : ""}${R.cured ? ", вылечено " + R.cured : ""}`, "good");
  return R;
}
function campLeave(a) { const b = a.hideB; if (b && b.door) leaveShelter(a, false); else { if (b) b.occ = (b.occ || []).filter(o => o !== a); a.hideB = null; a.hidden = false; a.onRoof = false; } }
// завал вокруг руины вывезен: площадка готова под стройку
function campClearRuin(b) {
  const [x0, y0, x1, y1] = rubbleBounds(null, b);
  for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) if (cellAt(x, y) === 8) clearRubbleAt(b, x, y);
  b.state = "ruin"; b.cT = 0; b.clearAssigned = false; b.rubble0 = undefined; b.clearedT = simT;
  if (typeof onSiteCleared === "function") onSiteCleared(b);
}
// дом снова цел: как в конце стройки (sim7.js)
function campRestore(b) {
  if (b.state !== "ok") campClearRuin(b);
  unfenceSite(b);
  b.state = "ok"; b.hp = b.maxHp; b.scorch = 0; b.fire = 0; b.prog = 1; b.rebuilt = true; b.clearAssigned = false; b.fireAssigned = false; b.gutted = false; b.gutT = 0; b.cT = 0; b.ruinH = 0; b.topple = false; b.impacted = false; b.nest = 0; b.nestT = 0; b.doorHp = b.doorMax || b.doorHp; b.occ = b.occ || [];
  footCells(b, i => { grid[i] = 3; underRubble[i] = 0; });
  if (b.gutDoor || !b.door) { b.gutDoor = false; const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; for (const [x, y] of b.rot !== undefined ? (b.doorPref ? [b.doorPref] : []) : [[cx, b.y1 + 5], [cx, b.y0 - 5], [b.x0 - 5, cy], [b.x1 + 5, cy]]) { const c = cellAt(x, y); if (c === 0 || c === 1 || c === 2 || c === 7) { b.door = [x, y]; break; } } }
  for (const a of agents) if (a.buildB === b) { a.buildB = null; a.done = true; }
}
// строка цели в кампании
function campaignHud() {
  if (!camp) return "";
  const c = lastCounts || counts(), h = world.hour, left = h >= CAMP_HOUR0 ? 30 - h : Math.max(0, 6 - h);
  let s = `День ${camp.day} из ${CAMP_DAYS} · ${hourLabel()} · до утра ${Math.ceil(left)} ч · живых ${c.H + c.I} (не меньше ${CAMP_MIN_POP}) · зомби ${c.Z} · доверие ${campStarsText()}`;
  if (camp.event) s += ` · ${camp.event}`;
  if (c.Z === 0 && !camp.pending && !camp.over) s += " · зомби нет: можно закончить день";
  if (challenge) s += ` · ${challengeText()}`;
  return s;
}
// хроника: итоги по дням
function campaignChronicle() {
  const lines = camp.days.map(d => `День ${d.day}${d.event ? " (" + d.event + ")" : ""}: живых ${d.alive}, погибло ${d.dead}, спасено ${d.saved}, зомби уничтожено ${d.zkills}, разрушено домов ${d.ruinedNew}, доверие ${campStarsText(d.trust)}${d.trustD ? " (" + d.why + ")" : ""}`);
  if (!camp.over && !camp.pending) lines.push(`День ${camp.day} идёт: ${camp.event || "спокойное утро"}, бюджет ${campBudgetText(camp.budget)}`);
  if (camp.over) lines.push(camp.won ? (camp.wonBy === "vac" ? "Кампания выиграна: вакцина получена, город зачищен" : `Кампания выиграна: город выстоял ${CAMP_DAYS} дней`) : "Кампания проиграна");
  return { h: "Дни кампании", lines };
}
// состояние кампании из сохранения (save.js): лимиты дня — из бюджета
function loadCampaignState(S) {
  camp = S.camp || null;
  if (!camp) return;
  if (scen) scen.limits = { ...camp.budget };
  dayN = camp.day; world.cycle = true; world.rate = 24 / 720;
}
