/* ---------- 3D-сцена: город ---------- */
const X = x => x - W / 2, Z = y => y - H / 2;
if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false; // цвета в sRGB, иначе всё выглядит выцветшим
const cv = $("cv");
const R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
R3.outputEncoding = THREE.sRGBEncoding;
R3.toneMapping = THREE.ACESFilmicToneMapping;
R3.shadowMap.enabled = true;
R3.shadowMap.type = THREE.PCFShadowMap; // мягкие тени дороже, разница на такой карте невелика
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 3, 12000);
scene.fog = new THREE.Fog(0xaebccb, 900, 3200);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x52483c, .6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(-520, 760, -340);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -820, right: 820, top: 620, bottom: -620, near: 50, far: 2600 });
sun.shadow.bias = -.0005; sun.shadow.normalBias = .6;
scene.add(sun, sun.target);
// небо: вертикальный градиент на сфере
const skyU = { top: { value: new THREE.Color(0x5b8fc9) }, bot: { value: new THREE.Color(0xd7e1e8) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 12), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-.05, .5, h)), 1.); }",
}));
scene.add(sky);

function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Math.min(8, R3.capabilities.getMaxAnisotropy());
  return t;
}
function speckle(g, x, y, w, h, n, cols, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.fillRect(x + Math.random() * w, y + Math.random() * h, s, s); } }

