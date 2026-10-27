/* ---------- камера: орбита вокруг точки на земле ---------- */
const camS = { tx: 0, tz: 60, dist: 1700, yaw: -1.05, pitch: .9 }, camC = { ...camS };
const camDist = () => camC.dist;
function updateCamera(dt) {
  cineTick(dt);
  if (followA) { if (followA.state === "saved") followA = null; else { camS.tx = X(followA.x); camS.tz = Z(followA.y); } }
  if (thirdPerson && followA) {
    // за плечом: камера разворачивается вслед за человеком
    let want = followA.dir + Math.PI, d = want - camS.yaw; d -= Math.round(d / TAU) * TAU; camS.yaw += d * Math.min(1, dt * 3);
    camS.dist = clamp(camS.dist, 14, 40); camS.pitch = clamp(camS.pitch, .08, .35);
  }
  camS.tx = clamp(camS.tx, -W / 2 - 100, W / 2 + 100); camS.tz = clamp(camS.tz, -H / 2 - 100, H / 2 + 100);
  const k = Math.min(1, dt * 7);
  for (const key in camS) camC[key] += (camS[key] - camC[key]) * k;
  const cp = Math.cos(camC.pitch), sx = shake > 0 ? rnd(-shake, shake) : 0, sy = shake > 0 ? rnd(-shake, shake) : 0;
  camera.position.set(camC.tx + camC.dist * cp * Math.cos(camC.yaw) + sx, camC.dist * Math.sin(camC.pitch) + sy, camC.tz + camC.dist * cp * Math.sin(camC.yaw));
  const gT = Math.max(WATER_Y, gY(camC.tx + W / 2, camC.tz + H / 2)), lookY = (followA ? (thirdPerson ? 6 : 4) : 0) + gT;
  camera.position.y += gT;
  if (followA) {
    // при слежении камера придвигается к человеку, если между ними стена, а не перепрыгивает через дом
    const t = cameraClearT(camC.tx, lookY, camC.tz, camera.position.x, camera.position.y, camera.position.z);
    if (t < 1) camera.position.set(camC.tx + (camera.position.x - camC.tx) * t, lookY + (camera.position.y - lookY) * t, camC.tz + (camera.position.z - camC.tz) * t);
  } else {
    // свободная камера не проваливается в дома
    const cx = camera.position.x + W / 2, cz = camera.position.z + H / 2;
    for (const b of buildings) if (cx > b.x0 - 6 && cx < b.x1 + 6 && cz > b.y0 - 6 && cz < b.y1 + 6 && camera.position.y < b.h + 8) camera.position.y = b.h + 8;
    // и не смотрит сквозь стену: если между точкой взгляда и камерой дом, камера придвигается
    if (camC.dist < 420 && cellAt(camC.tx + W / 2, camC.tz + H / 2) !== 3) { const t = cameraClearT(camC.tx, lookY + 3, camC.tz, camera.position.x, camera.position.y, camera.position.z); if (t < 1 && t > .72) camera.position.set(camC.tx + (camera.position.x - camC.tx) * t, lookY + 3 + (camera.position.y - lookY - 3) * t, camC.tz + (camera.position.z - camC.tz) * t); }
  }
  camera.position.y = Math.max(camera.position.y, gY(camera.position.x + W / 2, camera.position.z + H / 2) + (followA ? 2 : 3));
  camera.lookAt(camC.tx, lookY, camC.tz);
  shake = Math.max(0, shake - dt * 14);
  scene.fog.near = camC.dist * .5 + 200; scene.fog.far = camC.dist * 3.4 + 2400; // воздушная перспектива: даль бледнеет
}
// доля отрезка от точки взгляда к камере, свободная от зданий (1 — вся); шаг 1.5 м, камера останавливается чуть ближе стены
function cameraClearT(ax, ay, az, bx, by, bz) {
  const len = Math.hypot(bx - ax, by - ay, bz - az); if (len < 1) return 1;
  const n = Math.min(80, Math.ceil(len / 1.5)), ox = W / 2, oz = H / 2;
  let hit = -1;
  for (let i = 1; i <= n && hit < 0; i++) {
    const t = i / n, x = ax + (bx - ax) * t + ox, y = ay + (by - ay) * t, z = az + (bz - az) * t + oz;
    for (const b of buildings) if (!b.hid && !b.topple && y < b.h + 1 && x > b.x0 - 1 && x < b.x1 + 1 && z > b.y0 - 1 && z < b.y1 + 1) { hit = i; break; }
  }
  if (hit < 0) return 1;
  return Math.max(.12, (hit - 1.5) / n);
}
const keys = {};
function panKeys(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (f || r) { followA = null; cine = false; const s = camS.dist * dt * .9, fx = -Math.cos(camS.yaw), fz = -Math.sin(camS.yaw); camS.tx += (fx * f - fz * r) * s; camS.tz += (fz * f + fx * r) * s; }
  if (keys.KeyR) camS.pitch = clamp(camS.pitch + dt * .8, .06, 1.5);
  if (keys.KeyF) camS.pitch = clamp(camS.pitch - dt * .8, .06, 1.5);
  if (keys.PageUp || keys.NumpadAdd) camS.dist = clamp(camS.dist * (1 - dt * 1.5), 14, 3000);
  if (keys.PageDown || keys.NumpadSubtract) camS.dist = clamp(camS.dist * (1 + dt * 1.5), 14, 3000);
  if (keys.KeyQ) camS.yaw -= dt * 1.4;
  if (keys.KeyE) camS.yaw += dt * 1.4;
}
function panBy(dx, dy) {
  followA = null;
  const s = camS.dist / cv.clientHeight * 1.1, fx = -Math.cos(camS.yaw), fz = -Math.sin(camS.yaw);
  camS.tx += (-fz * -dx + fx * dy) * s; camS.tz += (fx * -dx + fz * dy) * s;
}

