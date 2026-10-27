/* ---------- обучение при первом запуске ---------- */
const TUT = [
  { el: "stage", text: "Это город среди полей, ферм и озёр (обычная карта 900 × 600 метров, большая — 1300 × 900). Где-то в нём нулевой пациент — он ещё не знает, что заражён. Правая кнопка мыши вращает камеру, колесо приближает, WASD двигает." },
  { el: "tools", text: "Инструменты собраны по разделам: заражение, оборона, службы, удары. Наведи на кнопку — внизу появится подсказка. Клавиши 1–0 выбирают первые инструменты." },
  { el: "camCine", text: "Кнопки камеры: обзор города, вид с улицы, третье лицо и «Кино» — камера сама летит туда, где интереснее всего." },
  { el: "nH", text: "Сводка. Клик по плашке подсвечивает всех этого типа на карте и показывает одного; повторный клик — следующего." },
  { el: "playSelf", text: "«Играть самому» — вид от первого лица за выжившего или за зомби. «Новая игра» — сценарии и планировки города." },
];
let tutI = -1;
function showTut(i) {
  tutI = i; const box = $("tut"), step = TUT[i];
  if (!step) { box.hidden = true; document.querySelectorAll(".tut-hl").forEach(e => e.classList.remove("tut-hl")); try { localStorage.setItem("vspyshka-tut", "1"); } catch (e) {} return; }
  document.querySelectorAll(".tut-hl").forEach(e => e.classList.remove("tut-hl"));
  const target = $(step.el); const anchor = step.el === "nH" ? target.parentElement : target; anchor.classList.add("tut-hl");
  $("tutText").textContent = step.text; $("tutStep").textContent = `${i + 1} из ${TUT.length}`; $("tutNext").textContent = i === TUT.length - 1 ? "Начать" : "Дальше";
  box.hidden = false;
  const r = anchor.getBoundingClientRect(), bw = Math.min(340, innerWidth - 32);
  let x = r.left + r.width / 2 - bw / 2, y = r.bottom + 10;
  if (step.el === "stage") { x = r.left + r.width / 2 - bw / 2; y = r.top + r.height / 2 - 60; }
  if (y + 160 > innerHeight) y = Math.max(16, r.top - 170);
  box.style.left = clamp(x, 16, innerWidth - bw - 16) + "px"; box.style.top = Math.max(16, y) + "px"; box.style.width = bw + "px";
}
$("tutNext").addEventListener("click", () => showTut(tutI + 1));
$("tutSkip").addEventListener("click", () => showTut(TUT.length));
function maybeTutorial() { let done = false; try { done = localStorage.getItem("vspyshka-tut") === "1"; } catch (e) {} if (!done) setTimeout(() => showTut(0), 600); }

/* ---------- автоматическое качество: если кадров совсем мало, снижаем нагрузку по шагам ----------
   Снижение — только на этот сеанс: в сохранённых настройках остаётся то, что выбрал игрок (perf.saved),
   иначе одна просадка (тяжёлая сцена, фоновая программа) навсегда оставляла игру без обработки картинки */
var perf = { acc: 0, n: 0, t: 0, low: 0, level: 0, saved: {} };
function autoQuality(dt) {
  if (document.hidden || paused) return;
  perf.acc += dt; perf.n++; perf.t += dt;
  if (perf.t < 2) return;
  const fpsNow = perf.n / perf.acc; perf.acc = perf.n = perf.t = 0;
  if (fpsNow < 18) perf.low++; else perf.low = 0;
  if (perf.low >= 3 && perf.level < 3) {
    perf.low = 0; perf.level++;
    const steps = ["настоящих людей меньше", "чёткость снижена, листва упрощена", "обработка картинки выключена"];
    if (perf.level === 1) REAL.N = Math.min(REAL.N, 24);
    if (perf.level === 2) { if (!("quality" in perf.saved)) perf.saved.quality = prefs.quality; prefs.quality = "low"; }
    if (perf.level === 3) { if (!("post" in perf.saved)) perf.saved.post = prefs.post; prefs.post = false; }
    applyPrefs(); onRadio(`Игра тормозит: ${steps[perf.level - 1]} — до перезапуска. Настроить можно в «Настройках»`);
  }
}

/* ---------- трава в парках вблизи камеры ---------- */
const grassTexA = canvasTex(64, 64, g => { for (let i = 0; i < 26; i++) { const x = rnd(4, 60); g.strokeStyle = `rgba(${pick(["86,128,58", "70,110,46", "104,140,66", "60,96,40"])},1)`; g.lineWidth = rnd(1.2, 2.4); g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + rnd(-6, 6), 40, x + rnd(-10, 10), rnd(8, 30)); g.stroke(); } }, true);
// газон: низкие пучки по 15–20 см, а не бурьян по пояс
const grassGeo = (() => { const a = new THREE.PlaneGeometry(2.6, .8).translate(0, .4, 0), b = a.clone().rotateY(Math.PI / 2); const g = new THREE.BufferGeometry(); const merge = [a, b]; let pos = [], uv = [], idx = [], off = 0; for (const m of merge) { pos.push(...m.attributes.position.array); uv.push(...m.attributes.uv.array); idx.push(...Array.from(m.index.array, i => i + off)); off += m.attributes.position.count; } g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ map: grassTexA, alphaTest: .5, side: THREE.DoubleSide, roughness: 1 }), 9000);
grass.count = 0; grass.frustumCulled = false; scene.add(grass);
let grassAt = null;
function updateGrass() {
  if (camC.dist > 300 && !fps.on) { grass.visible = false; return; }
  grass.visible = true;
  const cx = camC.tx + W / 2, cy = camC.tz + H / 2;
  if (grassAt && Math.hypot(grassAt[0] - cx, grassAt[1] - cy) < 60) return;
  grassAt = [cx, cy];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0); let n = 0;
  for (let k = 0; k < 45000 && n < 9000; k++) {
    const x = cx + rnd(-180, 180), y = cy + rnd(-180, 180), c = cellAt(x, y);
    if (c !== 2) continue;
    q.setFromAxisAngle(up, rnd(0, TAU)); const s = rnd(.7, 1.2);
    m.compose(new THREE.Vector3(X(x), hasHills ? gY(x, y) : 0, Z(y)), q, new THREE.Vector3(s, s * rnd(.6, 1.1), s)); grass.setMatrixAt(n++, m);
  }
  grass.count = n; grass.instanceMatrix.needsUpdate = true;
}

$("tutAgain").addEventListener("click", () => { $("help").hidden = true; showTut(0); });
