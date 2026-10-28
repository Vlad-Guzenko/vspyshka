/* ---------- горные дороги: серпантин от подножия до перевала на краю карты ----------
   Трасса за городом, уходящая к краю карты на горной стороне, обрезается у подножия, и дальше дорогу ведёт трассировщик, как
   её вели бы дорожники. Сначала коридор: взвешенный кратчайший путь по сетке 16 единиц, где вода непроходима, подъём круче
   нормы дорожает в разы, а край карты и город дороги не любят. Потом трассировка от точки коридора к точке: пока уклон позволяет,
   прямо; где круче — траверсом, под таким углом к горизонтали склона, чтобы подъём был ровно GRADE, поэтому полотно повторяет
   складки. Когда плечо выросло или впереди край, на самом пологом месте закладывается петля радиусом 12 м с центром выше по
   склону и малым уклоном, полотно в петле шире. Дорога врезается полкой (benchRoads в terrain.js): выемка сверху, насыпь снизу.
   Единицы мира: 1 ед. = 25 см, поэтому все длины вчетверо больше метров */
const MR = { grade: .08, step: 8, rHp: 48, hpGrade: .03, legMin: 120, legMax: [260, 480], look: 96, cliff: 1.6, maxHp: 8, hw: 14 };
// градиент по сглаженному рельефу: мелкие бугры дорога не замечает, их срежет полка
function mrGrad(x, y) { const e = 20; return [(landH(x + e, y) - landH(x - e, y)) / (2 * e), (landH(x, y + e) - landH(x, y - e)) / (2 * e)]; }
// расстояние наружу от края карты по стороне: 0 — верх, 1 — низ, 2 — левый, 3 — правый
function sideDs(side, x, y) { return side === 0 ? -y : side === 1 ? y - H : side === 2 ? -x : x - W; }
function sideAlong(side, x, y) { return side < 2 ? x : y; }
function sidePoint(side, along) { return side === 0 ? [along, 0] : side === 1 ? [along, H] : side === 2 ? [0, along] : [W, along]; }
// коридор: сетка 16 ед. в полосе от подножия до края; стоимость шага растёт с уклоном круче нормы и у самого края
function mrCorridor(sx, sy, ex, ey) {
  const G = 16, M = Math.floor(W / G) + 1, N = Math.floor(H / G) + 1, idx = (i, j) => j * M + i;
  const pass = new Uint8Array(M * N), hh = new Float32Array(M * N);
  const x0 = Math.max(0, Math.min(sx, ex) - 700), x1 = Math.min(W, Math.max(sx, ex) + 700), y0 = Math.max(0, Math.min(sy, ey) - 700), y1 = Math.min(H, Math.max(sy, ey) + 700);
  for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) {
    const x = i * G, y = j * G; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const h = landH(x, y), [a, b] = mrGrad(x, y); hh[idx(i, j)] = h;
    pass[idx(i, j)] = (waterD(x, y) > 24 && Math.hypot(a, b) < 2.2 && cityK(x, y) < .3) ? 1 : 0;
  }
  const cx = v => clamp(Math.round(v / G), 0, M - 1), cy = v => clamp(Math.round(v / G), 0, N - 1);
  const nearest = (i0, j0) => { for (let r = 0; r < 10; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < M && j < N && pass[idx(i, j)]) return idx(i, j); } return idx(i0, j0); };
  const s = nearest(cx(sx), cy(sy)), e = nearest(cx(ex), cy(ey)); pass[s] = 1; pass[e] = 1;
  const dist = new Float64Array(M * N).fill(Infinity), prev = new Int32Array(M * N).fill(-1), heap = [[0, s]]; dist[s] = 0;
  const push = (d, n) => { heap.push([d, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  let bestN = s, bestD = Infinity; const ei = e % M, ej = (e / M) | 0;
  while (heap.length) {
    const [d, n] = pop(); if (d > dist[n]) continue; if (n === e) break;
    const i = n % M, j = (n / M) | 0, dd = Math.hypot(i - ei, j - ej); if (dd < bestD) { bestD = dd; bestN = n; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= M || jj >= N) continue; const m = idx(ii, jj); if (!pass[m]) continue;
      const L = G * Math.hypot(di, dj), g = Math.abs(hh[m] - hh[n]) / L, xx = ii * G, yy = jj * G;
      const edge = 1 + 4 * clamp((40 - Math.min(xx, W - xx, yy, H - yy)) / 40); // у самого края дорого: не жмёмся к границе
      const c = L * (1 + 30 * Math.max(0, g - MR.grade)) * edge, nd = d + c; if (nd < dist[m]) { dist[m] = nd; prev[m] = n; push(nd, m); }
    }
  }
  const goal = prev[e] >= 0 ? e : bestN, path = [];
  for (let n = goal; n >= 0; n = prev[n]) path.push([(n % M) * G, ((n / M) | 0) * G]);
  path.reverse(); const wps = []; for (let k = 0; k < path.length; k += 6) wps.push(path[k]); wps.push(path[path.length - 1]); return wps;
}
// трассировка от подножия к перевалу вдоль коридора
function mrTrace(sx, sy, ex, ey, side) {
  const wps = mrCorridor(sx, sy, ex, ey); if (wps.length < 2) return null;
  const ds0 = sideDs(side, sx, sy);
  const inB = (x, y) => x > 6 && y > 6 && x < W - 6 && y < H - 6 && waterD(x, y) > 20 && sideDs(side, x, y) > ds0 - 80;
  const inM = (x, y, m) => x > m && y > m && x < W - m && y < H - m; // внутри карты с запасом
  const passAlong = sideAlong(side, ex, ey);
  const pts = [], wid = [];
  // свой след: дорога не пересекает уже проложенные плечи (кроме последних 40 точек — это она сама)
  const selfHit = (qx, qy, skip = 40) => { for (let k = 0; k < pts.length - skip; k++) { const p = pts[k]; if (Math.abs(p[0] - qx) < 56 && Math.abs(p[1] - qy) < 56 && Math.hypot(p[0] - qx, p[1] - qy) < 56) return true; } return false; };
  let x = sx, y = sy, wi = 1, leg = 0, legMax = rnd(MR.legMax[0], MR.legMax[1]), hairpins = 0, traversing = false;
  let hx = wps[1][0] - x, hy = wps[1][1] - y; { const L = Math.hypot(hx, hy) || 1; hx /= L; hy /= L; }
  for (let it = 0; it < 4000; it++) {
    pts.push([x, y]); wid.push(0);
    if (Math.hypot(x - ex, y - ey) < 40 || hairpins >= MR.maxHp || (it > 20 && (!inB(x, y) || !inM(x, y, 12)))) break;
    while (wi < wps.length - 1 && Math.hypot(wps[wi][0] - x, wps[wi][1] - y) < 56) wi++;
    const [gx, gy] = mrGrad(x, y), gm = Math.hypot(gx, gy) || 1e-6, ux = gx / gm, uy = gy / gm;
    const tx0 = wps[wi][0] - x, ty0 = wps[wi][1] - y, tL = Math.hypot(tx0, ty0) || 1, tx = tx0 / tL, ty = ty0 / tL;
    const riseDirect = gx * tx + gy * ty, h = landH(x, y);
    let dx, dy;
    // прямо, пока уклон позволяет; с гистерезисом, чтобы на шумном склоне курс не метался между прямым ходом и траверсом
    const goDirect = traversing ? (Math.abs(riseDirect) <= MR.grade * .8 || gm < MR.grade * 1.2) : (Math.abs(riseDirect) <= MR.grade * 1.1 || gm < MR.grade * 1.5);
    if (goDirect) { dx = tx; dy = ty; traversing = false; }
    else {
      let cx = -uy, cy = ux; const up = landH(ex, ey) > h + 4 ? 1 : -1; // цель выше — набираем, ниже — сбрасываем
      if (!traversing) { if (cx * tx + cy * ty < 0) { cx = -cx; cy = -cy; } traversing = true; leg = 0; } else if (cx * hx + cy * hy < 0) { cx = -cx; cy = -cy; }
      const th = Math.asin(Math.min(1, MR.grade / gm)); dx = cx * Math.cos(th) + up * ux * Math.sin(th); dy = cy * Math.cos(th) + up * uy * Math.sin(th);
    }
    // в прямом режиме свой след впереди обходим, отворачивая курс; на траверсе это стена, и ниже заложится петля
    if (!traversing && selfHit(x + dx * 64, y + dy * 64)) {
      for (const a of [.5, -.5, 1, -1, 1.5, -1.5]) { const c = Math.cos(a), s = Math.sin(a), qx = dx * c - dy * s, qy = dx * s + dy * c; if (!selfHit(x + qx * 64, y + qy * 64) && inM(x + qx * 64, y + qy * 64, 24)) { dx = qx; dy = qy; break; } }
    }
    // переходная кривая: курс меняется не быстрее 4,5° за шаг
    const a0 = Math.atan2(hy, hx), a1 = Math.atan2(dy, dx); let da = a1 - a0; da -= Math.round(da / TAU) * TAU; da = clamp(da, -.08, .08); hx = Math.cos(a0 + da); hy = Math.sin(a0 + da);
    const nx = x + hx * MR.step, ny = y + hy * MR.step;
    const [ax, ay] = mrGrad(nx + hx * 32, ny + hy * 32), cliff = Math.hypot(ax, ay) > MR.cliff, edgeAhead = cliff || !inB(nx + hx * 48, ny + hy * 48);
    // впереди край карты (не у самого перевала): петля обязательна, иначе дорога поползёт вдоль границы
    const fx = nx + hx * 64, fy = ny + hy * 64, toPass = sideDs(side, fx, fy) > -40 && Math.abs(sideAlong(side, fx, fy) - passAlong) < 160;
    const wall = !toPass && (!inM(fx, fy, 40) || selfHit(fx, fy));
    // плечо увело слишком далеко вдоль склона от цели — пора назад; петля только когда курс уже поперёк склона
    const alongOff = sideAlong(side, x, y) - sideAlong(side, ex, ey), alongV = side < 2 ? hx : hy;
    const awayFromGoal = alongOff * alongV > 0 && Math.abs(alongOff) > 300 && leg > 120;
    const across = Math.abs(hx * ux + hy * uy) < .75;
    if (traversing && across && gm > MR.grade * 1.3 && ((leg > legMax || awayFromGoal || (edgeAhead && leg > 120)) && leg > MR.legMin * .5 || (wall && leg > 24))) {
      // место для петли: из ближайших 96 ед. по ходу самое пологое, где петля ещё умещается в карте
      let best = 0, bs = 1e9; for (let k = 0; k <= MR.look; k += 16) { const qx = x + hx * k, qy = y + hy * k; if (!inB(qx, qy) || !inM(qx + hx * 56, qy + hy * 56, 24) || selfHit(qx + hx * MR.rHp, qy + hy * MR.rHp)) break; const [a, b] = mrGrad(qx, qy), s = Math.hypot(a, b); if (s < bs) { bs = s; best = k; } }
      for (let k = MR.step; k <= best; k += MR.step) { pts.push([x + hx * k, y + hy * k]); wid.push(0); }
      x += hx * best; y += hy * best;
      const [g2x, g2y] = mrGrad(x, y); let px = -hy, py = hx; if (px * g2x + py * g2y < 0) { px = -px; py = -py; }
      const cx = x + px * MR.rHp, cy = y + py * MR.rHp, sgn = (hx * py - hy * px) > 0 ? 1 : -1, n = 16;
      for (let k = 1; k <= n; k++) { const f = k / n * Math.PI * sgn, c = Math.cos(f), s = Math.sin(f), rx = x - cx, ry = y - cy; pts.push([clamp(cx + rx * c - ry * s, 8, W - 8), clamp(cy + rx * s + ry * c, 8, H - 8)]); wid.push(1); }
      const last = pts[pts.length - 1]; x = last[0]; y = last[1]; hx = -hx; hy = -hy; leg = 0; legMax = rnd(MR.legMax[0], MR.legMax[1]); hairpins++; traversing = true;
      continue;
    }
    x = clamp(nx, 8, W - 8); y = clamp(ny, 8, H - 8); leg += MR.step;
  }
  // довели до перевала: последняя точка ровно на краю карты, чтобы получился выезд
  const mx = (x + ex) / 2, my = (y + ey) / 2;
  if (Math.hypot(x - ex, y - ey) < 200 && !selfHit(ex, ey, 3) && !selfHit(mx, my, 3)) pts.push([ex, ey]); else if (sideDs(side, x, y) > -40) pts.push(sidePoint(side, sideAlong(side, x, y)));
  return { pts, wid, hairpins };
}
// точка перевала на краю карты: самое низкое место хребта в пределах ±600 от трассы
function mrPass(side, along0) {
  let best = null, bh = 1e9;
  const lim = side < 2 ? W : H;
  for (let a = along0 - 600; a <= along0 + 600; a += 16) { if (a < 40 || a > lim - 40) continue; const [x, y] = sidePoint(side, a); const h = landH(x, y) + Math.abs(a - along0) * .02; if (h < bh) { bh = h; best = [x, y]; } }
  return best;
}
// трассы, уходящие к краю карты на горной стороне, обрезаются у подножия и заменяются серпантином до перевала
function buildMountainRoads() {
  mountainRoads = [];
  if (massif) return buildMassifRoads();
  if (!ridgeSides.length) return;
  for (const side of ridgeSides) {
    const exits = RN.filter(n => n.ed.length === 1 && !n.dead && Math.abs(sideDs(side, n.x, n.y)) < 3);
    for (const n of exits) {
      if (n.ed[0].dead || n.ed[0].len < 200) continue;
      // подножие: идём по трассе от выезда внутрь, через узлы степени 2, пока горы не кончатся
      // два прохода: сначала строгое подножие (горы кончились за городом), иначе — где склон уже пологий, пусть и у самой окраины
      let e = null, from = null, tFoot = -1, chain = [];
      for (const [hMax, kMax] of [[10, .3], [40, .6]]) {
        e = n.ed[0]; from = n; tFoot = -1; chain = [];
        for (let hop = 0; hop < 6 && tFoot < 0; hop++) {
          const fromA = e.a === from;
          for (let t = 24; t < e.len - 24; t += 8) { const p = edgePos(e, fromA ? t : e.len - t); if (mountainH(p.x, p.y) < hMax && cityK(p.x, p.y) < kMax) { tFoot = fromA ? t : e.len - t; break; } }
          if (tFoot >= 0) break;
          const far = fromA ? e.b : e.a; if (far.ed.length !== 2 || far.exit) break;
          chain.push({ e, from }); from = far; e = far.ed.find(f => f !== chain[chain.length - 1].e && !f.dead); if (!e) break;
        }
        if (tFoot >= 0 && e) break;
      }
      if (tFoot < 0 || !e) continue;
      const foot = gSplit(e, tFoot); if (!foot || foot === from) continue;
      const tail = foot.ed.find(f => (f.a === from || f.b === from) && !f.dead); if (!tail) continue;
      reKill(tail); for (const c of chain) { reKill(c.e); c.from.dead = true; c.from.ed = []; } from.dead = true; from.ed = []; n.dead = true; n.ed = [];
      const pass = mrPass(side, sideAlong(side, n.x, n.y)); if (!pass) continue;
      const R = mrTrace(foot.x, foot.y, pass[0], pass[1], side); if (!R || R.pts.length < 12) continue;
      const made = addRoad(R.pts, Math.min(e.hw, MR.hw), "st", { extra: { rural: true, mountain: true, sw: e.sw } }); // горная дорога уже трассы: 7 м
      if (made) { for (const f of made.edges) f.mountain = true; mountainRoads.push({ side, hairpins: R.hairpins, pts: R.pts }); }
    }
  }
}
let mountainRoads = [];

/* ---------- горная страна: село на полке, серпантины из города к селу и от села к перевалу ----------
   Координаты полосы: ds — глубина от внутренней границы массива (0 у подножия, MOUNT_W у края карты), along — вдоль края */
// где горная страна и где полки с городками: окраинные постройки города (дачи, заправки, воинская часть, деревни) сюда не лезут
function inMassifArea(x, y, pad = 0) { return !!massif && (mountainH(x, y) > 12 || massif.terraces.some(t => Math.hypot(x - t.x, y - t.y) < t.r + pad)); }
function onTerrace(x, y, pad = 0) { return !!massif && massif.terraces.some(t => Math.hypot(x - t.x, y - t.y) < t.r + pad); }
function massifPoint(ds, along) { const M = massif; return M.side === 3 ? [W - M.w + ds, along] : [M.w - ds, along]; }
function massifDs(x, y) { return massif.w + sideDs(massif.side, x, y); }
// подножие трассы: от выезда внутрь по цепочке рёбер, пока массив не кончится; хвост за подножием убирается
function mrFoot(n, side) {
  let e = n.ed[0], from = n, tFoot = -1; const chain = [];
  for (let hop = 0; hop < 8 && tFoot < 0; hop++) {
    const fromA = e.a === from;
    for (let t = 24; t < e.len - 24; t += 8) { const p = edgePos(e, fromA ? t : e.len - t); if (mountainH(p.x, p.y) < 12 && cityK(p.x, p.y) < .5) { tFoot = fromA ? t : e.len - t; break; } }
    if (tFoot >= 0) break;
    // дальше по курсу: на перекрёстке просёлков берём продолжение с наименьшим поворотом
    const far = fromA ? e.b : e.a; if (far.exit) break;
    const pe = edgePos(e, fromA ? e.len - 1 : 1), hx = far.x - pe.x, hy = far.y - pe.y, hl = Math.hypot(hx, hy) || 1;
    let next = null, bestDot = .5;
    for (const f of far.ed) { if (f === e || f.dead || !f.rural && cityK(far.x, far.y) > .3) continue; const q = edgePos(f, f.a === far ? 1 : f.len - 1), dx = q.x - far.x, dy = q.y - far.y, dl = Math.hypot(dx, dy) || 1, dot = (hx * dx + hy * dy) / (hl * dl); if (dot > bestDot) { bestDot = dot; next = f; } }
    if (!next) break;
    chain.push({ e, from }); from = far; e = next;
  }
  if (tFoot < 0 || !e) return null;
  const foot = gSplit(e, tFoot); if (!foot || foot === from) return null;
  const tail = foot.ed.find(f => (f.a === from || f.b === from) && !f.dead); if (!tail) return null;
  reKill(tail); for (const c of chain) reKill(c.e);
  for (const c of chain) if (!c.from.ed.length) { c.from.dead = true; } if (!from.ed.length) from.dead = true; n.dead = true; n.ed = [];
  return foot;
}
// Зигзаг по склону массива, как его чертят дорожники: средний уклон g между концами задаёт угол плеч к горизонталям
// (sin θ = уклон/g), между плечами петли с центром выше по склону, число плеч подбирается так, чтобы дорога пришла в цель
// по оси склона. Стиль случайный: тесные петли и короткие плечи, обычные или широкие; плечи разной длины и с изгибом,
// последнее плечо идёт прямо в цель. Если живая трасса сблизилась сама с собой — строится ровная
function mrZigzag(sx, sy, ex, ey, side) {
  const d0 = massifDs(sx, sy), d1 = massifDs(ex, ey), a0 = sideAlong(side, sx, sy), a1 = sideAlong(side, ex, ey), D = d1 - d0, A = a1 - a0;
  if (D < 40) return null;
  const h0 = landH(sx, sy), h1 = landH(ex, ey), g = (h1 - h0) / D; if (g <= MR.grade * 1.05) return null;
  const pt = (a, d) => massifPoint(d, a), style = pick([{ R: 40, legMax: 340, j: .25 }, { R: 52, legMax: 480, j: .2 }, { R: 68, legMax: 640, j: .15 }]);
  const th = Math.asin(Math.min(1, MR.grade / g)), sn = Math.sin(th), cs = Math.cos(th), R0 = style.R;
  let best = null;
  for (let n = 2; n <= 11 && !best; n++) for (const s0 of [1, -1]) {
    const sumL = (D - (n - 1) * 2 * R0 * cs) / sn; if (sumL <= 0) continue;
    const p = Math.ceil(n / 2), q = n - p, u = (sumL + s0 * A / cs) / (2 * p), v = (sumL - s0 * A / cs) / (2 * q);
    if (u < 110 || u > style.legMax || v < 110 || v > style.legMax) continue;
    const legs = []; for (let k = 0; k < n; k++) legs.push(k % 2 ? v : u); if (!best || Math.abs(u - v) < best.spread) best = { n, s0, legs, spread: Math.abs(u - v) };
  }
  if (!best) { // цель далеко вдоль склона: подходной участок вдоль подножия, потом зигзаг
    if (Math.abs(A) < 400) return null;
    const run = Math.abs(A) - 320, sg = Math.sign(A), p1 = pt(a0 + sg * run, d0 + 30), rest = mrZigzag(p1[0], p1[1], ex, ey, side); if (!rest) return null;
    const pts = [], wid = []; for (let t = 0; t < run; t += 8) { pts.push(pt(a0 + sg * t, d0 + 30 * t / run)); wid.push(0); }
    return { pts: pts.concat(rest.pts), wid: wid.concat(rest.wid), hairpins: rest.hairpins };
  }
  const gen = jitter => {
    const pts = [], wid = []; let a = a0, d = d0, hairpins = 0; pts.push(pt(a, d)); wid.push(0);
    for (let k = 0; k < best.n - 1; k++) {
      const sk = k % 2 ? -best.s0 : best.s0, l = best.legs[k] * (jitter ? rnd(1 - style.j, 1 + style.j) : 1), Rk = jitter ? R0 * rnd(.8, 1.25) : R0, bow = jitter ? rnd(-16, 16) : 0;
      for (let t = 8; t <= l; t += 8) { const w = Math.sin(t / l * Math.PI) * bow; pts.push(pt(a + sk * cs * t - sn * w, d + sn * t + cs * w)); wid.push(0); }
      a += sk * cs * l; d += sn * l;
      const ca = a - sk * sn * Rk, cd = d + cs * Rk, ang0 = Math.atan2(d - cd, a - ca), turn = Math.PI - 2 * th;
      for (let j = 1; j <= 14; j++) { const f = ang0 + sk * turn * j / 14; pts.push(pt(ca + Math.cos(f) * Rk, cd + Math.sin(f) * Rk)); wid.push(1); }
      a = ca; d = cd + cs * Rk; hairpins++; const want = pt(a, d); pts[pts.length - 1] = want;
      if (d1 - d < 60) break;
    }
    const L = Math.hypot(a1 - a, d1 - d); if (L < 30) return null; for (let t = 8; t < L; t += 8) { pts.push(pt(a + (a1 - a) * t / L, d + (d1 - d) * t / L)); wid.push(0); }
    pts.push(pt(a1, d1)); wid.push(0);
    return { pts, wid, hairpins };
  };
  const close = P => { for (let i = 0; i < P.length; i++) for (let j = 0; j < i - 30; j++) if (Math.abs(P[i][0] - P[j][0]) < 64 && Math.abs(P[i][1] - P[j][1]) < 64 && Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) < 64) return true; return false; };
  let Rz = gen(true); if (!Rz || close(Rz.pts)) Rz = gen(false); return Rz;
}
// дорога по горизонталям: когда подъёма почти нет, трасса держит целевую высоту и огибает отроги и лощины
function mrContour(sx, sy, ex, ey, side) {
  const d0 = massifDs(sx, sy), d1 = massifDs(ex, ey), a0 = sideAlong(side, sx, sy), a1 = sideAlong(side, ex, ey), D = d1 - d0, A = a1 - a0;
  const h0 = landH(sx, sy), h1 = landH(ex, ey), pt = (a, d) => massifPoint(d, a);
  const N = Math.max(8, Math.ceil(Math.hypot(A, D) / 8)), pts = [pt(a0, d0)]; let d = d0;
  for (let k = 1; k <= N; k++) {
    const t = k / N, ak = a0 + A * t, dl = d0 + D * t, ht = h0 + (h1 - h0) * t; let bd = dl, bc = 1e9;
    for (let dd = d - 16; dd <= d + 16; dd += 2) { const q = pt(ak, dd), c = Math.abs(landH(q[0], q[1]) - ht) + Math.abs(dd - dl) * .03 + Math.abs(dd - d) * .02; if (c < bc) { bc = c; bd = dd; } }
    d = k === N ? d1 : bd; pts.push(pt(ak, d));
  }
  for (let p = 0; p < 3; p++) for (let i = 1; i < pts.length - 1; i++) pts[i] = [(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4];
  return { pts, wid: pts.map(() => 0), hairpins: 0 };
}
// горная дорога между двумя точками: зигзаг, где нужно набирать высоту, иначе по горизонталям; через воду — старый трассировщик
function mrRoad(sx, sy, ex, ey, side, hw) {
  let R = mrZigzag(sx, sy, ex, ey, side) || mrContour(sx, sy, ex, ey, side);
  if (R.pts.slice(1, -1).some(p => waterD(p[0], p[1]) < 20 || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H)) R = mrTrace(sx, sy, ex, ey, side);
  if (!R || R.pts.length < 6) return null;
  const last = R.pts[R.pts.length - 1]; if (Math.hypot(last[0] - ex, last[1] - ey) > 6) R.pts.push([ex, ey]);
  const made = addRoad(R.pts, hw, "st", { extra: { rural: true, mountain: true, sw: 3 } });
  if (made) { for (const f of made.edges) f.mountain = true; mountainRoads.push({ side, hairpins: R.hairpins, pts: R.pts }); }
  return made;
}
// кольцевая улица городка по полке (двумя дугами, чтобы у кольца были узлы) и проулок к ферме на больших полках
function ringPoint(t, ang) { const k = ang / TAU * 30, rk = t.rr * (1 + (fbm(k / 5 + t.x / 100, t.y / 100) - .5) * .25); return [t.x + Math.cos(ang) * rk, t.y + Math.sin(ang) * rk]; }
function buildTerraceRing(t) {
  t.rr = t.r * .6; const ring = []; for (let k = 0; k <= 30; k++) ring.push(ringPoint(t, k / 30 * TAU));
  // три дуги: две дуги с одними концами граф считает дубликатом и вторую выбрасывает
  for (const [i0, i1] of [[0, 10], [10, 20], [20, 30]]) addRoad(ring.slice(i0, i1 + 1), 9, "st", { extra: { rural: true, sw: 3 } });
}
function buildMassifRoads() {
  const M = massif, side = M.side, T = M.terraces;
  // трассы, упирающиеся в массив, обрезаются у подножия (пока улицы городков их не разрезали)
  // выезды с любого края, чья трасса идёт через горы: и на горном краю, и на верхнем/нижнем, где дорога лезла бы прямо на пик
  const atBorder = n => n.x < 3 || n.y < 3 || n.x > W - 3 || n.y > H - 3;
  const exits = RN.filter(n => n.ed.length === 1 && !n.dead && atBorder(n) && !n.ed[0].dead && n.ed[0].len >= 120 && (Math.abs(sideDs(side, n.x, n.y)) < 3 || mountainH(n.x, n.y) > 12 || mountainH(edgePos(n.ed[0], n.ed[0].len / 2).x, edgePos(n.ed[0], n.ed[0].len / 2).y) > 12));
  const a0 = T.length ? T[0].a : H / 2;
  exits.sort((p, q) => Math.abs(sideAlong(side, p.x, p.y) - a0) - Math.abs(sideAlong(side, q.x, q.y) - a0));
  const feet = []; for (const n of exits) { const foot = mrFoot(n, side); if (foot) feet.push(foot); }
  if (!feet.length) { // ни одна трасса не идёт к горам: от ближайшего узла загородной сети тянем просёлок к подножию
    const tgt = massifPoint(-60, a0); let best = null, bd = 1e9;
    for (const n of RN) { if (n.dead || n.exit || !n.ed.length || cityK(n.x, n.y) > .6) continue; const d = Math.hypot(n.x - tgt[0], n.y - tgt[1]); if (d < bd) { bd = d; best = n; } }
    if (best) { const foot = massifPoint(24, a0 + rnd(-80, 80)), mid = [(best.x + foot[0]) / 2 + rnd(-60, 60), (best.y + foot[1]) / 2 + rnd(-60, 60)];
      const made = addRoad([[best.x, best.y], mid, foot], 14, "st", { extra: { rural: true, sw: 3 } }); const fn = made && gNodeNear(foot[0], foot[1], 30); if (fn) feet.push(fn); }
  }
  for (const t of T) buildTerraceRing(t);
  // канатная дорога: нижняя станция у кольца нижнего городка со стороны вершины, верхняя — на площадке вершины
  if (M.summit && T.length) {
    const t = T[0], S = M.summit, f = Math.atan2(S.y - t.y, S.x - t.x), rp = ringPoint(t, f), L = [rp[0] + Math.cos(f) * 34, rp[1] + Math.sin(f) * 34];
    const len = Math.hypot(S.x - L[0], S.y - L[1]);
    funicular = { L, U: [S.x, S.y], hL: t.h, hU: S.h, len, supports: null, cabins: [], trips: 0 };
    const rot = f + Math.PI / 2;
    for (const [x, y, up] of [[L[0] - Math.cos(f) * 14, L[1] - Math.sin(f) * 14, 0], [S.x + Math.cos(f) * 14, S.y + Math.sin(f) * 14, 1]]) {
      addRotBuilding(x, y, 20, 12, rot, { kind: "cafe", floors: 1, style: 12, village: true, funi: up ? "up" : "down" });
      if (up) for (let k = 0; k < 5; k++) { const a = f + (k - 2) * .35; props.push({ k: "bench", x: S.x + Math.cos(a) * 34, y: S.y + Math.sin(a) * 34, a: a + Math.PI }); } // скамейки смотровой
    }
  }
  // просёлок вдоль подножия от первого подножия в обе стороны: у него встанут фермы и ранчо на пологих предгорьях
  if (feet.length) {
    const f0 = feet[0], fa = sideAlong(side, f0.x, f0.y), fd = massifDs(f0.x, f0.y);
    for (const sg of [-1, 1]) { const pts = [[f0.x, f0.y]]; for (let k = 1; k <= 9; k++) { const a = fa + sg * k * 60, d = fd + 90 + (fbm(a / 300 + 4, 8.8 + sg) - .5) * 120; if (a < 80 || a > H - 80) break; pts.push(massifPoint(Math.max(20, d), a)); }
      if (pts.length > 4 && !pts.some(p => waterD(p[0], p[1]) < 20)) addRoad(pts, 9, "st", { extra: { rural: true, sw: 3 } }); }
  }
  const towards = (t, px, py) => ringPoint(t, Math.atan2(py - t.y, px - t.x));
  if (!T.length) { if (feet.length) { const pass = mrPass(side, sideAlong(side, feet[0].x, feet[0].y)); if (pass) mrRoad(feet[0].x, feet[0].y, pass[0], pass[1], side, 12); } return; }
  // подъём из города к первой полке (до двух дорог), дальше от полки к полке, с последней — на перевал
  let made = 0; for (const foot of feet) { if (made >= 2) break; const E = towards(T[0], foot.x, foot.y); if (mrRoad(foot.x, foot.y, E[0], E[1], side, 14)) made++; }
  let prev = T[0];
  for (let i = 1; i < T.length; i++) { const S0 = towards(prev, T[i].x, T[i].y), E = towards(T[i], prev.x, prev.y); mrRoad(S0[0], S0[1], E[0], E[1], side, 12); prev = T[i]; }
  const pass = mrPass(side, prev.a); if (pass) { const S0 = towards(prev, pass[0], pass[1]); mrRoad(S0[0], S0[1], pass[0], pass[1], side, 12); }
}
// курортные городки на полках, по смыслу: у воды гостиницы, ресторан и церковь, по внешней стороне кольца шале с участками,
// внутри кольца парк у озера. Ни киосков, ни заправок, ни дач — это не окраина города
function buildMountainVillage() {
  if (!massif) return;
  // фермы и ранчо у просёлка вдоль подножия: по две на каждое плечо, по разные стороны
  for (const e of RE) {
    if (e.dead || e.mountain || e.hw > 10 || e.len < 150) continue; const pm = edgePos(e, e.len / 2), ds = massifDs(pm.x, pm.y); if (ds < 30 || ds > 340 || onTerrace(pm.x, pm.y, 60)) continue; // просёлок у подножия: узкий, не трасса
    // полоса вдоль просёлка — луг: лес вырубается под дворы
    { const band = new Set(); for (let s = 0; s <= e.len; s += 4) { const p = edgePos(e, s); for (let o = -150; o <= 150; o += 4) { const gx = Math.floor((p.x - p.ty * o) / CS), gy = Math.floor((p.y + p.tx * o) / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) band.add(gy * GW + gx); } }
      for (const i of band) if (grid[i] === 4) grid[i] = 2;
      trees = trees.filter(q => !band.has(Math.floor(q.y / CS) * GW + Math.floor(q.x / CS))); }
    for (const [k, sd, ranch] of [[.3, 1, false], [.7, -1, true]]) { const p = edgePos(e, e.len * k), x = p.x - p.ty * sd * 90, y = p.y + p.tx * sd * 90, b = blockAt(x, y); if (b && b.rural) buildFarm({ x, y, kind: ranch ? "meadow" : "field" }, b, ranch); }
  }
  for (const t of massif.terraces) {
    const village = RE.filter(e => { if (e.dead || e.mountain || !e.rural) return false; const p = edgePos(e, e.len / 2); return Math.hypot(p.x - t.x, p.y - t.y) < t.rr + 40; });
    if (!village.length) continue;
    // полоса вдоль кольца расчищается от леса: дома и дворы стоят на лугу
    { const band = new Set(); for (const e of village) for (let s = 0; s <= e.len; s += 4) { const p = edgePos(e, s); for (let o = -64; o <= 64; o += 4) { const gx = Math.floor((p.x - p.ty * o) / CS), gy = Math.floor((p.y + p.tx * o) / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) band.add(gy * GW + gx); } }
      for (const i of band) if (grid[i] === 4) grid[i] = 2;
      trees = trees.filter(q => !band.has(Math.floor(q.y / CS) * GW + Math.floor(q.x / CS))); }
    // церковь — на самом видном месте: со стороны озера, дальше всего от въезда (от самой низкой точки кольца)
    let church = false, hotels = 0, cafes = 0, houses = 0;
    const slots = [];
    for (const e of village) for (let s = 36; s < e.len - 30; s += rnd(40, 54)) for (const sd of [-1, 1]) { const p = edgePos(e, s), inner = ((t.x - p.x) * -p.ty + (t.y - p.y) * p.tx) * sd > 0; slots.push({ e, s, sd, inner, h: landH(p.x, p.y), lakeD: Math.hypot((p.x - t.lake.x) / t.lake.rx, (p.y - t.lake.y) / t.lake.ry) }); }
    // внутренняя сторона: ближе всего к воде — гостиницы, самое высокое место — церковь, рядом ресторан
    const innerSlots = slots.filter(q => q.inner).sort((a, b) => a.lakeD - b.lakeD);
    for (const q of innerSlots) {
      let b = null;
      if (hotels < 2 && q.lakeD < 3.2) { b = placeAlong(q.e, q.s, q.sd, rnd(26, 34), 12, 18, rnd(5, 8), { kind: "manor", floors: 3, style: 35, ridge: "x", village: true, hotel: true }); if (b) { hotels++; q.used = true; continue; } }
      if (cafes < 1 && q.lakeD < 3.6) { b = placeAlong(q.e, q.s, q.sd, 18, 10, 13, rnd(5, 8), { kind: "cafe", floors: 1, style: 12, village: true }); if (b) { cafes++; q.used = true; continue; } }
    }
    const high = innerSlots.filter(q => !q.used).sort((a, b) => b.h - a.h);
    for (const q of high) { if (church) break; const b = placeAlong(q.e, q.s, q.sd, 22, 18, 24, rnd(8, 12), { kind: "church", floors: 2, style: 31, ridge: "x", village: true }); if (b) { church = true; q.used = true; } }
    // шале: внешняя сторона кольца целиком и свободные места внутренней
    for (const q of slots) {
      if (q.used || Math.random() < .15) continue; const w = rnd(15, 21);
      const b = placeAlong(q.e, q.s, q.sd, w, 13, 18, rnd(8, 13), { kind: "house", floors: Math.random() < .6 ? 2 : 1, style: 11 + Math.floor(Math.random() * 4), ridge: "x", village: true, chalet: true });
      if (b) { houses++; suburbLot(q.e, q.s - 10, q.sd, w + 20, b); }
    }
  }
}

// ---------- канатная дорога: трос над склоном на опорах, кабинки по кругу, посадка на станциях ----------
// Опоры ставит жадный проход по профилю рельефа: от последней опоры берётся самый дальний пролёт (до 360 ед. = 90 м),
// в котором трос с провисом (3,5 % пролёта) везде выше земли на 10 ед.; если не проходит даже короткий пролёт — высокая опора.
// Над станциями трос держат порталы высотой 10, опоры по 16 (высокие 28)
const CABLE = { maxSpan: 360, minSpan: 60, clear: 10, sag: .035, pylon: 16, tall: 28, portal: 10, speed: 16, cap: 6 };
function cablePoint(F, d) { return [F.L[0] + (F.U[0] - F.L[0]) * d / F.len, F.L[1] + (F.U[1] - F.L[1]) * d / F.len]; }
function cableH(F, d) {
  const S = F.supports; if (!S) return F.hL + (F.hU - F.hL) * d / F.len;
  let k = 0; while (k < S.length - 2 && d > S[k + 1].d) k++;
  const a = S[k], b = S[k + 1], span = b.d - a.d || 1, t = clamp((d - a.d) / span);
  return a.h + (b.h - a.h) * t - span * CABLE.sag * 4 * t * (1 - t);
}
function planCableCar() {
  const F = funicular; if (!F) return;
  const n = Math.ceil(F.len / 8), prof = []; for (let i = 0; i <= n; i++) { const d = Math.min(F.len, i * 8), p = cablePoint(F, d); prof.push({ d, h: gY(p[0], p[1]) }); }
  const last = prof.length - 1, tops = [{ d: 0, h: F.hL + CABLE.portal, pylon: false }]; let i0 = 0;
  for (let guard = 0; guard < 60 && i0 < last; guard++) {
    const A = tops[tops.length - 1]; let best = null;
    for (let j = last; j > i0; j--) {
      const P = prof[j], span = P.d - A.d; if (span > CABLE.maxSpan) continue; if (span < CABLE.minSpan && j !== last) continue;
      const topH = j === last ? F.hU + CABLE.portal : P.h + CABLE.pylon; let ok = true;
      for (let k = i0 + 1; k < j; k++) { const Q = prof[k], u = (Q.d - A.d) / span, hc = A.h + (topH - A.h) * u - span * CABLE.sag * 4 * u * (1 - u); if (hc < Q.h + CABLE.clear) { ok = false; break; } }
      if (ok) { best = { j, topH }; break; }
    }
    if (!best) { const j = Math.min(last, i0 + 8); best = { j, topH: (j === last ? F.hU + CABLE.portal : prof[j].h + CABLE.tall) }; }
    tops.push({ d: prof[best.j].d, h: best.topH, pylon: best.j !== last, tall: best.topH - prof[best.j].h > CABLE.pylon + 1 }); i0 = best.j;
  }
  F.supports = tops;
  // кабинки по кругу: вверх по одной нитке, вниз по другой; шаг около 300 ед.
  const loop = F.len * 2, nc = Math.max(4, Math.round(loop / 300)); F.cabins = []; for (let k = 0; k < nc; k++) F.cabins.push({ s: loop * k / nc, riders: [] });
}
// положение кабинки: s по кругу [0, 2·len): до len — вверх, дальше — вниз; поперёк троса нитки разнесены на ±2.6
function cabinPos(F, c) { const up = c.s < F.len, d = up ? c.s : 2 * F.len - c.s, p = cablePoint(F, d), nx = -(F.U[1] - F.L[1]) / F.len, ny = (F.U[0] - F.L[0]) / F.len, o = up ? 2.6 : -2.6; return [p[0] + nx * o, p[1] + ny * o, cableH(F, d), d, up]; }
function stepFunicular(dt) {
  const F = funicular; if (!F || !F.cabins.length) return;
  const loop = F.len * 2;
  for (const c of F.cabins) {
    const [, , , d, up] = cabinPos(F, c), nearSt = Math.min(d, F.len - d) < 30, v = CABLE.speed * (nearSt ? .3 : 1);
    c.s = (c.s + v * dt) % loop;
    c.riders = c.riders.filter(a => a.state === "alive" && a.onBus === F);
    const atLower = d < 12 && up, atUpper = d > F.len - 12 && up, atUpperDown = d > F.len - 12 && !up, atLowerDown = d < 12 && !up;
    // высадка: приехавшие наверх (по верхней нитке) и вниз (по нижней)
    if ((atUpper || atLowerDown) && c.riders.length) { const st = atUpper ? F.U : F.L; for (const a of c.riders) { a.hidden = false; a.onBus = null; const [x, y] = freeNear(st[0], st[1], 16); a.x = x; a.y = y; a.vx = a.vy = 0; a.dest = null; a.panic = Math.min(a.panic || 0, .2); a.idleT = rnd(6, 30); } F.trips += c.riders.length; c.riders = []; }
    // посадка: внизу в кабинку, идущую вверх, наверху — идущую вниз
    if ((atLower || atUpperDown) && c.riders.length < CABLE.cap) { const st = atLower ? F.L : F.U;
      near(st[0], st[1], 30, a => { if (a.role === "civ" && a.state === "alive" && !a.hidden && !a.onBus && !a.detained && !a.hideB && c.riders.length < CABLE.cap && Math.random() < dt * (a.panic > .3 ? 3 : .8)) { a.hidden = true; a.onBus = F; a.vx = a.vy = 0; a.dest = null; a.hideGoal = null; c.riders.push(a); } }); }
    const p = cabinPos(F, c); for (const a of c.riders) { a.x = p[0]; a.y = p[1]; }
  }
}
