/* ---------- кампания в интерфейсе: кнопка в мастере, экран итогов дня, «Закончить день», слот сохранения ---------- */
const CAMP_KEY = "vspyshka-campaign";
const campRound = (k, v) => typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v;
function campMeta() { try { const m = localStorage.getItem(CAMP_KEY + "-meta"); return m ? JSON.parse(m) : null; } catch (e) { return null; } }
// один слот: город утром текущего дня; пишется в начале каждого дня
async function saveCampaign() {
  if (!camp || camp.over) return false;
  try {
    const S = serializeGame(), data = await packSave(JSON.stringify(S, campRound));
    localStorage.removeItem(CAMP_KEY); localStorage.setItem(CAMP_KEY, data);
    localStorage.setItem(CAMP_KEY + "-meta", JSON.stringify({ day: camp.day, layoutKey, alive: S.agents.filter(a => a.state === "alive" && a.role !== "zombie").length, date: Date.now() }));
    logT("campsave", `Кампания сохранена: утро дня ${camp.day}`, "good", 5); return true;
  } catch (e) { warn("<b>Не удалось сохранить кампанию:</b> в браузере не хватает места или хранилище отключено."); return false; }
}
async function loadCampaign() {
  let raw = null; try { raw = localStorage.getItem(CAMP_KEY); } catch (e) {}
  if (!raw) { warn("<b>Сохранённой кампании нет.</b>"); return false; }
  try {
    const S = JSON.parse(await unpackSave(raw));
    if (fps.on) stopFps();
    $("wizard").hidden = true; $("result").hidden = true; $("dayEnd").hidden = true;
    if (loadGame(S) === false || !camp) { warn("<b>Не удалось загрузить кампанию.</b>"); return false; }
    $("cycle").checked = true; syncDayButton(); setPaused(false); audio(); return true;
  } catch (e) { warn("<b>Не удалось загрузить кампанию.</b>"); return false; }
}
// мастер: кнопка «Кампания» ведёт сразу к выбору города; «Продолжить» — если есть сохранение
function renderCampaignWizard() {
  const m = campMeta();
  $("wResume").hidden = !m; if (m) $("wResume").textContent = `Продолжить кампанию: день ${m.day}, ${(LAYOUTS[m.layoutKey] || {}).n || "город"}, живых ${m.alive}`;
  $("wTitle").textContent = wiz.scen === "campaign" ? "Кампания" : "Новая игра";
  if (wiz.scen === "campaign" && wiz.step === 2) $("wNext").textContent = "Начать кампанию";
}
$("wCampaign").addEventListener("click", () => { wiz.scen = "campaign"; wiz.step = 1; renderWizard(); });
$("wResume").addEventListener("click", () => loadCampaign());
$("wBack").addEventListener("click", () => { if (wiz.step === 0 && wiz.scen === "campaign") { wiz.scen = "sandbox"; renderWizard(); } });
// кампания началась (startGame в ui3.js): часы идут, первое утро сохранено
function campaignStarted() { $("cycle").checked = true; syncDayButton(); $("dayEnd").hidden = true; saveCampaign(); }
// шесть утра: экран итогов. Ночь уже прошла — сцена перестраивается по новому состоянию города
function onDayEnd(sum) {
  setPaused(true); setTimeout(campRefreshScene, 0);
  const N = camp.night || {}, nx = camp.next || {}, kinds = nx.kinds || [];
  $("deTitle").textContent = `День ${sum.day}: итоги`;
  $("deText").textContent = `${sum.early ? "Зомби в городе не осталось, день закончен досрочно. " : "Шесть утра. "}${sum.trustD > 0 ? "Штаб доволен: " + sum.why + "." : sum.trustD < 0 ? "Штаб недоволен: " + sum.why + "." : "Штаб оценил день как обычный."} Доверие ${campStarsText()}.`;
  const spent = Object.keys(sum.spent).filter(t => sum.spent[t] > 0).map(t => `${CAMP_TOOL_N[t]} ${sum.spent[t]}`).join(", ") || "ничего";
  $("deStats").innerHTML = [["Живых", sum.alive], ["Погибло за день", sum.dead], ["Спасено", sum.saved], ["Уничтожено зомби", sum.zkills], ["Разрушено домов", sum.ruinedNew], ["Зомби к утру", sum.Z], ["Укусов", sum.bites], ["Вылечено", sum.cured], ["Доверие", campStarsText()]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("");
  $("deSpent").textContent = `Потрачено за день: ${spent}.`;
  $("deNight").textContent = `Тела вывезены (${N.bodies || 0}), брошенные машины убраны (${N.cars || 0}), завалы разобраны у ${N.rubble || 0} домов, отремонтировано ${N.repaired || 0}. Жители вернулись домой (${N.home || 0}), беженцев осталось жить ${N.refStay || 0}, уехало ${N.refLeft || 0}. Силовики вернулись на базы (${N.forces || 0}).${N.turned ? ` Укушенные без вакцины обратились за ночь: ${N.turned}.` : ""}${N.cured ? ` Вакцина спасла укушенных: ${N.cured}.` : ""}`;
  $("deNext").textContent = `День ${sum.day + 1} из ${CAMP_DAYS}. Бюджет штаба: ${campBudgetText(nx.budget || {})}. ${kinds.length ? "Разведка: " + kinds.map(k => CAMP_EVENT_N[k]).join(", ") + "." : "Разведка: окраины спокойны."}`;
  $("dayEnd").hidden = false; sfx.radio();
}
function campRefreshScene() { clearDebris(); buildCity(); barrDirty = true; gridDirty = true; gridDirtyMini = true; fieldT = 0; followA = null; hoverA = null; renderTools(); }
$("deNextBtn").addEventListener("click", () => { $("dayEnd").hidden = true; if (campNextDay()) { $("cycle").checked = true; syncDayButton(); renderTools(); saveCampaign(); } setPaused(false); });
$("deChron").addEventListener("click", () => { $("dayEnd").hidden = true; openChronicle(); });
$("chronClose").addEventListener("click", () => { if (camp && camp.pending && !camp.over && scenKey === "campaign") $("dayEnd").hidden = false; });
// «Закончить день» в верхней полосе: виден в кампании, доступен, когда зомби нет
function updateCampaignUI() {
  const on = !!camp && scenKey === "campaign" && !camp.over && !camp.pending && !scenDone;
  $("endDay").hidden = !on; if (on) $("endDay").disabled = !(lastCounts && lastCounts.Z === 0);
}
$("endDay").addEventListener("click", () => { if (!campEndEarly()) warn("<b>День нельзя закончить:</b> в городе ещё есть зомби."); });