/* ---------- выбор точки на земле и людей ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function groundAt(e, h = 0) {
  const r = cv.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera); plane.constant = -h;
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  // на холмах земля выше плоскости: уточняем точку пару раз
  for (let k = 0; k < 3; k++) { const th = Math.max(WATER_Y, gY(clamp(hit.x + W / 2, 0, W - 1), clamp(hit.z + H / 2, 0, H - 1))); plane.constant = -(h + th); if (!ray.ray.intersectPlane(plane, hit)) break; }
  return [hit.x + W / 2, hit.z + H / 2];
}
function agentAt(e, pred = () => true, r = 9) {
  let best = null, bd = r;
  for (const h of [3.5, .5]) {
    const p = groundAt(e, h); if (!p) continue;
    for (const a of agents) { if (a.state === "saved" || !pred(a)) continue; const d = Math.hypot(a.x - p[0], a.y - p[1]) * (a.state === "dead" ? 1.3 : 1); if (d < bd) { bd = d; best = a; } }
  }
  return best;
}

/* ---------- инструменты ---------- */
const TOOLS = [
  { k: "watch", n: "Наблюдать", c: "#f2b33d", tip: "<b>Наблюдать:</b> клик по человеку — камера следует за ним, Esc — отпустить. Перетаскивание двигает карту." },
  { k: "infect", n: "Заразить", c: "#e8c447", tip: "<b>Заразить:</b> клик по человеку — укус. Через время инкубации он упадёт в судорогах и встанет зомби." },
  { k: "zombie", n: "Зомби", c: "#7fcf5a", tip: "<b>Зомби:</b> клик ставит зомби." },
  { k: "barricade", n: "Баррикада", c: "#b58a55", tip: "<b>Баррикада:</b> веди по улице. Зомби упираются и ломают её, если их много." },
  { k: "erase", n: "Снести", c: "#888", tip: "<b>Снести:</b> веди по баррикаде, чтобы убрать." },
  { k: "police", n: "Полиция", c: "#4f7fe0", tip: "<b>Полиция:</b> патрульная машина и 3 офицера с пистолетами (15 + 30 патронов). Не стреляют, если на линии огня люди." },
  { k: "army", n: "Военные", c: "#9aa36a", tip: "<b>Военные:</b> отряд из 6 солдат с автоматами. Идут на зомби, стреляют очередями, перезаряжаются. Выстрелы привлекают зомби." },
  { k: "medic", n: "Медики", c: "#f0f0f0", tip: "<b>Медики:</b> находят укушенных и лечат, если инфекция не зашла далеко." },
  { k: "firefighters", n: "Пожарные", c: "#d23a2a", tip: "<b>Пожарные:</b> клик — машина выезжает из пожарной части к ближайшему пожару, тушит дома, машины и горящих людей. Топорами отбиваются от зомби." },
  { k: "repair", n: "Ремонтники", c: "#f08a1c", tip: "<b>Ремонтники:</b> клик — бригада разбирает завалы, убирает разбитые машины и ставит упавшие фонари. При зомби бросают работу и уходят." },
  { k: "quarantine", n: "Карантин", c: "#9d998f", tip: "<b>Карантин:</b> протяни прямоугольник по карте. Военные оцепят зону постами, приедут строители и секция за секцией поставят сетчатый забор с колючкой. Пока забор не замкнут, зона открыта." },
  { k: "lab", n: "Учёные", c: "#7fd0e0", tip: "<b>Учёные:</b> клик — ещё трое учёных в лаборатории больницы, вакцина появится быстрее. Прогресс — в сводке." },
  { k: "vaccinate", n: "Вакцинация", c: "#5fe0a0", tip: "<b>Пункт вакцинации:</b> после готовности вакцины. Медики прививают подходящих людей, привитые не заражаются от укусов." },
  { k: "evac", n: "Эвакуация", c: "#c9a5f0", tip: "<b>Эвакуация:</b> точка посадки вертолёта. Забирает до 40 человек, взлетает через минуту или если зомби подошли." },
  { k: "depot", n: "Склад", c: "#f2b33d", tip: "<b>Склад боеприпасов:</b> 600 патронов. Полиция, военные и вооружённые горожане приходят пополнить запас, когда он кончается. Мародёры его грабят." },
  { k: "tank", n: "Танк", c: "#6b7a3a", tip: "<b>Танк:</b> едет к зомби по улицам, давит машины и баррикады, бьёт из пушки по скоплениям и стреляет из пулемёта. Снаряды рушат дома." },
  { k: "nuke", n: "Ядерный удар", c: "#ffd23a", tip: "<b>Ядерный удар:</b> клик — через 10 секунд по городу бьёт ракета. Всё в радиусе 110 м испаряется, ударная волна рушит дома до 190 м, дальше ожоги, пожары и заражённая зона. Нажми ещё раз, чтобы выбрать цель заново во время отсчёта нельзя." },
  { k: "strike", n: "Авиаудар", c: "#e0603a", tip: "<b>Авиаудар:</b> штурмовик сбрасывает бомбу через 3 с. Сжигает всех в радиусе 17 м, поджигает дома и машины." },
  { k: "boom", n: "Взрыв", c: "#ff8a3a", tip: "<b>Взрыв:</b> клик — взрыв в этой точке. Машины взлетают, люди разлетаются, дома получают повреждения." },
  { k: "meteor", n: "Метеорит", c: "#c0502a", tip: "<b>Метеорит:</b> через пару секунд с неба падает камень. Огромный взрыв, кратер, рушатся дома в радиусе 40 м." },
  { k: "fire", n: "Пожар", c: "#ff5a2a", tip: "<b>Пожар:</b> клик — очаг огня. Загораются дома и машины рядом, огонь перекидывается дальше." },
  { k: "horde", n: "Орда", c: "#4fa52a", tip: "<b>Орда:</b> клик ставит сразу 25 зомби." },
  { k: "squad", n: "Отряд", c: "#4fe0ff", tip: "<b>Отряд:</b> протяни рамку по солдатам и полицейским, затем кликни по земле — они займут позицию и будут держать её. Esc — отпустить." },
  { k: "wall", n: "Стена", c: "#9d998f", tip: "<b>Бетонная стена:</b> веди по земле, линия в одну плиту. В восемь раз прочнее баррикады, но Титан ломает и её." },
  { k: "tower", n: "Вышка", c: "#b58a55", tip: "<b>Вышка:</b> клик на свободном месте — сторожевая вышка со стрелком. Зомби до него не достают, бьёт на 80 м дальше обычного." },
  { k: "flood", n: "Прожектор", c: "#fff1c0", tip: "<b>Прожектор:</b> ночью в радиусе 24 м видно как днём, стрелки попадают точнее. Но свет манит зомби. Работает и при аварии на подстанции." },
  { k: "camp", n: "Лагерь", c: "#f2b33d", tip: "<b>Лагерь выживших:</b> квадрат стен с воротами, палатки, прожектор, склад и четверо солдат. Жители рядом идут внутрь. Следи за едой: кончится — вылазки и бунт." },
  { k: "supply", n: "Припасы", c: "#c9a5f0", tip: "<b>Сброс припасов:</b> самолёт сбрасывает контейнер с едой. Укрытия и лагеря в радиусе 40 м получают запас." },
  { k: "mine", n: "Мина", c: "#5a5a5a", tip: "<b>Мина:</b> клик ставит мину, встаёт на боевой взвод через 2 с. Срабатывает на любого, кто наступит: и на зомби, и на человека." },
  { k: "wire", n: "Растяжка", c: "#8a8a7a", tip: "<b>Растяжка:</b> протяни линию между двумя точками. Первый, кто её заденет, подорвёт гранату." },
  { k: "barrels", n: "Бочки", c: "#a83020", tip: "<b>Бочки с бензином:</b> три бочки. Взрываются от огня, взрыва, горящей машины или горящего зомби и поджигают соседние. Ставь у баррикады и жди орду." },
  { k: "gen", n: "Генератор", c: "#e8b81a", tip: "<b>Генератор:</b> топлива на 5 минут. Подаёт ток на электрозабор в радиусе 120 м. Снабжение (сброс припасов) дозаправляет." },
  { k: "efence", n: "Электрозабор", c: "#4fe0ff", tip: "<b>Электрозабор:</b> веди по земле. Пока рядом работает генератор, зомби у забора бьёт током и отбрасывает; забор ломается в пять раз медленнее." },
  { k: "cp", n: "КПП", c: "#4f7fe0", tip: "<b>КПП:</b> клик рядом с улицей — полиция перегораживает её и проверяет проходящих на укусы. Укушенных отправляют в изолятор-палатку. Если очередь больше десяти человек и стоит долго, толпа снесёт барьер." },
  { k: "gather", n: "Сбор", c: "#f2b33d", tip: "<b>Оповещение «Всем собраться здесь»:</b> горожане в радиусе 260 м идут в точку. Удобно перед эвакуацией или лагерем. Нужна радиовышка." },
  { k: "danger", n: "Опасность", c: "#e0603a", tip: "<b>Слух «Здесь опасно»:</b> две минуты горожане обходят зону радиусом 160 м стороной и паникуют. Нужна радиовышка." },
  { k: "home", n: "По домам", c: "#9d998f", tip: "<b>Радио «Оставайтесь дома»:</b> все горожане идут домой и запираются. Нужна радиовышка." },
];
let tool = "watch";
function renderTools() {
  if (editMode) {
    $("tools").innerHTML = ED_TOOLS.map(t => `<button data-k="${t.k}" aria-pressed="${t.k === tool}"><i style="background:${t.c}"></i>${t.n}</button>`).join("") + `<span class="edfl">Этажей: <button data-fl="-1" aria-label="Меньше этажей">−</button><b>${edFloors}</b><button data-fl="1" aria-label="Больше этажей">+</button></span>`;
    const t = ED_TOOLS.find(t => t.k === tool) || ED_TOOLS[0]; $("tip").innerHTML = t.tip + " Симуляция на паузе, пока открыт редактор."; return;
  }
  const GROUPS = [["Наблюдение", ["watch", "squad"]], ["Заражение", ["infect", "zombie", "horde"]], ["Оборона", ["barricade", "wall", "erase", "quarantine", "police", "army", "tank", "depot"]], ["Стройка", ["tower", "flood", "camp", "supply"]], ["Ловушки", ["mine", "wire", "barrels", "gen", "efence"]], ["Штаб", ["cp", "gather", "danger", "home"]], ["Службы", ["medic", "firefighters", "repair", "lab", "vaccinate", "evac"]], ["Удары", ["strike", "nuke"]], ["Стихии", ["boom", "meteor", "fire"]]];
  const btn = (t, i) => { const left = typeof limitLeft === "function" ? limitLeft(t.k) : Infinity; return `<button data-k="${t.k}" aria-pressed="${t.k === tool}" title="${t.n}"${left <= 0 ? " disabled" : ""}><i style="background:${t.c}"></i><kbd>${i === 10 ? "-" : i < 10 ? (i + 1) % 10 : ""}</kbd>${t.n}${left < Infinity ? ` <em>×${Math.max(0, left)}</em>` : ""}</button>`; };
  GROUPS.forEach(([name, keys], gi) => { if (keys.includes(tool)) openGroups.add(gi); });
  $("tools").innerHTML = GROUPS.map(([name, keys], gi) => `<div class="tgroup${openGroups.has(gi) ? " open" : ""}"><button class="gh" data-g="${gi}">${name}<em>${keys.length}</em></button><div class="gb">${keys.map(k => { const i = TOOLS.findIndex(t => t.k === k); return i >= 0 ? btn(TOOLS[i], i) : ""; }).join("")}</div></div>`).join("");
  $("tip").innerHTML = TOOLS.find(t => t.k === tool).tip;
}
const openGroups = new Set([0, 2]);
$("tools").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.g !== undefined) { const g = +b.dataset.g; if (openGroups.has(g)) openGroups.delete(g); else openGroups.add(g); renderTools(); return; } if (b.dataset.fl) { edFloors = clamp(edFloors + +b.dataset.fl, 2, 25); renderTools(); return; } tool = b.dataset.k; renderTools(); });
let barrPrev = null;
function paintBarricade(x, y, erase, wall) {
  if (erase) {
    for (let gy = Math.floor((y - 5) / CS); gy <= Math.floor((y + 5) / CS); gy++) for (let gx = Math.floor((x - 5) / CS); gx <= Math.floor((x + 5) / CS); gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const i = gy * GW + gx; if (grid[i] === 6) { grid[i] = 0; wallMask[i] = 0; elecMask[i] = 0; quarMask[i] = 0; barrDirty = true; gridDirtyMini = true; }
    }
    fieldT = 0; return;
  }
  // тонкая линия: одна клетка под курсором; на диагонали добавляем угловую, чтобы не было щелей
  const gx = Math.floor(x / CS), gy = Math.floor(y / CS), cells = [[gx, gy]];
  if (barrPrev && barrPrev[0] !== gx && barrPrev[1] !== gy) cells.push([barrPrev[0], gy]);
  barrPrev = [gx, gy];
  for (const [cx, cy] of cells) {
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
    const i = cy * GW + cx, c = grid[i];
    if (c === 0 || c === 1 || c === 2 || c === 7) { grid[i] = 6; bhp[i] = wall === 1 ? 300 : wall === 2 ? 60 : 35; wallMask[i] = wall === 1 ? 1 : 0; elecMask[i] = wall === 2 ? 1 : 0; barrDirty = true; gridDirtyMini = true; }
  }
  fieldT = 0;
}
const BARR_KIND = { barricade: 0, wall: 1, efence: 2 };
function useTool(e, x, y) {
  if (["army", "tank", "strike", "evac", "nuke", "police", "supply"].includes(tool)) { if (limitLeft(tool) <= 0) { warn("<b>Лимит исчерпан</b> в этом сценарии."); return; } if (tool === "evac" && blocked(x, y)) { warn("<b>Здесь вертолёту не сесть.</b>"); return; } spendLimit(tool); setTimeout(renderTools, 0); }
  if (tool === "watch") { const a = agentAt(e); if (a) { followA = a; camS.dist = Math.min(camS.dist, 160); camS.pitch = Math.min(camS.pitch, .55); } return; }
  if (tool === "infect") { const a = agentAt(e, a => a.state === "alive" && a.role !== "zombie" && !a.bitten); if (a) { a.bitten = true; a.incT = settings.inc * rnd(.7, 1.3); bites++; logE("Заражён ещё один человек", "bad"); } return; }
  if (tool === "zombie") { if (!blocked(x, y)) { const a = newAgent("zombie", x, y); turn(a); a.riseT = 0; } return; }
  if (tool === "police") { spawnService("police", x, y, special.police); logE(special.police && special.police.b && special.police.b.state === "ok" ? "Патруль выехал из участка" : "Патруль выехал с окраины", "good"); sfx.siren(); return; }
  if (tool === "army") {
    // ближайший свободный отряд идёт к точке; если такого нет — колонна выезжает с окраины
    let best = null, bd = 320;
    for (const s of squads.values()) { if (s.state !== "hold") continue; const L = agentById(s.leader); if (!L || L.state !== "alive") continue; const d = Math.hypot(L.x - x, L.y - y); if (d < bd) { bd = d; best = s; } }
    if (best) { best.holdAt = { x, y }; best.holdT = 150; logE("Ближайший отряд направлен к точке", "good"); }
    else { spawnService("army", x, y, null); logE("Отряд военных выехал с окраины", "good"); }
    sfx.radio(); return;
  }
  if (tool === "medic") { for (let i = 0; i < 3; i++) { const [ax, ay] = freeNear(x, y, 14); newAgent("medic", ax, ay); } logE("Прибыли медики", "good"); return; }
  if (tool === "evac") {
    if (blocked(x, y)) return;
    const a = rnd(0, TAU);
    evac = { x, y, hx: x - Math.cos(a) * 900, hy: y - Math.sin(a) * 900, alt: 110, yaw: a, landed: false, leaving: false, t: 60, cap: 40, capMax: 40 };
    fieldT = 0; logE("Вертолёт эвакуации в пути"); return;
  }
  if (tool === "nuke") { if (!launchNuke(x, y)) { warn("<b>Удар уже в пути.</b>"); uses.nuke = Math.max(0, (uses.nuke || 1) - 1); } return; }
  if (tool === "strike") { strikes.push({ x, y, t: 3 }); logE("Штурмовик заходит на цель", "bad"); }
  if (tool === "firefighters" || tool === "repair") {
    const type = tool === "repair" ? "repair" : "fire", t = serviceTarget(type);
    const c = spawnService(type, t ? t.x : x, t ? t.y : y, type === "fire" ? special.fire : null); c.job = t ? t.job : null;
    if (!t) { c.goal = { x, y }; }
    logE(type === "fire" ? "Вызваны пожарные" : "Вызваны ремонтники", "good"); return;
  }
  if (tool === "lab") { scientists += 3; logE(`В лабораторию прибыли учёные, всего ${scientists}`, "good"); return; }
  if (tool === "vaccinate") { if (!vaccineReady) { warn(`<b>Вакцина ещё не готова:</b> ${Math.floor(research * 100)}%. Ускорь её учёными.`); return; } addTent(x, y); return; }
  if (tool === "tank") { const [ex, ey] = edgePointNear(x, y); const t = addTank(ex, ey); t.goal = { x, y }; logE("Танк входит в город с окраины", "good"); sfx.radio(); }
  if (tool === "depot") { if (blocked(x, y)) { warn("<b>Здесь нельзя:</b> выбери свободное место на улице или площади."); return; } addDepot(x, y); sfx.radio(); }
  if (tool === "boom") { boom(x, y, 48, false); logT("boom", "Взрыв", "bad", 5); }
  if (tool === "meteor") callMeteor(x, y);
  if (tool === "fire") startFire(x, y);
  if (tool === "horde") spawnHorde(x, y);
  if (tool === "tower") { if (!addTower(x, y)) warn("<b>Здесь не поставить:</b> нужна свободная площадка 4 × 4 м."); }
  if (tool === "flood") addFlood(x, y);
  if (tool === "camp") { if (!addCamp(x, y)) warn("<b>Слишком близко к краю карты.</b>"); }
  if (tool === "supply") callDrop(x, y);
  if (tool === "mine") { if (!addMine(x, y)) warn("<b>Здесь нельзя:</b> выбери свободное место."); }
  if (tool === "barrels") { if (blocked(x, y)) { warn("<b>Здесь нельзя:</b> выбери свободное место."); return; } addBarrels(x, y); }
  if (tool === "gen") { if (blocked(x, y)) { warn("<b>Здесь нельзя:</b> выбери свободное место."); return; } addGen(x, y); sfx.radio(); }
  if (tool === "cp") { if (!addCheckpoint(x, y)) warn("<b>КПП:</b> кликни ближе к улице (не у края карты)."); }
  if (tool === "gather") broadcastGather(x, y);
  if (tool === "danger") broadcastDanger(x, y);
  if (tool === "home") broadcastHome();
  if (tool === "squad") { if (!orderMove(x, y)) { if (selectNear(x, y)) $("tip").innerHTML = `<b>Выбран боец.</b> Кликни по земле — займёт позицию. Протяни рамку, чтобы выбрать нескольких.`; } }
}

