/* ---------- уют: времена года, снег и листопад, дым из труб, гирлянды, светлячки и пар, живые окна, золотой час,
   горожане на скамейках и в кафе, собаки на поводке, кошки у домов, звуки кафе, воды и канатки ----------
   Время года — world.season: summer, autumn, winter. Снег на крышах, земле и кронах и осенние кроны — вставка в шейдеры
   материалов (cozyMat), по общим униформам COZY. Всё здесь — только картинка и звук: симуляцию не трогает. */
const COZY = { snow: { value: 0 }, aut: { value: 0 }, winOn: { value: .5 }, winT: { value: 0 } };
const cozy = { cover: 0, fall: 0, aut: 0, chims: [], seats: [], sitters: [], seatMap: new Map(), seatT: 0, treeB: new Map(), vents: [], cafes: [], catSpots: [],
  dogs: [], dogT: 0, cats: [], catT: 0, smokeT: 0, garland: null, bulbs: null, creakT: 3, barkT: 8 };
const _czv = new THREE.Vector3(), _czv2 = new THREE.Vector3(), _czc = new THREE.Color(), _czm = new THREE.Matrix4(), _czq = new THREE.Quaternion(), _cze = new THREE.Euler(), _czs = new THREE.Vector3();
const czHash = n => ((Math.imul(n | 0, 2654435761) >>> 0) % 10007) / 10007;

/* ---------- шейдеры: снег по нормали, осенние кроны ---------- */
const COZY_GLSL = `varying vec3 vCzW;
uniform float czSnow, czAut, czKind;
float czH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float czN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(czH(i), czH(i + vec2(1., 0.)), f.x), mix(czH(i + vec2(0., 1.)), czH(i + 1.), f.x), f.y); }`;
// kind: 0 — всё подряд, 1 — земля (дороги и тротуары чистят, снега на них меньше), 2 — листва и трава (осенью желтеет)
function cozyMat(m, kind = 0) {
  if (!m || !m.isMeshStandardMaterial || m.userData.cozy || m.userData.noSnow) return; m.userData.cozy = true;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey() + "|cozy"; // ключ считаем до подмены: по умолчанию он — текст onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.czSnow = COZY.snow; sh.uniforms.czAut = COZY.aut; sh.uniforms.czKind = { value: kind };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vCzW;").replace("#include <project_vertex>", `#include <project_vertex>
      #ifdef USE_INSTANCING
        vCzW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
      #else
        vCzW = (modelMatrix * vec4(transformed, 1.)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + COZY_GLSL).replace("#include <color_fragment>", `#include <color_fragment>
      if (czKind > 1.5) {
        float czL = dot(diffuseColor.rgb, vec3(.3, .59, .11));
        if (czAut > .001) {
          // осень: у каждой кроны свой цвет — от золота до багрянца, часть остаётся зелёной
          #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            float czh = fract(sin(dot(vColor.rgb, vec3(91.7, 47.3, 13.1))) * 4375.85);
          #else
            float czh = czN(vCzW.xz * .05);
          #endif
          vec3 czA = czh < .3 ? vec3(.62, .36, .03) : czh < .55 ? vec3(.6, .2, .02) : czh < .72 ? vec3(.42, .07, .02) : czh < .86 ? vec3(.38, .3, .05) : diffuseColor.rgb / max(czL, .001);
          diffuseColor.rgb = mix(diffuseColor.rgb, czA * clamp(czL * 4.5, .18, .9), czAut * (czh < .86 ? 1. : 0.));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(czL) * vec3(.85, .9, .95), czSnow * .45); // зимой зелень тускнеет
      }`).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      if (czSnow > .001) {
        // снег лежит на том, что смотрит вверх; край сугроба неровный, на крутых скатах снега нет
        vec3 czUp = inverseTransformDirection(normal, viewMatrix);
        float czn = czN(vCzW.xz * .07) * .6 + czN(vCzW.xz * .45) * .4;
        float czS = czSnow * smoothstep(.4, .85, czUp.y) * smoothstep(.2, .5, czn + czSnow * .6 - .3);
        if (czKind > .5 && czKind < 1.5) { vec3 dc = diffuseColor.rgb; float sat = max(max(dc.r, dc.g), dc.b) - min(min(dc.r, dc.g), dc.b); czS *= mix(.35, 1., smoothstep(.01, .035, sat)); }
        if (czKind > 1.5) czS *= .8;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.4, .42, .46), czS); // лежалый, слежавшийся: свежие кучи (render20.js) на нём заметно ярче
        roughnessFactor = mix(roughnessFactor, .72, czS); metalnessFactor *= 1. - czS;
      }`);
  };
  m.customProgramCacheKey = () => key; m.needsUpdate = true;
}

/* ---------- живые окна: каждое окно горит по-своему, доля горящих зависит от часа ---------- */
facadeMats.forEach((m, i) => {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey() + "|win", cols = STYLES[i] && STYLES[i].curtain ? TBX * 2 : TBX;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.winOn = COZY.winOn; sh.uniforms.winT = COZY.winT; sh.uniforms.winCols = { value: cols };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float winOn, winT, winCols;").replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        // окно — клетка текстуры фасада; по его номеру решается, светится ли оно в этот час и чем: тёплой лампой или экраном телевизора
        vec2 wc = floor(vec2(vUv.x * winCols, vUv.y * ${TFL}.));
        float h = fract(sin(dot(wc, vec2(12.9898, 78.233))) * 43758.5453), h2 = fract(h * 91.37);
        vec3 tint = h2 < .08 ? vec3(.5, .65, 1.) * (.75 + .25 * sin(winT * 9. + h * 60.) * sin(winT * 2.3 + h * 17.)) : mix(vec3(1.1, .86, .6), vec3(1.), h2);
        totalEmissiveRadiance *= step(h, winOn) * tint;
      }`);
  };
  m.customProgramCacheKey = () => key; m.needsUpdate = true;
});
// доля горящих окон по часу: вечером почти все, к ночи гаснут, утром зажигаются снова
const WIN_ON = [[0, .32], [2, .16], [5, .1], [6.5, .42], [8.5, .25], [16, .4], [18.5, .72], [21.5, .8], [23, .55], [24, .32]];
function windowsOn(h) { for (let i = 1; i < WIN_ON.length; i++) if (h <= WIN_ON[i][0]) { const [h0, v0] = WIN_ON[i - 1], [h1, v1] = WIN_ON[i]; return v0 + (v1 - v0) * (h - h0) / (h1 - h0); } return .32; }

