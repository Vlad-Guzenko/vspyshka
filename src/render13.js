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
// ещё легковые для разнообразия; их кузова из коробок — запасные, на случай если настоящие модели не загрузились
Object.assign(CAR_MODELS, { muscle: { ...CAR_MODELS.sport }, muscle2: { ...CAR_MODELS.sport }, roadster: { ...CAR_MODELS.sport }, limo: { ...CAR_MODELS.sedan } });
// грузовые машины и автобусы в натуральную ширину (2,5 м) и высоту: [по высоте, по ширине, радиус колёс]
const MODEL_FIT = { truck: [1.3, 1.28, 2.1], garbage: [1.3, 1.28, 2.1], boxtruck: [1.22, 1.24, 1.9], fire: [1.32, 1.28, 2.1], army: [1.15, 1.28, 2.2], tanker: [1.25, 1.28, 2], bus: [1.18, 1.25, 1.9], suv: [.86, 1, 1.8], van: [1, 1.06, 1.5] };
for (const k in MODEL_FIT) { const M = CAR_MODELS[k], [sy, sz, r] = MODEL_FIT[k]; M.fit = [sy, sz]; M.track *= sz; M.ly *= sy; M.roof *= sy; M.r = r; }

// base — части в своих цветах (у моделей с палитрой цвет зашит в вершины), не перекрашиваются
const CAR_PARTS = ["paint", "glass", "trim", "light", "base"];
const carPaintMat = new THREE.MeshStandardMaterial({ roughness: .3, metalness: .5 }), carGlassMat = new THREE.MeshStandardMaterial({ roughness: .06, metalness: .8, envMapIntensity: 1.5 }), // стекло отражает небо и улицу, а не глухо-чёрное
  carTrimMat = new THREE.MeshStandardMaterial({ roughness: .75, metalness: .2 }), carLightMat = new THREE.MeshStandardMaterial({ roughness: .55, metalness: .2 });
const CAR_MATS = { paint: carPaintMat, glass: carGlassMat, trim: carTrimMat, light: carLightMat, base: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .25 }) };
for (const k in CAR_MODELS) { const M = CAR_MODELS[k]; M.geo = {}; for (const p of CAR_PARTS) if (M[p]) { M.geo[p] = mergeGeo(M[p]()); if (M.fit) M.geo[p].scale(1, M.fit[0], M.fit[1]); } }
CAR_ROUND = false;

/* ---------- настоящие модели машин: «Free Low Poly Vehicles Pack» от Rgsdev (CC0), лежат в cars.js ----------
   Кузов из FBX раскладывается по материалам на те же четыре части: самый большой по площади цветной материал — краска,
   стёкла и фары — стекло, чёрное, шины, задние фонари и мигалки — отделка, остальное (белые детали, полосы, табличка
   такси) — светлая часть. Модели у автора широкие и высокие, как игрушки, — сжимаем до натуральных размеров: длина
   прежней модели, ширина и высота по таблице. Колёса, фары и маячки ставим туда, где они у модели.
   Нет cars.js или FBXLoader — остаются кузова из коробок */
