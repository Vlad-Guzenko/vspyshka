/* ---------- жители как люди: имена, возраст, семьи, дом и работа, звонки родным ---------- */
const FIRST_M = ["Иван", "Алексей", "Дмитрий", "Сергей", "Андрей", "Михаил", "Николай", "Павел", "Артём", "Максим", "Егор", "Олег", "Виктор", "Роман", "Кирилл", "Денис", "Владимир", "Юрий", "Антон", "Глеб", "Тимур", "Руслан", "Пётр", "Фёдор", "Степан", "Матвей", "Игорь", "Василий", "Лев", "Марк", "Борис", "Григорий", "Семён", "Арсений", "Даниил"];
const FIRST_F = ["Анна", "Мария", "Елена", "Ольга", "Наталья", "Татьяна", "Ирина", "Светлана", "Екатерина", "Юлия", "Дарья", "Алина", "Вера", "Надежда", "Людмила", "Галина", "Ксения", "Полина", "Софья", "Марина", "Лариса", "Оксана", "Валентина", "Евгения", "Виктория", "Алёна", "Кристина", "Зоя", "Нина", "Инна", "Лидия", "Вероника", "Милана", "Ульяна", "Варвара"];
const LAST = ["Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов", "Новиков", "Морозов", "Волков", "Зайцев", "Павлов", "Семёнов", "Голубев", "Виноградов", "Богданов", "Воробьёв", "Фёдоров", "Михайлов", "Беляев", "Тарасов", "Белов", "Комаров", "Орлов", "Киселёв", "Макаров", "Андреев", "Ковалёв", "Ильин", "Гусев", "Титов", "Кузьмин", "Кудрявцев", "Баранов", "Куликов", "Алексеев", "Степанов", "Яковлев", "Сорокин", "Сергеев", "Романов", "Захаров", "Борисов", "Королёв", "Герасимов", "Пономарёв", "Григорьев", "Лазарев", "Медведев", "Ершов", "Никитин", "Соболев", "Рябов", "Поляков", "Цветков", "Данилов", "Жуков", "Фролов", "Журавлёв"];
function nameFor(a, last) {
  if (!a.sex) a.sex = Math.random() < .5 ? "f" : "m";
  const f = a.sex === "f";
  a.first = pick(f ? FIRST_F : FIRST_M); a.last = (last || pick(LAST)) + (f ? "а" : "");
  a.name = a.first + " " + a.last;
  if (a.years === undefined) a.years = a.age === "kid" ? 5 + Math.floor(Math.random() * 10) : a.age === "old" ? 63 + Math.floor(Math.random() * 22) : 18 + Math.floor(Math.random() * 45);
}
const ROLE_NAME = { civ: "горожанин", police: "полицейский", army: "солдат", medic: "медик", fire: "пожарный", worker: "ремонтник", bandit: "мародёр", zombie: "зомби" };
// семьи: 1–4 человека, общий дом; половина сейчас дома, остальные в городе
let families = [], famMap = {};
function assignHomes() {
  families = []; famMap = {};
  const homes = buildings.map((b, i) => [b, i]).filter(([b]) => b.door && (b.kind === "apt" || b.kind === "house"));
  const works = buildings.map((b, i) => [b, i]).filter(([b]) => b.door && ["tower", "mall", "warehouse", "hospital", "police", "fire"].includes(b.kind));
  const civs = agents.filter(a => a.role === "civ");
  for (let i = civs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [civs[i], civs[j]] = [civs[j], civs[i]]; }
  let i = 0, fid = 1;
  while (i < civs.length) {
    const r = Math.random(), n = Math.min(civs.length - i, r < .28 ? 1 : r < .6 ? 2 : r < .82 ? 3 : 4);
    const hp = homes.length ? pick(homes) : null, last = pick(LAST), members = civs.slice(i, i + n);
    const fam = { id: fid++, last, home: hp ? hp[1] : -1, members: members.map(m => m.id), reunited: false };
    families.push(fam); famMap[fam.id] = fam;
    for (const m of members) {
      m.fam = fam.id; m.home = fam.home; nameFor(m, last);
      if (works.length && !m.age && Math.random() < .7) m.work = pick(works)[1];
      if (hp && Math.random() < .5) { const [x, y] = freeNear(hp[0].door[0], hp[0].door[1], 40); m.x = x; m.y = y; }
    }
    i += n;
  }
  for (const a of agents) if (!a.name) nameFor(a);
}
function agentById(id) { for (const a of agents) if (a.id === id) return a; return null; }
function famLabel(f) { const l = f.last; return l.endsWith("ий") ? l.slice(0, -2) + "их" : l + "ых"; }
// увидев зомби, человек звонит родным: те узнают о вспышке и бегут домой
function alertFamily(a) {
  if (a.called || !a.fam) return; a.called = true;
  if (Math.random() > .6) return;
  const f = famMap[a.fam]; if (!f || f.members.length < 2) return;
  let told = 0;
  for (const id of f.members) { const m = agentById(id); if (!m || m === a || m.state !== "alive" || m.role === "zombie" || m.hidden) continue; m.alert = true; m.panic = Math.max(m.panic, .6); m.homeGoal = true; told++; }
  if (told) { sfx.phone(a); } if (told) logT("call", `${a.name} звонит родным: «${pick(["Не выходите из дома!", "Бегите домой, запритесь!", "Тут кусают людей, я видел своими глазами!", "Запритесь и ждите меня"])}»`, "", 25);
}
function checkReunion(b) {
  for (const o of b.occ) {
    if (!o.fam) continue; const f = famMap[o.fam]; if (!f || f.reunited) continue;
    const here = b.occ.filter(x => x.fam === o.fam).length;
    if (here >= 2 && here >= Math.min(2, f.members.length)) { f.reunited = true; firsts.reunion = true; logE(`Семья ${famLabel(f)} собралась дома`, "good"); }
  }
}
// куда идёт спокойный человек: домой вечером, на работу утром
function civDestination(a) {
  const h = world.hour;
  if (settings.curfew) return a.home >= 0 && buildings[a.home] && buildings[a.home].door ? buildings[a.home].door : null;
  if (h >= 7 && h < 10 && a.work !== undefined && buildings[a.work] && buildings[a.work].door && Math.random() < .5) return buildings[a.work].door;
  if (h >= 17 && h < 23 && a.home >= 0 && buildings[a.home] && buildings[a.home].door) return buildings[a.home].door;
  return null;
}
// лидер собирает паникующих: они идут за ним и в его укрытие
function nearLeader(a) {
  let best = null, bd = 60;
  near(a.x, a.y, 60, b => { if (b.hero === "leader" && b.state === "alive" && b.role !== "zombie" && !b.hidden) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; best = b; } } });
  return best;
}