/* ---------- свет: золотой час, снежная дымка, окна ---------- */
const _czLighting = updateLighting;
updateLighting = function (dt, simDt) {
  _czLighting(dt, simDt);
  const el = Math.sin((world.hour - 6) / 12 * Math.PI), gloom = Math.max(world.rain * .55, world.fogK * .4, cozy.fall * .5);
  // солнце у горизонта: свет тёплый и густой, тени длинные, небо у земли персиковое
  const gold = clamp(1 - Math.abs(el - .1) * 5) * clamp(el * 12 + .6) * (1 - gloom);
  if (gold > .01) {
    sun.color.lerp(_czc.setHex(0xffad5a), gold * .45); hemi.color.lerp(_czc.setHex(0xffd6b0), gold * .3);
    scene.fog.color.lerp(_czc.setHex(0xf0b080), gold * .25); skyU.bot.value.lerp(_czc.setHex(0xffb070), gold * .3);
  }
  // снегопад: небо и даль белёсые, солнце за пеленой; лежащий снег подсвечивает тени
  if (cozy.fall > .01) {
    const k = Math.min(1, cozy.fall), g = _czc.setHex(0x9aa2aa).multiplyScalar(.3 + (1 - nightK) * .7);
    skyU.top.value.lerp(g, k * .6); skyU.bot.value.lerp(g, k * .6); scene.fog.color.lerp(g, k * .5); sun.intensity *= 1 - k * .4;
  }
  hemi.intensity *= 1 + cozy.cover * .06;
  COZY.winOn.value = windowsOn(world.hour); COZY.winT.value = performance.now() / 1000;
};

