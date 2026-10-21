/* ---------- красивые районы: исторический центр, городской парк, бульвары ---------- */
let oldTown = null, bigPark = null, ponds = [];
// повёрнутый прямоугольник: клетки сетки внутри него
function fillRotRect(cx, cy, w, d, rot, v) {
  const r = Math.hypot(w, d) / 2 + CS, c = Math.cos(rot), s = Math.sin(rot);
  for (let y = cy - r; y <= cy + r; y += CS / 2) for (let x = cx - r; x <= cx + r; x += CS / 2) {
    const dx = x - cx, dy = y - cy, lx = dx * c + dy * s, lz = -dx * s + dy * c;
    if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) grid[gy * GW + gx] = v; }
  }
}
function fillDisc(cx, cy, rx, ry, v, keep) {
  for (let y = Math.max(0, Math.floor((cy - ry) / CS)); y <= Math.min(GH - 1, Math.floor((cy + ry) / CS)); y++)
    for (let x = Math.max(0, Math.floor((cx - rx) / CS)); x <= Math.min(GW - 1, Math.floor((cx + rx) / CS)); x++) {
      const dx = (x * CS + 4 - cx) / rx, dy = (y * CS + 4 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!keep || !keep(grid[y * GW + x]))) grid[y * GW + x] = v;
    }
}
function addRotBuilding(cx, cy, w, d, rot, props) {
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hx = (w * c + d * s) / 2, hy = (w * s + d * c) / 2;
  const bb = { x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy, rot, w, d, cx, cy, ...props };
  bb.h = bb.floors * 12; bb.fire = 0; bb.scorch = 0; bb.hp = 100 + bb.floors * 6 + w * d / 400; bb.maxHp = bb.hp; bb.state = "ok"; bb.ruinH = 0; bb.cT = 0;
  buildings.push(bb); fillRotRect(cx, cy, w, d, rot, 3);
  return bb;
}
// до заливки кварталов: освобождаем место
function prepareSpecialDistricts() {
  oldTown = null; bigPark = null; ponds = [];
  if (L.old) {
    const R = Math.min(W, H) * .24;
    oldTown = { x: W / 2, y: H / 2, R };
    blocks = blocks.filter(b => !rectInCircle(b, oldTown.x, oldTown.y, R + 10));
  }
  if (L.park) {
    // 3 × 2 квартала у центра сливаются в один парк, улицы внутри исчезают
    const c = blocks.slice().sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - W / 2, (a.y0 + a.y1) / 2 - H / 2) - Math.hypot((b.x0 + b.x1) / 2 - W / 2, (b.y0 + b.y1) / 2 - H / 2))[0];
    const xs = [...new Set(blocks.map(b => b.x0))].sort((a, b) => a - b), ys = [...new Set(blocks.map(b => b.y0))].sort((a, b) => a - b);
    const ix = Math.max(0, xs.indexOf(c.x0) - 1), iy = Math.max(0, ys.indexOf(c.y0) - (Math.random() < .5 ? 1 : 0));
    const sel = blocks.filter(b => xs.indexOf(b.x0) >= ix && xs.indexOf(b.x0) < ix + 3 && ys.indexOf(b.y0) >= iy && ys.indexOf(b.y0) < iy + 2);
    if (sel.length >= 4) {
      bigPark = { x0: Math.min(...sel.map(b => b.x0)), y0: Math.min(...sel.map(b => b.y0)), x1: Math.max(...sel.map(b => b.x1)), y1: Math.max(...sel.map(b => b.y1)) };
      blocks = blocks.filter(b => !sel.includes(b));
      blocks.push({ ...bigPark, kind: "bigpark", d: 1 });
    }
  }
}
function rectInCircle(b, cx, cy, R) { const dx = Math.max(b.x0 - cx, 0, cx - b.x1), dy = Math.max(b.y0 - cy, 0, cy - b.y1); return Math.hypot(dx, dy) < R; }
// после заливки: строим старый город и парк
function buildSpecialDistricts() {
  if (bigPark) {
    const p = bigPark, ix0 = p.x0 + 10, iy0 = p.y0 + 10, ix1 = p.x1 - 10, iy1 = p.y1 - 10;
    fillCells(p.x0, p.y0, p.x1, p.y1, 1); fillCells(ix0, iy0, ix1, iy1, 2);
    const lake = { x: (ix0 + ix1) / 2 + rnd(-40, 40), y: (iy0 + iy1) / 2 + rnd(-20, 20), rx: (ix1 - ix0) * rnd(.18, .26), ry: (iy1 - iy0) * rnd(.22, .3) };
    ponds.push(lake); fillDisc(lake.x, lake.y, lake.rx, lake.ry, 9);
    // извилистые дорожки
    p.paths = [];
    for (let k = 0; k < 5; k++) {
      const a = [rnd(ix0, ix1), Math.random() < .5 ? iy0 : iy1], b = [Math.random() < .5 ? ix0 : ix1, rnd(iy0, iy1)];
      const c1 = [lake.x + rnd(-1, 1) * lake.rx * 1.6, lake.y + rnd(-1, 1) * lake.ry * 1.6], pts = [];
      for (let t = 0; t <= 1; t += .02) { const u = 1 - t, x = u * u * a[0] + 2 * u * t * c1[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * c1[1] + t * t * b[1]; if (Math.hypot((x - lake.x) / (lake.rx + 8), (y - lake.y) / (lake.ry + 8)) > 1) pts.push([x, y]); }
      p.paths.push(pts);
      for (const [x, y] of pts) fillDisc(x, y, 5, 5, 7, c => c === 9);
    }
    // набережная вокруг пруда и рощи
    for (let t = 0; t < (ix1 - ix0) * (iy1 - iy0) / 700; t++) {
      const x = rnd(ix0 + 6, ix1 - 6), y = rnd(iy0 + 6, iy1 - 6);
      if (Math.hypot((x - lake.x) / (lake.rx + 14), (y - lake.y) / (lake.ry + 14)) < 1 || cellAt(x, y) !== 2) continue;
      trees.push({ x, y, r: rnd(7, 14), h: rnd(18, 34) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4);
    }
    for (let x = p.x0 + 20; x < p.x1 - 10; x += 62) { lamps.push({ x, y: p.y0 + 2, f: 0 }); lamps.push({ x, y: p.y1 - 2, f: 1 }); }
  }
  if (oldTown) {
    const { x: cx, y: cy, R } = oldTown;
    fillDisc(cx, cy, R, R, 7);
    const spokes = 8, rings = [R * .24, R * .5, R * .78], sw = 9;
    oldTown.spokes = spokes; oldTown.rings = rings;
    // собор на центральной площади
    addRotBuilding(cx, cy, 44, 70, 0, { kind: "cathedral", floors: 4, style: 21 });
    fountains.push({ x: cx, y: cy + 62, r: 9 }); fillDisc(cx, cy + 62, 9, 9, 3);
    // кварталы по дугам между лучами и кольцами
    const bands = [[rings[0] + sw + 4, rings[1] - sw - 4], [rings[1] + sw + 4, rings[2] - sw - 4], [rings[2] + sw + 4, R - 10]];
    for (const [r0, r1] of bands) {
      if (r1 - r0 < 14) continue;
      const rc = (r0 + r1) / 2, depth = r1 - r0;
      for (let k = 0; k < spokes; k++) {
        const a0 = k / spokes * TAU + (sw + 6) / rc, a1 = (k + 1) / spokes * TAU - (sw + 6) / rc, arc = (a1 - a0) * rc;
        const n = Math.max(1, Math.floor(arc / 30)), seg = (a1 - a0) / n;
        for (let i = 0; i < n; i++) {
          const a = a0 + seg * (i + .5), len = seg * rc - 3;
          if (len < 12) continue;
          addRotBuilding(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, len, depth, a + Math.PI / 2, { kind: "oldhouse", floors: 3 + Math.floor(Math.random() * 3), style: 22 + Math.floor(Math.random() * 4), ridge: "x" });
        }
      }
    }
    // фонари вдоль лучей, липы на среднем кольце
    for (let k = 0; k < spokes; k++) { const a = k / spokes * TAU; for (let r = rings[0] + 20; r < R; r += 50) lamps.push({ x: cx + Math.cos(a) * r + Math.cos(a + 1.57) * 8, y: cy + Math.sin(a) * r + Math.sin(a + 1.57) * 8, f: 0 }); }
    for (let a = 0; a < TAU; a += 22 / rings[1]) { const x = cx + Math.cos(a) * rings[1], y = cy + Math.sin(a) * rings[1]; if (Math.abs(((a / TAU * spokes) % 1) - .5) < .38) { trees.push({ x, y, r: rnd(6, 9), h: rnd(16, 24) }); fillCells(x - 2, y - 2, x + 2, y + 2, 4); } }
  }
  // бульвары: липы посреди широких проспектов
  for (const s of streets) {
    if (!s.wide || s.edge || s.water || Math.random() < .3) continue;
    for (let t = s.a0 + 20; t < s.a1 - 20; t += 22) {
      const x = s.v ? s.p : t, y = s.v ? t : s.p;
      if (cellAt(x, y) !== 0) continue;
      let cross = false; for (const o of streets) if (o.v !== s.v && streetsCross(s, o) && Math.abs((s.v ? y : x) - o.p) < o.hw + 14) cross = true;
      if (cross) continue;
      trees.push({ x, y, r: rnd(5, 8), h: rnd(16, 24), median: true }); fillCells(x - 2, y - 2, x + 2, y + 2, 4);
    }
    s.boulevard = true;
  }
  // маленькие пруды в обычных парках
  for (const b of blocks) if (b.kind === "park" && Math.random() < .35) { const p = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, rx: (b.x1 - b.x0) * .2, ry: (b.y1 - b.y0) * .2 }; ponds.push(p); fillDisc(p.x, p.y, p.rx, p.ry, 9); trees = trees.filter(t => Math.hypot((t.x - p.x) / (p.rx + 6), (t.y - p.y) / (p.ry + 6)) > 1); }
}