/* ---------- ввод ---------- */
const ptrs = new Map();
let drag = null, lastG = null, pinch = null;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("wheel", e => {
  e.preventDefault();
  const before = groundAt(e), nd = clamp(camS.dist * (e.deltaY < 0 ? .85 : 1.17), 14, 3000), k = nd / camS.dist;
  camS.dist = nd;
  // приближаем к точке под курсором, а не к центру
  if (before && !followA && !cine) { const px = before[0] - W / 2, pz = before[1] - H / 2; camS.tx = px + (camS.tx - px) * k; camS.tz = pz + (camS.tz - pz) * k; }
}, { passive: false });
cv.addEventListener("pointerdown", e => {
  audio(); if (fps.on) return; cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; return; }
  const mode = e.button === 2 ? "rotate" : e.button === 1 || e.shiftKey ? "pan" : "tool";
  drag = { mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  if (mode === "tool") {
    const g = groundAt(e); lastG = g;
    if (!g) return;
    if (editMode) { if (tool === "ed_apt" || tool === "ed_tower" || tool === "ed_park") { qStart = g; qEnd = g; edDrag = tool; } else edPoint(tool, g); return; }
    if (tool === "barricade" || tool === "erase" || tool === "wall" || tool === "efence") { barrPrev = null; paintBarricade(g[0], g[1], tool === "erase", BARR_KIND[tool]); if (tool === "barricade") first("barr", "Поставлена первая баррикада", "good"); }
    else if (tool === "wire") { wireStart = g; selEnd = g; }
    else if (tool === "quarantine") { qStart = g; qEnd = g; }
    else if (tool === "squad") { selStart = g; selEnd = g; }
    else if (tool !== "watch") useTool(e, g[0], g[1]);
  }
});
cv.addEventListener("pointermove", e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    camS.dist = clamp(camS.dist * pinch.d / Math.max(20, d), 35, 3000); panBy(mx - pinch.mx, my - pinch.my);
    pinch = { d, mx, my }; return;
  }
  ghostPos = groundAt(e);
  if (fps.on) return;
  if (!drag) { hoverInfo(e); return; }
  const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
  if (drag.mode === "rotate") { camS.yaw += dx * .006; camS.pitch = clamp(camS.pitch + dy * .004, .1, 1.5); return; }
  if (drag.mode === "pan" || (drag.mode === "tool" && tool === "watch")) { panBy(dx, dy); return; }
  if ((tool === "quarantine" || edDrag) && qStart) { const g = groundAt(e); if (g) qEnd = g; return; }
  if (tool === "squad" && selStart) { const g = groundAt(e); if (g) selEnd = g; return; }
  if (tool === "wire" && wireStart) { const g = groundAt(e); if (g) selEnd = g; return; }
  if (editMode && (tool === "ed_road" || tool === "ed_tree")) { const g = groundAt(e); if (!g || !lastG) return; const n = Math.ceil(Math.hypot(g[0] - lastG[0], g[1] - lastG[1]) / 4); for (let i = 1; i <= n; i++) edPoint(tool, [lastG[0] + (g[0] - lastG[0]) * i / n, lastG[1] + (g[1] - lastG[1]) * i / n]); lastG = g; return; }
  if (tool === "barricade" || tool === "erase" || tool === "wall" || tool === "efence") {
    const g = groundAt(e); if (!g || !lastG) return;
    const n = Math.ceil(Math.hypot(g[0] - lastG[0], g[1] - lastG[1]) / 3);
    for (let i = 1; i <= n; i++) paintBarricade(lastG[0] + (g[0] - lastG[0]) * i / n, lastG[1] + (g[1] - lastG[1]) * i / n, tool === "erase", BARR_KIND[tool]);
    lastG = g;
  }
});
let qStart = null, qEnd = null;
const endPtr = e => {
  ptrs.delete(e.pointerId);
  if (edDrag && qStart && qEnd) { edApply(edDrag, qStart, qEnd); edDrag = null; qStart = qEnd = null; }
  if (editMode && edDirty) { edDirty = false; edRebuild(); }
  if (qStart && qEnd) { if (!planQuarantine(qStart[0], qStart[1], qEnd[0], qEnd[1])) warn("<b>Карантин:</b> зона слишком маленькая, протяни прямоугольник побольше."); qStart = qEnd = null; }
  if (tool === "squad" && selStart && selEnd) {
    if (drag && drag.moved && Math.hypot(selEnd[0] - selStart[0], selEnd[1] - selStart[1]) > 6) { const n = selectBox(selStart[0], selStart[1], selEnd[0], selEnd[1]); $("tip").innerHTML = n ? `<b>Выбрано бойцов: ${n}.</b> Кликни по земле — займут позицию.` : "<b>В рамке нет бойцов.</b> Нужны солдаты или полицейские."; }
    else useTool(e, selStart[0], selStart[1]);
    selStart = selEnd = null;
  }
  if (tool === "wire" && wireStart && selEnd) { if (!addWire(wireStart[0], wireStart[1], selEnd[0], selEnd[1])) warn("<b>Растяжка:</b> протяни линию длиннее 6 м."); wireStart = null; selEnd = null; }
  if (drag && drag.mode === "tool" && tool === "watch" && !drag.moved) useTool(e);
  if (ptrs.size < 2) pinch = null;
  drag = null;
};
cv.addEventListener("pointerup", endPtr); cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("pointerleave", () => { $("hover").hidden = true; hoverA = null; });
window.addEventListener("keydown", e => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable || fps.on) return;
  keys[e.code] = true;
  if (editMode && e.key !== "Escape" && e.key !== " ") return;
  const n = e.key === "0" ? 9 : e.key === "-" ? 10 : +e.key - 1;
  if (n >= 0 && n < TOOLS.length && /^[0-9-]$/.test(e.key)) { tool = TOOLS[n].k; renderTools(); }
  if (e.key === " ") { togglePause(); e.preventDefault(); }
  if (e.key === "Escape") { wireStart = null; followA = null; thirdPerson = false; cine = false; clearHighlight(); $("help").hidden = true; syncCamButtons(); clearOrders(); }
  if (e.code === "KeyG" && patientZero) followPatientZero();
  if (e.code === "KeyN") toggleNight();
  if (e.code === "KeyC") $("camCine").click();
  if (e.code === "KeyT") $("camThird").click();
  if (e.code === "KeyV") $("camStreet").click();
  if (e.code === "Home") $("camOver").click();
  if (e.key === "?") $("camHelp").click();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