/* ---------- после постройки города: материалы под снег, трубы, гирлянды, места для сидящих, кошки, клапаны пара ---------- */
const _czBuildCity = buildCity;
buildCity = function () { _czBuildCity(); try { cozyBuild(); } catch (e) { console.warn("уют не собрался", e); } };
function cozyBuild() {
  // снег и осень — во все материалы сцены, кроме людей (у них своя раскраска) и полупрозрачного
  if (trees3d) { trees3d.detail.material.userData.czKind = 2; for (const t of trees3d.tiles) t.material.userData.czKind = 2; }
  if (treeLeaf) treeLeaf.material.userData.czKind = 2;
  if (typeof grass !== "undefined") grass.material.userData.czKind = 2;
  ground.material.userData.czKind = 1;
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !(m.transparent && m.opacity < 1)) cozyMat(m, m.userData.czKind || 0);
  });
  // трубы: верх трубы в координатах сцены
  cozy.chims = [];
  for (const b of buildings) if (b.obj) {
    b.obj.updateMatrixWorld(true);
    b.obj.traverse(o => { if (!o.userData.chim) return; const h = (o.geometry.parameters && o.geometry.parameters.height) || 5, p = o.localToWorld(new THREE.Vector3(0, h / 2, 0)); cozy.chims.push({ x: p.x, y: p.y, z: p.z, b, big: o.userData.chim === 2, h: czHash(cozy.chims.length + 17) }); });
  }
  // деревья по клеткам 80 × 80 — светлячки и листопад берутся у ближайших
  cozy.treeB = new Map();
  for (const t of trees) { const k = Math.floor(t.x / 80) + ":" + Math.floor(t.y / 80); let B = cozy.treeB.get(k); if (!B) cozy.treeB.set(k, B = []); B.push(t); }
  // места: по два на скамейке, стулья у кафе
  cozy.seats = []; cozy.seatMap = new Map(); for (const s of cozy.sitters) s.gone = true; cozy.sitters = [];
  for (const p of props) if (p.k === "bench") for (const s of [-1, 1]) { const ax = Math.sin(p.a), ay = -Math.cos(p.a); cozy.seats.push({ x: p.x + ax * s * 1.25 - Math.cos(p.a) * .45, y: p.y + ay * s * 1.25 - Math.sin(p.a) * .45, dir: p.a, cafe: false }); }
  cozy.cafes = [];
  for (const b of buildings) if (b.kind === "cafe" && b.obj && b.seats) {
    cozy.cafes.push([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
    for (const [lx, lz, fx, fz] of b.seats) { const p = b.obj.localToWorld(_czv.set(lx, 0, lz)), v = _czv2.set(fx, 0, fz).applyQuaternion(b.obj.quaternion); const dir = Math.atan2(v.z, v.x); cozy.seats.push({ x: p.x + W / 2 - Math.cos(dir) * .35, y: p.z + H / 2 - Math.sin(dir) * .35, dir, cafe: true }); }
  }
  // кошки сидят перед частными домами
  cozy.catSpots = [];
  for (const b of buildings) {
    if (!b.obj || !b.mesh || !/^(house|oldhouse|cottage|dacha|farmhouse)$/.test(b.kind) || czHash(b.id * 7 + 3) > .22) continue;
    const pr = b.mesh.geometry.parameters || {}, d = pr.depth || 10, w = pr.width || 10, p = b.obj.localToWorld(_czv.set((czHash(b.id) - .5) * w * .6, 0, d / 2 + 4.6)); // перед крыльцом, не под навесом
    const v = _czv2.set(0, 0, 1).applyQuaternion(b.obj.quaternion);
    cozy.catSpots.push({ x: p.x + W / 2, y: p.z + H / 2, dir: Math.atan2(v.z, v.x), id: b.id });
  }
  // откуда зимой идёт пар: люки на проезжей части
  cozy.vents = [];
  for (let k = 0; k < 6000 && cozy.vents.length < 500; k++) { const i = Math.floor(Math.random() * GW * GH); if (roadMask[i] === 1 && !crossMask[i] && grid[i] === 0) cozy.vents.push([(i % GW) * CS + CS / 2, Math.floor(i / GW) * CS + CS / 2, Math.random() * 10]); }
  buildGarlands();
}

/* ---------- гирлянды: над улицами центра и старого города, на террасах кафе ---------- */
const GARLAND_CH = new Set(["center", "old", "plaza", "mid"]);
const BULB_COLS = [0xffd9a0, 0xffd9a0, 0xffe4b8, 0xffcf8a, 0xff6a50, 0x7ae08a, 0x7aa8ff, 0xffc24a];
function buildGarlands() {
  const pts = [], wire = [];
  const hang = (ax, ay, az, bx, by, bz, sag) => {
    const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(2, Math.round(L / 2.3));
    let px = ax, py = ay, pz = az;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t - sag * 4 * t * (1 - t), z = az + (bz - az) * t;
      wire.push(px, py, pz, x, y, z); px = x; py = y; pz = z;
      if (k < n) pts.push(x, y - .35, z);
    }
  };
  // через улицу: фонарь и фонарь напротив, в центре, старом городе, на площадях и в кварталах вокруг центра
  const LB = new Map(), lk = (x, y) => Math.floor(x / 64) + ":" + Math.floor(y / 64);
  lamps.forEach((l, i) => { const k = lk(l.x, l.y); let B = LB.get(k); if (!B) LB.set(k, B = []); B.push(i); });
  const used = new Set(); let n = 0;
  lamps.forEach((l, i) => {
    if (used.has(i) || l.down || n > 260) return;
    const ca = Math.cos(l.a), sa = Math.sin(l.a), bk = blockAt(l.x - ca * 14, l.y - sa * 14);
    if (!bk || !GARLAND_CH.has(bk.ch)) return;
    let best = -1, bd = 1e9;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const j of LB.get((Math.floor(l.x / 64) + gx) + ":" + (Math.floor(l.y / 64) + gy)) || []) {
      const m = lamps[j]; if (j === i || used.has(j) || m.down) continue;
      const dx = m.x - l.x, dy = m.y - l.y, d = Math.hypot(dx, dy);
      if (d < 18 || d > 90 || (dx * ca + dy * sa) / d < .65 || Math.cos(m.a - l.a) > -.7) continue;
      if (d < bd) { bd = d; best = j; }
    }
    if (best < 0) return;
    used.add(i); used.add(best); n++;
    const m = lamps[best];
    hang(X(l.x), gY(l.x, l.y) + 15, Z(l.y), X(m.x), gY(m.x, m.y) + 15, Z(m.y), 2.2 + bd * .04);
  });
  for (const b of buildings) if (b.kind === "cafe" && b.obj && b.lights) for (const [ax, ay, az, bx, by, bz, sag] of b.lights) {
    const A = b.obj.localToWorld(_czv.set(ax, ay, az)).clone(), B = b.obj.localToWorld(_czv2.set(bx, by, bz));
    hang(A.x, A.y, A.z, B.x, B.y, B.z, sag);
  }
  const nb = pts.length / 3;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.32, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, nb));
  bulbs.material.userData.noSnow = true;
  for (let i = 0; i < nb; i++) { _czm.makeTranslation(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); bulbs.setMatrixAt(i, _czm); bulbs.setColorAt(i, _czc.setHex(BULB_COLS[(i * 7 + (i >> 3)) % BULB_COLS.length])); }
  bulbs.count = nb; bulbs.frustumCulled = false;
  const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(wire, 3));
  const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1e1c1a }));
  cityGroup.add(bulbs, wires); cozy.bulbs = bulbs; cozy.garland = wires;
}

/* ---------- снегопад: хлопья вокруг камеры ---------- */
const SNOW_N = 7000, snowPos = new Float32Array(SNOW_N * 3), snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: radialTex([[0, "rgba(255,255,255,1)"], [.45, "rgba(255,255,255,.85)"], [1, "rgba(255,255,255,0)"]]), size: 1.5, transparent: true, depthWrite: false, opacity: .9 }));
snowPts.frustumCulled = false; snowPts.visible = false; scene.add(snowPts);
const flakes = Array.from({ length: SNOW_N }, () => [rnd(-1, 1), rnd(0, 1), rnd(-1, 1), rnd(0, TAU), rnd(.7, 1.3)]);
function stepSnow(dt) {
  snowPts.visible = cozy.fall > .02; if (!snowPts.visible) return;
  // объём хлопьев между камерой и точкой, куда она смотрит: и вблизи, и с высоты снег виден
  const cp = camera.position, k = fps.on ? 0 : clamp(camC.dist / 900), cx = cp.x + (camC.tx - cp.x) * (.35 + k * .3), cz = cp.z + (camC.tz - cp.z) * (.35 + k * .3);
  const R = 180 + camC.dist * .35, y0 = fps.on ? cp.y - 40 : Math.max(0, cp.y * .25 - 60), top = fps.on ? 120 : Math.max(220, cp.y * .9), t = performance.now() / 1000;
  const wind = world.weather === "storm" ? 26 : 4, fallV = (world.weather === "storm" ? 14 : 7) / top;
  for (let i = 0; i < SNOW_N; i++) {
    const f = flakes[i]; f[1] -= dt * fallV * f[4]; f[0] += dt * wind / R; if (f[1] < 0 || f[0] > 1) { f[1] += 1; if (f[0] > 1) f[0] -= 2; f[2] = rnd(-1, 1); }
    snowPos[i * 3] = cx + f[0] * R + Math.sin(t * .9 * f[4] + f[3]) * 1.6; snowPos[i * 3 + 1] = y0 + f[1] * top; snowPos[i * 3 + 2] = cz + f[2] * R + Math.cos(t * .7 + f[3]) * 1.6;
  }
  snowGeo.setDrawRange(0, Math.floor(SNOW_N * Math.min(1, cozy.fall))); snowGeo.attributes.position.needsUpdate = true;
  snowPts.material.size = 1.5 * (1 + camC.dist / 700) * (fps.on ? .8 : 1);
  snowPts.material.color.setScalar(.55 + (1 - nightK) * .45);
}

