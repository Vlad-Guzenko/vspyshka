/* ---------- отряды: рамка выделения и приказы; подсказки стройки; счётчик кадров ---------- */
let selStart = null, selEnd = null;
function squadHud() {
  const box = $("squad"); if (!box) return;
  if (!selected.length) { box.hidden = true; return; }
  const armies = selected.filter(a => a.role === "army").length, cops = selected.filter(a => a.role === "police").length, other = selected.length - armies - cops;
  const ammo = selected.reduce((s, a) => s + a.mag + a.ammo, 0);
  box.hidden = false; box.innerHTML = `<b>Отряд: ${selected.length}</b><span>${[armies ? `солдат ${armies}` : "", cops ? `полицейских ${cops}` : "", other ? `стрелков ${other}` : ""].filter(Boolean).join(", ")} · патронов ${ammo}</span><small>Клик по земле — занять позицию и держать. Esc — отпустить.</small>`;
}
function updateSelBox() {
  selBox.visible = !!(selStart && selEnd && tool === "squad");
  if (selBox.visible) { const [x0, y0] = selStart, [x1, y1] = selEnd, p = selBox.geometry.attributes.position; [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i) => p.setXYZ(i, X(x), 1.5, Z(y))); p.needsUpdate = true; }
}
// фиксированный шаг симуляции: не чаще 30 раз в секунду, независимо от кадров
let simAcc = 0;
const SIM_DT = 1 / 30;
function runSim(dtScaled) {
  simAcc += dtScaled; let done = 0, n = 0;
  while (simAcc >= SIM_DT && n < 10) { step(SIM_DT); simAcc -= SIM_DT; done += SIM_DT; n++; }
  if (n >= 10) simAcc = 0;
  return done;
}
// замер: сколько миллисекунд уходит на симуляцию, подготовку сцены и рисование
const perfStats = { sim: 0, scene: 0, draw: 0, n: 0, fps: 0, fpsN: 0, fpsT: 0 };
function perfTick(dt) { perfStats.fpsN++; perfStats.fpsT += dt; if (perfStats.fpsT >= 1) { perfStats.fps = Math.round(perfStats.fpsN / perfStats.fpsT); perfStats.fpsN = 0; perfStats.fpsT = 0; } }
function perfPreset(fast) {
  Object.assign(prefs, fast ? { quality: "low", particles: "medium", shadows: false, post: false, realPeople: false } : { quality: "medium", particles: "high", shadows: true, post: true, realPeople: true });
  savePrefs(); applyPrefs();
  $("tip").innerHTML = fast ? "<b>Режим «Быстро»:</b> тени, обработка картинки и настоящие модели людей выключены." : "<b>Режим «Красиво»:</b> всё включено.";
}
$("s_fast").addEventListener("click", () => perfPreset(true));
$("s_pretty").addEventListener("click", () => perfPreset(false));
