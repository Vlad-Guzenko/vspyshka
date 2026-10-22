/* ---------- фракции и штаб в панели ---------- */
let facKey = "";
function renderFactions() {
  const box = $("factions"); if (!box) return;
  const rows = factions.map(f => { const hb = buildings[f.hq]; return `${f.id}:${f.members.length}:${hb ? Math.round(hb.food || 0) : 0}:${f.rel}`; }).join("|") + "#" + hq.rep + ":" + (hq.withdrawnT > 0 ? 1 : 0) + ":" + dayN;
  if (rows === facKey) return; facKey = rows;
  let html = `<div class="facrow"><b>Штаб</b><span>доверие ${repStars()}${hq.withdrawnT > 0 ? " · армия отозвана" : ""} · день ${dayN}</span></div>`;
  if (!factions.length) html += `<small class="muted">Группировок выживших пока нет: они появляются через пару минут после начала вспышки</small>`;
  for (const f of factions) {
    const hb = buildings[f.hq], L = agentById(f.leader);
    html += `<div class="facrow" style="--k:${FKIND[f.kind].col}"><b>${FKIND[f.kind].n}${L && L.name ? " · " + L.name : ""}</b><span>${f.members.length} чел. · еда ${hb ? Math.round(hb.food || 0) : 0}${f.kind === "gang" ? " · враждебна" : ""}</span><div class="slotbtns"><button class="btn" data-fac="${f.id}" data-act="look">Показать</button>${f.kind === "commune" ? `<button class="btn" data-fac="${f.id}" data-act="supply">Снабдить</button>` : ""}</div></div>`;
  }
  box.innerHTML = html;
}
$("factions").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const f = factions.find(f => f.id === +b.dataset.fac); if (!f) return;
  if (b.dataset.act === "look") { const hb = buildings[f.hq]; if (hb) { followA = null; cine = false; camS.tx = X(hb.door ? hb.door[0] : (hb.x0 + hb.x1) / 2); camS.tz = Z(hb.door ? hb.door[1] : (hb.y0 + hb.y1) / 2); camS.dist = Math.min(camS.dist, 220); camS.pitch = Math.min(camS.pitch, .6); syncCamButtons(); } }
  if (b.dataset.act === "supply") supplyFaction(f);
  facKey = "";
});
// растяжка тянется мышью
let wireStart = null;

/* ---------- панели поверх игры: скрыть и показать ---------- */
$("toolsToggle").addEventListener("click", () => { document.body.classList.toggle("noTools"); $("toolsToggle").textContent = document.body.classList.contains("noTools") ? "›" : "‹"; resize(); });
$("panelToggle").addEventListener("click", () => { document.body.classList.toggle("noPanel"); $("panelToggle").textContent = document.body.classList.contains("noPanel") ? "‹" : "›"; resize(); });
window.addEventListener("keydown", e => { if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return; if (e.key === "[") $("toolsToggle").click(); if (e.key === "]") $("panelToggle").click(); });

/* ---------- предупреждение: всплывает на пару секунд и звучит ---------- */
function warn(html) { $("toast").innerHTML = `<small>Нельзя</small><b>${html.replace(/<\/?b>/g, "")}</b>`; $("toast").hidden = false; toastT = 2.6; sfx.deny(); }

/* ---------- верхняя полоса может стать двухстрочной: панели сдвигаются под неё ---------- */
function syncTopH() { const h = document.querySelector(".top").offsetHeight || 42; document.documentElement.style.setProperty("--topH", h + "px"); }
window.addEventListener("resize", syncTopH); setTimeout(syncTopH, 0); setInterval(syncTopH, 1500);
