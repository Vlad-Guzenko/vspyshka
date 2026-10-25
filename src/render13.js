/* ---------- машины: модели кузовов ---------- */
// у каждой модели четыре части, каждая — отдельный InstancedMesh: краска (цвет машины), стёкла, тёмная отделка, светлая часть (фургон, тент, полоса);
// модель строится в натуральную длину L и растягивается по длине до c.len * 18 — длины, по которой машина считается в симуляции
// кузова со скруглёнными рёбрами: прямоугольник со скруглёнными углами, выдавленный с фаской — все двенадцать рёбер мягкие
function rboxGeo(sx, sy, sz, r) {
  const hx = sx / 2 - r, hy = sy / 2 - r, c = Math.min(r, hx, hy) * .9, s = new THREE.Shape();
  s.moveTo(-hx + c, -hy); s.lineTo(hx - c, -hy); s.quadraticCurveTo(hx, -hy, hx, -hy + c); s.lineTo(hx, hy - c); s.quadraticCurveTo(hx, hy, hx - c, hy);
  s.lineTo(-hx + c, hy); s.quadraticCurveTo(-hx, hy, -hx, hy - c); s.lineTo(-hx, -hy + c); s.quadraticCurveTo(-hx, -hy, -hx + c, -hy);
  const d = Math.max(.01, sz - 2 * r);
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 }).translate(0, 0, -d / 2);
}
let CAR_ROUND = true; // скругляем только кузова машин; после постройки моделей — обычные коробки
const _cbox = (sx, sy, sz, x, y, z) => (CAR_ROUND && Math.min(sx, sy, sz) >= 1.2 ? rboxGeo(sx, sy, sz, Math.min(.55, Math.min(sx, sy, sz) * .2)) : new THREE.BoxGeometry(sx, sy, sz)).translate(x, y, z);
// кабина-трапеция: низ lb, верх lt (сдвинут на dx), высота h, ширина w; низ в точке (x, y0)
function cabinGeo(lb, lt, h, w, x, y0, dx = 0) {
  const s = new THREE.Shape([new THREE.Vector2(-lb / 2, 0), new THREE.Vector2(lb / 2, 0), new THREE.Vector2(lt / 2 + dx, h), new THREE.Vector2(-lt / 2 + dx, h)]);
  // стойки и крыша кабины скруглены фаской
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(.1, w - .6), bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 2 }).translate(x, y0, -(w - .6) / 2);
}
function mergeGeo(list) {
  const gs = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nr = new Float32Array(n * 3); let o = 0;
  for (const g of gs) { p.set(g.attributes.position.array, o * 3); nr.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(p, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nr, 3)); out.computeBoundingSphere();
  return out;
}
const bumpers = (L, y, w, h = 1.1) => [_cbox(.7, h, w, L / 2, y, 0), _cbox(.7, h, w, -L / 2, y, 0)];
// truck: кабина над передней осью и рама — основа самосвала, бетономешалки, эвакуатора, мусоровоза
const truckCab = () => [_cbox(6.4, 3.4, 7.6, 8.8, 3.9, 0), _cbox(5, 2.6, 7.4, 8.3, 6.9, 0)];
const truckGlass = () => [_cbox(.3, 1.8, 6.6, 10.82, 7, 0), _cbox(2.6, 1.4, 7.5, 8.6, 7.1, 0)];
const truckTrim = L => [_cbox(L, 1.2, 5, 0, 3, 0), _cbox(.9, 1.4, 7.8, L / 2, 2.8, 0), _cbox(.9, 1.2, 6, -L / 2, 2.8, 0)];
// кузов по профилю: силуэт сбоку (капот со скатом, багажник, бамперы), выдавленный на ширину со скруглёнными рёбрами
function profGeo(pts, w, r = .35) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const d = Math.max(.1, w - 2 * r);
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 4 }).translate(0, 0, -d / 2);
}
// седан: низкий нос, капот к лобовому стеклу, короткий багажник; точки — с запасом на фаску
const sedanBody = () => profGeo([[-8.65, 1.75], [8.65, 1.75], [8.65, 3.0], [8.25, 3.35], [3.5, 3.7], [-6.2, 3.65], [-8.45, 3.35], [-8.65, 2.9]], 7.2);
const hatchBody = () => profGeo([[-7.4, 1.75], [7.4, 1.75], [7.4, 3.0], [7.0, 3.35], [3.0, 3.7], [-7.05, 3.75], [-7.4, 3.3]], 7);
const sportBody = () => profGeo([[-8.65, 1.45], [8.65, 1.45], [8.65, 2.1], [8.0, 2.45], [2.8, 3.05], [-6.0, 3.15], [-8.35, 3.0], [-8.65, 2.5]], 7.6);
const CAR_MODELS = {
  sedan: { L: 18, wheels: [5.6, -5.6], r: 1.45, track: 3.45, ly: 3.2, roof: 6.9,
    paint: () => [sedanBody(), _cbox(6.6, .35, 6.2, -1.6, 6.55, 0)],
    glass: () => [cabinGeo(10.5, 6.8, 2.6, 6.3, -1, 3.9, -.6)],
    trim: () => [...bumpers(18, 2, 7.3), _cbox(.25, .9, 4.6, 9.05, 3.2, 0)] },
  police: { L: 18, wheels: [5.6, -5.6], r: 1.45, track: 3.45, ly: 3.2, roof: 6.9, lightCol: "#1f3c78",
    paint: () => [sedanBody(), _cbox(6.6, .35, 6.2, -1.6, 6.55, 0)],
    glass: () => [cabinGeo(10.5, 6.8, 2.6, 6.3, -1, 3.9, -.6)],
    trim: () => [...bumpers(18, 2, 7.3)],
    light: () => [_cbox(16, .7, 7.26, -.5, 3.1, 0)] },
  taxi: { L: 18, wheels: [5.6, -5.6], r: 1.45, track: 3.45, ly: 3.2, roof: 7.9, lightCol: "#f4f1e4",
    paint: () => [sedanBody(), _cbox(6.6, .35, 6.2, -1.6, 6.55, 0)],
    glass: () => [cabinGeo(10.5, 6.8, 2.6, 6.3, -1, 3.9, -.6)],
    trim: () => [...bumpers(18, 2, 7.3), _cbox(14, .45, 7.26, -.5, 3.4, 0)],
    light: () => [_cbox(1.6, 1, 3.4, -1.6, 7.2, 0)] },
  hatch: { L: 15.5, wheels: [4.8, -4.8], r: 1.35, track: 3.35, ly: 3.2, roof: 6.9,
    paint: () => [hatchBody(), _cbox(6.4, .35, 6, -2.4, 6.55, 0)],
    glass: () => [cabinGeo(10, 7.2, 2.6, 6.1, -2, 3.9, -.9)],
    trim: () => [...bumpers(15.5, 2, 7.1)] },
  lada: { L: 16.5, wheels: [5.2, -5.2], r: 1.35, track: 3.2, ly: 3.3, roof: 7.1, lightCol: "#c9c8c2",
    paint: () => [_cbox(16.5, 2.6, 6.8, 0, 2.8, 0), _cbox(7.4, .3, 6, -1, 6.75, 0)],
    glass: () => [cabinGeo(9.6, 8, 2.7, 6.1, -1, 4.1, -.3)],
    trim: () => [_cbox(.3, 1, 5, 8.3, 3.2, 0)],
    light: () => [_cbox(.6, .7, 7, 8.4, 2.1, 0), _cbox(.6, .7, 7, -8.4, 2.1, 0)] },
  suv: { L: 18.5, wheels: [6, -6], r: 1.85, track: 3.6, ly: 4.4, roof: 9.4,
    paint: () => [_cbox(18.5, 3.4, 7.6, 0, 3.6, 0), _cbox(10.5, .4, 6.8, -1.8, 8.75, 0)],
    glass: () => [cabinGeo(12.5, 10.8, 3.2, 6.9, -1.6, 5.3, -.4)],
    trim: () => [...bumpers(18.5, 2.6, 7.7, 1.4), _cbox(10, .35, .3, -1.8, 9.1, 3), _cbox(10, .35, .3, -1.8, 9.1, -3), _cbox(18.6, .7, 7.7, 0, 2.2, 0)] },
  pickup: { L: 19.5, wheels: [6.2, -5.8], r: 1.6, track: 3.5, ly: 3.6, roof: 8,
    paint: () => [_cbox(19.5, 2.8, 7.4, 0, 3.1, 0), _cbox(5.6, .4, 6.6, 2.4, 7.6, 0), _cbox(8.4, 1.6, .4, -5.4, 5.3, 3.5), _cbox(8.4, 1.6, .4, -5.4, 5.3, -3.5), _cbox(.4, 1.6, 7.4, -9.55, 5.3, 0)],
    glass: () => [cabinGeo(7.2, 5.6, 2.9, 6.6, 2.6, 4.5, -.3)],
    trim: () => [...bumpers(19.5, 2.4, 7.5, 1.3), _cbox(8.2, .2, 6.6, -5.4, 4.55, 0)] },
  sport: { L: 18, wheels: [5.8, -5.4], r: 1.4, track: 3.6, ly: 2.5, roof: 5.6,
    paint: () => [sportBody(), _cbox(4.4, .3, 6, -2.2, 5.15, 0), _cbox(1.2, .25, 7, -8.4, 4, 0)],
    glass: () => [cabinGeo(8.8, 4.6, 2, 6.4, -1.8, 3.1, -.5)],
    trim: () => [...bumpers(18, 1.6, 7.6, .8), _cbox(.3, .8, .3, -8.4, 3.5, 2.5), _cbox(.3, .8, .3, -8.4, 3.5, -2.5)] },
  van: { L: 18, wheels: [5.8, -5.6], r: 1.45, track: 3.5, ly: 3.4, roof: 9.1,
    paint: () => [_cbox(18, 3, 7.4, 0, 3, 0), _cbox(13.5, 4.2, 7.4, -2.25, 6.6, 0)],
    glass: () => [cabinGeo(3, .2, 4.2, 7.2, 5.6, 4.5, -1.4), _cbox(9.5, 1.6, 7.5, -2.5, 7.2, 0)],
    trim: () => [...bumpers(18, 2, 7.5)] },
  ambulance: { L: 18, wheels: [5.8, -5.6], r: 1.45, track: 3.5, ly: 3.4, roof: 9.1, lightCol: "#c81e1e",
    paint: () => [_cbox(18, 3, 7.4, 0, 3, 0), _cbox(13.5, 4.2, 7.4, -2.25, 6.6, 0)],
    glass: () => [cabinGeo(3, .2, 4.2, 7.2, 5.6, 4.5, -1.4), _cbox(3.5, 1.6, 7.5, 2, 7.2, 0)],
    trim: () => [...bumpers(18, 2, 7.5)],
    light: () => [_cbox(18.04, .8, 7.46, 0, 4.9, 0)] },
  boxtruck: { L: 24, wheels: [8.6, -6.5, -9.6], r: 1.7, track: 3.6, ly: 3.4, roof: 10.5, lightCol: "#e6e4dc",
    paint: () => [_cbox(6.4, 3, 7.6, 8.8, 3.3, 0), _cbox(5.2, 2.6, 7.6, 8.2, 6.1, 0)],
    glass: () => [_cbox(.3, 2, 6.6, 10.85, 6, 0), _cbox(2.4, 1.6, 7.7, 9.2, 6.2, 0)],
    trim: () => [_cbox(24, 1, 5, 0, 2, 0), _cbox(.8, 1.4, 7.7, 12, 2.4, 0)],
    light: () => [_cbox(17, 8.2, 7.9, -3.4, 6.1, 0)] },
  truck: { L: 24, wheels: [8.8, -5, -8.6], r: 1.7, track: 3.6, ly: 3.4, roof: 8.6,
    paint: truckCab, glass: truckGlass, trim: () => truckTrim(24) },
  garbage: { L: 24, wheels: [8.8, -5, -8.6], r: 1.7, track: 3.6, ly: 3.4, roof: 8.6, lightCol: "#d8d6cc",
    paint: () => [...truckCab(), _cbox(15, 6.8, 7.8, -4, 7, 0)], glass: truckGlass, trim: () => truckTrim(24),
    light: () => [_cbox(.6, 6.2, 7.2, -11.8, 6.8, 0)] },
  fire: { L: 27, wheels: [9.5, -6, -9.5], r: 1.8, track: 3.6, ly: 3.6, roof: 8.2, lightCol: "#e8e2d4",
    paint: () => [_cbox(20, 4.6, 7.8, -3.5, 4.5, 0), _cbox(7, 5.6, 7.8, 10, 5, 0)],
    glass: () => [_cbox(.3, 2.2, 6.8, 13.52, 6.4, 0), _cbox(5, 1.6, 7.9, 10, 6.5, 0)],
    trim: () => [_cbox(27, 1, 5, 0, 1.9, 0), _cbox(.8, 1.4, 7.9, 13.6, 2.4, 0)],
    light: () => [_cbox(20, .5, 7.9, -3.5, 4.8, 0)] },
  army: { L: 26, wheels: [9.5, -5, -9], r: 2, track: 3.7, ly: 4, roof: 10.8, lightCol: "#3f4630",
    paint: () => [_cbox(7, 3.2, 7.6, 9.5, 4, 0), _cbox(5, 2.8, 7.4, 8.3, 7, 0), _cbox(15, 2, 7.8, -4.5, 4.4, 0)],
    glass: () => [_cbox(.3, 1.8, 6.6, 10.82, 7.1, 0), _cbox(2.6, 1.4, 7.5, 8.6, 7.2, 0)],
    trim: () => [_cbox(26, 1.2, 5, 0, 2.4, 0), _cbox(1, 1.4, 7.8, 13, 3, 0)],
    light: () => [_cbox(15, 5, 7.8, -4.5, 7.9, 0)] },
  bus: { L: 38, wheels: [12.5, -11], r: 1.7, track: 3.8, ly: 3.2, roof: 10, lightCol: "#d4d4cc",
    paint: () => [_cbox(38, 7.6, 8, 0, 5.6, 0)],
    glass: () => [_cbox(30, 3, 8.1, -2.5, 7, 0), _cbox(.15, 4.4, 7.2, 19.02, 6.6, 0), _cbox(.15, 2.4, 6.4, -19.02, 7.6, 0), _cbox(2.4, 5.2, 8.1, 14.5, 4.6, 0), _cbox(2.4, 5.2, 8.1, 1, 4.6, 0)],
    trim: () => [...bumpers(38, 2.4, 8.1, 1.2), _cbox(38, .8, 8.05, 0, 2.2, 0)],
    light: () => [_cbox(36, .5, 7.6, 0, 9.65, 0)] },
  tanker: { L: 29, wheels: [11, -7, -11], r: 1.7, track: 3.6, ly: 3, roof: 8, lightCol: "#3a3c3e",
    paint: () => [_cbox(6.8, 6, 7.6, 11.1, 4.6, 0), new THREE.CylinderGeometry(3.6, 3.6, 20, 18).rotateZ(Math.PI / 2).translate(-3.6, 5.8, 0)],
    glass: () => [_cbox(.3, 2.4, 6.8, 14.55, 5.6, 0), _cbox(3, 1.8, 7.7, 11.5, 5.8, 0)],
    trim: () => [_cbox(29, 1, 5, 0, 2, 0), _cbox(.8, 1.4, 7.7, 14.6, 2.4, 0)],
    light: () => [new THREE.CylinderGeometry(3.7, 3.7, .6, 18).rotateZ(Math.PI / 2).translate(-9, 5.8, 0), new THREE.CylinderGeometry(3.7, 3.7, .6, 18).rotateZ(Math.PI / 2).translate(1.8, 5.8, 0)] },
  // ---- варианты служб ----
  // патрульный внедорожник ППС/ДПС: белый, синяя полоса
  policeSuv: { L: 18.5, wheels: [6, -6], r: 1.8, track: 3.6, ly: 4, roof: 7.9, lightCol: "#1f3c78",
    paint: () => [_cbox(18.5, 3, 7.6, 0, 3.4, 0), _cbox(10.5, .35, 6.8, -1.8, 7.65, 0)],
    glass: () => [cabinGeo(12.5, 10.8, 2.6, 6.9, -1.6, 4.9, -.4)],
    trim: () => [...bumpers(18.5, 2.4, 7.7, 1.3), _cbox(18.6, .7, 7.7, 0, 2.1, 0)],
    light: () => [_cbox(18.56, .8, 7.66, 0, 3.9, 0)] },
  // фургон ППС/автозак: высокий кузов, синяя полоса, решётки на окнах
  policeVan: { L: 21, wheels: [6.8, -6.4], r: 1.55, track: 3.8, ly: 3.4, roof: 9.2, lightCol: "#1f3c78",
    paint: () => [_cbox(21, 3, 7.9, 0, 3, 0), _cbox(15.5, 4.4, 7.9, -2.75, 6.7, 0)],
    glass: () => [cabinGeo(3, .2, 4.2, 7.6, 7.2, 4.5, -1.4)],
    trim: () => [...bumpers(21, 2, 8), _cbox(7, 1.8, 7.96, -6, 7.1, 0)],
    light: () => [_cbox(21.04, .9, 7.96, 0, 4.2, 0)] },
  // автобус ОМОН/Росгвардии (ПАЗ): короткий, тёмно-синий, решётки
  omon: { L: 30, wheels: [9.5, -8.5], r: 1.8, track: 4.4, ly: 3.4, roof: 11.6, lightCol: "#c8ccd0",
    paint: () => [_cbox(30, 8.4, 9.6, 0, 6.2, 0)],
    glass: () => [_cbox(22, 2.6, 9.7, -2.5, 7.8, 0), _cbox(.15, 4.2, 8.6, 15.02, 7, 0)],
    trim: () => [...bumpers(30, 2.4, 9.7, 1.2), _cbox(22, 2, 9.75, -2.5, 7.8, 0)],
    light: () => [_cbox(30.04, .6, 9.66, 0, 4.4, 0)] },
  // реанимобиль на шасси грузовика: кабина и бело-красный кузов-фургон
  ambulance2: { L: 24, wheels: [8.6, -7.6], r: 1.7, track: 4.2, ly: 3.6, roof: 11, lightCol: "#d42020",
    paint: () => [_cbox(6.4, 3.6, 9, 8.8, 3.8, 0), _cbox(5.2, 2.6, 8.8, 8.2, 7, 0), _cbox(17, 8.4, 9.6, -3.4, 6.6, 0)],
    glass: () => [_cbox(.3, 2, 7.8, 10.85, 6.8, 0), _cbox(2.4, 1.6, 9.1, 9.2, 7, 0), _cbox(5, 1.5, 9.66, -2, 8.4, 0)],
    trim: () => [_cbox(24, 1, 6, 0, 2.2, 0), _cbox(.8, 1.4, 9.1, 12, 2.6, 0)],
    light: () => [_cbox(17.04, 1.2, 9.66, -3.4, 5, 0), _cbox(17.04, .5, 9.66, -3.4, 10.4, 0)] },
  // пожарная автолестница: низкий кузов-платформа под лестницу
  ladder: { L: 30, wheels: [11, -4, -10], r: 2.1, track: 4.5, ly: 4.4, roof: 12, lightCol: "#e8e2d4",
    paint: () => [_cbox(8, 7.2, 10, 11, 6.2, 0), _cbox(21, 3.6, 10, -4, 4.6, 0)],
    glass: () => [_cbox(.3, 2.8, 8.8, 15.02, 8.2, 0), _cbox(6, 2, 10.06, 11, 8.3, 0)],
    trim: () => [_cbox(30, 1.2, 6.4, 0, 2.4, 0), _cbox(.9, 1.8, 10.1, 15.2, 3, 0), _cbox(19, .6, 10.06, -4, 6.7, 0)],
    light: () => [_cbox(21.04, .7, 10.06, -4, 4.4, 0)] },
  // аварийно-спасательная машина: кабина и высокий отсек с рольставнями
  rescue: { L: 28, wheels: [10, -7], r: 2.1, track: 4.5, ly: 4.4, roof: 13, lightCol: "#e8e2d4",
    paint: () => [_cbox(7.6, 7.4, 10, 10.2, 6.3, 0), _cbox(19.6, 9.6, 10, -4.2, 7.4, 0)],
    glass: () => [_cbox(.3, 2.8, 8.8, 14.02, 8.4, 0), _cbox(5.6, 2, 10.06, 10.2, 8.4, 0)],
    trim: () => [_cbox(28, 1.2, 6.4, 0, 2.4, 0), _cbox(.9, 1.8, 10.1, 14.2, 3, 0), _cbox(5.6, 6, 10.08, -1, 7.6, 0), _cbox(5.6, 6, 10.08, -7.6, 7.6, 0)],
    light: () => [_cbox(19.64, .9, 10.06, -4.2, 3.4, 0)] },
  // БТР: восемь колёс, скошенный корпус, башенка с пулемётом
  btr: { L: 30, wheels: [10.5, 4, -3, -9.5], r: 2.2, track: 4.6, ly: 5.6, roof: 11, lightCol: "#3f4630",
    paint: () => [_cbox(30, 4.2, 10.4, 0, 4.9, 0), cabinGeo(30, 22, 2.6, 10, -1, 7, -2), new THREE.CylinderGeometry(2.4, 2.8, 2, 12).translate(2, 10.6, 0)],
    glass: () => [_cbox(1.6, .5, 6, 13.6, 8.2, 0)],
    trim: () => [new THREE.CylinderGeometry(.35, .35, 9, 6).rotateZ(Math.PI / 2).translate(7.5, 10.9, 0), _cbox(28, .6, .6, -1, 5.2, 5.4), _cbox(28, .6, .6, -1, 5.2, -5.4)] },
  // бронеавтомобиль «Тигр»: высокий угловатый внедорожник
  tigr: { L: 22, wheels: [7.2, -7], r: 2.2, track: 4.3, ly: 4.6, roof: 10.2, lightCol: "#3f4630",
    paint: () => [_cbox(22, 4, 9.2, 0, 4.6, 0), cabinGeo(15, 12, 3.4, 8.8, -1.6, 6.6, -.4)],
    glass: () => [_cbox(.4, 1.6, 7, 6.6, 8.2, 0), _cbox(10, 1.2, 8.86, -2.4, 8.6, 0)],
    trim: () => [...bumpers(22, 2.8, 9.3, 1.6), _cbox(1, 2.4, 9.3, 11.3, 4.4, 0), _cbox(4, .5, 7, -2.4, 10.3, 0)] },
  // эвакуатор с платформой
  tow: { L: 26, wheels: [9.2, -5, -9], r: 2, track: 4.4, ly: 4, roof: 10,
    paint: () => [_cbox(6.6, 6.4, 9.6, 9.6, 5.8, 0)],
    glass: () => [_cbox(.3, 2.4, 8.6, 12.92, 7.6, 0), _cbox(4.6, 1.8, 9.66, 9.6, 7.6, 0)],
    trim: () => [_cbox(26, 1.2, 6, 0, 2.6, 0), _cbox(.9, 1.6, 9.7, 13.1, 3, 0)],
    light: () => [_cbox(18, .8, 9.6, -3.6, 4.4, 0), _cbox(1.2, 1.4, 9.6, -12.4, 5.2, 0)] },
  // трал: седельный тягач и низкорамный полуприцеп, сзади — поднятые сходни; технику возят на платформе
  lowboy: { L: 51, wheels: [22.5, 13.5, 10.5, -15, -18.5, -22], r: 1.9, track: 4.5, ly: 4.2, roof: 12.4, lightCol: "#f08a1c",
    paint: () => [_cbox(7.4, 7.6, 10, 21.6, 6.6, 0), _cbox(5.4, 1.8, 9.6, 21, 11.2, 0), _cbox(7, 2.4, 9.8, 12, 5.8, 0), _cbox(22, 1.2, 10, -1.5, 3.4, 0), _cbox(13, 2.6, 10, -18.8, 4.3, 0)],
    glass: () => [_cbox(.3, 2.8, 8.8, 25.32, 8.6, 0), _cbox(4.4, 1.8, 10.06, 22.2, 8.8, 0)],
    trim: () => [_cbox(16, 1.6, 6.4, 17, 3, 0), _cbox(.9, 1.8, 10.1, 25.5, 3.2, 0), _cbox(4, 1.6, 2, 15, 3.4, 4.2), _cbox(22, .5, 9.6, -1.5, 2.6, 0), _cbox(.6, 1.2, 6, -25.2, 3.4, 0)],
    light: () => [_cbox(.8, 4.4, 3.4, -24.9, 7.6, 2.8), _cbox(.8, 4.4, 3.4, -24.9, 7.6, -2.8), _cbox(.3, .9, 9.9, -25.3, 4.6, 0)] },
  // аварийка коммунальщиков: оранжевый фургон с полосой
  utility: { L: 21, wheels: [6.8, -6.4], r: 1.55, track: 3.8, ly: 3.4, roof: 9.2, lightCol: "#e8e4dc",
    paint: () => [_cbox(21, 3, 7.9, 0, 3, 0), _cbox(15.5, 4.4, 7.9, -2.75, 6.7, 0)],
    glass: () => [cabinGeo(3, .2, 4.2, 7.6, 7.2, 4.5, -1.4), _cbox(4, 1.6, 7.96, 2, 7.2, 0)],
    trim: () => [...bumpers(21, 2, 8)],
    light: () => [_cbox(21.04, .8, 7.96, 0, 4.6, 0)] },
};
// грузовые машины и автобусы в натуральную ширину (2,5 м) и высоту: [по высоте, по ширине, радиус колёс]
const MODEL_FIT = { truck: [1.3, 1.28, 2.1], garbage: [1.3, 1.28, 2.1], boxtruck: [1.22, 1.24, 1.9], fire: [1.32, 1.28, 2.1], army: [1.15, 1.28, 2.2], tanker: [1.25, 1.28, 2], bus: [1.18, 1.25, 1.9], suv: [.86, 1, 1.8], van: [1, 1.06, 1.5] };
for (const k in MODEL_FIT) { const M = CAR_MODELS[k], [sy, sz, r] = MODEL_FIT[k]; M.fit = [sy, sz]; M.track *= sz; M.ly *= sy; M.roof *= sy; M.r = r; }

