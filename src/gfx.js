/* ---------- обработка картинки: свечение, затенение, цветокоррекция ---------- */
// финальный проход: тональная кривая ACES, насыщенность, контраст, тёплый оттенок, виньетка, плёночное зерно, перевод в sRGB
const GRADE = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, sat: { value: 1.08 }, contrast: { value: 1.06 }, warm: { value: 0 }, vig: { value: .32 }, grain: { value: .025 }, time: { value: 0 }, flashK: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, contrast, warm, vig, grain, time, flashK; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * exposure;
      c = aces(c * .9);
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(vec3(l), c, sat);
      c = (c - .5) * contrast + .5;
      c *= vec3(1. + warm * .08, 1., 1. - warm * .08);
      vec2 d = vUv - .5; c *= 1. - vig * smoothstep(.25, .85, dot(d, d) * 2.2);
      c += (rnd(vUv * 1000.) - .5) * grain;
      c = mix(c, vec3(1.), flashK);
      c = pow(max(c, 0.), vec3(1. / 2.2));
      gl_FragColor = vec4(c, 1.);
    }`,
};
let composer = null, bloomPass = null, ssaoPass = null, gradePass = null;
function setupPost() {
  if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
  const sz = R3.getSize(new THREE.Vector2());
  composer = new THREE.EffectComposer(R3);
  composer.addPass(new THREE.RenderPass(scene, camera));
  if (THREE.SSAOPass) { ssaoPass = new THREE.SSAOPass(scene, camera, sz.x, sz.y); ssaoPass.kernelRadius = 10; ssaoPass.minDistance = .0015; ssaoPass.maxDistance = .05; ssaoPass.enabled = false; composer.addPass(ssaoPass); }
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(sz.x / 2, sz.y / 2), .55, .55, .92); composer.addPass(bloomPass); // свечение в половинном разрешении
  gradePass = new THREE.ShaderPass(GRADE); composer.addPass(gradePass);
}
function renderFrame(dt) {
  if (composer && prefs.post !== false) {
    const g = gradePass.uniforms;
    g.time.value = (g.time.value + dt) % 100;
    g.exposure.value = 1 + world.flash * 2.5;
    g.warm.value = (world.nukeGlow || 0) * 1.5 + clamp(1 - Math.abs(world.hour - 19) / 1.5) * .6 - nightK * .4;
    g.sat.value = fps.on && fps.mode === "zombie" ? .55 : 1.08 - world.rain * .2 - world.fogK * .15;
    bloomPass.strength = .45 + nightK * .55;
    // затенение в углах только на высоком качестве и только вблизи — иначе дорого
    if (ssaoPass) ssaoPass.enabled = prefs.quality === "high" && camC.dist < 700;
    composer.render(dt);
  } else R3.render(scene, camera);
}
function resizePost() { if (!composer) return; const sz = R3.getSize(new THREE.Vector2()); composer.setPixelRatio(R3.getPixelRatio()); composer.setSize(sz.x, sz.y); }

/* ---------- отражения: небо как карта окружения для стёкол, мокрого асфальта и машин ---------- */
const pmrem = new THREE.PMREMGenerator(R3);
const envScene = new THREE.Scene(), envU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, gnd: { value: new THREE.Color(0x34332f) } };
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({ uniforms: envU, side: THREE.BackSide, depthWrite: false,
  vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
  fragmentShader: "uniform vec3 top, bot, gnd; varying vec3 p; void main(){ vec3 s = mix(bot, top, smoothstep(0., .6, p.y)); gl_FragColor = vec4(p.y < 0. ? mix(bot * .85, gnd, smoothstep(0., -.35, p.y)) : s, 1.); }" })));
let envRT = null, envT = 0, envKey = "";
function updateEnv(dt) {
  envT -= dt; if (envT > 0) return; envT = 1.5;
  const key = skyU.top.value.getHexString() + skyU.bot.value.getHexString();
  if (key === envKey) return; envKey = key;
  envU.top.value.copy(skyU.top.value); envU.bot.value.copy(skyU.bot.value); envU.gnd.value.setRGB(.5, .49, .47).multiplyScalar(.3 + (1 - nightK) * .7);
  const rt = pmrem.fromScene(envScene, .02);
  if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
}

/* ---------- стёкла блестят: карты шероховатости и металличности фасадов ---------- */
function specTex(st) {
  return canvasTex(TBX * TPX, TFL * TPY, (g, w, h) => {
    // зелёный канал — шероховатость, синий — металличность
    g.fillStyle = st.metal ? "rgb(0,120,170)" : "rgb(0,235,0)"; g.fillRect(0, 0, w, h);
    if (st.blank) return;
    if (st.curtain) { g.fillStyle = "rgb(0,34,115)"; for (let f = 0; f < TFL; f++) for (let b = 0; b < TBX * 2; b++) g.fillRect(b * TPX / 2 + 1, h - (f + 1) * TPY + 2, TPX / 2 - 2, TPY - 4); return; }
    g.fillStyle = "rgb(0,34,105)";
    for (let f = 0; f < TFL; f++) for (let b = 0; b < TBX; b++) {
      const x0 = b * TPX, y0 = h - (f + 1) * TPY, ground = f === 0 && !st.house && !st.metal;
      const ww = ground ? TPX * .86 : TPX * st.win, wh = ground ? TPY * .72 : TPY * .56;
      const wx = x0 + (TPX - ww) / 2, wy = ground ? y0 + TPY - wh - 3 : y0 + TPY * .22;
      g.fillRect(wx, wy, ww, wh);
    }
  }, false);
}
function upgradeFacades() {
  STYLES.forEach((st, i) => {
    const m = facadeMats[i]; if (!m || m.userData.spec) return;
    const t = specTex(st); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    m.roughnessMap = t; m.metalnessMap = t; m.roughness = 1; m.metalness = 1; m.envMapIntensity = .9; m.userData.spec = true; m.needsUpdate = true;
  });
}

/* ---------- асфальт вблизи: мелкая фактура поверх общей карты ---------- */
const detailTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 26000, ["#6a6a6a", "#959595", "#777", "#8c8c8c", "#5e5e5e"], 1.5); }, false);
detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
ground.material.onBeforeCompile = sh => {
  sh.uniforms.detailMap = { value: detailTex };
  sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
    diffuseColor.rgb *= mix(1., texture2D(detailMap, vUv * 380.).r * 2., .28);`).replace("void main() {", "uniform sampler2D detailMap;\nvoid main() {");
};
ground.material.needsUpdate = true;

