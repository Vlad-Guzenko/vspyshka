/* ---------- внешние угрозы: шум города, орды с окраин, беженцы, внешнее оцепление и ультиматум ---------- */
// город слышно: стрельба, взрывы, сирены, авиаудары; шум затухает за пару минут, но чем громче город живёт и воюет,
// тем раньше и крупнее приходит следующая орда. Угрозы есть только в свободной игре и выключаются в настройках
let threat = null;
function resetThreats() {
  if (typeof hordeFields !== "undefined") hordeFields.clear();
  threat = { noise: 0, hordeT: rnd(600, 840), hordes: [], hordeN: 0, refT: rnd(300, 480), cols: [], fed: null, lines: [] };
}
function cityNoise(v) { if (threat) threat.noise = Math.min(400, threat.noise + v); }
const threatsOn = () => settings.threats !== false && (!scenKey || scenKey === "sandbox" || scenKey === "campaign") && entries.length > 0;
// стороны света: север — вверх карты
function compass(dx, dy) { const a = Math.atan2(-dy, dx), k = Math.round(a / (Math.PI / 4)); return ["с востока", "с северо-востока", "с севера", "с северо-запада", "с запада", "с юго-запада", "с юга", "с юго-востока", "с востока"][((k % 8) + 8) % 8]; }
const entryEdge = en => RE.find(e => e.id === en.e) || null;
// точка на трассе въезда: k > 0 — от въезда наружу, k < 0 — в город
function entryPoint(en, k) { const e = entryEdge(en); if (!e) return [en.x + en.tx * k, en.y + en.ty * k]; const t = clamp(en.t + k * (en.dir || 1), 0, e.len), p = edgePos(e, t); return [p.x, p.y, t, p]; }
// блокпост на въезде (addRoadPost в sim13.js). Один пост может держать сразу несколько «владельцев»: рубеж против орды,
// пост для беженцев, внешнее оцепление. У каждого свои ограничения; пост снимают, когда уходит последний
function roadBlock(en, k, opts, tag) {
  const e = entryEdge(en); if (!e) return null;
  const [, , t] = entryPoint(en, k);
  let cp = e.checkCp && e.checkCp.road && !e.checkCp.broken ? e.checkCp : null;
  if (!cp) cp = addRoadPost(e, t, { outDir: en.dir || 1, kind: opts.kind, noTent: opts.noTent, fed: opts.fed });
  cp.own = cp.own || {}; cp.own[tag] = { closeIn: !!opts.closeIn, closeOut: !!opts.closeOut };
  postFlags(cp); return cp;
}
function postFlags(cp) { const o = Object.values(cp.own || {}); cp.closeIn = o.some(x => x.closeIn); cp.closeOut = o.some(x => x.closeOut); routeCache.clear(); exitRoute = null; }
function liftBlock(cp, tag) {
  if (!cp) return;
  if (cp.own && tag) { delete cp.own[tag]; if (Object.keys(cp.own).length) { if (tag[0] === "h") shutPost(cp, false); postFlags(cp); return; } }
  removeRoadPost(cp);
}
function stepThreats(dt) {
  if (!threat) resetThreats();
  threat.noise *= Math.exp(-dt / 150);
  for (const c of cars) if (c.siren && c.moving && !c.gone) cityNoise(dt * .015);
  if (!threatsOn()) return;
  stepHordes(dt); stepRefugees(dt); stepFederal(dt);
}