// w, h — ширина и высота в единицах мира (1 = 25 см); href — высота кузова у модели без таблички и маячков, см;
// main — основной цвет кузова, если он не самый большой по площади; paint — какие ещё материалы красить в цвет машины (у полиции чёрные капот и двери — у нас машины белые с синей полосой)
const FBX_CARS = {
  sedan: { f: "Sedan", w: 7.3, h: 5.9 }, lada: { f: "Sedan", w: 6.9, h: 5.8 }, hatch: { f: "Hatchback", w: 7.1, h: 6.1 }, suv: { f: "SUV", w: 7.7, h: 7.2 },
  pickup: { f: "Pickup", w: 7.6, h: 7.2 }, sport: { f: "Sports", w: 7.5, h: 5 }, van: { f: "Van", w: 7.9, h: 8.6 },
  taxi: { f: "Taxi", w: 7.3, h: 5.9, href: 200 }, muscle: { f: "Muscle", w: 7.5, h: 5.3 }, muscle2: { f: "Muscle_2", w: 7.5, h: 5.3 },
  roadster: { f: "Roadster", w: 7.3, h: 5 }, limo: { f: "Limousine", w: 7.6, h: 5.9, main: "body black" },
  police: { f: "Police_Sedan", w: 7.3, h: 5.9, href: 200, paint: ["body black"], stripe: true },
  policeSuv: { f: "Police_SUV", w: 7.7, h: 7.2, href: 205, paint: ["body black"], stripe: true },
  ambulance: { f: "Ambulance", w: 7.9, h: 10.2 }, bus: { f: "Bus", w: 10, h: 12.4 },
};
// грузовики со стройки Majadroid (CC0): шасси с кабиной — основа самосвала, миксера, эвакуатора, мусоровоза, фургона,
// бензовоза, армейского и пожарного; что на шасси (будка, цистерна, тент, кузов АЦ) — коробки по месту.
// Цвета у этих моделей — из палитры по UV: основной цвет кабины перекрашивается в цвет машины, стёкла — стекло, остальное как есть
const box3 = (sx, sy, sz, x, y, z) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const TRUCK = { f: "S_Trucks", mesh: "Base_Truck", w: 10, h: 12.4, pal: true };
const FBX_PAL = {
  truck: TRUCK,
  garbage: { ...TRUCK, add: { light: () => [box3(15, 8.6, 9.8, -4.4, 8.9, 0)] } },
  boxtruck: { ...TRUCK, add: { light: () => [box3(15, 9, 9.8, -4.5, 9.1, 0)] } },
  tanker: { ...TRUCK, add: { paint: () => [new THREE.CylinderGeometry(4.2, 4.2, 17, 18).rotateZ(Math.PI / 2).translate(-5.5, 8.8, 0)],
    light: () => [-11, -5.5, 0].map(x => new THREE.CylinderGeometry(4.3, 4.3, .6, 18).rotateZ(Math.PI / 2).translate(x, 8.8, 0)) } },
  army: { ...TRUCK, add: { paint: () => [box3(15, 2.4, 9.8, -4.5, 5.6, 0)], light: () => [box3(15, 5.6, 9.8, -4.5, 9.6, 0)] } },
  fire: { ...TRUCK, add: { paint: () => [box3(19, 6.2, 10, -4, 7.6, 0)], light: () => [box3(19.04, .8, 10.06, -4, 6.4, 0), box3(19.04, .5, 10.06, -4, 10.5, 0)] } },
};
function fbxCar(key, spec, pal) {
  const src = window.CAR_FBX && window.CAR_FBX[spec.f], M = CAR_MODELS[key]; if (!src || !M || !THREE.FBXLoader || (spec.pal && !pal)) return;
  const bin = atob(src), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  // у автора многоугольники не разбиты на треугольники — загрузчик разбивает их сам и ругается на каждый; молчим
  const warn = console.warn; console.warn = () => {}; let obj; try { obj = new THREE.FBXLoader().parse(u8.buffer, ""); } finally { console.warn = warn; }
  obj.updateMatrixWorld(true);
  const body = [], wheels = []; obj.traverse(o => { if (o.isMesh && (!spec.mesh || o.name === spec.mesh)) (/wheel/i.test(o.name) ? wheels : body).push(o); });
  const bb = new THREE.Box3(); body.forEach(o => bb.expandByObject(o));
  // у модели x — вбок, y — вверх, z — вперёд (см); у машины игры x — вперёд, y — вверх, z — вбок
  const kx = M.L / (bb.max.z - bb.min.z), kz = spec.w / (bb.max.x - bb.min.x), ky = spec.h / (spec.href || bb.max.y), cz = (bb.max.z + bb.min.z) / 2;
  const T = new THREE.Matrix4().set(0, 0, kx, -cz * kx, 0, ky, 0, 0, -kz, 0, 0, 0, 0, 0, 0, 1);
  // треугольники по материалам, сразу в координатах игры
  const byMat = {}, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const o of body) {
    const m = new THREE.Matrix4().multiplyMatrices(T, o.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(m), g = o.geometry, P = g.attributes.position, N = g.attributes.normal, I = g.index, UV = g.attributes.uv;
    const mats = Array.isArray(o.material) ? o.material : [o.material], groups = g.groups.length ? g.groups : [{ start: 0, count: I ? I.count : P.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mname = (mats[gr.materialIndex] || mats[0]).name.toLowerCase();
      for (let t = gr.start; t + 2 < gr.start + gr.count; t += 3) {
        // у модели с палитрой «материал» треугольника — цвет палитры в середине его UV
        let name = mname;
        if (spec.pal && UV) {
          let u = 0, w = 0; for (let k = 0; k < 3; k++) { const vi = I ? I.getX(t + k) : t + k; u += UV.getX(vi) / 3; w += UV.getY(vi) / 3; }
          const px = Math.min(pal.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * pal.w))), py = Math.min(pal.h - 1, Math.max(0, Math.floor((1 - (w - Math.floor(w))) * pal.h))), i4 = (py * pal.w + px) * 4;
          name = "#" + [0, 1, 2].map(k => pal.d[i4 + k].toString(16).padStart(2, "0")).join("");
        }
        const B = byMat[name] || (byMat[name] = { p: [], n: [], area: 0 });
        for (let k = 0; k < 3; k++) { const vi = I ? I.getX(t + k) : t + k; v[k].fromBufferAttribute(P, vi).applyMatrix4(m); n.fromBufferAttribute(N, vi).applyMatrix3(nm).normalize(); B.p.push(v[k].x, v[k].y, v[k].z); B.n.push(n.x, n.y, n.z); }
        B.area += e1.subVectors(v[1], v[0]).cross(e2.subVectors(v[2], v[0])).length() / 2;
      }
    }
  }
  // цвет палитры: насыщенность и светлота; стекло — светлое голубое
  const hsl = k => { const n = parseInt(k.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h / 6, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l }; };
  const glassy = k => { const o = hsl(k); return o.h > .5 && o.h < .7 && o.s > .3 && o.l > .3 && o.l < .8; };
  const main = spec.main || (spec.pal ? Object.keys(byMat).filter(k => { const o = hsl(k); return o.s > .35 && o.l > .2 && o.l < .8 && !glassy(k); })
    : Object.keys(byMat).filter(k => /^body /.test(k) && k !== "body black")).sort((a, b) => byMat[b].area - byMat[a].area)[0];
  const partOf = k => spec.pal ? (k === main ? "paint" : glassy(k) ? "glass" : "base")
    : /window|headlight/.test(k) ? "glass" : k === main || (spec.paint || []).includes(k) ? "paint" : /black|tire|rear light|flasher/.test(k) ? "trim" : "light";
  const acc = { paint: { p: [], n: [] }, glass: { p: [], n: [] }, trim: { p: [], n: [] }, light: { p: [], n: [] }, base: { p: [], n: [], c: [] } };
  for (const k in byMat) {
    const part = partOf(k), a = acc[part]; a.p.push(...byMat[k].p); a.n.push(...byMat[k].n);
    if (part === "base") { const c = new THREE.Color(k); for (let i = 0; i < byMat[k].p.length; i += 3) a.c.push(c.r, c.g, c.b); }
  }
  // надстройки по месту: будка, цистерна, тент, кузов
  if (spec.add) for (const p in spec.add) for (const g0 of spec.add[p]()) { const g = g0.index ? g0.toNonIndexed() : g0; acc[p].p.push(...g.attributes.position.array); acc[p].n.push(...g.attributes.normal.array); }
  const box = k => { const B = byMat[k]; if (!B) return null; const b = new THREE.Box3(); for (let i = 0; i < B.p.length; i += 3) b.expandByPoint(v[0].fromArray(B.p, i)); return b; };
  // полоса ДПС по бортам: синяя, на уровне ручек дверей
  if (spec.stripe) { const bx = box(main), w = (bx.max.z - bx.min.z) / 2 + .05, g = new THREE.BoxGeometry(M.L * .78, .8, w * 2).translate(-.3, bx.min.y + (bx.max.y - bx.min.y) * .28, 0).toNonIndexed(); acc.light.p.push(...g.attributes.position.array); acc.light.n.push(...g.attributes.normal.array); }
  M.geo = {};
  for (const p of CAR_PARTS) {
    const a = acc[p]; if (!a.p.length) continue;
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(a.p, 3)); gg.setAttribute("normal", new THREE.Float32BufferAttribute(a.n, 3));
    if (a.c) gg.setAttribute("color", new THREE.Float32BufferAttribute(a.c, 3));
    gg.computeBoundingSphere(); M.geo[p] = gg;
  }
  // колёса: оси, радиус и колея — как у модели
  const ws = wheels.map(o => new THREE.Box3().setFromObject(o));
  if (spec.mesh) M.wheels = []; // колёса — часть модели
  else if (ws.length) {
    // левое и правое колесо у модели стоят чуть несимметрично — оси ближе метра считаем одной
    const xs = ws.map(b => ((b.min.z + b.max.z) / 2 - cz) * kx).sort((a, b) => b - a); M.wheels = [];
    for (const x of xs) { const last = M.wheels[M.wheels.length - 1]; if (last === undefined || last - x > 4) M.wheels.push(x); else M.wheels[M.wheels.length - 1] = (last + x) / 2; }
    M.r = (ws[0].max.y - ws[0].min.y) / 2 * ky; M.track = Math.max(...ws.map(b => Math.abs(b.min.x + b.max.x) / 2)) * kz + .2;
  }
  // фары: высота и разнос — по фарам модели; маячки — над мигалками модели
  // светящиеся блоки (фары и фонари на всех машинах одни) прячем в фары модели: снаружи видна только их передняя грань
  const hl = box("headlights"), rl = box("rear lights"), lzOf = b => Math.max(Math.abs(b.min.z), Math.abs(b.max.z)) - .9;
  if (hl) { M.ly = (hl.min.y + hl.max.y) / 2; M.lz = lzOf(hl); M.lf = hl.max.x - .12; }
  if (rl) { M.lyr = (rl.min.y + rl.max.y) / 2; M.lzr = lzOf(rl); M.lr = rl.min.x + .12; }
  const fl = Object.keys(byMat).filter(k => /flasher/.test(k)).map(box);
  if (fl.length) { const b = fl.reduce((a, x) => a.union(x), fl[0].clone()); M.roof = b.max.y - .6; M.barX = (b.min.x + b.max.x) / 2; }
  else M.roof = box(main) ? box(main).max.y : M.roof;
  delete M.fit; M.fbx = true;
}
for (const k in FBX_CARS) { try { fbxCar(k, FBX_CARS[k]); } catch (e) { console.warn("модель машины не загрузилась", k, e); } }
// палитра — картинка, она раскодируется не сразу: грузовики встают на место чуть позже, вместе с пересборкой машин
if (window.CAR_PAL) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const pal = { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
    for (const k in FBX_PAL) { try { fbxCar(k, FBX_PAL[k], pal); } catch (e) { console.warn("модель машины не загрузилась", k, e); } }
    if (cm) makeCarMeshes(carCap);
  };
  img.src = window.CAR_PAL;
}
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
    lights: mk(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), cap * 6, false), // фары, задние фонари и два мигающих поворотника
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
// наклон техники по склону: тангаж по высоте земли перед и за машиной, крен по высоте слева и справа; сглаживается, чтобы не дрожать
function carTilt(c, len, track) {
  if (!hasHills) { c.tP = c.tR = 0; return; }
  const cs = Math.cos(c.ang), sn = Math.sin(c.ang), f = len / 2, t = track;
  const hF = gY(c.x + cs * f, c.y + sn * f), hB = gY(c.x - cs * f, c.y - sn * f), hP = gY(c.x - sn * t, c.y + cs * t), hN = gY(c.x + sn * t, c.y - cs * t);
  const pitch = Math.atan2(hF - hB, len), roll = Math.atan2(hN - hP, 2 * t), k = c.tP === undefined ? 1 : .25;
  c.tP = (c.tP || 0) + (pitch - (c.tP || 0)) * k; c.tR = (c.tR || 0) + (roll - (c.tR || 0)) * k;
}
// куда мигает поворотник: +1 направо, -1 налево, 2 — аварийка (обе стороны), 0 — не мигает. Угол поворота считается один раз
// на каждое решение машины (у стоп-линии — следующая полоса, на дуге — сама дуга); кэш в WeakMap, чтобы не попасть в сохранение
const blinkCache = new WeakMap();
function blinkSide(c) {
  if (c.wreck || !(c.moving || c.stopped) || c.tank) return 0;
  if (c.stopped && !c.service) return 2; // брошенная целая машина
  if (c.park || c.pulled || c.yieldT > 0) return 1; // к бордюру
  if (c.over === 1 || c.over === 3) return c.overT < 2 ? -1 : 0; // выезд на левую полосу или встречную
  let key = null, a = 0;
  if (c.turn) key = c.turn;
  else if (c.next && c.lane && laneEnd(c.lane) - c.s < 60) key = c.next;
  if (!key) return 0;
  let e = blinkCache.get(c);
  if (!e || e.key !== key) { a = c.turn ? (c.turn.to.e === c.turn.T.l.e ? -3 : turnAngle(c.turn.T.l, c.turn.to)) : c.next.e === c.lane.e ? -3 : turnAngle(c.lane, c.next); blinkCache.set(c, e = { key, a }); }
  return Math.abs(e.a) > .45 ? (e.a > 0 ? 1 : -1) : 0;
}
function updateCars() {
  const list = cars.filter(c => !c.gone);
  if (list.length > carCap) makeCarMeshes(list.length + 200);
  const dusk = carLightK > .15, ph = (simT * 3) % 1 < .5, blinkOn = (simT * 1.6) % 1 < .55, F = cm.fixed;
  for (const k in cm.byModel) cm.byModel[k].n = 0;
  let wi = 0, li = 0, bi = 0, bar = 0;
  for (const c of list) {
    const M = carModelOf(c), B = cm.byModel[c.model], i = B.n++, sx = (c.vlen || c.len || 1) * 18 / M.L, dead = (c.char || 0) > .5 || c.exploded, glassOut = dead || c.glass || c.wreck;
    carTilt(c, Math.max(12, M.L * sx), Math.max(3, M.track)); _ce.set((c.roll || 0) + c.tR, -c.ang, c.tP, "YXZ"); _cq.setFromEuler(_ce);
    _cs.set(sx, c.crushed ? .35 : 1 - (c.dent || 0) * .22, 1);
    if (c.rx === undefined || Math.hypot(c.rx - c.x, c.ry - c.y) > 40) { c.rx = c.x; c.ry = c.y; } const rk = c.turnT > 0 ? .12 : .25; c.rx += (c.x - c.rx) * rk; c.ry += (c.y - c.ry) * rk;
    _cm.compose(_cv.set(X(c.rx), (c.z || 0) + (c.towedBy && c.onDeck ? 3.6 : 0) + (c.roll ? Math.abs(Math.sin(c.roll)) * 3.6 : 0) + gY(c.rx, c.ry), Z(c.ry)), _cq, _cs); // на платформе эвакуатора — выше
    if (c.police || c.service === "police") c.police = true;
    for (const part of B.list) {
      part.mesh.setMatrixAt(i, _cm);
      const col = part.p === "paint" ? (dead ? "#1d1a18" : c.col || (c.police ? "#e9e9ee" : "#888")) : part.p === "glass" ? (glassOut ? "#0c0b0a" : "#2e3a46") : part.p === "trim" ? (dead ? "#0c0b0a" : c.cab || SERVICE_CAB[c.service] || "#26282a") : part.p === "base" ? (dead ? "#2a2724" : "#ffffff") : (dead ? "#141210" : c.liv || M.lightCol || "#d8d8d2");
      part.mesh.setColorAt(i, _cc.set(col));
    }
    // колёса: у модели свои оси и радиус; растяжку кузова по длине на колёса не переносим
    const ws = M.r / 1.4;
    for (const wx of M.wheels) for (const s of [-1, 1]) { if (wi >= F.wheels.instanceMatrix.count) break; _cw.makeScale(ws / sx, ws, M.r > 1.7 ? 1.15 : 1).setPosition(wx, M.r, s * M.track); F.wheels.setMatrixAt(wi++, _cw.premultiply(_cm)); }
    // фары: днём у едущих — дневные ходовые огни, вечером и ночью — ближний свет с пятном на дороге и красные габариты; при торможении — стоп-сигналы
    const lit = !c.wreck && (c.moving || c.police), hw = M.L / 2 + .1, lz = M.lz || Math.min(M.track - .3, 2.6 * M.track / 3.45);
    for (let k = 0; k < 4; k++) {
      const front = k < 2;
      _cw.makeTranslation(front ? (M.lf !== undefined ? M.lf : hw) : (M.lr !== undefined ? M.lr : -hw), front ? M.ly : (M.lyr || M.ly), (k % 2 ? 1 : -1) * (front ? lz : M.lzr || lz)); F.lights.setMatrixAt(li, _cw.premultiply(_cm));
      F.lights.setColorAt(li, _cc.set(k < 2 ? (lit ? (dusk ? "#fff6dd" : "#dfe6ea") : "#9aa0a4") : (lit && c.brake ? "#ff2a1a" : lit && dusk ? "#b0201a" : "#5a1a16"))); li++;
    }
    // поворотники: янтарные огни на углах кузова со стороны поворота (у аварийки — с обеих), мигают полтора раза в секунду
    const bs = blinkOn ? blinkSide(c) : 0;
    if (bs) for (const s of bs === 2 ? [-1, 1] : [bs]) for (const front of [true, false]) {
      if (li >= F.lights.instanceMatrix.count) break;
      _cw.makeTranslation(front ? (M.lf !== undefined ? M.lf : hw) - .2 : (M.lr !== undefined ? M.lr : -hw) + .2, (front ? M.ly : (M.lyr || M.ly)) + .5, s * ((front ? lz : M.lzr || lz) + .7)); F.lights.setMatrixAt(li, _cw.premultiply(_cm));
      F.lights.setColorAt(li, _cc.set("#ffa21a")); li++;
    }
    if (c.moving && dusk) { _cw.makeScale(26, 1, 18).setPosition(M.L / 2 + 7, .25, 0); F.beams.setMatrixAt(bi++, _cw.premultiply(_cm)); }
    const sir = c.police ? "police" : c.siren;
    if (sir && !c.wreck && bar < 198 && (c.moving || c.deployed || c.police)) for (let k = 0; k < 2; k++) {
      _cw.makeTranslation(M.barX !== undefined ? M.barX : M.L > 22 ? M.L / 2 - 4 : -1, M.roof + .4, k ? 1.3 : -1.3); F.bars.setMatrixAt(bar, _cw.premultiply(_cm));
      const on = (k === 0) === ph, col = sir === "police" ? (k ? "#2050ff" : "#ff2020") : sir === "amber" ? "#ffa020" : "#ff2020";
      F.bars.setColorAt(bar, _cc.set(on ? col : "#111")); bar++;
    }
  }
  for (const k in cm.byModel) { const B = cm.byModel[k]; for (const part of B.list) { part.mesh.count = B.n; if (B.n) { part.mesh.instanceMatrix.needsUpdate = true; part.mesh.instanceColor.needsUpdate = true; } } }
  F.wheels.count = wi; F.lights.count = li; F.beams.count = bi; F.bars.count = bar;
  F.beams.material.opacity = carLightK * (.18 + nightK * .32);
  for (const k in F) { F[k].instanceMatrix.needsUpdate = true; if (F[k].instanceColor) F[k].instanceColor.needsUpdate = true; }
}