/* ---------- герои: врач, стрелок, лидер ---------- */
const HERO_KINDS = { doctor: { n: "врач", tip: "Лечит укушенных и раненых рядом" }, sniper: { n: "стрелок", tip: "Винтовка: бьёт точно и далеко" }, leader: { n: "лидер", tip: "Собирает паникующих и уводит в укрытие" } };
let heroes = [];
function pickHeroes() {
  heroes = [];
  const pool = agents.filter(a => a.role === "civ" && !a.age && !a.zero);
  for (const k of Object.keys(HERO_KINDS)) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; if (!a) break;
    a.hero = k; a.stam = 1; a.hp = 100; a.panic = 0; a.kills = 0;
    if (k === "sniper") { arm(a, 10, 60); a.rifle = true; a.cloth = "#4a4f3a"; a.hat = "cap"; }
    if (k === "doctor") { a.role = "medic"; a.cloth = "#e8e8e8"; a.pants = "#2a3a4a"; a.bag = "#8a2a2a"; }
    if (k === "leader") { a.cloth = "#8a2a2a"; a.hat = "bandana"; }
    heroes.push(a);
  }
  if (heroes.length) logE(`В городе есть герои: ${heroes.map(h => `${h.name} (${HERO_KINDS[h.hero].n})`).join(", ")}`, "good");
}
function heroStatus(h) {
  if (h.state === "saved") return "эвакуирован";
  if (h.state === "dead") return h.role === "zombie" ? "упокоен" : "погиб";
  if (h.role === "zombie") return "обратился";
  if (h.hidden) return "в укрытии";
  if (h.bitten) return `укушен, ${Math.ceil(h.incT)} с`;
  return `здоровье ${Math.round(h.hp)}%` + (h.kills ? `, зомби: ${h.kills}` : "") + (h.cures ? `, вылечил: ${h.cures}` : "");
}