/* ---------- ближайшие деревья: случайное из клеток вокруг точки ---------- */
function treeNear(x, y, R) {
  for (let k = 0; k < 10; k++) { const B = cozy.treeB.get(Math.floor((x + rnd(-R, R)) / 80) + ":" + Math.floor((y + rnd(-R, R)) / 80)); if (B && B.length) { const t = B[Math.floor(Math.random() * B.length)]; if (!t.burnt) return t; } }
  return null;
}

/* ---------- листопад ---------- */
const LEAF_N = 500;
const leaves3d = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .9 }), LEAF_N);
leaves3d.count = 0; leaves3d.frustumCulled = false; leaves3d.castShadow = false; leaves3d.setColorAt(0, _czc.setHex(0xffffff)); scene.add(leaves3d);
leaves3d.material.userData.noSnow = true;
const leafList = [];
function stepLeaves(dt) {
  const on = cozy.aut > .3 && (fps.on || camC.dist < 700) && cozy.fall < .1;
  const cx = camC.tx + W / 2, cy = camC.tz + H / 2, t = performance.now() / 1000, wind = world.weather === "storm" ? 9 : world.rain > .2 ? 4 : 1.6;
  if (on && dt > 0) for (let n = Math.random() < dt * 30 ? 1 : 0; n > 0 && leafList.length < LEAF_N; n--) {
    const tr = treeNear(cx, cy, 160); if (!tr) break;
    const gy = gY(tr.x, tr.y), hh = tr.h * 1.45;
    leafList.push({ x: X(tr.x) + rnd(-1, 1) * tr.r, y: gy + hh * rnd(.55, .85), z: Z(tr.y) + rnd(-1, 1) * tr.r, gy, ph: rnd(0, TAU), rs: rnd(1, 3), c: new THREE.Color().setHSL(rnd(.02, .13), rnd(.6, .85), rnd(.32, .5)), rest: 0 });
  }
  let n = 0;
  for (let i = leafList.length - 1; i >= 0; i--) {
    const L = leafList[i];
    if (L.rest > 0) { L.rest -= dt; if (L.rest <= 0 || !on) { leafList[i] = leafList[leafList.length - 1]; leafList.pop(); continue; } }
    else { L.y -= dt * (2.2 + Math.sin(t * 3 + L.ph) * .8); L.x += dt * (wind + Math.sin(t * 1.7 + L.ph) * 2.2); L.z += dt * (wind * .4 + Math.cos(t * 1.3 + L.ph) * 2.2); if (L.y <= L.gy + .08) { L.y = L.gy + .08; L.rest = rnd(6, 12); } }
    const fall = L.rest > 0 ? 0 : 1;
    _cze.set(fall ? t * L.rs + L.ph : -Math.PI / 2, L.ph, fall ? Math.sin(t * 2 + L.ph) : 0); _czq.setFromEuler(_cze);
    _czm.compose(_czv.set(L.x, L.y, L.z), _czq, _czs.setScalar(L.rest > 0 ? Math.min(1, L.rest) : 1)); leaves3d.setMatrixAt(n, _czm); leaves3d.setColorAt(n, L.c); n++;
  }
  leaves3d.count = n; leaves3d.instanceMatrix.needsUpdate = true; if (leaves3d.instanceColor) leaves3d.instanceColor.needsUpdate = true;
}

/* ---------- светлячки летними ночами у деревьев ---------- */
const FF_N = 240, ffPos = new Float32Array(FF_N * 3), ffCol = new Float32Array(FF_N * 3), ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3).setUsage(THREE.DynamicDrawUsage)); ffGeo.setAttribute("color", new THREE.BufferAttribute(ffCol, 3).setUsage(THREE.DynamicDrawUsage));
const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: glowTex, size: 2.4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
fireflies.frustumCulled = false; fireflies.visible = false; scene.add(fireflies);
const ffList = Array.from({ length: FF_N }, () => ({ x: 0, y: -1e4, z: 0, ph: rnd(0, TAU), sp: rnd(.6, 1.4), life: 0 }));
function stepFireflies(dt) {
  const k = world.season === "summer" ? clamp((nightK - .35) * 3) * (1 - world.rain) * (1 - world.fogK * .6) : 0;
  fireflies.visible = k > .02 && (fps.on || camC.dist < 700); if (!fireflies.visible) return;
  const cx = camC.tx + W / 2, cy = camC.tz + H / 2, t = performance.now() / 1000;
  for (let i = 0; i < FF_N; i++) {
    const f = ffList[i]; f.life -= dt;
    if (f.life <= 0) { const tr = treeNear(cx, cy, 220); f.life = rnd(8, 20); if (tr) { f.x = X(tr.x) + rnd(-10, 10); f.z = Z(tr.y) + rnd(-10, 10); f.y = gY(tr.x, tr.y) + rnd(1.2, 6); } else f.y = -1e4; }
    ffPos[i * 3] = f.x + Math.sin(t * .5 * f.sp + f.ph) * 3; ffPos[i * 3 + 1] = f.y + Math.sin(t * 1.1 * f.sp + f.ph * 2) * .8; ffPos[i * 3 + 2] = f.z + Math.cos(t * .4 * f.sp + f.ph * 1.3) * 3;
    const b = Math.pow(Math.max(0, Math.sin(t * 1.6 * f.sp + f.ph * 3)), 5) * k * 1.8;
    ffCol[i * 3] = b; ffCol[i * 3 + 1] = b * .95; ffCol[i * 3 + 2] = b * .35;
  }
  ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true;
}