/* ---------- земля: асфальт, тротуары, разметка ---------- */
const GS = 1.5; // пикселей текстуры на единицу мира
function paintGround(g) {
  g.save(); g.scale(GS, GS);
  g.fillStyle = "#3b3e40"; g.fillRect(0, 0, W, H);
  speckle(g, 0, 0, W, H, 160000, ["rgba(255,255,255,.04)", "rgba(0,0,0,.08)", "rgba(120,110,100,.06)"], .6);
  for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(${pick(["20,20,22", "70,70,72", "45,42,40"])},${rnd(.15, .35)})`; g.beginPath(); g.ellipse(rnd(0, W), rnd(0, H), rnd(4, 26), rnd(3, 12), rnd(0, 3), 0, TAU); g.fill(); }
  // трещины
  g.strokeStyle = "rgba(15,15,15,.35)"; g.lineWidth = .35;
  for (let i = 0; i < 700; i++) { let x = rnd(0, W), y = rnd(0, H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-6, 6); y += rnd(-6, 6); g.lineTo(x, y); } g.stroke(); }
  const vs = streets.filter(s => s.v && s.p > 0 && s.p < W), hs = streets.filter(s => !s.v && s.p > 0 && s.p < H);
  // осевые линии и полосы, кроме перекрёстков
  const segs = (s, cross) => { const out = []; let a = s.a0; for (const c of cross) { if (!streetsCross(s, c)) continue; out.push([a, c.p - c.hw - 12]); a = c.p + c.hw + 12; } out.push([a, s.a1]); return out; };
  const line = (s, off, from, to, dash, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); if (s.v) { g.moveTo(s.p + off, from); g.lineTo(s.p + off, to); } else { g.moveTo(from, s.p + off); g.lineTo(to, s.p + off); } g.stroke(); };
  for (const s of [...vs, ...hs]) {
    const cross = (s.v ? hs : vs).slice().sort((p, q) => p.p - q.p);
    for (const [a, b] of segs(s, cross)) {
      if (b <= a) continue;
      if (s.wide) { line(s, -.7, a, b, [], "#d8b440", .7); line(s, .7, a, b, [], "#d8b440", .7); line(s, -s.hw / 2, a, b, [10, 12], "rgba(235,235,230,.8)", .7); line(s, s.hw / 2, a, b, [10, 12], "rgba(235,235,230,.8)", .7); }
      else line(s, 0, a, b, [10, 10], "rgba(235,235,230,.75)", .7);
    }
  }
  g.setLineDash([]);
  // зебры и стоп-линии на каждом въезде в перекрёсток
  g.fillStyle = "rgba(236,236,230,.82)";
  for (const v of vs) for (const h of hs) {
    if (!streetsCross(v, h)) continue;
    for (const sgn of [-1, 1]) {
      const yy = h.p + sgn * (h.hw + 3) - (sgn < 0 ? 8 : 0);
      for (let x = v.p - v.hw + 2; x < v.p + v.hw - 2; x += 3.2) g.fillRect(x, yy, 1.8, 8);
      const xx = v.p + sgn * (v.hw + 3) - (sgn < 0 ? 8 : 0);
      for (let y = h.p - h.hw + 2; y < h.p + h.hw - 2; y += 3.2) g.fillRect(xx, y, 8, 1.8);
      g.fillRect(sgn < 0 ? v.p - v.hw : v.p, h.p + sgn * (h.hw + 13) - .5, v.hw, 1);
      g.fillRect(v.p + sgn * (v.hw + 13) - .5, sgn < 0 ? h.p : h.p - h.hw, 1, h.hw);
    }
  }
  // люки
  for (let i = 0; i < 60; i++) { const s = pick(vs.concat(hs)); const t = rnd(s.a0 + 30, s.a1 - 30), x = s.v ? s.p + rnd(-6, 6) : t, y = s.v ? t : s.p + rnd(-6, 6); g.fillStyle = "#2a2b2c"; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); g.strokeStyle = "#4a4b4c"; g.lineWidth = .3; g.stroke(); }
  // кварталы: тротуарная плитка, бордюр, газоны, площади
  for (const b of blocks) {
    g.fillStyle = "#8f8f8a"; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    g.strokeStyle = "rgba(60,60,58,.35)"; g.lineWidth = .25; g.beginPath();
    for (let x = b.x0; x < b.x1; x += 6) { g.moveTo(x, b.y0); g.lineTo(x, b.y1); }
    for (let y = b.y0; y < b.y1; y += 6) { g.moveTo(b.x0, y); g.lineTo(b.x1, y); }
    g.stroke();
    speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, (b.x1 - b.x0) * (b.y1 - b.y0) / 20, ["rgba(0,0,0,.08)", "rgba(255,255,255,.07)"], .8);
    g.strokeStyle = "#b9b8b0"; g.lineWidth = 1.2; g.strokeRect(b.x0 + .6, b.y0 + .6, b.x1 - b.x0 - 1.2, b.y1 - b.y0 - 1.2);
    const ix0 = b.x0 + 8, iy0 = b.y0 + 8, iw = b.x1 - b.x0 - 16, ih = b.y1 - b.y0 - 16;
    if (b.kind === "park") {
      g.fillStyle = "#4b6e35"; g.fillRect(ix0, iy0, iw, ih);
      speckle(g, ix0, iy0, iw, ih, iw * ih / 3, ["#557a3c", "#3f5f2c", "#62853f", "#46672f"], .9);
      g.strokeStyle = "#a89f88"; g.lineWidth = 3; g.beginPath(); g.moveTo(ix0, iy0 + ih * rnd(.3, .7)); g.bezierCurveTo(ix0 + iw * .3, iy0 + rnd(0, ih), ix0 + iw * .7, iy0 + rnd(0, ih), ix0 + iw, iy0 + ih * rnd(.3, .7)); g.stroke();
    } else if (b.kind === "plaza") {
      g.fillStyle = "#a8a092"; g.fillRect(ix0, iy0, iw, ih);
      g.strokeStyle = "rgba(90,80,70,.35)"; g.lineWidth = .3;
      const cx = ix0 + iw / 2, cy = iy0 + ih / 2;
      for (let r = 4; r < Math.max(iw, ih); r += 4) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    } else if (b.kind === "field") {
      const base = ["#c9a85a", "#7a9a40", "#7a5a3a", "#a8b860"][b.crop || 0], dark = ["#b09048", "#668a34", "#654a2e", "#92a24e"][b.crop || 0];
      g.fillStyle = base; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      g.fillStyle = dark; if (b.along === "x") { for (let y = b.y0 + 2; y < b.y1; y += 6) g.fillRect(b.x0 + 2, y, b.x1 - b.x0 - 4, 2.6); } else { for (let x = b.x0 + 2; x < b.x1; x += 6) g.fillRect(x, b.y0 + 2, 2.6, b.y1 - b.y0 - 4); }
      g.strokeStyle = "#6a5a3a"; g.lineWidth = 2; g.strokeRect(b.x0 + 1, b.y0 + 1, b.x1 - b.x0 - 2, b.y1 - b.y0 - 2);
    } else if (b.kind === "meadow" || b.kind === "bank") {
      g.fillStyle = b.kind === "bank" ? "#5c7c42" : "#6f8f45"; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, (b.x1 - b.x0) * (b.y1 - b.y0) / 3, ["#7a9a4e", "#5e7e3a", "#86a258", "#4e6a34"], .9);
      if (b.kind === "meadow") speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, (b.x1 - b.x0) * (b.y1 - b.y0) / 60, ["#f2e9a0", "#f0f0f0", "#e8a0c0", "#f2c84a"], .9);
    } else if (b.kind === "forest") {
      g.fillStyle = "#3f5c2f"; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, (b.x1 - b.x0) * (b.y1 - b.y0) / 3, ["#46642f", "#36502a", "#4e6c38", "#5a5a3a"], .9);
    } else if (b.kind === "hill") {
      g.fillStyle = "#4f6d3a"; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, (b.x1 - b.x0) * (b.y1 - b.y0) / 3, ["#5a7a42", "#43612f", "#6a7a4a", "#8a8470", "#3e5a2c"], .9);
    } else if (b.kind === "suburb") {
      g.fillStyle = "#56763d"; g.fillRect(ix0, iy0, iw, ih);
      speckle(g, ix0, iy0, iw, ih, iw * ih / 4, ["#5f8043", "#4b6a35", "#668a48"], .9);
    } else if (b.lot) {
      g.fillStyle = b.kind === "industry" ? "#6d6c66" : "#3f4244"; g.fillRect(ix0, iy0, iw, ih);
      speckle(g, ix0, iy0, iw, ih, iw * ih / 6, ["rgba(0,0,0,.1)", "rgba(255,255,255,.05)"], .8);
      if (b.kind === "lot") { g.strokeStyle = "rgba(230,230,225,.7)"; g.lineWidth = .5; for (let y = iy0 + 14; y < iy0 + ih - 10; y += 30) for (let x = ix0 + 2.5; x < ix0 + iw - 6; x += 11) { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y + 8); g.stroke(); } }
    } else { g.fillStyle = "#77766f"; g.fillRect(ix0 - 1, iy0 - 1, iw + 2, ih + 2); }
  }
  // исторический центр: брусчатка, лучи и кольца
  if (oldTown) {
    const { x: cx, y: cy, R } = oldTown;
    g.fillStyle = "#8f8576"; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.strokeStyle = "rgba(60,52,44,.35)"; g.lineWidth = .3;
    for (let r = 4; r < R; r += 3) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    speckle(g, cx - R, cy - R, 2 * R, 2 * R, R * R / 3, ["rgba(0,0,0,.12)", "rgba(255,255,255,.08)"], .9);
    g.strokeStyle = "rgba(200,190,170,.5)"; g.lineWidth = 16;
    for (let k = 0; k < oldTown.spokes; k++) { const a = k / oldTown.spokes * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * oldTown.rings[0], cy + Math.sin(a) * oldTown.rings[0]); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
    for (const r of oldTown.rings) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    g.fillStyle = "#b9ad98"; g.beginPath(); g.arc(cx, cy, oldTown.rings[0], 0, TAU); g.fill();
    g.restore();
  }
  if (bigPark) {
    const p = bigPark;
    g.fillStyle = "#4e7337"; g.fillRect(p.x0 + 10, p.y0 + 10, p.x1 - p.x0 - 20, p.y1 - p.y0 - 20);
    speckle(g, p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, (p.x1 - p.x0) * (p.y1 - p.y0) / 3, ["#567c3c", "#456a30", "#628545", "#3e5f2b"], .9);
    g.strokeStyle = "#c2b493"; g.lineWidth = 6; g.lineCap = "round";
    for (const path of p.paths || []) { g.beginPath(); path.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  }
  for (const p of ponds) { g.fillStyle = "#b8ab8a"; g.beginPath(); g.ellipse(p.x, p.y, p.rx + 4, p.ry + 4, 0, 0, TAU); g.fill(); }
  paintContactShadows(g);
  edPaintGround(g);
  // дорожки к домам частного сектора
  for (const b of buildings) if (b.kind === "house") { g.fillStyle = "#9b958a"; const cx = (b.x0 + b.x1) / 2; g.fillRect(cx - 2, b.y1, 4, 6); }
  // вода: глубина темнее к середине, песок у моря
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const c = grid[gy * GW + gx], x = gx * CS + 4, y = gy * CS + 4;
    if (c === 9) { g.fillStyle = "#24404f"; g.fillRect(gx * CS, gy * CS, CS + .5, CS + .5); }
    else { const sd = shoreD(x, y), wd = waterD(x, y); if (sd < 14) { g.fillStyle = "#c9b98f"; g.fillRect(gx * CS, gy * CS, CS + .5, CS + .5); } else if (wd < 10 && c === 2) { g.fillStyle = wd < 4 ? "#8a7a52" : "#6a7a44"; g.fillRect(gx * CS, gy * CS, CS + .5, CS + .5); } }
  }
  for (const b of bridges) { g.fillStyle = "#3d4042"; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.strokeStyle = "rgba(235,235,230,.75)"; g.lineWidth = .7; g.setLineDash([10, 10]); g.beginPath(); if (b.v) { g.moveTo((b.x0 + b.x1) / 2, b.y0); g.lineTo((b.x0 + b.x1) / 2, b.y1); } else { g.moveTo(b.x0, (b.y0 + b.y1) / 2); g.lineTo(b.x1, (b.y0 + b.y1) / 2); } g.stroke(); g.setLineDash([]); }
  g.restore();
}
const groundCv = document.createElement("canvas"); groundCv.width = W * GS; groundCv.height = H * GS;
const groundTex = new THREE.CanvasTexture(groundCv);
groundTex.encoding = THREE.sRGBEncoding; groundTex.anisotropy = Math.min(16, R3.capabilities.getMaxAnisotropy());
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H, GW, GH), new THREE.MeshStandardMaterial({ map: groundTex, roughness: .93, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
const grassTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#4a5a37"; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 26000, ["#55663e", "#405030", "#5d6d44", "#3b4a2c", "#6a6a48"], 2); });
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(280, 280);
const outskirts = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
outskirts.rotation.x = -Math.PI / 2; outskirts.position.y = -.4; outskirts.receiveShadow = true;
scene.add(outskirts);
// ближние окрестности: сетка с высотами, цвет по высоте и уклону — трава, скалы, снег
const terrTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#d0d0d0"; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 26000, ["#bcbcbc", "#e0e0e0", "#c8c8c8", "#ececec", "#b0b0b0"], 2); }, false);
terrTex.wrapS = terrTex.wrapT = THREE.RepeatWrapping; terrTex.repeat.set(160, 140);
const TEXT = 2300, TSEG = 24;
let terrainMesh = null;
function buildTerrainMesh() {
  if (terrainMesh) { scene.remove(terrainMesh); terrainMesh.geometry.dispose(); terrainMesh = null; }
  if (worldFlat()) { outskirts.position.y = -.4; const gp0 = ground.geometry.attributes.position; for (let i = 0; i < gp0.count; i++) gp0.setZ(i, 0); gp0.needsUpdate = true; ground.geometry.computeVertexNormals(); return; }
  const w = W + 2 * TEXT, h = H + 2 * TEXT, nx = Math.round(w / TSEG), ny = Math.round(h / TSEG);
  const geo = new THREE.PlaneGeometry(w, h, nx, ny), p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), sx = px + W / 2, sy = -py + H / 2;
    const inside = sx > -2 && sx < W + 2 && sy > -2 && sy < H + 2, hh = inside ? -30 : gY(sx, sy);
    p.setZ(i, hh);
    const sl = inside ? 0 : Math.hypot(gY(sx + 10, sy) - gY(sx - 10, sy), gY(sx, sy + 10) - gY(sx, sy - 10)) / 20;
    // трава внизу, выше — альпийские луга и камень, снег только на вершинах
    c.setHSL(.25 + Math.sin(sx * .01) * .01 - clamp(hh / 500) * .06, .36 - clamp(hh / 500) * .14, .3 + Math.random() * .04 + clamp(hh / 500) * .1);
    const rock = new THREE.Color().setHSL(.08, .14, .44 + Math.random() * .06), snow = new THREE.Color(.94, .96, .99);
    const k = clamp((sl - .5) / .35) * .9 + clamp((hh - 330) / 90) * .5;
    c.lerp(rock, clamp(k)); if (hh > 400) c.lerp(snow, clamp((hh - 400) / 70) * (1 - clamp((sl - .8) / .4)));
    c.convertSRGBToLinear(); // цвета задуманы как на экране; в вершинах они должны быть линейными, иначе всё блёкнет
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  terrainMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: terrTex, vertexColors: true, roughness: 1 }));
  terrainMesh.rotation.x = -Math.PI / 2; terrainMesh.position.y = 0; terrainMesh.receiveShadow = true; terrainMesh.castShadow = true; terrainMesh.frustumCulled = false;
  scene.add(terrainMesh);
  // земля города повторяет холмы
  const gp = ground.geometry.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setZ(i, gY(clamp(gp.getX(i) + W / 2, 0, W - .01), clamp(-gp.getY(i) + H / 2, 0, H - .01)));
  gp.needsUpdate = true; ground.geometry.computeVertexNormals(); ground.geometry.computeBoundingSphere();
}
let rockMesh = null;
function buildRocks() {
  if (rockMesh) { cityGroup.remove(rockMesh); }
  const geo = new THREE.IcosahedronGeometry(1, 1), pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const k = .8 + Math.random() * .4; pp.setXYZ(i, pp.getX(i) * k, Math.max(-.2, pp.getY(i)) * k, pp.getZ(i) * k); }
  geo.computeVertexNormals();
  rockMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a746a, roughness: .95 }), Math.max(1, rocks.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  rocks.forEach((r, i) => { q.setFromAxisAngle(up, r.rot); m.compose(new THREE.Vector3(X(r.x), gY(r.x, r.y) + r.s * .15, Z(r.y)), q, new THREE.Vector3(r.s, r.s * .7, r.s * .85)); rockMesh.setMatrixAt(i, m); });
  rockMesh.count = rocks.length; rockMesh.castShadow = rockMesh.receiveShadow = true; cityGroup.add(rockMesh);
}

/* ---------- фасады ---------- */
// текстура: 8 пролётов × 16 этажей, нижний этаж — витрины; отдельная карта светящихся окон для ночи
const BAY = 16, FLOOR = 12, TBX = 8, TFL = 16, TPX = 64, TPY = 48;
const STYLES = [
  { wall: "#b9ad98", glass: "#3d4b57", frame: "#e9e3d6", win: .55 },
  { wall: "#8c4c3c", glass: "#2f3a44", frame: "#d8d0c0", win: .45 },
  { wall: "#9aa1a6", glass: "#4b6a82", frame: "#6d7479", win: .7 },
  { wall: "#d9d4c7", glass: "#3a4650", frame: "#a7a296", win: .5 },
  { wall: "#5f6a6e", glass: "#5d84a3", frame: "#3c4446", win: .82 },
  { wall: "#e8ecee", glass: "#7fa3c2", frame: "#c9d2d8", win: .6 },   // больница
  { wall: "#6b7f99", glass: "#2c3a4c", frame: "#c5ccd6", win: .45 },  // полиция
  { wall: "#7b8a96", glass: "#8fb5cf", frame: "#4f5b64", win: .9 },   // торговый центр
  { wall: "#2f4a5c", glass: "#4e7d9c", frame: "#9fb3c1", win: .96, curtain: true }, // стеклянные башни
  { wall: "#3a4a3f", glass: "#5f8a74", frame: "#b8c4bb", win: .96, curtain: true },
  { wall: "#4c4f55", glass: "#34495e", frame: "#c9ccd1", win: .9, curtain: true },
  { wall: "#e3d9c3", glass: "#3c4a55", frame: "#ffffff", win: .38, house: true },   // частные дома
  { wall: "#c9d6dc", glass: "#3c4a55", frame: "#ffffff", win: .38, house: true },
  { wall: "#d8c27a", glass: "#3c4a55", frame: "#f4efe4", win: .38, house: true },
  { wall: "#a8634a", glass: "#3c4a55", frame: "#efe6d6", win: .38, house: true },
  { wall: "#8e9497", glass: "#4b5a64", frame: "#6f7579", win: .25, metal: true },   // склад
  { wall: "#a33a2a", metal: true, blank: true }, { wall: "#2c5b8a", metal: true, blank: true }, { wall: "#3d7a46", metal: true, blank: true }, { wall: "#c98a2a", metal: true, blank: true }, // контейнеры
  { wall: "#9c3326", glass: "#3a4650", frame: "#e8e2d4", win: .5 }, // пожарная часть
  { wall: "#d8ccb2", glass: "#2c3a48", frame: "#efe7d4", win: .3, arch: true }, // собор
  { wall: "#e2c06e", glass: "#33414c", frame: "#fbf6ea", win: .42, arch: true }, // старый город
  { wall: "#d79e98", glass: "#33414c", frame: "#fbf6ea", win: .42, arch: true },
  { wall: "#a7c8b0", glass: "#33414c", frame: "#fbf6ea", win: .42, arch: true },
  { wall: "#a6bdd6", glass: "#33414c", frame: "#fbf6ea", win: .42, arch: true },
  { wall: "#8a3a2a", glass: "#3a4650", frame: "#e8e2d4", win: .2, house: true }, // амбар
];
function facadeTex(st, emissive) {
  return canvasTex(TBX * TPX, TFL * TPY, (g, w, h) => {
    if (emissive) { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = st.wall; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 9000, ["rgba(0,0,0,.06)", "rgba(255,255,255,.05)"], 2); }
    if (st.metal) { if (!emissive) for (let x = 0; x < w; x += 8) { g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(x, 0, 3, h); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x + 4, 0, 2, h); } if (st.blank) return; }
    if (st.curtain) {
      // стеклянная навесная стена: сплошное стекло, тонкие импосты
      for (let f = 0; f < TFL; f++) for (let b = 0; b < TBX * 2; b++) {
        const x0 = b * TPX / 2, y0 = h - (f + 1) * TPY;
        if (emissive) { if (Math.random() < .3) { g.fillStyle = pick(["#dfe9ff", "#fff1d6", "#cfe0ff"]); g.globalAlpha = rnd(.4, .9); g.fillRect(x0 + 1, y0 + 3, TPX / 2 - 2, TPY - 6); g.globalAlpha = 1; } continue; }
        const gr = g.createLinearGradient(x0, y0, x0 + TPX / 2, y0 + TPY); gr.addColorStop(0, shade(st.glass, rnd(-10, 20))); gr.addColorStop(1, shade(st.glass, rnd(-30, 0)));
        g.fillStyle = gr; g.fillRect(x0 + 1, y0 + 2, TPX / 2 - 2, TPY - 4);
        if (Math.random() < .15) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x0 + 1, y0 + 2, TPX / 2 - 2, TPY - 4); }
      }
      if (!emissive) { g.fillStyle = st.frame; for (let f = 0; f <= TFL; f++) g.fillRect(0, h - f * TPY - 2, w, 3); }
      return;
    }
    for (let f = 0; f < TFL; f++) for (let b = 0; b < TBX; b++) {
      const x0 = b * TPX, y0 = h - (f + 1) * TPY, ground = f === 0 && !st.house && !st.metal;
      if (st.house && f === 0 && b % 4 === 1) { if (!emissive) { g.fillStyle = "#5a3a26"; g.fillRect(x0 + TPX * .35, y0 + TPY * .3, TPX * .3, TPY * .7); } continue; } // дверь
      const ww = ground ? TPX * .86 : TPX * st.win, wh = ground ? TPY * .72 : TPY * .56;
      const wx = x0 + (TPX - ww) / 2, wy = ground ? y0 + TPY - wh - 3 : y0 + TPY * .22;
      if (emissive) {
        // ночью горит каждое третье окно, цвет от тёплого до холодного
        if (Math.random() < (ground ? .5 : .32)) { g.fillStyle = pick(["#ffcf8a", "#ffd9a0", "#f6e7c8", "#bcd4ff", "#ffb870"]); g.globalAlpha = rnd(.5, 1); g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4); g.globalAlpha = 1; }
        continue;
      }
      g.fillStyle = st.frame; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      if (st.arch) { g.beginPath(); g.arc(wx + ww / 2, wy, ww / 2 + 2, Math.PI, 0); g.fill(); g.fillStyle = shade(st.wall, -25); g.fillRect(x0, y0 + TPY - 4, TPX, 4); g.fillStyle = st.frame; }
      const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      gr.addColorStop(0, st.glass); gr.addColorStop(.5, shade(st.glass, rnd(10, 35))); gr.addColorStop(1, shade(st.glass, -15));
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      if (!ground && Math.random() < .35) { g.fillStyle = pick(["rgba(230,220,200,.55)", "rgba(180,60,50,.35)", "rgba(200,200,190,.5)"]); g.fillRect(wx, wy, ww * rnd(.2, .5), wh); } // шторы
      g.fillStyle = st.frame; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      if (!ground) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(wx - 3, wy + wh + 2, ww + 6, 3); }
      else if (Math.random() < .5) { g.fillStyle = pick(["#7a2a24", "#24507a", "#2e6a3c", "#8a6a20"]); g.fillRect(x0 + 2, y0 + 4, TPX - 4, 7); }
    }
    if (!emissive) { g.fillStyle = "rgba(0,0,0,.18)"; for (let f = 1; f < TFL; f++) g.fillRect(0, h - f * TPY - 2, w, 3); }
  }, !emissive || true);
}
function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = k => clamp(((n >> k) & 255) + d, 0, 255) | 0; return `rgb(${c(16)},${c(8)},${c(0)})`; }
const facadeMats = STYLES.map(st => { const m = facadeTex(st, false), e = facadeTex(st, true); m.wrapS = m.wrapT = e.wrapS = e.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: m, emissiveMap: e, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, roughness: .78, metalness: .05 }); });
const roofTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#5a5b5c"; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 30000, ["#4f5051", "#636465", "#48494a", "#6b6c6d"], 1); g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: .95 });
const parapetMat = new THREE.MeshStandardMaterial({ color: 0x6d6b66, roughness: .9 });
const tileTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.fillStyle = `rgba(0,0,0,${rnd(.05, .25)})`; g.fillRect(x, y, 15, 14); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x, y + 13, 15, 2); } });
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(.12, .12);
const tileMats = ["#8a3b2a", "#5a3a2e", "#4a4f55", "#6b2f2a", "#3c4a3e"].map(c => new THREE.MeshStandardMaterial({ map: tileTex, color: c, roughness: .8 }));
const metalRoofMat = new THREE.MeshStandardMaterial({ color: 0xa4a8aa, roughness: .45, metalness: .6, map: (() => { const t = canvasTex(64, 64, (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64); for (let x = 0; x < 64; x += 8) { g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x, 0, 3, 64); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })() });
const cityGroup = new THREE.Group(); scene.add(cityGroup);
function boxUV(geo, w, d, floors, uOff) {
  // боковые грани: u в пролётах, v в этажах; крыша — в метрах
  const uv = geo.attributes.uv, spans = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i);
    if (f === 2 || f === 3) uv.setXY(i, u * w / 22, v * d / 22);
    else uv.setXY(i, u * spans[f] / (BAY * TBX) + uOff + f * 3 / TBX, v * floors / TFL);
  }
}
const instBoxes = []; // мелочи на крышах собираются в один InstancedMesh
function buildCity() {
  while (cityGroup.children.length) { const c = cityGroup.children.pop(); c.geometry?.dispose(); }
  paintGround(groundCv.getContext("2d")); groundTex.needsUpdate = true;
  buildTerrainMesh(); buildRocks();
  instBoxes.length = 0;
  for (const b of buildings) {
    const rotated = b.rot !== undefined, w = rotated ? b.w : b.x1 - b.x0, d = rotated ? b.d : b.y1 - b.y0, geo = new THREE.BoxGeometry(w, b.h, d);
    boxUV(geo, w, d, b.kind === "house" ? b.floors * 1.6 : b.floors, Math.floor(rnd(0, 8)) / TBX);
    const fm = facadeMats[b.style], top = b.kind === "warehouse" ? metalRoofMat : b.kind === "container" ? fm : roofMat;
    const obj = new THREE.Group(); obj.position.set(rotated ? X(b.cx) : X(b.x0 + w / 2), 0, rotated ? Z(b.cy) : Z(b.y0 + d / 2)); if (rotated) obj.rotation.y = -b.rot;
    const mesh = new THREE.Mesh(geo, [fm, fm, top, top, fm, fm]);
    mesh.position.y = b.h / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    obj.add(mesh); b.mesh = mesh; b.obj = obj; b.scorched = false;
    // дом стоит на самой низкой точке участка, под ним цоколь до самой высокой
    const hs = [gY(b.x0, b.y0), gY(b.x1, b.y0), gY(b.x0, b.y1), gY(b.x1, b.y1), gY((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)];
    b.baseY = Math.min(...hs); const topY = Math.max(...hs); obj.position.y = b.baseY;
    if (topY - b.baseY > .25) { const fh = topY - b.baseY + 2.4; const fnd = new THREE.Mesh(new THREE.BoxGeometry(w + .6, fh, d + .6), parapetMat); fnd.position.y = fh / 2 - 2.2; fnd.receiveShadow = fnd.castShadow = true; obj.add(fnd); }
    const cx = obj.position.x, cz = obj.position.z, by = b.baseY;
    if (b.kind === "cathedral") {
      // собор: неф, барабан с куполом, две башни со шпилями
      const stone = facadeMats[21], gold = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: .25, metalness: .9 }), dark = new THREE.MeshStandardMaterial({ color: 0x3f5a4e, roughness: .5, metalness: .4 });
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 14, 24), stone); drum.position.y = b.h + 7; obj.add(drum);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(13.5, 24, 12, 0, TAU, 0, Math.PI / 2), dark); dome.position.y = b.h + 14; obj.add(dome);
      const lant = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 6, 10), gold); lant.position.y = b.h + 30; obj.add(lant);
      for (const s of [-1, 1]) {
        const tw = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 12), stone); tw.position.set(s * 14, b.h + 15 - 12, d / 2 - 6); tw.position.y = (b.h + 18) / 2; tw.scale.y = (b.h + 18) / 30; obj.add(tw);
        const sp = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 8), dark); sp.position.set(s * 14, b.h + 18 + 11, d / 2 - 6); obj.add(sp);
        const cr = new THREE.Mesh(new THREE.BoxGeometry(.6, 5, .6), gold); cr.position.set(s * 14, b.h + 18 + 24, d / 2 - 6); obj.add(cr);
      }
      obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      b.h += 33; continue;
    }
    if (b.kind === "house" || b.kind === "oldhouse" || b.kind === "barn") {
      // двускатная крыша
      const rh = Math.min(w, d) * (b.kind === "oldhouse" ? .3 : .38), along = b.ridge === "x", span = along ? d : w, len = along ? w : d;
      const sh = new THREE.Shape([new THREE.Vector2(-span / 2 - 1.2, 0), new THREE.Vector2(span / 2 + 1.2, 0), new THREE.Vector2(0, rh)]);
      const rg = new THREE.ExtrudeGeometry(sh, { depth: len + 2, bevelEnabled: false }); rg.translate(0, 0, -(len + 2) / 2);
      if (along) rg.rotateY(Math.PI / 2);
      const roof = new THREE.Mesh(rg, pick(tileMats)); roof.position.y = b.h; roof.castShadow = roof.receiveShadow = true; obj.add(roof);
      if (b.kind === "oldhouse") roof.material = pick(tileMats.slice(0, 2));
      if (Math.random() < .5) { const ch = new THREE.Mesh(new THREE.BoxGeometry(2.2, rh + 3, 2.2), parapetMat); ch.position.set(rnd(-w / 4, w / 4), b.h + rh * .6, rnd(-d / 4, d / 4)); ch.castShadow = true; obj.add(ch); }
      b.h += rh * .6;
      continue;
    }
    if (b.kind === "container") continue;
    // парапет и оборудование на крыше
    for (const [px, pz, sx, sz] of [[0, -d / 2 + .6, w, 1.2], [0, d / 2 - .6, w, 1.2], [-w / 2 + .6, 0, 1.2, d], [w / 2 - .6, 0, 1.2, d]]) instBoxes.push([cx + px, by + b.h + 1.2, cz + pz, sx, 2.4, sz, 0x77756f, b]);
    const n = Math.floor(w * d / 700) + 1;
    for (let i = 0; i < n; i++) { const sx = rnd(3, 8), sz = rnd(3, 8), sy = rnd(2, 5); instBoxes.push([X(rnd(b.x0 + 6, b.x1 - 6)), by + b.h + sy / 2, Z(rnd(b.y0 + 6, b.y1 - 6)), sx, sy, sz, pick([0x8d8f90, 0x9c9a94, 0x6f7173, 0xb0aea6]), b]); }
    if (b.kind === "tower") {
      // верхушка небоскрёба: уступ, техэтаж и антенна
      const k = rnd(.55, .75), cw = w * k, cd = d * k, chh = rnd(14, 30);
      const cg = new THREE.BoxGeometry(cw, chh, cd); boxUV(cg, cw, cd, chh / 12, 0);
      const crown = new THREE.Mesh(cg, [fm, fm, roofMat, roofMat, fm, fm]); crown.position.y = b.h + chh / 2; crown.castShadow = true; obj.add(crown);
      if (Math.random() < .6) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(.4, .7, rnd(20, 45), 6), parapetMat); ant.position.y = b.h + chh + ant.geometry.parameters.height / 2; obj.add(ant); b.antenna = ant; }
      b.h += chh;
    } else if (b.floors > 5 && Math.random() < .5) instBoxes.push([X(b.x0 + w * rnd(.25, .75)), by + b.h + 5, Z(b.y0 + d * rnd(.25, .75)), 10, 10, 12, 0x6a6862, b]); // выход на крышу
    if (b.kind === "power" || b.kind === "water" || b.kind === "radio") decorateInfra(b, obj, w, d);
    if (b.kind === "hospital") {
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.fillStyle = "#d42020"; g.fillRect(48, 18, 32, 92); g.fillRect(18, 48, 92, 32); }), transparent: true, roughness: .8 }));
      cross.rotation.x = -Math.PI / 2; cross.position.set(0, b.h + .15, 0); obj.add(cross);
    }
    if (b.kind === "police" || b.kind === "hospital" || b.kind === "mall" || b.kind === "power" || b.kind === "water" || b.kind === "radio") {
      const label = b.kind === "police" ? "ПОЛИЦИЯ" : b.kind === "hospital" ? "БОЛЬНИЦА" : b.kind === "power" ? "ТЭЦ-1" : b.kind === "water" ? "ВОДОКАНАЛ" : b.kind === "radio" ? "РАДИОЦЕНТР" : "ТЦ «ГОРОД»";
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * .7, 70), 9), new THREE.MeshStandardMaterial({ map: canvasTex(512, 64, g => { g.fillStyle = b.kind === "police" ? "#1d3566" : b.kind === "hospital" ? "#c81e1e" : "#222"; g.fillRect(0, 0, 512, 64); g.fillStyle = "#fff"; g.font = "bold 40px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText(label, 256, 47); }), emissive: 0xffffff, emissiveIntensity: .25, roughness: .5 }));
      sign.position.set(0, Math.min(b.h - 4, 20), d / 2 + .3); sign.material.emissiveMap = sign.material.map; obj.add(sign); b.sign = sign;
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  roofStuff = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: .85 }), Math.max(1, instBoxes.length));
  const m = new THREE.Matrix4(), col = new THREE.Color();
  for (const b of buildings) b.roofIdx = [];
  instBoxes.forEach(([x, y, z, sx, sy, sz, c, b], i) => { m.makeScale(sx, sy, sz).setPosition(x, y, z); roofStuff.setMatrixAt(i, m); roofStuff.setColorAt(i, col.setHex(c)); b.roofIdx.push(i); });
  roofStuff.castShadow = roofStuff.receiveShadow = true; cityGroup.add(roofStuff);
  mergeBuildings(); placePuddles(); buildTrafficLights();
  buildTrees(); buildLamps(); buildFountains(); buildWater(); buildFences(); makeCarMeshes(cars.length + 300);
}
let roofStuff = null;

/* ---------- деревья, фонари, фонтаны ---------- */
let lampHeads, lampPools, lampPole, lampArm, treeCrown, treeTrunk;
function buildTrees() {
  treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.7, 1.1, 1, 6).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), Math.max(1, trees.length));
  const crownGeo = organicCrown();
  treeCrown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: .85, vertexColors: true, envMapIntensity: .4 }), Math.max(1, trees.length * 3));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  trees.forEach((t, i) => {
    const ty = gY(t.x, t.y);
    m.makeScale(1, t.h * .55, 1).setPosition(X(t.x), ty, Z(t.y)); treeTrunk.setMatrixAt(i, m);
    for (let k = 0; k < 3; k++) {
      const r = t.r * rnd(.6, .9);
      q.setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0));
      m.compose(new THREE.Vector3(X(t.x) + rnd(-t.r, t.r) * .4, ty + t.h * rnd(.6, .85), Z(t.y) + rnd(-t.r, t.r) * .4), q, new THREE.Vector3(r, r * rnd(.75, 1), r));
      treeCrown.setMatrixAt(i * 3 + k, m); col.setHSL(rnd(.22, .3), rnd(.35, .5), rnd(.2, .3)); treeCrown.setColorAt(i * 3 + k, col);
    }
  });
  treeTrunk.castShadow = treeCrown.castShadow = true; treeCrown.receiveShadow = true;
  cityGroup.add(treeTrunk, treeCrown);
  // лесополоса за городом, кроме воды
  const out = [];
  const wet = (x, y) => waterD(x, y) < 8;
  for (let i = 0; i < 3400; i++) {
    const side = Math.floor(rnd(0, 4)), d = 14 + Math.pow(Math.random(), 1.4) * 1100;
    const x = side < 2 ? rnd(-d, W + d) : side === 2 ? -d : W + d, y = side >= 2 ? rnd(-d, H + d) : side === 0 ? -d : H + d;
    if (wet(x, y)) continue;
    // лес растёт на пологих склонах ниже снега
    const hh = gY(x, y), sl = Math.hypot(gY(x + 8, y) - gY(x - 8, y), gY(x, y + 8) - gY(x, y - 8)) / 16;
    if (hh > 330 || sl > .55) continue;
    out.push([x, y, rnd(8, 15) * (hh > 180 ? .7 : 1), rnd(18, 34) * (hh > 180 ? .7 : 1), hh]);
  }
  const ot = new THREE.InstancedMesh(treeTrunk.geometry, treeTrunk.material, Math.max(1, out.length)), oc = new THREE.InstancedMesh(crownGeo, treeCrown.material, Math.max(1, out.length * 2));
  out.forEach(([x, y, r, h, hh], i) => {
    m.makeScale(1, h * .55, 1).setPosition(X(x), hh, Z(y)); ot.setMatrixAt(i, m);
    for (let k = 0; k < 2; k++) { q.setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0)); m.compose(new THREE.Vector3(X(x) + rnd(-3, 3), hh + h * rnd(.65, .85), Z(y) + rnd(-3, 3)), q, new THREE.Vector3(r, r * rnd(.8, 1.1), r)); oc.setMatrixAt(i * 2 + k, m); col.setHSL(rnd(.2, .32) - (hh > 180 ? .06 : 0), rnd(.3, .45), rnd(.14, .24)); oc.setColorAt(i * 2 + k, col); }
  });
  ot.castShadow = oc.castShadow = false; oc.receiveShadow = true; // лес за городом без теней: дорого, а издали не видно
  cityGroup.add(ot, oc);
}
function refreshTrees() {
  if (!treeCrown) return;
  const col = new THREE.Color("#1b1714");
  trees.forEach((t, i) => { if (t.burnt && !t.shownBurnt) { t.shownBurnt = true; for (let k = 0; k < 3; k++) treeCrown.setColorAt(i * 3 + k, col); } });
  if (treeCrown.instanceColor) treeCrown.instanceColor.needsUpdate = true;
}
function radialTex(stops) { return canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }); }
const glowTex = radialTex([[0, "rgba(255,255,255,1)"], [.25, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]]);
function buildLamps() {
  const n = Math.max(1, lamps.length);
  lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .45, 24, 6).translate(0, 12, 0), new THREE.MeshStandardMaterial({ color: 0x2f3336, roughness: .6, metalness: .5 }), n);
  lampArm = new THREE.InstancedMesh(new THREE.BoxGeometry(6, .5, .5).translate(3, 0, 0), lampPole.material, n);
  lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(3, .8, 1.6), new THREE.MeshStandardMaterial({ color: 0x9a9a92, emissive: 0xffd9a0, emissiveIntensity: 0 }), n);
  lampPools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), n);
  lampPole.castShadow = lampArm.castShadow = true;
  lampPools.renderOrder = 2;
  cityGroup.add(lampPole, lampArm, lampHeads, lampPools);
  placeLamps();
}
function placeLamps() {
  // упавший фонарь лежит на земле, его лампа гаснет
  const m = new THREE.Matrix4(), base = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  lamps.forEach((l, i) => {
    const ang = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][l.f], dx = Math.cos(ang), dz = -Math.sin(ang);
    base.makeTranslation(X(l.x), gY(l.x, l.y), Z(l.y));
    if (l.down) base.multiply(m.makeRotationY(i * 1.7)).multiply(new THREE.Matrix4().makeRotationZ(l.down));
    lampPole.setMatrixAt(i, base);
    q.setFromAxisAngle(up, ang);
    lampArm.setMatrixAt(i, base.clone().multiply(m.compose(new THREE.Vector3(0, 23.5, 0), q, one)));
    lampHeads.setMatrixAt(i, base.clone().multiply(m.compose(new THREE.Vector3(dx * 5.5, 23.2, dz * 5.5), q, one)));
    lampPools.setMatrixAt(i, l.down ? zero : m.makeScale(70, 1, 70).setPosition(X(l.x) + dx * 6, gY(l.x, l.y) + .15, Z(l.y) + dz * 6));
  });
  for (const o of [lampPole, lampArm, lampHeads, lampPools]) o.instanceMatrix.needsUpdate = true;
}
function buildFountains() {
  const stone = new THREE.MeshStandardMaterial({ color: 0xb4ad9f, roughness: .85 }), water = new THREE.MeshStandardMaterial({ color: 0x3e6f8a, roughness: .15, metalness: .2 });
  for (const f of fountains) {
    const fy = gY(f.x, f.y);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r + 1, 3, 28), stone); basin.position.set(X(f.x), fy + 1.5, Z(f.y));
    const wat = new THREE.Mesh(new THREE.CylinderGeometry(f.r - 1.2, f.r - 1.2, .2, 28), water); wat.position.set(X(f.x), fy + 2.6, Z(f.y));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 9, 12), stone); col.position.set(X(f.x), fy + 4.5, Z(f.y));
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(4, 2.5, 1.5, 20), stone); bowl.position.set(X(f.x), fy + 9, Z(f.y));
    for (const o of [basin, col, bowl]) { o.castShadow = o.receiveShadow = true; }
    cityGroup.add(basin, wat, col, bowl);
  }
}

/* ---------- вода, мосты, заборы ---------- */
const waterTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(255,255,255,${rnd(.05, .25)})`; g.lineWidth = rnd(.5, 1.5); const x = rnd(0, w), y = rnd(0, h), l = rnd(4, 14); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke(); } }, false);
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(30, 30);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f4559, roughness: .12, metalness: .35, map: waterTex });
function buildWater() {
  if (worldFlat()) { buildCityWalls(); return; }
  // вода — один лист под всем миром; видна там, где рельеф ниже её уровня: река, море, озёра, пруды
  // карта глубины: у берегов вода светлее и с пеной
  const dc = document.createElement("canvas"); dc.width = GW; dc.height = GH; const dg = dc.getContext("2d"), img = dg.createImageData(GW, GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const d = clamp(-waterD(gx * CS + 4, gy * CS + 4) / 26), i = (gy * GW + gx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(d * 255); img.data[i + 3] = 255; }
  dg.putImageData(img, 0, 0); const depthTex = new THREE.CanvasTexture(dc); depthTex.magFilter = THREE.LinearFilter;
  waterU.depthMap.value = depthTex;
  // у моря вода уходит до горизонта, иначе — только под ближними окрестностями; дальняя плоская земля ниже воды только у моря
  const sea = !!shore, ext = sea ? 8000 : 0;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * TEXT + ext, H + 2 * TEXT + ext).rotateX(-Math.PI / 2), makeWaterMat(-1e6, -1e6, 1e6, 1e6));
  pl.position.set(0, WATER_Y, 0); pl.renderOrder = -1; pl.frustumCulled = false; cityGroup.add(pl);
  outskirts.position.y = sea ? WATER_Y - 6 : WATER_Y - 1.2;
  const rail = new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: .5, metalness: .6 }), conc = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: .9 });
  for (const b of bridges) {
    const len = b.v ? b.y1 - b.y0 : b.x1 - b.x0, wid = b.v ? b.x1 - b.x0 : b.y1 - b.y0, hy = b.h !== undefined ? b.h : 1.5;
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(b.v ? 1 : len, 3.2, b.v ? len : 1), rail);
      r.position.set(X((b.x0 + b.x1) / 2) + (b.v ? s * wid / 2 : 0), hy + 1.6, Z((b.y0 + b.y1) / 2) + (b.v ? 0 : s * wid / 2)); r.castShadow = true; cityGroup.add(r);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(b.v ? wid + 2 : len, 3, b.v ? len : wid + 2), conc); deck.position.set(X((b.x0 + b.x1) / 2), hy - 1.6, Z((b.y0 + b.y1) / 2)); deck.castShadow = true; cityGroup.add(deck);
    for (let k = .2; k < 1; k += .2) { const p = new THREE.Mesh(new THREE.BoxGeometry(b.v ? wid * .6 : 4, hy - BED + 2, b.v ? 4 : wid * .6), conc); p.position.set(X(b.v ? (b.x0 + b.x1) / 2 : b.x0 + len * k), (hy + BED) / 2, Z(b.v ? b.y0 + len * k : (b.y0 + b.y1) / 2)); cityGroup.add(p); }
  }
  buildCityWalls();
}
// крепостная стена старого города: кольцо с зубцами и башнями, ворота на лучах
function buildCityWalls() {
  if (!walls.length) return;
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: .9 }), roofM = new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: .8 });
  const g = new THREE.Group();
  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0), mx = (w.x0 + w.x1) / 2, my = (w.y0 + w.y1) / 2, ang = Math.atan2(w.y1 - w.y0, w.x1 - w.x0), hy = gY(mx, my);
    if (!w.gate) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 16, 6), stone); seg.position.set(X(mx), hy + 8, Z(my)); seg.rotation.y = -ang; seg.castShadow = seg.receiveShadow = true; g.add(seg);
      for (let k = -len / 2 + 2; k < len / 2; k += 5) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6.6), stone); m.position.set(X(mx + Math.cos(ang) * k), hy + 17.2, Z(my + Math.sin(ang) * k)); m.rotation.y = -ang; g.add(m); }
    } else {
      // ворота: арка из двух пилонов и перемычки
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(5, 20, 7), stone); p.position.set(X(mx + Math.cos(ang) * s * (len / 2 + 2)), hy + 10, Z(my + Math.sin(ang) * s * (len / 2 + 2))); p.rotation.y = -ang; p.castShadow = true; g.add(p); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(len + 8, 5, 7), stone); top.position.set(X(mx), hy + 18.5, Z(my)); top.rotation.y = -ang; top.castShadow = true; g.add(top);
    }
    if (w.tower) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 26, 12), stone); t.position.set(X(w.x0), hy + 13, Z(w.y0)); t.castShadow = t.receiveShadow = true; g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(7.5, 10, 12), roofM); r.position.set(X(w.x0), hy + 31, Z(w.y0)); r.castShadow = true; g.add(r);
    }
  }
  cityGroup.add(g);
}
function buildFences() {
  if (!fences.length) return;
  const m = new THREE.Matrix4(), f = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0x8d7a5c, roughness: .9 }), fences.length);
  fences.forEach(([x0, y0, x1, y1], i) => { const v = x0 === x1; m.makeScale(v ? .5 : x1 - x0, 4, v ? y1 - y0 : .5).setPosition(X((x0 + x1) / 2), gY((x0 + x1) / 2, (y0 + y1) / 2) - .5, Z((y0 + y1) / 2)); f.setMatrixAt(i, m); });
  f.castShadow = true; cityGroup.add(f);
}