/* ---------- штамм: вирус мутирует, пока нет вакцины ---------- */
let strain = { lvl: 1, t: 0 };
const STRAIN_NAMES = ["I", "II", "III", "IV", "V"];
function strainK() { return strain.lvl - 1; }
function stepStrain(dt) {
  if (!firsts.zombie || vaccineReady || strain.lvl >= 5) return;
  strain.t += dt;
  if (strain.t > 240) {
    strain.t = 0; strain.lvl++;
    logE(`Вирус мутировал: штамм ${STRAIN_NAMES[strain.lvl - 1]}. Инкубация короче, зомби видят дальше и чаще бегут`, "bad");
    radio(`Лаборатория: вирус мутирует, это уже штамм ${STRAIN_NAMES[strain.lvl - 1]}. Торопитесь с вакциной`); sfx.radio();
  }
}

/* ---------- плеватель: кислота на расстоянии; Титан: огромный мутант ---------- */
let spits = [], acids = [];
function spit(z, t) {
  const d = Math.hypot(t.x - z.x, t.y - z.y), T = .45 + d / 110;
  spits.push({ x: z.x, y: z.y, tx: t.x + t.vx * T * .5, ty: t.y + t.vy * T * .5, t: 0, T });
  z.spitAnim = .5; sfx.spit(z); interest(z.x, z.y, 2);
}
function acidHit(b, k) {
  b.hp -= 22 * k; b.panic = 1; b.burn = Math.min(1, (b.burn || 0) + .04 * k);
  if (!b.bitten && !b.immune && Math.random() < .45 * k) { b.bitten = true; b.incT = settings.inc * rnd(1.2, 1.8); bites++; logT("acid", "Кислота плевателя заразила человека", "bad", 20); }
  if (Math.random() < k * .8) sfx.pain(b);
  if (b.hp <= 0) kill(b, true, "acid");
}
function stepSpits(dt) {
  for (const s of spits) {
    s.t += dt;
    if (s.t >= s.T) { s.done = true; acids.push({ x: s.tx, y: s.ty, r: 7, l: 9 }); addDecal(s.tx, s.ty, 5, 4); near(s.tx, s.ty, 7, b => { if (b.state === "alive" && b.role !== "zombie" && !b.hidden) acidHit(b, 1); }); }
  }
  spits = spits.filter(s => !s.done);
  for (const ac of acids) { ac.l -= dt; near(ac.x, ac.y, ac.r, b => { if (b.state === "alive" && b.role !== "zombie" && !b.hidden) acidHit(b, dt * .5); }); }
  acids = acids.filter(a => a.l > 0);
}
function spawnTitan(x, y) {
  if (x === undefined) { const e = edgeLanePoint(); x = e.l.s.v ? e.l.c : e.along; y = e.l.s.v ? e.along : e.l.c; }
  const [zx, zy] = freeNear(x, y, 20), a = newAgent("zombie", zx, zy);
  a.ztype = "titan"; turn(a); a.riseT = 0; a.size = 1.15; a.hair = "#2a1a14";
  logE("В город вошёл Титан: огромный мутант, пули его почти не берут. Нужны танки или авиация", "bad");
  radio("Штаб: разведка видит крупного мутанта. Обычное оружие бесполезно, запрашивайте тяжёлую технику"); sfx.titan(a); interest(a.x, a.y, 12);
  return a;
}
function stepTitan(dt) {
  if (firsts.titan || scenKey === "bridges" || scenKey === "hospital") return;
  if ((lastCounts || counts()).Z > 90 && Math.random() < dt * .05) { firsts.titan = true; spawnTitan(); }
}
// Титан расшвыривает машины и людей
function titanRage(a, dt) {
  nearCars(a.x, a.y, 14, c => {
    if (c.gone || c.z > 0 || c.towedBy || c.tank) return;
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    c.wreck = true; if (c.moving) { c.moving = false; c.stopped = true; }
    fillCells(c.x - 9, c.y - 9, c.x + 9, c.y + 9, 0);
    c.vx = Math.cos(ang) * 40; c.vy = Math.sin(ang) * 40; c.vz = 22; c.z = .1; c.sr = rnd(-5, 5); c.sy = rnd(-3, 3); c.roll = c.roll || 0;
    sfx.crash(c); logT("titancar", "Титан отшвырнул машину", "bad", 10); interest(a.x, a.y, 6); fieldT = 0;
  });
}

