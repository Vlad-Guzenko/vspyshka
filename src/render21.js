/* ---------- фары и фонари: конусы света на земле и лучи в воздухе ----------
   У едущих в сумерках и ночью машин от каждой фары на асфальт ложится вытянутый конус, а в воздухе виден полупрозрачный
   луч — как у фонарика: в ясную ночь едва заметный, в дождь, снег, туман и дым густой. У военных и полицейских ночью
   такие же фонари, только узкие. Настоящие источники света (освещают людей и стены) — только у машины игрока и у трёх
   ближайших к камере машин: их число постоянно (пул), иначе шейдеры пересобирались бы на каждом включении. */
// конус на земле: u — вперёд от фары, v — поперёк; две фары — два конуса, расходящихся из точек ±lamp
function coneTex(lamps, spread) {
  return canvasTex(128, 64, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = i / (w - 1), y = (j / (h - 1) - .5) * 2; let a = 0;
      for (const y0 of lamps) {
        const half = .05 + f * spread, e = Math.abs(y - y0) / half;
        a += (1 - clamp((e - .55) / .45)) * clamp(f / .07) * Math.pow(1 - f, 1.4) * (1 - .35 * clamp(e));
      }
      const k = (j * w + i) * 4, v = Math.round(clamp(a) * 255); img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = v;
    }
    g.putImageData(img, 0, 0);
  });
}
const beamGroundMat = (tex, col) => new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
// объёмный луч: открытый конус, вершина у фары, основание на расстоянии 1 по +x; ярче там, где поверхность смотрит на нас
// (середина луча), и гаснет к краям силуэта и к дальнему концу
const beamGeo = new THREE.ConeGeometry(1, 1, 14, 1, true).rotateZ(Math.PI / 2).translate(.5, 0, 0);
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(0xfff0d0) } },
  vertexShader: `varying float vT; varying vec3 vN, vV, vC;
    void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.);
      vT = position.x; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = cameraPosition - wp.xyz; vC = vec3(1.);
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #endif
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `uniform float uK; uniform vec3 uCol; varying float vT; varying vec3 vN, vV, vC;
    void main() {
      float face = pow(abs(dot(normalize(vV), normalize(vN))), 1.6);
      float along = smoothstep(0., .05, vT) * pow(1. - vT, 1.8);
      gl_FragColor = vec4(uCol * vC * (uK * face * along), 1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const hb = { cap: 0, beams: null, carCones: null, handCones: null, smoke: new Map(), smokeT: 0, spots: [] };
function hbMeshes(cap) {
  for (const m of [hb.beams, hb.carCones, hb.handCones]) if (m) { scene.remove(m); m.dispose(); }
  hb.cap = cap;
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m; };
  hb.beams = mk(beamGeo, beamMat, cap * 2 + 300); hb.beams.setColorAt(0, new THREE.Color(1, 1, 1));
  hb.carCones = mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), beamGroundMat(coneTex([-.22, .22], .6), 0xfff2d0), cap);
  hb.handCones = mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), beamGroundMat(coneTex([0], .55), 0xfff1d6), 300);
}
// пул настоящих фар: машина игрока и три ближайшие к камере
for (let i = 0; i < 4; i++) { const l = new THREE.SpotLight(0xfff0d8, 0, 230, .5, .7, 1.2); scene.add(l, l.target); hb.spots.push(l); }
// дым у земли — по частицам дыма, клетками по 48 ед.: в дыму лучи гуще
function hbSmokeAt(x, z) { return hb.smoke.get((Math.floor(x / 48) + 2048) * 4096 + Math.floor(z / 48) + 2048) || 0; }
const _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _he = new THREE.Euler(), _hv = new THREE.Vector3(), _hs = new THREE.Vector3(), _hc = new THREE.Color();
function hbPut(mesh, i, x, y, z, yaw, pitch, sx, sy, sz) { _he.set(0, yaw, pitch, "YXZ"); _hq.setFromEuler(_he); _hm.compose(_hv.set(x, y, z), _hq, _hs.set(sx, sy, sz)); mesh.setMatrixAt(i, _hm); }
function updateHeadBeams(dt) {
  if (!cm) return;
  cm.fixed.beams.visible = false; // старое круглое пятно — заменено конусами
  if (!hb.beams || hb.cap < carCap) hbMeshes(Math.max(carCap, 200));
  hb.smokeT -= dt;
  if (hb.smokeT <= 0) { hb.smokeT = .3; hb.smoke.clear(); for (const p of PS_SMOKE.list) if (p.y < 70) { const k = (Math.floor(p.x / 48) + 2048) * 4096 + Math.floor(p.z / 48) + 2048; hb.smoke.set(k, (hb.smoke.get(k) || 0) + 1); } }
  // погода: в ясную ночь луч едва виден, в дождь, снегопад и туман — густой
  const air = .045 + world.rain * .4 + world.fogK * .4 + Math.min(1, cozy.fall) * .35;
  let bi = 0, ci = 0, hi = 0;
  const cand = [], camX = camera.position.x, camZ = camera.position.z;
  if (carLightK > .15) for (const c of cars) {
    const player = drive.car === c;
    if (c.gone || c.wreck || !(c.moving || player) || (c.char || 0) > .5 || c.exploded || ci >= hb.cap) continue;
    const M = carModelOf(c), half = (c.vlen || c.len || 1) * 9, cs = Math.cos(c.ang), sn = Math.sin(c.ang), yaw = -c.ang;
    const rx = c.rx !== undefined ? c.rx : c.x, ry = c.ry !== undefined ? c.ry : c.y, fx = rx + cs * half, fy = ry + sn * half;
    // конусы на земле — по уклону дороги перед машиной
    const g0 = gY(fx, fy), g1 = gY(fx + cs * 60, fy + sn * 60), slope = Math.atan2(g1 - g0, 60);
    hbPut(hb.carCones, ci++, X(fx + cs * 32), (g0 + g1) / 2 + .3, Z(fy + sn * 32), yaw, slope, 64, 1, 34);
    const smk = clamp(hbSmokeAt(X(fx + cs * 30), Z(fy + sn * 30)) / 6), lz = M.lz || Math.min(M.track - .3, 2.6 * M.track / 3.45), ly = (M.ly || 2.4) + (c.z || 0), tilt = Math.atan2(ly + 1.5, 70);
    _hc.setScalar(1 + smk * 2.5);
    for (const s of [-1, 1]) if (bi < hb.beams.instanceMatrix.count) { hbPut(hb.beams, bi, X(fx - sn * lz * s), g0 + ly, Z(fy + cs * lz * s), yaw, slope - tilt, 80, 11, 11); hb.beams.setColorAt(bi++, _hc); }
    const d = Math.hypot(X(fx) - camX, Z(fy) - camZ); cand.push([player ? -1 : d, c, fx, fy, g0 + ly, cs, sn, g1]);
  }
  // фонари силовиков: узкий луч из руки вперёд, конус на земле (раньше было круглое пятно — render3.js)
  flashGlow.visible = false;
  if (nightK > .05) for (const a of agents) {
    if (a.state !== "alive" || (a.role !== "army" && a.role !== "police") || a.hidden || hi >= 300) continue;
    const cs = Math.cos(a.dir), sn = Math.sin(a.dir), g = gY(a.x, a.y), yaw = -a.dir;
    hbPut(hb.handCones, hi++, X(a.x + cs * 22), g + .25, Z(a.y + sn * 22), yaw, 0, 40, 1, 18);
    if (bi < hb.beams.instanceMatrix.count) { _hc.setScalar(.55 + clamp(hbSmokeAt(X(a.x), Z(a.y)) / 6) * 2); hbPut(hb.beams, bi, X(a.x + cs * 1.5), g + 5, Z(a.y + sn * 1.5), yaw, -Math.atan2(5, 44), 46, 5.5, 5.5); hb.beams.setColorAt(bi++, _hc); }
  }
  hb.carCones.count = ci; hb.handCones.count = hi; hb.beams.count = bi;
  for (const m of [hb.carCones, hb.handCones, hb.beams]) m.instanceMatrix.needsUpdate = true;
  if (hb.beams.instanceColor) hb.beams.instanceColor.needsUpdate = true;
  hb.carCones.material.opacity = carLightK * (.25 + nightK * .4); hb.handCones.material.opacity = nightK * .6;
  beamMat.uniforms.uK.value = Math.max(carLightK, nightK) * air;
  // настоящие фары: ближайшие к камере (игрок — всегда первым), не дальше 700 ед. от камеры
  cand.sort((p, q) => p[0] - q[0]);
  hb.spots.forEach((l, i) => {
    const p = cand[i]; if (!p || p[0] > 700) { l.intensity = 0; return; }
    const [, c, fx, fy, y, cs, sn, g1] = p;
    l.position.set(X(fx), y + 1, Z(fy)); l.target.position.set(X(fx + cs * 70), g1, Z(fy + sn * 70)); l.target.updateMatrixWorld();
    l.intensity = carLightK * 5;
  });
}
// подстанции районов (sim12.js): значок над крышей одного размера на экране — видно, по чему ударить или что беречь; разрушена — красный
const subMarks = new Map();
function subMarkTex(i, down) {
  return canvasTex(128, 64, g => { g.fillStyle = down ? "rgba(150,20,20,.85)" : "rgba(20,24,28,.8)"; g.fillRect(4, 4, 120, 56); g.strokeStyle = down ? "#ff6050" : "#ffd23c"; g.lineWidth = 4; g.strokeRect(4, 4, 120, 56); g.fillStyle = down ? "#ffb0a8" : "#ffd23c"; g.font = "bold 34px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("⚡ПС-" + (i + 1), 64, 34); });
}
function updateSubMarks() {
  for (const [b, o] of subMarks) if (!pwSubs.some(s => s.b === b)) { scene.remove(o); o.material.map.dispose(); o.material.dispose(); subMarks.delete(b); }
  pwSubs.forEach((s, i) => {
    let o = subMarks.get(s.b), down = s.b.state !== "ok";
    if (!o || o.userData.down !== down) {
      if (o) { scene.remove(o); o.material.map.dispose(); o.material.dispose(); }
      o = new THREE.Sprite(new THREE.SpriteMaterial({ map: subMarkTex(i, down), depthWrite: false, depthTest: false, sizeAttenuation: false })); o.scale.set(.075, .0375, 1); o.renderOrder = 5; o.userData.down = down; subMarks.set(s.b, o); scene.add(o);
    }
    o.position.set(X(s.x), gY(s.x, s.y) + (down ? 10 : s.b.h || 20) + 12, Z(s.y));
  });
}
const _hbUpdateCars = updateCars;
updateCars = function () { _hbUpdateCars(); try { updateHeadBeams(Math.min(.1, fpsDtH())); updateSubMarks(); } catch (e) { console.warn("фары", e); } };
let _hbT = 0; function fpsDtH() { const t = performance.now(), d = _hbT ? (t - _hbT) / 1000 : .016; _hbT = t; return d; }
