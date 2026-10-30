/* ---------- частицы: огонь, дым, кровь, пыль ---------- */
const smokeTex = canvasTex(128, 128, (g) => {
  for (let i = 0; i < 30; i++) { const x = 64 + rnd(-22, 22), y = 64 + rnd(-22, 22), r = rnd(16, 34), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
}, false);
function particleSystem(cap, additive, tex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 4), size = new Float32Array(cap);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 0 }, fogFar: { value: 1 } },
    vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; varying float vD; uniform float scale;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vC; varying float vD;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5; scene.add(pts);
  return { cap, pos, col, size, geo, mat, list: [], pts };
}
const PS_ADD = particleSystem(5000, true, glowTex), PS_SMOKE = particleSystem(5000, false, smokeTex);
// p: x,y,z, vx,vy,vz, l (жизнь), m (макс), s0,s1 (размер), c (цвет [r,g,b]), c1 (конечный цвет), a (непрозрачность), g (гравитация), dr (сопротивление)
let fxK = 1;
function emit(ps, p) { if (fxK < 1 && Math.random() > fxK) return; if (ps.list.length >= ps.cap) ps.list.shift(); p.m = p.l; ps.list.push(p); }
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function stepParticles(ps, dt) {
  let n = 0;
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i]; p.l -= dt;
    if (p.l <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
    p.vy -= (p.g || 0) * dt; const dr = 1 - Math.min(1, (p.dr || 0) * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < .2 && p.g > 0) { p.y = .2; p.vy *= -.2; p.vx *= .5; p.vz *= .5; }
  }
  for (const p of L) {
    const t = 1 - p.l / p.m, c = p.c1 ? lerpC(p.c, p.c1, t) : p.c;
    ps.pos[n * 3] = p.x; ps.pos[n * 3 + 1] = p.y; ps.pos[n * 3 + 2] = p.z;
    ps.col[n * 4] = c[0]; ps.col[n * 4 + 1] = c[1]; ps.col[n * 4 + 2] = c[2];
    ps.col[n * 4 + 3] = p.a * (p.fadeIn ? Math.min(1, t * 6) : 1) * (1 - t) ** (p.fp || 1);
    ps.size[n] = p.s0 + (p.s1 - p.s0) * t; n++;
  }
  ps.geo.setDrawRange(0, n);
  for (const k of ["position", "color", "size"]) ps.geo.attributes[k].needsUpdate = true;
}
const FIRE = [1.6, 1.0, .35], FIRE2 = [.8, .15, .02], SMK = [.05, .045, .04], SMK2 = [.22, .21, .2];
function fireParticle(x, y, z, k = 1) {
  emit(PS_ADD, { x: x + rnd(-2, 2) * k, y, z: z + rnd(-2, 2) * k, vx: rnd(-2, 2), vy: rnd(8, 18) * k, vz: rnd(-2, 2), l: rnd(.4, .9), s0: rnd(4, 8) * k, s1: 1, c: FIRE, c1: FIRE2, a: .9 });
}
function smokeParticle(x, y, z, k = 1, dark = true) {
  const wind = 4 + k * 2;
  emit(PS_SMOKE, { x: x + rnd(-2, 2) * k, y, z: z + rnd(-2, 2) * k, vx: rnd(-1.5, 1.5) + wind, vy: rnd(6, 12) * Math.sqrt(k), vz: rnd(-1.5, 1.5) + wind * .4, l: rnd(5, 9) * (k > 1 ? 1.4 : 1), s0: 6 * k, s1: rnd(30, 45) * k, c: dark ? SMK : SMK2, c1: SMK2, a: dark ? .8 : .4, fadeIn: true, dr: .05 });
}
function fxBlood(x, y, h, n) {
  h += gY(x, y);
  for (let i = 0; i < n; i++) emit(PS_SMOKE, { x: X(x), y: h, z: Z(y), vx: rnd(-8, 8), vy: rnd(0, 10), vz: rnd(-8, 8), l: rnd(.4, .8), s0: rnd(.8, 1.6), s1: .4, c: [.35, .02, .02], a: .95, g: 40, fp: .3 });
}
function fxHit(x, y, h, ang) {
  const dx = Math.cos(ang), dz = Math.sin(ang); h += gY(x, y);
  for (let i = 0; i < 10; i++) emit(PS_SMOKE, { x: X(x), y: h, z: Z(y), vx: dx * rnd(8, 25) + rnd(-5, 5), vy: rnd(-2, 8), vz: dz * rnd(8, 25) + rnd(-5, 5), l: rnd(.3, .7), s0: rnd(.6, 1.4), s1: .3, c: [.3, .03, .02], a: .95, g: 45, fp: .3 });
  emit(PS_SMOKE, { x: X(x), y: h, z: Z(y), vx: dx * 4, vy: 1, vz: dz * 4, l: .5, s0: 2, s1: 6, c: [.4, .05, .05], a: .4 });
}
function fxDebris(x, y) {
  const gy = gY(x, y);
  for (let i = 0; i < 14; i++) emit(PS_SMOKE, { x: X(x), y: gy + rnd(1, 5), z: Z(y), vx: rnd(-12, 12), vy: rnd(5, 20), vz: rnd(-12, 12), l: rnd(.8, 1.5), s0: rnd(.8, 1.8), s1: .6, c: [.32, .26, .18], a: 1, g: 40, fp: .2 });
  for (let i = 0; i < 6; i++) smokeParticle(X(x), gy + 2, Z(y), .5, false);
}

