/* ---------- штаб ЧС: сам поднимает тревогу и вводит силы, не дожидаясь игрока ---------- */
let alert = 0, alertT = 0, respT = 0, respLog = {}, quietT = 0;
const ALERT_N = ["", "Тревога", "Ввод войск", "Оцепление", "Ликвидация", "Город потерян"];
const ALERT_RADIO = ["", "Штаб: подтверждён очаг заражения, усиливаем полицию и скорую", "Штаб: вводим войска, колонна выходит к очагу", "Штаб: район оцепляется, разворачиваем лагерь и эвакуацию", "Штаб: разрешён огонь на поражение, авиация и танки в деле", "Штаб: город не удержать, всем силам прикрывать эвакуацию"];
// центр самой плотной группы зомби
function zCluster() {
  const zs = []; for (const a of agents) if (a.state === "alive" && a.role === "zombie" && !a.hidden) zs.push(a);
  if (!zs.length) return null;
  let best = null, bn = -1; const stepN = Math.max(1, Math.floor(zs.length / 40));
  for (let i = 0; i < zs.length; i += stepN) { const z = zs[i]; let n = 0; nearZ(z.x, z.y, 80, () => n++); if (n > bn) { bn = n; best = z; } }
  return { x: best.x, y: best.y, n: bn, total: zs.length };
}
// штаб не всевидящий: он знает только о зомби, которых видели полиция, военные, медики и танкисты или на которых жаловались по телефону
function spotZombies() {
  for (const a of agents) {
    if (a.state !== "alive" || a.hidden || !(a.role === "police" || a.role === "army" || a.role === "medic")) continue;
    nearZ(a.x, a.y, 120, z => { if (z.state === "alive" && simT - (z.spotT || -1e9) > 8 && los(a.x, a.y, z.x, z.y)) z.spotT = simT; });
  }
  for (const t of tanks) if (t.hp > 0) nearZ(t.x, t.y, 160, z => { z.spotT = simT; });
  let k = 0; for (const a of agents) if (a.state === "alive" && a.role === "zombie" && simT - (a.spotT || -1e9) < 90) k++;
  hq.known = k; return k;
}
// очаг по тем зомби, о которых штаб знает: центр самой плотной группы и разброс (восемь из десяти — ближе этого)
function spottedCluster() {
  const zs = agents.filter(a => a.state === "alive" && a.role === "zombie" && !a.hidden && simT - (a.spotT || -1e9) < 90); if (zs.length < 3) return null;
  let best = null, bn = -1; for (const z of zs) { let n = 0; for (const o of zs) if (Math.abs(o.x - z.x) < 90 && Math.abs(o.y - z.y) < 90) n++; if (n > bn) { bn = n; best = z; } }
  const ds = zs.map(o => Math.hypot(o.x - best.x, o.y - best.y)).filter(d => d < 260).sort((a, b) => a - b);
  return { x: best.x, y: best.y, n: bn, spread: ds[Math.floor(ds.length * .8)] || 0 };
}
function civNear(x, y, r) { let n = 0; near(x, y, r, a => { if (a.state === "alive" && a.role !== "zombie" && Math.hypot(a.x - x, a.y - y) < r) n++; }); return n; }
function announceAlert() {
  logE(`Уровень ЧС ${alert}: ${ALERT_N[alert]}`, alert >= 4 ? "bad" : "good"); radio(ALERT_RADIO[alert]); sfx.radio();
  if (alert >= 2) onBanner(`ЧС ${alert}: ${ALERT_N[alert]}`);
  if (alert === 5) first("lost", "Штаб признал город потерянным", "bad");
}
// в сценариях с лимитами штаб действует сдержаннее и не даёт того, что сценарий запрещает игроку
function scenOk(k) { return !scen || !scen.limits || scen.limits[k] === undefined || (typeof limitLeft === "function" ? limitLeft(k) > 0 : scen.limits[k] > 0); }
function scenUse(k) { if (scen && scen.limits && scen.limits[k] !== undefined && typeof spendLimit === "function") spendLimit(k); }
function stepResponse(dt) {
  if (!settings.services) return;
  respT -= dt; if (respT > 0) return; respT = 2;
  const c = lastCounts || counts(), Z = c.Z, K = spotZombies();
  const recent = reports.filter(r => r.kind === "attack" && simT - r.t < 60).length;
  const want = K >= 200 || (c.H < 150 && K > 40) ? 5 : K >= 60 ? 4 : K >= 20 ? 3 : K >= 6 || recent >= 4 ? 2 : (K > 0 || c.I > 0 || recent >= 1) ? 1 : 0;
  // уровни растут по одному и не раньше выдержки: штаб должен убедиться, что прежние силы не справились; «ликвидация» — только после того, как армия уже воевала
  // выдержка тем короче, чем больше зомби штабу известно (от сорока пяти — вчетверо): армия должна войти, пока орда мала;
  // бомбить штаб это не торопит — для ударов отдельные условия ниже
  const dwell = [0, 0, 45, 120, 180, 120], dw = dwell[alert + 1] * clamp(1 - K / 60, .25, 1);
  const armyTried = (respLog.armyN || 0) >= 2 && simT - (respLog.army ?? -1e9) > 60;
  if (want > alert && simT - alertT >= dw && (alert + 1 < 4 || armyTried)) { alert++; alertT = simT; announceAlert(); }
  else if (want < alert && simT - alertT > (Z === 0 && c.I === 0 ? 40 : 120) && Z <= [0, 0, 1, 6, 25, 100][alert]) { alert = Z === 0 && c.I === 0 ? Math.max(want, Math.min(alert - 1, 1)) : alert - 1; alertT = simT; logE(alert ? `Штаб понижает уровень ЧС до ${alert}: ${ALERT_N[alert]}` : "Штаб: отбой тревоги, очаг ликвидирован", "good"); radio(alert ? "Штаб: обстановка стабилизируется, уровень понижен" : "Штаб: отбой, всем службам возвращаться"); if (!alert) standDown(); }
  if (!alert) {
    // тихо: силовики, которым нечего делать, через две минуты разъезжаются
    if (Z === 0 && c.I === 0) { quietT = (quietT || 0) + 2; if (quietT > 60 && agents.some(a => a.state === "alive" && !a.hidden && ((a.role === "army" && !a.post && !a.withdraw) || ((a.role === "police" || a.role === "medic") && !a.unit && !a.standDown && !a.tent)))) { standDown(); quietT = 0; } } else quietT = 0;
    return;
  }
  quietT = 0;
  const cl = zCluster(); if (!cl) return;
  const since = k => simT - (respLog[k] ?? -1e9);
  // 1. полиция и скорая выезжают к очагу, не дожидаясь вызовов
  // наряды к очагу — пока он мал; против толпы полицию не шлют, её сменяет армия
  if (activeUnits("police") < 2 + alert && since("police") > 20 && (alert < 3 || cl.n < 10)) { respLog.police = simT; spawnService("police", cl.x, cl.y, special.police); logT("resp_police", "Штаб направил к очагу усиленный наряд полиции", "good", 30); }
  // 2. армия: держим численность солдат по числу зомби (примерно один на двух зомби, не больше сорока), колонны идут не чаще раза в 35–50 с;
  // солдаты в грузовиках, которые ещё едут, тоже считаются — иначе штаб шлёт колонну за колонной, пока первая не доехала
  let soldiers = 0; for (const a of agents) if (a.state === "alive" && a.role === "army" && !a.withdraw && !a.fed) soldiers++;
  for (const c of cars) if (c.service === "army" && !c.gone && !c.wreck && !c.leaving && !c.deployed && !c.abandonedSvc && !c.fed) soldiers += c.crewN || SERVICE.army.n;
  // солдат по известным штабу зомби (полностью видна орда — около шести на десять), потолок 32 для быстрых и 28 для обычных; посты и отозванные — внутри потолка
  const need = alert >= 2 ? Math.min(settings.fast ? 32 : 28, 8 + Math.max(K, Z * .5) * .6) * (scen && scen.limits ? .5 : 1) : 0;
  // зомби осталось мало (до двадцати) — лишний отряд, у которого рядом тихо, садится в свой грузовик и уезжает
  if (alert <= 3 && Z <= 20 && soldiers > need + 8 && since("recall") > 10) {
    const t = cars.find(c => c.service === "army" && c.deployed && !c.recall && !c.abandonedSvc && !c.fed && c.crew.every(a => a.state !== "alive" || zombiesAt(a.x, a.y, 120) === 0));
    if (t) { t.recall = true; t.recallT = simT; respLog.recall = simT; logT("army_back", "Отряд армии возвращается: в его районе зомби не осталось", "good", 30); }
  }
  if (alert >= 2) {
    const trucks = Math.max(2, Math.min(4, Math.ceil((need - soldiers) / 8)));
    if (soldiers < need && hq.withdrawnT <= 0 && since("army") > (alert >= 3 ? 30 : 50)) {
      respLog.army = simT; respLog.armyN = (respLog.armyN || 0) + 1;
      for (let i = 0; i < trucks; i++) { const t = spawnService("army", cl.x + rnd(-70, 70), cl.y + rnd(-70, 70), null); t.spd = 66; t.sweep = true; }
      logE(respLog.armyN === 1 ? "Армия входит в город: колонна идёт к очагу на ликвидацию" : `Подкрепление армии, колонна ${respLog.armyN}`, "good"); if (respLog.armyN === 1) { sfx.radio(); interest(cl.x, cl.y, 4); }
    }
  }
  // 3. оцепление: карантинная стена вокруг очага, КПП на подходах, лагерь и вертолёт эвакуации (лагерь и вертолёт только в свободной игре)
  const full = !(scen && scen.limits);
  if (alert >= 3) {
    const sc = spottedCluster();
    if (sc && since("quar") > 120 && wallJobs.filter(z => z.auto).length < 2 && !quarAt(sc.x, sc.y)) { const r = clamp(sc.spread + 70, 120, 230); if (planQuarantine(sc.x - r, sc.y - r, sc.x + r, sc.y + r, true)) respLog.quar = simT; else respLog.quar = simT - 90; }
    if (full && since("camp") > 300 && camps.length < 2) { const ang = Math.atan2(H / 2 - cl.y, W / 2 - cl.x) + rnd(-.6, .6), d = 260; const x = clamp(cl.x + Math.cos(ang) * d, 120, W - 120), y = clamp(cl.y + Math.sin(ang) * d, 120, H - 120); if (addCamp(x, y)) { respLog.camp = simT; logE("Штаб развернул полевой лагерь для беженцев", "good"); } else respLog.camp = simT - 240; }
    if (full && !evac && since("evac") > 120) { const cp = camps.length ? camps[camps.length - 1] : null; let x = cp ? cp.x : cl.x + rnd(-1, 1) * 240, y = cp ? cp.y - cp.r - 40 : cl.y + rnd(-1, 1) * 200; [x, y] = freeNear(clamp(x, 80, W - 80), clamp(y, 80, H - 80), 40); if (!blocked(x, y)) { const a = rnd(0, TAU); evac = { x, y, hx: x - Math.cos(a) * 900, hy: y - Math.sin(a) * 900, alt: 110, yaw: a, landed: false, leaving: false, t: 60, cap: 40, capMax: 40, auto: true }; fieldT = 0; respLog.evac = simT; logE("Штаб высылает вертолёт эвакуации", "good"); } }
  }
  // 4. ликвидация: танки с окраины и авиаудары по плотным скоплениям вдали от людей
  if (alert >= 4) {
    // танк — крайняя мера: армия воюет уже две с половиной минуты ликвидации, а штабу всё ещё известно больше восьмидесяти зомби; или город потерян
    if (scenOk("tank") && tanks.filter(t => t.hp > 0).length < (alert >= 5 ? 4 : 1) && since("tank") > 60 && (alert >= 5 || (armyTried && K >= 80 && simT - alertT > 150))) { respLog.tank = simT; addTank(...armyEntry(cl.x, cl.y)); scenUse("tank"); logE("Штаб направил танк", "good"); sfx.radio(); }
    // авиаудар: только по плотному скоплению вдали от людей и своих и только там, где бомба не заденет целые дома
    let troops = 0; near(cl.x, cl.y, 130, a => { if (a.state === "alive" && (a.role === "army" || a.role === "police")) troops++; });
    // по жилым кварталам штурмовик не бьёт никогда — даже когда город потерян: целые дома в 80 м от цели исключают удар
    const openGround = !buildings.some(b => b.state === "ok" && Math.hypot(clamp(cl.x, b.x0, b.x1) - cl.x, clamp(cl.y, b.y0, b.y1) - cl.y) < 78);
    if (scenOk("strike") && since("strike") > 90 && (alert >= 5 || simT - alertT > 60) && cl.n >= 15 && civNear(cl.x, cl.y, 90) === 0 && troops === 0 && openGround && !strikes.length) { respLog.strike = simT; strikes.push({ x: cl.x, y: cl.y, t: 3 }); scenUse("strike"); logE("Авиация бьёт по скоплению зомби", "bad"); radio("Штаб: штурмовик на боевом курсе, всем отойти"); }
  }
  // 5. город потерян: вторая волна вертолётов без пауз, армия отходит к лагерям
  if (alert >= 5 && evac && evac.auto && evac.leaving && since("evac2") > 40) { respLog.evac2 = simT; respLog.evac = -1e9; }
}
function resetResponse() { alert = 0; alertT = 0; respT = 5; respLog = {}; quietT = -120; }