/* ---------- мягкие тени у подножия домов, нарисованные на земле ---------- */
function paintContactShadows(g) {
  g.save();
  g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 16; g.fillStyle = "rgba(20,20,20,.9)";
  for (const b of buildings) {
    if (b.rot !== undefined) { g.save(); g.translate(b.cx, b.cy); g.rotate(b.rot); g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d); g.restore(); }
    else g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
  g.restore();
}

/* ---------- лужи: проступают, когда асфальт мокрый ---------- */
const puddleTex = canvasTex(128, 128, g => { g.fillStyle = "#fff"; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(64 + rnd(-26, 26), 64 + rnd(-14, 14), rnd(14, 34), rnd(8, 18), rnd(0, 3), 0, TAU); g.fill(); } }, false);
const puddles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: .03, metalness: .5, alphaMap: puddleTex, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.4 }), 500);
puddles.count = 0; puddles.renderOrder = 1; puddles.receiveShadow = true; scene.add(puddles);
function placePuddles() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0); let n = 0;
  for (let k = 0; k < 4000 && n < 500; k++) {
    const x = rnd(10, W - 10), y = rnd(10, H - 10), c = cellAt(x, y);
    if (c !== 0 && c !== 1) continue;
    q.setFromAxisAngle(up, rnd(0, TAU)); const s = rnd(6, 18);
    m.compose(new THREE.Vector3(X(x), gY(x, y) + .07, Z(y)), q, new THREE.Vector3(s, 1, s * rnd(.5, 1))); puddles.setMatrixAt(n++, m);
  }
  puddles.count = n; puddles.instanceMatrix.needsUpdate = true;
}
function updatePuddles() { puddles.material.opacity = clamp(world.wet * 1.1) * .9; puddles.visible = world.wet > .03; }

/* ---------- кроны деревьев: неровные, светлее сверху ---------- */
function organicCrown() {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.y * 2.1);
    v.multiplyScalar(1 + n * .16 + (Math.random() - .5) * .08); p.setXYZ(i, v.x, v.y * .9, v.z);
    const k = .7 + (v.y + 1) * .2; col.push(k, k, k);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