/* ---------- подсказка при наведении ---------- */
const ROLE = { bandit: "Мародёр", civ: "Горожанин", police: "Полицейский", army: "Солдат", medic: "Медик", zombie: "Зомби", fire: "Пожарный", worker: "Ремонтник" };
function hoverInfo(e) {
  const a = agentAt(e, () => true, 7), box = $("hover");
  hoverA = a;
  if (!a) { box.hidden = true; return; }
  let title = ROLE[a.role], lines = [];
  if (a.name && a.role !== "zombie" && a.state !== "dead") { title = `${a.name}, ${a.years}`; lines.push(ROLE[a.role] + (a.hero ? `, ${HERO_KINDS[a.hero].n}` : "")); }
  else if (a.name) lines.push(a.name);
  if (a.fam && a.state === "alive" && a.role !== "zombie") { const f = famMap[a.fam]; if (f && f.members.length > 1) { const alive = f.members.map(agentById).filter(m => m && m.state === "alive" && m.role !== "zombie").length; lines.push(`Семья ${famLabel(f)}: ${alive} из ${f.members.length} живы${a.homeGoal ? ", идёт домой" : a.hidden && a.homeTrip ? ", дома" : ""}`); } }
  if (a.state === "dead") {
    title = a.role === "zombie" && !a.reanimate ? "Уничтоженный зомби" : "Тело";
    if (a.burnt) lines.push("Обгорело");
    else if (a.reanimate) { const t = a.wakeAt - a.deadT; lines.push(t < 2.5 ? "Судороги, сейчас встанет" : `Встанет через ${Math.ceil(t)} с`); }
  } else if (a.role === "zombie") {
    if (a.onFire > 0) lines.push("Горит, но идёт дальше");
    title = { walker: "Зомби", runner: "Зомби-бегун", brute: "Громила", screamer: "Крикун", crawler: "Ползун", spitter: "Плеватель", titan: "Титан" }[a.ztype] || "Зомби";
    lines.push({ walker: "Бредёт, не устаёт", runner: "Быстрый, но хрупкий", brute: "Огромный, ломает баррикады, выдерживает много пуль", screamer: "Увидев людей, кричит и созывает толпу", crawler: "Ползёт без ног, в него трудно попасть", spitter: "Плюётся кислотой издалека, кислота заражает", titan: "Мутант-гигант: расшвыривает машины, сносит баррикады, пули почти не берут. Нужен танк или бомба" }[a.ztype] || "");
    lines.push(a.riseT > 0 ? "Поднимается" : a.feedT > 0 ? "Пожирает жертву" : a.bash > 0 ? "Ломает баррикаду" : "Ищет добычу");
    lines.push(`Выдержит попаданий: ${Math.max(1, a.zhp | 0)}, выстрел в голову — сразу`);
  } else {
    if (a.zero) lines.push("Нулевой пациент");
    if (a.immune) lines.push("Привит: укус не заразит");
    if (a.role === "bandit") lines.push(a.hostile > 0 ? "Стреляет по силовикам" : "Грабит магазины");
    if (a.age === "kid") lines.push("Ребёнок: бегает медленнее"); if (a.age === "old") lines.push("Пожилой: ходит медленно");
    if (a.bitten) lines.push(`Укушен, обратится через ${Math.max(0, Math.ceil(a.incT))} с`);
    if (a.grabT > 0) lines.push("Схвачен зомби");
    else if (a.panic > .5) lines.push("В панике");
    lines.push(`Здоровье ${Math.round(a.hp)}%`);
    if (a.onFire > 0) lines.push("Горит!");
    if (a.rad > .05) lines.push(`Лучевая болезнь, доза ${a.rad > .6 ? "смертельная" : a.rad > .3 ? "тяжёлая" : "лёгкая"}`);
    if (a.burn > .03) lines.push(`Ожоги ${a.burn < .2 ? "1" : a.burn < .45 ? "2" : a.burn < .7 ? "3" : "4"}-й степени, ${Math.round(a.burn * 100)}% тела${a.burn > .45 ? " — ожоговый шок" : ""}`);
    if (a.armed) lines.push(a.reload > 0 ? "Перезаряжается" : `${a.role === "army" ? "Автомат" : "Пистолет"}: ${a.mag} в магазине, ${a.ammo} в запасе`);
    if (a.stam !== undefined && a.stam < .3) lines.push("Выдохся, бежит медленно");
    if (a.kills) lines.push(`Уничтожил зомби: ${a.kills}`);
    if (a.dest && a.panic < .3) lines.push(a.work >= 0 && buildings[a.work] && buildings[a.work].door && a.dest[0] === buildings[a.work].door[0] ? "Идёт на работу" : "Идёт домой");
  }
  box.innerHTML = `<b>${title}</b>${lines.join("<br>")}`;
  const r = $("stage").getBoundingClientRect();
  box.style.left = (e.clientX - r.left) + "px"; box.style.top = (e.clientY - r.top) + "px"; box.hidden = false;
}