/* ---------- дым из труб и пар от асфальта ---------- */
const CHIM_C = [.36, .34, .33], CHIM_C1 = [.62, .62, .64], STEAM_C = [.86, .87, .9];
function stepSmoke(dt) {
  if (!dt) return;
  const winter = world.season === "winter", autumn = world.season === "autumn";
  // какая доля печей топится: зимой почти все, осенью половина, летом изредка; вечером и ночью чаще
  const share = (winter ? .9 : autumn ? .5 : .12) * (1 + nightK * .3), wind = world.weather === "storm" ? 10 : 2.6;
  const cx = camC.tx, cz = camC.tz, R = 380 + camC.dist * .6;
  cozy.smokeT = Math.min(cozy.smokeT + dt * 260, 40); // не больше 260 клубов в секунду на все трубы: частиц дыма общий запас с пожарами
  for (const c of cozy.chims) {
    if (cozy.smokeT < 1) break;
    if (Math.abs(c.x - cx) > R || Math.abs(c.z - cz) > R || (!c.big && c.h > share)) continue;
    const b = c.b; if (b.state !== "ok" || b.gutted || b.fire > 0 || b.hid) continue;
    if (Math.random() > dt * (c.big ? 7 : 1.8)) continue;
    cozy.smokeT--;
    if (c.big) emit(PS_SMOKE, { x: c.x + rnd(-1, 1), y: c.y + 1, z: c.z + rnd(-1, 1), vx: wind * 2 + rnd(-1, 1), vy: rnd(7, 10), vz: wind * .8 + rnd(-1, 1), l: rnd(10, 14), s0: 8, s1: rnd(50, 70), c: STEAM_C, a: .35, fadeIn: true, dr: .06 });
    else emit(PS_SMOKE, { x: c.x + rnd(-.3, .3), y: c.y + .4, z: c.z + rnd(-.3, .3), vx: wind + rnd(-.6, .6), vy: rnd(2.5, 4), vz: wind * .4 + rnd(-.6, .6), l: rnd(6, 9), s0: 2, s1: rnd(14, 22), c: CHIM_C, c1: CHIM_C1, a: .42, fadeIn: true, dr: .08 });
  }
  // пар: зимой из люков, после дождя — от тёплого асфальта на солнце
  const after = !winter && world.wet > .3 && world.rain < .15 && nightK < .6;
  if (winter && (fps.on || camC.dist < 900)) for (const v of cozy.vents) {
    const x = X(v[0]), z = Z(v[1]); if (Math.abs(x - cx) > 260 || Math.abs(z - cz) > 260 || Math.random() > dt * 2) continue;
    emit(PS_SMOKE, { x: x + rnd(-1, 1), y: gY(v[0], v[1]) + .3, z: z + rnd(-1, 1), vx: rnd(-.5, .5) + 1, vy: rnd(2, 3.5), vz: rnd(-.5, .5), l: rnd(3, 5), s0: 2, s1: rnd(9, 14), c: STEAM_C, a: .22, fadeIn: true, dr: .1 });
  }
  if (after && (fps.on || camC.dist < 700)) for (let n = 0; n < 3; n++) {
    if (Math.random() > dt * 8 * clamp((world.wet - .3) * 3)) continue;
    const x = camC.tx + W / 2 + rnd(-200, 200), y = camC.tz + H / 2 + rnd(-200, 200), i = clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1);
    if (roadMask[i] !== 1) continue;
    emit(PS_SMOKE, { x: X(x), y: gY(x, y) + .3, z: Z(y), vx: rnd(-.6, .6) + .8, vy: rnd(.8, 1.6), vz: rnd(-.6, .6), l: rnd(3, 5), s0: 4, s1: rnd(14, 20), c: STEAM_C, a: .1, fadeIn: true, dr: .1 });
  }
}

