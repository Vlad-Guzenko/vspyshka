/* ---------- мини-карта ----------
   Подложка (раз в пару секунд): земля по клеткам, дороги, дома по назначению, карантин, значки важных зданий.
   Поверх каждый кадр: люди и зомби, машины служб, пожары, посты, лагеря, орда и беженцы стрелками с подписями,
   внешнее оцепление, рамка камеры. В углах — «раскрыть» (или клавиша M) и «легенда». */
const mini = $("mini"), mctx = mini.getContext("2d"), miniBase = document.createElement("canvas"), miniCells = document.createElement("canvas");
let MS = 1, miniBig = false, miniLegend = false, miniDpr = 1;
function miniResize() {
  miniDpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = miniBig ? 480 : 240, ch = miniBig ? 320 : 160;
  document.body.classList.toggle("miniBig", miniBig);
  mini.width = Math.round(cw * miniDpr); mini.height = Math.round(ch * miniDpr); MS = Math.min(mini.width / W, mini.height / H); gridDirtyMini = true; miniDirtyT = 0;
}
const MINI_CELL = [[92, 96, 100], [98, 101, 104], [63, 95, 52], [150, 145, 135], [44, 74, 38], [92, 96, 100], [184, 154, 60], [118, 114, 106], [107, 95, 80], [31, 64, 87], [122, 114, 104]];
const MINI_KIND = { hospital: "#eef0f0", police: "#4f7fe0", fire: "#d8503a", mall: "#c9a070", power: "#8a8070", water: "#7fa7c7", radio: "#9a9a90", church: "#d9b44a", station: "#b9a07a", school: "#d9c27a", gas: "#e8c040", market: "#d9a060", autoservice: "#8d8579", cafe: "#c88a5a", kinder: "#e0c070", garages: "#8a8a80", barn: "#8a5a3a", farmhouse: "#b49a6c", manor: "#c8b48c", cottage: "#b8a890", dacha: "#a8a07a", basehq: "#7b8a4f", kom: "#4f8a5e", stroy: "#b8823a", barracks: "#6f7d48", hangar: "#6a7068", warehouse: "#8d8579", factory: "#857d70",
  theater: "#d8b878", library: "#c8b07a", hotel: "#b8a088", townhall: "#d9a86a", clocktower: "#c9a060", mansion: "#d8c8a0", office: "#7fa3c2", clinic: "#e6ecf0", gym: "#9ab0c0", pool: "#7fb8d8", shop: "#c8a070",
  storage: "#6f8aa8", elevator: "#b0aca0", carwash: "#5a8ac0", bakery: "#b86a4a" };
