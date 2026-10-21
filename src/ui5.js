/* ---------- герои, испытания, хроника, достижения ---------- */
let heroesKey = "";
function renderHeroes() {
  const box = $("heroes"); if (!box) return;
  if (!heroes.length) { if (heroesKey !== "-") { heroesKey = "-"; box.innerHTML = `<small class="muted">В этом городе героев нет</small>`; } return; }
  const key = heroes.map(h => h.id + heroStatus(h) + (followA === h ? "*" : "")).join("|");
  if (key === heroesKey) return; heroesKey = key;
  box.innerHTML = heroes.map(h => `<button class="hero${followA === h ? " on" : ""}${h.state !== "alive" || h.role === "zombie" ? " gone" : ""}" data-id="${h.id}" title="${HERO_KINDS[h.hero].tip}"><b>${h.name}</b><span>${HERO_KINDS[h.hero].n} · ${heroStatus(h)}</span></button>`).join("");
}
$("heroes").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const h = heroes.find(h => h.id === +b.dataset.id); if (!h || h.state === "saved") return;
  followA = h; cine = false; camS.dist = Math.min(camS.dist, 120); camS.pitch = Math.min(camS.pitch, .5); syncCamButtons(); heroesKey = "";
  $("tip").innerHTML = `<b>${h.name}</b>, ${HERO_KINDS[h.hero].n}: ${HERO_KINDS[h.hero].tip.toLowerCase()}. Esc — отпустить камеру.`;
});
// всплывающее достижение
let toastT = 0;
function pollAchievements(dt) {
  toastT -= dt;
  if (toastT > 0 || !achNew.length) { if (toastT <= 0) $("toast").hidden = true; return; }
  const [n, d] = achNew.shift();
  $("toast").innerHTML = `<small>Достижение</small><b>${n}</b><span>${d}</span>`; $("toast").hidden = false; toastT = 5;
  if (AC) sfx.chime();
}
function renderAchievements() {
  $("achList").innerHTML = ACHS.map(([k, n, d]) => `<li class="${achDone[k] ? "done" : ""}"><b>${n}</b><small>${d}</small></li>`).join("");
  $("achCount").textContent = `${Object.keys(achDone).length} из ${ACHS.length}`;
}
// хроника: судьбы людей
function openChronicle() {
  const parts = chronicle();
  $("chronBody").innerHTML = parts.map(p => `<h3>${p.h}</h3><ul>${p.lines.map(l => `<li>${l}</li>`).join("")}</ul>`).join("");
  $("chron").hidden = false;
}
$("openChron").addEventListener("click", openChronicle);
$("chronClose").addEventListener("click", () => { $("chron").hidden = true; });
$("chronAgain").addEventListener("click", openChronicle);
$("resChron").addEventListener("click", () => { $("result").hidden = true; openChronicle(); });

/* ---------- замедление времени на больших событиях ---------- */
let slowMoT = 0;
function slowMo(t) { if (prefs.slowmo === false) return; slowMoT = Math.max(slowMoT, t); }

/* ---------- телерепортаж: кинокамера, заголовок, бегущая строка ---------- */
let newsOn = false, newsHeadKey = "";
const NEWS_SUBS = ["Власти просят сохранять спокойствие", "Больницы переполнены", "В город введены войска", "Очевидцы сообщают о нападениях", "Эвакуация идёт по плану", "Связь с некоторыми районами потеряна", "Специалисты работают над вакциной", "Мэрия: ситуация под контролем"];
function toggleNews(on) {
  newsOn = on; $("news").hidden = !on; $("camNews").setAttribute("aria-pressed", on);
  if (on && !cine) { cine = true; thirdPerson = false; followA = null; cineT = 0; syncCamButtons(); }
  updateNews();
}
function updateNews() {
  if (!newsOn) return;
  const c = lastCounts || counts();
  const head = events.find(e => e.cls === "bad" || e.cls === "good") || events[0];
  if (head && head.text !== newsHeadKey) { newsHeadKey = head.text; $("newsHead").textContent = head.text.replace(/^Рация: /, ""); $("newsSub").textContent = pick(NEWS_SUBS); }
  $("newsTicker").textContent = [`В городе ${c.Z} заражённых`, `погибших ${deaths}`, `спасено ${saved}`, ...events.slice(0, 10).map(e => e.text)].join("   •   ");
  $("newsClock").textContent = hourLabel();
}
$("camNews").addEventListener("click", () => toggleNews(!newsOn));

/* ---------- запись видео с экрана ---------- */
let rec = null, recT = 0;
function toggleRec() {
  if (rec) { rec.stop(); return; }
  if (!window.MediaRecorder || !cv.captureStream) { $("tip").innerHTML = "<b>Запись не поддерживается</b> этим браузером."; return; }
  const stream = cv.captureStream(30);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  const chunks = [];
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined); } catch (e) { $("tip").innerHTML = "<b>Не удалось начать запись.</b>"; rec = null; return; }
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `vspyshka-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    rec = null; $("recBadge").hidden = true; $("camRec").setAttribute("aria-pressed", false);
    $("tip").innerHTML = `<b>Запись сохранена:</b> файл .webm ${Math.round(blob.size / 1024 / 1024 * 10) / 10} МБ в папке загрузок.`;
  };
  rec.start(500); recT = 0; $("recBadge").hidden = false; $("camRec").setAttribute("aria-pressed", true);
}
function tickRec(dt) { if (!rec) return; recT += dt; $("recT").textContent = `REC ${mmss(recT)}`; if (recT >= 30) rec.stop(); }
$("camRec").addEventListener("click", toggleRec);
