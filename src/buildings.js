/* ---------- новые виды зданий и разнообразие старых ----------
   newKindMesh — формы видов из layout2.js (placeNewKinds): театр, библиотека, гостиница, ратуша, башня с часами, особняк с колоннами,
   офисы, поликлиника, спорткомплекс, бассейн, магазин, склад-логистика, элеватор, автомойка, хлебозавод; склады промзоны с шедовой
   и арочной крышей. Школы буквой П и Г, кирха и часовня — schoolShape и churchShape (их зовёт landmarkMesh, render15.js).
   houseRoof — крыши частных и старых домов: двускатная, вальмовая, мансардная, с пристройкой, у старых домов ещё эркер-башенка;
   aptBays — эркеры многоэтажек, aptStep — ступенчатые объёмы и верхушки офисов, towerTop — верхушки небоскрёбов.
   Материалы общие (вывески — по одному на надпись), поэтому при склейке кварталов (merge.js) вызовов отрисовки почти не прибавляется;
   b.mesh остаётся главной коробкой (копоть, развалины), трубы помечены userData.chim (дым, cozy.js), снег ложится сам (cozyMat). */
const copperMat = new THREE.MeshStandardMaterial({ color: 0x5f8f7a, roughness: .55, metalness: .35 }); // позеленевшая медь
const stoneTrim = whiteTrim, openMat = tyreMat18; // колонны и карнизы — как отделка частных домов, проёмы — тёмные: общие материалы, лишних вызовов нет
const SIGN22 = new Map();
const bId = b => Math.abs(Math.floor(b.x0 * 13.7 + b.y0 * 7.3)); // у домов нет номера: постоянный признак по положению — форма не меняется при пересборке
// вывеска с общим материалом на одинаковую надпись: одинаковые вывески склеиваются в один вызов отрисовки
function sign22(obj, text, bg, fg, w, y, z, x = 0) {
  const key = text + "|" + bg + "|" + fg; let m = SIGN22.get(key);
  if (!m) { m = signMat(textTex(512, 80, bg, fg, text, "bold 50px Arial")); SIGN22.set(key, m); }
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .156), m); s.position.set(x, y, z); obj.add(s); return s;
}
// коробка с фасадом: этажи по 12 единиц, как у домов
function fbox(w, h, d, x, y, z, fm, top) {
  const geo = new THREE.BoxGeometry(w, h, d); boxUV(geo, w, d, h / 12, Math.floor(rnd(0, 8)) / TBX);
  const m = new THREE.Mesh(geo, [fm, fm, top || roofMat, top || roofMat, fm, fm]); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
const slab22 = (obj, w, d, y, x = 0, z = 0) => lmAdd(obj, new THREE.BoxGeometry(w + .6, .5, d + .6), parapetMat, x, y + .25, z); // карниз-парапет плоской крыши
// скатная крыша по ярусам: кольца [полудлина, полуширина, высота]; последнее с полушириной 0 — конёк (вальма), с обеими 0 — шатёр.
// Длинная сторона — вдоль x (если d > w, крыша поворачивается). UV — в метрах по скату, как у черепицы на двускатных крышах
function tierRoofGeo(w, d, rings) {
  const swap = d > w, P = [], U = [], vF = [0], vS = [0], R = rings;
  for (let i = 1; i < R.length; i++) { const [a0, b0, y0] = R[i - 1], [a1, b1, y1] = R[i]; vF.push(vF[i - 1] + Math.hypot(b0 - b1, y1 - y0)); vS.push(vS[i - 1] + Math.hypot(a0 - a1, y1 - y0)); }
  const put = (x, y, z, u, v) => { P.push(x, y, z); U.push(u, v); };
  const quad = (A, B, C, D) => { for (const p of [A, B, C, A, C, D]) put(...p); };
  for (let i = 1; i < R.length; i++) {
    const [La, Sa, ya] = R[i - 1], [Lb, Sb, yb] = R[i], fa = vF[i - 1], fb = vF[i], sa = vS[i - 1], sb = vS[i];
    quad([-La, ya, Sa, -La, fa], [La, ya, Sa, La, fa], [Lb, yb, Sb, Lb, fb], [-Lb, yb, Sb, -Lb, fb]); // перед
    quad([La, ya, -Sa, -La, fa], [-La, ya, -Sa, La, fa], [-Lb, yb, -Sb, Lb, fb], [Lb, yb, -Sb, -Lb, fb]); // зад
    quad([La, ya, Sa, -Sa, sa], [La, ya, -Sa, Sa, sa], [Lb, yb, -Sb, Sb, sb], [Lb, yb, Sb, -Sb, sb]); // правый торец
    quad([-La, ya, -Sa, -Sa, sa], [-La, ya, Sa, Sa, sa], [-Lb, yb, Sb, Sb, sb], [-Lb, yb, -Sb, -Sb, sb]); // левый торец
  }
  const [L0, S0, y0] = R[0]; quad([-L0, y0, -S0, 0, 0], [L0, y0, -S0, 1, 0], [L0, y0, S0, 1, 1], [-L0, y0, S0, 0, 1]); // свес снизу
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals(); if (swap) g.rotateY(Math.PI / 2); return g;
}
// вальмовая крыша над w × d: конёк вдоль длинной стороны, торцы — треугольные скаты
function hipRoof(obj, w, d, h, rh, mat, over = 1.2, x = 0, z = 0) {
  const L = Math.max(w, d) / 2 + over, S = Math.min(w, d) / 2 + over;
  return lmAdd(obj, tierRoofGeo(w, d, [[L, S, 0], [Math.max(0, L - S), 0, rh]]), mat, x, h, z);
}
// мансарда: крутой нижний ярус с окнами-люкарнами и пологая вальма над ним
function mansardRoof(obj, w, d, h, mat) {
  const L = Math.max(w, d) / 2 + .8, S = Math.min(w, d) / 2 + .8, i = Math.min(2.6, S * .3), h1 = 6.5, h2 = S * .35;
  lmAdd(obj, tierRoofGeo(w, d, [[L, S, 0], [L - i, S - i, h1], [Math.max(0, L - S), 0, h1 + h2]]), mat, 0, h, 0);
  const along = w >= d, n = Math.max(1, Math.floor((along ? w : d) / 9));
  for (let k = 0; k < n; k++) {
    const t = -(along ? w : d) / 2 + (along ? w : d) * (k + .5) / n, x = along ? t : 0, z = along ? d / 2 - 1.2 : 0;
    if (!along) continue; // люкарны — только на длинном фасаде к улице
    lmAdd(obj, new THREE.BoxGeometry(3.2, 3.4, 2.4), stoneTrim, x, h + 2.6, z); lmAdd(obj, new THREE.BoxGeometry(2, 2.2, .2), darkGlassMat, x, h + 2.6, z + 1.25);
    gableRoof(obj, 3.2, 2.4, h + 4.3, 1.3, false, mat, .3, x, z);
  }
  return h1 + h2;
}
// портик: колонны перед фасадом, антаблемент и треугольный фронтон, ступени
function portico(obj, n, span, h, z, depth = 5, r = .7) {
  for (let i = 0; i < n; i++) lmAdd(obj, new THREE.CylinderGeometry(r * .85, r, h - 3, 10), stoneTrim, -span / 2 + span * i / (n - 1), (h - 3) / 2 + .6, z + depth / 2 + .6);
  lmAdd(obj, new THREE.BoxGeometry(span + 3, 3, depth + 1.4), stoneTrim, 0, h - 1.5 + .6, z + depth / 2 + .3);
  gableRoof(obj, span + 3, depth + 1.4, h + .6, Math.min(5, span * .16), false, stoneTrim, .3, 0, z + depth / 2 + .3);
  lmAdd(obj, new THREE.BoxGeometry(span + 4, .6, depth + 3), concreteMat, 0, .3, z + depth / 2 + .8);
  return z + depth + 1.05; // лицевая плоскость антаблемента — под вывеску
}
// бочарная крыша: полуцилиндр вдоль x, сплюснутый по высоте
function barrelRoof(obj, w, d, h, k, mat) { const r = d / 2 + .5, m = lmAdd(obj, new THREE.CylinderGeometry(r, r, w + 1, 22, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), mat, 0, h, 0); m.scale.y = k; return r * k; }
// козырёк над входом на двух стойках
function canopy(obj, wide, y, z, mat = whiteMat, depth = 4) {
  lmAdd(obj, new THREE.BoxGeometry(wide, .5, depth), mat, 0, y, z + depth / 2);
  for (const s of [-1, 1]) lmAdd(obj, new THREE.BoxGeometry(.4, y, .4), steelPostMat, s * (wide / 2 - .4), y / 2, z + depth - .4);
}
function flagPole(obj, x, z, h, mat) { lmAdd(obj, new THREE.CylinderGeometry(.2, .25, h, 6), steelPostMat, x, h / 2, z); lmAdd(obj, new THREE.BoxGeometry(.1, 2.4, 3.8), mat, x, h - 1.4, z + 2); }
const FLAG_MATS = [...seatMats, whiteMat];
const OFFICE_NAMES = ["БИЗНЕС-ЦЕНТР «ОКА»", "СЕВЕРСТРОЙ", "ВОЛНА ТЕЛЕКОМ", "АЛЬФА-ЦЕНТР", "ГОРОДСКОЙ БАНК", "ТЕХНОПАРК", "СТРАХОВАНИЕ", "БЦ «ПАРУС»"];
const SHOP_NAMES = [["УНИВЕРСАМ", "#c81e1e", "#fff"], ["ГАСТРОНОМ", "#1f6a3a", "#fff"], ["ПРОДУКТЫ 24", "#1d3566", "#ffe14a"], ["ХОЗМАГ", "#8a6a20", "#fff"], ["АПТЕКА", "#ffffff", "#1a8a3a"], ["ДОМ БЫТА", "#4a4a52", "#ffd28a"]];

function newKindMesh(b, obj, box, w, d) {
  const k = b.kind, h = b.h, fm = facadeMats[b.style] || facadeMats[0];
  if (k === "theater") {
    // театр: портик в шесть колонн с фронтоном, над сценой — высокая коробка колосников, по бокам от входа афишные тумбы
    obj.add(fbox(w * .62, h + 14, d * .42, 0, (h + 14) / 2, -d / 2 + d * .21, fm));
    slab22(obj, w * .62, d * .42, h + 14, 0, -d / 2 + d * .21);
    const ph = Math.min(h - 4, 24), fz = portico(obj, 6, w * .56, ph, d / 2, 6, .9);
    sign22(obj, "ТЕАТР ДРАМЫ", "#5a1a1a", "#f4d9a0", Math.min(17, w * .5), ph - .9, fz);
    for (const s of [-1, 1]) { lmAdd(obj, new THREE.CylinderGeometry(1.1, 1.1, 3.6, 12), pick(AWNING_MATS), s * (w * .38), 1.8, d / 2 + 10); lmAdd(obj, new THREE.CylinderGeometry(1.4, 1.4, .5, 12), steelPostMat, s * (w * .38), 3.8, d / 2 + 10); }
    slab22(obj, w, d, h);
    b.h += 14; return true;
  }
  if (k === "library") {
    // библиотека: портик в четыре колонны, плоская крыша с медным куполом-фонарём
    const fz = portico(obj, 4, 16, h - 2, d / 2, 4.5, .75);
    sign22(obj, "БИБЛИОТЕКА", "#f4f1e8", "#5a2a1a", 14, h - 2.9, fz);
    slab22(obj, w, d, h);
    lmAdd(obj, new THREE.CylinderGeometry(6, 6, 3, 18), stoneTrim, 0, h + 1.5, 0);
    lmAdd(obj, new THREE.SphereGeometry(6.2, 18, 8, 0, TAU, 0, Math.PI / 2), copperMat, 0, h + 3, 0);
    b.h += 9; return true;
  }
  if (k === "hotel") {
    // гостиница: козырёк над входом, флаги, название на крыше; парапет и техника — общим путём (buildCity)
    canopy(obj, Math.min(16, w * .45), 6, d / 2, whiteMat, 6);
    for (let i = 0; i < 3; i++) flagPole(obj, -w / 2 + 3 + i * 4, d / 2 + 9, 14, FLAG_MATS[(bId(b) + i) % FLAG_MATS.length]);
    const sw = Math.min(30, w * .8), sy = h + 2 + sw * .078;
    sign22(obj, pick(["ГОСТИНИЦА «ВОЛГА»", "ОТЕЛЬ «ЦЕНТРАЛЬНЫЙ»", "ГОСТИНИЦА «ЮБИЛЕЙНАЯ»", "ОТЕЛЬ «ТУРИСТ»"]), "#1d1f22", "#f2c846", sw, sy, d / 2 - 1.6);
    for (const s of [-1, 1]) lmAdd(obj, new THREE.BoxGeometry(.4, sw * .156 + 2, .4), steelPostMat, s * sw * .4, h + (sw * .156 + 2) / 2, d / 2 - 2);
    return false;
  }
  if (k === "office") {
    // офис: стеклянный вестибюль с козырьком у входа; верхушка — в aptStep
    lmAdd(obj, new THREE.BoxGeometry(Math.min(18, w * .5), 7, 3), verandaMat, 0, 3.5, d / 2 + 1.5);
    lmAdd(obj, new THREE.BoxGeometry(Math.min(20, w * .55), .6, 5), whiteMat, 0, 7.3, d / 2 + 2.5);
    return false;
  }
  if (k === "clinic") {
    // поликлиника: вывеска с красным крестом, козырёк и пандус у входа
    sign22(obj, "ГОРОДСКАЯ ПОЛИКЛИНИКА", "#f4f6f8", "#1d4a8a", Math.min(30, w - 14), h - 3, d / 2 + .35, -4);
    const cx = w / 2 - 5; lmAdd(obj, new THREE.BoxGeometry(4.6, 1.5, .4), redMat2, cx, h - 3, d / 2 + .3); lmAdd(obj, new THREE.BoxGeometry(1.5, 4.6, .4), redMat2, cx, h - 3, d / 2 + .3);
    canopy(obj, 12, 4.6, d / 2, whiteMat, 4);
    lmAdd(obj, new THREE.BoxGeometry(10, .8, 2.4), concreteMat, -12, .4, d / 2 + 1.2);
    return false;
  }
  if (k === "gym" || k === "pool") {
    // спорткомплекс — бочарная крыша; бассейн — стеклянная стена во весь фасад и пологая двускатная крыша
    if (k === "gym") {
      const rh = barrelRoof(obj, w, d, h, .32, metalRoofMat);
      sign22(obj, "СПОРТКОМПЛЕКС", "#1d3566", "#f4f1e8", Math.min(22, w * .5), h - 2.6, d / 2 + .35);
      canopy(obj, 10, 5, d / 2, whiteMat, 4);
      b.h += rh * .7;
    } else {
      lmAdd(obj, new THREE.BoxGeometry(w - 6, h - 7, .5), verandaMat, 0, (h - 7) / 2 + 1.5, d / 2 + .3);
      for (let x = -w / 2 + 3; x <= w / 2 - 3 + .01; x += (w - 6) / 6) lmAdd(obj, new THREE.BoxGeometry(.5, h - 7, .8), whiteMat, x, (h - 7) / 2 + 1.5, d / 2 + .4);
      gableRoof(obj, w, d, h, d * .14, true, metalRoofMat, 1.2);
      sign22(obj, "БАССЕЙН «ДЕЛЬФИН»", "#f4f6f8", "#1a6aa8", Math.min(20, w * .45), h - 2.6, d / 2 + .6);
      b.h += d * .14 * .6;
    }
    return true;
  }
  if (k === "shop") {
    // магазин: большая вывеска, маркиза над витриной, плоская крыша
    const [t, bg, fg] = SHOP_NAMES[bId(b) % SHOP_NAMES.length];
    sign22(obj, t, bg, fg, Math.min(16, w - 4), h - 2.2, d / 2 + .35);
    const aw = lmAdd(obj, new THREE.BoxGeometry(w - 3, .3, 2.6), pick(AWNING_MATS), 0, h - 5.2, d / 2 + 1.2); aw.rotation.x = .35;
    slab22(obj, w, d, h);
    return true;
  }
  if (k === "townhall") {
    // ратуша: вальмовая крыша, посередине фасада башня с часами и медным шатром, у входа малый портик
    const tz = d / 2 - 6, th = h + 22;
    hipRoof(obj, w, d, h, 7, tileMats[2]);
    obj.add(fbox(12, th, 12, 0, th / 2, tz, fm));
    lmAdd(obj, new THREE.BoxGeometry(13.4, 1.2, 13.4), stoneTrim, 0, th + .6, tz);
    for (const [x, z, ry] of [[0, tz + 6.08, 0], [6.08, tz, Math.PI / 2], [-6.08, tz, -Math.PI / 2]]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), clockMat); c.position.set(x, th - 6, z); c.rotation.y = ry; obj.add(c); }
    lmAdd(obj, new THREE.ConeGeometry(9.2, 13, 4), copperMat, 0, th + 1.2 + 6.5, tz).rotation.y = Math.PI / 4;
    lmAdd(obj, new THREE.CylinderGeometry(.3, .3, 6, 6), goldMat, 0, th + 17, tz);
    const fz = portico(obj, 4, 9, 11, d / 2, 3.5, .55);
    sign22(obj, "РАТУША", "#f4f1e8", "#3a2a1a", 8, 10.1, fz);
    b.h += 22 + 12; return true;
  }
  if (k === "clocktower") {
    // башня с часами: каменный ствол, циферблаты на все стороны, звонница и шатёр со шпилем
    lmAdd(obj, new THREE.BoxGeometry(13, 2.4, 13), graniteMat, 0, 1.2, 0);
    lmAdd(obj, new THREE.BoxGeometry(11.4, 1, 11.4), stoneTrim, 0, h - 9, 0);
    for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2, c = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), clockMat); c.position.set(Math.sin(a) * 5.06, h - 4.6, Math.cos(a) * 5.06); c.rotation.y = a; obj.add(c); }
    lmAdd(obj, new THREE.BoxGeometry(11.4, 1, 11.4), stoneTrim, 0, h + .5, 0);
    for (const [x, z] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]]) lmAdd(obj, new THREE.BoxGeometry(1.6, 6, 1.6), fm, x, h + 4, z);
    lmAdd(obj, new THREE.BoxGeometry(7, 4, 7), openMat, 0, h + 3, 0);
    lmAdd(obj, new THREE.BoxGeometry(11.4, 1, 11.4), stoneTrim, 0, h + 7.5, 0);
    lmAdd(obj, new THREE.ConeGeometry(8, 14, 4), copperMat, 0, h + 15, 0).rotation.y = Math.PI / 4;
    lmAdd(obj, new THREE.SphereGeometry(.9, 10, 6), goldMat, 0, h + 22.6, 0); lmAdd(obj, new THREE.CylinderGeometry(.18, .18, 4, 6), goldMat, 0, h + 25, 0);
    b.h += 26; return true;
  }
  if (k === "mansion") {
    // особняк: портик с колоннами на всю высоту, вальмовая крыша, две печные трубы
    const rh = Math.min(w, d) * .3;
    hipRoof(obj, w, d, h, rh, pick(tileMats), 1.4);
    portico(obj, 4, Math.min(12, w - 6), h - 1, d / 2, 4, .6);
    for (const s of [-1, 1]) lmAdd(obj, new THREE.BoxGeometry(2, rh + 4, 2), parapetMat, s * w / 3, h + rh * .5, -d / 6).userData.chim = 1;
    lmAdd(obj, new THREE.BoxGeometry(w + .4, .8, d + .4), stoneTrim, 0, h - .4, 0); // карниз
    b.h += rh * .6; return true;
  }
  if (k === "storage") {
    // склад-логистика: погрузочная рампа во весь фасад, ворота доков, навес над ними, вывеска
    const n = Math.max(3, Math.floor((w - 10) / 9));
    lmAdd(obj, new THREE.BoxGeometry(w - 6, 1.3, 4), concreteMat, 0, .65, d / 2 + 2);
    for (let i = 0; i < n; i++) lmAdd(obj, new THREE.BoxGeometry(5.6, 6, .3), gateMats[i % 2 ? 0 : 3], -w / 2 + 5 + (w - 10) * (i + .5) / n, 4.3, d / 2 + .16);
    lmAdd(obj, new THREE.BoxGeometry(w - 4, .4, 5.4), metalRoofMat, 0, 8.6, d / 2 + 2.6);
    sign22(obj, bId(b) % 2 ? "ЛОГИСТИЧЕСКИЙ ЦЕНТР" : "СКЛАД № " + (2 + bId(b) % 7), "#f2c846", "#1d1f22", 16, h - 1.4, d / 2 + .35);
    slab22(obj, w, d, h);
    return true;
  }
  if (k === "elevator") {
    // элеватор: высокая рабочая башня у торца, за ней два ряда бетонных силосов, по их верху — галерея
    const hx = -w / 2 + 6, head = fbox(12, 54, d, hx, 27, 0, facadeMats[3]); swapBody(b, obj, box, head);
    lmAdd(obj, new THREE.BoxGeometry(8, 6, 8), facadeMats[3], hx, 57, 0);
    for (let i = 0; i < 4; i++) for (const z of [-3.9, 3.9]) lmAdd(obj, new THREE.CylinderGeometry(3.4, 3.4, 38, 16), concreteMat, hx + 9.8 + i * 6.9, 19, z);
    lmAdd(obj, new THREE.BoxGeometry(w - 13, 3.2, 4), facadeMats[3], hx + 6 + (w - 13) / 2, 39.6, 0);
    sign22(obj, "ЭЛЕВАТОР", "#2a2d30", "#f2c846", 10, 46, d / 2 + .35, hx);
    b.h = 60; return true;
  }
  if (k === "carwash") {
    // автомойка: три открытых бокса, сине-белая полоса и вывеска
    for (let i = 0; i < 3; i++) lmAdd(obj, new THREE.BoxGeometry(6.4, 7, .3), openMat, -w / 2 + 4.6 + i * 8.4, 3.7, d / 2 + .16);
    lmAdd(obj, new THREE.BoxGeometry(w + .2, 1.2, d + .2), whiteMat, 0, h - 2.6, 0);
    sign22(obj, "АВТОМОЙКА", "#1a6ad8", "#ffffff", Math.min(14, w - 6), h - 1.4, d / 2 + .5);
    slab22(obj, w, d, h);
    return true;
  }
  if (k === "bakery") {
    // хлебозавод: кирпичный цех с фонарём на крыше, высокая труба (из неё идёт дым), ворота экспедиции, вывеска
    gableRoof(obj, w * .6, 6, h + 2, 2.6, true, metalRoofMat, .4);
    lmAdd(obj, new THREE.BoxGeometry(w * .6, 2, 5.6), verandaMat, 0, h + 1, 0);
    const ch = lmAdd(obj, new THREE.CylinderGeometry(1.3, 2, 34, 12), facadeMats[48], w / 2 - 4, 17, -d / 2 + 4); ch.userData.chim = 2;
    lmAdd(obj, new THREE.BoxGeometry(10, 7, .3), gateMats[3], -w / 2 + 8, 3.8, d / 2 + .16);
    sign22(obj, "ХЛЕБОЗАВОД № 2", "#f4e9c8", "#7a2a14", Math.min(20, w * .45), h - 3, d / 2 + .35, 6);
    slab22(obj, w, d, h);
    return true;
  }
  if (k === "warehouse") {
    // склад промзоны: у одних шедовая крыша с остеклением, у других арочная, у остальных плоская; ворота с рампой на фасаде
    for (let i = 0, n = 2 + (bId(b) % 3); i < n; i++) lmAdd(obj, new THREE.BoxGeometry(6, 7, .3), gateMats[(bId(b) + i) % 2 ? 0 : 3], -w / 2 + 6 + (w - 12) * (i + .5) / n, 3.8, d / 2 + .16);
    const v = bId(b) % 5;
    if (v < 2) {
      const n = Math.max(2, Math.floor(w / 11)), tw = w / n, th = 5;
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + i * tw, tooth = new THREE.ExtrudeGeometry(new THREE.Shape([V2(0, 0), V2(tw, 0), V2(tw, th)]), { depth: d, bevelEnabled: false }); tooth.translate(x0, 0, -d / 2);
        lmAdd(obj, tooth, metalRoofMat, 0, h, 0); lmAdd(obj, new THREE.BoxGeometry(.25, th - .6, d - 1), verandaMat, x0 + tw - .2, h + th / 2, 0);
      }
      b.h += th * .6; return true;
    }
    if (v < 3) { b.h += barrelRoof(obj, w, d, h, .4, metalRoofMat) * .7; return true; }
    return false;
  }
  return false;
}

