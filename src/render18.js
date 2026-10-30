/* ---------- здания районов и ферм, озёра на земле, сельские пропсы ----------
   districtMesh — формы новых видов зданий (layout2.js): коттеджи разных форм, дачи, дома фермеров, усадьбы, рынок с рядами
   прилавков, гаражи с воротами, автосервис, кафе с террасой, детский сад. Вызывается из buildCity после landmarkMesh.
   paintLakes — пляж и набережная на текстуре земли. PROP_PARTS пополняются силосом, трактором, сеном, скотом, пирсом и зонтиками. */
const hayMat = new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 1 }), tractorMats = [new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: .5 }), new THREE.MeshStandardMaterial({ color: 0xc8381e, roughness: .5 })];
const tyreMat18 = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: .9 }), siloMat = new THREE.MeshStandardMaterial({ color: 0xb8bcbe, roughness: .4, metalness: .6 });
const cowMats = [[0xf0ece4, 0x2a2622], [0x7a4a2a, 0x5a3a22], [0x3a3230, 0xf0ece4]].map(([a, b]) => [new THREE.MeshStandardMaterial({ color: a, roughness: .9 }), new THREE.MeshStandardMaterial({ color: b, roughness: .9 })]);
const plankMat18 = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: .9 }), gateMats = [0x4a5a6a, 0x6a4a3a, 0x3f5a46, 0x5a5a5a, 0x7a3a2a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .6, metalness: .3 }));
const V2 = (x, y) => new THREE.Vector2(x, y);
// двускатная крыша над прямоугольником w × d (ridge вдоль x, если along)
function gableRoof(obj, w, d, h, rh, along, mat, over = 1.2, cx = 0, cz = 0) {
  const span = along ? d : w, len = along ? w : d;
  const sh = new THREE.Shape([V2(-span / 2 - over, 0), V2(span / 2 + over, 0), V2(0, rh)]);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: len + 2 * over, bevelEnabled: false }); rg.translate(0, 0, -(len + 2 * over) / 2); if (along) rg.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(rg, mat); roof.position.set(cx, h, cz); roof.castShadow = roof.receiveShadow = true; obj.add(roof); return roof;
}
function facadeBox(b, w, h, d, x, y, z, fm, top) { const geo = new THREE.BoxGeometry(w, h, d); boxUV(geo, w, d, b.floors * 1.6, Math.floor(rnd(0, 8)) / TBX); const m = new THREE.Mesh(geo, [fm, fm, top || roofMat, top || roofMat, fm, fm]); m.position.set(x, y, z); return m; }
function chimney(obj, w, d, y) { lmAdd(obj, new THREE.BoxGeometry(2.2, 5, 2.2), parapetMat, rnd(-w / 4, w / 4), y, rnd(-d / 4, d / 4)).userData.chim = 1; } // chim: из трубы идёт дым (cozy.js)
function porch(obj, x, z, wide = 5) {
  lmAdd(obj, new THREE.BoxGeometry(wide, .9, 2.4), porchMat, x, .45, z + 1.2);
  lmAdd(obj, new THREE.BoxGeometry(wide + 1, .35, 3.2), whiteTrim, x, 8.4, z + 1.5).rotation.x = .15;
  for (const s of [-1, 1]) lmAdd(obj, new THREE.BoxGeometry(.4, 7.8, .4), whiteTrim, x + s * (wide / 2 + .1), 4.3, z + 2.8);
}
function districtMesh(b, obj, box, w, d) {
  const k = b.kind, fm = facadeMats[b.style] || facadeMats[11], tile = pick(tileMats);
  if (k === "cottage") {
    const shape = b.shape || "plain";
    if (shape === "L") {
      // Г-образный: основной объём и крыло под своей крышей, в вырезе — терраса с перилами
      obj.remove(box); box.geometry.dispose();
      const aw = w - 8, bd = d - 7;
      obj.add(facadeBox(b, aw, b.h, d, -4, b.h / 2, 0, fm)); obj.add(facadeBox(b, 8, b.h, bd, w / 2 - 4, b.h / 2, -3.5, fm));
      gableRoof(obj, aw, d, b.h, d * .36, true, tile, 1.2, -4, 0); gableRoof(obj, 8, bd, b.h, 8 * .5, false, tile, 1, w / 2 - 4, -3.5);
      lmAdd(obj, new THREE.BoxGeometry(7, .5, 6), porchMat, w / 2 - 4, .25, d / 2 - 3);
      for (const [x, z, sx, sz] of [[w / 2 - .5, d / 2 - 3, .2, 6], [w / 2 - 4, d / 2 - .4, 7, .2]]) lmAdd(obj, new THREE.BoxGeometry(sx, 1.1, sz), whiteTrim, x, 1, z);
      b.h += d * .36 * .6; return true;
    }
    if (shape === "garage") {
      // дом с пристроенным гаражом: низкий бокс с воротами справа
      obj.remove(box); box.geometry.dispose();
      const hw = w - 9;
      obj.add(facadeBox(b, hw, b.h, d, -4.5, b.h / 2, 0, fm)); gableRoof(obj, hw, d, b.h, d * .38, true, tile, 1.2, -4.5, 0);
      const g = facadeBox(b, 9, 9, d - 2, w / 2 - 4.5, 4.5, -1, fm, roofMat); obj.add(g);
      lmAdd(obj, new THREE.BoxGeometry(7, 6.4, .3), pick(gateMats), w / 2 - 4.5, 3.4, d / 2 - 1 + .15);
      lmAdd(obj, new THREE.BoxGeometry(9.6, .5, d - 1.4), parapetMat, w / 2 - 4.5, 9.2, -1);
      porch(obj, -4.5 + rnd(-hw / 4, hw / 4), d / 2); chimney(obj, hw, d, b.h + 2.5);
      b.h += d * .38 * .6; return true;
    }
    if (shape === "mansard") {
      // мансарда: крутая крыша с двумя слуховыми окнами над первым этажом
      const rh = Math.min(w, d) * .62; gableRoof(obj, w, d, b.h, rh, true, tile, 1.4);
      for (const x of [-w / 4, w / 4]) { lmAdd(obj, new THREE.BoxGeometry(3.4, 3.2, 3), whiteTrim, x, b.h + 2.4, d / 2 - 2.2); lmAdd(obj, new THREE.BoxGeometry(2.2, 2, .2), darkGlassMat, x, b.h + 2.5, d / 2 - .6); gableRoof(obj, 3.4, 3, b.h + 4, 1.4, false, tile, .4, x, d / 2 - 2.2); }
      porch(obj, rnd(-w / 4, w / 4), d / 2); chimney(obj, w, d, b.h + rh * .5);
      b.h += rh * .6; return true;
    }
    const rh = Math.min(w, d) * .38; gableRoof(obj, w, d, b.h, rh, b.ridge === "x", tile, 1.2);
    porch(obj, rnd(-w / 4, w / 4), d / 2); if (Math.random() < .5) chimney(obj, w, d, b.h + rh * .6);
    if (Math.random() < .5) { lmAdd(obj, new THREE.BoxGeometry(6, 1.2, 3), whiteTrim, rnd(-w / 3, w / 3), b.h - 4, d / 2 + 1.5); } // балкон
    b.h += rh * .6; return true;
  }
  if (k === "dacha") {
    // дачный домик: крутая крыша, застеклённая веранда, бочка для воды
    const rh = Math.min(w, d) * .5; gableRoof(obj, w, d, b.h, rh, b.ridge === "x", tile, 1);
    lmAdd(obj, new THREE.BoxGeometry(Math.min(w - 2, 5), 6.5, 3), verandaMat, w / 2 - Math.min(w - 2, 5) / 2 - 1, 3.25, d / 2 + 1.5);
    lmAdd(obj, new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), steelPostMat, -w / 2 - 1.6, 1.3, d / 2 - 1);
    b.h += rh * .6; return true;
  }
  if (k === "farmhouse") {
    // дом фермера: длинное крыльцо-веранда вдоль фасада под навесом, печная труба
    const rh = Math.min(w, d) * .42; gableRoof(obj, w, d, b.h, rh, b.ridge === "x", tile, 1.4);
    lmAdd(obj, new THREE.BoxGeometry(w - 2, .7, 4), plankMat18, 0, .35, d / 2 + 2);
    lmAdd(obj, new THREE.BoxGeometry(w, .4, 5), tile, 0, b.h - 1.2, d / 2 + 2.3).rotation.x = .22;
    for (let x = -w / 2 + 2; x <= w / 2 - 2; x += (w - 4) / 3) lmAdd(obj, new THREE.BoxGeometry(.5, b.h - 1.5, .5), whiteTrim, x, (b.h - 1.5) / 2, d / 2 + 4);
    lmAdd(obj, new THREE.BoxGeometry(2.4, rh + 4, 2.4), parapetMat, w / 4, b.h + rh * .4, -d / 6).userData.chim = 1;
    b.h += rh * .6; return true;
  }
  if (k === "manor") {
    // усадьба: портик на четырёх колоннах, балкон над входом, вальмовая крыша
    const rh = Math.min(w, d) * .34; gableRoof(obj, w, d, b.h, rh, true, tile, 1.6);
    for (const x of [-6, -2, 2, 6]) lmAdd(obj, new THREE.CylinderGeometry(.55, .6, b.h - 1, 10), whiteTrim, x, (b.h - 1) / 2, d / 2 + 4.5);
    lmAdd(obj, new THREE.BoxGeometry(16, 1, 6.5), whiteTrim, 0, b.h - .5, d / 2 + 2.8);
    gableRoof(obj, 16, 6.5, b.h, 2.4, true, tile, .8, 0, d / 2 + 2.8);
    lmAdd(obj, new THREE.BoxGeometry(17, .5, 2.4), porchMat, 0, .25, d / 2 + 1.5);
    lmAdd(obj, new THREE.BoxGeometry(15, 1.1, .3), whiteTrim, 0, b.h / 2 + 1.4, d / 2 + 6);
    b.h += rh * .6; return true;
  }
  if (k === "garages") {
    // ряд гаражей: ворота разных цветов через каждые шесть метров, плоская крыша
    const rr = b.rot !== undefined ? b.rot : 0, rc = Math.cos(rr), rs = Math.sin(rr), cx = obj.position.x, cz = obj.position.z, by = b.baseY || 0;
    for (const sgn of [1, -1]) for (let x = -w / 2 + 3; x < w / 2 - 2; x += 6) { const z = sgn * (d / 2 + .16), qx = cx + x * rc - z * rs, qz = cz + x * rs + z * rc; instBoxes.push([qx, by + 3.3, qz, 5.2, 6.4, .3, pick([0x4a5a6a, 0x6a4a3a, 0x3f5a46, 0x5a5a5a, 0x7a3a2a, 0x2a4a7a]), b, -rr]); } // ворота с обеих сторон: ряды стоят лицом к проездам
    lmAdd(obj, new THREE.BoxGeometry(w + .6, .5, d + .6), parapetMat, 0, b.h + .25, 0);
    return true;
  }
  if (k === "autoservice") {
    // автосервис: широкие ворота, вывеска, стопка шин у стены
    lmAdd(obj, new THREE.BoxGeometry(11, 9, .3), gateMats[3], -w / 2 + 8, 4.6, d / 2 + .16);
    landSign(obj, "АВТОСЕРВИС · ШИНОМОНТАЖ", "#2a2d30", "#f2c846", Math.min(26, w - 2), b.h - 1.4, d / 2 + .35);
    for (let i = 0; i < 4; i++) lmAdd(obj, new THREE.CylinderGeometry(1.3, 1.3, .7, 14), tyreMat18, w / 2 + 2.2, .35 + i * .7, d / 2 - 3 + (i % 2) * .4);
    lmAdd(obj, new THREE.BoxGeometry(w + .6, .5, d + .6), parapetMat, 0, b.h + .25, 0);
    return true;
  }
  if (k === "cafe") {
    // кафе: вывеска, маркиза над витриной, столики с зонтиками на террасе
    b.seats = []; b.lights = []; // места посетителей и гирлянды — для cozy.js, при пересборке города заново
    landSign(obj, pick(["КАФЕ", "КОФЕЙНЯ", "ПЕКАРНЯ", "ПИЦЦА · КАФЕ"]), pick(["#5a2a1a", "#2e6a3c", "#1d3566"]), "#f4d9a0", Math.min(14, w - 2), b.h - 1.5, d / 2 + .35);
    const aw = lmAdd(obj, new THREE.BoxGeometry(w - 2, .3, 3), pick(AWNING_MATS), 0, b.h - 3.6, d / 2 + 1.4); aw.rotation.x = .35;
    for (const x of [-w / 3, 0, w / 3]) {
      lmAdd(obj, new THREE.CylinderGeometry(1.4, 1.4, .2, 12), whiteMat, x, 2.2, d / 2 + 5); lmAdd(obj, new THREE.CylinderGeometry(.12, .12, 2.2, 6), steelPostMat, x, 1.1, d / 2 + 5);
      lmAdd(obj, new THREE.CylinderGeometry(.08, .08, 6, 6), steelPostMat, x, 3, d / 2 + 5); lmAdd(obj, new THREE.ConeGeometry(2.6, 1.2, 10), pick(AWNING_MATS), x, 6.4, d / 2 + 5);
      // два стула у столика лицом к нему; места запоминаются — на них садятся посетители (cozy.js)
      for (const s of [-1, 1]) {
        lmAdd(obj, new THREE.BoxGeometry(1.4, .25, 1.4), woodBenchMat, x + s * 2.5, 1.48, d / 2 + 5); lmAdd(obj, new THREE.BoxGeometry(.25, 1.4, .25), steelPostMat, x + s * 2.5, .7, d / 2 + 5);
        lmAdd(obj, new THREE.BoxGeometry(.2, 1.8, 1.4), woodBenchMat, x + s * 3.15, 2.4, d / 2 + 5);
        b.seats.push([x + s * 2.5, d / 2 + 5, -s, 0]);
      }
      b.lights.push([x, b.h - 1.4, d / 2 + .5, x, 6.9, d / 2 + 5, .5]); // гирлянда от фасада к зонтику
    }
    b.lights.push([-w / 2 + .6, b.h - .9, d / 2 + .5, w / 2 - .6, b.h - .9, d / 2 + .5, 1.2]); // и вдоль фасада над маркизой
    lmAdd(obj, new THREE.BoxGeometry(w + .6, .5, d + .6), parapetMat, 0, b.h + .25, 0);
    return true;
  }
  if (k === "kinder") {
    // детский сад: цветные панели между окнами, вывеска, низкий козырёк над входом
    const rr = b.rot !== undefined ? b.rot : 0, rc = Math.cos(rr), rs = Math.sin(rr), cx = obj.position.x, cz = obj.position.z, by = b.baseY || 0, cols = [0xe8603a, 0x3a8ad8, 0xe8c040, 0x5ab04a];
    for (const s of [1, -1]) for (let x = -w / 2 + 3; x < w / 2 - 2; x += 7) for (let f = 0; f < b.floors; f++) { const z = s * (d / 2 + .14), qx = cx + x * rc - z * rs, qz = cz + x * rs + z * rc; instBoxes.push([qx, by + f * 12 + 3, qz, 2.6, 5.5, .25, cols[(Math.round(x) + f) & 3], b, -rr]); }
    landSign(obj, "ДЕТСКИЙ САД «СОЛНЫШКО»", "#f6f2e8", "#d8502a", Math.min(22, w - 2), b.h - 1.6, d / 2 + .35);
    lmAdd(obj, new THREE.BoxGeometry(7, .4, 3.2), whiteTrim, 0, 9, d / 2 + 1.4);
    lmAdd(obj, new THREE.BoxGeometry(w + .6, .5, d + .6), parapetMat, 0, b.h + .25, 0);
    return true;
  }
  if (k === "market") {
    // рынок: павильон под пологой крышей с вывеской, перед ним ряды прилавков под полосатыми навесами
    gableRoof(obj, w, d, b.h, d * .18, true, metalRoofMat, 1.5);
    landSign(obj, "РЫНОК", "#1f6a3a", "#fff", Math.min(18, w - 2), b.h - 1.6, d / 2 + .35);
    if (b.lotRect && b.front) {
      const rr = b.rot !== undefined ? b.rot : 0, rc = Math.cos(rr), rs = Math.sin(rr), cx = obj.position.x, cz = obj.position.z, by = b.baseY || 0;
      const back = (b.lotRect.d - d) / 2 - 4, z0 = d / 2 + 6, z1 = back + b.lotRect.d / 2 - 8, cols = [0xc8382a, 0x2e6a3c, 0x24507a, 0xc98a2a];
      for (let z = z0, row = 0; z < z1; z += 10, row++) for (let x = -b.lotRect.w / 2 + 6; x < b.lotRect.w / 2 - 6; x += 8) {
        if (Math.abs(x) < 5) continue; // проход посередине
        const qx = cx + x * rc - z * rs, qz = cz + x * rs + z * rc, c = cols[(row + Math.round(x / 8)) & 3];
        instBoxes.push([qx, by + 1.1, qz, 6, .5, 2.4, 0x9a8a6a, b, -rr]); instBoxes.push([qx, by + .5, qz, 5.4, 1, 2, 0x6a5a48, b, -rr]);
        instBoxes.push([qx, by + 3.6, qz, 6.6, .3, 3.2, 0xf0ece4, b, -rr]); instBoxes.push([qx, by + 3.9, qz, 6.2, .3, 2.8, c, b, -rr]); // навес: цветной верх на белой подкладке
        for (const s of [-1, 1]) instBoxes.push([cx + (x + s * 2.9) * rc - (z - 1.4) * rs, by + 1.9, cz + (x + s * 2.9) * rs + (z - 1.4) * rc, .18, 3.8, .18, 0x5a5a5a, b, -rr]);
      }
    }
    b.h += d * .18 * .6; return true;
  }
  return false;
}
// пляж и набережная на текстуре земли: песок по клеткам пляжа, дорожка по контуру озера
function paintLakes(g) {
  for (const l of lakes) {
    if (l.beach) {
      g.fillStyle = "#d8c48e";
      for (let gy = Math.max(0, Math.floor((l.y - l.ry * 1.4 - 20) / CS)); gy < Math.min(GH, Math.ceil((l.y + l.ry * 1.4 + 20) / CS)); gy++)
        for (let gx = Math.max(0, Math.floor((l.x - l.rx * 1.4 - 20) / CS)); gx < Math.min(GW, Math.ceil((l.x + l.rx * 1.4 + 20) / CS)); gx++) {
          const i = gy * GW + gx; if (grid[i] !== 7) continue;
          const x = gx * CS + 4, y = gy * CS + 4, d = lakeD(x, y);
          if (d >= 0 && d < 15 && Math.abs(Math.atan2(Math.sin(Math.atan2(y - l.y, x - l.x) - l.beach.a0), Math.cos(Math.atan2(y - l.y, x - l.x) - l.beach.a0))) < l.beach.half) g.fillRect(gx * CS, gy * CS, CS + .4, CS + .4);
        }
      speckle(g, l.x - l.rx * 1.4, l.y - l.ry * 1.4, l.rx * 2.8, l.ry * 2.8, 600, ["rgba(255,255,255,.08)", "rgba(120,100,60,.08)"], .8);
    }
    if (l.walk) { g.strokeStyle = "#c2b493"; g.lineWidth = 6; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); l.walk.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  }
}
Object.assign(PROP_PARTS, {
  // силос: цилиндр с конусом и лесенкой
  silo: () => [{ geo: new THREE.CylinderGeometry(3.2, 3.2, 16, 16), mat: siloMat, x: 0, y: 8, z: 0 }, { geo: new THREE.ConeGeometry(3.4, 3, 16), mat: siloMat, x: 0, y: 17.5, z: 0 }, P_BOX(.3, 16, 1.2, 3.3, 8, 0, steelPostMat)],
  // трактор: капот, кабина, большие задние колёса
  tractor: v => [P_BOX(5, 2.6, 2.4, 1, 2.4, 0, tractorMats[v % 2]), P_BOX(2.8, 2.8, 2.6, -2.2, 4.2, 0, tractorMats[v % 2]), P_BOX(2.4, 2, .1, -2.2, 4.4, 1.32, darkGlassMat), P_BOX(2.4, 2, .1, -2.2, 4.4, -1.32, darkGlassMat), P_BOX(.25, 3, .25, 2.2, 5, .8, steelPostMat),
    { geo: new THREE.CylinderGeometry(1.9, 1.9, .9, 14).rotateX(Math.PI / 2), mat: tyreMat18, x: -2.2, y: 1.9, z: 1.7 }, { geo: new THREE.CylinderGeometry(1.9, 1.9, .9, 14).rotateX(Math.PI / 2), mat: tyreMat18, x: -2.2, y: 1.9, z: -1.7 },
    { geo: new THREE.CylinderGeometry(1, 1, .7, 12).rotateX(Math.PI / 2), mat: tyreMat18, x: 2.4, y: 1, z: 1.5 }, { geo: new THREE.CylinderGeometry(1, 1, .7, 12).rotateX(Math.PI / 2), mat: tyreMat18, x: 2.4, y: 1, z: -1.5 }],
  // рулон сена
  hay: () => [{ geo: new THREE.CylinderGeometry(1.7, 1.7, 2.4, 12).rotateX(Math.PI / 2), mat: hayMat, x: 0, y: 1.7, z: 0 }],
  // корова: туловище, голова, ноги; v — масть
  cow: v => { const [a, b] = cowMats[v % 3]; return [P_BOX(3.4, 1.7, 1.5, 0, 2.2, 0, a), P_BOX(1.2, 1, 1.2, 0, 1.9, .3, b), P_BOX(1.1, .9, .9, 2.1, 2.5, 0, a), P_BOX(.9, .35, .3, 2.5, 2.9, 0, b), ...[[-1.2, .5], [-1.2, -.5], [1.2, .5], [1.2, -.5]].map(([x, z]) => P_BOX(.35, 1.4, .35, x, .7, z, b))]; },
  // кормушка
  trough: () => [P_BOX(5, .9, 1.6, 0, .6, 0, plankMat18), P_BOX(4.6, .2, 1.2, 0, 1, 0, darkGlassMat), P_BOX(.3, 1.2, 1.6, -2.3, .6, 0, plankMat18), P_BOX(.3, 1.2, 1.6, 2.3, .6, 0, plankMat18)],
  // пирс: настил на сваях уходит в воду (+z), перила по бокам
  pier: () => [P_BOX(5, .35, 26, 0, 1.3, 13, plankMat18), ...[3, 11, 19, 25].flatMap(z => [-2, 2].map(x => ({ geo: new THREE.CylinderGeometry(.3, .3, 4, 8), mat: plankMat18, x, y: -.5, z }))),
    ...[-2.4, 2.4].flatMap(x => [P_BOX(.2, .2, 24, x, 2.6, 13, plankMat18), ...[4, 12, 20].map(z => P_BOX(.2, 1.3, .2, x, 2, z, plankMat18))])],
  // пляжный зонтик с полотенцем
  umbrella: v => [{ geo: new THREE.CylinderGeometry(.1, .1, 5.2, 6), mat: steelPostMat, x: 0, y: 2.6, z: 0 }, { geo: new THREE.ConeGeometry(2.8, 1.1, 10), mat: seatMats[v % 3], x: 0, y: 5.4, z: 0 }, P_BOX(3, .1, 1.6, 1.4, .06, 1.2, seatMats[(v + 1) % 3])],
});
