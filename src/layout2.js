/* ---------- районы, новые здания, озёра-парки, фермы и ранчо ----------
   Характер квартала (b.ch) назначается после классификации по расстоянию от центра и планировке; от него зависит, какие дома
   ставит buildFrontage (SPEC) и какие учреждения приходят в квартал (placeDistrictBuildings). Озёра — настоящая вода из
   terrain.js (lakes): клетки под водой — 9, по берегу набережная-дорожка, пляж с пирсом и зонтиками, скамейки лицом к воде.
   Фермы и ранчо стоят в полях у загородных дорог, их жители живут и работают там же (assignHomes в sim11.js). */
const CH_NAME = { center: "центр", mid: "кварталы средней этажности", sleep: "спальный район", cottage: "коттеджный посёлок", private: "частный сектор", old: "старый город", industry: "промзона", garages: "гаражи", farm: "фермы и ранчо" };
function blockHash(b, k = 0) { return Math.abs(Math.sin(b.id * 12.9898 + k * 7.31 + WIDE_SEED * 3.7) * 43758.5453) % 1; }
// характер квартала: центр с башнями, средняя этажность ближе к центру, спальные панельные кварталы дальше, коттеджи и частный сектор на краю
function assignDistricts() {
  for (const b of blocks) {
    if (b.rural) { b.ch = "farm"; continue; }
    const k = b.kind, r = Math.hypot((b.cx - W / 2) / (CITY_W / 2), (b.cy - H / 2) / (CITY_H / 2)) + (blockHash(b) - .5) * .16;
    b.ch = k === "old" || k === "square" || k === "glacis" ? "old" : k === "industry" ? "industry" : k === "towers" ? "center"
      : k === "apt" ? (r < L.d[0] + (L.d[1] - L.d[0]) * .45 ? "mid" : "sleep")
        : k === "suburb" ? (r < L.d[1] + .14 && blockHash(b, 1) < .55 ? "cottage" : "private") : k;
  }
  // гаражные кооперативы: пара кварталов среднего размера в спальном районе или промзоне становятся рядами гаражей
  const gc = blocks.filter(b => !b.rural && (b.ch === "sleep" || b.ch === "industry") && b.n > 60 && b.n < 320 && b.d >= 1).sort(() => Math.random() - .5);
  for (const b of gc.slice(0, mapSize === "big" ? 3 : 2)) { b.kind = "garages"; b.ch = "garages"; }
}
// частный сектор: в коттеджном посёлке дома в два этажа разных форм (Г-образные, с гаражом, с мансардой), в остальном — обычные дома
const COTTAGE_SHAPES = ["plain", "L", "garage", "mansard"];
SPEC.suburb = (x, y) => {
  const b = blockAt(x, y), ch = b ? b.ch : "private";
  if (ch === "cottage") {
    const shape = pick(COTTAGE_SHAPES);
    return { lot: rnd(42, 54), w: shape === "garage" ? rnd(25, 30) : rnd(19, 24), d: [15, 21], set: rnd(8, 13), kind: "cottage", floors: shape === "mansard" ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: "x", shape };
  }
  return { lot: rnd(34, 46), w: rnd(16, 23), d: [14, 20], set: rnd(9, 14), kind: "house", floors: Math.random() < .55 ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: "x" };
};
// многоэтажки: в спальном районе длинные панельные пяти- и девятиэтажки с широкими дворами, ближе к центру — дома средней этажности
SPEC.apt = (x, y) => {
  const b = blockAt(x, y), ch = b ? b.ch : "mid", r = Math.hypot((x - W / 2) / (CITY_W / 2), (y - H / 2) / (CITY_H / 2));
  if (ch === "sleep") return { w: rnd(40, 76), d: [12, 16], set: rnd(3, 7), gap: rnd(12, 24), kind: "apt", floors: pick([5, 5, 9, 9, 12]), style: 29 + Math.floor(Math.random() * 2) };
  return { w: rnd(24, 52), d: [12, 22], set: rnd(1, 4), gap: rnd(4, 10), kind: "apt", floors: clamp(Math.round(rnd(5, 12) * (1.25 - r * .7)), 4, 12), style: Math.floor(Math.random() * 5) };
};
// учреждения районов: рынок у спального района, автосервис на краю промзоны и частного сектора, кафе в центре, усадьба с участком в частном секторе
Object.assign(SPECIAL, {
  market: { w: 44, d: 24, set: 4, floors: 2, style: 33, lot: [88, 66, 0], ok: (k, b) => !!b && (b.ch === "sleep" || b.ch === "mid" || b.ch === "center"), d0: 1 },
  autoservice: { w: 30, d: 18, set: 2, floors: 1, style: 32, lot: [58, 44, 0], ok: (k, b) => !!b && (b.ch === "industry" || b.ch === "sleep" || b.ch === "private"), d0: 2 },
  cafe: { w: 18, d: 12, set: 8, floors: 1, style: 34, ok: (k, b) => !!b && (b.ch === "center" || b.ch === "mid" || b.ch === "old"), d0: 1 },
  manor: { w: 26, d: 16, set: 14, floors: 2, style: 36, lot: [64, 54, 2], ok: (k, b) => !!b && (b.ch === "private" || b.ch === "cottage"), d0: 2 },
});
// забор по участку: три стороны, лицевая — с калиткой посередине
function fenceLot(bb) {
  const R = bb.lotRect, f = bb.front, c = Math.cos(R.rot), s = Math.sin(R.rot), P = (u, v) => [R.cx + u * c - v * s, R.cy + u * s + v * c];
  const hw = R.w / 2 - 1, hd = R.d / 2 - 1, frontV = (f.nx * -s + f.ny * c) > 0 ? hd : -hd; // сторона участка, обращённая к улице
  fences.push([...P(-hw, -hd), ...P(-hw, hd)], [...P(hw, -hd), ...P(hw, hd)], [...P(-hw, -frontV), ...P(hw, -frontV)], [...P(-hw, frontV), ...P(-4, frontV)], [...P(4, frontV), ...P(hw, frontV)]);
}
function placeMany(kind, n, after) {
  let made = 0;
  for (let k = 0; k < n; k++) {
    if (!placeSpecial(kind)) break;
    const sp = special[kind]; made++; if (after) after(sp.b); if (kind !== "market") delete special[kind];
  }
  return made;
}
// здание внутри квартала, лицом к ближайшей улице; дверь на лицевой стороне
function innerPlace(kind, w, d, floors, style, pred, margin = 12) {
  const cands = blocks.filter(b => !b.rural && pred(b)).sort(() => Math.random() - .5);
  for (const b of cands) for (let k = 0; k < 30; k++) {
    const x = b.cx + rnd(-1, 1) * (b.x1 - b.x0) * .22, y = b.cy + rnd(-1, 1) * (b.y1 - b.y0) * .22, rot = nearestEdgeAng(x, y);
    if (!footFree(x, y, w + margin, d + margin, rot, b.id)) continue;
    const bb = addRotBuilding(x, y, w, d, rot, { kind, floors, style });
    for (const i of rotCells(x, y, w + margin - 4, d + margin - 4, rot)) usedMask[i] = 1;
    // лицевая сторона (+z) — та, что ближе к улице
    const zx = -Math.sin(rot), zy = Math.cos(rot), q1 = gEdgeNear(x + zx * 60, y + zy * 60, 300), q2 = gEdgeNear(x - zx * 60, y - zy * 60, 300), sgn = (q1 ? q1.d : 1e9) <= (q2 ? q2.d : 1e9) ? 1 : -1;
    bb.doorPref = [x + zx * sgn * (d / 2 + 3), y + zy * sgn * (d / 2 + 3)]; bb.faceSgn = sgn;
    return bb;
  }
  return null;
}
// ряды гаражей в квартале-кооперативе: длинные одноэтажные боксы вдоль ближайшей улицы, проезды между рядами
function fillGarages(b) {
  const ang = nearestEdgeAng(b.cx, b.cy), ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
  for (let v = -R; v < R; v += 24) for (let u = -R; u < R; u += 6) {
    const x = b.cx + u * ca - v * sa, y = b.cy + u * sa + v * ca;
    for (const w of [84, 60, 42, 30]) {
      const cx = x + ca * w / 2, cy = y + sa * w / 2;
      if (!footFree(cx, cy, w, 11, ang, b.id, g => g === 0)) continue;
      const bb = addRotBuilding(cx, cy, w, 11, ang, { kind: "garages", floors: 1, style: 37 });
      bb.doorPref = [cx - sa * 8, cy + ca * 8];
      for (const i of rotCells(cx, cy, w + 4, 21, ang)) usedMask[i] = 1;
      u += w; break;
    }
  }
}
// все учреждения районов разом: вызывается после больниц и достопримечательностей, до рядовой застройки
function placeDistrictBuildings() {
  const big = mapSize === "big";
  placeMany("market", big ? 2 : 1);
  placeMany("autoservice", big ? 3 : 2, bb => {
    // пара машин на площадке перед боксом
    const f = bb.front, ang = Math.atan2(f.uy, f.ux);
    for (const k of [-1, 1]) { const x = bb.cx + f.ux * k * 14 + f.nx * (bb.d / 2 + 9), y = bb.cy + f.uy * k * 14 + f.ny * (bb.d / 2 + 9), cs = rotCells(x, y, 17, 7, ang); if (!cs.length || cs.some(i => grid[i] !== 0)) continue; for (const i of cs) grid[i] = 5; const M = pickCarModel(true); cars.push({ x, y, ang, model: M.k, len: M.len, col: pick(M.cols || CARC), wreck: false, boomT: 0, burnT: 0 }); }
  });
  placeMany("cafe", big ? 5 : 3);
  placeMany("manor", big ? 4 : 2, bb => { fenceLot(bb); for (let k = 0; k < 4; k++) { const R = bb.lotRect, c = Math.cos(R.rot), s = Math.sin(R.rot), u = rnd(-R.w / 2 + 6, R.w / 2 - 6), v = rnd(-R.d / 2 + 6, R.d / 2 - 6); addTree(R.cx + u * c - v * s, R.cy + u * s + v * c, rnd(6, 9), rnd(14, 24)); } });
  // детские сады во дворах спальных кварталов, с забором и площадкой перед входом
  for (let k = 0, n = big ? 4 : 2; k < n; k++) {
    const bb = innerPlace("kinder", 38, 22, 2, 31, b => b.ch === "sleep" && b.n > 220 && !b.lot, 28);
    if (!bb) break;
    const c = Math.cos(bb.rot), s = Math.sin(bb.rot), P = (u, v) => [bb.cx + u * c - v * s, bb.cy + u * s + v * c], hw = bb.w / 2 + 11, hd = bb.d / 2 + 11, fv = bb.faceSgn * hd;
    fences.push([...P(-hw, -hd), ...P(-hw, hd)], [...P(hw, -hd), ...P(hw, hd)], [...P(-hw, -fv), ...P(hw, -fv)], [...P(-hw, fv), ...P(-3, fv)], [...P(3, fv), ...P(hw, fv)]);
    const [px, py] = P(bb.w / 2 - 6, bb.faceSgn * (bb.d / 2 + 6)); props.push({ k: "play", x: px, y: py, a: bb.rot + (bb.faceSgn > 0 ? 0 : Math.PI), v: Math.floor(Math.random() * 3) });
  }
  for (const b of blocks) if (b.kind === "garages") fillGarages(b);
}