/* ---------- выстрелы: вспышки, трассеры, свет ---------- */
const TR_MAX = 400;
const trGeo = new THREE.BufferGeometry(), trPos = new Float32Array(TR_MAX * 6), trCol = new Float32Array(TR_MAX * 6);
trGeo.setAttribute("position", new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute("color", new THREE.BufferAttribute(trCol, 3));
const tracers = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
tracers.frustumCulled = false; scene.add(tracers);
let trList = [];
const lightPool = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xffb060, 0, 120, 2); scene.add(l); return { l, t: 0, k: 0 }; });
function flashLight(x, y, z, power, life, color = 0xffb060) {
  let best = lightPool[0];
  for (const p of lightPool) if (p.t <= 0) { best = p; break; } else if (p.t < best.t) best = p;
  best.l.position.set(x, y, z); best.l.color.setHex(color); best.l.distance = 40 + power * 30; best.k = power; best.t = life; best.m = life;
}
function fxShot(s, x1, y1, hit) {
  const m = s.muzzle || [X(s.x), 5.5 + gY(s.x, s.y), Z(s.y)], g1 = gY(x1, y1);
  trList.push({ a: m, b: [X(x1), g1 + (hit ? 4.5 : rnd(.3, 5)), Z(y1)], l: .07 });
  if (trList.length > TR_MAX) trList.shift();
  emit(PS_ADD, { x: m[0], y: m[1], z: m[2], vx: 0, vy: 0, vz: 0, l: .05, s0: s.role === "army" ? 5 : 3.5, s1: 2, c: [2, 1.5, .7], a: 1 });
  for (let i = 0; i < 3; i++) emit(PS_SMOKE, { x: m[0], y: m[1], z: m[2], vx: rnd(-1, 1), vy: rnd(1, 3), vz: rnd(-1, 1), l: rnd(.6, 1.2), s0: 1, s1: 4, c: SMK2, a: .25 });
  if (Math.random() < .5) flashLight(m[0], m[1] + 1, m[2], .8, .06, 0xffc070);
  if (!hit) {
    for (let i = 0; i < 4; i++) emit(PS_ADD, { x: X(x1), y: g1 + .5, z: Z(y1), vx: rnd(-10, 10), vy: rnd(4, 12), vz: rnd(-10, 10), l: rnd(.1, .25), s0: 1, s1: .3, c: [1.5, 1.1, .6], a: 1, g: 40 });
    emit(PS_SMOKE, { x: X(x1), y: g1 + .5, z: Z(y1), vx: 0, vy: 2, vz: 0, l: .8, s0: 1, s1: 4, c: [.45, .42, .38], a: .4 });
  }
}
function stepTracers(dt) {
  trList = trList.filter(t => (t.l -= dt) > 0);
  trList.forEach((t, i) => {
    trPos.set(t.a, i * 6); trPos.set(t.b, i * 6 + 3);
    const k = t.l / .07; trCol.set([1.6 * k, 1.3 * k, .6 * k, .5 * k, .35 * k, .1 * k], i * 6);
  });
  trGeo.setDrawRange(0, trList.length * 2);
  trGeo.attributes.position.needsUpdate = trGeo.attributes.color.needsUpdate = true;
  for (const p of lightPool) { p.t -= dt; p.l.intensity = p.t > 0 ? p.k * 3 * (p.t / p.m) : 0; }
}

