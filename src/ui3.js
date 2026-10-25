/* ---------- мастер новой игры ---------- */
const LAYOUT_INFO = {
  random: "каждый раз новая", grid: "прямые кварталы и проспекты", organic: "кривые улицы, как в старом городе, развязка в центре",
  ring: "паутина колец и лучей вокруг развязки", radial: "три площади-звезды, бульвары между ними", diag: "квадратные кварталы, диагонали через площадь",
  winding: "улицы вдоль склонов и подъёмы между ними", old: "собор, переулки за крепостной стеной, бульварное кольцо",
  park: "огромный парк с озером в середине", mega: "плотная сетка, бродвей и центральный парк", suburb: "петли улиц, тупики-разъезды, частные дома",
  industry: "склады и стоянки на полгорода", river: "река и мосты", port: "море вдоль края", mountain: "горы", valley: "долина",
};
const wiz = { step: 0, scen: "sandbox", layout: "random", pop: 900, fast: false, inc: 20, armed: 5, time: 13, weather: "clear", services: true, threats: true };
function cardHTML(name, value, title, sub, checked) {
  return `<label class="card"><input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""}><b>${title}</b><small>${sub}</small></label>`;
}
function renderWizard() {
  $("scenCards").innerHTML = Object.entries(SCENARIOS).filter(([k, s]) => !s.hidden).map(([k, s]) => cardHTML("wScen", k, s.n, `<span class="tag">${s.tag}</span>${s.brief}`, k === wiz.scen)).join("");
  $("layoutCards").innerHTML = Object.entries({ random: "Случайная", ...Object.fromEntries(Object.entries(LAYOUTS).filter(([k, v]) => !v.hidden).map(([k, v]) => [k, v.n])) }).map(([k, n]) => cardHTML("wLayout", k, n, LAYOUT_INFO[k] || "", k === wiz.layout)).join("");
  const forced = SCENARIOS[wiz.scen].layout;
  $("layoutNote").hidden = !forced; if (forced) $("layoutNote").textContent = `Сценарий «${SCENARIOS[wiz.scen].n}» играется на планировке «${LAYOUTS[forced].n}».`;
  document.querySelectorAll("#wizard [data-s]").forEach(el => { if (el.tagName === "SECTION") el.hidden = +el.dataset.s !== wiz.step; else el.setAttribute("aria-current", +el.dataset.s === wiz.step ? "step" : "false"); });
  $("wBack").hidden = wiz.step === 0;
  $("wNext").textContent = wiz.step === 2 ? "Начать" : "Далее";
}
function openWizard() { setPaused(true); wiz.step = 0; renderWizard(); $("wizard").hidden = false; }
$("wizard").addEventListener("change", e => {
  const t = e.target;
  if (t.name === "wScen") { wiz.scen = t.value; renderWizard(); }
  if (t.name === "wLayout") wiz.layout = t.value;
  if (t.id === "wPop") { wiz.pop = +t.value; $("wPopO").textContent = t.value; }
  if (t.name === "wZ") wiz.fast = t.value === "fast";
  if (t.id === "wInc") { wiz.inc = +t.value; $("wIncO").textContent = t.value + " с"; }
  if (t.id === "wArm") { wiz.armed = +t.value; $("wArmO").textContent = t.value + "%"; }
  if (t.name === "wTime") wiz.time = +t.value;
  if (t.id === "wWeather") wiz.weather = t.value;
  if (t.id === "wSvc") wiz.services = t.checked;
  if (t.id === "wThr") wiz.threats = t.checked;
});
$("wizard").addEventListener("input", e => { const t = e.target; if (t.id === "wPop") $("wPopO").textContent = t.value; if (t.id === "wInc") $("wIncO").textContent = t.value + " с"; if (t.id === "wArm") $("wArmO").textContent = t.value + "%"; });
$("wBack").addEventListener("click", () => { wiz.step = Math.max(0, wiz.step - 1); renderWizard(); });
$("wNext").addEventListener("click", () => { if (wiz.step < 2) { wiz.step++; renderWizard(); } else startGame(); });
$("wClose").addEventListener("click", () => { $("wizard").hidden = true; setPaused(false); });
function startGame() {
  if (fps.on) stopFps();
  $("wizard").hidden = true; $("result").hidden = true;
  settings.fast = wiz.fast; settings.inc = wiz.inc; settings.armed = wiz.armed / 100; settings.services = wiz.services; settings.threats = wiz.threats;
  $("fast").checked = wiz.fast; $("inc").value = wiz.inc; $("incO").textContent = wiz.inc + " с"; $("arm").value = wiz.armed; $("armO").textContent = wiz.armed + "%"; $("services").checked = wiz.services; $("threats").checked = wiz.threats;
  $("pop").value = wiz.pop; $("popO").textContent = wiz.pop;
  $("layout").value = SCENARIOS[wiz.scen].layout || wiz.layout;
  world.weather = wiz.weather; $("weather").value = wiz.weather; world.cycle = false; world.rate = 0; $("cycle").checked = false;
  world.hour = world.target = wiz.time; syncDayButton();
  newCity(wiz.scen);
  setPaused(false);
  audio(); maybeTutorial();
}