/* ---------- сводка и график ---------- */
const COL = { healthy: "#5fb3e8", infected: "#e8c447", zombie: "#7fcf5a", dead: "#9a3b3b", saved: "#c9a5f0" };
const chart = $("chart"), cctx = chart.getContext("2d");
function drawChart() {
  const Wd = chart.width, Hd = chart.height; cctx.clearRect(0, 0, Wd, Hd);
  cctx.fillStyle = "#121617"; cctx.fillRect(0, 0, Wd, Hd);
  if (stats.length < 2) return;
  const n = stats.length, total = Math.max(...stats.map(s => s.H + s.I + s.Z + s.D + s.S), 1);
  let base = new Array(n).fill(0);
  for (const [k, col] of [["S", COL.saved], ["D", COL.dead], ["Z", COL.zombie], ["I", COL.infected], ["H", COL.healthy]]) {
    cctx.fillStyle = col; cctx.globalAlpha = .85; cctx.beginPath();
    for (let i = 0; i < n; i++) cctx.lineTo(i / (n - 1) * Wd, Hd - Math.min(1, (base[i] + stats[i][k]) / total) * Hd);
    for (let i = n - 1; i >= 0; i--) cctx.lineTo(i / (n - 1) * Wd, Hd - Math.min(1, base[i] / total) * Hd);
    cctx.closePath(); cctx.fill(); base = base.map((b, i) => b + stats[i][k]);
  }
  cctx.globalAlpha = 1; cctx.fillStyle = "rgba(255,255,255,.7)"; cctx.font = "18px IBM Plex Mono, monospace"; cctx.fillText(`${Math.floor(simT / 60)} мин`, Wd - 90, 24);
}
const mmss = t => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function updateUI() {
  const c = counts(); lastCounts = c; updateObjective();
  for (const [id, v] of [["nH", c.H], ["nI", c.I], ["nZ", c.Z], ["nD", c.D], ["nS", c.S], ["nF", c.F]]) $(id).textContent = v;
  $("vacBar").style.width = Math.floor(research * 100) + "%"; $("vacO").textContent = vaccineReady ? "готова" : Math.floor(research * 100) + "%";
  const hungry = hungryCount();
  $("clock").textContent = `${hourLabel()}${world.weather !== "clear" ? " · " + { rain: "дождь", fog: "туман", storm: "гроза" }[world.weather] : ""}${settings.dark ? " · нет света" : ""} · ${mmss(simT)} · укусов ${bites} · зомби уничтожено ${zkills}${cured ? " · вылечено " + cured : ""}${firsts.zombie ? " · штамм " + STRAIN_NAMES[strain.lvl - 1] : ""}${hungry ? " · голодают " + hungry : ""}${settings.noWater ? " · нет воды" : ""}${settings.noRadio ? " · нет связи" : ""}${dayN > 1 ? " · день " + dayN : ""}${(alert ? " · ЧС " + alert + " " + ALERT_N[alert] + (hq.known ? " · штабу известно " + hq.known : "") : "") + (typeof threatLabel === "function" ? threatLabel() : "")}${settings.curfew ? " · комендантский час" : ""} · ${perfStats.fps} к/с`;
  renderHeroes(); squadHud(); renderFactions(); updateCampaignUI();
  if (logDirty) { logDirty = false; $("log").innerHTML = events.slice(0, 40).map(e => `<li class="${e.cls || ""}"><time>${mmss(e.t)}</time>${e.text}</li>`).join(""); updateNews(); }
  drawChart();
}
function onBanner(t) { const b = $("banner"); b.textContent = t; b.hidden = false; clearTimeout(onBanner.t); onBanner.t = setTimeout(() => b.hidden = true, 6000); }