/* ---------- взрывы ---------- */
const shockMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
let shocks = [], shake = 0;
function fxBoom(x, y, R) {
  const cx = X(x), cz = Z(y), k = R / 70, gy = gY(x, y);
  if (R >= 60) slowMo(1.4);
  flashLight(cx, gy + 20, cz, 6 * k, .9, 0xffa040);
  shake = Math.max(shake, 7 * k * clamp(1.4 - camDist() / 1400, .2, 1));
  for (let i = 0; i < 70 * k; i++) { const a = rnd(0, TAU), v = rnd(5, 40) * k; emit(PS_ADD, { x: cx, y: rnd(2, 10), z: cz, vx: Math.cos(a) * v, vy: rnd(10, 45) * k, vz: Math.sin(a) * v, l: rnd(.5, 1.3), s0: rnd(14, 26) * k, s1: 4, c: [2, 1.3, .5], c1: [.9, .2, .02], a: .95, dr: 1.6 }); }
  for (let i = 0; i < 90 * k; i++) { const a = rnd(0, TAU), v = rnd(4, 26) * k; emit(PS_SMOKE, { x: cx + Math.cos(a) * rnd(0, R * .3), y: rnd(3, 20), z: cz + Math.sin(a) * rnd(0, R * .3), vx: Math.cos(a) * v, vy: rnd(6, 26) * k, vz: Math.sin(a) * v, l: rnd(5, 11), s0: 10 * k, s1: rnd(40, 70) * k, c: [.07, .065, .06], c1: [.28, .26, .24], a: .75, fadeIn: true, dr: .7 }); }
  for (let i = 0; i < 60 * k; i++) { const a = rnd(0, TAU), v = rnd(20, 70) * k; emit(PS_SMOKE, { x: cx, y: 3, z: cz, vx: Math.cos(a) * v, vy: rnd(15, 60), vz: Math.sin(a) * v, l: rnd(1.5, 3), s0: rnd(1, 2.5), s1: 1, c: [.12, .1, .08], a: 1, g: 45, fp: .1 }); }
  for (let i = 0; i < 40 * k; i++) { const a = rnd(0, TAU), v = rnd(30, 90); emit(PS_ADD, { x: cx, y: 4, z: cz, vx: Math.cos(a) * v, vy: rnd(10, 50), vz: Math.sin(a) * v, l: rnd(.6, 1.4), s0: 1.3, s1: .4, c: [2, 1.4, .6], a: 1, g: 50 }); }
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), shockMat.clone());
  ring.position.set(cx, gy + 1.5, cz); scene.add(ring); shocks.push({ m: ring, t: 0, R: R * 2.2 });
}
function stepShocks(dt) {
  shocks = shocks.filter(s => {
    s.t += dt; const k = s.t / .55;
    if (k >= 1) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); return false; }
    s.m.scale.setScalar(s.R * Math.sqrt(k)); s.m.material.opacity = (1 - k) * .9; return true;
  });
}
function stepFires(dt) {
  // пожары на земле, горящие машины и дома дают огонь, дым и отсвет
  const lit = [];
  // струи воды из пожарных рукавов
  for (const a of agents) if (a.spray > 0 && a.state === "alive") {
    a.spray -= dt; const t = a.sprayAt; if (!t) continue;
    const sx = X(a.x) + Math.cos(a.dir) * 2, sz = Z(a.y) + Math.sin(a.dir) * 2, tx = X(t[0]), tz = Z(t[1]), ty = t[2] || 2, d = Math.hypot(tx - sx, tz - sz) || 1, T = clamp(d / 60, .3, 1.2);
    for (let i = 0; i < dt * 60; i++) emit(PS_SMOKE, { x: sx, y: 5, z: sz, vx: (tx - sx) / T + rnd(-4, 4), vy: (ty - 5) / T + 19.5 * T + rnd(-2, 2), vz: (tz - sz) / T + rnd(-4, 4), l: T, s0: 1.2, s1: 3.5, c: [.75, .85, .95], a: .55, g: 39 });
    if (Math.random() < dt * 6) emit(PS_SMOKE, { x: tx + rnd(-4, 4), y: ty, z: tz + rnd(-4, 4), vx: rnd(-2, 2), vy: rnd(6, 12), vz: rnd(-2, 2), l: rnd(2, 4), s0: 6, s1: 22, c: [.85, .86, .88], a: .35, fadeIn: true }); // пар
  }
  for (const a of agents) if (a.onFire > 0 && a.state !== "saved") { const h = gY(a.x, a.y) + (a.state === "dead" ? 1 : rnd(2, 7)); for (let i = 0; i < dt * 30; i++) fireParticle(X(a.x) + rnd(-1, 1), h, Z(a.y) + rnd(-1, 1), .35); if (Math.random() < dt * 3) smokeParticle(X(a.x), h + 3, Z(a.y), .3); }
  for (const f of fires) { const n = f.r / 6, fy = hasHills ? gY(f.x, f.y) : 0; for (let i = 0; i < n * dt * 30; i++) { const a = rnd(0, TAU), r = rnd(0, f.r); fireParticle(X(f.x + Math.cos(a) * r), fy + .5, Z(f.y + Math.sin(a) * r), 1); } if (Math.random() < dt * 8) smokeParticle(X(f.x + rnd(-f.r, f.r) * .5), fy + 4, Z(f.y + rnd(-f.r, f.r) * .5), 1.2); lit.push([X(f.x), fy + 8, Z(f.y), 2.5]); }
  for (const c of cars) if (c.burnT > 0) { const cy = gY(c.x, c.y); if (Math.random() < dt * 30) fireParticle(X(c.x) + rnd(-6, 6), cy + 5, Z(c.y) + rnd(-3, 3), .7); if (Math.random() < dt * 5) smokeParticle(X(c.x), cy + 8, Z(c.y), 1); lit.push([X(c.x), cy + 8, Z(c.y), 1.2]); }
  for (const b of buildings) if (b.fire > 0) {
    const w = b.x1 - b.x0, d = b.y1 - b.y0, top = b.h + (b.baseY || 0), by = b.baseY || 0;
    for (let i = 0; i < dt * 50; i++) fireParticle(X(rnd(b.x0 + 3, b.x1 - 3)), top + 1, Z(rnd(b.y0 + 3, b.y1 - 3)), 1.6);
    // языки пламени из окон
    for (let i = 0; i < dt * 14; i++) { const side = Math.floor(rnd(0, 4)), fl = by + Math.floor(rnd(0, b.floors)) * FLOOR + 6; const px = side < 2 ? rnd(b.x0, b.x1) : side === 2 ? b.x0 - 1 : b.x1 + 1, pz = side >= 2 ? rnd(b.y0, b.y1) : side === 0 ? b.y0 - 1 : b.y1 + 1; fireParticle(X(px), fl, Z(pz), .9); }
    for (let i = 0; i < dt * 14; i++) smokeParticle(X(rnd(b.x0, b.x1)), top + 4, Z(rnd(b.y0, b.y1)), 2.4);
    lit.push([X((b.x0 + b.x1) / 2), top + 10, Z((b.y0 + b.y1) / 2), 4]);
    applyScorch(b);
  }
  for (const b of buildings) { if (b.state !== "ok" || !(b.scorch > .2)) continue; applyScorch(b); if (b.gutted && b.gutT > 0 && dt && Math.random() < dt * 3) smokeParticle(X(rnd(b.x0, b.x1)), (b.baseY || 0) + b.h + 2, Z(rnd(b.y0, b.y1)), 1.6); }
  lit.sort((a, b) => b[3] - a[3]);
  for (let i = 0; i < Math.min(3, lit.length); i++) { const [x, y, z, k] = lit[i]; const p = lightPool[3 + i]; p.l.position.set(x, y, z); p.l.color.setHex(0xff7a2a); p.l.distance = 50 + k * 30; p.k = k * (.45 + Math.random() * .25); p.t = .2; p.m = .2; }
}