/* ---------- настройки: громкость и графика ---------- */
const prefs = { master: 80, weap: 90, voice: 85, amb: 70, music: 50, quality: "medium", particles: "high", shadows: true, post: true, realPeople: true, radioVoice: true, slowmo: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem("vspyshka-prefs") || "{}")); } catch (e) {}
function savePrefs() { try { localStorage.setItem("vspyshka-prefs", JSON.stringify(prefs)); } catch (e) {} }
function applyPrefs() {
  if (master) master.gain.value = muted ? 0 : prefs.master / 100; if (busW) busW.gain.value = prefs.weap / 100; if (busV) busV.gain.value = prefs.voice / 100; if (ambBus) ambBus.gain.value = prefs.amb / 100; if (musicBus) musicBus.gain.value = musicOn ? prefs.music / 100 : 0;
  const q = prefs.quality, pr = q === "low" ? .75 : q === "high" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  if (R3.getPixelRatio() !== pr) { R3.setPixelRatio(pr); resize(); }
  const sm = q === "low" ? 1024 : q === "high" ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  sun.castShadow = prefs.shadows; $("shadows").checked = prefs.shadows;
  fxK = prefs.particles === "low" ? .35 : prefs.particles === "medium" ? .65 : 1;
  for (const k of ["master", "weap", "voice", "amb", "music"]) { $("s_" + k).value = prefs[k]; $("s_" + k + "O").textContent = prefs[k] + "%"; }
  $("s_quality").value = prefs.quality; $("s_particles").value = prefs.particles; $("s_shadows").checked = prefs.shadows; $("s_post").checked = prefs.post !== false; $("s_realPeople").checked = prefs.realPeople !== false; $("s_radioVoice").checked = prefs.radioVoice !== false; $("s_slowmo").checked = prefs.slowmo !== false;
}
$("settings").addEventListener("input", e => {
  const t = e.target, k = t.id.replace("s_", "");
  if (t.type === "range") prefs[k] = +t.value;
  else if (t.type === "checkbox") prefs[k] = t.checked;
  else prefs[k] = t.value;
  savePrefs(); applyPrefs();
});
$("openSettings").addEventListener("click", () => { audio(); renderAchievements(); $("settings").hidden = false; });
$("sClose").addEventListener("click", () => { $("settings").hidden = true; });
$("shadows").addEventListener("change", e => { prefs.shadows = e.target.checked; savePrefs(); applyPrefs(); });

/* ---------- цель сценария, рация, итог ---------- */
function updateObjective() {
  const box = $("objective");
  if (!scen || scenKey === "sandbox") {
    if (challenge) { box.hidden = false; box.querySelector("b").textContent = "Испытание"; box.querySelector("span").textContent = challengeText(); }
    else box.hidden = true;
    return;
  }
  box.hidden = false; box.querySelector("b").textContent = scen.n; box.querySelector("span").textContent = scenarioHud();
}
function onRadio(text) { const r = $("radio"); r.textContent = text; r.hidden = false; clearTimeout(onRadio.t); onRadio.t = setTimeout(() => r.hidden = true, 6000); if (/^(Штаб|Диспетчер|Лаборатория|Разведка|Выжившие)/.test(text)) speakRadio(text); }
function onResult(win, text) {
  setPaused(true);
  $("resTitle").textContent = win ? "Победа" : "Поражение"; $("resTitle").className = win ? "good" : "bad";
  $("resText").textContent = text;
  const c = counts();
  $("resStats").innerHTML = [["Время", mmss(simT)], ["Укусов", bites], ["Погибло", deaths], ["Спасено", saved], ["Уничтожено зомби", zkills], ["Осталось зомби", c.Z]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("");
  $("result").hidden = false; sfx.radio();
}
$("resAgain").addEventListener("click", () => startGame());
$("resNew").addEventListener("click", () => { $("result").hidden = true; openWizard(); });
$("resStay").addEventListener("click", () => { $("result").hidden = true; setPaused(false); });
