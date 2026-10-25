/* ---------- мини-карта ---------- */
const mini = $("mini"), mctx = mini.getContext("2d"), miniBase = document.createElement("canvas");
const MS = mini.width / W;
function paintMiniBase() {
  miniBase.width = mini.width; miniBase.height = mini.height;
  const g = miniBase.getContext("2d");
  g.fillStyle = "#3c4044"; g.fillRect(0, 0, mini.width, mini.height);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = grid[y * GW + x];
    g.fillStyle = c === 3 ? "#9b958a" : c === 1 || c === 7 ? "#5d6064" : c === 2 || c === 4 ? "#3f5f34" : c === 9 ? "#1f4057" : c === 8 ? "#6b5f50" : c === 10 ? "#7a7268" : c === 6 ? (wallMask[y * GW + x] ? "#c9c2b4" : "#b89a3c") : null;
    if (g.fillStyle && c !== 0 && c !== 5) g.fillRect(x * CS * MS, y * CS * MS, CS * MS + .5, CS * MS + .5);
  }
}
let miniDirtyT = 0;
function drawMini(dt) {
  miniDirtyT -= dt; if (miniDirtyT <= 0 && gridDirtyMini) { gridDirtyMini = false; miniDirtyT = 2; paintMiniBase(); }
  mctx.drawImage(miniBase, 0, 0);
  for (const a of agents) {
    if (a.state !== "alive") continue;
    const hl = highlight && matchType(a, highlight);
    mctx.fillStyle = hl ? "#ffffff" : a.role === "zombie" ? "#7fdf5a" : a.role === "army" || a.role === "police" ? "#f2d04a" : a.bitten ? "#e8a447" : "#5fb3e8";
    const s = hl ? 3 : a.role === "zombie" ? 2.2 : 1.5;
    mctx.fillRect(a.x * MS - s / 2, a.y * MS - s / 2, s, s);
  }
  for (const t of tanks) { mctx.fillStyle = "#c6d36a"; mctx.fillRect(t.x * MS - 2.5, t.y * MS - 2.5, 5, 5); }
  if (evac) { mctx.strokeStyle = "#c9a5f0"; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(evac.x * MS, evac.y * MS, 5, 0, TAU); mctx.stroke(); }
  // что видит камера: четыре угла кадра на земле
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { ndc.set(x, y); ray.setFromCamera(ndc, camera); plane.constant = 0; const p = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!p) { const d = ray.ray.direction; return [camera.position.x + d.x * 4000 + W / 2, camera.position.z + d.z * 4000 + H / 2]; } return [p.x + W / 2, p.z + H / 2]; });
  mctx.strokeStyle = "rgba(255,255,255,.85)"; mctx.lineWidth = 1; mctx.beginPath();
  pts.forEach(([x, y], i) => i ? mctx.lineTo(clamp(x, -50, W + 50) * MS, clamp(y, -50, H + 50) * MS) : mctx.moveTo(clamp(x, -50, W + 50) * MS, clamp(y, -50, H + 50) * MS)); mctx.closePath(); mctx.stroke();
}
let gridDirtyMini = true, miniDrag = false;
function miniGo(e) { const r = mini.getBoundingClientRect(); followA = null; cine = false; syncCamButtons(); camS.tx = (e.clientX - r.left) / r.width * W - W / 2; camS.tz = (e.clientY - r.top) / r.height * H - H / 2; }
mini.addEventListener("pointerdown", e => { miniDrag = true; mini.setPointerCapture(e.pointerId); miniGo(e); });
mini.addEventListener("pointermove", e => { if (miniDrag) miniGo(e); });
mini.addEventListener("pointerup", () => { miniDrag = false; });

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
const ghost = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 48).rotateX(-Math.PI / 2), ghostMat);
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
  ghost.position.set(X(ghostPos[0]), gY(ghostPos[0], ghostPos[1]) + .4, Z(ghostPos[1])); ghost.scale.setScalar(g[0]); ghostMat.color.set(g[1]);
  ghostMat.opacity = .45 + .2 * Math.sin(performance.now() / 180);
}