// школа другой формы: П — две крыла назад от главного корпуса, Г — одно; главная коробка — корпус вдоль улицы
function schoolShape(b, obj, box, w, d) {
  const fm = facadeMats[b.style] || facadeMats[3], h = b.h, fd = 18, wd = d - fd, ww = 14;
  const main = fbox(w, h, fd, 0, h / 2, d / 2 - fd / 2, fm); swapBody(b, obj, box, main); slab22(obj, w, fd, h, 0, d / 2 - fd / 2);
  const sides = b.shape === "U" ? [-1, 1] : [bId(b) % 2 ? 1 : -1];
  for (const s of sides) { obj.add(fbox(ww, h - 12, wd, s * (w / 2 - ww / 2), (h - 12) / 2, -d / 2 + wd / 2, fm)); slab22(obj, ww, wd, h - 12, s * (w / 2 - ww / 2), -d / 2 + wd / 2); }
  // спортзал — низкий объём между крыльями (у П) или вдоль заднего фасада (у Г)
  const gx = b.shape === "U" ? 0 : -sides[0] * (ww / 2 + 2), gw = b.shape === "U" ? w - ww * 2 - 8 : w - ww - 10;
  obj.add(fbox(gw, 12, wd - 6, gx, 6, -d / 2 + (wd - 6) / 2, facadeMats[44])); slab22(obj, gw, wd - 6, 12, gx, -d / 2 + (wd - 6) / 2);
}
// церкви других типов: кирха — высокий неф под крутой крышей и башня со шпилем; часовня — маленькая, с одной главкой
function churchShape(b, obj, box, w, d) {
  const fm = facadeMats[b.style] || facadeMats[27], h = b.h;
  if (b.shape === "gothic") {
    gableRoof(obj, w, d, h, w * .75, false, tileMats[2], .8);
    const tw = 9, th = h + 20, tz = d / 2 - tw / 2;
    obj.add(fbox(tw, th, tw, 0, th / 2, tz, fm)); lmAdd(obj, new THREE.BoxGeometry(tw + 1, 1, tw + 1), stoneTrim, 0, th, tz);
    lmAdd(obj, new THREE.ConeGeometry(6.6, 26, 4), bId(b) % 2 ? copperMat : tileMats[2], 0, th + 13.5, tz).rotation.y = Math.PI / 4;
    crossOn(obj, 0, th + 26, tz, .5);
    const rose = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), darkGlassMat); rose.position.set(0, h - 2, d / 2 + .05); obj.add(rose);
    lmAdd(obj, new THREE.BoxGeometry(4, 6.5, .4), openMat, 0, 3.25, d / 2 + .1);
    b.h += 20 + 22; return true;
  }
  // часовня
  const rh = w * .55; gableRoof(obj, w, d, h, rh, false, bId(b) % 2 ? copperMat : tileMats[2], .8);
  lmAdd(obj, new THREE.CylinderGeometry(1.9, 1.9, 4, 12), whiteMat, 0, h + rh + 1, d / 2 - 5);
  lmAdd(obj, onionGeo(2.3, 4.8), bId(b) % 3 ? goldMat : domeBlueMat, 0, h + rh + 3, d / 2 - 5); crossOn(obj, 0, h + rh + 7.6, d / 2 - 5, .45);
  lmAdd(obj, new THREE.BoxGeometry(3.4, 5.5, .4), openMat, 0, 2.75, d / 2 + .1);
  b.h += 12; return true;
}