/* ---------- вертолёт эвакуации ---------- */
function buildHeli() {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0x3e4a38, roughness: .55, metalness: .3 }), dark = new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: .6, metalness: .5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: .05, metalness: .8 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(1, 20, 14).scale(10, 5, 5), body, 0, 6, 0);
  add(new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2).scale(5, 4, 4.6).rotateZ(-Math.PI / 2), glass, 5.5, 6.5, 0);
  add(new THREE.BoxGeometry(16, 1.6, 1.4), body, -16, 7.2, 0);
  add(new THREE.BoxGeometry(3, 5, .4), body, -23.5, 9.5, 0);
  add(new THREE.BoxGeometry(14, .5, .5), dark, 0, .4, -3.5); add(new THREE.BoxGeometry(14, .5, .5), dark, 0, .4, 3.5);
  for (const sx of [-4, 4]) for (const sz of [-3.5, 3.5]) add(new THREE.BoxGeometry(.4, 3, .4), dark, sx, 1.8, sz);
  add(new THREE.CylinderGeometry(.6, .6, 2.5, 8), dark, 0, 11.5, 0);
  const rotor = new THREE.Group(); rotor.position.set(0, 12.8, 0); g.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(22, .2, 1.4).translate(11, 0, 0), dark); b.rotation.y = i * Math.PI / 2; b.castShadow = true; rotor.add(b); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(22, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: .18, depthWrite: false })); rotor.add(disc);
  const tail = new THREE.Group(); tail.position.set(-23.5, 10, .6); g.add(tail);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(.2, 7, .9), dark); tail.add(tb);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); beacon.position.set(-8, 8.2, 0); g.add(beacon);
  g.userData = { rotor, tail, beacon };
  return g;
}
const heli = buildHeli(); heli.visible = false; scene.add(heli);
const padTex = canvasTex(256, 256, g => { g.strokeStyle = "#f2f2ee"; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.stroke(); g.fillStyle = "#f2f2ee"; g.font = "bold 150px Oswald, Arial, sans-serif"; g.textAlign = "center"; g.fillText("H", 128, 182); }, false);
const pad = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, opacity: .85 }));
pad.visible = false; pad.renderOrder = 2; scene.add(pad);
function updateHeli(dt) {
  if (!evac) { heli.visible = pad.visible = false; return; }
  heli.visible = pad.visible = !evac.leaving || evac.lt > 0;
  const padY = hasHills ? gY(evac.x, evac.y) : 0;
  pad.visible = !evac.leaving; pad.position.set(X(evac.x), padY + .2, Z(evac.y));
  heli.position.set(X(evac.hx), evac.alt + padY, Z(evac.hy));
  const yawT = -(evac.yaw || 0); let dy = yawT - heli.rotation.y; dy -= Math.round(dy / TAU) * TAU; heli.rotation.y += dy * Math.min(1, dt * 2);
  heli.rotation.z = evac.landed && !evac.leaving ? 0 : -.12;
  heli.userData.rotor.rotation.y += dt * 38; heli.userData.tail.rotation.z += dt * 60;
  heli.userData.beacon.visible = (simT * 1.5) % 1 < .2;
  if (evac.alt < 50) for (let i = 0; i < dt * 40; i++) { const a = rnd(0, TAU), r = rnd(18, 30); emit(PS_SMOKE, { x: heli.position.x + Math.cos(a) * r * .3, y: .8, z: heli.position.z + Math.sin(a) * r * .3, vx: Math.cos(a) * rnd(20, 40), vy: rnd(0, 3), vz: Math.sin(a) * rnd(20, 40), l: rnd(.8, 1.6), s0: 3, s1: 12, c: [.55, .5, .44], a: .25 * (1 - evac.alt / 50), fadeIn: true, dr: 1.5 }); }
}