/* ---------- метро: зомби поднимаются на поверхность ---------- */
let metros = [], metroT = 60;
function placeMetros() {
  metros = [];
  const cands = blocks.filter(b => b.d === 0 || b.kind === "plaza" || b.kind === "towers");
  for (let i = 0; i < 3 && cands.length; i++) {
    const b = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
    const x = b.x0 + 5, y = b.y0 + 5;
    if (cellAt(x, y) === 1 || cellAt(x, y) === 7) metros.push({ x, y, dir: 0 });
  }
}
function stepMetro(dt) {
  if (!metros.length || !firsts.zombie || scenKey === "bridges") return;
  metroT -= dt; if (metroT > 0) return; metroT = 25;
  const c = lastCounts || counts();
  if (c.Z >= 15 && Math.random() < .3) {
    const m = pick(metros), n = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) setTimeout0(i * .7, () => { const z = spawnZombieAt(m.x, m.y); z.riseT = 0; });
    logE("Из метро на поверхность выходят зомби", "bad"); radio("Диспетчер: нападения в метро, станции закрываются. Зомби выходят на улицу"); sfx.radio(); interest(m.x, m.y, 6);
    metroT = rnd(180, 320);
  }
}

/* ---------- склад боеприпасов ---------- */
let depots = [];
function addDepot(x, y) {
  const [dx, dy] = freeNear(x, y, 8);
  depots.push({ x: dx, y: dy, ammo: 600, max: 600 });
  logE("Развёрнут склад боеприпасов: силовики и вооружённые горожане пополняют запас. Берегите его от мародёров", "good");
}
function nearestDepot(a, r = 320) { let best = null, bd = r; for (const d of depots) { if (d.ammo <= 0) continue; const dd = Math.hypot(d.x - a.x, d.y - a.y); if (dd < bd) { bd = dd; best = d; } } return best; }
function stepDepots(dt) {
  for (const d of depots) {
    if (d.ammo <= 0) continue;
    near(d.x, d.y, 9, a => {
      if (a.state !== "alive" || !a.armed || a.role === "zombie" || d.ammo <= 0) return;
      if (a.role === "bandit") { const take = Math.min(d.ammo, 150); d.ammo -= take; a.ammo += take; a.lootT = 2; logT("depotloot", "Мародёры разграбили склад боеприпасов", "bad", 20); return; }
      if (a.ammo >= a.magMax * 3) return;
      const take = Math.min(d.ammo, a.magMax * 3 - a.ammo); a.ammo += take; d.ammo -= take; a.dry = false;
      logT("resupply", `${a.name || "Боец"} пополнил боезапас на складе`, "good", 15);
      if (d.ammo <= 0) logE("Склад боеприпасов опустел", "bad");
    });
  }
}