/* ---------- машины: стоят, едут, переворачиваются ---------- */
const carBodyGeo = new THREE.BoxGeometry(18, 3.4, 7.2).translate(0, 2.6, 0);
const carCabGeo = new THREE.BoxGeometry(9.5, 3, 6.4).translate(-1, 5.6, 0);
const wheelGeo = new THREE.CylinderGeometry(1.4, 1.4, 1.2, 10).rotateX(Math.PI / 2);
const lightGeo = new THREE.BoxGeometry(.4, .8, 1.6);
let cm = null, carCap = 0;
function makeCarMeshes(cap) {
  if (cm) for (const k in cm) { scene.remove(cm[k]); cm[k].dispose(); }
  carCap = cap;
  const mk = (geo, mat, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); scene.add(m); return m; };
  cm = {
    body: mk(carBodyGeo, new THREE.MeshStandardMaterial({ roughness: .3, metalness: .5 }), cap),
    cab: mk(carCabGeo, new THREE.MeshStandardMaterial({ roughness: .08, metalness: .7 }), cap),
    wheels: mk(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .9 }), cap * 4),
    lights: mk(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), cap * 4, false),
    beams: mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff2d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), cap, false),
    bars: mk(new THREE.BoxGeometry(1.4, .8, 2.4), new THREE.MeshBasicMaterial({ toneMapped: false }), 200, false),
  };
  cm.beams.renderOrder = 2;
}
const _cm = new THREE.Matrix4(), _cw = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _cc = new THREE.Color();
function updateCars() {
  const list = cars.filter(c => !c.gone);
  if (list.length > carCap) makeCarMeshes(list.length + 200);
  const night = nightK > .3, ph = (simT * 3) % 1 < .5;
  let i = 0, li = 0, bi = 0, bar = 0;
  for (const c of list) {
    _ce.set(c.roll || 0, -c.ang, 0, "YXZ"); _cq.setFromEuler(_ce);
    const L = c.len || 1; _cs.set(L, c.crushed ? .35 : (c.service === "fire" || c.service === "army" ? 1.35 : c.service ? 1.18 : 1), c.service === "fire" || c.service === "army" ? 1.12 : 1);
    if (c.rx === undefined || Math.hypot(c.rx - c.x, c.ry - c.y) > 40) { c.rx = c.x; c.ry = c.y; } const rk = c.turnT > 0 ? .12 : .25; c.rx += (c.x - c.rx) * rk; c.ry += (c.y - c.ry) * rk;
    _cm.compose(_cv.set(X(c.rx), (c.z || 0) + (c.roll ? Math.abs(Math.sin(c.roll)) * 3.6 : 0) + gY(c.rx, c.ry), Z(c.ry)), _cq, _cs);
    cm.body.setMatrixAt(i, _cm); cm.cab.setMatrixAt(i, _cm);
    cm.body.setColorAt(i, _cc.set(c.wreck && c.boomT <= 0 ? "#1d1a18" : c.police ? "#e9e9ee" : c.col));
    if (c.police || c.service === "police") c.police = true;
    cm.cab.setColorAt(i, _cc.set(c.wreck && c.boomT <= 0 ? "#0c0b0a" : c.service === "army" ? "#3d4529" : c.service === "fire" ? "#8e1c14" : c.service === "ambulance" ? "#d8d8d2" : "#1a2028"));
    for (let k = 0; k < 4; k++) { _cw.makeTranslation(k < 2 ? -5.5 : 5.5, 1.4, k % 2 ? 3.4 : -3.4); cm.wheels.setMatrixAt(i * 4 + k, _cw.premultiply(_cm)); }
    // фары и стоп-сигналы
    const lit = !c.wreck && (c.moving || c.police);
    for (let k = 0; k < 4; k++) {
      _cw.makeTranslation(k < 2 ? 9.1 : -9.1, 3, k % 2 ? 2.6 : -2.6); cm.lights.setMatrixAt(li, _cw.premultiply(_cm));
      cm.lights.setColorAt(li, _cc.set(k < 2 ? (lit && night ? "#fff6dd" : "#9aa0a4") : (lit && (night || c.v < 3) ? "#ff2a1a" : "#5a1a16"))); li++;
    }
    if (c.moving && night) { _cw.makeScale(26, 1, 18).setPosition(16, .25, 0); cm.beams.setMatrixAt(bi++, _cw.premultiply(_cm)); }
    const sir = c.police ? "police" : c.siren;
    if (sir && !c.wreck && bar < 198 && (c.moving || c.deployed || c.police)) for (let k = 0; k < 2; k++) {
      _cw.makeTranslation(-1, 7.3, k ? 1.3 : -1.3); cm.bars.setMatrixAt(bar, _cw.premultiply(_cm));
      const on = (k === 0) === ph, col = sir === "police" ? (k ? "#2050ff" : "#ff2020") : sir === "amber" ? "#ffa020" : "#ff2020";
      cm.bars.setColorAt(bar, _cc.set(on ? col : "#111")); bar++;
    }
    i++;
  }
  cm.body.count = cm.cab.count = i; cm.wheels.count = i * 4; cm.lights.count = li; cm.beams.count = bi; cm.bars.count = bar;
  cm.beams.material.opacity = nightK * .5;
  for (const k in cm) { cm[k].instanceMatrix.needsUpdate = true; if (cm[k].instanceColor) cm[k].instanceColor.needsUpdate = true; }
}

