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
  bb.h = bb.floors * (bb.kind === "house" ? 11 : 12); bb.fire = 0; bb.scorch = 0; bb.hp = 100 + bb.floors * 6 + w * d / 400; bb.maxHp = bb.hp; bb.state = "ok"; bb.ruinH = 0; bb.cT = 0;
  buildings.push(bb); fillRotRect(cx, cy, w, d, rot, 3);
  return bb;
}