/* ---------- испытания в свободной игре ---------- */
const CHALLENGES = {
  hunt: { n: "Охота", time: 180, mk: () => ({ need: 40, base: zkills }), text: c => `уничтожь ${c.need} зомби: ${Math.min(c.need, zkills - c.base)}/${c.need}`, ok: c => zkills - c.base >= c.need, can: () => (lastCounts || counts()).Z >= 15 },
  evac: { n: "Спасение", time: 240, mk: () => ({ need: 25, base: saved }), text: c => `вывези вертолётом ${c.need} человек: ${Math.min(c.need, saved - c.base)}/${c.need}`, ok: c => saved - c.base >= c.need, can: () => limitLeft("evac") > 0 },
  hospital: { n: "Защита больницы", time: 180, mk: () => ({}), text: () => "ни одного зомби ближе 100 м к больнице", ok: c => c.left <= 0, fail: () => { const h = special.hospital; if (!h) return true; let n = 0; nearZ(h.x, h.y, 100, () => n++); return n > 0; }, can: () => special.hospital && special.hospital.b.state === "ok" },
  fires: { n: "Пожарная тревога", time: 240, mk: () => ({}), text: () => "потуши все пожары в городе", ok: () => !buildings.some(b => b.fire > 0) && !cars.some(c => c.burnT > 0 && !c.gone), can: () => buildings.filter(b => b.fire > 0).length >= 2 },
  cure: { n: "Милосердие", time: 240, mk: () => ({ need: 5, base: cured }), text: c => `вылечи ${c.need} укушенных: ${Math.min(c.need, cured - c.base)}/${c.need}`, ok: c => cured - c.base >= c.need, can: () => (lastCounts || counts()).I >= 4 },
  hold: { n: "Ни шагу назад", time: 150, mk: () => ({ base: deaths }), text: c => `не больше 10 погибших: ${deaths - c.base}/10`, ok: c => c.left <= 0, fail: c => deaths - c.base > 10, can: () => (lastCounts || counts()).Z >= 8 },
  noair: { n: "Без авиации", time: 180, mk: () => ({ s: uses.strike || 0, nk: uses.nuke || 0 }), text: () => "штаб запрещает авиаудары и ядерное оружие", ok: c => c.left <= 0, fail: c => (uses.strike || 0) > c.s || (uses.nuke || 0) > c.nk, can: () => (lastCounts || counts()).Z >= 20 },
  civ: { n: "Берегите мирных", time: 180, mk: () => ({ base: hq.strayKills || 0 }), text: c => `ни одного мирного от шальных пуль: ${(hq.strayKills || 0) - c.base}/0`, ok: c => c.left <= 0, fail: c => (hq.strayKills || 0) - c.base > 0, can: () => agents.some(a => a.state === "alive" && (a.role === "army" || a.role === "police")) },
  commune: { n: "Защитить коммуну", time: 200, mk: () => ({}), text: () => "лидер коммуны и её штаб должны уцелеть", ok: c => c.left <= 0, fail: () => !factions.some(f => f.kind === "commune"), can: () => factions.some(f => f.kind === "commune") },
  infra: { n: "Сохранить инфраструктуру", time: 240, mk: () => ({}), text: () => "электростанция, водонасосная и радиовышка целы", ok: c => c.left <= 0, fail: () => ["power", "water", "radio"].some(k => special[k] && special[k].b.state !== "ok"), can: () => ["power", "water", "radio"].every(k => !special[k] || special[k].b.state === "ok") && (lastCounts || counts()).Z >= 15 },
};
let challenge = null, chT = 100, chDone = 0, chFail = 0;
function challengeText() { if (!challenge) return ""; const C = CHALLENGES[challenge.k]; return `${C.n}: ${C.text(challenge)} · ${mmss(Math.max(0, challenge.left))}`; }
function stepChallenges(dt) {
  if (scenKey !== "sandbox" || !firsts.zombie || scenDone) return;
  if (challenge) {
    challenge.left -= dt; const C = CHALLENGES[challenge.k];
    if (C.fail && C.fail(challenge)) { chFail++; logE(`Директива «${C.n}» провалена`, "bad"); onBanner("Директива провалена"); hqRep(-1, `провалена директива «${C.n}»`); challenge = null; chT = rnd(90, 150); return; }
    if (C.ok(challenge)) { chDone++; logE(`Директива «${C.n}» выполнена`, "good"); onBanner("Директива выполнена"); sfx.radio(); hqRep(1, `выполнена директива «${C.n}»`); challenge = null; chT = rnd(90, 150); return; }
    if (challenge.left <= 0) { chFail++; logE(`Директива «${C.n}»: время вышло`, "bad"); hqRep(-1, `сорвана директива «${C.n}»`); challenge = null; chT = rnd(90, 150); }
    return;
  }
  chT -= dt; if (chT > 0) return; chT = 30;
  const keys = Object.keys(CHALLENGES).filter(k => CHALLENGES[k].can());
  if (!keys.length) return;
  const k = pick(keys), C = CHALLENGES[k];
  challenge = { k, left: C.time, ...C.mk() };
  logE(`Директива штаба «${C.n}»: ${C.text(challenge)}, ${Math.round(C.time / 60)} мин`, "good"); radio(`Штаб: ${C.n.toLowerCase()} — ${C.text(challenge)}`); sfx.radio();
}