// крыша частного или старого дома; возвращает её высоту (по ней ставится труба)
function houseRoof(b, obj, box, w, d) {
  const fm = facadeMats[b.style] || facadeMats[11], old = b.kind === "oldhouse", r = Math.random();
  const mat = old ? pick([tileMats[0], tileMats[1], tileMats[2]]) : Math.random() < .14 ? metalRoofMat : pick(tileMats);
  if (b.kind === "barn" || r < (old ? .45 : .5)) {
    // двускатная, как раньше
    const rh = Math.min(w, d) * (old ? .3 : .38); gableRoof(obj, w, d, b.h, rh, b.ridge === "x", old ? pick(tileMats.slice(0, 2)) : mat, 1.2);
    if (old) oldBay(b, obj, w, d, fm, mat);
    return rh;
  }
  if (old && r < .72) { const rh = mansardRoof(obj, w, d, b.h, mat); oldBay(b, obj, w, d, fm, mat); return rh; }
  if (!old && r > .8 && w >= 18) {
    // дом с пристройкой сбоку: основной объём уже, пристройка ниже, под односкатной крышей, отступает от фасада
    const s = bId(b) % 2 ? 1 : -1, mw = w - 6, main = facadeBox(b, mw, b.h, d, -s * 3, b.h / 2, 0, fm); swapBody(b, obj, box, main);
    const rh = Math.min(mw, d) * .38; gableRoof(obj, mw, d, b.h, rh, true, mat, 1.2, -s * 3, 0);
    const ah = Math.min(b.h - 1, 8); obj.add(facadeBox(b, 6, ah, d - 5, s * (w / 2 - 3), ah / 2, -2.5, fm));
    lmAdd(obj, new THREE.BoxGeometry(7.4, .4, d - 4), mat, s * (w / 2 - 3.2), ah + .6, -2.5).rotation.z = -s * .22;
    return rh;
  }
  // вальмовая
  const rh = Math.min(w, d) * (old ? .32 : .36); hipRoof(obj, w, d, b.h, rh, mat, 1.2);
  if (old) oldBay(b, obj, w, d, fm, mat);
  return rh;
}
// эркер-башенка на углу старого дома: от второго этажа до карниза, под своим шатром
function oldBay(b, obj, w, d, fm, mat) {
  if (b.floors < 3 || w < 16 || Math.random() > .3) return;
  const fh = b.h / b.floors, x = (bId(b) % 2 ? 1 : -1) * (w / 2 - 4), bh = b.h - fh + 3;
  obj.add(fbox(7, bh, 2.6, x, fh + bh / 2, d / 2 + 1.3, fm));
  lmAdd(obj, new THREE.ConeGeometry(5.2, 5, 4), mat, x, fh + bh + 2.5, d / 2 + 1.3).rotation.y = Math.PI / 4;
}
// эркеры многоэтажки: выступы во всю высоту над первым этажом через две оси окон; на их местах балконов нет (b.erk, render14.js)
function aptBays(b, obj, w, d, fm) {
  b.erk = null;
  const st = STYLES[b.style] || {};
  if (b.kind !== "apt" || st.curtain || b.floors < 5 || w < 28 || Math.random() > (b.style >= 29 && b.style !== 40 ? .15 : .32)) return;
  const fh = b.h / b.floors, eh = b.h - fh - .3, ew = BAY * .62, ph = bId(b) % 3;
  b.erk = new Set();
  bayCenters(w, false).forEach((lx, i) => {
    if (i % 3 !== ph) return;
    b.erk.add(i);
    const g = new THREE.BoxGeometry(ew, eh, 1.8); boxUV(g, ew, 1.8, b.floors - 1, (i % TBX) / TBX);
    const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) if (j < 8 || j >= 16) uv.setY(j, uv.getY(j) + 1 / TFL); // нижний ряд текстуры — витрины, эркер начинается со второго этажа
    const m = new THREE.Mesh(g, [fm, fm, roofMat, roofMat, fm, fm]); m.position.set(lx, fh + eh / 2, d / 2 + .9); obj.add(m);
  });
}
// ступенчатый объём над частью многоэтажки и верхушки офисов: возвращает true, если что-то поставлено
function aptStep(b, obj, w, d, fm) {
  if (b.kind === "office") {
    // техэтаж или уступ из того же стекла, у части — название фирмы на крыше
    const k = rnd(.55, .8), cw = w * k, cd = d * k, ch = 12 * (1 + Math.floor(Math.random() * 3));
    let fz = d / 2 - 1.5, sw = Math.min(26, w * .7);
    if (Math.random() < .6) { const x = (w - cw) / 2 * (bId(b) % 2 ? 1 : -1) * .6; obj.add(fbox(cw, ch, cd, x, b.h + ch / 2, 0, fm)); slab22(obj, cw, cd, b.h + ch, x, 0); b.h += ch; fz = cd / 2 - 1.2; sw = Math.min(sw, cw * .8); }
    if (Math.random() < .55) { sign22(obj, pick(OFFICE_NAMES), "#16181c", pick(["#ffffff", "#9fd0ff", "#f2c846"]), sw, b.h + 1.2 + sw * .078, fz); lmAdd(obj, new THREE.BoxGeometry(sw, sw * .156 + .4, .4), steelPostMat, 0, b.h + 1.2 + sw * .078, fz - .3); }
    return true;
  }
  const st = STYLES[b.style] || {};
  if (b.kind !== "apt" || st.curtain || b.floors < 7 || w < 30 || Math.random() > .28) return false;
  const fh = b.h / b.floors, ef = 1 + Math.floor(Math.random() * 3), sw = w * rnd(.35, .55), x = (w - sw) / 2 * (bId(b) % 2 ? 1 : -1), eh = ef * fh;
  const g = new THREE.BoxGeometry(sw, eh, d); boxUV(g, sw, d, ef, 0);
  // окна надстройки продолжают окна дома: сдвиг текстуры по этажам
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) if (i < 8 || i >= 16) uv.setY(i, uv.getY(i) + b.floors / TFL);
  const m = new THREE.Mesh(g, [fm, fm, roofMat, roofMat, fm, fm]); m.position.set(x, b.h + eh / 2, 0); obj.add(m);
  slab22(obj, sw, d, b.h + eh, x, 0);
  b.h += eh; return true;
}
// верхушка небоскрёба: уступ с техэтажом (как раньше), два уступа или шпиль; у части — антенна
function towerTop(b, obj, w, d, fm) {
  const v = bId(b) % 3;
  if (v === 1) {
    // два уступа, каждый уже предыдущего
    let y = b.h;
    for (const [k, fl] of [[rnd(.72, .82), 2 + Math.floor(Math.random() * 4)], [rnd(.45, .58), 1 + Math.floor(Math.random() * 3)]]) {
      const cw = w * k, cd = d * k, ch = fl * 12; obj.add(fbox(cw, ch, cd, 0, y + ch / 2, 0, fm)); slab22(obj, cw, cd, y + ch); y += ch;
    }
    b.h = y;
  } else {
    const k = rnd(.55, .75), cw = w * k, cd = d * k, chh = rnd(14, 30);
    const cg = new THREE.BoxGeometry(cw, chh, cd); boxUV(cg, cw, cd, chh / 12, 0);
    const crown = new THREE.Mesh(cg, [fm, fm, roofMat, roofMat, fm, fm]); crown.position.y = b.h + chh / 2; crown.castShadow = true; obj.add(crown);
    b.h += chh;
    if (v === 2) { lmAdd(obj, new THREE.ConeGeometry(Math.min(cw, cd) * .3, 26, 4), steelPostMat, 0, b.h + 13, 0).rotation.y = Math.PI / 4; b.h += 6; return; } // шпиль
  }
  if (Math.random() < .6) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(.4, .7, rnd(20, 45), 6), parapetMat); ant.position.y = b.h + ant.geometry.parameters.height / 2; obj.add(ant); b.antenna = ant; }
}
