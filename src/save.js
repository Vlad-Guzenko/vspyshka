/* ---------- сохранение и загрузка партии ---------- */
const SAVE_SLOTS = 3;
const b64 = arr => { let s = ""; const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (str, Type) => { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Type(u.buffer); };
// ссылки на объекты превращаем в индексы и обратно
const B_KEYS = ["x0", "y0", "x1", "y1", "kind", "floors", "style", "fire", "scorch", "hp", "maxHp", "state", "ruinH", "cT", "rot", "w", "d", "cx", "cy", "ridge", "prog", "door", "cap", "doorHp", "doorMax", "rebuilt", "gutted", "gutDoor", "doorPref", "gutT", "food", "hungryT", "topple", "fallAng", "fallT", "fallMax", "impacted", "fallZone", "hitX", "hitY", "lot", "doorFixT", "front", "clearedT", "demoT", "siteCells", "beds", "patients", "nest", "nestT", "lotRect", "pitch", "blown", "shape", "farm", "faceSgn"];
const A_SKIP = new Set(["busGoal", "onBus", "busWait", "ride", "unit", "job", "hideB", "hideGoal", "vacGoal", "loot", "buildB", "tent", "muzzle", "goal", "wx", "wy", "aim", "aimT", "shotT", "burst", "spin", "roll", "vz", "stuck", "far", "phase", "quietT", "dry", "poolId", "poolR", "poolMax", "seen", "body", "carried", "cpAt", "cpChecked", "detained", "cp", "post", "forage", "campGoal", "inCamp", "guardB", "clearB", "guardJob"]);
function serializeGame() {
  if (typeof fps !== "undefined" && fps.on && fps.mode === "drive") exitCar(); // машина игрока сохраняется стоящей, игрок — рядом с ней
  const bi = new Map(buildings.map((b, i) => [b, i]));
  const inCar = new Set(); for (const c of cars) if (c.service && !c.gone) for (const a of c.crew || []) if (a.unit === c) inCar.add(a);
  const agentsS = agents.map(a => {
    const o = {}; for (const k in a) if (!A_SKIP.has(k)) o[k] = a[k];
    if (a.hideB) o.hideB = bi.get(a.hideB); if (a.player) o.player = false; if (inCar.has(a)) o.inCar = true; o.squad = 0; if (a.onBus) o.hidden = false;
    return o;
  });
  const carsS = cars.filter(c => !c.gone && !c.service && !c.towedBy).map(c => {
    const o = {}; for (const k in c) if (!["lane", "job", "crew", "towedBy", "goal", "bar", "turn", "next", "next2", "route", "gas", "trip", "park", "passengers", "line", "stopI", "stopK", "stopT0", "yieldTo", "holdBy", "home"].includes(k)) o[k] = c[k]; // yieldTo — ссылка на машину: при сохранении в момент уступки получался цикл
    // на перекрёстке — переносим на начало следующей полосы; на заправке — обратно в полосу, с которой заехала
    if (c.turn) { o.lane = c.turn.to.id; o.s = laneStart(c.turn.to); } else if (c.gas && c.gas.pts) { o.lane = c.gas.l.id; o.s = c.gas.s; } else o.lane = c.lane ? c.lane.id : -1;
    o.over = 0; o.latOff = 0; o.latTgt = 0; o.atLine = false; return o;
  });
  return {
    v: 3, date: Date.now(), layoutKey, mapSize, relief, scen: scenKey, scenT, uses, simT, bites, deaths, zkills, saved, cured, nextId, wave, waveT, pz: patientZero ? patientZero.id : null,
    wallJobs: wallJobs.map(j => ({ ...j, cp: cps.indexOf(j.cp) })), zones: b64(zoneOf.subarray(0, GW * GH)), zoneSeq,
    grid: b64(grid.subarray(0, GW * GH)), snow: snowD && snowCells.size ? [...snowCells].map(i => [i, +snowD[i].toFixed(2), snowUnder[i]]) : null, bhp16: b64(Uint16Array.from(bhp.subarray(0, GW * GH), v => clamp(Math.round(v), 0, 65535))), wall: b64(wallMask.subarray(0, GW * GH)),
    buildings: buildings.map(b => Object.fromEntries(B_KEYS.filter(k => b[k] !== undefined).map(k => [k, b[k]]))),
    roads: { nodes: RN.map(n => [n.x, n.y, n.off || 0, n.cul ? 1 : 0]), edges: RE.map(e => [e.a.id, e.b.id, e.pts, e.hw, e.kind, e.oneway ? 1 : 0, e.rural ? 1 : 0, e.boulevard ? 1 : 0, e.trees ? 1 : 0, e.sw]), rounds },
    roadMask: b64(roadMask.subarray(0, GW * GH)), regionOf: b64(Int16Array.from(regionOf.subarray(0, GW * GH), v => v)), patchOf: b64(patchOf.subarray(0, GW * GH)), patches,
    blocks: blocks.map(b => ({ id: b.id, n: b.n, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, cx: b.cx, cy: b.cy, kind: b.kind, ch: b.ch, d: b.d, lot: b.lot, rural: b.rural, city: b.city, paths: b.paths, pond: b.pond, lake: b.lake, farm: b.farm })),
    trees: trees.map(t => ({ x: t.x, y: t.y, r: t.r, h: t.h, burnt: t.burnt })), hydrants, lamps, fountains, fences, props, entries, threat: threat && { ...threat, cols: threat.cols.map(c => ({ ...c, cp: cps.indexOf(c.cp) })) }, waters, bridges, ponds, oldTown, bigPark: bigPark && { ...bigPark },
    special: Object.fromEntries(Object.entries(special).map(([k, v]) => [k, { x: v.x, y: v.y, b: bi.get(v.b) }])),
    agents: agentsS, cars: carsS, tanks: tanks.filter(t => t.hp > 0).map(t => ({ x: t.x, y: t.y, ang: t.ang, turret: t.turret, hp: t.hp, shells: t.shells, rounds: t.rounds })),
    fires, tents: tents.map(t => ({ x: t.x, y: t.y, done: t.done })), research, scientists, vaccineReady, armyWaves, gangsSpawned,
    world: { hour: world.hour, target: world.target, cycle: world.cycle, weather: world.weather, season: world.season }, settings: { ...settings }, editRoads,
    families, heroes: heroes.map(h => h.id), metros, depots, strain, chDone, chFail, towers, floods, camps: camps.map(c => ({ ...c })), blackout, traps, gens, elecMask: Array.from(elecMask), quarMask: Array.from(quarMask), cps: cps.map(c => ({ ...c })), factions, hq, dangers, dayN, alert, alertT, respLog, medpoints, curfew: settings.curfew,
    camp, // кампания: день, итоги по дням, бюджет (campaign.js)
    terrain: { seed: terrainSeed, hasHills, ridgeSides: ridgeSides.slice(), intrude: !!ridgeSides.intrude, rocks, river, shore, lakes, cityBlob, walls, funicular: funicular ? { L: funicular.L, U: funicular.U, hL: funicular.hL, hU: funicular.hU, len: funicular.len, supports: funicular.supports, cabins: funicular.cabins.map(c => ({ s: c.s })), trips: funicular.trips } : null, th: b64(Uint8Array.from(TH, v => clamp(Math.round((v + 10) * .5), 0, 255))) }, firstsX: { ...firsts },
  };
}
function loadGame(S) {
  if (!S.roads) { warn("<b>Сохранение старой версии</b> — карта с прежними улицами больше не загружается."); return false; }
  if (fps.on) stopFps();
  layoutKey = S.layoutKey; L = LAYOUTS[layoutKey] || LAYOUTS.grid;
  relief = S.relief || "plain"; mapSize = S.mapSize || "normal"; setMapSize(mapSize);
  grid.fill(2); bhp.fill(0); wallMask.fill(0); roadMask.fill(0); regionOf.fill(-1); patchOf.fill(-1);
  grid.set(unb64(S.grid, Uint8Array)); snowD = null; if (S.snow) { snowInit(); for (const [i, d, u] of S.snow) { snowD[i] = d; snowUnder[i] = u; snowCells.add(i); } snowDirty = true; snowBox = [0, 0, W, H]; snowCity = "load"; } bhp.set(S.bhp16 ? unb64(S.bhp16, Uint16Array) : unb64(S.bhp, Uint8Array)); wallMask.set(unb64(S.wall, Uint8Array));
  // сеть дорог: узлы, рёбра, полосы заново из сохранённой геометрии
  RN = []; RE = []; rounds = S.roads.rounds || [];
  for (const [x, y, off, cul] of S.roads.nodes) { const n = rnNew(x, y); n.off = off; n.cul = !!cul; }
  for (const [a, b, pts, hw, kind, ow, rur, bv, tr, sw] of S.roads.edges) reNew(RN[a], RN[b], pts, hw, kind, !!ow, { rural: !!rur, boulevard: !!bv, trees: !!tr, sw: sw || SW });
  prepareGraph(); routeCache.clear(); exitRoute = null; turnCache.clear();
  roadMask.set(unb64(S.roadMask, Uint8Array)); { const r = unb64(S.regionOf, Int16Array); for (let i = 0; i < r.length; i++) regionOf[i] = r[i]; } buildCrossMask();
  patchOf.set(unb64(S.patchOf, Int16Array)); patches = S.patches || [];
  blocks = S.blocks; computeDistRoad();
  buildings = S.buildings.map(b => ({ ...b, h: b.floors * floorH(b.kind), occ: [] }));
  siteMask.fill(0); for (const b of buildings) if (b.siteCells) for (let k = 0; k < b.siteCells.length; k += 2) siteMask[b.siteCells[k]] = 1;
  trees = S.trees; hydrants = S.hydrants || []; lamps = S.lamps; fountains = S.fountains; fences = S.fences; props = S.props || []; entries = S.entries || []; threat = S.threat || null; hordeFields.clear(); waters = S.waters; bridges = S.bridges; ponds = S.ponds; oldTown = S.oldTown; bigPark = S.bigPark;
  special = Object.fromEntries(Object.entries(S.special).map(([k, v]) => [k, { x: v.x, y: v.y, b: buildings[v.b] }]));
  buildBusLines(); // маршруты автобусов — заново из графа и остановок; автобусы возьмут ближайший
  agents = S.agents.filter(o => !o.inCar || ["army", "police", "medic"].includes(o.role)).map(o => { const a = { phase: rnd(0, TAU), wx: 0, wy: 0, aim: 0, aimT: 0, shotT: -9, burst: 0, spin: 0, roll: 0, vz: 0, poolId: -1, poolR: 0, poolMax: 0, stuck: 0, ...o }; a.squad = 0; a.unit = null; a.job = null; if (o.inCar) { delete a.inCar; if (a.role !== "army") { a.standDown = true; a.standT = 0; a.order = a.role === "police" ? { x: special.police.x, y: special.police.y } : { x: special.hospital.x, y: special.hospital.y }; } } if (o.hideB !== undefined && o.hideB !== null) { a.hideB = buildings[o.hideB]; if (a.hideB) a.hideB.occ.push(a); } return a; });
  cars = S.cars.map(o => { const c = { ...newCar(), ...o, turn: null, next: null }; c.lane = o.lane >= 0 && RL[o.lane] ? RL[o.lane] : null; if (!c.lane) { c.moving = false; if (!c.stopped) c.lane = null; } return c; });
  tanks = S.tanks.map(t => ({ tank: true, cd: 2, mg: 0, v: 0, z: 0, recoil: 0, track: 0, ...t }));
  fires = S.fires; tents = S.tents; research = S.research; scientists = S.scientists; vaccineReady = S.vaccineReady; armyWaves = S.armyWaves; gangsSpawned = S.gangsSpawned;
  simT = S.simT; bites = S.bites; deaths = S.deaths; zkills = S.zkills; saved = S.saved; cured = S.cured; nextId = S.nextId;
  Object.assign(settings, S.settings); Object.assign(world, S.world); if ($("threats")) $("threats").checked = settings.threats !== false; syncDayButton(); $("weather").value = world.weather; $("season").value = world.season || "summer";
  editRoads = S.editRoads || [];
  buildCrossings(); evac = null; strikes = []; noises = []; machines = []; nuke = null; radZones = []; timers = []; reports = []; wallJobs = []; interests = []; stats = []; events = []; firsts = { zombie: true, ...(S.firstsX || {}) };
  resetExtras(); families = S.families || []; famMap = {}; for (const f of families) famMap[f.id] = f;
  heroes = (S.heroes || []).map(agentById).filter(Boolean); metros = S.metros || []; depots = S.depots || []; strain = S.strain || { lvl: 1, t: 0 }; chDone = S.chDone || 0; chFail = S.chFail || 0;
  resetBuild(); towers = S.towers || []; floods = S.floods || []; camps = S.camps || []; blackout = S.blackout || null; settings.dark = !!blackout;
  resetWorld2(); traps = S.traps || []; gens = S.gens || []; if (S.elecMask) elecMask.set(S.elecMask); quarMask.fill(0); if (S.quarMask) quarMask.set(S.quarMask); cps = S.cps || []; factions = S.factions || []; hq = S.hq || hq; dangers = S.dangers || []; dayN = S.dayN || 1; resetResponse(); resetCalls(); alert = S.alert || 0; alertT = S.alertT || 0; respLog = S.respLog || {}; resetAuto(); medpoints = S.medpoints || []; for (const m of medpoints) { m.cells = []; for (let gy = Math.floor((m.y - 6) / CS); gy <= Math.floor((m.y + 6) / CS); gy++) for (let gx = Math.floor((m.x - 9) / CS); gx <= Math.floor((m.x + 9) / CS); gx++) { const i = gy * GW + gx; if (grid[i] === 5) m.cells.push([i, 1]); } } settings.curfew = !!S.curfew;
  // зоны карантина; у старых сохранений нет ни ворот, ни снятия — такие зоны остаются как поставил игрок
  wallJobs = (S.wallJobs || []).map(j => ({ prev: {}, mouths: [], quietT: 0, ...j, gate: j.gate || [(j.x0 + j.x1) / 2, j.y1], cp: cps[j.cp] || null })); zoneOf.fill(0); if (S.zones) zoneOf.set(unb64(S.zones, Int16Array)); zoneSeq = S.zoneSeq || wallJobs.length;
  for (const j of wallJobs) for (const m of j.mouths) { const e = RE.find(e => e.id === m.e); if (e) e.quar = j.id; }
  if (threat) for (const c of threat.cols) c.cp = c.cp >= 0 ? cps[c.cp] || null : null;
  for (const cp of cps) if (cp.e !== undefined) { const e = RE.find(e => e.id === cp.e); if (e) e.checkCp = cp; }
  postMask.fill(0); for (const cp of cps) if (cp.road) for (const i of cp.cells.concat(cp.shutCells || [])) postMask[i] = 1;
  for (const a of agents) { a.cpAt = null; a.cpChecked = null; if (a.detained) { let best = null, bd = 1e9; for (const c of cps) { const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < bd) { bd = d; best = c; } } a.detained = best; } if (a.cp) a.cp = cps.find(c => Math.hypot(c.x - a.x, c.y - a.y) < 30) || null; }
  resetSquads(); fires.forEach(f => { f.assigned = false; });
  for (const a of agents) { if (a.post) a.post = towers.find(t => Math.abs(t.x - a.x) < 1 && Math.abs(t.y - a.y) < 1) || null; a.order = a.order || null; a.forage = null; a.campGoal = null; a.inCamp = null; }
  for (const a of agents) if (!a.name) nameFor(a);
  const T = S.terrain || {}; terrainSeed = T.seed || 1; hasHills = !!T.hasHills; ridgeSides = T.ridgeSides || []; ridgeSides.intrude = !!T.intrude; rocks = T.rocks || [];
  river = T.river || null; shore = T.shore || null; lakes = T.lakes || []; cityBlob = T.cityBlob || null; walls = T.walls || [];
  funicular = T.funicular ? { ...T.funicular, cabins: (T.funicular.cabins || []).map(c => ({ s: c.s, riders: [] })) } : null; massif = null;
  TH.fill(0); if (T.th) { const u = unb64(T.th, Uint8Array); for (let i = 0; i < TH.length && i < u.length; i++) TH[i] = u[i] * 2 - 10; }
  scen = SCENARIOS[S.scen] || SCENARIOS.sandbox; scenKey = S.scen; scenT = S.scenT; uses = S.uses || {}; scenDone = false; radioQ = []; wave = S.wave || 0; waveT = S.waveT ?? 40;
  loadCampaignState(S);
  patientZero = S.pz != null ? agentById(S.pz) || null : null;
  logE("Партия загружена", "good");
  clearDecals(); clearDebris(); for (const [t, o] of tankObjs) { scene.remove(o); tankObjs.delete(t); }
  buildCity(); barrDirty = true; gridDirty = true; gridDirtyMini = true; fieldT = 0; followA = null; hoverA = null; PS_ADD.list.length = 0; PS_SMOKE.list.length = 0;
  $("layoutName").textContent = (LAYOUTS[layoutKey] || {}).n || ""; renderTools(); record();
}
function slotKey(i) { return "vspyshka-save-" + i; }
function renderSaves() {
  const rows = [];
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    let meta = null; try { const m = localStorage.getItem(slotKey(i) + "-meta"); if (m) meta = JSON.parse(m); else { const raw = localStorage.getItem(slotKey(i)); if (raw && raw[0] === "{") meta = JSON.parse(raw); } } catch (e) {}
    const desc = meta ? `${(SCENARIOS[meta.scen] || {}).n || "Свободная игра"} · ${(LAYOUTS[meta.layoutKey] || {}).n || ""}${meta.mapSize === "big" ? " · большая карта" : ""} · ${mmss(meta.simT)} игры · ${new Date(meta.date).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Пусто";
    rows.push(`<li><div><b>Слот ${i}</b><small>${desc}</small></div><div class="slotbtns"><button class="btn" data-save="${i}">Сохранить</button><button class="btn" data-load="${i}"${meta ? "" : " disabled"}>Загрузить</button><button class="btn" data-del="${i}"${meta ? "" : " disabled"}>Удалить</button></div></li>`);
  }
  $("saveList").innerHTML = rows.join("");
}
// сохранение большой карты весит несколько мегабайт JSON — сжимаем gzip'ом браузера и храним в base64 (в 6–10 раз меньше),
// описание слота лежит отдельно, чтобы список не распаковывал всё. Старые несжатые сохранения читаются как раньше
const GZ = "gz1:";
async function packSave(json) {
  if (typeof CompressionStream === "undefined") return json;
  const buf = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return GZ + btoa(bin);
}
async function unpackSave(raw) {
  if (!raw.startsWith(GZ)) return raw;
  const bin = atob(raw.slice(GZ.length)), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
$("saveList").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const i = b.dataset.save || b.dataset.load || b.dataset.del;
  try {
    if (b.dataset.save) {
      const S = serializeGame(), data = await packSave(JSON.stringify(S, (k, v) => typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v));
      localStorage.removeItem(slotKey(i)); localStorage.removeItem(slotKey(i) + "-meta");
      localStorage.setItem(slotKey(i), data); localStorage.setItem(slotKey(i) + "-meta", JSON.stringify({ scen: S.scen, layoutKey: S.layoutKey, mapSize: S.mapSize, simT: S.simT, date: S.date }));
      $("saveNote").textContent = `Сохранено в слот ${i}.`;
    }
    if (b.dataset.load) { const S = JSON.parse(await unpackSave(localStorage.getItem(slotKey(i)))); loadGame(S); $("saves").hidden = true; setPaused(false); }
    if (b.dataset.del) { localStorage.removeItem(slotKey(i)); localStorage.removeItem(slotKey(i) + "-meta"); $("saveNote").textContent = `Слот ${i} очищен.`; }
  } catch (err) { $("saveNote").textContent = b.dataset.save ? "Не удалось сохранить: в браузере не хватает места или хранилище отключено." : "Не удалось загрузить это сохранение."; }
  renderSaves();
});
$("openSaves").addEventListener("click", () => { renderSaves(); $("saveNote").textContent = "Сохранения лежат только в этом браузере."; $("saves").hidden = false; });
$("savesClose").addEventListener("click", () => { $("saves").hidden = true; });