function paintMiniBase() {
  miniBase.width = mini.width; miniBase.height = mini.height;
  const g = miniBase.getContext("2d");
  // земля по клеткам: одна клетка — один пиксель, потом растягиваем
  miniCells.width = GW; miniCells.height = GH;
  const cg = miniCells.getContext("2d"), img = cg.createImageData(GW, GH), d = img.data;
  for (let i = 0; i < GW * GH; i++) {
    const c = grid[i]; let col = MINI_CELL[c] || MINI_CELL[0];
    if (c === 0 || c === 5) col = roadMask[i] === 1 ? [128, 132, 138] : [96, 99, 103];
    if (c === 6) col = wallMask[i] ? (quarMask[i] ? [220, 120, 110] : [205, 198, 184]) : postMask[i] ? [240, 240, 240] : [184, 154, 60];
    let [r, gg, b] = col;
    // зона карантина — красноватый оттенок
    if (zoneOf[i] > 0 && c !== 6) { r = r * .7 + 160 * .3; gg *= .75; b *= .75; }
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(miniCells, 0, 0, mini.width, mini.height);
  // дома по назначению — поверх клеток, с поворотом
  for (const b of buildings) {
    const k = MINI_KIND[b.kind];
    g.fillStyle = b.state !== "ok" ? "#5a4a3c" : b.gutted ? "#4a4542" : k || (b.kind === "house" ? "#b4a48c" : b.kind === "tower" ? "#c4c8cc" : "#a7a297");
    g.save();
    if (b.rot !== undefined) { g.translate(b.cx * MS, b.cy * MS); g.rotate(b.rot); g.fillRect(-b.w / 2 * MS, -b.d / 2 * MS, b.w * MS, b.d * MS); }
    else g.fillRect(b.x0 * MS, b.y0 * MS, (b.x1 - b.x0) * MS, (b.y1 - b.y0) * MS);
    g.restore();
  }
  // значки важных зданий
  const icon = (x, y, bg, txt) => { const r = 6 * miniDpr; g.fillStyle = bg; g.beginPath(); g.arc(x * MS, y * MS, r, 0, TAU); g.fill(); g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = miniDpr; g.stroke(); g.fillStyle = "#fff"; g.font = `bold ${8 * miniDpr}px IBM Plex Sans, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, x * MS, y * MS + .5); };
  if (special.hospital) icon(special.hospital.x, special.hospital.y, "#d42020", "+");
  if (special.police) icon(special.police.x, special.police.y, "#3a66d0", "П");
  if (special.fire) icon(special.fire.x, special.fire.y, "#d8503a", "О");
  if (special.base) icon(special.base.x, special.base.y, "#5f6e3a", "★");
  if (special.kom) icon(special.kom.x, special.kom.y, "#2e7a46", "К"); // коммунальное депо
  if (special.stroy) icon(special.stroy.x, special.stroy.y, "#c9701c", "С"); // стройбаза
}
let miniDirtyT = 0, gridDirtyMini = true, miniDrag = false;
// подпись с тёмной обводкой
function miniText(t, x, y, col, size = 10) {
  mctx.font = `600 ${size * miniDpr}px IBM Plex Sans, sans-serif`; mctx.textAlign = "center"; mctx.textBaseline = "bottom";
  const px = clamp(x, 40 * miniDpr, mini.width - 40 * miniDpr), py = clamp(y, 14 * miniDpr, mini.height - 2);
  mctx.lineWidth = 3 * miniDpr; mctx.strokeStyle = "rgba(0,0,0,.85)"; mctx.strokeText(t, px, py); mctx.fillStyle = col; mctx.fillText(t, px, py);
}
function miniArrow(x0, y0, x1, y1, col, dash) {
  const a = Math.atan2(y1 - y0, x1 - x0), hs = 7 * miniDpr;
  mctx.strokeStyle = col; mctx.lineWidth = 2 * miniDpr; mctx.setLineDash(dash ? [5 * miniDpr, 4 * miniDpr] : []);
  mctx.beginPath(); mctx.moveTo(x0, y0); mctx.lineTo(x1 - Math.cos(a) * hs * .6, y1 - Math.sin(a) * hs * .6); mctx.stroke(); mctx.setLineDash([]);
  mctx.fillStyle = col; mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x1 - Math.cos(a - .45) * hs, y1 - Math.sin(a - .45) * hs); mctx.lineTo(x1 - Math.cos(a + .45) * hs, y1 - Math.sin(a + .45) * hs); mctx.closePath(); mctx.fill();
}
const mmss2 = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
// где сейчас орда: центр живых зомби этой орды и их разброс
function hordeCenter(h) {
  let n = 0, sx = 0, sy = 0; for (const a of agents) if (a.horde === h.id && a.state === "alive" && a.role === "zombie") { n++; sx += a.x; sy += a.y; }
  if (!n) return null; const cx = sx / n, cy = sy / n; let r = 0; for (const a of agents) if (a.horde === h.id && a.state === "alive" && a.role === "zombie") r = Math.max(r, Math.hypot(a.x - cx, a.y - cy));
  return { x: cx, y: cy, n, r: Math.min(r, 400) };
}
const SVC_COL = { police: "#4f8bff", fire: "#ff4a3a", ambulance: "#ffffff", army: "#b8c878", bus: "#e8c040", supply: "#c9a5f0" };
function drawMini(dt) {
  miniDirtyT -= dt; if (miniDirtyT <= 0 && gridDirtyMini) { gridDirtyMini = false; miniDirtyT = 2; paintMiniBase(); }
  mctx.drawImage(miniBase, 0, 0);
  const D = miniDpr, pulse = .5 + .5 * Math.sin(performance.now() / 260);
  // пожары
  for (const b of buildings) if (b.fire > 0 && b.state !== "ruin") { const x = (b.x0 + b.x1) / 2 * MS, y = (b.y0 + b.y1) / 2 * MS; mctx.fillStyle = `rgba(255,${120 + 80 * pulse | 0},40,.85)`; mctx.beginPath(); mctx.arc(x, y, (2.5 + pulse * 1.5) * D, 0, TAU); mctx.fill(); }
  // люди и зомби
  for (const a of agents) {
    if (a.state !== "alive" || a.hidden) continue;
    const hl = highlight && matchType(a, highlight);
    mctx.fillStyle = hl ? "#ffffff" : a.role === "zombie" ? (a.horde ? "#ff5a4a" : "#7fdf5a") : a.role === "army" ? "#c8d878" : a.role === "police" ? "#6f9bff" : a.bitten ? "#e8a447" : "#5fb3e8";
    const s = (hl ? 3 : a.role === "zombie" ? 2.2 : a.role === "army" || a.role === "police" ? 2 : 1.4) * D * (miniBig ? 1.15 : 1);
    mctx.fillRect(a.x * MS - s / 2, a.y * MS - s / 2, s, s);
  }
  // машины служб
  for (const c of cars) { if (c.gone || !c.service || c.wreck) continue; const col = SVC_COL[c.service]; if (!col) continue; mctx.fillStyle = col; mctx.strokeStyle = "rgba(0,0,0,.7)"; mctx.lineWidth = D * .8; const s = 3.4 * D; mctx.fillRect(c.x * MS - s / 2, c.y * MS - s / 2, s, s); mctx.strokeRect(c.x * MS - s / 2, c.y * MS - s / 2, s, s); }
  for (const t of tanks) { mctx.fillStyle = "#c6d36a"; mctx.fillRect(t.x * MS - 2.5 * D, t.y * MS - 2.5 * D, 5 * D, 5 * D); }
  // лагеря и точка эвакуации
  for (const c of camps) { mctx.fillStyle = "#f2b33d"; mctx.beginPath(); mctx.moveTo(c.x * MS, c.y * MS - 5 * D); mctx.lineTo(c.x * MS + 5 * D, c.y * MS + 4 * D); mctx.lineTo(c.x * MS - 5 * D, c.y * MS + 4 * D); mctx.closePath(); mctx.fill(); }
  if (evac) { mctx.strokeStyle = "#c9a5f0"; mctx.lineWidth = 1.5 * D; mctx.beginPath(); mctx.arc(evac.x * MS, evac.y * MS, 5 * D, 0, TAU); mctx.stroke(); }
  // посты: синий — полиция, оливковый — армия, чёрный — федералы; красная рамка — направление закрыто, крест — пост закрыт целиком
  for (const cp of cps) {
    const x = cp.x * MS, y = cp.y * MS, s = (cp.road ? 6 : 4) * D;
    mctx.fillStyle = cp.broken ? "#777" : cp.kind === "army" ? "#7b8a4f" : cp.kind === "fed" ? "#202020" : "#3a66d0";
    mctx.fillRect(x - s / 2, y - s / 2, s, s);
    mctx.lineWidth = 1.4 * D; mctx.strokeStyle = cp.shut || cp.closeIn || cp.closeOut ? "#ff3b30" : "#fff"; mctx.strokeRect(x - s / 2, y - s / 2, s, s);
    if (cp.shut) { mctx.beginPath(); mctx.moveTo(x - s / 2, y - s / 2); mctx.lineTo(x + s / 2, y + s / 2); mctx.moveTo(x + s / 2, y - s / 2); mctx.lineTo(x - s / 2, y + s / 2); mctx.stroke(); }
  }
  if (typeof threat !== "undefined" && threat) {
    // внешнее оцепление: красная пунктирная рамка по краю города и таймер ультиматума
    if (threat.fed && threat.fed.phase === "cordon") {
      mctx.strokeStyle = "rgba(255,59,48,.9)"; mctx.lineWidth = 2 * D; mctx.setLineDash([6 * D, 4 * D]);
      mctx.strokeRect((W - CITY_W * 1.08) / 2 * MS, (H - CITY_H * 1.08) / 2 * MS, CITY_W * 1.08 * MS, CITY_H * 1.08 * MS); mctx.setLineDash([]);
      miniText("УЛЬТИМАТУМ " + mmss2(threat.fed.deadline - simT), mini.width / 2, (H - CITY_H * 1.08) / 2 * MS - 2 * D, "#ff6b60", 11);
    }
    // беженцы: жёлтая стрелка от края карты к въезду
    for (const col of threat.cols) {
      if (col.done) continue; const en = entries[col.en]; if (!en) continue;
      const sx = clamp(en.x + en.tx * 4000, 30, W - 30), sy = clamp(en.y + en.ty * 4000, 30, H - 30), ex = en.x * MS, ey = en.y * MS;
      miniArrow(sx * MS + (ex - sx * MS) * .35, sy * MS + (ey - sy * MS) * .35, ex, ey, "rgba(242,200,70,.9)", true);
      miniText(col.policy === "closed" ? "беженцы · въезд закрыт" : "беженцы", ex, ey - 7 * D, "#f2c846", 9);
    }
    // орда: до выхода — пунктир от края карты и таймер; потом — круг вокруг орды и стрелка к въезду
    for (const h of threat.hordes) {
      if (h.done) continue; const en = entries[h.en]; if (!en) continue;
      const ex = en.x * MS, ey = en.y * MS;
      mctx.strokeStyle = `rgba(255,59,48,${.5 + .5 * pulse})`; mctx.lineWidth = 2 * D; mctx.beginPath(); mctx.arc(ex, ey, (7 + 3 * pulse) * D, 0, TAU); mctx.stroke();
      if (simT < h.emergeT) {
        miniArrow(h.x * MS, h.y * MS, ex, ey, "rgba(255,70,60,.95)", true);
        miniText(`орда ~${Math.round(h.n / 10) * 10} · ${mmss2(hordeEta(h))}`, h.x * MS + (ex - h.x * MS) * .5, h.y * MS + (ey - h.y * MS) * .5 - 4 * D, "#ff6b60", 10);
      } else {
        const c = hordeCenter(h);
        if (c) {
          mctx.fillStyle = "rgba(255,59,48,.18)"; mctx.strokeStyle = "rgba(255,59,48,.9)"; mctx.lineWidth = 1.5 * D;
          mctx.beginPath(); mctx.arc(c.x * MS, c.y * MS, Math.max(5 * D, c.r * MS), 0, TAU); mctx.fill(); mctx.stroke();
          if (Math.hypot(c.x - en.x, c.y - en.y) > 120) miniArrow(c.x * MS, c.y * MS, ex, ey, "rgba(255,70,60,.95)", false);
          miniText(`орда ${c.n}`, c.x * MS, c.y * MS - Math.max(6 * D, c.r * MS) - 2 * D, "#ff6b60", 10);
        }
      }
    }
  }
  // что видит камера: четыре угла кадра на земле
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { ndc.set(x, y); ray.setFromCamera(ndc, camera); plane.constant = 0; const p = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!p) { const d = ray.ray.direction; return [camera.position.x + d.x * 4000 + W / 2, camera.position.z + d.z * 4000 + H / 2]; } return [p.x + W / 2, p.z + H / 2]; });
  mctx.strokeStyle = "rgba(255,255,255,.85)"; mctx.lineWidth = D; mctx.beginPath();
  pts.forEach(([x, y], i) => i ? mctx.lineTo(clamp(x, -50, W + 50) * MS, clamp(y, -50, H + 50) * MS) : mctx.moveTo(clamp(x, -50, W + 50) * MS, clamp(y, -50, H + 50) * MS)); mctx.closePath(); mctx.stroke();
  // кнопки в углах: легенда слева, раскрыть справа
  const bs = 16 * D;
  mctx.fillStyle = "rgba(14,17,18,.8)"; mctx.fillRect(0, 0, bs, bs); mctx.fillRect(mini.width - bs, 0, bs, bs);
  mctx.fillStyle = "#e3e7e5"; mctx.font = `600 ${11 * D}px IBM Plex Sans, sans-serif`; mctx.textAlign = "center"; mctx.textBaseline = "middle";
  mctx.fillText("?", bs / 2, bs / 2 + D); mctx.fillText(miniBig ? "–" : "+", mini.width - bs / 2, bs / 2 + D);
  if (miniLegend) drawMiniLegend();
}
function drawMiniLegend() {
  const D = miniDpr, rows = [["#5fb3e8", "жители"], ["#7fdf5a", "зомби"], ["#ff5a4a", "зомби орды"], ["#6f9bff", "полиция"], ["#c8d878", "армия"], ["#e8a447", "укушенные"], ["#ff8a30", "пожар"], ["#3a66d0", "пост, КПП"], ["#ff3b30", "закрытый пост"], ["#f2b33d", "лагерь"], ["#f2c846", "беженцы"]];
  const lh = 12 * D, w = 108 * D, h = rows.length * lh + 8 * D, x0 = 4 * D, y0 = 20 * D;
  mctx.fillStyle = "rgba(14,17,18,.88)"; mctx.fillRect(x0, y0, w, h);
  mctx.font = `${9.5 * D}px IBM Plex Sans, sans-serif`; mctx.textAlign = "left"; mctx.textBaseline = "middle";
  rows.forEach(([c, t], i) => { const y = y0 + 4 * D + lh * i + lh / 2; mctx.fillStyle = c; mctx.fillRect(x0 + 5 * D, y - 3 * D, 6 * D, 6 * D); mctx.fillStyle = "#e3e7e5"; mctx.fillText(t, x0 + 16 * D, y); });
}
// клик: угловые кнопки или перенос камеры
function miniLocal(e) { const r = mini.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r]; }
function miniGo(e) { const [u, v] = miniLocal(e); followA = null; cine = false; syncCamButtons(); camS.tx = u * W - W / 2; camS.tz = v * H - H / 2; }
function miniButton(e) {
  const [u, v, r] = miniLocal(e), px = u * r.width, py = v * r.height;
  if (py < 16 && px < 16) { miniLegend = !miniLegend; return true; }
  if (py < 16 && px > r.width - 16) { miniBig = !miniBig; miniResize(); return true; }
  return false;
}
mini.addEventListener("pointerdown", e => { if (miniButton(e)) return; miniDrag = true; mini.setPointerCapture(e.pointerId); miniGo(e); });
mini.addEventListener("pointermove", e => { if (miniDrag) miniGo(e); });
mini.addEventListener("pointerup", () => { miniDrag = false; });
window.addEventListener("keydown", e => { if (e.code === "KeyM" && !["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) && !(typeof fps !== "undefined" && fps.on)) { miniBig = !miniBig; miniResize(); } });
miniResize();

/* ---------- подсветка по клику на плашку сводки ---------- */
let highlight = null, hlIndex = 0;
function matchType(a, k) {
  if (a.state === "saved") return k === "S";
  if (k === "D") return a.state === "dead" && a.role !== "zombie";
  if (a.state !== "alive") return false;
  if (k === "Z") return a.role === "zombie";
  if (k === "I") return a.role !== "zombie" && a.bitten;
  if (k === "H") return a.role !== "zombie" && !a.bitten;
  if (k === "F") return a.role === "army" || a.role === "police";
  return false;
}
const HL_NAME = { H: "здоровых", I: "укушенных", Z: "зомби", D: "погибших", S: "спасённых", F: "силовиков" };
document.querySelectorAll(".counts > div").forEach(el => {
  el.tabIndex = 0; el.setAttribute("role", "button");
  const go = () => {
    const k = el.dataset.k;
    if (highlight !== k) { highlight = k; hlIndex = 0; } else hlIndex++;
    const list = agents.filter(a => matchType(a, k));
    document.querySelectorAll(".counts > div").forEach(d => d.setAttribute("aria-pressed", d.dataset.k === highlight));
    if (k === "S" || !list.length) { $("tip").innerHTML = `<b>Подсветка:</b> ${HL_NAME[k]} сейчас нет на карте.`; return; }
    const a = list[hlIndex % list.length];
    followA = a; cine = false; camS.dist = Math.min(camS.dist, 150); camS.pitch = Math.min(camS.pitch, .6); syncCamButtons();
    $("tip").innerHTML = `<b>Подсветка:</b> ${HL_NAME[k]} ${list.length}. Показываю ${hlIndex % list.length + 1}-го, нажми ещё раз — следующий. Esc — снять.`;
  };
  el.addEventListener("click", go);
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
});
function clearHighlight() { highlight = null; document.querySelectorAll(".counts > div").forEach(d => d.setAttribute("aria-pressed", "false")); }

/* ---------- кинокамера: сама летит к самому интересному ---------- */
let cine = false, cineT = 0, cineTarget = null, thirdPerson = false;
function hotspot() {
  // свежее громкое событие или место, где зомби ближе всего к людям
  const fresh = interests.filter(e => simT - e.t < 6).sort((a, b) => b.w - a.w || b.t - a.t)[0];
  if (fresh && (!cineTarget || fresh !== cineTarget.ev)) return { x: fresh.x, y: fresh.y, ev: fresh, w: fresh.w };
  let best = null, bs = 0;
  for (let i = 0; i < 60; i++) {
    const z = agents[Math.floor(Math.random() * agents.length)];
    if (!z || z.state !== "alive" || z.role !== "zombie") continue;
    let n = 0; near(z.x, z.y, 60, b => { if (b.state === "alive" && b.role !== "zombie") n++; });
    if (n > bs) { bs = n; best = z; }
  }
  return best ? { x: best.x, y: best.y, a: best } : null;
}
function cineTick(dt) {
  if (!cine) return;
  cineT -= dt;
  const fresh = interests.find(e => simT - e.t < 1 && e.w >= 5 && (!cineTarget || cineTarget.ev !== e));
  if (cineT <= 0 || fresh) {
    const h = fresh ? { x: fresh.x, y: fresh.y, ev: fresh, w: fresh.w } : hotspot();
    if (h) { cineTarget = h; cineT = rnd(7, 12); camS.dist = h.w >= 5 ? rnd(260, 480) : rnd(70, 160); camS.pitch = rnd(.28, .6); camS.yaw = rnd(0, TAU); }
  }
  if (cineTarget) { const t = cineTarget.a && cineTarget.a.state === "alive" ? cineTarget.a : cineTarget; camS.tx = X(t.x); camS.tz = Z(t.y); camS.yaw += dt * .07; }
}
function syncCamButtons() {
  $("camCine").setAttribute("aria-pressed", cine); $("stage").classList.toggle("cine", cine);
  if (!cine && newsOn) toggleNews(false);
  $("camThird").setAttribute("aria-pressed", thirdPerson && !!followA);
}
$("camOver").addEventListener("click", () => { followA = null; cine = false; thirdPerson = false; camS.tx = 0; camS.tz = 60; camS.dist = 1700 * W / 2400; camS.pitch = .9; syncCamButtons(); });
$("camStreet").addEventListener("click", () => { cine = false; camS.dist = 55; camS.pitch = .16; syncCamButtons(); });
$("camCine").addEventListener("click", () => { cine = !cine; thirdPerson = false; if (cine) { followA = null; cineT = 0; } syncCamButtons(); });
$("camThird").addEventListener("click", () => {
  if (!followA) { const a = agents.find(a => a.state === "alive" && a.role === "civ" && Math.hypot(X(a.x) - camC.tx, Z(a.y) - camC.tz) < 300) || agents.find(a => a.state === "alive"); followA = a; }
  thirdPerson = !thirdPerson; cine = false; syncCamButtons();
});
$("camHelp").addEventListener("click", () => { $("help").hidden = !$("help").hidden; });
$("helpClose").addEventListener("click", () => { $("help").hidden = true; });

/* ---------- предпросмотр инструмента под курсором ---------- */
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
const ghost = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 96).rotateX(-Math.PI / 2), ghostMat);
const ghostUnit = ghost.geometry.attributes.position.array.slice(); // кольцо радиуса 1: из него каждый кадр строится кольцо по рельефу
ghost.renderOrder = 7; ghost.visible = false; scene.add(ghost);
const GHOST = { tower: [8, "#b58a55"], flood: [95, "#fff1c0"], camp: [46, "#f2b33d"], supply: [170, "#c9a5f0"], wall: [6, "#9d998f"], boom: [48, "#ff8a3a"], meteor: [120, "#c0502a"], fire: [16, "#ff5a2a"], horde: [28, "#4fa52a"], depot: [10, "#f2b33d"], lab: [10, "#7fd0e0"], vaccinate: [14, "#5fe0a0"], quarantine: [4, "#9d998f"], nuke: [440, "#ffd23a"], firefighters: [14, "#ff5a3a"], repair: [14, "#f08a1c"], barricade: [6, "#d9a35a"], erase: [6, "#bbbbbb"], strike: [70, "#ff4a3a"], tank: [14, "#c6d36a"], army: [22, "#c6d36a"], police: [18, "#6f9cff"], medic: [16, "#ffffff"], evac: [20, "#c9a5f0"], zombie: [4, "#7fdf5a"], infect: [5, "#e8c447"] };
let ghostPos = null;
const qLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3].map(() => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xffe08a, toneMapped: false }));
qLine.visible = false; qLine.renderOrder = 8; scene.add(qLine);
function updateGhost() {
  qLine.visible = !!(qStart && qEnd);
  if (qLine.visible) { const [x0, y0] = qStart, [x1, y1] = qEnd, p = qLine.geometry.attributes.position; [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i) => p.setXYZ(i, X(x), gY(x, y) + 2, Z(y))); p.needsUpdate = true; }
  const g = GHOST[tool];
  ghost.visible = !!(g && ghostPos && !drag);
  if (!ghost.visible) return;
  // на равнине — плоское кольцо; в горах каждая точка кольца ставится на землю под ней, иначе на склоне круг уходил под грунт
  const P = ghost.geometry.attributes.position, gx = ghostPos[0], gz = ghostPos[1];
  if (hasHills) { for (let i = 0; i < P.count; i++) { const ux = ghostUnit[i * 3] * g[0], uz = ghostUnit[i * 3 + 2] * g[0]; P.setXYZ(i, ux, gY(gx + ux, gz + uz) + .8, uz); } P.needsUpdate = true; ghost.position.set(X(gx), 0, Z(gz)); ghost.scale.setScalar(1); ghost.geometry.computeBoundingSphere(); }
  else { if (ghost.userData.draped) { P.array.set(ghostUnit); P.needsUpdate = true; ghost.geometry.computeBoundingSphere(); } ghost.position.set(X(gx), .4, Z(gz)); ghost.scale.setScalar(g[0]); }
  ghost.userData.draped = hasHills; ghostMat.color.set(g[1]);
  ghostMat.opacity = .45 + .2 * Math.sin(performance.now() / 180);
}