/* ---------- достижения ---------- */
const ACHS = [
  ["barr", "Первый рубеж", "Поставить баррикаду", () => firsts.barr],
  ["z100", "Сотня", "Уничтожить 100 зомби", () => zkills >= 100],
  ["z500", "Пятьсот", "Уничтожить 500 зомби", () => zkills >= 500],
  ["vac", "Прорыв", "Дождаться вакцины", () => vaccineReady],
  ["cure", "Второй шанс", "Вылечить 10 укушенных", () => cured >= 10],
  ["evac", "Воздушный мост", "Вывезти 100 человек вертолётами", () => saved >= 100],
  ["calm", "Тихий город", "Подавить вспышку", () => firsts.end],
  ["fall", "Конец", "Увидеть, как город пал", () => firsts.fall],
  ["nuke", "Последний довод", "Применить ядерный удар", () => firsts.nuke],
  ["tower", "Домино", "Увидеть падение небоскрёба", () => firsts.topple],
  ["titan", "Охотник на титанов", "Уничтожить Титана", () => firsts.titanDead],
  ["family", "Воссоединение", "Семья собралась дома во время вспышки", () => firsts.reunion],
  ["hero", "Легенда", "Герой уничтожил 50 зомби", () => heroes.some(h => (h.kills || 0) >= 50)],
  ["ch3", "Испытатель", "Выполнить 3 испытания", () => chDone >= 3],
  ["ten", "Держимся", "10 минут вспышки и меньше 50 погибших", () => firsts.zombie && simT - (firsts.zombieT || 0) > 600 && deaths < 50],
  ["metro", "Подземка", "Пережить выход зомби из метро", () => firsts.metroSeen],
  ["strain", "Эволюция", "Дожить до штамма III", () => strain.lvl >= 3],
  ["trust", "Доверие", "Поднять доверие штаба до +3", () => hq.rep >= 3],
  ["commune", "Община", "Коммуна выживших дожила до 40 человек", () => factions.some(f => f.kind === "commune" && f.members.length >= 40)],
  ["cp", "Контроль", "КПП выявил 10 укушенных", () => cps.some(c => c.detained >= 10)],
  ["zap", "Под током", "Зомби сгорел на электрозаборе", () => !!lastLog.zap],
  ["day", "Вторые сутки", "Пережить первые сутки вспышки", () => dayN >= 2 && firsts.zombie],
];
let achDone = {}, achT = 0, achNew = [];
try { if (typeof localStorage !== "undefined") achDone = JSON.parse(localStorage.getItem("vspyshka-ach") || "{}"); } catch (e) {}
function stepAch(dt) {
  achT -= dt; if (achT > 0) return; achT = 2;
  for (const [k, n, d, f] of ACHS) {
    let got = false; try { got = !!f(); } catch (e) {}
    if (!got || achDone[k]) continue;
    achDone[k] = Date.now(); achNew.push([n, d]);
    try { if (typeof localStorage !== "undefined") localStorage.setItem("vspyshka-ach", JSON.stringify(achDone)); } catch (e) {}
    logE(`Достижение: ${n}`, "good");
  }
}