/* ---------- орды с окраин ---------- */
// орда собирается за краем карты напротив одного из въездов и идёт полями к нему; штаб узнаёт о ней по рации с поста
// и успевает перекрыть въезд, поставить армейский пост и прожектор, увести жителей пригородов в город
function stepHordes(dt) {
  threat.hordeT -= dt * (1 + threat.noise / 60) * (world.hour < 6.5 || world.hour > 19.5 ? 1.4 : 1);
  if (threat.hordeT <= 0 && threat.hordes.filter(h => !h.done).length < 2) {
    threat.hordeT = rnd(480, 720);
    const en = pick(entries), [ox, oy] = [clamp(en.x + en.tx * 4000, 30, W - 30), clamp(en.y + en.ty * 4000, 30, H - 30)];
    // край карты по направлению наружу от въезда, в полях в стороне от трассы
    const lat = rnd(-160, 160), sx = clamp(ox - en.ty * lat, 30, W - 30), sy = clamp(oy + en.tx * lat, 30, H - 30);
    const n = Math.round(clamp((25 + dayN * 15 + threat.noise * .6) * (settings.fast ? .7 : 1), 20, 220));
    // о скоплении сообщают заранее: пока оно подходит из-за горизонта, у штаба есть от полутора до четырёх минут на рубеж —
    // столько, сколько грузовику ехать из части к въезду, плюс запас
    const h = { id: ++threat.hordeN, en: entries.indexOf(en), x: sx, y: sy, n, left: n, t0: simT, emergeT: simT + clamp(rnd(60, 100) + (special.base ? Math.hypot(special.base.x - en.x, special.base.y - en.y) / 14 : 60), 100, 240), warned: false, done: false, line: null, quietT: 0 };
    threat.hordes.push(h);
    const dist = Math.hypot(en.x - sx, en.y - sy), eta = Math.max(1, Math.round((h.emergeT - simT + dist / (settings.fast ? 18 : 6)) / 60));
    const side = compass(en.x - W / 2, en.y - H / 2);
    logE(`Пост ${side.replace("с ", "на ")} трассе: по полям к городу идёт орда, около ${Math.round(n / 10) * 10}`, "bad");
    radio(`Пост ДПС ${side}: по полям движется скопление зомби, около ${Math.round(n / 10) * 10}. Будут у въезда примерно через ${eta} мин`);
    sfx.radio(); onBanner(`Орда ${side}`); interest(en.x, en.y, 5);
    hordeDefense(h, en);
  }
  for (const h of threat.hordes) {
    if (h.done) continue;
    const en = entries[h.en];
    // выходят из-за края карты по несколько в секунду, у каждого — цель: въезд
    if (h.left > 0 && simT >= h.emergeT) {
      h.acc = (h.acc || 0) + dt * 6;
      while (h.acc >= 1 && h.left > 0) { h.acc--; h.left--; const [x, y] = freeNear(h.x + rnd(-60, 60), h.y + rnd(-60, 60), 30); const z = newAgent("zombie", x, y); turn(z); z.riseT = 0; z.horde = h.id; z.mig = { x: en.x + rnd(-30, 30), y: en.y + rnd(-30, 30) }; }
    }
    // отбита: все вышли, у въезда полторы минуты нет зомби этой орды
    let alive = 0, nearLine = 0; for (const a of agents) if (a.state === "alive" && a.role === "zombie" && a.horde === h.id) { alive++; if (Math.hypot(a.x - en.x, a.y - en.y) < 400) nearLine++; }
    h.alive = alive;
    if (nearLine) h.arrived = true;
    if (h.line && simT >= h.emergeT) {
      let dmin = 1e9; for (const a of agents) if (a.horde === h.id && a.state === "alive" && a.role === "zombie") dmin = Math.min(dmin, Math.hypot(a.x - h.line.x, a.y - h.line.y));
      if (!h.line.shut && dmin < 700) { shutPost(h.line, true); logE("Орда в двухстах метрах: блокпост на въезде закрыт, проезд заложен блоками", "bad"); }
      else if (h.line.shut && dmin > 950) { shutPost(h.line, false); logT("hopen" + h.id, "Орда отошла: блокпост на въезде снова пропускает машины", "good", 30); }
    }
    // рубеж поредел (погибли, укушены) — штаб досылает ещё один грузовик, но не больше двух раз за орду
    if (h.line && h.linePt && settings.services && simT > h.reinfT && (h.reinfN || 0) < 2) {
      h.reinfT = simT + 10;
      let held = 0; near(h.linePt[0], h.linePt[1], 140, a => { if (a.state === "alive" && a.role === "army") held++; });
      for (const c of cars) if (c.hordeLine === h.id && !c.deployed && !c.gone && !c.wreck && !c.leaving) held += c.crewN || 4;
      if (held < 3) { h.reinfN = (h.reinfN || 0) + 1; h.reinfT = simT + 90; sendPosts("army", h.linePt[0] - en.tx * 30, h.linePt[1] - en.ty * 30, h.posts, { crewN: 4, hordeLine: h.id, cp: h.line || null }); radio("Штаб: рубеж на въезде редеет, высылаем подкрепление"); }
    }
    // тишину у въезда считают, только когда орда уже подошла; если за семь минут так и не дошла — значит, разбрелась по полям
    if (h.left === 0 && simT >= h.emergeT && (h.arrived || simT - h.emergeT > 420)) { h.quietT = nearLine ? 0 : h.quietT + dt; if (h.quietT > 90 || alive === 0) { h.done = true; hordeFields.delete(h.id); liftHordeLine(h); logE(alive ? "Орда рассеялась, рубеж на въезде снят" : "Орда отбита, рубеж на въезде снят", "good"); } }
  }
}
// рубеж: заграждение поперёк трассы за въездом, армейский пост за ним, прожектор; пригороды на пути орды уходят в город
function hordeDefense(h, en) {
  if (!settings.services) return;
  // армейский блокпост на трассе: пока орда далеко — машины досматривают и пропускают, когда подходит — проезд закладывают блоками
  const block = roadBlock(en, 40, { kind: "army", noTent: true }, "h" + h.id); if (!block) return;
  const posts = postSpots(block, 4), back = -(en.dir || 1), nx = -block.ty, ny = block.tx;
  sendPosts("army", block.x + block.tx * back * 30, block.y + block.ty * back * 30, posts, { crewN: 4, hordeLine: h.id, cp: block });
  h.linePt = [block.x, block.y]; h.posts = posts; h.reinfN = 0; h.reinfT = simT + 60;
  const [fx, fy] = freeNear(block.x + block.tx * back * 14 - nx * block.side * (block.hw + 10), block.y + block.ty * back * 14 - ny * block.side * (block.hw + 10), 8); floods.push({ x: fx, y: fy, on: true, horde: h.id });
  h.line = block;
  // жители посёлков и дач на пути орды — в город
  for (const a of agents) {
    if (a.state !== "alive" || a.role !== "civ" || a.hidden || cityK(a.x, a.y) > .42) continue;
    if (Math.hypot(a.x - en.x, a.y - en.y) > 900) continue;
    a.dest = [W / 2 + rnd(-200, 200), H / 2 + rnd(-150, 150)]; a.bcastT = 120; a.panic = Math.max(a.panic, .3);
  }
  logE("Штаб: въезд перекрыт, на рубеже армейский пост; жители пригородов уходят в город", "good");
}
function liftHordeLine(h) {
  liftBlock(h.line, "h" + h.id); h.line = null;
  floods = floods.filter(f => f.horde !== h.id);
}
// поведение зомби орды: пока людей не видно и не слышно — идёт к своему въезду
// поле путей к въезду для каждой орды: по нему зомби обходят дома, рощи, воду и скалы; пересчёт раз в полминуты (рубеж меняет проходы)
const hordeFields = new Map();
function hordeField(h) {
  let f = hordeFields.get(h.id);
  if (!f || simT - f.t > 30 || f.t > simT) {
    const en = entries[h.en]; if (!en) return null;
    if (!f) f = { a: new Int16Array(GW * GH), t: 0 };
    bfs(f.a, [{ x: en.x, y: en.y }], 0, 3000); f.t = simT; hordeFields.set(h.id, f);
  }
  return f.a;
}
function hordeMove(a, base) {
  if (!a.mig) return null;
  const d = Math.hypot(a.mig.x - a.x, a.mig.y - a.y);
  if (d < 50) { a.mig = null; return null; }
  const h = threat && threat.hordes.find(h => h.id === a.horde);
  if (h && !h.done) { const fl = hordeField(h), dir = fl && fieldDir(fl, a.x, a.y); if (dir) return [dir[0], dir[1], base * .9]; }
  // упёрся в дом, рощу или воду: раз в восемь секунд проверяем, приблизился ли, и если нет — обходим вбок
  if (a.migDet && simT < a.migDet.t) return [a.migDet.x, a.migDet.y, base * .9];
  if (!(a.migCk > simT)) { if (a.migD0 !== undefined && d > a.migD0 - 12) { const s = Math.random() < .5 ? 1 : -1, ux = (a.mig.x - a.x) / d, uy = (a.mig.y - a.y) / d; a.migDet = { x: -uy * s * .9 + ux * .3, y: ux * s * .9 + uy * .3, t: simT + rnd(3, 6) }; } a.migD0 = d; a.migCk = simT + 8; }
  return [(a.mig.x - a.x) / d, (a.mig.y - a.y) / d, base * .9];
}

