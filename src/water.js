/* ---------- вода: волны, отражение неба, блики солнца и луны, пена у берега ---------- */
const waterU = {
  time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) },
  skyTop: skyU.top, skyBot: skyU.bot, deep: { value: new THREE.Color(0x12455c) }, shallow: { value: new THREE.Color(0x3d8f9a) }, depthMap: { value: null }, mapSize: { value: new THREE.Vector2(W, H) },
  night: { value: 0 }, rain: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2 },
  shore: { value: new THREE.Vector4(0, 0, 0, 0) }, // x0, z0, x1, z1 берегов текущего куска
};
const waterVS = `
varying vec3 vW; varying float vFog;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix * w; vFog = -mv.z; gl_Position = projectionMatrix * mv; }`;
const waterFS = `
uniform float time, night, rain, fogNear, fogFar; uniform vec3 sunDir, sunCol, skyTop, skyBot, deep, shallow, fogColor; uniform vec4 shore; uniform sampler2D depthMap; uniform vec2 mapSize;
varying vec3 vW; varying float vFog;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float waves(vec2 p){
  float t = time;
  float s = n(p * .045 + vec2(t * .05, t * .03)) * .5 + n(p * .11 - vec2(t * .09, -t * .06)) * .3 + n(p * .27 + vec2(-t * .17, t * .13)) * .15 + n(p * .7 + t * .4) * .06;
  s += sin(p.x * .06 + t * 1.1) * .08 + sin(p.y * .05 - t * .9 + p.x * .02) * .07;
  s += rain * n(p * 1.8 + t * 3.) * .12;
  return s;
}
void main(){
  vec2 p = vW.xz; float e = 1.2;
  vec3 N = normalize(vec3(waves(p - vec2(e, 0)) - waves(p + vec2(e, 0)), .75, waves(p - vec2(0, e)) - waves(p + vec2(0, e))));
  vec3 V = normalize(cameraPosition - vW);
  float fres = .03 + .55 * pow(1. - max(dot(N, V), 0.), 4.);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(skyBot, skyTop, smoothstep(-.05, .6, R.y));
  float spec = pow(max(dot(R, normalize(sunDir)), 0.), 220.) * 9. + pow(max(dot(R, normalize(sunDir)), 0.), 18.) * .25;
  // у берега светлее и с пеной
  float dEdge = min(min(p.x - shore.x, shore.z - p.x), min(p.y - shore.y, shore.w - p.y));
  float shoreK = shore.z > shore.x ? 1. - smoothstep(0., 40., dEdge) : 0.;
  // в городе глубина известна: у берега мелко, светлее и пена
  vec2 uv = vec2((p.x + mapSize.x * .5) / mapSize.x, (p.y + mapSize.y * .5) / mapSize.y);
  if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) { float dp = texture2D(depthMap, uv).r; shoreK = max(shoreK, 1. - dp); dEdge = dp * 26.; }
  vec3 body = mix(deep, shallow, shoreK * .7 + .15 * waves(p * .5));
  vec3 col = mix(body * (1. - night * .8), sky * .85, fres * .6) + sunCol * spec * (1. - rain * .6);
  float foam = shoreK * smoothstep(.55, .75, n(p * .35 + time * .25) * .6 + (1. - smoothstep(0., 8., dEdge)) * .8);
  col = mix(col, vec3(.8, .85, .87) * (1. - night * .75), foam * .45);
  float f = smoothstep(fogNear, fogFar, vFog);
  gl_FragColor = vec4(mix(col, fogColor, f), 1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
function makeWaterMat(x0, z0, x1, z1) {
  const u = { ...waterU, shore: { value: new THREE.Vector4(x0, z0, x1, z1) } };
  // без polygonOffset: вода лежит ниже земли, и смещение глубины вытягивало её поверх берегов под острым углом
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: waterVS, fragmentShader: waterFS });
}
function updateWater(dt) {
  waterU.time.value += dt;
  waterU.sunDir.value.copy(sunDir);
  waterU.sunCol.value.copy(sun.color).multiplyScalar(Math.min(1.5, sun.intensity * .6) + nightK * .6);
  waterU.night.value = nightK; waterU.rain.value = world.rain;
  waterU.fogColor.value.copy(scene.fog.color); waterU.fogNear.value = scene.fog.near; waterU.fogFar.value = scene.fog.far;
}
