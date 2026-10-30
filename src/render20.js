/* ---------- снег на дорогах на картинке: сплошной покров сугробов, трос лебёдки, поза регулировщика.
   Состояние — sim18.js (snowD, snowCells, snowDirty, snowBox) ---------- */
// снег — сплошной покров, натянутый по рельефу участками 128 × 128 с шагом 4: высота — сглаженная глубина из клеток,
// край рваный (шум в шейдере), где снег тонкий — серая каша; так сугроб читается валом и наносом, а не клетками
const SNOW_TILE = 128, SNOW_RES = 4, snowTiles = new Map();
const snowMat = new THREE.MeshStandardMaterial({ color: 0xe4e9f0, roughness: .78, envMapIntensity: .6 });
snowMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float depth; varying float vDepth; varying vec2 vSW; varying float vUp;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvDepth = depth; vSW = position.xz; vUp = normal.y;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying float vDepth; varying vec2 vSW; varying float vUp;
float snH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(snH(i), snH(i + vec2(1., 0.)), f.x), mix(snH(i + vec2(0., 1.)), snH(i + 1.), f.x), f.y); }`)
    .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  float snE = snN(vSW * .3) * .6 + snN(vSW * 1.1) * .4; if (vDepth + (snE - .5) * .3 < .07) discard;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(.9, .95, 1.) * step(.992, snH(floor(vSW * 5.))) * smoothstep(.3, 1., vDepth) * smoothstep(.85, 1., vUp) * .5;") // редкие искры на солнце
    .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= .92 + .08 * snN(vSW * 2.3); diffuseColor.rgb = mix(diffuseColor.rgb * vec3(.62, .58, .53), diffuseColor.rgb, smoothstep(.07, .5, vDepth)); diffuseColor.rgb *= mix(vec3(.68, .74, .86), vec3(1.), smoothstep(.55, .97, vUp));"); // склоны и ямки — в голубой тени
};
// глубина в точке: билинейно по центрам клеток и усреднение по кругу — без ступенек на границах клеток
function snowRaw(x, y) {
  const fx = x / CS - .5, fy = y / CS - .5, gx = Math.floor(fx), gy = Math.floor(fy), tx = fx - gx, ty = fy - gy;
  const at = (a, b) => (a < 0 || b < 0 || a >= GW || b >= GH) ? 0 : snowD[b * GW + a];
  return (at(gx, gy) * (1 - tx) + at(gx + 1, gy) * tx) * (1 - ty) + (at(gx, gy + 1) * (1 - tx) + at(gx + 1, gy + 1) * tx) * ty;
}
function snowSmooth(x, y) { return snowRaw(x, y) * .4 + (snowRaw(x + 5, y) + snowRaw(x - 5, y) + snowRaw(x, y + 5) + snowRaw(x, y - 5)) * .15; }
// бугры и заструги: без них свежий снег под солнцем — плоское белое пятно без теней
function snowLump(x, y) { return (Math.sin(x * .21 + y * .13) * Math.cos(y * .17 - x * .07) + Math.sin(x * .47 - y * .39) * .45 + Math.sin(x * .9 + y * .7) * .15) * .45; }
function buildSnowTile(tx, ty) {
  const n = SNOW_TILE / SNOW_RES + 1, pos = new Float32Array(n * n * 3), dep = new Float32Array(n * n), idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = tx * SNOW_TILE + i * SNOW_RES, y = ty * SNOW_TILE + j * SNOW_RES, d = snowSmooth(x, y), k = j * n + i;
    // у самого края покров уходит под землю, чтобы не было ступеньки
    pos[k * 3] = X(x); pos[k * 3 + 1] = gY(Math.min(W - .01, Math.max(0, x)), Math.min(H - .01, Math.max(0, y))) + (d > .04 ? (d < 3 ? d * 2 : 6 + (d - 3) * 1.3) + .12 + snowLump(x, y) * Math.min(1, d) : -.6); // большая куча выше, но круче не становится pos[k * 3 + 2] = Z(y); dep[k] = d;
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; if (dep[a] + dep[b] + dep[c] + dep[d] < .02) continue; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("depth", new THREE.BufferAttribute(dep, 1)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const winchGeo = new THREE.BufferGeometry(), winchPos = new Float32Array(8 * 6); winchGeo.setAttribute("position", new THREE.BufferAttribute(winchPos, 3).setUsage(THREE.DynamicDrawUsage));
const winchLines = new THREE.LineSegments(winchGeo, new THREE.LineBasicMaterial({ color: 0x1a1a1a })); winchLines.frustumCulled = false; scene.add(winchLines);
let snowRT = 0;
const _snv = new THREE.Vector3();
function updateSnowRoads(dt) {
  snowRT -= dt;
  if (snowDirty && snowRT <= 0) {
    snowDirty = false; snowRT = .5;
    // какие участки со снегом; перестраиваются задетые (snowBox) и опустевшие
    const want = new Set();
    if (snowD) for (const i of snowCells) { const x = (i % GW) * CS, y = ((i / GW) | 0) * CS; for (const [ox, oy] of [[-6, -6], [6 + CS, -6], [-6, 6 + CS], [6 + CS, 6 + CS]]) want.add(Math.floor((x + ox) / SNOW_TILE) + ":" + Math.floor((y + oy) / SNOW_TILE)); }
    const box = snowBox || [0, 0, W, H]; snowBox = null;
    for (const [k, m] of snowTiles) if (!want.has(k)) { cityGroup.remove(m); scene.remove(m); m.geometry.dispose(); snowTiles.delete(k); }
    for (const k of want) {
      const [tx, ty] = k.split(":").map(Number), x0 = tx * SNOW_TILE, y0 = ty * SNOW_TILE;
      if (snowTiles.has(k) && (x0 > box[2] + 8 || x0 + SNOW_TILE < box[0] - 8 || y0 > box[3] + 8 || y0 + SNOW_TILE < box[1] - 8)) continue;
      const old = snowTiles.get(k); if (old) { old.geometry.dispose(); old.geometry = buildSnowTile(tx, ty); continue; }
      const m = new THREE.Mesh(buildSnowTile(tx, ty), snowMat); m.castShadow = m.receiveShadow = true; scene.add(m); snowTiles.set(k, m);
    }
  }
  // трос лебёдки: от эвакуатора к застрявшей машине
  let nl = 0;
  for (const c of cars) {
    if (c.service !== "tow" || c.gone || !c.job || !c.job.winch) continue; const w = c.job.tow; if (!w || w.winchBy !== c || nl >= 8) continue;
    const ax = X(c.x) - Math.cos(c.ang) * 9, az = Z(c.y) - Math.sin(c.ang) * 9, bx = X(w.x), bz = Z(w.y);
    winchPos.set([ax, gY(c.x, c.y) + 3, az, bx, gY(w.x, w.y) + 1.8, bz], nl * 6); nl++;
  }
  // трос буксира: от сцепки к передку большой машины, которую эвакуатор тянет за собой
  for (const c of cars) {
    if (!c.towedBy || c.onDeck || !c.hitch || c.gone || nl >= 8) continue;
    const fx = c.x + Math.cos(c.ang) * 9 * (c.len || 1), fy = c.y + Math.sin(c.ang) * 9 * (c.len || 1);
    winchPos.set([X(c.hitch[0]), gY(c.hitch[0], c.hitch[1]) + 2.4, Z(c.hitch[1]), X(fx), gY(fx, fy) + 2, Z(fy)], nl * 6); nl++;
  }
  winchGeo.setDrawRange(0, nl * 2); winchGeo.attributes.position.needsUpdate = true; winchLines.visible = nl > 0;
}
// регулировщик: лицом к подъезжающим, левая рука вперёд («стоп»), правая машет в сторону объезда
function regulPose(s, a) {
  s.root.updateMatrixWorld(true);
  const f = a.regulDir || 0, fx = Math.cos(f), fz = Math.sin(f), wave = Math.sin(simT * 3 + a.id) * .5;
  aimBone(s.bones.LeftArm, s.bones.LeftForeArm, _snv.set(fx, .35, fz).normalize());
  aimBone(s.bones.RightArm, s.bones.RightForeArm, _snv.set(-fz * Math.cos(wave) + fx * Math.sin(wave) * .4, .15, fx * Math.cos(wave) + fz * Math.sin(wave) * .4).normalize());
  s.root.updateMatrixWorld(true);
  aimBone(s.bones.LeftForeArm, s.bones.LeftHand, _snv.set(fx, .6, fz).normalize());
  aimBone(s.bones.RightForeArm, s.bones.RightHand, _snv.set(-fz, .2, fx).normalize());
}