/* ---------- беженцы ---------- */
// колонна машин и пешие с трассы. Если в городе спокойно — фильтрационный пост на въезде: проверка, изолятор, потом в город.
// Если город на пределе — въезд закрыт; у заграждения копится толпа, шумит и может прорваться
function entryPolicy() {
  const c = lastCounts || counts();
  if (threat.fed || alert >= 4 || c.Z > 60) return "closed";
  return "check";
}
function stepRefugees(dt) {
  threat.refT -= dt;
  if (threat.refT <= 0) {
    threat.refT = rnd(360, 600);
    const en = pick(entries), policy = entryPolicy(), side = compass(en.x - W / 2, en.y - H / 2);
    const nPeople = Math.round(rnd(8, 18)), nCars = 2 + Math.floor(Math.random() * 4);
    const col = { en: entries.indexOf(en), policy, t0: simT, cars: nCars, carsLeft: nCars, people: nPeople, peopleLeft: nPeople, acc: 0, block: null, cp: null, crowdT: 0, breached: false, done: false };
    threat.cols.push(col);
    if (policy === "check") {
      // пост на въезде: полиция проверяет людей и машины; полосы открыты — машины встают на досмотр сами
      const cp = roadBlock(en, 30, { kind: "police" }, "r" + col.en + "_" + threat.cols.length); if (cp) { cp.refugee = true; col.cp = cp; col.tag = "r" + col.en + "_" + threat.cols.length; dpsCrew(en, cp); staffPost(cp, "police", 2); }
    } else {
      // въезд закрыт: шлагбаум в город опущен, из города выпускают
      col.tag = "r" + col.en + "_" + threat.cols.length; col.block = roadBlock(en, 60, { kind: "police", closeIn: true }, col.tag);
      if (col.block) { dpsCrew(en, col.block); staffPost(col.block, "police", 2); }
    }
    logE(`Беженцы ${side}: колонна из ${nCars} машин и около ${nPeople} пеших`, "bad");
    radio(policy === "check" ? `Штаб: беженцев ${side} принимаем через проверку на въезде, укушенных — в изолятор` : `Штаб: въезд ${side} закрыт, беженцев в город не пускать`);
    sfx.radio();
  }
  for (const col of threat.cols) {
    if (col.done) continue;
    const en = entries[col.en];
    // прибывают по трассе с края карты
    col.acc += dt;
    if (col.carsLeft > 0 && col.acc > 2.5) {
      col.acc = 0; col.carsLeft--;
      const p = edgeLanePoint(en.x + en.tx * 4000, en.y + en.ty * 4000), c = newCar();
      placeOnLane(c, p.l, p.s); c.v = 18; c.refugee = { col: threat.cols.indexOf(col), pax: 2 + Math.floor(Math.random() * 3), bitten: Math.random() < .25 ? 1 : 0 };
      c.goal = camps.length ? { x: camps[0].x, y: camps[0].y } : { x: W / 2 + rnd(-200, 200), y: H / 2 + rnd(-150, 150) };
      if (!blocked(c.x, c.y)) cars.push(c);
    }
    if (col.peopleLeft > 0 && Math.random() < dt * 1.5) {
      col.peopleLeft--;
      const [sx, sy] = freeNear(clamp(en.x + en.tx * 4000, 40, W - 40) + rnd(-30, 30), clamp(en.y + en.ty * 4000, 40, H - 40) + rnd(-30, 30), 30);
      const a = newAgent("civ", sx, sy); a.refCol = threat.cols.indexOf(col) + 1; a.panic = .2; if (typeof nameFor === "function") nameFor(a);
      // укусили недавно: до поста человек должен дойти, иначе обращался бы в поле, а не на въезде
      if (Math.random() < .15) { a.bitten = true; a.incT = Math.hypot(en.x - sx, en.y - sy) / 5 + rnd(60, 200); }
    }
    // закрытый въезд: толпа у заграждения; больше десяти человек дольше минуты — прорыв
    if (col.block && !col.breached) {
      let crowd = 0; const [bx, by] = entryPoint(en, 60); near(bx, by, 60, a => { if (a.state === "alive" && a.refCol === threat.cols.indexOf(col) + 1) crowd++; });
      cityNoise(dt * crowd * .01);
      col.crowdT = crowd >= 10 ? col.crowdT + dt : Math.max(0, col.crowdT - dt);
      if (col.crowdT > 60) { col.breached = true; liftBlock(col.block, col.tag); col.block = null; logE("Беженцы прорвали заграждение на въезде и идут в город без проверки", "bad"); interest(bx, by, 6); }
    }
    // колонна прошла: все вышли и через 6 минут никого из неё у въезда
    if (col.carsLeft === 0 && col.peopleLeft === 0 && simT - col.t0 > 360) {
      let at = 0; near(en.x, en.y, 200, a => { if (a.state === "alive" && a.refCol === threat.cols.indexOf(col) + 1) at++; });
      if (!at || simT - col.t0 > 900) { col.done = true; for (const c of cars) if (c.dps && Math.hypot(c.x - en.x, c.y - en.y) < 90) c.dpsOut = false; liftBlock(col.block, col.tag); col.block = null; if (col.cp) { liftBlock(col.cp, col.tag); } }
    }
  }
}
// наряд ДПС с поста на этом въезде сразу встаёт на досмотр — полиция из участка едет через весь город и подменит его не скоро
function dpsCrew(en, cp) {
  const dps = cars.find(c => c.dps && !c.wreck && !c.gone && !c.dpsOut && Math.hypot(c.x - en.x, c.y - en.y) < 90);
  if (!dps) return;
  dps.dpsOut = true;
  const nx = -cp.ty, ny = cp.tx;
  for (const s of [1, -1]) {
    const [x, y] = freeNear(dps.x, dps.y, 10), a = newAgent("police", x, y);
    const [px, py] = freeNear(cp.x + nx * s * 9 + cp.tx * 6, cp.y + ny * s * 9 + cp.ty * 6, 5);
    a.order = { x: px, y: py }; a.cp = cp; a.dpsHome = [dps.x, dps.y]; a.vest = "#c8e04a";
  }
  logT("dps", "Наряд ДПС с поста встал на досмотр беженцев", "good", 20);
}
// пеший беженец: по трассе к въезду, у поста — проверка, потом в город (в лагерь, если он есть); у закрытого — ждёт у заграждения
function refugeeMove(a, zn, zd) {
  const col = threat && threat.cols[a.refCol - 1]; if (!col) { a.refCol = 0; return null; }
  if (zn && zd < 40) return null;
  const en = entries[col.en];
  const inCity = cityK(a.x, a.y) > .5 && Math.hypot(a.x - en.x, a.y - en.y) > 60;
  // при открытом посте в город — только через досмотр, даже если человек срезал угол по окраине
  const mustCheck = col.cp && !col.cp.broken && !(col.cp.openT > 0) && a.cpChecked !== col.cp && Math.hypot(a.x - col.cp.x, a.y - col.cp.y) < 600;
  if ((inCity && !mustCheck) || col.done) { a.refCol = 0; if (camps.length) a.campGoal = camps[0]; else { a.dest = [W / 2 + rnd(-200, 200), H / 2 + rnd(-150, 150)]; a.bcastT = 90; } return null; }
  if (col.cp && a.cpChecked !== col.cp) { const [qx, qy] = entryPoint(en, 36); return goTo(a, qx, qy, 6); }
  if (col.block && !col.breached) { const [qx, qy] = entryPoint(en, 70); if (Math.hypot(qx - a.x, qy - a.y) < 18) return [rnd(-1, 1), rnd(-1, 1), .5]; return goTo(a, qx, qy, 6); }
  const [qx, qy] = entryPoint(en, -60); return goTo(a, qx, qy, 7);
}
// машина беженцев: досмотр на посту (укушенного снимают в изолятор), в городе высаживает людей у цели
function refugeeCarCheck(c, cp) {
  if (!c.refugee || !c.refugee.bitten) return;
  if (Math.random() < .85) { c.refugee.bitten = 0; c.refugee.pax--; const [x, y] = cp.tent, a = newAgent("civ", x, y); a.bitten = true; a.incT = rnd(60, 200); a.hidden = true; a.detained = cp; cp.detained++; logT("cpdet", "Пост на въезде: у беженцев в машине нашли укушенного, он в изоляторе", "good", 8); }
}
function refugeeCarArrive(c) {
  const r = c.refugee; if (!r) return;
  const outside = cityK(c.x, c.y) < .5;
  for (let i = 0; i < r.pax; i++) { const [x, y] = freeNear(c.x, c.y, 12), a = newAgent("civ", x, y); a.panic = .3; if (typeof nameFor === "function") nameFor(a); if (i < r.bitten) { a.bitten = true; a.incT = rnd(60, 200); } if (outside) a.refCol = r.col + 1; }
  c.refugee = null; abandonCar(c, null);
}

