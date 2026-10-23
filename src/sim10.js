/* ---------- светофоры ---------- */
let crossings = [];
// перекрёстки в городе: там светофоры, зебры, по углам — тротуар, где встаёт отряд
function buildCrossings() {
  crossings = [];
  for (const n of RN) {
    if (n.ed.length < 3 || n.round || n.ed.every(e => e.rural)) continue;
    const dirs = n.ed.map(e => { const d = edgeDirFrom(e, n); return { e, a: Math.atan2(d[1], d[0]) }; }).sort((p, q) => p.a - q.a), corners = [];
    for (let i = 0; i < dirs.length; i++) {
      const p = dirs[i], q = dirs[(i + 1) % dirs.length]; let span = q.a - p.a; if (span <= 0) span += TAU;
      if (span > Math.PI * 1.2) continue;
      const mid = p.a + span / 2, hw = (p.e.hw + q.e.hw) / 2 + 4, r = Math.min(46, hw / Math.max(.35, Math.sin(span / 2)));
      corners.push([n.x + Math.cos(mid) * r, n.y + Math.sin(mid) * r, mid]);
    }
    crossings.push({ x: n.x, y: n.y, node: n, corners });
  }
}
/* ---------- распорядок дня: ночью улицы пустеют, утром город оживает ---------- */
let routineT = 0;
function activity() { const h = world.hour; return h < 5 ? .12 : h < 7 ? .35 : h < 10 ? 1 : h < 17 ? .8 : h < 20 ? 1 : h < 23 ? .55 : .2; }
function stepRoutine(dt) {
  routineT -= dt; if (routineT > 0) return; routineT = 2;
  const act = activity(), outbreak = (lastCounts || counts()).Z > 0 && firsts.zombie && (lastCounts || counts()).Z > 6;
  // горожане расходятся по домам и выходят утром; у кого дом далеко — в ближайший подъезд
  for (let k = 0; k < 12; k++) {
    const a = agents[Math.floor(Math.random() * agents.length)];
    if (!a || a.state !== "alive" || a.role !== "civ" || a.panic > .3 || a.bitten) continue;
    if (!a.hidden && Math.random() > act + .15 && !outbreak && !a.homeGoal) {
      const hb = a.home >= 0 ? buildings[a.home] : null;
      if (hb && hb.door && hb.state === "ok" && Math.hypot(hb.door[0] - a.x, hb.door[1] - a.y) < 500) a.homeGoal = true;
      else { const b = findShelter(a); if (b && Math.hypot(b.door[0] - a.x, b.door[1] - a.y) < 60) { a.hideGoal = b; a.homeTrip = true; } }
    }
    else if (a.hidden && a.homeTrip && Math.random() < act && !outbreak && !settings.curfew) { leaveShelter(a, false); a.homeTrip = false; a.dest = civDestination(a); }
  }
  // машин на улицах столько, сколько нужно в этот час
  const moving = cars.filter(c => c.moving && !c.service), target = Math.round(trafficN() * act);
  if (moving.length > target + 4) { const c = moving.find(c => typeof camC === "undefined" || Math.hypot(c.x - W / 2 - camC.tx, c.y - H / 2 - camC.tz) > 500); if (c) { c.gone = true; c.moving = false; } }
  else if (moving.length < target - 4 && !outbreak) spawnTraffic(2);
}

/* ---------- столкновения машин в панике ---------- */
function carCollide(c, o, v) {
  if (c.wreck) return;
  c.wreck = true; c.dmg = 9; abandonCar(c, "crash");
  const ang = c.ang;
  if (!o.tank) { o.vx = (o.vx || 0) + Math.cos(ang) * v * .5; o.vy = (o.vy || 0) + Math.sin(ang) * v * .5; o.vz = v * .15; o.z = .1; o.sr = rnd(-2, 2); o.sy = rnd(-2, 2); o.roll = o.roll || 0; if (o.moving) { o.moving = false; o.stopped = true; } o.wreck = o.wreck || v > 30; }
  sfx.crash(c); fxDebris(c.x, c.y); if (Math.random() < .25) c.burnT = rnd(20, 60);
  for (const k of cars) if (!k.wreck && Math.hypot(k.x - c.x, k.y - c.y) < 60) k.alarm = rnd(10, 30);
  logT("carcrash", "Авария: машины столкнулись", "bad", 12); interest(c.x, c.y, 3);
}