/* ---------- озёра ---------- */
// место свободно: контур озера с запасом не задевает дорог и края карты
function lakeFree(x, y, rx, ry, margin, inside) {
  if (x - rx * 1.3 < 60 || y - ry * 1.3 < 60 || x + rx * 1.3 > W - 60 || y + ry * 1.3 > H - 60) return false;
  if (gEdgeNear(x, y, Math.max(rx, ry) * 1.3 + margin)) return false;
  for (let a = 0; a < TAU; a += .22) { const px = x + Math.cos(a) * (rx * 1.3 + margin), py = y + Math.sin(a) * (ry * 1.3 + margin); if (gEdgeNear(px, py, margin) || (inside && !inside(px, py))) return false; }
  return true;
}
function addLake(x, y, rx, ry, city) { const l = { x, y, rx, ry, city: !!city }; lakes.push(l); return l; }
// озеро в городе: между бульварным кольцом и краем, подальше от проспектов — до нарезки улиц, чтобы они обошли воду
function cityLake(cx, cy, r0, r1) {
  for (let k = 0; k < 80; k++) {
    const a = rnd(0, TAU), r = rnd(r0, r1), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .8, rx = rnd(70, 105), ry = rx * rnd(.6, .85);
    if (!lakeFree(x, y, rx, ry, 34, (px, py) => urbanAt(px, py, .62))) continue;
    const l = addLake(x, y, rx, ry, true); presets.push({ x, y, kind: "lake" }); return l;
  }
  return null;
}
// озёра за городом: в полях, в стороне от дорог; на большой карте их больше
function placeLakes() {
  if (!L.lakes) return;
  const want = (L.lakes === "rural" ? (Math.random() < .75 ? 1 : 0) : 0) + (mapSize === "big" ? 1 : 0);
  for (let n = 0, k = 0; n < want && k < 200; k++) {
    const x = rnd(120, W - 120), y = rnd(120, H - 120), rx = rnd(80, 140), ry = rx * rnd(.55, .85);
    if (cityK(x, y) > .25 || !lakeFree(x, y, rx, ry, 40)) continue;
    if (lakes.some(l => Math.hypot(l.x - x, l.y - y) < 500)) continue;
    addLake(x, y, rx, ry, false); n++;
  }
}
function nearLakes(x, y, m) { for (const l of lakes) if (Math.abs(x - l.x) < l.rx * 1.3 + m && Math.abs(y - l.y) < l.ry * 1.3 + m) return true; return false; }
// клетки под водой — 9, полоса берега занята: домов и построек у самой воды не ставим
function markWater() {
  if (!lakes.length) return;
  for (const l of lakes) { const b = blockAt(l.x, l.y); if (b) b.lake = true; }
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * CS + 4, y = gy * CS + 4; if (!nearLakes(x, y, 16)) continue;
    const d = lakeD(x, y), i = gy * GW + gx;
    if (d < 0) { if (!roadMask[i]) grid[i] = 9; usedMask[i] = 1; } else if (d < 14) usedMask[i] = 1;
  }
}
// точка берега: от центра озера по лучу до расстояния off от воды
function shorePoint(l, a, off) {
  const c = Math.cos(a), s = Math.sin(a), R = Math.max(l.rx, l.ry) * 1.5 + off + 10;
  for (let r = 4; r < R; r += 2) { const x = l.x + c * r, y = l.y + s * r; if (lakeD(x, y) >= off) return [x, y]; }
  return null;
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// набережная вокруг воды, пляж с пирсом и зонтиками на стороне, обращённой к центру города, скамейки лицом к воде
function furnishLakes() {
  for (const l of lakes) {
    const walk = [], N = Math.max(40, Math.round(TAU * Math.max(l.rx, l.ry) / 14));
    for (let k = 0; k < N; k++) { const p = shorePoint(l, k / N * TAU, 9); if (p && !gEdgeNear(p[0], p[1], 14)) walk.push(p); }
    if (walk.length < 8) continue;
    walk.push(walk[0]); l.walk = walk;
    for (const [x, y] of walk) fillDisc(x, y, 3.5, 3.5, 7, g => g === 9 || g === 3 || g === 4 || g === 0 || g === 5);
    // пляж: сектор берега, ближе к центру города
    const a0 = Math.atan2(cityBlob.y - l.y, cityBlob.x - l.x) + rnd(-.5, .5), half = rnd(.45, .7);
    l.beach = { a0, half };
    for (let gy = Math.max(0, Math.floor((l.y - l.ry * 1.4 - 20) / CS)); gy < Math.min(GH, Math.ceil((l.y + l.ry * 1.4 + 20) / CS)); gy++)
      for (let gx = Math.max(0, Math.floor((l.x - l.rx * 1.4 - 20) / CS)); gx < Math.min(GW, Math.ceil((l.x + l.rx * 1.4 + 20) / CS)); gx++) {
        const x = gx * CS + 4, y = gy * CS + 4, d = lakeD(x, y), i = gy * GW + gx;
        if (d >= 0 && d < 15 && angDiff(Math.atan2(y - l.y, x - l.x), a0) < half && (grid[i] === 2 || grid[i] === 7) && !roadMask[i]) { grid[i] = 7; usedMask[i] = 1; }
      }
    const pp = shorePoint(l, a0, 1);
    if (pp) props.push({ k: "pier", x: pp[0], y: pp[1], a: a0 + Math.PI });
    for (let k = 0; k < 5; k++) { const p = shorePoint(l, a0 + rnd(-half * .8, half * .8), rnd(5, 12)); if (p && cellAt(p[0], p[1]) === 7) props.push({ k: "umbrella", x: p[0], y: p[1], a: rnd(0, TAU), v: k % 3 }); }
    for (let k = 1; k < walk.length - 1; k += 5) {
      const [x, y] = walk[k], dx = x - l.x, dy = y - l.y, n = Math.hypot(dx, dy) || 1, bx = x + dx / n * 5.5, by = y + dy / n * 5.5;
      if (cellAt(bx, by) === 2 && !props.some(o => Math.abs(o.x - bx) < 6 && Math.abs(o.y - by) < 6)) props.push({ k: "bench", x: bx, y: by, a: Math.atan2(-dy, -dx) });
    }
    // деревья по берегу загородного озера (городское озеро озеленяет fillInteriors как парк)
    const b = blockAt(l.x, l.y);
    if (b && b.rural) for (let k = 0; k < 40; k++) { const p = shorePoint(l, rnd(0, TAU), rnd(16, 40)); if (p && cellAt(p[0], p[1]) === 2) addTree(p[0], p[1], rnd(7, 12), rnd(16, 30)); }
  }
}

/* ---------- фермы и ранчо ---------- */
let farmSeq = 0;
// ферма у загородной дороги: дом и амбар фасадом к дороге, за ними двор — силос, техника, сено; у ранчо вместо силоса загон со скотом
function buildFarm(s, b, ranch) {
  const q = gEdgeNear(s.x, s.y, 260); if (!q) return false;
  const e = q.e, p = edgePos(e, q.t), side = ((s.x - p.x) * -p.ty + (s.y - p.y) * p.tx) > 0 ? 1 : -1, nx = -p.ty * side, ny = p.tx * side;
  const ang = Math.atan2(p.ty, p.tx), ca = Math.cos(ang), sa = Math.sin(ang);
  const at = (u, v) => [p.x + ca * u + nx * (e.hw + v), p.y + sa * u + ny * (e.hw + v)]; // u вдоль дороги, v вглубь от обочины
  const [yx, yy] = at(10, 82), cells = rotCells(yx, yy, 150, 104, ang);
  if (!cells.length || cells.some(i => roadMask[i] || usedMask[i] || regionOf[i] !== b.id || grid[i] === 3 || grid[i] === 9 || grid[i] === 10 || grid[i] === 5)) return false;
  const t0 = clamp(q.t - 30, 20, Math.max(20, e.len - 90));
  const id = ++farmSeq;
  const hb = placeAlong(e, t0, side, 22, 16, 16, rnd(10, 16), { kind: "farmhouse", floors: 1, style: 35, ridge: "x", farm: id }, b.id);
  if (!hb) return false;
  placeAlong(e, t0 + 36, side, ranch ? 30 : 26, 18, 18, rnd(14, 22), { kind: "barn", floors: 1, style: 26, ridge: "x", farm: id }, b.id);
  // двор: деревья вырубаются, клетки заняты под постройки
  const inside = new Set(cells); trees = trees.filter(t => !inside.has(Math.floor(t.y / CS) * GW + Math.floor(t.x / CS)));
  for (const i of cells) { usedMask[i] = 1; if (grid[i] === 4) grid[i] = 2; }
  const prop = (k, u, v, a = 0, w = 0, d = 0, vv = 0) => { const [x, y] = at(u, v); props.push({ k, x, y, a: ang + a, v: vv }); if (w) for (const i of rotCells(x, y, w, d, ang + a)) if (grid[i] === 2) grid[i] = 4; };
  if (!ranch) {
    prop("silo", -45, 70, 0, 8, 8); prop("silo", -34, 70, 0, 8, 8);
    const hg = addRotBuilding(...at(40, 78), 34, 22, ang, { kind: "hangar", floors: 2, style: 15, farm: id }); hg.doorPref = at(40, 64);
    prop("tractor", 2, 62, Math.PI / 2, 14, 7, Math.floor(Math.random() * 2));
    for (let k = 0; k < 5; k++) prop("hay", -20 + k * 7, 100 + (k % 2) * 6, rnd(-.3, .3), 4, 4);
  } else {
    // загон: забор, скот, кормушка; конюшня-ангар у края двора
    const P = (u, v) => at(u, v), c0 = P(-50, 62), c1 = P(28, 62), c2 = P(28, 112), c3 = P(-50, 112);
    fences.push([...c0, ...c1], [...c1, ...c2], [...c2, ...c3], [...c3, ...P(-50, 92)], [...P(-50, 72), ...c0]);
    for (let k = 0, n = 4 + Math.floor(Math.random() * 4); k < n; k++) prop("cow", rnd(-42, 20), rnd(70, 104), rnd(0, TAU), 4, 3, Math.floor(Math.random() * 3));
    prop("trough", -11, 66, 0, 6, 2);
    const hg = addRotBuilding(...at(56, 84), 30, 22, ang, { kind: "hangar", floors: 2, style: 15, farm: id }); hg.doorPref = at(56, 70);
    prop("tractor", 60, 60, Math.PI / 2, 14, 7, 1);
    for (let k = 0; k < 3; k++) prop("hay", 46 + k * 7, 104, rnd(-.3, .3), 4, 4);
  }
  // пикап у дома, деревья во дворе
  { const [x, y] = at(-36, 46), a = ang + Math.PI / 2, cs = rotCells(x, y, 17, 7, a); if (cs.length && cs.every(i => grid[i] === 2)) { for (const i of cs) grid[i] = 5; cars.push({ x, y, ang: a, model: "pickup", len: 1.08, col: pick(CARC), wreck: false, boomT: 0, burnT: 0 }); } }
  for (let k = 0; k < 3; k++) addTree(hb.cx + rnd(-28, 28), hb.cy + rnd(-28, 28), rnd(6, 9), rnd(14, 22));
  b.farm = (b.farm || 0) + 1;
  return true;
}
