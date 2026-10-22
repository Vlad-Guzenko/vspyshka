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
  const c = lastCounts || counts(), Z = c.Z;
  const recent = reports.filter(r => r.kind === "attack" && simT - r.t < 60).length;
  const want = Z >= 200 || (c.H < 150 && Z > 40) ? 5 : Z >= 60 ? 4 : Z >= 20 ? 3 : Z >= 6 || recent >= 4 ? 2 : (Z > 0 || c.I > 0 || recent >= 1) ? 1 : 0;
  if (want > alert) { alert = want; alertT = simT; announceAlert(); }
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
  if (activeUnits("police") < 2 + alert && since("police") > 20) { respLog.police = simT; spawnService("police", cl.x, cl.y, special.police); logT("resp_police", "Штаб направил к очагу усиленный наряд полиции", "good", 30); }
  // 2. армия: держим численность солдат по числу зомби, колонны идут каждые 20–30 с
  if (alert >= 2) {
    let soldiers = 0; for (const a of agents) if (a.state === "alive" && a.role === "army" && !a.withdraw) soldiers++;
    const need = Math.min(alert >= 4 ? 60 : 36, 6 + Z * .8) * (scen && scen.limits ? .5 : 1);
    if (soldiers < need && hq.withdrawnT <= 0 && since("army") > (alert >= 3 ? 35 : 50)) {
      respLog.army = simT; respLog.armyN = (respLog.armyN || 0) + 1;
      for (let i = 0; i < 2; i++) { const t = spawnService("army", cl.x + rnd(-70, 70), cl.y + rnd(-70, 70), null); t.spd = 66; t.sweep = true; }
      logE(respLog.armyN === 1 ? "Армия входит в город: колонна идёт к очагу на ликвидацию" : `Подкрепление армии, колонна ${respLog.armyN}`, "good"); if (respLog.armyN === 1) { sfx.radio(); interest(cl.x, cl.y, 4); }
    }
  }
  // 3. оцепление: карантинная стена вокруг очага, КПП на подходах, лагерь и вертолёт эвакуации (лагерь и вертолёт только в свободной игре)
  const full = !(scen && scen.limits);
  if (alert >= 3) {
    if (since("quar") > 240 && wallJobs.length < 2 && (cl.n >= 4 || simT - alertT > 60)) { const r = clamp(60 + cl.total * 2, 90, 170); if (planQuarantine(cl.x - r, cl.y - r * .8, cl.x + r, cl.y + r * .8)) { respLog.quar = simT; logE("Штаб: военные оцепляют район стеной", "good"); } }
    if (since("cp") > 60 && cps.length < 4) { const ang = rnd(0, TAU), d = 190; if (addCheckpoint(cl.x + Math.cos(ang) * d, cl.y + Math.sin(ang) * d)) respLog.cp = simT; else respLog.cp = simT - 50; }
    if (full && since("camp") > 300 && camps.length < 2) { const ang = Math.atan2(H / 2 - cl.y, W / 2 - cl.x) + rnd(-.6, .6), d = 260; const x = clamp(cl.x + Math.cos(ang) * d, 120, W - 120), y = clamp(cl.y + Math.sin(ang) * d, 120, H - 120); if (addCamp(x, y)) { respLog.camp = simT; logE("Штаб развернул полевой лагерь для беженцев", "good"); } else respLog.camp = simT - 240; }
    if (full && !evac && since("evac") > 120) { const cp = camps.length ? camps[camps.length - 1] : null; let x = cp ? cp.x : cl.x + rnd(-1, 1) * 240, y = cp ? cp.y - cp.r - 40 : cl.y + rnd(-1, 1) * 200; [x, y] = freeNear(clamp(x, 80, W - 80), clamp(y, 80, H - 80), 40); if (!blocked(x, y)) { const a = rnd(0, TAU); evac = { x, y, hx: x - Math.cos(a) * 900, hy: y - Math.sin(a) * 900, alt: 110, yaw: a, landed: false, leaving: false, t: 60, cap: 40, capMax: 40, auto: true }; fieldT = 0; respLog.evac = simT; logE("Штаб высылает вертолёт эвакуации", "good"); } }
  }
  // 4. ликвидация: танки с окраины и авиаудары по плотным скоплениям вдали от людей
  if (alert >= 4) {
    if (scenOk("tank") && tanks.filter(t => t.hp > 0).length < (alert >= 5 ? 4 : 2) && since("tank") > 60) { respLog.tank = simT; addTank(...edgePointNear(cl.x, cl.y)); scenUse("tank"); logE("Штаб направил танк", "good"); sfx.radio(); }
    if (scenOk("strike") && since("strike") > 35 && cl.n >= 12 && civNear(cl.x, cl.y, 75) === 0 && !strikes.length) { respLog.strike = simT; strikes.push({ x: cl.x, y: cl.y, t: 3 }); scenUse("strike"); logE("Авиация бьёт по скоплению зомби", "bad"); radio("Штаб: штурмовик на боевом курсе, всем отойти"); }
  }
  // 5. город потерян: вторая волна вертолётов без пауз, армия отходит к лагерям
  if (alert >= 5 && evac && evac.auto && evac.leaving && since("evac2") > 40) { respLog.evac2 = simT; respLog.evac = -1e9; }
}
function resetResponse() { alert = 0; alertT = 0; respT = 5; respLog = {}; quietT = -120; }