const CAR_PARTS = ["paint", "glass", "trim", "light"];
const carPaintMat = new THREE.MeshStandardMaterial({ roughness: .3, metalness: .5 }), carGlassMat = new THREE.MeshStandardMaterial({ roughness: .06, metalness: .8, envMapIntensity: 1.5 }), // стекло отражает небо и улицу, а не глухо-чёрное
  carTrimMat = new THREE.MeshStandardMaterial({ roughness: .75, metalness: .2 }), carLightMat = new THREE.MeshStandardMaterial({ roughness: .55, metalness: .2 });
const CAR_MATS = { paint: carPaintMat, glass: carGlassMat, trim: carTrimMat, light: carLightMat };
for (const k in CAR_MODELS) { const M = CAR_MODELS[k]; M.geo = {}; for (const p of CAR_PARTS) if (M[p]) { M.geo[p] = mergeGeo(M[p]()); if (M.fit) M.geo[p].scale(1, M.fit[0], M.fit[1]); } }
CAR_ROUND = false;
const wheelGeo = (() => {
  const tyre = new THREE.CylinderGeometry(1.4, 1.4, 1.6, 16).rotateX(Math.PI / 2).toNonIndexed(), rim = new THREE.CylinderGeometry(.82, .82, 1.68, 12).rotateX(Math.PI / 2).toNonIndexed(), hub = new THREE.CylinderGeometry(.3, .3, 1.76, 8).rotateX(Math.PI / 2).toNonIndexed();
  const parts = [[tyre, [.08, .08, .085]], [rim, [.55, .56, .58]], [hub, [.3, .3, .32]]], p = [], n = [], c = [];
  for (const [g, col] of parts) { p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) c.push(...col); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  return g;
})();
const lightGeo = new THREE.BoxGeometry(.4, .8, 1.6);
let cm = null, carCap = 0;
function carModelOf(c) {
  if (c.model && CAR_MODELS[c.model]) return CAR_MODELS[c.model];
  // старые сохранения и машины без модели: по флагам
  c.model = c.service ? (SERVICE_MODEL[c.service] || "van") : c.bus ? "bus" : c.tanker ? "tanker" : "sedan";
  return CAR_MODELS[c.model];
}
function makeCarMeshes(cap) {
  if (cm) { for (const k in cm.fixed) { scene.remove(cm.fixed[k]); cm.fixed[k].dispose(); } for (const m of cm.parts) { scene.remove(m.mesh); m.mesh.dispose(); } }
  carCap = cap;
  const mk = (geo, mat, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); scene.add(m); return m; };
  cm = { parts: [], byModel: {}, fixed: {
    wheels: mk(wheelGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: .25 }), cap * 8),
    lights: mk(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), cap * 4, false),
    beams: mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff2d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), cap, false),
    bars: mk(new THREE.BoxGeometry(1.4, .8, 2.4), new THREE.MeshBasicMaterial({ toneMapped: false }), 200, false),
  } };
  cm.fixed.beams.renderOrder = 2;
  cm.fixed.wheels.instanceColor = null; // цвет шины и диска — в самой модели колеса
  // модель может достаться любой машине, поэтому ёмкость каждой — на весь парк; пустые не рисуются
  for (const k in CAR_MODELS) { const M = CAR_MODELS[k], list = []; for (const p of CAR_PARTS) if (M.geo[p]) { const part = { p, mesh: mk(M.geo[p], CAR_MATS[p], cap) }; list.push(part); cm.parts.push(part); } cm.byModel[k] = { list, n: 0 }; }
}
const _cm = new THREE.Matrix4(), _cw = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _cc = new THREE.Color();
const SERVICE_CAB = { army: "#3d4529", fire: "#8e1c14" };
function updateCars() {
  const list = cars.filter(c => !c.gone);
  if (list.length > carCap) makeCarMeshes(list.length + 200);
  const dusk = carLightK > .15, ph = (simT * 3) % 1 < .5, F = cm.fixed;
  for (const k in cm.byModel) cm.byModel[k].n = 0;
  let wi = 0, li = 0, bi = 0, bar = 0;
  for (const c of list) {
    const M = carModelOf(c), B = cm.byModel[c.model], i = B.n++, sx = (c.vlen || c.len || 1) * 18 / M.L, dead = c.wreck && c.boomT <= 0;
    _ce.set(c.roll || 0, -c.ang, 0, "YXZ"); _cq.setFromEuler(_ce);
    _cs.set(sx, c.crushed ? .35 : 1, 1);
    if (c.rx === undefined || Math.hypot(c.rx - c.x, c.ry - c.y) > 40) { c.rx = c.x; c.ry = c.y; } const rk = c.turnT > 0 ? .12 : .25; c.rx += (c.x - c.rx) * rk; c.ry += (c.y - c.ry) * rk;
    _cm.compose(_cv.set(X(c.rx), (c.z || 0) + (c.roll ? Math.abs(Math.sin(c.roll)) * 3.6 : 0) + gY(c.rx, c.ry), Z(c.ry)), _cq, _cs);
    if (c.police || c.service === "police") c.police = true;
    for (const part of B.list) {
      part.mesh.setMatrixAt(i, _cm);
      const col = part.p === "paint" ? (dead ? "#1d1a18" : c.col || (c.police ? "#e9e9ee" : "#888")) : part.p === "glass" ? (dead ? "#0c0b0a" : "#2e3a46") : part.p === "trim" ? (dead ? "#0c0b0a" : c.cab || SERVICE_CAB[c.service] || "#26282a") : (dead ? "#141210" : c.liv || M.lightCol || "#d8d8d2");
      part.mesh.setColorAt(i, _cc.set(col));
    }
    // колёса: у модели свои оси и радиус; растяжку кузова по длине на колёса не переносим
    const ws = M.r / 1.4;
    for (const wx of M.wheels) for (const s of [-1, 1]) { if (wi >= F.wheels.instanceMatrix.count) break; _cw.makeScale(ws / sx, ws, M.r > 1.7 ? 1.15 : 1).setPosition(wx, M.r, s * M.track); F.wheels.setMatrixAt(wi++, _cw.premultiply(_cm)); }
    // фары: днём у едущих — дневные ходовые огни, вечером и ночью — ближний свет с пятном на дороге и красные габариты; при торможении — стоп-сигналы
    const lit = !c.wreck && (c.moving || c.police), hw = M.L / 2 + .1;
    for (let k = 0; k < 4; k++) {
      _cw.makeTranslation(k < 2 ? hw : -hw, M.ly, (k % 2 ? 1 : -1) * Math.min(M.track - .3, 2.6 * M.track / 3.45)); F.lights.setMatrixAt(li, _cw.premultiply(_cm));
      F.lights.setColorAt(li, _cc.set(k < 2 ? (lit ? (dusk ? "#fff6dd" : "#dfe6ea") : "#9aa0a4") : (lit && c.v < 3 ? "#ff2a1a" : lit && dusk ? "#b0201a" : "#5a1a16"))); li++;
    }
    if (c.moving && dusk) { _cw.makeScale(26, 1, 18).setPosition(M.L / 2 + 7, .25, 0); F.beams.setMatrixAt(bi++, _cw.premultiply(_cm)); }
    const sir = c.police ? "police" : c.siren;
    if (sir && !c.wreck && bar < 198 && (c.moving || c.deployed || c.police)) for (let k = 0; k < 2; k++) {
      _cw.makeTranslation(M.L > 22 ? M.L / 2 - 4 : -1, M.roof + .4, k ? 1.3 : -1.3); F.bars.setMatrixAt(bar, _cw.premultiply(_cm));
      const on = (k === 0) === ph, col = sir === "police" ? (k ? "#2050ff" : "#ff2020") : sir === "amber" ? "#ffa020" : "#ff2020";
      F.bars.setColorAt(bar, _cc.set(on ? col : "#111")); bar++;
    }
  }
  for (const k in cm.byModel) { const B = cm.byModel[k]; for (const part of B.list) { part.mesh.count = B.n; if (B.n) { part.mesh.instanceMatrix.needsUpdate = true; part.mesh.instanceColor.needsUpdate = true; } } }
  F.wheels.count = wi; F.lights.count = li; F.beams.count = bi; F.bars.count = bar;
  F.beams.material.opacity = carLightK * (.18 + nightK * .32);
  for (const k in F) { F[k].instanceMatrix.needsUpdate = true; if (F[k].instanceColor) F[k].instanceColor.needsUpdate = true; }
}
