/* ---------- обработка картинки: свечение, затенение, цветокоррекция ---------- */
// финальный проход: тональная кривая ACES, насыщенность, контраст, тёплый оттенок, виньетка, плёночное зерно, перевод в sRGB
const GRADE = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, sat: { value: .9 }, contrast: { value: 1.05 }, warm: { value: 0 }, vig: { value: .32 }, grain: { value: .025 }, time: { value: 0 }, flashK: { value: 0 } },
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
      // тонировка: тени уходят в холодный сине-зелёный, света — в тёплый; чёрный слегка приподнят, как на плёнке
      float lum = dot(c, vec3(.2126, .7152, .0722));
      c += mix(vec3(-.004, .002, .007), vec3(.016, .006, -.014), smoothstep(.2, .8, lum));
      c = c * .97 + .018;
      c *= vec3(1. + warm * .08, 1., 1. - warm * .08);
      vec2 d = vUv - .5; c *= 1. - vig * smoothstep(.25, .85, dot(d, d) * 2.2);
      c += (rnd(vUv * 1000.) - .5) * grain;
      c = mix(c, vec3(1.), flashK);
      c = pow(max(c, 0.), vec3(1. / 2.2));
      gl_FragColor = vec4(c, 1.);
    }`,
};
let composer = null, bloomPass = null, ssaoPass = null, gradePass = null, scenePass = null;
function setupPost() {
  if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
  const sz = R3.getSize(new THREE.Vector2());
  composer = new THREE.EffectComposer(R3);
  scenePass = new THREE.RenderPass(scene, camera); composer.addPass(scenePass);
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
    g.sat.value = fps.on && fps.mode === "zombie" ? .55 : .9 - world.rain * .18 - world.fogK * .15;
    bloomPass.strength = .45 + nightK * .55;
    // затенение в углах только на высоком качестве и только вблизи — иначе дорого
    // затенение в углах: проход берёт плоскости и проекцию камеры только при создании, а у нас дальность и пропорции
    // меняются — обновляем каждый кадр; пороги глубины нормированы на дальность камеры, задаём их в единицах мира
    if (ssaoPass) {
      ssaoPass.enabled = prefs.quality !== "low" && camC.dist < (prefs.quality === "high" ? 800 : 480) && !(fps && fps.on);
      if (ssaoPass.enabled) {
        const u = ssaoPass.ssaoMaterial.uniforms, d = ssaoPass.depthRenderMaterial && ssaoPass.depthRenderMaterial.uniforms;
        u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
        u.cameraProjectionMatrix.value.copy(camera.projectionMatrix); u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
        if (d) { d.cameraNear.value = camera.near; d.cameraFar.value = camera.far; }
        const span = camera.far - camera.near;
        ssaoPass.kernelRadius = 6; ssaoPass.minDistance = .5 / span; ssaoPass.maxDistance = 36 / span;
      }
      // SSAO сам рисует сцену заново — обычный проход в этот кадр не нужен
      if (scenePass) scenePass.enabled = !ssaoPass.enabled;
    }
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
  const kq = c => Math.round(c.r * 24) * 625 + Math.round(c.g * 24) * 25 + Math.round(c.b * 24), key = kq(skyU.top.value) + ":" + kq(skyU.bot.value);
  if (key === envKey) return; envKey = key;
  // отражённое небо приглушено к серому: иначе всё в тени (асфальт, стены, машины) уходит в густой синий
  const gr = c => { const l = c.r * .3 + c.g * .59 + c.b * .11; return c.lerp(new THREE.Color(l, l, l), .5); };
  envU.top.value.copy(skyU.top.value); envU.bot.value.copy(skyU.bot.value); gr(envU.top.value); gr(envU.bot.value); envU.gnd.value.setRGB(.5, .49, .47).multiplyScalar(.3 + (1 - nightK) * .7);
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
    m.roughnessMap = t; m.metalnessMap = t; m.roughness = 1; m.metalness = 1; m.envMapIntensity = .55; m.userData.spec = true; m.needsUpdate = true;
  });
}

/* ---------- износ поверхностей: грязь у земли, потёки, пятна, разнобой тона ----------
   Шейдерная добавка к материалам фасадов и крыш: считается по мировым координатам, без новых текстур */
const WEATHER_NOISE = `
float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(wh(i), wh(i + vec2(1., 0.)), f.x), mix(wh(i + vec2(0., 1.)), wh(i + vec2(1., 1.)), f.x), f.y); }
float wf(vec2 p){ return wn(p) * .5 + wn(p * 2.03) * .25 + wn(p * 4.01) * .125; }`;
function weatherMat(m, k = 1, roof = false) {
  if (!m || m.userData.weather) return; m.userData.weather = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;").replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
      #ifdef USE_INSTANCING
        vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
      #else
        vWPos = (modelMatrix * vec4(transformed, 1.)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;" + WEATHER_NOISE).replace("#include <map_fragment>", `#include <map_fragment>
      {
        float hgt = vWPos.y;
        ${roof ? `
        // крыша: пятна гудрона, лужицы, выгоревшие участки
        float blot = wf(vWPos.xz * .035), pat = wf(vWPos.xz * .12);
        diffuseColor.rgb *= 1. - ${k.toFixed(2)} * (.22 * smoothstep(.45, .8, blot) - .1 * (pat - .5));` : `
        // у земли сырость и грязь: первые три метра темнее
        float grime = 1. - smoothstep(1., 14., hgt);
        // потёки под окнами и с карнизов: полосы, вытянутые по высоте
        float streak = wf(vec2((vWPos.x + vWPos.z) * .33, hgt * .022));
        // пятна и неровный тон стены; у каждого дома свой оттенок
        float blot = wf(vWPos.xz * .018 + hgt * .008), tone = wh(floor(vWPos.xz / 48.));
        float d = 1. - ${k.toFixed(2)} * (.2 * grime + .13 * smoothstep(.5, .85, streak) + .1 * (blot - .5));
        diffuseColor.rgb *= d * mix(vec3(.96, .97, 1.), vec3(1.04, 1., .95), tone);`}
      }`);
  };
  m.customProgramCacheKey = () => "weather" + k + roof;
  m.needsUpdate = true;
}
function weatherCity() {
  facadeMats.forEach(m => weatherMat(m, 1.5));
  weatherMat(roofMat, 1, true);
  if (typeof metalRoofMat !== "undefined") weatherMat(metalRoofMat, .7, true);
}
weatherCity();

/* ---------- листва: карта нормалей из мелких «листьев», чтобы крона не была гладким шаром ---------- */
function leafNormalTex() {
  const N = 128, hgt = new Float32Array(N * N);
  for (let k = 0; k < 900; k++) {
    const cx = Math.random() * N, cy = Math.random() * N, r = 2 + Math.random() * 4, a = Math.random() * 3;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const lx = (x * Math.cos(a) + y * Math.sin(a)) / r, ly = (-x * Math.sin(a) + y * Math.cos(a)) / (r * .55), d = lx * lx + ly * ly;
      if (d < 1) { const i = ((Math.floor(cy + y) + N) % N) * N + (Math.floor(cx + x) + N) % N; hgt[i] = Math.max(hgt[i], (1 - d) * (.6 + Math.random() * .4)); }
    }
  }
  return canvasTex(N, N, (g, w, h) => {
    const img = g.createImageData(N, N), H = (x, y) => hgt[((y + N) % N) * N + (x + N) % N];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      img.data[i] = (-dx / l * .5 + .5) * 255; img.data[i + 1] = (-dy / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
}
var leafNormal = leafNormalTex(); leafNormal.wrapS = leafNormal.wrapT = THREE.RepeatWrapping; leafNormal.repeat.set(4, 3);
/* ---------- листва: крона из пластинок с листьями ----------
   Атлас: слева — плотные россыпи светлых листьев с прозрачностью (оттенок даёт цвет дерева), справа — сплошная полоса
   для внутреннего объёма кроны. Пластинки двусторонние (две копии с обратным обходом), нормали смотрят от центра
   кроны — свет ложится как на шар, а силуэт рваный, из листьев */
var leafAtlas = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 3400; i++) {
    const x = rnd(4, 188), y = rnd(4, 252), s = rnd(2.6, 6), a = rnd(0, TAU), hue = rnd(70, 105), l = rnd(36, 66);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `hsl(${hue},${rnd(14, 32)}%,${l}%)`; g.beginPath(); g.ellipse(0, 0, s, s * .48, 0, 0, TAU); g.fill();
    g.strokeStyle = `hsla(${hue},25%,${l - 22}%,.5)`; g.lineWidth = .6; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
    g.restore();
  }
  g.fillStyle = "hsl(88,22%,40%)"; g.fillRect(200, 0, 56, 256);
});
leafAtlas.wrapS = leafAtlas.wrapT = THREE.ClampToEdgeWrapping;
function leafCrownGeo(nCards = 38) {
  const P = [], N = [], U = [], C = [], v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const push = (p, n, u, k) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); U.push(u[0], u[1]); C.push(k, k, k); };
  for (let i = 0; i < nCards; i++) {
    // центр пластинки — ближе к поверхности кроны; ориентация случайная
    c.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(.78 * (.5 + .5 * Math.sqrt(Math.random())));
    const nrm = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().lerp(c.clone().normalize(), .5).normalize();
    a.set(1, 0, 0); if (Math.abs(nrm.x) > .9) a.set(0, 1, 0); a.cross(nrm).normalize(); b.copy(nrm).cross(a).normalize();
    const s = rnd(.3, .48), u0 = rnd(0, .58), v0 = rnd(0, .78), du = .17, dv = .19;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => c.clone().addScaledVector(a, x * s).addScaledVector(b, y * s));
    const uvs = [[u0, v0], [u0 + du, v0], [u0 + du, v0 + dv], [u0, v0 + dv]];
    const shade = .5 + .5 * (c.length() / .78) * (.8 + .2 * (c.y / .78 + 1) / 2);
    for (const order of [[0, 1, 2, 0, 2, 3], [0, 2, 1, 0, 3, 2]]) for (const k of order) {
      // нормаль — от центра кроны с примесью нормали пластинки: объём как у шара, но с игрой света на листьях
      v.copy(corners[k]).normalize().multiplyScalar(.75).addScaledVector(nrm, order[1] === 1 ? .25 : -.25).normalize();
      push(corners[k], v, uvs[k], shade);
    }
  }
  // внутренний объём: тёмный шар, чтобы сквозь крону не просвечивало небо
  const sp = new THREE.SphereGeometry(.62, 8, 6).toNonIndexed(), sp_p = sp.attributes.position, sp_n = sp.attributes.normal;
  for (let i = 0; i < sp_p.count; i++) { v.fromBufferAttribute(sp_p, i); a.fromBufferAttribute(sp_n, i); push(v, a, [.89, .5], .42); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere(); return g;
}
function leafMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: leafAtlas, alphaTest: .5, vertexColors: true, roughness: .85, envMapIntensity: .3 });
  m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafAtlas, alphaTest: .5 });
  return m;
}

/* ---------- асфальт вблизи: мелкая фактура поверх общей карты ---------- */
const detailTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); speckle(g, 0, 0, w, h, 26000, ["#6a6a6a", "#959595", "#777", "#8c8c8c", "#5e5e5e"], 1.5); }, false);
detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
ground.material.onBeforeCompile = sh => {
  sh.uniforms.detailMap = { value: detailTex }; sh.uniforms.worldSize = { value: new THREE.Vector2(W, H) };
  sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
    diffuseColor.rgb *= mix(1., texture2D(detailMap, vUv * 380.).r * 2., .28);
    {
      // сетка тонких трещин: гребни шума с искажением; видна только на тёмном сером асфальте и вблизи
      vec3 bc = diffuseColor.rgb; float mx = max(bc.r, max(bc.g, bc.b)), mn = min(bc.r, min(bc.g, bc.b));
      float asph = (1. - smoothstep(.06, .11, mx)) * (1. - smoothstep(.012, .03, mx - mn));
      float near = 1. - smoothstep(120., 420., length(vViewPosition));
      // газон вблизи: мелкая пятнистость, чтобы не распадался на квадраты текстуры
      float grassM = smoothstep(.0, .03, bc.g - max(bc.r, bc.b) * 1.05);
      if (grassM * near > .01) { vec2 gp = vUv * worldSize; diffuseColor.rgb *= mix(1., .78 + .4 * wn(gp * 1.3) * wn(gp * .37 + 3.1) + .12 * wn(gp * 4.1), grassM * near); }
      if (asph * near > .01) {
        vec2 wp = vUv * worldSize;
        vec2 q = wp * .16 + vec2(wn(wp * .05), wn(wp * .05 + 7.3)) * 3.;
        float r1 = abs(wn(q) - .5), r2 = abs(wn(q * 2.3 + 4.1) - .5);
        // трещины короткие и редкие: гребень шума виден только там, где высокочастотная маска открыта
        float crack = (1. - smoothstep(.0, .022, r1)) * step(.72, wn(wp * .11 + 2.)) + (1. - smoothstep(.0, .018, r2)) * .6 * step(.78, wn(wp * .13 + 9.));
        diffuseColor.rgb *= 1. - .38 * clamp(crack, 0., 1.) * asph * near;
      }
    }`).replace("void main() {", "uniform sampler2D detailMap; uniform vec2 worldSize;\n" + WEATHER_NOISE + "\nvoid main() {");
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
puddles.count = 0; puddles.renderOrder = 1; puddles.receiveShadow = true; puddles.frustumCulled = false; scene.add(puddles);
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
// крона: гладкая сфера с бугристой поверхностью (шум зависит только от положения, швов нет), темнее снизу и внутри
function organicCrown() {
  const g = new THREE.SphereGeometry(1, 18, 12), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.y * 2.1) + .5 * Math.sin(v.x * 9.3 - v.z * 7.7 + v.y * 4.1);
    v.multiplyScalar(1 + n * .12); p.setXYZ(i, v.x, v.y * .88, v.z);
    const k = .62 + (v.y + 1) * .2 + n * .05; col.push(k, k, k);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
