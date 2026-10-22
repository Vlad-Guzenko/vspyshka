/* ---------- службы действуют сами: зачистка домов, посты у укрытий, медпункт, комендантский час ---------- */
let medpoints = [], guardT = 0, medT = 0, autoT = 0;
// военный на зачистке: если зомби не видно, идёт к дому, где кто-то обратился, и выбивает дверь
function armyClear(a, dt) {
  let b = a.clearB;
  if (b && (b.state !== "ok" || !b.occ || !b.occ.some(o => o.role === "zombie"))) { b = a.clearB = null; }
  if (!b) {
    a.clearScanT = (a.clearScanT || 0) - dt; if (a.clearScanT > 0) return null; a.clearScanT = rnd(2, 4);
    let bd = 350;
    for (const c of buildings) { if (!c.occ || !c.occ.length || c.state !== "ok" || !c.door) continue; if (!c.occ.some(o => o.role === "zombie")) continue; const d = Math.hypot(c.door[0] - a.x, c.door[1] - a.y); if (d < bd) { bd = d; b = c; } }
    if (!b) return null;
    a.clearB = b; a.clearT = 0;
  }
  const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y);
  if (d > 6) return goTo(a, b.door[0], b.door[1], 11);
  a.clearT += dt; a.tool = .3; a.aim = Math.atan2(b.door[1] - a.y, b.door[0] - a.x); a.aimT = .5;
  if (a.clearT > 2.5) {
    a.clearT = 0;
    const z = b.occ.find(o => o.role === "zombie");
    if (z) { leaveShelter(z, false); z.x = b.door[0]; z.y = b.door[1]; destroyZombie(z, false); fxShot(a); logT("clear", `Военные зачистили зомби в доме ${placeName(b.door[0], b.door[1])}`, "good", 15); interest(b.door[0], b.door[1], 2); }
    for (const o of b.occ.slice()) if (o.role !== "zombie" && o.bitten && Math.random() < .5) { leaveShelter(o, false); o.panic = .6; }
  }
  return [0, 0, 0];
}
// полиция выставляет посты у людных укрытий рядом с очагом
function stepGuards(dt, cl) {
  guardT -= dt; if (guardT > 0) return; guardT = 30;
  if (alert < 2) { if (alert === 0) for (const a of agents) if (a.guardB) { a.guardB = null; a.order = null; } return; }
  let posts = 0; for (const a of agents) if (a.state === "alive" && a.guardB) { const gb = a.guardB; if (!gb.occ || gb.occ.length === 0 || gb.state !== "ok") { a.guardB = null; a.order = null; continue; } posts++; }
  for (const c of cars) if (c.service === "police" && !c.gone && c.guardB) posts += 2;
  if (posts >= 16 || !cl) return;
  let best = null, bs = 0;
  for (const b of buildings) { if (!b.occ || b.occ.length < 3 || b.state !== "ok" || !b.door || (b.guardedT && simT - b.guardedT < 400)) continue; const d = Math.hypot(b.door[0] - cl.x, b.door[1] - cl.y); if (d > 420) continue; const s = b.occ.length / (1 + d / 100); if (s > bs) { bs = s; best = b; } }
  if (!best) return;
  best.guardedT = simT;
  sendPosts("police", best.door[0], best.door[1] + 8, [0, 1].map(i => freeNear(best.door[0] + (i ? 5 : -5), best.door[1] + 4, 6)), { guardB: best });
  logT("guard", `Полиция выставила пост у укрытия ${placeName(best.door[0], best.door[1])}`, "good", 20);
}
// медпункт: палатка, скорая и медики недалеко от очага
function stepMedpoints(dt, cl) {
  medT -= dt; if (medT > 0) return; medT = 10;
  for (const m of medpoints) if (simT - m.t >= 600 && m.cells) { unblock(m.cells); m.cells = null; }
  medpoints = medpoints.filter(m => simT - m.t < 600);
  if (alert < 2 || !cl || medpoints.length >= 2 || medpoints.some(m => Math.hypot(m.x - cl.x, m.y - cl.y) < 260)) return;
  const ang = Math.atan2(H / 2 - cl.y, W / 2 - cl.x) + rnd(-.8, .8), d = 150;
  const [x, y] = freeNear(clamp(cl.x + Math.cos(ang) * d, 60, W - 60), clamp(cl.y + Math.sin(ang) * d, 60, H - 60), 30);
  if (blocked(x, y)) return;
  medpoints.push({ x, y, t: simT, cells: blockFree(x - 9, y - 6, x + 9, y + 6) });
  for (let k = 0; k < 2; k++) sendPosts("ambulance", x + k * 14, y + 12, [[x - 6, y + 10], [x + 6, y + 10]], {});
  hasMedics = true;
  logE(`Медики развернули сортировочный пункт ${placeName(x, y)}`, "good"); radio("Штаб: раненых и укушенных направлять в медпункт");
}
// комендантский час: при оцеплении всех по домам, утром никто не выходит
function stepCurfew() {
  if (alert >= 3 && !settings.curfew && !(scen && scen.limits)) {
    settings.curfew = true; let n = 0;
    for (const a of agents) if (a.state === "alive" && a.role === "civ" && !a.hidden && !a.forage && !a.faction && a.home >= 0) { a.homeGoal = true; a.dest = null; n++; }
    logE(`Объявлен комендантский час: полиция гонит всех по домам, ${n} человек пошли домой`, "good"); radio("Штаб: комендантский час, гражданским не выходить на улицу");
  }
  if (alert < 3 && settings.curfew) { settings.curfew = false; logE("Комендантский час снят", "good"); }
}
function stepAuto(dt) {
  if (!settings.services) { if (settings.curfew) settings.curfew = false; return; }
  autoT = (autoT || 0) - dt; if (autoT > 0) return; autoT = 2;
  const cl = alert >= 2 ? zCluster() : null;
  stepGuards(2, cl); stepMedpoints(2, cl); stepCurfew();
}
function resetAuto() { medpoints = []; guardT = 20; medT = 15; settings.curfew = false; }
