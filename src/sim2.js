/* ---------- жители ---------- */
// роль: civ, zombie, police, army, medic; состояние: alive, dead, saved
let agents = [], nextId = 1, simT = 0, stats = [], events = [], firsts = {}, noises = [];
let bites = 0, deaths = 0, zkills = 0, saved = 0, cured = 0, fieldT = 0, fieldTick = 0, statT = 0, logDirty = true;
let evac = null, strikes = [], fires = [], hasMedics = false;
const settings = { services: true, inc: 20, armed: .05, fast: false, night: false, threats: true };
const CLOTH = ["#b23a3a", "#2f5f9e", "#d9d2c1", "#2a2a2e", "#5c7a45", "#a5702f", "#6b4590", "#cf8337", "#55606a", "#e2e2dc", "#7a2f2f", "#3d7f86"];
const PANTS = ["#2b2f3a", "#3b3f46", "#1d2230", "#5a4a3a", "#6b6f72", "#23324f", "#4a4f3a"];
const HAIR = ["#1a1410", "#3b2616", "#6b4a2a", "#a07a48", "#c9b38a", "#2a2a2a", "#8a8a8a", "#5a2a18"];
const SKIN = ["#e9c3a4", "#d7a77f", "#b07c56", "#7e5438", "#f1d2b8", "#c99572"];
function newAgent(role, x, y) {
  const a = {
    id: nextId++, role, x, y, vx: 0, vy: 0, dir: rnd(0, TAU), hp: 100, state: "alive",
    cloth: pick(CLOTH), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN), size: rnd(.9, 1.08),
    bitten: false, incT: 0, panic: 0, armed: false, mag: 0, magMax: 0, ammo: 0, reload: 0, cd: rnd(0, 1), burst: 0,
    wanderT: 0, wx: 0, wy: 0, idleT: 0, deadT: 0, wakeAt: 1e9, reanimate: false, zhp: 4, phase: rnd(0, TAU), speed: 0,
    feedT: 0, grabT: 0, shotT: -9, aim: 0, aimT: 0, riseT: 0, burnt: false, bleed: 0, z: 0, vz: 0, roll: 0, spin: 0, poolId: -1, poolR: 0, poolMax: 0, goal: null,
    // все поля заданы сразу: объекты одной формы, иначе движок теряет оптимизацию горячих циклов
    sex: Math.random() < .5 ? "f" : "m", age: null, skirt: false, bag: null, short: false, build: 1, longHair: false, beard: false, hat: null, glasses: false, vest: null, pmodel: null,
    name: "", first: "", last: "", years: 0, fam: 0, home: -1, work: undefined, dest: null, homeGoal: false, homeTrip: false, alert: false, called: false,
    hero: null, kills: 0, cures: 0, rifle: false, diedT: 0, deathBy: null, deathWhere: "", spitCd: 0, spitAnim: 0, stam: rnd(.6, 1), hidden: false, onFire: 0, burn: 0,
    ztype: null, stuck: 0, lod: false, dry: false, immune: false, shriek: 0, shriekCd: 0, bash: 0, player: false, hideGoal: null, vacGoal: null, unit: null, job: null, done: false,
    quietT: 0, rad: 0, hostile: 0, loot: null, lootT: 0, muzzle: null, onRoof: false, hideB: null, hideT: 0, roofZ: 0, rx: 0, ry: 0, crushed: false, vapor: false, zero: false, seen: 0,
    depotDone: false, ambAssigned: false, tent: null, buildB: null, workT: 0, tool: 0, spray: 0, sprayAt: null, axe: 0, far: 0, onRoofT: 0,
    order: null, post: null, campGoal: null, inCamp: null, forage: null, carry: 0,
    cpWait: 0, cpAt: null, cpChecked: null, detained: null, faction: 0, bcastT: 0, withdraw: false, zapT: 0, sanitAssigned: false, removed: false, cp: null, sweep: false, guardB: null, clearB: null, clearT: 0, clearScanT: 0, squad: 0, guardJob: null, dz: null, dzT: 0, seenT: -99, body: null, collected: 0, depotT: 0, standDown: false, standT: 0, leftCity: false, stopT: 0,
  };
  if (role === "civ") {
    const r = Math.random();
    if (r < .09) { a.age = "kid"; a.size = rnd(.6, .72); }
    else if (r < .21) { a.age = "old"; a.hair = pick(["#cfcfcf", "#a9a9a9", "#e8e8e8"]); a.size = rnd(.88, .98); }
    if (a.age !== "kid" && a.sex === "f" && Math.random() < .55) { a.skirt = true; a.pants = pick(["#3a2e4a", "#6b2a2a", "#2e3a52", "#5a5a38", "#20242a"]); }
    if (a.age !== "kid" && Math.random() < .22) a.bag = pick(["#3a2a1e", "#6a4a2a", "#1e1e22", "#8a2a2a", "#c9b38a"]);
    a.short = Math.random() < .35;
    // телосложение и мелочи внешности
    a.build = a.age === "kid" ? 1 : rnd(.86, 1.18); a.size *= a.sex === "f" ? .96 : 1.02;
    if (a.sex === "f" && Math.random() < .6) a.longHair = true;
    if (a.sex === "m" && a.age !== "kid" && Math.random() < .3) a.beard = true;
    if (Math.random() < .18) a.hat = a.sex === "f" && Math.random() < .5 ? "hood" : pick(["cap", "beanie", "cap"]);
    if (Math.random() < .12) a.glasses = true;
    if (a.age !== "kid" && Math.random() < settings.armed) arm(a, 6, 6);
  } else a.build = rnd(.95, 1.12);
  if (role === "police") { arm(a, 15, 30); a.cloth = "#1f3c78"; a.pants = "#1a2a4a"; a.hair = "#14203d"; a.vest = "#141c30"; a.hat = "police"; }
  if (role === "army") { arm(a, 30, 180); a.cloth = "#55603a"; a.pants = "#4d5634"; a.hair = "#3f4a2a"; a.vest = "#3f4a2a"; a.hat = "helmet"; }
  if (role === "medic") { a.cloth = "#f2f2f2"; a.pants = "#e8e8e8"; a.vest = "#e03a2a"; }
  if (role === "sanitar") { a.cloth = "#d8dcd8"; a.pants = "#cfd4d0"; a.vest = "#4a8a5a"; a.hat = "hood"; }
  if (role === "bandit") { a.hat = Math.random() < .6 ? "bandana" : "hood"; }
  if (role !== "civ") nameFor(a);
  agents.push(a); return a;
}
function arm(a, mag, reserve) { a.armed = true; a.mag = mag; a.magMax = mag; a.ammo = reserve; }
function randomFree() { for (let k = 0; k < 400; k++) { const x = rnd(10, W - 10), y = rnd(10, H - 10), c = cellAt(x, y); if (c === 1 || c === 2 || c === 7 || (c === 0 && roadMask[Math.floor(y / CS) * GW + Math.floor(x / CS)] !== 1)) return [x, y]; } return [W / 2, H / 2]; }
function freeNear(x, y, r = 30) { for (let k = 0; k < 200; k++) { const xx = x + rnd(-r, r), yy = y + rnd(-r, r); if (!blocked(xx, yy) && cellAt(xx, yy) !== 8 && (k > 120 || roadMask[Math.floor(yy / CS) * GW + Math.floor(xx / CS)] !== 1)) return [xx, yy]; } return randomFree(); }

