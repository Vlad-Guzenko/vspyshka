/* ---------- уличные мелочи: остановки, ларьки, щиты, скамейки, детские площадки ---------- */
// всё неподвижно, поэтому склеивается в несколько мешей — по одному на материал
const woodBenchMat = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: .85 }), sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c48a, roughness: 1 });
const binMat = new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: .6, metalness: .3 });
const stopSignMat = signMat(canvasTex(64, 64, g => { g.fillStyle = "#1f5fbf"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#fff"; g.fillRect(4, 4, 56, 56); g.fillStyle = "#1f5fbf"; g.font = "bold 44px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("А", 32, 35); }));
const KIOSK_SIGNS = [["ПЕЧАТЬ", "#1d3566", "#fff"], ["ЦВЕТЫ", "#c8285a", "#fff"], ["ШАВЕРМА", "#e8a81a", "#5a1a0a"], ["МОРОЖЕНОЕ", "#f4f1e8", "#2a5aa8"]].map(([t, bg, fg]) => signMat(textTex(256, 48, bg, fg, t, "bold 34px Arial")));
const KIOSK_BODY = [AWNING_MATS[2], AWNING_MATS[0], AWNING_MATS[3], AWNING_MATS[6]];
const dpsBandMat = new THREE.MeshStandardMaterial({ color: 0x1f4f9a, roughness: .6 }), dpsSignMat = signMat(textTex(192, 96, "#1f4f9a", "#fff", "ДПС", "bold 60px Arial", "#ffffff"));
const helipadMat = new THREE.MeshStandardMaterial({ map: helipadTex, roughness: .8 });
const P_BOX = (sx, sy, sz, x, y, z, mat, rx = 0) => ({ geo: new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z, rx });
const PROP_PARTS = {
  // остановка: стеклянный павильон с крышей и скамейкой, знак «А» на столбе, урна
  stop: () => [P_BOX(10, .4, 3.6, 0, 6.9, 0, whiteMat), P_BOX(10, 5.8, .15, 0, 3.7, -1.6, verandaMat), P_BOX(.15, 5.8, 3, -5, 3.7, 0, verandaMat), P_BOX(.15, 5.8, 3, 5, 3.7, 0, verandaMat),
    P_BOX(.3, 6.9, .3, -5, 3.45, 1.5, steelPostMat), P_BOX(.3, 6.9, .3, 5, 3.45, 1.5, steelPostMat), P_BOX(7, .3, 1.2, 0, 1.6, -.9, woodBenchMat), P_BOX(.3, 1.6, 1, -3, .8, -.9, steelPostMat), P_BOX(.3, 1.6, 1, 3, .8, -.9, steelPostMat),
    P_BOX(.2, 8, .2, 6.6, 4, 1.6, steelPostMat), P_BOX(1.8, 1.8, .1, 6.6, 7.6, 1.7, stopSignMat), { geo: new THREE.CylinderGeometry(.6, .5, 1.6, 10), mat: binMat, x: -6.3, y: .8, z: 1.2 }],
  // ларёк: будка с витриной и вывеской
  kiosk: v => [P_BOX(7, 4.4, 5, 0, 2.2, 0, KIOSK_BODY[v]), P_BOX(7.8, .4, 5.8, 0, 4.6, 0, whiteMat), P_BOX(5.6, 2, .1, 0, 2.9, 2.55, darkGlassMat), P_BOX(6.6, 1.3, .12, 0, 5.5, 2.75, KIOSK_SIGNS[v]),
    P_BOX(7.2, .3, 2, 0, 3.9, 3.4, KIOSK_BODY[v], .35)],
  // щит у дороги: две опоры, рама, реклама к дороге
  board: v => [P_BOX(.7, 12, .7, -5, 6, 0, steelPostMat), P_BOX(.7, 12, .7, 5, 6, 0, steelPostMat), P_BOX(17, 6.6, .5, 0, 14.5, 0, steelPostMat), { geo: new THREE.PlaneGeometry(16, 5.8), mat: ADS[v % ADS.length], x: 0, y: 14.5, z: .3 }],
  // пост ДПС на въезде: будка с синей полосой, знак, шлагбаум над обочиной
  dps: () => [P_BOX(4, 3.2, 3.4, 0, 1.6, 0, whiteMat), P_BOX(4.06, .6, 3.46, 0, 2.3, 0, dpsBandMat), P_BOX(4.8, .3, 4.2, 0, 3.35, 0, steelPostMat), P_BOX(2.4, 1, .1, 0, 2, 1.73, darkGlassMat),
    P_BOX(.2, 5, .2, 3.2, 2.5, 1.6, steelPostMat), { geo: new THREE.PlaneGeometry(2.4, 1.2), mat: dpsSignMat, x: 3.2, y: 4.6, z: 1.72 },
    P_BOX(.5, 1.4, .5, -3, .7, 2.4, steelPostMat), P_BOX(4.6, .3, .3, -5.5, 1.3, 2.4, redMat2), P_BOX(4.6, .3, .3, -10.1, 1.3, 2.4, whiteMat)],
  // вертолётная площадка части
  helipad: () => [{ geo: new THREE.CylinderGeometry(13, 13, .3, 28), mat: helipadMat, x: 0, y: .15, z: 0 }, P_BOX(.6, .4, .6, 13, .2, 0, lampGlowMat), P_BOX(.6, .4, .6, -13, .2, 0, lampGlowMat), P_BOX(.6, .4, .6, 0, .2, 13, lampGlowMat), P_BOX(.6, .4, .6, 0, .2, -13, lampGlowMat)],
  bench: () => [P_BOX(5, .3, 1.4, 0, 1.5, 0, woodBenchMat), P_BOX(5, 1.3, .25, 0, 2.4, -.65, woodBenchMat, -.15), P_BOX(.3, 1.5, 1.2, -2.2, .75, 0, steelPostMat), P_BOX(.3, 1.5, 1.2, 2.2, .75, 0, steelPostMat)],
  // детская площадка: качели, горка, песочница, карусель
  play: v => {
    const c = seatMats[v % 3], c2 = seatMats[(v + 1) % 3], out = [];
    for (const [x, z] of [[-11, -5], [-3, -5], [-11, -1], [-3, -1]]) out.push(P_BOX(.3, 7.2, .3, x, 3.6, z, c));
    out.push(P_BOX(8.3, .35, .35, -7, 7.2, -5, c), P_BOX(8.3, .35, .35, -7, 7.2, -1, c));
    for (const x of [-9, -5]) { out.push(P_BOX(.08, 5, .08, x - .6, 4.6, -3, steelPostMat), P_BOX(.08, 5, .08, x + .6, 4.6, -3, steelPostMat), P_BOX(1.6, .2, .9, x, 2, -3, woodBenchMat)); }
    for (const [x, z] of [[4, -6], [7, -6], [4, -3], [7, -3]]) out.push(P_BOX(.3, 4.2, .3, x, 2.1, z, c2));
    out.push(P_BOX(3.6, .3, 3.6, 5.5, 4.2, -4.5, c2), P_BOX(1.8, .2, 7, 5.5, 2.2, .5, c, -.55));
    for (const [sx, sz, x, z] of [[6, .5, 0, 3], [6, .5, 0, 9], [.5, 6, -3, 6], [.5, 6, 3, 6]]) out.push(P_BOX(sx, .6, sz, x - 7, .3, z, woodBenchMat));
    out.push(P_BOX(5.4, .25, 5.4, -7, .2, 6, sandMat), { geo: new THREE.CylinderGeometry(2.6, 2.6, .4, 16), mat: c2, x: 7, y: .8, z: 6 }, P_BOX(.3, 2.4, .3, 7, 1.6, 6, steelPostMat));
    return out;
  },
};
const _prM = new THREE.Matrix4(), _prL = new THREE.Matrix4(), _prQ = new THREE.Quaternion(), _prE = new THREE.Euler(), _prV = new THREE.Vector3(), _prS = new THREE.Vector3(1, 1, 1);
// как mergeGeo, но с uv: на вывесках и рекламе текстура
function mergeGeoUV(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nr = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of list) { const c = g.attributes.position.count; p.set(g.attributes.position.array, o * 3); nr.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(p, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nr, 3)); out.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); out.computeBoundingSphere();
  return out;
}
// разрушения (sim3.js): разлетевшееся (gone) не рисуется, опрокинутое лежит на боку там, куда его отбросило (tip, tipA, dx, dy),
// у побывавших во взрыве выбиты стёкла (glass), горевшее чернеет по степени обгорания (char) — свой тёмный материал на ступень
let propMeshes = [];
const _prUp = new THREE.Vector3(0, 1, 0), _prT = new THREE.Quaternion(), _prAx = new THREE.Vector3(), charMats = new Map();
function charMat(mat, lvl) {
  let C = charMats.get(mat); if (!C) charMats.set(mat, C = []);
  if (!C[lvl]) { const m = mat.clone(); m.color = (mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1)).lerp(new THREE.Color(0x1b1714), lvl === 2 ? .93 : .55); if (m.emissive) m.emissive.setHex(0); m.roughness = 1; m.metalness = 0; C[lvl] = m; }
  return C[lvl];
}
function buildProps() {
  for (const m of propMeshes) { cityGroup.remove(m); m.geometry.dispose(); } propMeshes = [];
  const buckets = new Map(), glassy = new Set([verandaMat, darkGlassMat]);
  for (const pr of props) {
    const parts = PROP_PARTS[pr.k]; if (!parts || pr.gone) continue;
    // лицевая сторона (+z) смотрит в направлении a; опрокинутое — ещё и повёрнуто от взрыва вокруг основания
    const px = pr.x + (pr.dx || 0), py = pr.y + (pr.dy || 0);
    _prQ.setFromAxisAngle(_prUp, Math.PI / 2 - pr.a);
    if (pr.tip) { _prT.setFromAxisAngle(_prAx.set(Math.sin(pr.tipA), 0, -Math.cos(pr.tipA)), pr.tip); _prQ.premultiply(_prT); }
    _prM.compose(_prV.set(X(px), gY(px, py), Z(py)), _prQ, _prS.set(1, 1, 1));
    const ch = pr.char > .7 ? 2 : pr.char > .3 ? 1 : 0;
    for (const part of parts(pr.v || 0)) {
      if (pr.glass && glassy.has(part.mat)) { part.geo.dispose(); continue; } // стёкла выбиты
      _prE.set(part.rx || 0, 0, 0); _prL.compose(_prV.set(part.x, part.y, part.z), _prQ.setFromEuler(_prE), _prS.set(1, 1, 1)).premultiply(_prM);
      const src = part.geo, g = (src.index ? src.toNonIndexed() : src).applyMatrix4(_prL); if (g !== src) src.dispose();
      const mat = ch ? charMat(part.mat, ch) : part.mat;
      let list = buckets.get(mat); if (!list) buckets.set(mat, list = []); list.push(g);
    }
  }
  for (const [mat, list] of buckets) { const m = new THREE.Mesh(mergeGeoUV(list), mat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; cityGroup.add(m); propMeshes.push(m); }
}
