/* ---------- отряды: держатся вместе, занимают перекрёстки, наступают и отходят ---------- */
let squads = new Map(), squadSeq = 0, squadT = 0;
function squadOf(a) { return a.squad ? squads.get(a.squad) : null; }
function newSquad(members) {
  const id = ++squadSeq, s = { id, members: members.map(m => m.id), leader: members[0].id, state: "hold", holdAt: null, holdT: 0, regroupT: 0, slots: [] };
  for (const m of members) m.squad = id;
  squads.set(id, s); return s;
}
// одиночные солдаты без приказа сбиваются в отряды по соседству
function assignSquads() {
  const loose = agents.filter(a => a.state === "alive" && a.role === "army" && !a.squad && !a.order && !a.post && !a.withdraw);
  while (loose.length) {
    const seed = loose.shift(), group = [seed];
    for (let i = loose.length - 1; i >= 0; i--) if (Math.hypot(loose[i].x - seed.x, loose[i].y - seed.y) < 40 && group.length < 10) group.push(loose.splice(i, 1)[0]);
    newSquad(group);
  }
}
function nearestCrossing(x, y, maxD, except) {
  let best = null, bd = maxD;
  for (const c of crossings) { if (c === except) continue; const d = Math.hypot(c.x - x, c.y - y); if (d < bd && cellAt(c.x, c.y) === 0) { bd = d; best = c; } }
  return best;
}
function stepSquads(dt) {
  squadT -= dt; if (squadT > 0) return; squadT = 2;
  assignSquads();
  for (const [id, s] of squads) {
    s.members = s.members.filter(mid => { const m = agentById(mid); return m && m.state === "alive" && m.role === "army" && m.squad === id && !m.withdraw; });
    if (!s.members.length) { squads.delete(id); continue; }
    // малый отряд рядом с другим вливается в него
    if (s.members.length <= 4) {
      const me = agentById(s.leader) || agentById(s.members[0]);
      let host = null;
      for (const [oid, o] of squads) { if (oid === id || o.members.length + s.members.length > 10) continue; const ol = agentById(o.leader); if (ol && me && Math.hypot(ol.x - me.x, ol.y - me.y) < 70) { host = o; break; } }
      if (host) { for (const mid of s.members) { const m = agentById(mid); if (m) { m.squad = host.id; host.members.push(mid); } } squads.delete(id); continue; }
    }
    let L = agentById(s.leader);
    if (!L || L.state !== "alive" || L.squad !== id) { L = s.members.map(agentById).sort((p, q) => q.hp - p.hp)[0]; s.leader = L.id; }
    // где зомби: по полю расстояний от командира
    const fv = fieldVal(fZ, L.x, L.y), zDist = fv >= FAR ? 1e9 : fv * CS;
    let close = 0, ammo = 0; nearZ(L.x, L.y, 26, () => close++); for (const mid of s.members) { const m = agentById(mid); if (m) ammo += m.mag + m.ammo; }
    const alive = s.members.length;
    if (s.regroupT > 0) { s.regroupT -= 2; if (s.regroupT <= 0) s.state = "hold"; continue; }
    if (close >= 4 && (alive < 4 || ammo < alive * 12)) { s.state = "regroup"; s.regroupT = 8; logT("regroup", "Отряд отходит и перегруппировывается", "", 25); continue; }
    if (zDist < 360 || close) { s.state = "advance"; continue; }
    // спокойно: занять ближайший перекрёсток, раз в полторы минуты сменить
    s.holdT -= 2;
    if (s.state !== "hold" || !s.holdAt || s.holdT <= 0) {
      const c = nearestCrossing(L.x, L.y, s.holdAt ? 220 : 260, s.holdAt && s.holdT <= 0 ? s.holdAt : null) || s.holdAt || { x: L.x, y: L.y };
      s.holdAt = c; s.holdT = rnd(80, 120); s.state = "hold";
    }
  }
}
// позиция бойца в строю: клин за командиром или кольцо на перекрёстке
function squadSlot(s, a) {
  const idx = Math.max(0, s.members.indexOf(a.id)), L = agentById(s.leader);
  if (s.state === "hold" && s.holdAt) { const n = Math.max(1, s.members.length), ang = idx / n * TAU; let sx = s.holdAt.x + Math.cos(ang) * 9, sy = s.holdAt.y + Math.sin(ang) * 9; if (blocked(sx, sy)) [sx, sy] = freeNear(sx, sy, 8); return [sx, sy, ang]; }
  if (!L) return [a.x, a.y, a.dir];
  const k = idx === 0 ? 0 : idx, side = k % 2 ? 1 : -1, row = Math.ceil(k / 2);
  const bx = Math.cos(L.dir), by = Math.sin(L.dir), ox = -bx * row * 5 + (-by) * side * row * 3.5, oy = -by * row * 5 + bx * side * row * 3.5;
  let sx = L.x + ox, sy = L.y + oy; if (blocked(sx, sy)) { sx = L.x - bx * row * 4; sy = L.y - by * row * 4; if (blocked(sx, sy)) { sx = L.x; sy = L.y; } }
  return [sx, sy, L.dir];
}
// вызывается из поведения солдата, когда рядом нет видимого зомби
function squadMove(a, dt, zn, zd) {
  const s = squadOf(a); if (!s) return null;
  if (s.state === "regroup") { const d = fieldDir(fZ, a.x, a.y, true); return d ? [d[0], d[1], 10] : null; }
  if (s.state === "advance") {
    if (a.id === s.leader) { const d = fieldDir(fZ, a.x, a.y, false); return d ? [d[0], d[1], 9] : null; }
    const [sx, sy] = squadSlot(s, a), d = Math.hypot(sx - a.x, sy - a.y);
    if (d > 5) return goTo(a, sx, sy, d > 18 ? 11 : 9);
    return [0, 0, 0];
  }
  // hold: занять место и смотреть наружу
  const [sx, sy, ang] = squadSlot(s, a), d = Math.hypot(sx - a.x, sy - a.y);
  if (d > 2.5) return goTo(a, sx, sy, 8);
  let dd = ang - a.dir; dd -= Math.round(dd / TAU) * TAU; a.dir += dd * Math.min(1, dt * 2);
  return [0, 0, 0];
}
function resetSquads() { squads = new Map(); squadSeq = 0; squadT = 5; }