/* ---------- запуск ---------- */
let paused = false, speed = 1, patientZero = null;
function setPaused(v) { paused = !!v; $("pause").setAttribute("aria-pressed", paused); $("pause").textContent = paused ? "Продолжить" : "Пауза"; }
function togglePause() { setPaused(!paused); }
function followPatientZero() { followA = patientZero; camS.dist = 130; camS.pitch = .5; }
// список планировок — из таблицы LAYOUTS, скрытые не показываем
$("layout").innerHTML = '<option value="random">Случайная</option>' + Object.entries(LAYOUTS).filter(([k, v]) => !v.hidden).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("");
function newCity(scenarioKey = "sandbox") {
  const _g = genCity; genCity = () => _g($("layout").value); patientZero = newCitySim(+$("pop").value); genCity = _g;
  setupScenario(typeof scenarioKey === "string" ? scenarioKey : "sandbox", patientZero); renderTools();
  $("layoutName").textContent = LAYOUTS[layoutKey].n;
  clearDecals(); clearDebris(); grassAt = null; gridDirtyMini = true; clearHighlight(); interests = [];
  buildCity(); barrDirty = true; followA = null; hoverA = null; PS_ADD.list.length = 0; PS_SMOKE.list.length = 0;
  $("banner").hidden = true;
}
$("newCity").addEventListener("click", openWizard);
$("pause").addEventListener("click", togglePause);
$("speed").addEventListener("click", e => { speed = speed === 1 ? 2 : speed === 2 ? 4 : speed === 4 ? 8 : 1; e.currentTarget.textContent = "Скорость ×" + speed; });
$("mute").addEventListener("click", () => { audio(); setMuted(!muted); });
$("music").addEventListener("click", () => { audio(); setMusic(!musicOn); });
$("pop").addEventListener("input", e => $("popO").textContent = e.target.value);
$("inc").addEventListener("input", e => { settings.inc = +e.target.value; $("incO").textContent = e.target.value + " с"; });
$("arm").addEventListener("input", e => { settings.armed = +e.target.value / 100; $("armO").textContent = e.target.value + "%"; });
$("fast").addEventListener("change", e => { settings.fast = e.target.checked; });
function toggleNight() { world.cycle = false; $("cycle").checked = false; world.target = world.target >= 19.5 || world.target < 5 ? 13 : 23; syncDayButton(); }
function syncDayButton() { const nightNow = world.target >= 19.5 || world.target < 5; $("dayNight").setAttribute("aria-pressed", nightNow); $("dayNight").querySelector("span").textContent = nightNow ? "День" : "Ночь"; $("hour").value = world.target; $("hourO").textContent = hourLabel(); }
$("dayNight").addEventListener("click", toggleNight);
$("hour").addEventListener("input", e => { world.target = +e.target.value; world.cycle = false; $("cycle").checked = false; syncDayButton(); });
$("cycle").addEventListener("change", e => { world.cycle = e.target.checked; });
$("weather").addEventListener("change", e => { world.weather = e.target.value; });
$("services").addEventListener("change", e => { settings.services = e.target.checked; });
$("threats").addEventListener("change", e => { settings.threats = e.target.checked; });
$("marks").addEventListener("change", e => { showMarks = e.target.checked; });
$("shadows").addEventListener("change", e => { sun.castShadow = e.target.checked; });
const zeroBtn = document.createElement("button"); zeroBtn.className = "btn"; zeroBtn.textContent = "К нулевому пациенту"; zeroBtn.title = "Клавиша F";
zeroBtn.addEventListener("click", () => patientZero && followPatientZero());
$("newCity").before(zeroBtn);
function resize() {
  const r = $("stage").getBoundingClientRect(), pr = Math.min(1.5, window.devicePixelRatio || 1);
  R3.setPixelRatio(pr); R3.setSize(Math.max(300, r.width), Math.max(200, r.height), false);
  camera.aspect = Math.max(300, r.width) / Math.max(200, r.height); camera.updateProjectionMatrix();
  const sc = Math.max(200, r.height) * pr / (2 * Math.tan(camera.fov * Math.PI / 360));
  PS_ADD.mat.uniforms.scale.value = PS_SMOKE.mat.uniforms.scale.value = sc;
  resizePost();
}
window.addEventListener("resize", resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($("stage"));
let last = performance.now(), uiT = 0;
const frameErrs = new Set();
// следующий кадр запрашивается до работы: ошибка в одном месте не должна останавливать всю игру
function frame(now) {
  requestAnimationFrame(frame);
  try { frameBody(now); } catch (e) {
    const key = (e && e.message) || String(e);
    if (!frameErrs.has(key)) { frameErrs.add(key); console.error(e); logE("Внутренняя ошибка (игра продолжается): " + key, "bad"); }
  }
}
function frameBody(now) {
  // шаг кадра не бывает отрицательным: отметки времени кадров могут прийти не по порядку
  const dt = clamp((now - last) / 1000, 0, .05); last = Math.max(last, now);

  let simDt = 0;
  // симуляция идёт фиксированным шагом 30 раз в секунду; большие события — замедленно
  const slowK = slowMoT > 0 && prefs.slowmo !== false ? .28 : 1; slowMoT -= dt;
  const t0 = performance.now();
  if (!paused) simDt = runSim(dt * speed * slowK);
  const t1 = performance.now();
  const fxDt = paused ? 0 : Math.min(dt * speed * slowK, dt * 2);
  if (fps.on) { fpsCamera(dt); fpsStep(dt); } else { panKeys(dt); updateCamera(dt); }
  updateCity(fxDt); updateLandmarks(fxDt); updateConstruction(); updateMachines(); updateTents(); updateTrafficLights(dt); updateNuke(fxDt); updateNukeMark(); updateCars(); updateTanks(); updateRealPeople(dt); updateSun(); stepDebris(fxDt); updateBarricades(); updatePeople(dt); updateDecals(simDt); updateMarks();
  stepFires(fxDt); stepParticles(PS_ADD, fxDt); stepParticles(PS_SMOKE, fxDt); stepTracers(fxDt); stepShocks(fxDt);
  updateHeli(fxDt); updateJets(fxDt); updateLighting(dt, simDt); updateWater(dt); updateGhost(); drawMini(dt); updateThreatMarks(fxDt); updateLeafLOD(); if (world.cycle) { $("hourO").textContent = hourLabel(); } updateAudio(dt); updateExtras(fxDt); pollAchievements(dt); tickRec(dt); updateBuild(fxDt); updateSelBox(); updateWorld2(fxDt);
  updateEnv(dt); updatePuddles(); updateGrass(); autoQuality(dt); updateRoadSigns();
  const t2 = performance.now(); renderFrame(dt); const t3 = performance.now();
  perfStats.sim += t1 - t0; perfStats.scene += t2 - t1; perfStats.draw += t3 - t2; perfStats.n++; perfTick(dt);
  uiT -= dt; if (uiT <= 0) { uiT = .25; updateUI(); }
}
setupPost(); upgradeFacades(); loadRealTextures(); initRealPeople(); renderTools(); setMuted(muted); setMusic(musicOn); resize(); newCity(); applyPrefs(); openWizard();
$("loading").hidden = true;
requestAnimationFrame(frame);