/* ---------- хроника: судьбы людей ---------- */
function placeName(x, y) {
  for (const [k, n] of [["hospital", "у больницы"], ["police", "у полицейского участка"], ["mall", "у торгового центра"], ["fire", "у пожарной части"]]) { const s = special[k]; if (s && Math.hypot(s.x - x, s.y - y) < 110) return n; }
  for (const b of bridges) if (x > b.x0 - 10 && x < b.x1 + 10 && y > b.y0 - 10 && y < b.y1 + 10) return "на мосту";
  for (const c of camps) if (Math.abs(c.x - x) < c.r + 20 && Math.abs(c.y - y) < c.r + 20) return "у лагеря";
  for (const [k, n] of [["power", "у электростанции"], ["water", "у водонасосной"], ["radio", "у радиовышки"]]) { const s = special[k]; if (s && Math.hypot(s.x - x, s.y - y) < 90) return n; }
  if (oldTown && Math.hypot(x - oldTown.x, y - oldTown.y) < oldTown.R) return "в старом городе";
  if (bigPark && x > bigPark.x0 && x < bigPark.x1 && y > bigPark.y0 && y < bigPark.y1) return "в городском парке";
  for (const m of metros) if (Math.hypot(m.x - x, m.y - y) < 40) return "у входа в метро";
  const b = blocks.find(b => x >= b.x0 - 12 && x <= b.x1 + 12 && y >= b.y0 - 12 && y <= b.y1 + 12);
  if (!b) return "на окраине";
  return { hill: "на холме", field: "в поле", meadow: "на лугу", forest: "в лесу", bank: "на берегу", park: "в парке", plaza: "на площади", towers: "в центре", houses: "во дворе многоэтажек", suburb: "в частном секторе", industry: "в промзоне", lot: "на парковке", bigpark: "в городском парке" }[b.kind] || "на улице";
}
function causeText(a) {
  if (a.vapor) return "испарился в ядерном взрыве";
  if (a.crushed) return "погиб под завалом";
  if (a.burnt) return "сгорел";
  if (a.deathBy === "acid") return "умер от кислоты плевателя";
  if (a.deathBy === "zombie" || (a.reanimate && a.role !== "zombie")) return "загрызен зомби";
  if (a.deathBy === "conv") return "обратился после укуса";
  if (a.deathBy === "car") return "сбит машиной";
  if (a.deathBy === "shot") return "убит выстрелом";
  if (a.rad > .3) return "умер от лучевой болезни";
  if (a.onFire > 0) return "сгорел";
  return "погиб";
}
function fateLine(a) {
  const who = `${a.name || ROLE_NAME[a.role] || "человек"}${a.years ? `, ${a.years}` : ""}`;
  if (a.removed) return `${who}: ${a.cause ? causeText(a) + ", " : ""}тело увезла санитарная служба`;
  if (a.state === "saved" && a.withdraw) return `${who}: отозван${a.sex === "f" ? "а" : ""} штабом`;
  if (a.state === "saved" && !a.vapor) return `${who}: эвакуирован${a.sex === "f" ? "а" : ""} вертолётом`;
  if (a.state === "dead" && a.role === "zombie" && !a.reanimate) return `${who}: обратил${a.sex === "f" ? "ась" : "ся"}, упокоен${a.sex === "f" ? "а" : ""} ${a.deathWhere || ""} на ${mmss(a.diedT || 0)}`;
  if (a.role === "zombie") return `${who}: обратил${a.sex === "f" ? "ась" : "ся"} и до сих пор бродит по городу`;
  if (a.state === "dead") return `${who}: ${causeText(a)} ${a.deathWhere || ""} на ${mmss(a.diedT || 0)}`.replace(/\s+/g, " ");
  const bits = [];
  if (a.hidden) bits.push(a.onRoof ? "ждёт вертолёта на крыше" : "прячется в доме");
  else if (a.bitten) bits.push("укушен, обратится скоро");
  else bits.push(`жив${a.sex === "f" ? "а" : ""}`);
  if (a.kills) bits.push(`уничтожил${a.sex === "f" ? "а" : ""} зомби: ${a.kills}`);
  if (a.cures) bits.push(`вылечил${a.sex === "f" ? "а" : ""}: ${a.cures}`);
  return `${who}: ${bits.join(", ")}`;
}
function chronicle() {
  const c = counts(), out = [];
  out.push({ h: "Итог", lines: [`${(LAYOUTS[layoutKey] || {}).n || "Город"}, ${mmss(simT)} игры. Укусов ${bites}, погибших ${deaths}, спасено ${saved}, уничтожено зомби ${zkills}, вылечено ${cured}.`, firsts.fall ? "Город пал." : firsts.end ? "Вспышка подавлена." : `Сейчас в городе ${c.Z} зомби и ${c.H + c.I} живых.`] });
  const z = agents.find(a => a.zero); if (z) out.push({ h: "Нулевой пациент", lines: [fateLine(z)] });
  if (heroes.length) out.push({ h: "Герои", lines: heroes.map(h => `${HERO_KINDS[h.hero].n[0].toUpperCase() + HERO_KINDS[h.hero].n.slice(1)} ${fateLine(h)}`) });
  const shooters = agents.filter(a => (a.kills || 0) > 0 && !a.hero).sort((p, q) => q.kills - p.kills).slice(0, 4);
  if (shooters.length) out.push({ h: "Стрелки", lines: shooters.map(a => `${ROLE_NAME[a.role === "zombie" ? "civ" : a.role] || ""} ${fateLine(a)}`) });
  const famLines = [];
  for (const f of families) {
    if (f.members.length < 2) continue;
    const ms = f.members.map(agentById).filter(Boolean), alive = ms.filter(m => m.state === "alive" && m.role !== "zombie").length, savedN = ms.filter(m => m.state === "saved" && !m.vapor).length;
    if (alive + savedN === ms.length && !f.reunited) continue;
    famLines.push(`Семья ${famLabel(f)}: ${alive + savedN === ms.length ? "все живы" : alive + savedN === 0 ? "никто не выжил" : `выжили ${alive + savedN} из ${ms.length}`}${f.reunited ? ", собрались дома" : ""}`);
  }
  if (famLines.length) out.push({ h: "Семьи", lines: famLines.slice(0, 6) });
  const dead = agents.filter(a => a.state === "dead" && a.name && !a.hero && a.role !== "zombie").sort(() => Math.random() - .5).slice(0, 6);
  if (dead.length) out.push({ h: "Судьбы", lines: dead.map(fateLine) });
  const alive = agents.filter(a => a.state === "alive" && a.role === "civ" && a.name && !a.hero && (a.hidden || a.kills)).sort(() => Math.random() - .5).slice(0, 4);
  if (alive.length) out.push({ h: "Выжившие", lines: alive.map(fateLine) });
  return out;
}

