/* ---------- частицы: огонь, дым, кровь, пыль ---------- */
const smokeTex = canvasTex(128, 128, (g) => {
  for (let i = 0; i < 30; i++) { const x = 64 + rnd(-22, 22), y = 64 + rnd(-22, 22), r = rnd(16, 34), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
}, false);
// языки пламени: атлас 2×2 из четырёх разных языков, белые с прозрачностью; цвет и мерцание даёт шейдер
const flameTex = canvasTex(256, 256, (g) => {
  g.globalCompositeOperation = "lighter";
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 128, oy = Math.floor(q / 2) * 128, lean = rnd(-6, 6);
    for (let i = 0; i < 26; i++) {
      const t = i / 25, w = 30 * (1 - t) ** .8 + 3, cx = ox + 64 + lean * t * t + Math.sin(t * 7 + q) * 5 * t, cy = oy + 116 - t * 104;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, w); gr.addColorStop(0, `rgba(255,255,255,${.22 * (1 - t * .7)})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(ox, oy, 128, 128);
    }
    // отдельный язычок сбоку
    for (let i = 0; i < 8; i++) { const t = i / 7, cx = ox + 64 + (q % 2 ? 1 : -1) * (14 + t * 10), cy = oy + 92 - t * 46, w = 11 * (1 - t) + 2, gr = g.createRadialGradient(cx, cy, 0, cx, cy, w); gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(ox, oy, 128, 128); }
  }
}, false);
// flame: у частицы есть зерно — им выбирается язык из атласа, фаза мерцания и колыхания
function particleSystem(cap, additive, tex, flame) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 4), size = new Float32Array(cap), seed = flame ? new Float32Array(cap) : null;
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  if (flame) geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 600 }, time: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 0 }, fogFar: { value: 1 } },
    vertexShader: flame ? `attribute float size; attribute vec4 color; attribute float seed; varying vec4 vC; varying vec2 vO; uniform float scale, time;
      void main(){ vC = color; vC.rgb *= .78 + .22 * sin(time * 23. + seed * 61.) + .1 * sin(time * 41. + seed * 17.);
        vO = vec2(mod(floor(seed * 4.), 2.), floor(mod(seed * 4., 4.) / 2.)) * .5;
        vec3 p = position; p.x += sin(time * 7. + seed * 40.) * size * .06; p.z += cos(time * 6. + seed * 23.) * size * .05;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`
      : `attribute float size; attribute vec4 color; varying vec4 vC; varying float vD; uniform float scale;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: flame ? `uniform sampler2D map; varying vec4 vC; varying vec2 vO;
      void main(){ vec2 uv = vec2(gl_PointCoord.x, 1. - gl_PointCoord.y) * .5 + vO; float a = texture2D(map, uv).a;
        gl_FragColor = vec4(vC.rgb * (.5 + a * .9), vC.a * a); }`
      : `uniform sampler2D map; varying vec4 vC; varying float vD;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5; scene.add(pts);
  return { cap, pos, col, size, seed, geo, mat, list: [], pts };
}
const PS_ADD = particleSystem(5000, true, glowTex), PS_SMOKE = particleSystem(5000, false, smokeTex), PS_FLAME = particleSystem(3000, true, flameTex, true);
// p: x,y,z, vx,vy,vz, l (жизнь), m (макс), s0,s1 (размер), c (цвет [r,g,b]), c1 (конечный цвет), a (непрозрачность), g (гравитация), dr (сопротивление),
// dl (задержка: частица ещё не видна и стоит), wb (угли: блуждают в стороны), sd (зерно языка пламени)
let fxK = 1;
function emit(ps, p) { if (fxK < 1 && Math.random() > fxK) return; if (ps.list.length >= ps.cap) ps.list.shift(); p.m = p.l; ps.list.push(p); }
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function stepParticles(ps, dt) {
  let n = 0;
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i];
    if (p.dl > 0) { p.dl -= dt; continue; }
    p.l -= dt;
    if (p.l <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
    p.vy -= (p.g || 0) * dt; const dr = 1 - Math.min(1, (p.dr || 0) * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
    if (p.wb) { p.vx += (Math.random() - .5) * p.wb * dt; p.vz += (Math.random() - .5) * p.wb * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < .2 && p.g > 0) { p.y = .2; p.vy *= -.2; p.vx *= .5; p.vz *= .5; }
  }
  for (const p of L) {
    if (p.dl > 0) continue;
    const t = 1 - p.l / p.m, c = p.c1 ? lerpC(p.c, p.c1, t) : p.c;
    ps.pos[n * 3] = p.x; ps.pos[n * 3 + 1] = p.y; ps.pos[n * 3 + 2] = p.z;
    ps.col[n * 4] = c[0]; ps.col[n * 4 + 1] = c[1]; ps.col[n * 4 + 2] = c[2];
    ps.col[n * 4 + 3] = p.a * (p.fadeIn ? Math.min(1, t * 6) : 1) * (1 - t) ** (p.fp || 1);
    ps.size[n] = p.s0 + (p.s1 - p.s0) * t;
    if (ps.seed) ps.seed[n] = p.sd || 0;
    n++;
  }
  ps.geo.setDrawRange(0, n);
  for (const k of ["position", "color", "size"]) ps.geo.attributes[k].needsUpdate = true;
  if (ps.seed) { ps.geo.attributes.seed.needsUpdate = true; ps.mat.uniforms.time.value = (ps.mat.uniforms.time.value + dt) % 1000; }
}
const FIRE = [1.6, 1.0, .35], FIRE2 = [.8, .15, .02], SMK = [.05, .045, .04], SMK2 = [.22, .21, .2];
const FL0 = [1.15, .62, .18], FL1 = [.7, .14, .02], EMB = [1.6, .6, .12], EMB2 = [.5, .08, 0];
// язык пламени: рождается у основания широким и жёлтым, вытягивается вверх, сужается и краснеет; изредка — уголёк или искра
function fireParticle(x, y, z, k = 1) {
  emit(PS_FLAME, { x: x + rnd(-2, 2) * k, y: y + rnd(0, 2) * k, z: z + rnd(-2, 2) * k, vx: rnd(-1.5, 1.5), vy: rnd(6, 13) * Math.sqrt(k), vz: rnd(-1.5, 1.5), l: rnd(.4, .9), s0: rnd(8, 16) * k, s1: rnd(2, 5) * k, c: FL0, c1: FL1, a: .6, fp: .8, sd: Math.random() });
  if (Math.random() < .25) emit(PS_ADD, { x: x + rnd(-2, 2) * k, y: y + 2 * k, z: z + rnd(-2, 2) * k, vx: 0, vy: rnd(2, 5) * k, vz: 0, l: rnd(.3, .5), s0: 13 * k, s1: 6 * k, c: [1, .42, .08], a: .22 }); // жар у основания
  if (Math.random() < .06) emberParticle(x, y + 3 * k, z, k);
}
// уголёк: тлеет, медленно поднимается с горячим воздухом и блуждает
function emberParticle(x, y, z, k = 1) {
  emit(PS_ADD, { x: x + rnd(-3, 3) * k, y, z: z + rnd(-3, 3) * k, vx: rnd(-2, 2), vy: rnd(6, 16) * Math.sqrt(k), vz: rnd(-2, 2), l: rnd(1.5, 3.5), s0: rnd(.7, 1.4), s1: .3, c: EMB, c1: EMB2, a: 1, dr: .6, wb: 30, fp: .5 });
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
// ударная волна по земле: кольцо из постоянного пула (материалы созданы один раз, свободные кольца не рисуются)
const shockTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.55, "rgba(255,255,255,.06)"); gr.addColorStop(.84, "rgba(255,255,255,.85)"); gr.addColorStop(.92, "rgba(255,255,255,.3)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false);
const shockGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const shocks = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ map: shockTex, color: 0xffd6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.visible = false; m.renderOrder = 4; m.frustumCulled = false; scene.add(m); return { m, t: 0, life: 1, R: 1, op: 1 }; });
let shake = 0;
function addShock(x, y, z, R, life, color, op) {
  let s = shocks[0]; for (const q of shocks) { if (!q.m.visible) { s = q; break; } if (q.t / q.life > s.t / s.life) s = q; }
  s.m.position.set(x, y, z); s.m.material.color.setHex(color); s.m.visible = true; s.t = 0; s.life = life; s.R = R; s.op = op; s.m.scale.setScalar(.01);
}
function stepShocks(dt) {
  for (const s of shocks) {
    if (!s.m.visible) continue;
    s.t += dt; const k = s.t / s.life;
    if (k >= 1) { s.m.visible = false; continue; }
    s.m.scale.setScalar(s.R * (1 - (1 - k) ** 3)); s.m.material.opacity = (1 - k) ** 1.6 * s.op;
  }
}
// сила взрыва: растяжка, мина, снаряд, машина — граната — бензовоз и заправка — авиабомба — метеорит
// fb: огненный шар, sm: дым (dark — чёрный от горючего), dust: пыль по земле, sp: искры, ch: глыбы земли и асфальта, fl: вспышка экспозиции
const BOOM = {
  small: { fb: .8, sm: .6, dust: .6, sp: 26, ch: 0, fl: 0, life: .8, smk: [.16, .15, .14] },
  car: { fb: 1.1, sm: 1, dust: .7, sp: 50, ch: 4, fl: 0, life: 1, dark: true, smk: [.06, .055, .05] },
  grenade: { fb: 1, sm: .9, dust: 1, sp: 60, ch: 6, fl: .05, life: .9, smk: [.2, .19, .17] },
  fuel: { fb: 1.9, sm: 1.4, dust: .7, sp: 70, ch: 6, fl: .22, life: 1.8, dark: true, rise: 1.6, smk: [.05, .045, .04] },
  bomb: { fb: 1, sm: 1.1, dust: 1.5, sp: 110, ch: 34, fl: .3, life: 1, rise: 1, smk: [.27, .24, .2] },
  meteor: { fb: 1.2, sm: 1.2, dust: 1.6, sp: 160, ch: 60, fl: .5, life: 1.3, rise: 1.3, smk: [.25, .22, .19] },
};
function boomKind(R, big) { return R >= 100 ? "meteor" : big && R >= 70 ? "bomb" : big ? "fuel" : R >= 40 ? "grenade" : R >= 30 ? "car" : "small"; }
const DIRT = ["#4a4038", "#3b3530", "#5a5047", "#2e2c2a", "#6a5e50"];
function fxBoom(x, y, R, big) {
  const cx = X(x), cz = Z(y), k = R / 70, gy = gY(x, y), P = BOOM[boomKind(R, big)], sk = Math.sqrt(k), rise = P.rise || 0;
  if (R >= 60) slowMo(1.4);
  // вспышка: короткий белый свет, потом оранжевый отсвет; у больших — засветка кадра
  flashLight(cx, gy + 8 + R * .15, cz, 9 * k, .16, 0xfff0d8);
  flashLight(cx, gy + 14 + R * .25, cz, 4.5 * k * P.fb, .6 + P.life * .6, 0xff8a30);
  if (P.fl) world.flash = Math.max(world.flash, P.fl);
  shake = Math.max(shake, 7 * k * clamp(1.4 - camDist() / 1400, .2, 1));
  emit(PS_ADD, { x: cx, y: gy + 3 + R * .08, z: cz, vx: 0, vy: 0, vz: 0, l: .1, s0: R * .75, s1: R * 1.1, c: [2.2, 1.9, 1.5], a: 1 });
  // огненный шар: клубы рвутся наружу, вязнут в воздухе и всплывают, остывая от бело-жёлтого к тёмно-красному
  const nb = Math.max(8, 42 * k * P.fb);
  for (let i = 0; i < nb; i++) {
    const a = rnd(0, TAU), u = rnd(-.2, 1), r = Math.sqrt(1 - u * u), v = rnd(.5, 1.2) * R * 1.1, hot = Math.random() < .3;
    emit(PS_ADD, { x: cx + Math.cos(a) * r * R * .08, y: gy + 2 + u * R * .1, z: cz + Math.sin(a) * r * R * .08, vx: Math.cos(a) * r * v, vy: u * v * .7 + R * .15 * (1 + rise), vz: Math.sin(a) * r * v, l: rnd(.8, 1.5) * P.life, s0: R * rnd(.24, .34), s1: R * rnd(.42, .6), c: hot ? [1.7, 1.05, .38] : [1.5, .55, .1], c1: [.4, .06, .01], a: .42, dr: 3.4, g: -R * .3 * (1 + rise), fp: 1.2 });
  }
  // огонь темнеет в дым: клубы появляются там же с задержкой, сначала бурые от жара, потом серые или чёрные
  const ns = 60 * k * P.sm;
  for (let i = 0; i < ns; i++) {
    const a = rnd(0, TAU), r = rnd(0, R * .3), dl = rnd(.12, .55) * P.life, up = rnd(.12, .35) * R * (1 + rise * .6);
    emit(PS_SMOKE, { x: cx + Math.cos(a) * r, y: gy + rnd(.05, .3) * R * (1 + rise * .5), z: cz + Math.sin(a) * r, vx: Math.cos(a) * rnd(2, 10) * k, vy: up, vz: Math.sin(a) * rnd(2, 10) * k, dl, l: rnd(5, 10) * (P.dark ? 1.3 : 1), s0: R * .25, s1: R * rnd(.8, 1.2) * (1 + rise * .3), c: [.3, .14, .06], c1: P.smk, a: P.dark ? .9 : .78, fadeIn: true, dr: .45 });
  }
  // гриб: у больших столб дыма поднимается и расползается шапкой
  if (rise) for (let i = 0; i < 14 * k; i++) { const a = rnd(0, TAU), t = i / (14 * k); emit(PS_SMOKE, { x: cx + Math.cos(a) * R * .1, y: gy + R * .3, z: cz + Math.sin(a) * R * .1, vx: Math.cos(a) * R * .12 * t, vy: R * (.45 + .4 * (1 - t)) * rise, vz: Math.sin(a) * R * .12 * t, dl: .3 + t * .5, l: rnd(7, 12), s0: R * .3, s1: R * (.8 + t * .5), c: [.35, .17, .07], c1: P.smk, a: .75, fadeIn: true, dr: .8 }); }
  // пыль по земле: кольцо катится наружу и оседает
  const nd = 34 * k * P.dust;
  for (let i = 0; i < nd; i++) { const a = rnd(0, TAU), v = R * rnd(1.2, 2.2); emit(PS_SMOKE, { x: cx + Math.cos(a) * R * .15, y: gy + rnd(1, 3), z: cz + Math.sin(a) * R * .15, vx: Math.cos(a) * v, vy: rnd(1, 6), vz: Math.sin(a) * v, l: rnd(1.8, 3.6), s0: R * .12, s1: R * rnd(.35, .55), c: [.46, .42, .36], c1: [.55, .52, .47], a: .5, fadeIn: true, dr: 2.4 }); }
  // мелкий сор: падает по дугам
  for (let i = 0; i < 26 * k; i++) { const a = rnd(0, TAU), v = rnd(20, 60) * k; emit(PS_SMOKE, { x: cx, y: gy + 3, z: cz, vx: Math.cos(a) * v, vy: rnd(15, 55), vz: Math.sin(a) * v, l: rnd(1.5, 3), s0: rnd(.8, 2), s1: .8, c: [.12, .1, .08], a: 1, g: 45, fp: .1 }); }
  addShock(cx, gy + 1.2, cz, R * 2.3, .5, 0xffd6a0, .95);
  if (R >= 45) addShock(cx, gy + .8, cz, R * 3.2, 1.1, 0xb8a890, .35); // вслед — пылевой вал
  fxBoomMore(x, y, cx, gy, cz, R, k, P); // искры, глыбы, подпалина, стёкла — render22.js
}
function stepFires(dt) {
  // пожары на земле, горящие машины и дома дают огонь, дым и отсвет
  const lit = [];
  // струи воды из пожарных рукавов
  for (const a of agents) if (a.spray > 0 && a.state === "alive") {
    a.spray -= dt; const t = a.sprayAt; if (!t) continue;
    const sx = X(a.x) + Math.cos(a.dir) * 2, sz = Z(a.y) + Math.sin(a.dir) * 2, tx = X(t[0]), tz = Z(t[1]), sy = gY(a.x, a.y) + 5, ty = (t[2] || 2) + gY(t[0], t[1]), d = Math.hypot(tx - sx, tz - sz) || 1, T = clamp(d / 60, .3, 1.2);
    for (let i = 0; i < dt * 60; i++) emit(PS_SMOKE, { x: sx, y: sy, z: sz, vx: (tx - sx) / T + rnd(-4, 4), vy: (ty - sy) / T + 19.5 * T + rnd(-2, 2), vz: (tz - sz) / T + rnd(-4, 4), l: T, s0: 1.2, s1: 3.5, c: [.75, .85, .95], a: .55, g: 39 });
    if (Math.random() < dt * 6) emit(PS_SMOKE, { x: tx + rnd(-4, 4), y: ty, z: tz + rnd(-4, 4), vx: rnd(-2, 2), vy: rnd(6, 12), vz: rnd(-2, 2), l: rnd(2, 4), s0: 6, s1: 22, c: [.85, .86, .88], a: .35, fadeIn: true }); // пар
  }
  for (const a of agents) if (a.onFire > 0 && a.state !== "saved") { const h = gY(a.x, a.y) + (a.state === "dead" ? 1 : rnd(2, 7)); for (let i = 0; i < dt * 30; i++) fireParticle(X(a.x) + rnd(-1, 1), h, Z(a.y) + rnd(-1, 1), .35); if (Math.random() < dt * 3) smokeParticle(X(a.x), h + 3, Z(a.y), .3); }
  for (const f of fires) { const n = f.r / 6, fy = hasHills ? gY(f.x, f.y) : 0; for (let i = 0; i < n * dt * 30; i++) { const a = rnd(0, TAU), r = rnd(0, f.r); fireParticle(X(f.x + Math.cos(a) * r), fy + .5, Z(f.y + Math.sin(a) * r), 1); } if (Math.random() < dt * 8) smokeParticle(X(f.x + rnd(-f.r, f.r) * .5), fy + 4, Z(f.y + rnd(-f.r, f.r) * .5), 1.2); if (Math.random() < dt * 5 * n) fxCoals(X(f.x), fy, Z(f.y), f.r * .8, 1); lit.push([X(f.x), fy + 8, Z(f.y), 2.5]); }
  for (const c of cars) if (c.burnT > 0) { const cy = gY(c.x, c.y); if (Math.random() < dt * 30) fireParticle(X(c.x) + rnd(-6, 6), cy + 5, Z(c.y) + rnd(-3, 3), .7); if (Math.random() < dt * 5) smokeParticle(X(c.x), cy + 8, Z(c.y), 1); if (Math.random() < dt * .4) sparkBurst(X(c.x), cy + 5, Z(c.y), 10, 28, .9, .9, cy); lit.push([X(c.x), cy + 8, Z(c.y), 1.2]); }
  for (const b of buildings) if (b.fire > 0) {
    const w = b.x1 - b.x0, d = b.y1 - b.y0, top = b.h + (b.baseY || 0), by = b.baseY || 0;
    for (let i = 0; i < dt * 50; i++) fireParticle(X(rnd(b.x0 + 3, b.x1 - 3)), top + 1, Z(rnd(b.y0 + 3, b.y1 - 3)), 1.6);
    // языки пламени из окон
    for (let i = 0; i < dt * 14; i++) { const side = Math.floor(rnd(0, 4)), fl = by + Math.floor(rnd(0, b.floors)) * FLOOR + 6; const px = side < 2 ? rnd(b.x0, b.x1) : side === 2 ? b.x0 - 1 : b.x1 + 1, pz = side >= 2 ? rnd(b.y0, b.y1) : side === 0 ? b.y0 - 1 : b.y1 + 1; fireParticle(X(px), fl, Z(pz), .9); }
    for (let i = 0; i < dt * 14; i++) smokeParticle(X(rnd(b.x0, b.x1)), top + 4, Z(rnd(b.y0, b.y1)), 2.4);
    for (let i = 0; i < dt * 8; i++) emberParticle(X(rnd(b.x0, b.x1)), top + 3, Z(rnd(b.y0, b.y1)), 1.6);
    lit.push([X((b.x0 + b.x1) / 2), top + 10, Z((b.y0 + b.y1) / 2), 4]);
    applyScorch(b);
  }
  for (const b of buildings) { if (b.state !== "ok" || !(b.scorch > .2)) continue; applyScorch(b); if (b.gutted && b.gutT > 0 && dt && Math.random() < dt * 3) smokeParticle(X(rnd(b.x0, b.x1)), (b.baseY || 0) + b.h + 2, Z(rnd(b.y0, b.y1)), 1.6); }
  lit.sort((a, b) => b[3] - a[3]);
  // свет пожара дышит: два медленных колебания и мелкая дрожь, а не случайный скачок каждый кадр
  const ft = performance.now() / 1000;
  for (let i = 0; i < Math.min(3, lit.length); i++) { const [x, y, z, k] = lit[i]; const p = lightPool[3 + i]; p.l.position.set(x, y, z); p.l.color.setHex(0xff7a2a); p.l.distance = 50 + k * 30; p.k = k * (.56 + .1 * Math.sin(ft * 9.3 + i * 2.1) + .07 * Math.sin(ft * 23.1 + i) + Math.random() * .05); p.t = .2; p.m = .2; }
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
// дождь: штрихи в цилиндре между камерой и точкой, куда она смотрит; с отдалением цилиндр шире, штрихи длиннее,
// к краю цилиндра гаснут — сверху дождь читается пеленой над городом, а не столбом посреди сухих улиц. Штрих светлее внизу,
// в грозу косой от ветра. Все капли — один вызов отрисовки
const RAIN_N = 9000, rainPos = new Float32Array(RAIN_N * 6), rainCol = new Float32Array(RAIN_N * 6), rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
rainGeo.setAttribute("color", new THREE.BufferAttribute(rainCol, 3).setUsage(THREE.DynamicDrawUsage));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
rain.frustumCulled = false; scene.add(rain);
const rainDrops = Array.from({ length: RAIN_N }, () => [rnd(0, TAU), Math.sqrt(Math.random()), rnd(0, 1), rnd(.8, 1.2)]); // угол, доля радиуса, высота, скорость
// молния: ломаная от туч до земли с отростками и вспышка света на месте удара
const BOLT_N = 48, boltPos = new Float32Array(BOLT_N * 6), boltGeo = new THREE.BufferGeometry();
boltGeo.setAttribute("position", new THREE.BufferAttribute(boltPos, 3).setUsage(THREE.DynamicDrawUsage));
const bolt = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0xe6eeff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
bolt.frustumCulled = false; bolt.visible = false; scene.add(bolt);
const boltLight = new THREE.PointLight(0xc8d6ff, 0, 1400, 1.4); scene.add(boltLight);
function strikeBolt() {
  const sx = camC.tx + rnd(-1, 1) * (250 + camC.dist * .7), sz = camC.tz + rnd(-1, 1) * (250 + camC.dist * .7);
  const gy = gY(clamp(sx + W / 2, 0, W - .01), clamp(sz + H / 2, 0, H - .01)), top = gy + 950;
  let n = 0;
  const branch = (x, y, z, steps, dy, spread) => {
    for (let k = 0; k < steps && n < BOLT_N; k++) {
      const nx = x + rnd(-1, 1) * spread, ny = Math.max(gy, y - dy * rnd(.7, 1.3)), nz = z + rnd(-1, 1) * spread;
      boltPos.set([x, y, z, nx, ny, nz], n * 6); n++;
      if (k > 2 && Math.random() < .18 && steps > 6) branch(nx, ny, nz, 5, dy * .7, spread * .9); // отросток
      x = nx; y = ny; z = nz; if (y <= gy) break;
    }
  };
  branch(sx, top, sz, 22, (top - gy) / 18, 34);
  boltGeo.setDrawRange(0, n * 2); boltGeo.attributes.position.needsUpdate = true;
  boltLight.position.set(sx, gy + 260, sz); world.boltT = .45; world.flash = 1.1;
  // гром — с задержкой по расстоянию до камеры (звук ~340 м/с, единица ≈ 0,25 м)
  const d = Math.hypot(sx - camera.position.x, sz - camera.position.z) * .25;
  play("thunder", undefined, undefined, clamp(1.4 - d / 2500, .4, 1.2), { delay: Math.min(5, d / 340) });
}
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
  sun.color.setHex(0xfff2dc).lerp(_lc1.setHex(0xff9a50), dusk * .8).lerp(_lc2.setHex(0xaab6cc), nightK); // луна — холодная, но не синяя: синий блеск на асфальте читался как вода
  // рассеянный свет неба: отражённое небо приглушено к серому, поэтому тени подсвечиваем чуть сильнее, иначе асфальт в тени чёрный
  hemi.intensity = (.14 + .5 * day * (1 - gloom * .3) + gloom * .1) * (scene.environment ? .8 : 1);
  hemi.color.setHex(0xe4eaf2).lerp(_lc1.setHex(0x464e66), nightK);
  R3.toneMappingExposure = 1 - nightK * .05 + world.flash * 2;
  const sp = camera.position;
  sunDisc.position.set(sp.x - Math.cos(az) * 7000, Math.sin((h - 6) / 12 * Math.PI) * 6000, sp.z - Math.sin(az) * 4000 - 2500);
  sunDisc.material.opacity = clamp(el * 5 + .3) * (1 - gloom); sunDisc.material.color.setHex(0xfff1c8).lerp(_lc1.setHex(0xff8a40), dusk);
  moonDisc.position.set(sp.x + Math.cos(az) * 6000, Math.max(800, -el * 6000), sp.z + Math.sin(az) * 3000 + 2500);
  moonDisc.material.opacity = nightK * (1 - gloom);
  stars.position.copy(sp); stars.material.opacity = nightK * (1 - gloom) * .9;
  sky.position.set(sp.x, 0, sp.z); // купол едет за камерой: иначе на широкой карте его дальняя стенка уходит за дальность камеры и в небе чёрная дыра
  for (const c of clouds) { c.position.x += dt * 12; if (c.position.x > sp.x + 4500) c.position.x -= 9000; c.material.color.setRGB(.25 + day * .75, .25 + day * .72, .3 + day * .7).lerp(_lc1.setHex(0xff9a70), dusk * .5); c.material.opacity = .35 + gloom * .55; }
  // окна, фонари, мокрый асфальт; без света они гаснут по кварталам — шейдер по карте питания (render7.js)
  for (const m of facadeMats) m.emissiveIntensity = nightK * 1.1;
  for (const m of glowSignMats) m.emissiveIntensity = nightK * .9;
  if (lampHeads) { lampHeads.material.emissiveIntensity = nightK * 3; lampPools.material.opacity = nightK * .5; }
  const dk = 1 - pwLvAt(camC.tx + W / 2, camC.tz + H / 2); // обесточенный квартал под камерой: ночью без городского зарева темнее
  if (dk > 0) { hemi.intensity *= 1 - .4 * dk * nightK; sun.intensity *= 1 - .2 * dk * nightK; }
  ground.material.roughness = .93 - world.wet * .55; ground.material.color.setScalar(1 - world.wet * .3);
  // молнии в грозу
  world.flash = clamp(world.flash - Math.max(0, dt) * 4, 0, 1.5);
  // гроза: разряд раз в 2–7 с, иногда двойной; вспышка, видимая молния и гром с задержкой
  if (world.weather === "storm" && !winter) { world.nextBolt -= dt; if (world.nextBolt <= 0) { world.nextBolt = Math.random() < .2 ? rnd(.25, .6) : rnd(2, 7); strikeBolt(); } }
  world.boltT = Math.max(0, (world.boltT || 0) - Math.max(0, dt));
  bolt.visible = world.boltT > 0; if (bolt.visible) bolt.material.opacity = Math.min(1, world.boltT * 4) * (.6 + .4 * Math.sin(world.boltT * 90));
  boltLight.intensity = world.boltT > 0 ? 14 * world.boltT / .45 : 0;
  // капли
  rain.visible = world.rain > .02;
  if (rain.visible) {
    const cp = camera.position, fp = typeof fps !== "undefined" && fps.on, k = fp ? 0 : clamp(camC.dist / 900);
    const cx = cp.x + (camC.tx - cp.x) * (.4 + k * .3), cz = cp.z + (camC.tz - cp.z) * (.4 + k * .3);
    const R = 170 + camC.dist * .6, y0 = fp ? cp.y - 30 : Math.max(0, cp.y * .2 - 40), top = fp ? 110 : Math.max(200, cp.y * .95), len = 5 + camC.dist * .011;
    const storm = world.weather === "storm", wx = storm ? .42 : .1, wz = storm ? .16 : .04, v = (storm ? 640 : 560) / top;
    const br = (.15 + nightK * .04) * (1 - k * .35) * (storm ? 1.15 : 1);
    for (let i = 0; i < RAIN_N; i++) {
      const d = rainDrops[i]; d[2] -= dt * v * d[3]; if (d[2] < 0) { d[2] += 1; d[0] = rnd(0, TAU); d[1] = Math.sqrt(Math.random()); }
      const x = cx + Math.cos(d[0]) * d[1] * R, y = y0 + d[2] * top, z = cz + Math.sin(d[0]) * d[1] * R, f = (1 - d[1] * d[1]) * br, o = i * 6;
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + wx * len; rainPos[o + 4] = y + len; rainPos[o + 5] = z + wz * len;
      rainCol[o] = f * .78; rainCol[o + 1] = f * .84; rainCol[o + 2] = f * .92; rainCol[o + 3] = f * .3; rainCol[o + 4] = f * .32; rainCol[o + 5] = f * .36;
    }
    rainGeo.setDrawRange(0, Math.floor(RAIN_N * Math.min(1, world.rain) * (storm ? 1 : .7)) * 2); rainGeo.attributes.position.needsUpdate = true; rainGeo.attributes.color.needsUpdate = true;
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
