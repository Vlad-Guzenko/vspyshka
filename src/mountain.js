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
// (sin θ = уклон/g, так подъём на плече ровно норма), между плечами петли радиусом R с центром выше по склону (каждая
// поднимает дорогу на 2R·cos θ по склону), число плеч подбирается так, чтобы плечи были 100–520 ед. и дорога пришла
// точно в цель по оси склона. Складки рельефа срежет полка. Координаты: a — вдоль края, d — глубина в массив
function mrZigzag(sx, sy, ex, ey, side) {
  const M = massif, d0 = massifDs(sx, sy), d1 = massifDs(ex, ey), a0 = sideAlong(side, sx, sy), a1 = sideAlong(side, ex, ey);
  const D = d1 - d0, A = a1 - a0; if (D < 40) return null;
  const h0 = landH(sx, sy), h1 = landH(ex, ey), g = (h1 - h0) / D;
  const pt = (a, d) => massifPoint(d, a), R = MR.rHp, pts = [], wid = [];
  if (g <= MR.grade * 1.05) { // пологий склон: прямая с лёгким изгибом
    for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(pt(a0 + A * t + Math.sin(t * Math.PI) * 30, d0 + D * t)); wid.push(0); }
    return { pts, wid, hairpins: 0 };
  }
  const th = Math.asin(Math.min(1, MR.grade / g)), sn = Math.sin(th), cs = Math.cos(th);
  // плечи «туда» (s0) длиной u и «обратно» длиной v: p·u + q·v = ΣL (подъём по склону), p·u − q·v = A/cos θ (смещение вдоль)
  let best = null;
  for (let n = 2; n <= 9 && !best; n++) for (const s0 of [1, -1]) {
    const sumL = (D - (n - 1) * 2 * R * cs) / sn; if (sumL <= 0) continue;
    const p = Math.ceil(n / 2), q = n - p, u = (sumL + s0 * A / cs) / (2 * p), v = (sumL - s0 * A / cs) / (2 * q);
    if (u < 150 || u > 600 || v < 150 || v > 600) continue;
    const legs = []; for (let k = 0; k < n; k++) legs.push(k % 2 ? v : u);
    const spread = Math.abs(u - v); if (!best || spread < best.spread) best = { n, s0, legs, spread };
  }
  if (!best) {
    // цель слишком далеко вдоль склона: сначала подходной участок вдоль подножия, потом зигзаг от него
    if (Math.abs(A) < 420) return null;
    const run = Math.abs(A) - 360, sg = Math.sign(A), p1 = pt(a0 + sg * run, d0 + 36);
    const rest = mrZigzag(p1[0], p1[1], ex, ey, side); if (!rest) return null;
    for (let t = 0; t < run; t += 8) { pts.push(pt(a0 + sg * t, d0 + 36 * t / run)); wid.push(0); }
    return { pts: pts.concat(rest.pts), wid: wid.concat(rest.wid), hairpins: rest.hairpins };
  }
  // живая трасса: плечи разной длины, петли разного радиуса, плечо чуть выгнуто по складке; последнее плечо идёт прямо в цель.
  // Если такая трасса пересекла сама себя — строится ровная
  const gen = jitter => {
  const pts = [], wid = []; let a = a0, d = d0, hairpins = 0;
  pts.push(pt(a, d)); wid.push(0);
  for (let k = 0; k < best.n - 1; k++) {
    const sk = k % 2 ? -best.s0 : best.s0, l = best.legs[k] * (jitter ? rnd(.78, 1.22) : 1), Rk = jitter ? rnd(40, 60) : R, bow = jitter ? rnd(-14, 14) : 0;
    for (let t = 8; t <= l; t += 8) { const w = Math.sin(t / l * Math.PI) * bow; pts.push(pt(a + sk * cs * t - sn * w, d + sn * t + cs * w)); wid.push(0); }
    a += sk * cs * l; d += sn * l;
    // петля: дуга на π−2θ вокруг центра выше по склону; конец на той же a, глубже на 2R·cos θ
    const ca = a - sk * sn * Rk, cd = d + cs * Rk, ang0 = Math.atan2(d - cd, a - ca), turn = Math.PI - 2 * th, nseg = 14;
    for (let j = 1; j <= nseg; j++) { const f = ang0 + sk * turn * j / nseg; pts.push(pt(ca + Math.cos(f) * Rk, cd + Math.sin(f) * Rk)); wid.push(1); }
    a = ca; d = cd + cs * Rk; hairpins++;
    const last = pts[pts.length - 1], want = pt(a, d); last[0] = want[0]; last[1] = want[1];
    if (d1 - d < 60) break; // перебрали подъём — дальше прямо
  }
  { const L = Math.hypot(a1 - a, d1 - d); if (L < 40) return null; for (let t = 8; t < L; t += 8) { pts.push(pt(a + (a1 - a) * t / L, d + (d1 - d) * t / L)); wid.push(0); } }
  pts.push(pt(a1, d1)); wid.push(0);
  return { pts, wid, hairpins };
  };
  // трасса не должна ни пересекать себя, ни подходить к своему же плечу ближе ширины полки с откосами
  const crosses = P => { for (let i = 0; i < P.length; i++) for (let j = 0; j < i - 30; j++) if (Math.abs(P[i][0] - P[j][0]) < 70 && Math.abs(P[i][1] - P[j][1]) < 70 && Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) < 70) return true; return false; };
  let Rz = gen(true); if (!Rz || crosses(Rz.pts)) Rz = gen(false);
  return Rz;
}
// серпантин между двумя точками: в массиве — зигзаг, если он не задевает воду; иначе пошаговый трассировщик
function mrRoad(sx, sy, ex, ey, side, hw) {
  let R = massif ? mrZigzag(sx, sy, ex, ey, side) : null;
  if (R && R.pts.slice(0, -1).some(p => waterD(p[0], p[1]) < 20 || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H)) R = null;
  if (!R) R = mrTrace(sx, sy, ex, ey, side);
  if (!R || R.pts.length < 6) return null;
  const last = R.pts[R.pts.length - 1]; if (Math.hypot(last[0] - ex, last[1] - ey) > 6) R.pts.push([ex, ey]);
  const made = addRoad(R.pts, hw, "st", { extra: { rural: true, mountain: true, sw: 3 } });
  if (made) { for (const f of made.edges) f.mountain = true; mountainRoads.push({ side, hairpins: R.hairpins, pts: R.pts }); }
  return made;
}
// улицы курортного городка на полке: главная улица вдоль хребта, набережная вокруг озера, на нижней полке проулки к фермам
function buildShelfStreets(S, lanes) {
  const Lk = S.lake, half = S.pw * .75, main = [];
  for (let a = S.a - half; a <= S.a + half; a += 40) main.push(massifPoint(S.d0 + 60 + (fbm(a / 260 + 2 + S.d0, 7.7) - .5) * 40, a));
  if (!addRoad(main, 10, "st", { extra: { rural: true, sw: 3 } })) return null;
  const lds = massifDs(Lk.x, Lk.y), prom = [massifPoint(S.d0 + 60, Lk.y - Lk.ry - 150), massifPoint(S.d0 + 110, Lk.y - Lk.ry - 120)];
  for (let k = 0; k <= 14; k++) { const f = -Math.PI * .55 + Math.PI * 1.1 * k / 14; prom.push(massifPoint(lds + Math.cos(f) * (Lk.rx + 38), Lk.y + Math.sin(f) * (Lk.ry + 38))); }
  prom.push(massifPoint(S.d0 + 110, Lk.y + Lk.ry + 120), massifPoint(S.d0 + 60, Lk.y + Lk.ry + 150));
  addRoad(prom, 8, "st", { extra: { rural: true, sw: 3 } });
  if (lanes) for (const a of [S.a - half * .8, S.a + half * .8]) addRoad([massifPoint(S.d0 + 60, a), massifPoint(S.d0 + 170, a + rnd(-30, 30)), massifPoint(S.d1 - 40, a + rnd(-50, 50))], 8, "st", { extra: { rural: true, sw: 3 } });
  return { ends: [massifPoint(S.d0 + 60, S.a - half), massifPoint(S.d0 + 60, S.a + half)], far: massifPoint(lds + Lk.rx + 38, Lk.y) };
}
function buildMassifRoads() {
  const M = massif, side = M.side, a0 = M.a0, [A, B] = M.shelves;
  // сначала трассы, упирающиеся в массив, обрезаются у подножия (пока их не разрезали улицы городков)
  const exits = RN.filter(n => n.ed.length === 1 && !n.dead && Math.abs(sideDs(side, n.x, n.y)) < 3 && n.ed[0].len >= 200 && !n.ed[0].dead);
  exits.sort((p, q) => Math.abs(sideAlong(side, p.x, p.y) - a0) - Math.abs(sideAlong(side, q.x, q.y) - a0));
  const feet = []; for (const n of exits) { const foot = mrFoot(n, side); if (foot) feet.push(foot); }
  if (!feet.length) {
    // ни одна трасса не идёт к горам: от ближайшего к массиву узла загородной сети тянем просёлок к подножию
    const tgt = massifPoint(-60, A.a); let best = null, bd = 1e9;
    for (const n of RN) { if (n.dead || n.exit || !n.ed.length || cityK(n.x, n.y) > .6) continue; const d = Math.hypot(n.x - tgt[0], n.y - tgt[1]); if (d < bd) { bd = d; best = n; } }
    if (best) { const foot = massifPoint(24, A.a + rnd(-80, 80)), mid = [(best.x + foot[0]) / 2 + rnd(-60, 60), (best.y + foot[1]) / 2 + rnd(-60, 60)];
      const made = addRoad([[best.x, best.y], mid, foot], 14, "st", { extra: { rural: true, sw: 3 } });
      const fn = made && gNodeNear(foot[0], foot[1], 30); if (fn) feet.push(fn); }
  }
  const sa = buildShelfStreets(A, true), sb = buildShelfStreets(B, false); if (!sa) return;
  // серпантины из города: от подножий к концам улицы нижнего городка (не больше двух; лишние трассы кончаются у подножия)
  const ends = sa.ends.slice(); let made = 0;
  for (const foot of feet) {
    if (made >= 2 || !ends.length) break;
    const fa = sideAlong(side, foot.x, foot.y); ends.sort((p, q) => Math.abs(sideAlong(side, p[0], p[1]) - fa) - Math.abs(sideAlong(side, q[0], q[1]) - fa));
    const E = ends.shift(); if (mrRoad(foot.x, foot.y, E[0], E[1], side, 14)) made++;
  }
  // от набережной нижнего городка — серпантин к ближнему концу улицы верхнего; от его набережной — дорога на перевал
  if (sb) {
    const fa = sideAlong(side, sa.far[0], sa.far[1]); sb.ends.sort((p, q) => Math.abs(sideAlong(side, p[0], p[1]) - fa) - Math.abs(sideAlong(side, q[0], q[1]) - fa));
    mrRoad(sa.far[0], sa.far[1], sb.ends[0][0], sb.ends[0][1], side, 12);
    const pass = mrPass(side, sb.far[1]); if (pass) mrRoad(sb.far[0], sb.far[1], pass[0], pass[1], side, 12);
  } else { const pass = mrPass(side, sa.far[1]); if (pass) mrRoad(sa.far[0], sa.far[1], pass[0], pass[1], side, 12); }
}
// курортные городки на полках: гостиницы и кафе у набережной, церковь у озера, домики-шале вдоль улиц, фермы у проулков нижней полки
function buildMountainVillage() {
  if (!massif) return;
  const M = massif;
  for (const S of M.shelves) {
    const half = S.pw * .75 + 60;
    const village = RE.filter(e => { if (e.dead || e.mountain || !e.rural) return false; const p = edgePos(e, e.len / 2), ds = massifDs(p.x, p.y); return ds > S.d0 + 20 && ds < S.d1 + 20 && Math.abs(sideAlong(M.side, p.x, p.y) - S.a) < half; });
    if (!village.length) continue;
    // полоса вдоль улиц расчищается от леса: дома и дворы стоят на лугу
    { const band = new Set(); for (const e of village) for (let t = 0; t <= e.len; t += 4) { const p = edgePos(e, t); for (let o = -64; o <= 64; o += 4) { const gx = Math.floor((p.x - p.ty * o) / CS), gy = Math.floor((p.y + p.tx * o) / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) band.add(gy * GW + gx); } }
      for (const i of band) if (grid[i] === 4) grid[i] = 2;
      trees = trees.filter(t => !band.has(Math.floor(t.y / CS) * GW + Math.floor(t.x / CS))); }
    const lds = massifDs(S.lake.x, S.lake.y);
    const isLane = e => { const pm = edgePos(e, e.len / 2); return e.len < 400 && Math.abs(sideAlong(M.side, pm.x, pm.y) - S.a) > S.pw * .5; };
    const isProm = e => { const pm = edgePos(e, e.len / 2); return !isLane(e) && Math.abs(massifDs(pm.x, pm.y) - lds) < S.lake.rx + 60 && Math.abs(sideAlong(M.side, pm.x, pm.y) - S.lake.y) < S.lake.ry + 200 && massifDs(pm.x, pm.y) > S.d0 + 80; };
    // фермы у проулков (только нижняя полка)
    for (const e of village) {
      if (!isLane(e)) continue;
      for (const [t, sd, ranch] of [[e.len * .45, 1, false], [e.len * .6, -1, true]]) { const p = edgePos(e, t), x = p.x - p.ty * sd * 90, y = p.y + p.tx * sd * 90, b = blockAt(x, y); if (b && b.rural) buildFarm({ x, y, kind: ranch ? "meadow" : "field" }, b, ranch); }
    }
    let houses = 0, church = false, hotels = 0, cafes = 0;
    for (const e of village) {
      if (isLane(e)) continue; const prom = isProm(e);
      for (let t = 36; t < e.len - 30; t += rnd(40, 54)) for (const side of [-1, 1]) {
        if (Math.random() < .2) continue; const w = rnd(15, 21);
        const kind = prom && hotels < 2 && Math.random() < .35 ? "hotel" : prom && !church && Math.random() < .3 ? "church" : cafes < 2 && Math.random() < .1 ? "cafe" : "house";
        const b = kind === "hotel" ? placeAlong(e, t, side, rnd(30, 40), 16, 22, rnd(6, 10), { kind: "manor", floors: 3, style: 35, ridge: "x", village: true, hotel: true })
          : kind === "church" ? placeAlong(e, t, side, 22, 18, 24, rnd(8, 12), { kind: "church", floors: 2, style: 31, ridge: "x", village: true })
          : kind === "cafe" ? placeAlong(e, t, side, 18, 12, 14, rnd(6, 9), { kind: "cafe", floors: 1, style: 12, village: true })
          : placeAlong(e, t, side, w, 13, 18, rnd(8, 13), { kind: "house", floors: Math.random() < .6 ? 2 : 1, style: 11 + Math.floor(Math.random() * 4), ridge: "x", village: true, chalet: true });
        if (!b) continue;
        if (kind === "hotel") hotels++; else if (kind === "church") church = true; else if (kind === "cafe") cafes++; else { houses++; suburbLot(e, t - 10, side, w + 20, b); }
      }
    }
    if (houses >= 4) { const e = village[0], p = edgePos(e, e.len * .5); props.push({ k: "kiosk", x: p.x + (-p.ty) * (e.hw + 9), y: p.y + p.tx * (e.hw + 9), a: Math.atan2(-p.tx, p.ty), v: 0 }); }
  }
}