/* ---------- горожане на скамейках и за столиками ---------- */
// таз стоящего на высоте ~3,25 × рост; у сидящего — чуть выше сиденья (1,65)
const SIT_HIP = 1.95, HIP_STAND = 3.25;
// сидячая поза поверх стоячей анимации: бёдра вперёд и чуть вниз, голени отвесно
function sitPose(s, a) {
  const fx = Math.cos(a.dir), fz = Math.sin(a.dir); _czv.set(-fz, 0, fx);
  s.root.updateMatrixWorld(true);
  bendBone(s.bones.UpperLegL, _czv.clone(), 1.2); bendBone(s.bones.UpperLegR, _czv.clone(), 1.2);
  s.root.updateMatrixWorld(true);
  bendBone(s.bones.LowerLegL, _czv.clone(), -.85); bendBone(s.bones.LowerLegR, _czv.clone(), -.85);
  // стопы в этом скелете — отдельные кости от корня, не дети голени: переносим их к концу голени
  s.root.updateMatrixWorld(true);
  for (const k of ["L", "R"]) { const f = s.bones["Foot" + k], e = s.bones["LowerLeg" + k + "_end"]; if (!f || !e) continue; f.position.copy(f.parent.worldToLocal(e.getWorldPosition(_czv2))); }
}
function seatShare(cafe) {
  const h = world.hour;
  let k = h < 7.5 ? 0 : h < 11 ? .25 : h < 19 ? .45 : h < 22 ? (cafe ? .6 : .25) : h < 23.5 && cafe ? .3 : 0;
  if (world.rain > .2 || cozy.fall > .2) k = cafe ? k * .15 : 0;
  if (world.season === "winter") k *= cafe ? .35 : .12; else if (world.season === "autumn") k *= .7;
  return k;
}
function stepSitters(dt) {
  cozy.seatT -= dt; if (cozy.seatT > 0) return; cozy.seatT = 1;
  const show = prefs.realPeople !== false && (fps.on || camC.dist < 520), cp = camera.position, want = new Set();
  if (show && agents.length) {
    const kB = seatShare(false), kC = seatShare(true), slot = Math.floor(world.hour * 2);
    cozy.seats.forEach((s, i) => {
      if (Math.abs(X(s.x) - cp.x) > 230 || Math.abs(Z(s.y) - cp.z) > 230) return;
      if (czHash(i * 31 + slot * 977) > (s.cafe ? kC : kB)) return;
      let zn = 0; nearZ(s.x, s.y, 80, () => zn++); if (zn) return; // рядом зомби — встали и ушли
      want.add(i);
    });
  }
  for (const [i, a] of cozy.seatMap) if (!want.has(i)) { a.gone = true; cozy.seatMap.delete(i); }
  for (const i of want) if (!cozy.seatMap.has(i)) {
    const s = cozy.seats[i]; let src = null;
    for (let k = 0; k < 60 && !src; k++) { const a = agents[(i * 7919 + k * 131) % agents.length]; if (a.role === "civ" && a.state === "alive" && a.age !== "kid") src = a; }
    if (!src) continue;
    cozy.seatMap.set(i, { id: 2e6 + i, fake: true, sit: true, x: s.x, y: s.y, z: SIT_HIP - HIP_STAND * src.size, dir: s.dir, state: "alive", role: "civ", speed: 0, sex: src.sex, age: src.age, skin: src.skin, cloth: src.cloth, pants: src.pants, hair: src.hair, hat: src.hat, size: src.size, build: src.build, panic: 0 });
  }
  cozy.sitters = [...cozy.seatMap.values()];
}

/* ---------- собаки на поводке ---------- */
const DOG_COLS = [0x6a4428, 0x2a2420, 0xc89a5a, 0xe8e2d6, 0x8a6a4a, 0x4a3a30];
const dogMats = DOG_COLS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 })), dogDark = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: .7 });
const leashGeo = new THREE.BufferGeometry(), leashPos = new Float32Array(24 * 12); leashGeo.setAttribute("position", new THREE.BufferAttribute(leashPos, 3).setUsage(THREE.DynamicDrawUsage));
const leashes = new THREE.LineSegments(leashGeo, new THREE.LineBasicMaterial({ color: 0x3a2418 })); leashes.frustumCulled = false; scene.add(leashes);
function makeDog(i) {
  const g = new THREE.Group(), mat = dogMats[i % dogMats.length], box = (sx, sy, sz, x, y, z, m = mat, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  box(2.6, 1.05, 1, 0, 1.75, 0); box(1, .9, .85, 1.55, 2.35, 0); box(.6, .45, .5, 2.25, 2.15, 0); box(.18, .18, .2, 2.58, 2.25, 0, dogDark);
  for (const s of [-1, 1]) box(.22, .5, .22, 1.35, 2.9, s * .3, dogDark);
  const legs = [];
  for (const [x, z] of [[.95, .32], [.95, -.32], [-.95, .32], [-.95, -.32]]) { const p = new THREE.Group(); p.position.set(x, 1.45, z); g.add(p); box(.28, 1.4, .28, 0, -.7, 0, mat, p); legs.push(p); }
  const tail = new THREE.Group(); tail.position.set(-1.3, 2.05, 0); g.add(tail); box(1.1, .2, .2, -.5, 0, 0, mat, tail); tail.rotation.z = -.6;
  g.visible = false; scene.add(g);
  return { g, legs, tail, owner: null, x: 0, y: 0, dir: 0, ph: rnd(0, TAU) };
}
function stepDogs(dt) {
  const show = fps.on || camC.dist < 520, cp = camera.position;
  cozy.dogT -= dt;
  if (cozy.dogT <= 0) {
    cozy.dogT = .5;
    const want = [];
    if (show && world.rain < .3 && cozy.fall < .3) for (const a of agents) {
      if (a.role !== "civ" || a.state !== "alive" || a.hidden || a.age === "kid" || a.id % 9 || (a.panic || 0) > .3 || a.onBus) continue;
      const d = Math.hypot(X(a.x) - cp.x, Z(a.y) - cp.z); if (d < 200) want.push([d, a]);
    }
    want.sort((p, q) => p[0] - q[0]); const W2 = new Set(want.slice(0, 16).map(p => p[1]));
    for (const d of cozy.dogs) if (d.owner && !W2.has(d.owner)) { d.owner = null; d.g.visible = false; }
    for (const a of W2) {
      if (cozy.dogs.some(d => d.owner === a)) continue;
      let d = cozy.dogs.find(d => !d.owner); if (!d) { if (cozy.dogs.length >= 16) break; d = makeDog(cozy.dogs.length); cozy.dogs.push(d); }
      d.owner = a; d.x = a.x - Math.cos(a.dir) * 3; d.y = a.y - Math.sin(a.dir) * 3; d.dir = a.dir; d.g.visible = true;
    }
  }
  let nl = 0;
  for (const d of cozy.dogs) {
    const a = d.owner; if (!a) continue;
    if (a.state !== "alive" || a.role !== "civ" || (a.panic || 0) > .3) { d.owner = null; d.g.visible = false; continue; }
    // бежит чуть позади и сбоку от хозяина, на поводке длиной 5
    const fx = Math.cos(a.dir), fy = Math.sin(a.dir), side = a.id % 2 ? 1 : -1, tx = a.x - fx * 2.6 - fy * side * 1.8, ty = a.y - fy * 2.6 + fx * side * 1.8;
    const dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy), v = Math.min(dist * 3, 28);
    if (dist > .05) { d.x += dx / dist * v * dt; d.y += dy / dist * v * dt; }
    if (Math.hypot(d.x - a.x, d.y - a.y) > 6) { d.x = a.x - fx * 3; d.y = a.y - fy * 3; }
    if (v > .6) { let da = Math.atan2(dy, dx) - d.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); d.dir += da * Math.min(1, dt * 6); }
    d.ph += dt * v * .9;
    const gy = gY(d.x, d.y);
    d.g.position.set(X(d.x), gy, Z(d.y)); d.g.rotation.y = -d.dir;
    const sw = Math.min(1, v / 8) * .6;
    d.legs.forEach((l, k) => l.rotation.z = Math.sin(d.ph + (k === 0 || k === 3 ? 0 : Math.PI)) * sw);
    d.tail.rotation.y = Math.sin(performance.now() / 90 + d.ph) * .5;
    // поводок от руки хозяина к ошейнику, с провисом
    const hx = X(a.x) + fx * .6 - fy * side * 1.1, hy = gY(a.x, a.y) + 3.7, hz = Z(a.y) + fy * .6 + fx * side * 1.1;
    const nx = X(d.x) + Math.cos(d.dir) * 1.2, ny = gy + 2.3, nz = Z(d.y) + Math.sin(d.dir) * 1.2, mx = (hx + nx) / 2, my = (hy + ny) / 2 - .9, mz = (hz + nz) / 2;
    if (nl < 24) { leashPos.set([hx, hy, hz, mx, my, mz, mx, my, mz, nx, ny, nz], nl * 12); nl++; }
  }
  leashGeo.setDrawRange(0, nl * 4); leashGeo.attributes.position.needsUpdate = true; leashes.visible = nl > 0;
  cozy.barkT -= dt;
  if (cozy.barkT <= 0) { cozy.barkT = rnd(9, 25); const d = cozy.dogs.find(d => d.owner && Math.hypot(X(d.x) - cp.x, Z(d.y) - cp.z) < 120); if (d) sfx.bark(d.x, d.y); }
}