/* ---------- внешнее оцепление и ультиматум ---------- */
// город проигрывает — федеральный центр закрывает все выезды своими войсками и даёт десять минут:
// известных зомби должно стать не больше тридцати. Иначе — зачистка
function stepFederal(dt) {
  const F = threat.fed;
  if (!F) {
    if (!((alert >= 4 && simT - alertT > 180) || hq.known >= 150) || simT < 300 || threat.fedDone) return;
    threat.fed = { t0: simT, deadline: simT + 600, target: 30, okT: 0, blocks: [], phase: "cordon" };
    const exits = RN.filter(n => n.exit);
    for (const n of exits) {
      const e = n.ed[0]; if (!e) continue;
      const en = { e: e.id, t: e.a === n ? Math.min(60, e.len / 2) : Math.max(e.len - 60, e.len / 2), dir: e.a === n ? -1 : 1, x: n.x, y: n.y, tx: 0, ty: 0, hw: e.hw };
      const bl = roadBlock(en, 0, { kind: "fed", noTent: true, fed: true, closeOut: true }, "fed"); if (!bl) continue; threat.fed.blocks.push(bl);
      // посты федеральных войск; их машина приезжает снаружи и уезжает
      const c = staffPost(bl, "army", 2, { fed: true });
      const lp = nearestLanePoint(n.x, n.y); if (lp) placeOnLane(c, lp.l, lp.s);
    }
    logE("Федеральный центр: город оцеплен, все выезды закрыты", "bad");
    radio("Федеральный центр: город оцеплен войсками. Если за десять минут известных заражённых не станет меньше тридцати — город будет зачищен");
    sfx.radio(); onBanner("Ультиматум: 10 минут"); return;
  }
  if (F.phase === "cordon") {
    const K = hq.known || 0;
    F.okT = K <= F.target ? F.okT + dt : 0;
    if (F.okT > 60) { F.phase = "lifting"; F.liftT = simT + 120; logE("Федеральный центр: угроза снята, зачистки не будет. Оцепление снимут через две минуты", "good"); radio("Федеральный центр: зачистка отменена, держите обстановку"); }
    else if (simT > F.deadline) {
      F.phase = "strike"; logE("Федеральный центр: ультиматум не выполнен, город зачищают", "bad"); radio("Федеральный центр: всем, кто слышит, — в укрытия. Удар через десять секунд");
      const cl = zCluster(); launchNuke(cl ? cl.x : W / 2, cl ? cl.y : H / 2);
    }
  } else if (F.phase === "strike" && nuke && nuke.over) { F.phase = "lifting"; F.liftT = simT + 60; }
  if (F.phase === "lifting" && simT > F.liftT) {
    for (const bl of F.blocks) liftBlock(bl, "fed");
    for (const a of agents) if (a.fed && a.state === "alive") { a.fed = false; a.order = null; a.withdraw = true; a.order = { x: a.x < W / 2 ? 12 : W - 12, y: clamp(a.y, 12, H - 12) }; }
    threat.fed = null; threat.fedDone = true; logE("Внешнее оцепление снято", "good");
  }
}
// строка часов: ультиматум и подходящие орды
// через сколько секунд орда будет у въезда: ещё не вышла из-за горизонта плюс путь полями
function hordeEta(h) {
  const en = entries[h.en]; if (!en) return 0;
  return Math.max(0, h.emergeT - simT) + Math.hypot(en.x - h.x, en.y - h.y) / (settings.fast ? 18 : 6);
}
function threatLabel() {
  if (!threat) return "";
  let s = "";
  if (threat.fed && threat.fed.phase === "cordon") { const left = Math.max(0, threat.fed.deadline - simT); s += ` · УЛЬТИМАТУМ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} · известно заражённых ${hq.known || 0}/${threat.fed.target}`; }
  const h = threat.hordes.find(h => !h.done); if (h) s += ` · орда ${compass(entries[h.en].x - W / 2, entries[h.en].y - H / 2)}: ${simT < h.emergeT ? "на подходе, около " + Math.round(h.n / 10) * 10 : h.left > 0 ? "выходит в поля" : "у города, " + (h.alive || 0)}`;
  return s;
}