/* ---------- пространственная сетка соседей ---------- */
const HC = 32, HW = Math.ceil(MAX_W / HC), HH = Math.ceil(MAX_H / HC);
const hHead = new Int32Array(HW * HH).fill(-1); let hNext = new Int32Array(4096);
// отдельная крупная сетка только для живых зомби: людям нужно искать лишь их
const ZC = 64, ZW = Math.ceil(MAX_W / ZC), ZH = Math.ceil(MAX_H / ZC);
const zhash = Array.from({ length: ZW * ZH }, () => []);
function rebuildHash() {
  hHead.fill(-1);
  if (hNext.length < agents.length) hNext = new Int32Array(agents.length * 2);
  for (const c of zhash) c.length = 0;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (a.state === "saved") continue;
    let gx = (a.x / HC) | 0, gy = (a.y / HC) | 0; if (gx < 0) gx = 0; else if (gx >= HW) gx = HW - 1; if (gy < 0) gy = 0; else if (gy >= HH) gy = HH - 1;
    const ci = gy * HW + gx; hNext[i] = hHead[ci]; hHead[ci] = i;
    if (a.state === "alive" && a.role === "zombie" && !(a.riseT > 0) && !a.hidden) zhash[clamp(Math.floor(a.y / ZC), 0, ZH - 1) * ZW + clamp(Math.floor(a.x / ZC), 0, ZW - 1)].push(a);
  }
}
function nearZ(x, y, r, fn) {
  const x0 = clamp(Math.floor((x - r) / ZC), 0, ZW - 1), x1 = clamp(Math.floor((x + r) / ZC), 0, ZW - 1), y0 = clamp(Math.floor((y - r) / ZC), 0, ZH - 1), y1 = clamp(Math.floor((y + r) / ZC), 0, ZH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const c = zhash[gy * ZW + gx]; for (let i = 0; i < c.length; i++) fn(c[i]); }
}
function near(x, y, r, fn) {
  const x0 = clamp(Math.floor((x - r) / HC), 0, HW - 1), x1 = clamp(Math.floor((x + r) / HC), 0, HW - 1), y0 = clamp(Math.floor((y - r) / HC), 0, HH - 1), y1 = clamp(Math.floor((y + r) / HC), 0, HH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (let i = hHead[gy * HW + gx]; i >= 0; i = hNext[i]) fn(agents[i]);
}

/* ---------- журнал ---------- */
// интересные события для кинокамеры
let interests = [];
function interest(x, y, w) { interests.push({ x, y, w, t: simT }); if (interests.length > 60) interests.shift(); }
function logE(text, cls) { events.unshift({ t: simT, text, cls }); if (events.length > 80) events.pop(); logDirty = true; }
const lastLog = {};
function logT(key, text, cls, gap = 12) { if (simT - (lastLog[key] ?? -1e9) < gap) return; lastLog[key] = simT; logE(text, cls); }
function first(key, text, cls = "bad") { if (firsts[key]) return; firsts[key] = true; logE(text, cls); }

/* ---------- укус, смерть, обращение ---------- */
function bite(z, h) {
  if (h.role === "army" && Math.random() < .3) { z.zhp -= 1; z.vx -= Math.cos(z.dir) * 12; z.vy -= Math.sin(z.dir) * 12; return; } // отбился прикладом
  h.hp -= rnd(18, 35) * (z.ztype === "titan" ? 3 : 1); h.grabT = .8; h.panic = 1;
  if (z.ztype === "titan") { const ang = Math.atan2(h.y - z.y, h.x - z.x); h.vx = Math.cos(ang) * 40; h.vy = Math.sin(ang) * 40; h.vz = 10; h.z = .1; }
  addDecal(h.x + rnd(-2, 2), h.y + rnd(-2, 2), rnd(1.5, 3), 0);
  fxBlood(h.x, h.y, 4.5, 8);
  sfx.scream(h); sfx.bite(h); sfx.pain(h); interest(h.x, h.y, 2); report(h.x, h.y, "attack");
  if (h.immune) { if (h.hp <= 0) kill(h, false); return; }
  if (!h.bitten) { h.bitten = true; h.incT = settings.inc * rnd(.7, 1.3) * (1 - .12 * strainK()); bites++; first("bite", "Первый укус"); }
  h.bleed = Math.max(h.bleed, 8);
  if (h.hp <= 0) { kill(h, true); z.feedT = rnd(4, 8); }
  else if (Math.random() < .55) { // вырвался и убежал — обратится позже, уже в другом месте
    h.grabT = 0; z.cd = rnd(1.5, 2.5);
    const ang = Math.atan2(h.y - z.y, h.x - z.x); h.vx = Math.cos(ang) * 15; h.vy = Math.sin(ang) * 15;
  }
}
function kill(a, byZombie, why) {
  if (a.state !== "alive") return;
  a.state = "dead"; a.deadT = 0; a.reanimate = byZombie || a.bitten; a.wakeAt = rnd(8, 18);
  a.diedT = simT; a.deathBy = why || (byZombie ? "zombie" : a.onFire > 0 ? "fire" : a.deathBy); a.deathWhere = placeName(a.x, a.y);
  if (a.hero && a.role !== "zombie") logE(`Погиб${a.sex === "f" ? "ла" : ""} ${a.name}, ${HERO_KINDS[a.hero].n}`, "bad");
  a.poolId = addDecal(a.x, a.y, 1, 0); a.poolR = 1; a.poolMax = rnd(4, 7);
  if (a.role !== "zombie") { deaths++; first("death", "Первая смерть"); }
  if (a.role === "police" || a.role === "army") logT("lost" + a.role, a.role === "army" ? "Погиб солдат" : "Погиб полицейский", "bad", 6);
}
function destroyZombie(a, burn) {
  if (a.state !== "alive") return;
  a.state = "dead"; a.deadT = 0; a.reanimate = false; a.wakeAt = 1e9; zkills++; a.diedT = simT; a.deathWhere = placeName(a.x, a.y);
  if (a.ztype === "titan") { firsts.titanDead = true; logE("Титан уничтожен", "good"); interest(a.x, a.y, 8); }
  if (!burn) { a.poolId = addDecal(a.x, a.y, 1, 2); a.poolR = 1; a.poolMax = rnd(2.5, 4); }
  first("zkill", "Первый зомби уничтожен", "good");
}
const ZTYPES = [["walker", .55], ["runner", .14], ["brute", .09], ["screamer", .08], ["crawler", .09], ["spitter", .05]];
function rollZType() { let r = Math.random(); const k = strainK() * .04; for (const [t, p0] of ZTYPES) { const p = t === "runner" ? p0 + k : t === "walker" ? p0 - k : p0; if ((r -= p) < 0) return t; } return "walker"; }
function turn(a) {
  a.ztype = a.ztype || rollZType(); a.bag = null; a.glasses = false; if (a.hat === "cap" || a.hat === "beanie") a.hat = null;
  if (a.hero && a.role !== "zombie") logE(`${a.name}, ${HERO_KINDS[a.hero].n}, обратил${a.sex === "f" ? "ась" : "ся"}`, "bad");
  a.role = "zombie"; a.state = "alive"; a.hp = 100; a.zhp = 4 + (Math.random() * 3 | 0); a.bitten = false; a.armed = false; a.panic = 0; a.homeGoal = false; a.dest = null; a.hideGoal = null;
  a.unit = null; a.job = null; a.squad = 0; a.order = null; a.post = null; a.guardB = null; a.guardJob = null; a.cp = null; a.standDown = false;
  a.riseT = 1.4; a.bleed = 0; a.feedT = 0; a.shriek = 0;
  if (a.ztype === "brute") a.zhp = 14; if (a.ztype === "crawler") a.zhp = 2; if (a.ztype === "runner") a.zhp = 3; if (a.ztype === "titan") a.zhp = 90; interest(a.x, a.y, 3);
  if (!firsts.zombie) firsts.zombieT = simT;
  first("zombie", "Первый зомби восстал");
  sfx.groan(a);
}

/* ---------- стрельба ---------- */
function clearShot(s, t) {
  if (s.role === "civ") return true;
  const dx = t.x - s.x, dy = t.y - s.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  let ok = true;
  near((s.x + t.x) / 2, (s.y + t.y) / 2, L / 2 + 8, b => {
    if (!ok || b === s || b === t || b.state !== "alive" || b.role === "zombie" || b.hidden) return;
    const px = b.x - s.x, py = b.y - s.y, al = px * ux + py * uy, pe = Math.abs(px * uy - py * ux);
    if (al > 3 && al < L + 8 && pe < 3.5) ok = false;
  });
  if (!ok) s.cd = .3;
  return ok || Math.random() < .04;
}
function shoot(s, t) {
  const army = s.role === "army" || s.tank, police = s.role === "police";
  s.burst++; s.cd = army ? (s.burst % 3 ? .1 : rnd(.45, .7)) : police ? rnd(.5, .8) : rnd(.8, 1.3);
  s.mag--; s.shotT = simT; cityNoise(army ? .03 : .02);
  noises.push({ x: s.x, y: s.y, t: simT, r: army ? 320 : 240 });
  const d = Math.hypot(t.x - s.x, t.y - s.y), moving = Math.hypot(t.vx, t.vy) > 10 ? .85 : 1;
  const sniper = s.hero === "sniper";
  const nightK2 = settings.night && !litAt(t.x, t.y) ? (settings.dark ? .5 : .7) : 1;
  const acc = clamp((army ? .85 : sniper ? .92 : police ? .6 : .4) * (1 - d / (sniper ? 600 : 360)) * nightK2 * moving * (t.ztype === "crawler" ? .55 : 1) * (t.ztype === "titan" ? 1.3 : 1) * (s.post ? 1.15 : 1), .05, .95);
  sfx.shot(s);
  const ang = Math.atan2(t.y - s.y, t.x - s.x);
  if (Math.random() < acc) {
    const head = Math.random() < (army ? .3 : sniper ? .4 : police ? .18 : .05), titan = t.ztype === "titan";
    if (head) t.zhp = titan ? t.zhp - 4 : 0; else t.zhp -= titan ? .5 : 1;
    if (!titan) { t.vx += Math.cos(ang) * 10; t.vy += Math.sin(ang) * 10; }
    fxHit(t.x, t.y, head ? 6.4 : 4.6, ang);
    if (Math.random() < .5) addDecal(t.x + Math.cos(ang) * rnd(2, 6), t.y + Math.sin(ang) * rnd(2, 6), rnd(.6, 1.4), 2);
    if (t.zhp <= 0) { destroyZombie(t, false); s.kills = (s.kills || 0) + 1; }
    fxShot(s, t.x, t.y, true);
  } else {
    // промах: пуля летит дальше и может задеть мирного на линии огня
    const a2 = ang + rnd(-.07, .07), L = d + rnd(20, 60), hx = s.x + Math.cos(a2) * L, hy = s.y + Math.sin(a2) * L;
    const ux = Math.cos(a2), uy = Math.sin(a2);
    let victim = null;
    near((s.x + hx) / 2, (s.y + hy) / 2, L / 2 + 10, b => {
      if (victim || b === s || b.state !== "alive" || b.role === "zombie" || b.hidden) return;
      const px = b.x - s.x, py = b.y - s.y, al = px * ux + py * uy, pe = Math.abs(px * uy - py * ux);
      if (al > 5 && al < L && pe < 2.5 && Math.random() < .35) victim = b;
    });
    if (victim) {
      victim.hp -= rnd(40, 80); victim.bleed = 10; fxHit(victim.x, victim.y, 4.6, a2); sfx.pain(victim);
      logT("stray", victim.role === "civ" ? "Шальная пуля ранила горожанина" : "Огонь по своим", "bad");
      if (victim.hp <= 0) { kill(victim, false, "shot"); hq.strayKills = (hq.strayKills || 0) + 1; }
      fxShot(s, victim.x, victim.y, true);
    } else fxShot(s, hx, hy, false);
  }
  if (police || army) first("fire_" + s.role, army ? "Военные открыли огонь" : "Полиция открыла огонь", "good");
}

/* ---------- поведение ---------- */
function ignite(a) { if (!(a.onFire > 0)) { a.onFire = rnd(4, 9); if (a.role !== "zombie") { a.panic = 1; first("burn", "Люди горят заживо", "bad"); } } }
function sightR(a) { const night = settings.night && !(a && litAt(a.x, a.y)); return (night ? (settings.dark ? 60 : 85) : 150) * (settings.vis || 1) * (1 + .12 * strainK()) * (a && a.post ? 2 : 1); }
function wander(a, dt) {
  // прогулка вдоль улиц: идём по прямой, на перекрёстках иногда сворачиваем, иногда стоим
  a.wanderT -= dt;
  // спокойный пешеход не сходит с тротуара на проезжую часть (кроме зебры): перед кромкой дороги поворачивает
  const calm = a.panic < .3 && a.role !== "zombie", onRoad = (x, y) => { const i = clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1); return grid[i] === 0 && roadMask[i] === 1 && !crossMask[i]; };
  const hi = clamp(Math.floor(a.y / CS), 0, GH - 1) * GW + clamp(Math.floor(a.x / CS), 0, GW - 1), here = calm && grid[hi] === 0 && roadMask[hi] === 1;
  // препятствие смотрим и вплотную (5), и впереди (9): дерево в одну клетку между ними пешеход иначе не видит и упирается в него вечно
  const ahead = blocked(a.x + a.wx * 5, a.y + a.wy * 5) || blocked(a.x + a.wx * 9, a.y + a.wy * 9) || (calm && !here && onRoad(a.x + a.wx * 9, a.y + a.wy * 9));
  if (a.idleT > 0) { a.idleT -= dt; if (here) a.idleT = 0; else return [0, 0, 0]; }
  if (a.wanderT <= 0 || ahead || (a.wx === 0 && a.wy === 0)) {
    if (!ahead && !here && a.wanderT <= 0 && Math.random() < .18 && a.role === "civ") { a.idleT = rnd(2, 7); a.wanderT = rnd(3, 8); return [0, 0, 0]; }
    let opts = NB4.filter(([dx, dy]) => !blocked(a.x + dx * 5, a.y + dy * 5) && !blocked(a.x + dx * 12, a.y + dy * 12) && !blocked(a.x + dx * 24, a.y + dy * 24) && cellAt(a.x + dx * 24, a.y + dy * 24) !== 9 && !vehicleAt(a.x + dx * 8, a.y + dy * 8));
    // мирные не лезут на завалы и пепелища, если стоят не на них
    if (a.role === "civ" && cellAt(a.x, a.y) !== 8) { const safe = opts.filter(([dx, dy]) => cellAt(a.x + dx * 12, a.y + dy * 12) !== 8 && cellAt(a.x + dx * 24, a.y + dy * 24) !== 8); if (safe.length) opts = safe; }
    // спокойный пешеход идёт по тротуару и редко переходит дорогу
    if (calm) { const walk = opts.filter(([dx, dy]) => !onRoad(a.x + dx * 12, a.y + dy * 12) && !onRoad(a.x + dx * 24, a.y + dy * 24)); if (walk.length) opts = walk; else if (here) { const off = opts.filter(([dx, dy]) => !onRoad(a.x + dx * 24, a.y + dy * 24)); if (off.length) opts = off; } }
    const fwd = opts.find(([dx, dy]) => dx === Math.sign(Math.round(a.wx)) && dy === Math.sign(Math.round(a.wy)));
    const back = opts.filter(([dx, dy]) => !(dx === -Math.round(a.wx) && dy === -Math.round(a.wy)));
    const ch = fwd && !ahead && Math.random() < .6 ? fwd : pick(back.length ? back : opts.length ? opts : NB4);
    a.wx = ch[0]; a.wy = ch[1]; a.wanderT = rnd(2, 7);
  }
  if (a.panic < .3 && cellAt(a.x, a.y) !== 0 && cellAt(a.x + a.wx * 9, a.y + a.wy * 9) === 0) {
    let car = false; nearCars(a.x, a.y, 45, c => { if (c.moving && c.v > 6) car = true; });
    if (car) return [0, 0, 0];
  }
  return [a.wx, a.wy, 1];
}
function thinkZombie(a, dt) {
  const zk = { walker: 1, runner: settings.fast ? 1.15 : 2.8, brute: .7, screamer: 1, crawler: .42, spitter: .9, titan: settings.fast ? .55 : .85 }[a.ztype || "walker"];
  const sight = sightR(a), base = (settings.fast ? 20 : 6) * zk * (1 + .06 * strainK());
  a.shriek = Math.max(0, (a.shriek || 0) - dt); a.shriekCd = (a.shriekCd || 0) - dt; a.spitCd = (a.spitCd || 0) - dt;
  if (a.riseT > 0) { a.riseT -= dt; return [0, 0, 0]; }
  if (a.ztype === "titan") titanRage(a, dt);
  let best = null, bd = sight;
  near(a.x, a.y, sight, b => {
    if (b.state !== "alive" || b.role === "zombie" || b.hidden || b.post) return;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < bd && (d < 14 || los(a.x, a.y, b.x, b.y))) { bd = d; best = b; }
  });
  if (best) {
    a.feedT = 0; a.goal = null;
    // крикун созывает всех вокруг
    if (a.ztype === "screamer" && a.shriekCd <= 0) { a.shriekCd = 14; a.shriek = 2; noises.push({ x: a.x, y: a.y, t: simT, r: 480 }); sfx.shriek(a); logT("shriek", "Крикун созвал толпу", "bad", 20); }
    if (a.ztype === "titan" && a.shriekCd <= 0) { a.shriekCd = 20; a.shriek = 2; noises.push({ x: a.x, y: a.y, t: simT, r: 600 }); sfx.titan(a); }
    if (a.ztype === "spitter" && bd > 12 && bd < 70 && a.spitCd <= 0 && los(a.x, a.y, best.x, best.y)) { a.spitCd = rnd(4, 7); spit(a, best); return [best.x - a.x, best.y - a.y, 0]; }
    if (bd < (a.ztype === "titan" ? 9 : 5)) { if (a.cd <= 0) { a.cd = rnd(.9, 1.4); bite(a, best); } return [best.x - a.x, best.y - a.y, .3]; }
    const sp = bd < 14 ? Math.max(base * 1.25, 12) : base * 1.25; // рывок на последних метрах
    const ux = (best.x - a.x) / bd, uy = (best.y - a.y) / bd;
    if (bd > 10 && (blocked(a.x + ux * 7, a.y + uy * 7) || a.speed < 1.5 && a.stuck > .5)) { const d = fieldDir(fH, a.x, a.y, false); if (d) return [d[0], d[1], sp]; }
    return [ux, uy, sp];
  }
  if (a.feedT > 0) { a.feedT -= dt; return [0, 0, 0]; }
  // зомби идут на звук выстрелов
  let nz = null, nd = 1e9;
  for (const n of noises) { const d = Math.hypot(n.x - a.x, n.y - a.y); if (d < n.r && d < nd) { nd = d; nz = n; } }
  const toward = (tx, ty, sp) => { const d = Math.hypot(tx - a.x, ty - a.y) || 1, ux = (tx - a.x) / d, uy = (ty - a.y) / d; if (a.stuck < .6 && !blocked(a.x + ux * 7, a.y + uy * 7)) return [ux, uy, sp]; const f = fieldDir(fH, a.x, a.y, false); if (f) return [f[0], f[1], sp]; const w = wander(a, dt); return [w[0], w[1], sp * .6]; };
  if (nz && nd > 15) return toward(nz.x, nz.y, base);
  // зомби орды с окраин идут к своему въезду
  if (a.mig) { const r = hordeMove(a, base); if (r) return r; }
  // ночью зомби тянутся к свету прожекторов
  if (settings.night) { const f = nearestFlood(a.x, a.y, 260); if (f && Math.hypot(f.x - a.x, f.y - a.y) > 30) return toward(f.x, f.y, base * .8); }
  const sb = zombieShelterTarget(a);
  if (sb) { const d = Math.hypot(sb.door[0] - a.x, sb.door[1] - a.y); if (d < 7) { bashDoor(a, sb, dt); return [sb.door[0] - a.x, sb.door[1] - a.y, .2]; } return toward(sb.door[0], sb.door[1], base * .9); }
  const fv = fieldVal(fH, a.x, a.y);
  if (fv < 45) { const d = fieldDir(fH, a.x, a.y, false); if (d) return [d[0], d[1], base * .9]; }
  const w = wander(a, dt); return [w[0], w[1], base * .45 * w[2]];
}
function thinkHuman(a, dt) {
  const sight = sightR(a);
  if (a.grabT > 0) { a.grabT -= dt; return [0, 0, 0]; }
  if (a.cpWait > 0) { a.cpWait -= dt; if (a.cpWait <= 0) a.cpWait = -1; return [0, 0, 0]; } // стоит на проверке
  if (a.cpWait < 0 && (!a.cpAt || Math.hypot(a.cpAt.x - a.x, a.cpAt.y - a.y) > 20)) a.cpWait = 0;
  if (a.bcastT > 0) a.bcastT -= dt;
  if (a.busGoal) { const r = busBoard(a, dt); if (r) return r; } // идёт к автобусу или скорой и садится
  if (a.standDown && a.order && a.role !== "army" && a.role !== "police") return goTo(a, a.order.x, a.order.y, 9); // отбой: медики едут на базу
  if (a.onFire > 0) { if (a.wanderT > .6) a.wanderT = .6; const w = wander(a, dt); a.idleT = 0; return [w[0] + rnd(-.5, .5), w[1] + rnd(-.5, .5), 15]; } // горящий мечется
  let zd = 1e9, zn = null, fx = 0, fy = 0, spN = null, spD = 100;
  // спокойный прохожий принимает бредущего зомби за пьяного, пока тот не подойдёт вплотную
  const lit = !settings.night || litAt(a.x, a.y);
  const fac = a.faction ? factionOf(a) : null;
  const aware = a.panic > .3 || a.role === "army" || a.role === "police" ? sight : (settings.fast ? 34 : 12) * (lit ? 1 : settings.dark ? .45 : .65);
  nearZ(a.x, a.y, aware, b => {
    if (b.state !== "alive") return;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const behind = aware < sight && d > 6 && (Math.cos(a.dir) * (b.x - a.x) + Math.sin(a.dir) * (b.y - a.y)) < -.2 * d; // спокойный не смотрит назад
    if (d < aware && !behind && (d < 12 || a.post || los(a.x, a.y, b.x, b.y))) { fx -= (b.x - a.x) / (d * d + 1); fy -= (b.y - a.y) / (d * d + 1); if (d < zd) { zd = d; zn = b; } if (b.ztype === "spitter" && d < spD) { spD = d; spN = b; } }
  });
  if (zn) {
    a.panic = 1;
    if (simT - a.seenT > 20) {
      a.seenT = simT;
      if (a.role === "civ" && Math.random() < .35) report(zn.x, zn.y, "attack"); // звонок в 112
      if (a.role === "civ") { sfx.scream(a); near(a.x, a.y, 60, b => { if (b.role === "civ" && b.state === "alive" && !b.hidden) b.panic = Math.max(b.panic, .8); }); alertFamily(a); }
    }
  }
  // перезарядка
  if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0) { const n = Math.min(a.magMax, a.ammo); a.mag = n; a.ammo -= n; } }
  if (a.armed && a.mag === 0 && a.ammo > 0 && a.reload <= 0) a.reload = a.role === "army" ? 2.4 : 2;
  if (a.armed && a.mag === 0 && a.ammo === 0 && !a.dry) { a.dry = true; if (a.role !== "civ") logE(a.role === "army" ? "У солдата кончились патроны" : "У полицейского кончились патроны"); }
  const range = (a.role === "army" ? 230 : a.hero === "sniper" ? 260 : a.role === "police" ? 170 : 70) + (a.post ? 90 : 0);
  if (a.armed && a.mag > 0 && a.reload <= 0 && zn && zd < range) {
    if (zd < 120 || a.post || a.hero === "sniper") { a.aim = Math.atan2(zn.y - a.y, zn.x - a.x); a.aimT = .8; }
    { const tz = a.role === "army" && spN && zd > 12 ? spN : zn; if (a.cd <= 0 && clearShot(a, tz)) shoot(a, tz); }
  }
  if (acids.length) for (const ac of acids) { const dx = a.x - ac.x, dy = a.y - ac.y, d = Math.hypot(dx, dy); if (d < ac.r + 2.5) { const l = d || 1; return [dx / l, dy / l, 14]; } }
  const hurt = clamp(a.hp / 100, .45, 1) * (1 - (a.burn || 0) * .4) * (a.bitten && a.incT < 4 ? .5 : 1);
  const flee = () => { const d = fieldDir(fZ, a.x, a.y, true); const l = Math.hypot(fx, fy) || 1; return [fx / l * 1.5 + (d ? d[0] : 0), fy / l * 1.5 + (d ? d[1] : 0), 17 * hurt]; };
  if (a.zoneEvac && a.role === "civ") { const r = zoneEvacMove(a, zn, zd); if (r) return r; }
  if (a.refCol && a.role === "civ") { const r = refugeeMove(a, zn, zd); if (r) return r; }
  if (a.role === "fire" || a.role === "worker" || a.role === "sanitar" || a.role === "builder") { const r = a.unit ? thinkCrew(a, dt, zn, zd) : null; if (r) return r; }
  if (a.role === "bandit") { if (zn && zd < 25 && !(a.mag + a.ammo > 0)) return flee(); const r = thinkBandit(a, dt, zn, zd); if (!(zn && a.mag > 0 && zd < 110)) return r; }
  // в панике — в ближайший дом, пока дверь цела; за лидером — в его укрытие
  if (a.role === "civ" && !a.hero && a.panic > .5 && !a.hideGoal && zn && Math.random() < dt * 1.5) { const ld = nearLeader(a); if (ld) { if (ld.hideGoal) a.hideGoal = ld.hideGoal; else if (Math.hypot(ld.x - a.x, ld.y - a.y) > 10 && zd > 12) return goTo(a, ld.x, ld.y, 15 * hurt); } }
  if (a.role === "civ" && !a.armed && a.panic > .5 && zn && zd < 80 && !a.hideGoal && Math.random() < dt * (a.hero === "leader" ? 2 : .8)) { a.hideGoal = findShelter(a); if (a.hideGoal && a.hero === "leader") { near(a.x, a.y, 50, b => { if (b.role === "civ" && b.state === "alive" && !b.hidden && !b.hideGoal) b.hideGoal = a.hideGoal; }); logT("rally", `${a.name} уводит людей в укрытие`, "good", 20); } }
  if (a.hideGoal) {
    const b = a.hideGoal;
    if (!b.door || b.doorHp <= 0 || b.state !== "ok" || b.occ.length >= b.cap) a.hideGoal = null;
    else { const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y); if (d < 5) { enterShelter(a, b); a.hideGoal = null; return [0, 0, 0]; } if (!zn || zd > 10) return goTo(a, b.door[0], b.door[1], 16 * hurt); }
  }
  if (a.vacGoal && !zn) { const t = a.vacGoal; if (a.immune) a.vacGoal = null; else return goTo(a, t.x + rnd(-3, 3), t.y + rnd(-3, 3), 6); }
  // отозванный штабом отряд идёт к своему грузовику, если зомби не ближе 60 м
  if (a.unit && a.role === "army" && a.unit.recall && !a.order && !(zn && zd < 60)) { a.done = true; return goTo(a, a.unit.x, a.unit.y, 11); }
  if (a.unit && (a.role === "medic" || a.role === "police") && !a.order) {
    a.quietT = zn ? 0 : (a.quietT || 0) + dt;
    if (a.quietT > 30) a.done = true;
    if (a.done && !zn) return goTo(a, a.unit.x, a.unit.y, 9);
  }
  const fighter = (a.role === "army" || a.role === "police") && (a.mag + a.ammo) > 0;
  if (fighter && !zn && a.mag > 0 && a.reload <= 0) { let bd = 150, bt = null; near(a.x, a.y, 150, b => { if (b.state === "alive" && b.role === "bandit" && b.hostile > 0 && !b.hidden) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd && los(a.x, a.y, b.x, b.y)) { bd = d; bt = b; } } }); if (bt) { a.aim = Math.atan2(bt.y - a.y, bt.x - a.x); a.aimT = .8; if (a.cd <= 0) shootHuman(a, bt); return [0, 0, 0]; } }
  if (fighter) {
    if (a.post) return [0, 0, 0];
    // приказ: идти на позицию (стреляя на ходу) и держать её
    if (a.order) { const d = Math.hypot(a.order.x - a.x, a.order.y - a.y); if (zn && zd < 14) return flee(); if (d > 7) return goTo(a, a.order.x, a.order.y, 10); return [0, 0, 0]; }
    if (zn && zd < 18) return flee();
    if (zn && zd < range) return [0, 0, 0];
    if (a.sweep && a.role === "army" && (!a.squad || !squadOf(a) || squadOf(a).leader === a.id)) { const r = armyClear(a, dt); if (r) return r; }
    if (a.role === "army" && a.squad) { const r = squadMove(a, dt, zn, zd); if (r) return r; }
    if (a.ammo < a.magMax && depots.length) { const d = nearestDepot(a); if (d) return goTo(a, d.x, d.y, 9); }
    const fv = fieldVal(fZ, a.x, a.y);
    if (fv < (a.role === "army" ? (a.sweep ? 1e9 : 130) : 70)) { const d = fieldDir(fZ, a.x, a.y, false); if (d) return [d[0], d[1], a.role === "army" ? (a.sweep ? 12 : 10) : 9]; }
    const w = wander(a, dt); return [w[0], w[1], 6 * w[2]];
  }
  if (a.armed && a.mag + a.ammo > 0 && zn && zd > (a.hero === "sniper" ? 25 : fac ? 14 : 40) && zd < range) return [0, 0, 0];
  if (zn) return flee();
  // коммунар: стреляет по мародёрам, держится у штаба
  if (fac && fac.kind === "commune") {
    if (a.armed && a.mag > 0 && a.reload <= 0) { let bt = null, bd = 90; near(a.x, a.y, 90, b => { if (b.state === "alive" && b.role === "bandit" && !b.hidden) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd && los(a.x, a.y, b.x, b.y)) { bd = d; bt = b; } } }); if (bt) { a.aim = Math.atan2(bt.y - a.y, bt.x - a.x); a.aimT = .8; if (a.cd <= 0) { shootHuman(a, bt); logT("defend", "Коммуна отбивается от мародёров", "good", 20); } return [0, 0, 0]; } }
    const hb = buildings[fac.hq];
    if (hb && hb.door && !a.forage) { const d = Math.hypot(hb.door[0] - a.x, hb.door[1] - a.y); if (d > 70) return goTo(a, hb.door[0] + rnd(-20, 20), hb.door[1] + rnd(-20, 20), 8); }
  }
  // слух об опасности: уходим из зоны
  let dz = null; if (a.role === "civ") { a.dzT -= dt; if (a.dzT <= 0) { a.dzT = .5; a.dz = dangers.length ? inDanger(a) : null; } dz = a.dz; }
  if (dz && !a.dest && !a.homeGoal && !a.campGoal && !a.hideGoal && !a.forage && !(a.bcastT > 0) && !(evac && evac.landed)) { const dd = Math.hypot(a.x - dz.x, a.y - dz.y) || 1; return [(a.x - dz.x) / dd, (a.y - dz.y) / dd, 12 * hurt]; }
  if (a.armed && a.role === "civ" && a.ammo < a.magMax && depots.length) { const d = nearestDepot(a, 200); if (d) return goTo(a, d.x, d.y, 7); }
  if (a.role === "medic") {
    let tgt = null, td = 1e9;
    near(a.x, a.y, 30, b => { if (b.state === "alive" && b.bitten && b !== a && !b.hidden) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < td) { td = d; tgt = b; } } });
    let hurtP = null; near(a.x, a.y, 60, b => { if (!hurtP && b !== a && b.state === "alive" && !b.hidden && b.role === "civ" && !b.bitten && (b.hp < 60 || b.burn > .15)) hurtP = b; });
    if (!tgt && hurtP) { if (Math.hypot(hurtP.x - a.x, hurtP.y - a.y) < 6) { hurtP.grabT = .3; if (a.cd <= 0) { a.cd = 2; hurtP.hp = Math.min(100, hurtP.hp + 25); hurtP.burn = Math.max(0, (hurtP.burn || 0) - .15); hurtP.bleed = 0; logT("treat", "Медики оказали помощь раненому", "good", 20); sendToHospital(a, hurtP); } return [0, 0, 0]; } return goTo(a, hurtP.x, hurtP.y, 10); }
    if (tgt && td < 7) {
      tgt.grabT = Math.max(tgt.grabT, .3);
      if (a.cd <= 0) {
        a.cd = 2.5;
        if ((vaccineReady || tgt.incT > settings.inc * .35) && Math.random() < (vaccineReady ? .95 : .7)) { if (vaccineReady) tgt.immune = true; tgt.bitten = false; tgt.bleed = 0; tgt.hp = Math.min(100, tgt.hp + 30); cured++; a.cures = (a.cures || 0) + 1; first("cure", "Медики спасли укушенного", "good"); if (a.hero) logT("herocure", `${a.name} спас${a.sex === "f" ? "ла" : ""} укушенного`, "good", 20); }
        else if (Math.random() < .3) logT("late", "Медики не успели: инфекция зашла слишком далеко");
      }
      return [0, 0, 0];
    }
    if (fieldVal(fInf, a.x, a.y) < FAR) { const d = fieldDir(fInf, a.x, a.y, false); if (d) return [d[0], d[1], 12]; }
  }
  if (evac && evac.landed && !evac.leaving && a.role === "civ" && fieldVal(fE, a.x, a.y) < 260) {
    if (Math.hypot(a.x - evac.x, a.y - evac.y) < 14 && evac.cap > 0) { a.state = "saved"; saved++; evac.cap--; if (saved === 1) logE("Первые спасённые на борту вертолёта", "good"); return [0, 0, 0]; }
    const d = fieldDir(fE, a.x, a.y, false); if (d) return [d[0], d[1], (a.panic > .3 ? 15 : 9) * hurt];
  }
  // вылазка за припасами: к источнику еды и обратно домой
  if (a.forage) {
    const f = a.forage;
    if (f.stage === 0) { if (Math.hypot(f.src.x - a.x, f.src.y - a.y) < 9) { f.stage = 1; a.carry = 40; if (f.src.kind === "depot" || f.src.kind === "camp") { if (f.src.c) f.src.c.food -= 30; } logT("forageok", `${a.name} набрал${a.sex === "f" ? "а" : ""} припасов`, "good", 20); } else return goTo(a, f.src.x, f.src.y, zn ? 15 : 9); }
    else { const h = f.home, hx = h.door ? h.door[0] : h.x, hy = h.door ? h.door[1] : h.y + h.r + 4; if (Math.hypot(hx - a.x, hy - a.y) < 6) { if (h.door) { if (h.state === "ok" && h.occ.length < h.cap) { h.food = (h.food || 0) + a.carry; enterShelter(a, h); } } else { h.food += a.carry; a.inCamp = h; } a.forage = null; a.carry = 0; logT("foragehome", "Припасы доставлены в укрытие", "good", 20); return [0, 0, 0]; } return goTo(a, hx, hy, zn ? 15 : 9); }
  }
  // лагерь: через ворота внутрь, внутри гуляем, не выходя
  if (a.role === "civ" && a.campGoal) {
    const c = a.campGoal;
    if (campOf(a.x, a.y) === c) { a.campGoal = null; a.inCamp = c; }
    else { const gx = c.gate[0], gy = c.gate[1] + 10; if (Math.hypot(gx - a.x, gy - a.y) > 8) { const d = fieldDir(fC, a.x, a.y, false); if (d) return [d[0], d[1], a.panic > .3 ? 13 : 7]; return goTo(a, gx, gy, a.panic > .3 ? 13 : 7); } return goTo(a, c.x, c.y - 10, 8); }
  }
  if (a.inCamp && !a.forage) { const c = a.inCamp; if (!campOf(a.x, a.y)) { if (Math.abs(a.x - c.x) > c.r + 14 || Math.abs(a.y - c.y) > c.r + 14) { a.inCamp = null; a.campGoal = c; } else return goTo(a, c.x, c.y, 7); } else if (Math.random() < dt * .15) { a.dest = [c.x + rnd(-c.r + 12, c.r - 12), c.y + rnd(-c.r + 12, c.r - 12)]; } if (a.dest) { const d = Math.hypot(a.dest[0] - a.x, a.dest[1] - a.y); if (d < 5) { a.dest = null; a.idleT = rnd(4, 15); } else return goTo(a, a.dest[0], a.dest[1], 5); } if (a.idleT > 0) { a.idleT -= dt; return [0, 0, 0]; } return [0, 0, 0]; }
  // домой: узнал о вспышке от родных или вечер; на работу утром
  if (a.role === "civ" && a.homeGoal) {
    const b = buildings[a.home];
    if (!b || !b.door || b.state !== "ok" || b.doorHp <= 0 || b.occ.length >= b.cap) a.homeGoal = false;
    else { const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y); if (d < 5) { a.homeGoal = false; a.homeTrip = true; enterShelter(a, b); checkReunion(b); return [0, 0, 0]; } return goTo(a, b.door[0], b.door[1], (a.panic > .3 ? 13 : 7) * hurt); }
  }
  if (a.role === "civ" && a.bcastT > 0 && a.dest) { const d = Math.hypot(a.dest[0] - a.x, a.dest[1] - a.y); if (d < 7) { a.dest = null; a.bcastT = 0; a.idleT = rnd(20, 60); } else return goTo(a, a.dest[0], a.dest[1], 9 * hurt); }
  if (a.role === "civ" && a.busWait) { const r = busWaitStep(a, dt, zn); if (r) return r; } // ждёт автобус на остановке (sim20.js)
  if (a.role === "civ" && a.panic < .3) {
    if (!a.dest && a.idleT <= 0 && busLines.length && !settings.curfew && alert < 3 && Math.random() < dt * .003 && busWaitStart(a)) return [0, 0, 0];
    if (!a.dest && a.idleT <= 0 && Math.random() < dt * .02) a.dest = civDestination(a);
    if (a.dest) { const d = Math.hypot(a.dest[0] - a.x, a.dest[1] - a.y); if (d < 7) { a.dest = null; a.idleT = rnd(15, 60); } else return goTo(a, a.dest[0], a.dest[1], 5.5 * hurt); }
  }
  const w = wander(a, dt);
  return [w[0], w[1], (a.panic > .3 ? 13 : 5.5) * hurt * w[2]];
}
function move(a, mx, my, sp, dt) {
  // выносливость: спринт выдыхается через полминуты, зомби не устают
  if (a.role !== "zombie") {
    if (sp > 7) { sp = 6.8 + (sp - 6.8) * clamp(a.stam / .35); a.stam = Math.max(0, a.stam - dt / 28); }
    else a.stam = Math.min(1, a.stam + dt / 45);
  }
  if (a.role !== "zombie") sp *= a.age === "old" ? .68 : a.age === "kid" ? .9 : 1;
  if (a.role === "civ" && sp > 0 && !a.hidden && onRoadway(a.x, a.y)) sp *= 1.5; // через дорогу торопятся
  const l = Math.hypot(mx, my);
  let tx = 0, ty = 0;
  if (l > 1e-3 && sp > 0) { tx = mx / l * sp; ty = my / l * sp; }
  // личное пространство: расталкивание соседей
  near(a.x, a.y, 5, b => {
    if (b === a || b.state !== "alive" || b.hidden) return;
    const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 4) { tx += dx / d * 10; ty += dy / d * 10; }
  });
  const k = Math.min(1, dt * (a.role === "zombie" ? 3 : 6));
  a.vx += (tx - a.vx) * k; a.vy += (ty - a.vy) * k;
  let slow = cellAt(a.x, a.y) === 8 ? .55 : 1; // по завалам приходится карабкаться
  if (hasHills) slow *= slopeK(a.x, a.y, a.x + a.vx * dt, a.y + a.vy * dt); // в гору медленнее
  const nx = a.x + a.vx * dt * slow, ny = a.y + a.vy * dt * slow;
  const noRub = a.role !== "zombie" && cellAt(a.x, a.y) !== 8;
  let car = null;
  if (!blocked(nx, a.y) && !(car = vehicleAt(nx, a.y)) && cellAt(nx, a.y) !== 9 && !(noRub && cellAt(nx, a.y) === 8)) a.x = nx; else { a.vx *= -.2; a.wanderT = 0; }
  if (!blocked(a.x, ny) && !(car = car || vehicleAt(a.x, ny)) && cellAt(a.x, ny) !== 9 && !(noRub && cellAt(a.x, ny) === 8)) a.y = ny; else { a.vy *= -.2; a.wanderT = 0; }
  // упёрся в стоящую машину (нос на зебре) — обходит её вдоль кузова к ближнему концу, а не стоит перед ней
  if (car && a.role !== "zombie" && car.v < 4) {
    const cx = Math.cos(car.ang), cy = Math.sin(car.ang), al = (a.x - car.x) * cx + (a.y - car.y) * cy, sg = al >= 0 ? 1 : -1;
    a.vx = cx * sg * 5; a.vy = cy * sg * 5; const sx = a.x + a.vx * dt, sy = a.y + a.vy * dt;
    if (!blocked(sx, sy) && !vehicleAt(sx, sy)) { a.x = sx; a.y = sy; }
  }
  a.speed = Math.hypot(a.vx, a.vy);
  a.stuck = sp > 2 && a.speed < 1.5 ? (a.stuck || 0) + dt : 0;
  if (a.stuck > 2 && !a.hidden && !a.onRoof && blocked(a.x, a.y)) { const [fx, fy] = freeNear(a.x, a.y, 12); a.x = fx; a.y = fy; a.stuck = 0; }
  const want = a.aimT > 0 ? a.aim : a.speed > 1.5 ? Math.atan2(a.vy, a.vx) : a.dir;
  let dd = want - a.dir; dd -= Math.round(dd / TAU) * TAU;
  a.dir += dd * Math.min(1, dt * 8);
}
function stepBody(a, dt) {
  // тело, отброшенное взрывом: летит по дуге, кувыркается, скользит по асфальту
  if (a.z > 0 || a.vz !== 0 || Math.abs(a.vx) + Math.abs(a.vy) > .5) {
    a.vz -= 39 * dt; a.z += a.vz * dt; a.roll += a.spin * dt;
    if (a.z <= 0) { a.z = 0; if (a.vz < -8) { a.vz *= -.25; a.spin *= .5; addDecal(a.x, a.y, rnd(1, 2), a.burnt ? 1 : 0); } else a.vz = 0; a.vx *= 1 - Math.min(1, dt * 4); a.vy *= 1 - Math.min(1, dt * 4); a.spin *= 1 - Math.min(1, dt * 3); }
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
    if (!blocked(nx, a.y) || a.z > 14) a.x = clamp(nx, 2, W - 2); else a.vx *= -.3;
    if (!blocked(a.x, ny) || a.z > 14) a.y = clamp(ny, 2, H - 2); else a.vy *= -.3;
  }
}
function step(dt) {
  simT += dt;
  rebuildHash();
  noises = noises.filter(n => simT - n.t < 8);
  fieldT -= dt;
  if (fieldT <= 0) {
    fieldT = .5;
    const Z = [], Hm = [], I = [];
    hasMedics = false;
    for (const a of agents) {
      if (a.role === "medic" && a.state === "alive") hasMedics = true; if (a.state !== "alive") continue; if (a.role === "zombie") Z.push(a); else if (!a.hidden && !a.post) { Hm.push(a); if (a.bitten) I.push(a); } }
    // поля на всю карту (заражённые для медиков, лагеря) считаются по очереди раз в секунду: на большой карте они вдвое дороже
    fieldTick ^= 1;
    bfs(fZ, Z, 0, 140); if (Z.length) bfs(fH, Hm, 1, 64); if (hasMedics && fieldTick) bfs(fInf, I, 0, 520); if (evac) bfs(fE, [evac], 0, 280); if (camps.length && !fieldTick) bfs(fC, camps.map(c => ({ x: c.gate[0], y: c.gate[1] + 10 })), 0, 520); // дальше ~1,3 км пешком поле не считаем
  }
  for (const a of agents) {
    if (a.state === "saved") continue;
    if (a.state === "dead") {
      a.deadT += dt; stepBody(a, dt);
      if (a.reanimate && !a.burnt && a.deadT > a.wakeAt) turn(a);
      continue;
    }
    a.cd -= dt; a.aimT -= dt; a.panic = Math.max(0, a.panic - dt * .05);
    if (a.hidden) {
      if (a.role === "bandit" && a.lootT > 0) { a.lootT -= dt; if (a.lootT <= 0) { a.hidden = false; a.loot = null; a.bag = pick(["#3a2a1e", "#1e1e22", "#8a6a2a"]); logT("loot", "Мародёры вынесли добычу", "bad", 25); } }
      if (!a.hideB && !a.detained && !a.onBus && !(a.role === "bandit" && a.lootT > 0)) { a.hidden = false; a.onRoof = false; } // никто не остаётся невидимым без укрытия
      if (a.onBus && a.onBus !== funicular && (a.onBus.gone || !cars.includes(a.onBus))) { a.hidden = false; a.onBus = null; } // вагон фуникулёра — не машина
      if (a.bitten && a.role !== "zombie") { a.incT -= dt; if (a.incT <= 0) { turn(a); a.riseT = 0; if (a.detained) a.detained.detained--; } }
      if (a.onRoof && a.hideB) { a.x = a.rx; a.y = a.ry; a.dir += dt * .3; }
      a.speed = 0; continue;
    }
    let m;
    if (a.role === "zombie") {
      m = a.player ? playerMove(a, dt) : thinkZombie(a, dt);
      // упёрся в баррикаду — ломает её
      if (m[2] > 0) {
        const l = Math.hypot(m[0], m[1]) || 1, gx = Math.floor((a.x + m[0] / l * 6) / CS), gy = Math.floor((a.y + m[1] / l * 6) / CS);
        if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && grid[gy * GW + gx] === 6) {
          const gi = gy * GW + gx; const zap = zapZombie(a, gi, dt); bhp[gi] -= dt * 3 * (a.ztype === "brute" ? 5 : a.ztype === "titan" ? 40 : 1) * (zap ? .2 : 1); a.bash = .3; barrDirty = true;
          if (bhp[gi] <= 0) { grid[gi] = 0; fieldT = 0; first("breach", "Зомби прорвали баррикаду"); fxDebris(gx * CS + 4, gy * CS + 4); sfx.crash(); }
        }
      }
      a.bash = Math.max(0, (a.bash || 0) - dt);
    } else {
      if (a.player) {
        if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0) { const n = Math.min(a.magMax - a.mag, a.ammo); a.mag += n; a.ammo -= n; } }
        if (a.grabT > 0) { a.grabT -= dt; m = [0, 0, 0]; } else m = playerMove(a, dt);
      } else { m = thinkHuman(a, dt); if (a.role === "civ" && a.panic < .3 && !a.unit && m[2] > 0) m = zebraWait(a, m); }
      if (a.post) { m = [0, 0, 0]; a.x = a.post.x; a.y = a.post.y; }
      if (a.state !== "alive") continue;
      if (a.bitten) {
        a.incT -= dt;
        if (a.incT <= 0) { a.state = "dead"; a.deadT = 0; a.reanimate = true; a.wakeAt = 3; deaths++; a.diedT = simT; a.deathBy = "conv"; a.deathWhere = placeName(a.x, a.y); logT("conv", "Укушенный упал в судорогах", "bad", 20); continue; }
      }
      if (a.bleed > 0) { a.bleed -= dt; if (Math.random() < dt * 2) addDecal(a.x + rnd(-1, 1), a.y + rnd(-1, 1), rnd(.3, .7), 0); }
      if (a.hp < 100 && !(a.burn > .2)) a.hp = Math.min(100, a.hp + dt * .4);
    }
    // огонь: кто в очаге — загорается, ожоги копятся
    for (const f of fires) if (Math.hypot(a.x - f.x, a.y - f.y) < f.r) { ignite(a); a.hp -= dt * 18; a.burn = Math.min(1, (a.burn || 0) + dt * .1); }
    if (a.onFire > 0) {
      a.onFire -= dt; a.burn = Math.min(1, (a.burn || 0) + dt * .09);
      if (a.role === "zombie") a.zhp -= dt * .3; else { a.hp -= dt * 9; if (Math.random() < dt * 1.5) sfx.scream(a); }
      near(a.x, a.y, 4, b => { if (b !== a && b.state === "alive" && Math.random() < dt * .6) ignite(b); });
    }
    if (a.role !== "zombie" && a.burn > .45) a.hp -= dt * (a.burn - .4) * 2.2; // ожоговый шок
    if (a.role === "zombie" ? a.zhp <= 0 : a.hp <= 0) { if (a.burn > .5) a.burnt = true; if (a.role === "zombie") destroyZombie(a, a.burn > .5); else kill(a, false); }
    if (a.state !== "alive") continue;
    move(a, m[0], m[1], m[2], dt);
    if (a.player && typeof fps !== "undefined") a.dir = fps.yaw;
    a.phase += a.speed * dt * (a.role === "zombie" ? .45 : .56);
  }
  rebuildCarHash(); stepTraffic(dt); stepServices(dt); stepTanks(dt); stepFunicular(dt); stepBuildings(dt); stepTimers(dt);
  for (const s of strikes) { s.t -= dt; if (s.t <= 0 && !s.done) { s.done = true; boom(s.x, s.y, 70, true); } }
  strikes = strikes.filter(s => !s.done);
  for (const c of cars) if (c.boomT > 0) { c.boomT -= dt; if (c.boomT <= 0) { c.exploded = true; boom(c.x, c.y, c.tanker ? 64 : 32, !!c.tanker); c.burnT = 40; fires.push({ x: c.x, y: c.y, r: c.tanker ? 18 : 10, l: 40 }); if (c.tanker) logE("Взорвался бензовоз", "bad"); } }
  for (const c of cars) if (c.burnT > 0) { c.burnT -= dt; if (c.tanker && !c.exploded && !(c.boomT > 0)) c.boomT = rnd(2, 5); }
  for (const f of fires) f.l -= dt;
  fires = fires.filter(f => f.l > 0);
  if (evac) stepEvac(dt);
  statT -= dt; if (statT <= 0) { statT = 1; record(); }
  stepShelters(dt); stepRoutine(dt); stepResearch(dt); stepTents(dt); stepWalls(dt); stepGangs(dt); stepExtras(dt); stepBuild(dt); stepWorld2(dt); stepThreats(dt); stepResponse(dt); stepAuto(dt); stepSquads(dt);
  for (const a of agents) if (a.hostile > 0) a.hostile -= dt;
  stepScenario(dt); stepNuke(dt); stepConstruction(dt); stepMachines(dt);
}
function boom(x, y, R, big) {
  interest(x, y, big ? 9 : 5); cityNoise(big ? R / 2 : R / 6);
  if (R >= 30) addDanger(x, y, R * 2.2, big ? 240 : 120);
  fxBoom(x, y, R); sfx.boom(x, y, big);
  for (const a of agents) {
    if (a.state === "saved" || (a.hidden && !a.onRoof) || a.post) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d > R) continue;
    const k = 1 - d / R;
    if (a.state === "alive") { if (a.role === "zombie") { if (a.ztype === "titan" && !big) { a.zhp -= 30; if (a.zhp <= 0) destroyZombie(a, true); else continue; } else destroyZombie(a, true); } else kill(a, false, "blast"); }
    a.reanimate = false; if (d < R * .7) a.burnt = true;
    const ang = Math.atan2(a.y - y, a.x - x) + rnd(-.3, .3);
    a.vx = Math.cos(ang) * (25 + 60 * k); a.vy = Math.sin(ang) * (25 + 60 * k); a.vz = 15 + 45 * k; a.spin = rnd(-12, 12); a.z = Math.max(a.z, .1);
  }
  for (let gy = Math.floor((y - R) / CS); gy <= Math.floor((y + R) / CS); gy++) for (let gx = Math.floor((x - R) / CS); gx <= Math.floor((x + R) / CS); gx++) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx;
    if (grid[i] === 6 && Math.hypot(gx * CS + 4 - x, gy * CS + 4 - y) < R) { grid[i] = 0; barrDirty = true; }
  }
  for (const b of buildings) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1);
    if (Math.hypot(dx, dy) < R * .6 && big) { b.fire = Math.max(b.fire, rnd(40, 70)); first("bfire", "Горит здание", "bad"); }
  }
  blastWorld(x, y, R, big); trapBlast(x, y, R);
  for (const t of tanks) if (Math.hypot(t.x - x, t.y - y) < R * .6) { t.hp -= big ? 120 : 15; if (t.hp <= 0) { logE("Танк уничтожен", "bad"); t.dead = true; } }
  addDecal(x, y, R * .65, 1);
  for (let i = 0; i < 18; i++) addDecal(x + rnd(-R, R) * .9, y + rnd(-R, R) * .9, rnd(2, 7), 1);
  fires.push({ x, y, r: R * .5, l: big ? 14 : 8 });
  fieldT = 0;
  if (big) logE("Авиаудар", "bad");
}
function stepEvac(dt) {
  const e = evac;
  if (e.leaving) { e.alt += dt * 14; e.hx += e.lx * dt * 30; e.hy += e.ly * dt * 30; e.lt -= dt; if (e.lt <= 0) evac = null; return; }
  if (!e.landed) {
    const d = Math.hypot(e.x - e.hx, e.y - e.hy);
    if (d > 2) { const s = Math.min(d, dt * 60); e.hx += (e.x - e.hx) / d * s; e.hy += (e.y - e.hy) / d * s; e.yaw = Math.atan2(e.y - e.hy, e.x - e.hx); }
    else { e.alt = Math.max(0, e.alt - dt * 18); if (e.alt === 0) { e.landed = true; logE("Вертолёт эвакуации приземлился", "good"); } }
  } else {
    e.t -= dt;
    let threat = false; near(e.x, e.y, 40, b => { if (b.state === "alive" && b.role === "zombie" && !b.hidden && !(b.riseT > 0) && Math.hypot(b.x - e.x, b.y - e.y) < 40) threat = true; });
    if (e.t <= 0 || e.cap <= 0 || threat) {
      logE(threat ? `Зомби у вертолёта, взлёт. Спасено ${e.capMax - e.cap}` : `Вертолёт улетел, спасено ${e.capMax - e.cap}`, "good");
      e.leaving = true; e.lt = 9; const a = rnd(0, TAU); e.lx = Math.cos(a); e.ly = Math.sin(a); e.yaw = a;
    }
  }
}
function counts() {
  let H = 0, I = 0, Z = 0, F = 0;
  for (const a of agents) {
    if (a.state !== "alive") continue;
    if (a.role === "zombie") Z++; else if (a.bitten) I++; else H++;
    if (a.role === "army" || a.role === "police") F++;
  }
  F += tanks.filter(t => t.hp > 0).length;
  return { H, I, Z, D: deaths, S: saved, F };
}
function record() {
  const c = counts(); stats.push(c); if (stats.length > 900) stats.shift();
  if (!firsts.end && c.Z + c.I === 0 && firsts.zombie && !agents.some(a => a.state === "dead" && a.reanimate && !a.burnt)) { firsts.end = true; logE("Вспышка подавлена", "good"); onBanner("Вспышка подавлена"); }
  if (!firsts.fall && c.H === 0 && c.Z > 0) { firsts.fall = true; logE("Город пал", "bad"); onBanner("Город пал"); }
}
// нулевой пациент: не в промзоне и не в порту среди контейнеров, а там, где есть люди вокруг — иначе вспышка глохнет
function pickPatientZero() {
  const quiet = { industry: 1, lot: 1, bigpark: 1, field: 1, meadow: 1, forest: 1, bank: 1, hill: 1 };
  const inQuiet = a => { const b = blockAt(a.x, a.y); return !!(b && (quiet[b.kind] || b.rural)); };
  let cand = agents.filter(a => !a.armed && a.role === "civ");
  if (!cand.length) cand = agents.slice();
  const lively = cand.filter(a => !inQuiet(a));
  if (lively.length) cand = lively;
  const R = 90;
  const scored = cand.map(a => { let n = 0; for (const b of agents) if (b !== a && Math.abs(b.x - a.x) < R && Math.abs(b.y - a.y) < R) n++; return [n, a]; });
  scored.sort((p, q) => q[0] - p[0]);
  // не самый людный — так интереснее, но из верхней трети, чтобы заражение точно пошло
  return pick(scored.slice(0, Math.max(1, Math.ceil(scored.length / 3))))[1];
}
function newCitySim(n) {
  genCity(); buildCrossings();
  agents = []; stats = []; events = []; firsts = {}; noises = []; simT = 0; bites = 0; deaths = 0; zkills = 0; saved = 0; cured = 0;
  evac = null; strikes = []; fires = []; barrDirty = true; tanks = []; timers = []; reports = []; armyWaves = 0; machines = []; nuke = null; radZones = [];
  research = 0; scientists = 0; vaccineReady = false; tents = []; wallMask.fill(0); postMask.fill(0); quarMask.fill(0); zoneOf.fill(0); zoneSeq = 0; wallJobs = []; gangsSpawned = 0; computeDoors();
  spawnTraffic(trafficN()); spawnLineBuses();
  for (const k in lastLog) delete lastLog[k];
  resetExtras(); resetBuild(); resetWorld2(); resetThreats(); resetResponse(); resetAuto(); resetSquads(); resetServices2(); placeMetros();
  for (let i = 0; i < n; i++) { let p = randomFree(); for (let k = 0; k < 8 && Math.random() > .1 + cityK(p[0], p[1]) * .9; k++) p = randomFree(); newAgent("civ", p[0], p[1]); }
  assignHomes(); seedBusWaiters();
  const p0 = pickPatientZero(); pickHeroes(); p0.bitten = true; p0.incT = settings.inc; p0.zero = true;
  logE("Нулевой пациент где-то в городе. Он ещё не знает, что заражён", "bad");
  fieldT = 0; record(); logDirty = true;
  return p0;
}