/* ---------- кошки у домов ---------- */
const CAT_COLS = [0xd88a3a, 0x9a9690, 0xf0ece4, 0xc87a3a, 0x2a2420, 0xb0a898];
const catMats = CAT_COLS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 }));
function makeCat(i) {
  const g = new THREE.Group(), mat = catMats[i % catMats.length], add = (geo, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(.5, 10, 8).scale(1.1, 1.3, .9), 0, .62, 0);
  const head = new THREE.Group(); head.position.set(.3, 1.35, 0); g.add(head); add(new THREE.SphereGeometry(.34, 10, 8), 0, 0, 0, head);
  for (const s of [-1, 1]) add(new THREE.ConeGeometry(.12, .28, 4), .02, .34, s * .17, head);
  const tail = new THREE.Group(); tail.position.set(-.5, .25, 0); g.add(tail); add(new THREE.CylinderGeometry(.07, .09, 1.1, 5).rotateZ(1.2), -.45, .2, 0, tail);
  g.visible = false; scene.add(g);
  return { g, head, tail, spot: null };
}
function stepCats(dt) {
  const cp = camera.position, show = (fps.on || camC.dist < 380) && world.hour > 7 && world.hour < 21.5 && world.rain < .2 && cozy.fall < .2;
  cozy.catT -= dt;
  if (cozy.catT <= 0) {
    cozy.catT = 1;
    const want = show ? cozy.catSpots.map(s => [Math.hypot(X(s.x) - cp.x, Z(s.y) - cp.z), s]).filter(p => p[0] < 220).sort((p, q) => p[0] - q[0]).slice(0, 12).map(p => p[1]).filter(s => { let zn = 0; nearZ(s.x, s.y, 60, () => zn++); return !zn; }) : [];
    const W2 = new Set(want);
    for (const c of cozy.cats) if (c.spot && !W2.has(c.spot)) { c.spot = null; c.g.visible = false; }
    for (const s of want) {
      if (cozy.cats.some(c => c.spot === s)) continue;
      let c = cozy.cats.find(c => !c.spot); if (!c) { if (cozy.cats.length >= 12) break; c = makeCat(cozy.cats.length); cozy.cats.push(c); }
      c.spot = s; c.g.visible = true; c.g.position.set(X(s.x), gY(s.x, s.y), Z(s.y)); c.g.rotation.y = -s.dir + (czHash(s.id) - .5) * 1.5;
    }
  }
  const t = performance.now() / 1000;
  for (const c of cozy.cats) if (c.spot) { c.tail.rotation.y = Math.sin(t * 1.3 + c.spot.id) * .7; c.head.rotation.y = Math.sin(t * .35 + c.spot.id * 2) * .6; }
}