/* ---------- штурмовик и бомба для авиаудара ---------- */
function buildJet() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x6c7378, roughness: .4, metalness: .6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 30, 10).rotateZ(Math.PI / 2), mat);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 10).rotateZ(-Math.PI / 2), mat); nose.position.x = 18.5;
  const wing = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(4, 0, 0), new THREE.Vector3(-6, 0, 16), new THREE.Vector3(-9, 0, 16), new THREE.Vector3(-6, 0, 0), new THREE.Vector3(4, 0, 0), new THREE.Vector3(-6, 0, -16), new THREE.Vector3(-9, 0, -16), new THREE.Vector3(-6, 0, 0)]).setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]), new THREE.MeshStandardMaterial({ color: 0x5d6468, side: THREE.DoubleSide, metalness: .5, roughness: .5 }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 6, .4), mat); fin.position.set(-12, 3.5, 0);
  for (const m of [body, nose, wing, fin]) { m.castShadow = true; g.add(m); }
  return g;
}
let jets = [];
function updateJets(dt) {
  for (const s of strikes) if (!s.jet) {
    const a = rnd(0, TAU); s.jet = { m: buildJet(), dx: Math.cos(a), dz: Math.sin(a), x: X(s.x), z: Z(s.y), age: 0, bomb: null, tx: s.x, ty: s.y };
    scene.add(s.jet.m); jets.push(s.jet); sfx.jet();
  }
  const ring = [];
  for (const s of strikes) ring.push(s);
  jets = jets.filter(j => {
    j.age += dt; const t = j.age - 3; // над целью через 3 с (бомба падает последнюю секунду)
    j.m.position.set(j.x + j.dx * t * 260, 160, j.z + j.dz * t * 260);
    j.m.rotation.y = -Math.atan2(j.dz, j.dx);
    if (t > -1.1 && !j.bomb) { j.bomb = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(.8, 4, 4, 8).rotateZ(Math.PI / 2) : new THREE.BoxGeometry(5, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x2e3328 })); scene.add(j.bomb); j.b0 = [...j.m.position.toArray()]; }
    if (j.bomb) { const k = clamp((t + 1.1) / 1.1); j.bomb.position.set(j.b0[0] + (j.x - j.b0[0]) * k, 160 * (1 - k * k), j.b0[2] + (j.z - j.b0[2]) * k); j.bomb.rotation.y = j.m.rotation.y; j.bomb.rotation.z = -k * 1.2; if (k >= 1) { scene.remove(j.bomb); j.bomb = null; j.b0 = null; j.bombDone = true; } }
    if (j.bombDone && j.bomb) { scene.remove(j.bomb); j.bomb = null; }
    if (j.age > 9) { scene.remove(j.m); return false; }
    return true;
  });
  // мигающая метка цели
  strikeMarks.visible = strikes.length > 0;
  if (strikes.length) { const s = strikes[0]; strikeMarks.position.set(X(s.x), gY(s.x, s.y) + .3, Z(s.y)); strikeMarks.material.opacity = .45 + .45 * Math.sin(simT * 14); }
}
const strikeMarks = new THREE.Mesh(new THREE.RingGeometry(66, 70, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, depthWrite: false, toneMapped: false }));
strikeMarks.visible = false; strikeMarks.renderOrder = 4; scene.add(strikeMarks);