/* ---------- пожар перекидывается на соседние дома ---------- */
function stepFireSpread(dt) {
  for (const b of buildings) {
    if (!(b.fire > 0) || b.state !== "ok" || Math.random() > dt * .06) continue;
    const reach = (world.rain || 0) > .5 ? 5 : 15;
    for (const o of buildings) {
      if (o === b || o.fire > 0 || o.state !== "ok") continue;
      const gx = Math.max(b.x0 - o.x1, o.x0 - b.x1, 0), gy = Math.max(b.y0 - o.y1, o.y0 - b.y1, 0);
      if (Math.hypot(gx, gy) < reach && Math.random() < .5) { o.fire = rnd(30, 60); logT("spread", "Огонь перекинулся на соседний дом", "bad", 15); interest((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, 3); break; }
    }
  }
}

/* ---------- стихии для песочницы ---------- */
let meteors = [];
function callMeteor(x, y) { meteors.push({ x, y, t: 2.6, T: 2.6 }); logE("С неба падает метеорит", "bad"); radio("Штаб: объект входит в атмосферу над городом!"); sfx.radio(); interest(x, y, 12); }
function stepMeteors(dt) {
  for (const m of meteors) {
    m.t -= dt;
    if (m.t <= 0 && !m.done) {
      m.done = true; boom(m.x, m.y, 120, true); slowMo(2.5);
      for (const b of buildings) { const d = Math.hypot(Math.max(b.x0 - m.x, 0, m.x - b.x1), Math.max(b.y0 - m.y, 0, m.y - b.y1)); if (d < 160) damageBuilding(b, 500 * (1 - d / 160), m.x, m.y); }
      for (let i = 0; i < 40; i++) addDecal(m.x + rnd(-90, 90), m.y + rnd(-90, 90), rnd(3, 9), 1);
      logE("Метеорит ударил по городу", "bad");
    }
  }
  meteors = meteors.filter(m => !m.done);
}
function startFire(x, y) {
  fires.push({ x, y, r: 16, l: 40 });
  for (const b of buildings) if (b.state === "ok" && x > b.x0 - 14 && x < b.x1 + 14 && y > b.y0 - 14 && y < b.y1 + 14) { b.fire = Math.max(b.fire, 70); first("bfire", "Горит здание", "bad"); }
  for (const c of cars) if (!c.gone && Math.hypot(c.x - x, c.y - y) < 16 && !(c.burnT > 0)) c.burnT = 30;
  logT("arson", "Пожар", "bad", 10); interest(x, y, 4);
}
function spawnHorde(x, y) {
  for (let i = 0; i < 25; i++) { const [zx, zy] = freeNear(x, y, 28); const z = newAgent("zombie", zx, zy); turn(z); z.riseT = 0; }
  logE("Орда зомби появилась в городе", "bad"); interest(x, y, 6);
}
function stepExtras(dt) {
  stepStrain(dt); stepMeteors(dt); stepSpits(dt); stepTitan(dt); stepMetro(dt); stepDepots(dt); stepChallenges(dt); stepAch(dt); stepFireSpread(dt);
  for (const a of agents) if (a.spitAnim > 0) a.spitAnim -= dt;
}
function resetExtras() {
  strain = { lvl: 1, t: 0 }; spits = []; acids = []; meteors = []; metroT = 60; depots = []; challenge = null; chT = 100; chDone = 0; chFail = 0; achNew = []; heroes = []; families = []; famMap = {};
}