/* ---------- кадр: время года, частицы, гирлянды, жизнь на улицах ---------- */
function updateCozy(fxDt, dt) {
  const winter = world.season === "winter", autumn = world.season === "autumn";
  const snowing = world.weather === "snow" || (winter && (world.weather === "rain" || world.weather === "storm"));
  cozy.cover += ((winter ? 1 : world.weather === "snow" ? .75 : 0) - cozy.cover) * Math.min(1, dt * .35);
  cozy.fall += ((snowing ? (world.weather === "storm" ? 1.4 : 1) : 0) - cozy.fall) * Math.min(1, dt * .5);
  cozy.aut += ((autumn ? 1 : 0) - cozy.aut) * Math.min(1, dt * .35);
  COZY.snow.value = cozy.cover; COZY.aut.value = cozy.aut;
  if (typeof grass !== "undefined" && cozy.cover > .55) grass.visible = false; // траву замело
  // гирлянды: днём лампочки чуть видны, в сумерках разгораются; без света гаснут
  if (cozy.bulbs) { const k = settings.dark ? 0 : .35 + clamp(nightK * 1.4) * 2.2, tw = 1 + Math.sin(performance.now() / 700) * .04; cozy.bulbs.material.color.setScalar(k * tw); }
  stepSnow(dt); stepLeaves(fxDt); stepFireflies(dt); stepSmoke(fxDt); stepSitters(dt); stepDogs(fxDt); stepCats(dt);
}

/* ---------- звуки: кафе, вода у берега, скрип канатки ---------- */
Object.assign(RECIPES, {
  creak: [1.1, (c, out) => { const o = osc(c, "sawtooth", 140), bp = filt(c, "bandpass", 900, 6), g = c.createGain(); o.frequency.setValueAtTime(140, 0); o.frequency.linearRampToValueAtTime(190, .5); o.frequency.linearRampToValueAtTime(120, 1); const am = osc(c, "square", 38), ag = c.createGain(); ag.gain.value = .5; am.connect(ag).connect(g.gain); env(c, g, [[0, 0], [.15, .5], [.8, .4], [1.08, .001, 1]]); o.connect(bp).connect(g).connect(out); o.start(); am.start(); }],
});
Object.assign(LOOPS, {
  // кафе: негромкий разговор и звон чашек
  cafe: [7, (c, out) => {
    const n = noiseSrc(c, 7, "pink"), bp = filt(c, "bandpass", 600, .8), g = c.createGain(); g.gain.value = .12; const l = osc(c, "sine", .31), lg = c.createGain(); lg.gain.value = .05; l.connect(lg).connect(g.gain); n.connect(bp).connect(g).connect(out); n.start(); l.start();
    for (let i = 0; i < 26; i++) { const t = Math.random() * 6.8, f = rnd(2400, 5200), o = osc(c, "sine", f), o2 = osc(c, "sine", f * 2.76), cg = c.createGain(); env(c, cg, [[0, 0], [t, 0], [t + .003, rnd(.05, .14)], [t + rnd(.15, .35), .001, 1]]); o.connect(cg); o2.connect(cg); cg.connect(out); o.start(); o2.start(); }
  }],
  // вода у берега: мягкие накаты волн
  lap: [6, (c, out) => {
    for (let t = 0; t < 6; t += rnd(1.1, 1.8)) { const n = noiseSrc(c, 2, "brown"), lp = filt(c, "lowpass", rnd(500, 900)), g = c.createGain(); env(c, g, [[0, 0], [t, 0], [t + .35, rnd(.6, 1)], [Math.min(5.99, t + 1.4), .001, 1]]); n.connect(lp).connect(g).connect(out); n.start(); }
    const hs = noiseSrc(c, 6, "pink"), hp = filt(c, "highpass", 2500), hg = c.createGain(); hg.gain.value = .04; hs.connect(hp).connect(hg).connect(out); hs.start();
  }],
});
const _czAudio = updateAudio;
updateAudio = function (dt) {
  _czAudio(dt);
  if (!AC || !audioReady || muted) return;
  const tx = camC.tx + W / 2, ty = camC.tz + H / 2, zoomK = clamp(1.25 - camC.dist / 2400, .25, 1), winter = world.season === "winter";
  // зимой сверчков нет, осенью их мало; в метель ветер сильнее
  setLoop("crickets", nightK * (1 - world.rain) * .35 * zoomK * (winter ? 0 : world.season === "autumn" ? .4 : 1));
  if (cozy.fall > .05) setLoop("wind", .12 + cozy.fall * .3 + (world.weather === "storm" ? .3 : 0));
  // кафе рядом с камерой: днём и вечером, если тихо
  let best = null, bd = 1e9; for (const p of cozy.cafes) { const d = Math.hypot(p[0] - tx, p[1] - ty); if (d < bd) { bd = d; best = p; } }
  if (best && bd < 220) { let zn = 0; nearZ(best[0], best[1], 100, () => zn++); const s = spatial(best[0], best[1], 3), open = world.hour > 8 && world.hour < 23.5 ? 1 : 0; setLoop("cafe", s.g * 2.6 * open * (zn ? 0 : 1) * (1 - world.rain * .7) * (1 - Math.min(1, cozy.fall) * .6), s.pan, s.lp); } else setLoop("cafe", 0);
  const wd = waterD(tx, ty); setLoop("lap", clamp(1 - wd / 150) * .35 * zoomK * (winter ? .2 : 1));
  // канатка поскрипывает: в кабинке и рядом с ней
  cozy.creakT -= dt;
  if (cozy.creakT <= 0 && funicular && funicular.cabins.length) {
    cozy.creakT = rnd(3, 6);
    if (fps.on && fps.mode === "cable") play("creak", undefined, undefined, .3, { rate: rnd(.85, 1.15) });
    else if (camC.dist < 600) { let cb = null, cd = 1e9; for (const c of funicular.cabins) { const p = cabinPos(funicular, c), d = Math.hypot(p[0] - tx, p[1] - ty); if (d < cd) { cd = d; cb = p; } } if (cb && cd < 200) play("creak", cb[0], cb[1], .9, { h: cb[2], rate: rnd(.85, 1.15) }); }
  }
};