/* ---------- обрушение зданий ---------- */
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function updateCity(dt) {
  if (gridDirty) { gridDirty = false; placeLamps(); refreshTrees(); }
  for (const b of buildings) {
    if (!b.obj || b.ruinDone || b.state === "ok") continue;
    if (!b.hid) { detachBuilding(b); if (!b.topple) { b.obj.children.forEach(o => o.visible = false); const sh = makeRuinShell(b); sh.userData.shell = true; b.obj.add(sh); } b.hid = true; for (const i of b.roofIdx || []) roofStuff.setMatrixAt(i, _zero); roofStuff.instanceMatrix.needsUpdate = true; if (b.sign) b.sign.visible = false; }
    if (b.topple) { animateTopple(b); if (b.state === "ruin") b.ruinDone = true; continue; }
    // дом оседает, качаясь, и уходит в завал
    const k = b.state === "ruin" ? 1 : clamp(b.cT / 4.2), e = k * k * (3 - 2 * k), drop = (b.h - b.ruinH) * e;
    b.obj.position.y = (b.baseY || 0) - drop;
    b.obj.rotation.z = Math.sin(b.x0) * .06 * e; b.obj.rotation.x = Math.cos(b.y0) * .05 * e;
    b.obj.position.x = X((b.x0 + b.x1) / 2) + (k < 1 ? Math.sin(simT * 40) * .6 * (1 - k) : 0);
    if (b.state === "ruin") b.ruinDone = true;
  }
}
/* ---------- баррикады ---------- */
const barrMax = 6000;
const barr = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ roughness: .9 }), barrMax);
barr.castShadow = barr.receiveShadow = true; barr.count = 0; scene.add(barr);
function updateBarricades() {
  if (!barrDirty) return; barrDirty = false;
  const m = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < grid.length && n < barrMax; i++) {
    if (grid[i] !== 6) continue;
    const gx = i % GW, gy = (i / GW) | 0, wall = wallMask[i], el = elecMask[i], hp = clamp(bhp[i] / (wall ? 300 : el ? 60 : 35), .25, 1), r = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
    // тонкая линия вдоль соседей: если слева/справа тоже заграждение — плита вытянута по x, иначе по z
    const hx = (gx > 0 && grid[i - 1] === 6) || (gx < GW - 1 && grid[i + 1] === 6), hy = (gy > 0 && grid[i - GW] === 6) || (gy < GH - 1 && grid[i + GW] === 6);
    const thin = wall ? .38 : el ? .25 : .55, sx = hx && !hy ? 1.01 : hy && !hx ? thin : hx && hy ? 1.01 : .7, sz = hx && !hy ? thin : hy && !hx ? 1.01 : hx && hy ? 1.01 : .7;
    m.makeScale(CS * sx, (wall ? 18 : el ? 9 : 6.5) * hp, CS * sz).setPosition(X(gx * CS + 4), gY(gx * CS + 4, gy * CS + 4), Z(gy * CS + 4));
    barr.setMatrixAt(n, m); barr.setColorAt(n, col.set(wall ? (r % 2 ? "#a19d93" : "#97938a") : el ? "#4a6a7a" : r % 3 === 0 ? "#8a7a5a" : r % 3 === 1 ? "#a3a29a" : "#7d6c4c").multiplyScalar(.6 + .4 * hp)); n++;
  }
  barr.count = n; barr.instanceMatrix.needsUpdate = true; if (barr.instanceColor) barr.instanceColor.needsUpdate = true;
}