/* ---------- время суток и погода ---------- */
// hour 0–24; солнце идёт по дуге, ночью светит луна; сумерки красят небо
const world = { hour: 13, target: 13, cycle: false, weather: "clear", season: "summer", wet: 0, rain: 0, fogK: 0, flash: 0, nextBolt: 8 };
const C_SKY = { day: [0x4f86c6, 0xd5e2ea], dusk: [0x2b3a66, 0xf0a060], night: [0x04060c, 0x121a2c] };
const starGeo = new THREE.BufferGeometry(), starPos = [];
for (let i = 0; i < 1600; i++) { const u = Math.random(), v = rnd(.08, 1), th = u * TAU, r = 8500; starPos.push(Math.cos(th) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(th) * Math.sqrt(1 - v * v) * r); }
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
scene.add(stars);
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1c8, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
sunDisc.scale.set(900, 900, 1); scene.add(sunDisc);
const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, "rgba(255,255,255,1)"], [.45, "rgba(235,240,255,1)"], [.52, "rgba(200,215,255,.25)"], [1, "rgba(200,215,255,0)"]]), color: 0xdfe8ff, fog: false, depthWrite: false, transparent: true }));
moonDisc.scale.set(360, 360, 1); scene.add(moonDisc);
// облака: плоские спрайты высоко над городом
const clouds = [];
for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: .5, fog: false })); s.position.set(rnd(-4000, 4000), rnd(900, 1300), rnd(-4000, 4000)); const k = rnd(700, 1500); s.scale.set(k, k * .45, 1); scene.add(s); clouds.push(s); }
// дождь: короткие штрихи вокруг камеры
const RAIN_N = 6000, rainPos = new Float32Array(RAIN_N * 6), rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8b8c8, transparent: true, opacity: .45, depthWrite: false }));
rain.frustumCulled = false; scene.add(rain);
const rainDrops = Array.from({ length: RAIN_N }, () => [rnd(-1, 1), rnd(0, 1), rnd(-1, 1)]);
let nightK = 0, carLightK = 0; // carLightK: водители включают ближний свет с ~17:00 и гасят около 7:00
const flashGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), 400);
flashGlow.count = 0; flashGlow.frustumCulled = false; flashGlow.renderOrder = 2; scene.add(flashGlow);
const _sd = new THREE.Vector3(), _lc1 = new THREE.Color(), _lc2 = new THREE.Color(), _lc3 = new THREE.Color();
function updateLighting(dt, simDt) {
  // время: цикл суток (24 ч за 12 минут игры) или плавный переход к выбранному часу
  if (world.cycle) { world.hour = (world.hour + simDt * (world.rate || 24 / 720)) % 24; world.target = world.hour; }
  else { let d = world.target - world.hour; if (Math.abs(d) > .01) world.hour += Math.sign(d) * Math.min(Math.abs(d), dt * 6); }
  const h = world.hour, el = Math.sin((h - 6) / 12 * Math.PI), az = (h - 6) / 12 * Math.PI;
  const day = clamp(el * 3 + .15), dusk = clamp(1 - Math.abs(el) * 4) * clamp(el * 6 + 1);
  nightK = 1 - clamp(el * 4 + .35); carLightK = clamp((.35 - el) / .3);
  settings.night = nightK > .5;
  // погода
  // зимой вместо дождя идёт снег (cozy.js), гроза становится метелью; в снегопад даль чуть в дымке
  const winter = world.season === "winter", wantRain = !winter && (world.weather === "rain" || world.weather === "storm") ? 1 : 0;
  const wantFog = world.weather === "fog" ? 1 : world.weather === "storm" ? .5 : world.weather === "snow" || (winter && world.weather === "rain") ? .35 : wantRain * .3;
  world.rain += (wantRain - world.rain) * Math.min(1, dt * .5); world.fogK += (wantFog - world.fogK) * Math.min(1, dt * .5);
  world.wet += ((wantRain ? 1 : 0) - world.wet) * Math.min(1, dt * (wantRain ? .15 : .03));
  const gloom = Math.max(world.rain * .55, world.fogK * .4);
  world.nukeGlow = Math.max(0, (world.nukeGlow || 0) - dt / 90); const ng = world.nukeGlow;
  settings.vis = 1 - world.fogK * .45 - world.rain * .15;
  // небо
  const top = _lc1.setHex(C_SKY.night[0]).lerp(_lc2.setHex(C_SKY.day[0]), day).lerp(_lc3.setHex(C_SKY.dusk[0]), dusk * .6);
  const bot = _lc2.setHex(C_SKY.night[1]).lerp(_lc3.setHex(C_SKY.day[1]), day);
  bot.lerp(_lc3.setHex(C_SKY.dusk[1]), dusk * .8);
  const grey = _lc3.setHex(0x6b7278).multiplyScalar(.25 + day * .75);
  skyU.top.value.copy(top).lerp(grey, gloom); skyU.bot.value.copy(bot).lerp(grey, gloom);
  if (ng > 0) { skyU.top.value.lerp(_lc3.setHex(0x5a3020), ng * .7); skyU.bot.value.lerp(_lc3.setHex(0xd06a30), ng * .8); }
  scene.fog.color.copy(skyU.bot.value).lerp(_lc1.setHex(0x9aa3aa).multiplyScalar(.2 + day * .8), world.fogK * .7);
  if (world.fogK > .05) { scene.fog.near = Math.min(scene.fog.near, 40 + (1 - world.fogK) * 600); scene.fog.far = Math.min(scene.fog.far, 300 + (1 - world.fogK) * 2400); }
  // солнце или луна
  _sd.set(-Math.cos(az) * .75, Math.max(.08, Math.abs(el)), -Math.sin(az) * .5 - .35).normalize();
  if (el < 0) _sd.set(Math.cos(az) * .6, .7, Math.sin(az) * .4 + .3).normalize(); // лунный свет с другой стороны
  sunDir.copy(_sd);
  sun.intensity = (2.5 * day * (1 - gloom * .7) + .28 * nightK) * (1 - world.fogK * .3);
  sun.color.setHex(0xfff2dc).lerp(_lc1.setHex(0xff9a50), dusk * .8).lerp(_lc2.setHex(0x8fa8ff), nightK);
  // рассеянный свет неба: отражённое небо приглушено к серому, поэтому тени подсвечиваем чуть сильнее, иначе асфальт в тени чёрный
  hemi.intensity = (.14 + .5 * day * (1 - gloom * .3) + gloom * .1) * (scene.environment ? .8 : 1);
  hemi.color.setHex(0xe4eaf2).lerp(_lc1.setHex(0x3a4a70), nightK);
  R3.toneMappingExposure = 1 - nightK * .05 + world.flash * 2;
  const sp = camera.position;
  sunDisc.position.set(sp.x - Math.cos(az) * 7000, Math.sin((h - 6) / 12 * Math.PI) * 6000, sp.z - Math.sin(az) * 4000 - 2500);
  sunDisc.material.opacity = clamp(el * 5 + .3) * (1 - gloom); sunDisc.material.color.setHex(0xfff1c8).lerp(_lc1.setHex(0xff8a40), dusk);
  moonDisc.position.set(sp.x + Math.cos(az) * 6000, Math.max(800, -el * 6000), sp.z + Math.sin(az) * 3000 + 2500);
  moonDisc.material.opacity = nightK * (1 - gloom);
  stars.position.copy(sp); stars.material.opacity = nightK * (1 - gloom) * .9;
  sky.position.set(sp.x, 0, sp.z); // купол едет за камерой: иначе на широкой карте его дальняя стенка уходит за дальность камеры и в небе чёрная дыра
  for (const c of clouds) { c.position.x += dt * 12; if (c.position.x > sp.x + 4500) c.position.x -= 9000; c.material.color.setRGB(.25 + day * .75, .25 + day * .72, .3 + day * .7).lerp(_lc1.setHex(0xff9a70), dusk * .5); c.material.opacity = .35 + gloom * .55; }
  // окна, фонари, мокрый асфальт
  const powerK = settings.dark ? 0 : 1;
  for (const m of facadeMats) m.emissiveIntensity = nightK * 1.1 * powerK;
  for (const m of glowSignMats) m.emissiveIntensity = nightK * .9 * powerK;
  if (lampHeads) { lampHeads.material.emissiveIntensity = nightK * 3 * powerK; lampPools.material.opacity = nightK * .5 * powerK; }
  if (settings.dark) { hemi.intensity *= .6; sun.intensity *= .8; }
  ground.material.roughness = .93 - world.wet * .55; ground.material.color.setScalar(1 - world.wet * .3);
  // молнии в грозу
  world.flash = clamp(world.flash - Math.max(0, dt) * 4, 0, 1.5);
  if (world.weather === "storm" && !winter) { world.nextBolt -= dt; if (world.nextBolt <= 0) { world.nextBolt = rnd(5, 16); world.flash = .9; sfx.thunder(); } }
  // капли
  rain.visible = world.rain > .02;
  if (rain.visible) {
    const R = 260, top2 = 220, cx = camC.tx, cz = camC.tz, len = 9;
    for (let i = 0; i < RAIN_N; i++) {
      const d = rainDrops[i]; d[1] -= dt * 2.6; if (d[1] < 0) { d[1] += 1; d[0] = rnd(-1, 1); d[2] = rnd(-1, 1); }
      const x = cx + d[0] * R, y = d[1] * top2, z = cz + d[2] * R;
      rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z; rainPos[i * 6 + 3] = x + 1.5; rainPos[i * 6 + 4] = y + len; rainPos[i * 6 + 5] = z + .6;
    }
    rainGeo.setDrawRange(0, Math.floor(RAIN_N * world.rain) * 2); rainGeo.attributes.position.needsUpdate = true;
    rain.material.opacity = .35 + nightK * .1;
  }
  // фонари силовиков ночью
  let n = 0;
  if (nightK > .05) for (const a of agents) if (a.state === "alive" && (a.role === "army" || a.role === "police") && n < 400) {
    _p.makeScale(34, 1, 34).setPosition(X(a.x) + Math.cos(a.dir) * 14, gY(a.x, a.y) + .2, Z(a.y) + Math.sin(a.dir) * 14); flashGlow.setMatrixAt(n++, _p);
  }
  flashGlow.count = n; flashGlow.material.opacity = nightK * .55; flashGlow.instanceMatrix.needsUpdate = true;
}
function hourLabel() { const h = Math.floor(world.hour), m = Math.floor((world.hour % 1) * 60); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }

/* ---------- обгорание: фасад темнеет по степени, остов чёрный с потухшими окнами ---------- */
const _scD = new THREE.Color(0x2a2522);
function applyScorch(b) {
  const want = b.gutted ? 1 : clamp((b.scorch - .2) / .6);
  if (want < .05 || Math.abs((b.scorchK || 0) - want) < .15) return;
  b.scorchK = want;
  if (!b.scorched) { b.scorched = true; detachBuilding(b); b.mesh.userData.orig = b.mesh.userData.orig || b.mesh.material; b.mesh.material = (Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material]).map(mm => mm.clone()); }
  const orig = Array.isArray(b.mesh.userData.orig) ? b.mesh.userData.orig : [b.mesh.userData.orig];
  (Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material]).forEach((c, i) => { const o = orig[Math.min(i, orig.length - 1)]; c.color = (o.color ? o.color.clone() : new THREE.Color(0xffffff)).lerp(_scD, want); c.emissive = new THREE.Color(0); c.emissiveIntensity = 0; });
  if (b.antenna) b.antenna.visible = want < .7; if (b.sign) b.sign.visible = want < .7;
}
