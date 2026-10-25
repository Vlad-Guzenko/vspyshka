/* ---------- детали домов: балконы, магазины на первых этажах, антенны и реклама на крышах, крыльцо у частных домов ---------- */
// вывески и реклама — общие материалы на весь город, поэтому при склейке кварталов это несколько вызовов отрисовки; ночью светятся
const glowSignMats = [];
function textTex(w, h, bg, fg, text, font, frame) {
  return canvasTex(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (frame) { g.strokeStyle = frame; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); }
    g.fillStyle = fg; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
    let size = parseInt(font.match(/(\d+)px/)[1]); while (size > 10 && g.measureText(text).width > w - 16) { size -= 2; g.font = font.replace(/\d+px/, size + "px"); }
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
function signMat(tex) { const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: .6 }); glowSignMats.push(m); return m; }
const SHOP_SIGNS = [["ПРОДУКТЫ", "#1f6a3a", "#fff"], ["АПТЕКА", "#ffffff", "#1a8a3a"], ["КАФЕ", "#5a2a1a", "#f4d9a0"], ["БАНК", "#1d3566", "#f4f1e8"], ["ЦВЕТЫ", "#e8e2d6", "#c8285a"], ["ОПТИКА", "#22324a", "#9fd0ff"],
  ["ХЛЕБ", "#c98a2a", "#3a2412"], ["ПАРИКМАХЕРСКАЯ", "#f4f1e8", "#7a2a6a"], ["КНИГИ", "#7a2a24", "#f4e9c8"], ["24 ЧАСА", "#c81e1e", "#fff"], ["ОДЕЖДА", "#222", "#f0f0f0"], ["ШАУРМА", "#e8a81a", "#5a1a0a"],
  ["ПИЦЦА", "#2e6a3c", "#fff4d6"], ["ОБУВЬ", "#4a4a52", "#ffd28a"], ["СВЯЗЬ", "#e0601a", "#fff"], ["ЗООТОВАРЫ", "#2a7a8a", "#fff"], ["ХОЗТОВАРЫ", "#8a6a20", "#fff"], ["ПОЧТА", "#1f4f9a", "#fff"]]
  .map(([t, bg, fg]) => signMat(textTex(512, 72, bg, fg, t, "bold 46px Arial")));
const ADS = [["ГОРОДСКОЙ ЦИРК · ПРЕМЬЕРА", "#7a1a5a", "#ffe14a"], ["ПЕЛЬМЕНИ «СИБИРЬ»", "#1d3566", "#fff"], ["АВТОСАЛОН · СКИДКИ ДО 30%", "#c81e1e", "#fff"], ["НОВОСТРОЙКИ У ПАРКА", "#2e6a3c", "#f4f1e8"],
  ["МОРОЖЕНОЕ «ПЛОМБИР»", "#f4f1e8", "#2a5aa8"], ["СВЯЗЬ «ВОЛНА» · 5G", "#e0601a", "#fff"], ["ЛИМОНАД «ЗВЕЗДА»", "#1a8a8a", "#ffe9a0"], ["ТЕАТР ДРАМЫ · СЕЗОН", "#222", "#e8c060"]]
  .map(([t, bg, fg]) => signMat(textTex(768, 256, bg, fg, t, "bold 64px Arial", "#ffffff")));
const AWNING_MATS = ["#a8322a", "#2e6a3c", "#24507a", "#c98a2a", "#5a3a2e", "#7a2a6a", "#d8d2c4"].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85, side: THREE.DoubleSide }));
const steelPostMat = new THREE.MeshStandardMaterial({ color: 0x5c5f62, roughness: .6, metalness: .5 });
const awningGeo = new THREE.BoxGeometry(1, .3, 2.6);
// окна в пролётах по BAY: центры колонн окон на лицевой (+z) и задней (−z) гранях, как их кладёт boxUV
function bayCenters(w, back) { const out = []; for (let i = 0; ; i++) { const x = BAY * (i + .5) - w / 2; if (x > w / 2 - 5) break; if (x >= -w / 2 + 5) out.push(back ? -x : x); } return out; }
const BALC_RAIL = [0xb2afa5, 0x9a968c, 0x8a8478, 0x6a5a48], BALC_GLAZE = [0xa9a99f, 0x9ca3a6, 0xb4ae9e, 0x7f8c94];
function facadeDetails(b, obj, w, d) {
  const st = STYLES[b.style] || {}, apt = b.kind === "apt", old = b.kind === "oldhouse";
  if (!(apt || old) || st.curtain) return;
  // локальные координаты дома (x вдоль фасада, z к улице) в мировые — как у мелочей на крыше в buildCity
  const rr = b.rot !== undefined ? b.rot : 0, rc = Math.cos(rr), rs = Math.sin(rr), cx = obj.position.x, cz = obj.position.z, by = b.baseY || 0;
  const at = (lx, lz) => [cx + lx * rc - lz * rs, cz + lx * rs + lz * rc];
  const fh = b.h / b.floors;
  // балконы стопками по колоннам окон; узор у каждого дома свой, часть застеклена
  if (apt && b.floors >= 4) {
    const pat = Math.floor(Math.random() * 3), rail = pick(BALC_RAIL), glazeK = rnd(.15, .6);
    for (const s of [1, -1]) {
      if (s < 0 && Math.random() < .4) continue;
      bayCenters(w, s < 0).forEach((lx, i) => {
        if (pat === 1 && i % 2) return; if (pat === 2 && i % 3 === 1) return;
        for (let f = 1; f < b.floors; f++) {
          const y = by + f * fh + 1.2, glazed = Math.random() < glazeK;
          const box = (ox, oy, oz, sx, sy, sz, c) => { const [qx, qz] = at(lx + ox, s * (d / 2 + oz)); instBoxes.push([qx, y + oy, qz, sx, sy, sz, c, b, -rr]); };
          box(0, 0, 1.2, 10.5, .45, 2.4, 0x9a978f);
          if (glazed) box(0, 1.75, 1.2, 10.5, 3.1, 2.3, pick(BALC_GLAZE));
          else { box(0, .9, 2.3, 10.5, 1.4, .25, rail); box(-5.1, .9, 1.2, .25, 1.4, 2.4, rail); box(5.1, .9, 1.2, .25, 1.4, 2.4, rail); }
        }
      });
    }
  }
  // старый город: кованые балкончики на втором-третьем этаже
  if (old) for (const lx of bayCenters(w, false)) for (let f = 1; f < Math.min(3, b.floors); f++) if (Math.random() < .3) {
    const y = by + f * fh + 1.6, put = (ox, oy, oz, sx, sy, sz, c) => { const [qx, qz] = at(lx + ox, d / 2 + oz); instBoxes.push([qx, y + oy, qz, sx, sy, sz, c, b, -rr]); };
    put(0, 0, .8, 7, .35, 1.6, 0x8a857c); put(0, .8, 1.55, 7, 1.2, .15, 0x2a2724);
  }
  // первый этаж: магазин — вывеска над витринами и козырьки над окнами
  if ((apt && b.floors >= 3 && Math.random() < .55) || (old && Math.random() < .5)) {
    const L = Math.min(w * rnd(.35, .6), 34), sx = rnd(-w / 2 + L / 2 + 2, w / 2 - L / 2 - 2);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.6), pick(SHOP_SIGNS)); sign.position.set(sx, fh - 1.8, d / 2 + .35); obj.add(sign);
    const am = pick(AWNING_MATS);
    for (const lx of bayCenters(w, false)) if (Math.abs(lx - sx) > L / 2 + 2 || Math.random() < .3) {
      if (Math.random() < .45) continue;
      const a = new THREE.Mesh(awningGeo, am); a.scale.x = BAY * .78; a.position.set(lx, fh - 3.6, d / 2 + 1.25); a.rotation.x = .38; obj.add(a);
    }
  }
  if (!apt) return;
  // крыша: телевизионные антенны, у домов вдоль улиц — рекламный щит
  if (b.floors <= 12 && Math.random() < .6) for (let k = 0, n = 1 + Math.floor(Math.random() * 3); k < n; k++) {
    const lx = rnd(-w / 2 + 4, w / 2 - 4), lz = rnd(-d / 2 + 3, d / 2 - 3), [qx, qz] = at(lx, lz), top = by + b.h;
    instBoxes.push([qx, top + 3.5, qz, .3, 7, .3, 0x4a4c4e, b]); instBoxes.push([qx, top + 6.4, qz, 4, .2, .2, 0x4a4c4e, b, -rr]); instBoxes.push([qx, top + 5.2, qz, 3, .2, .2, 0x4a4c4e, b, -rr]);
  }
  if (b.floors >= 5 && b.floors <= 10 && w >= 30 && Math.random() < .14) {
    const bw = Math.min(28, w - 6), g = new THREE.Group(); g.position.set(0, b.h, d / 2 - 4);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw * .33), pick(ADS)); panel.position.y = 4 + bw * .165; panel.position.z = .2; g.add(panel);
    const back = new THREE.Mesh(new THREE.BoxGeometry(bw + 1, bw * .33 + 1, .4), steelPostMat); back.position.y = panel.position.y; g.add(back);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 4.5, .6), steelPostMat); p.position.set(s * bw * .35, 2.2, -.4); g.add(p); }
    obj.add(g);
  }
}
// пятиэтажка под двускатной крышей вместо плоской
function pitchedRoof(b, obj, w, d) {
  if (b.kind !== "apt" || b.floors > 5 || (STYLES[b.style] || {}).curtain || Math.random() > .35) return false;
  const along = w >= d, span = along ? d : w, len = along ? w : d, rh = span * .24;
  const sh = new THREE.Shape([new THREE.Vector2(-span / 2 - 1, 0), new THREE.Vector2(span / 2 + 1, 0), new THREE.Vector2(0, rh)]);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: len + 1.5, bevelEnabled: false }); rg.translate(0, 0, -(len + 1.5) / 2); if (along) rg.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(rg, pick([metalRoofMat, tileMats[0], tileMats[2], tileMats[4]])); roof.position.y = b.h; obj.add(roof);
  b.h += rh * .6; return true;
}
// частный дом: крыльцо с навесом, у части — застеклённая веранда и спутниковая тарелка
const porchMat = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: .85 }), verandaMat = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: .15, metalness: .4 }), whiteTrim = new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: .7 });
function houseDetails(b, obj, w, d) {
  if (b.kind !== "house") return;
  const dx = rnd(-w / 4, w / 4);
  const step = new THREE.Mesh(new THREE.BoxGeometry(5, .9, 2.4), porchMat); step.position.set(dx, .45, d / 2 + 1.2); obj.add(step);
  const can = new THREE.Mesh(new THREE.BoxGeometry(6, .35, 3.2), whiteTrim); can.position.set(dx, 8.4, d / 2 + 1.5); can.rotation.x = .15; obj.add(can);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.4, 7.8, .4), whiteTrim); p.position.set(dx + s * 2.6, 4.3, d / 2 + 2.8); obj.add(p); }
  if (Math.random() < .3 && w > 18) { const vw = rnd(6, 9), sx = dx > 0 ? -w / 2 + vw / 2 + 1 : w / 2 - vw / 2 - 1; const v = new THREE.Mesh(new THREE.BoxGeometry(vw, 7, 4), verandaMat); v.position.set(sx, 3.5, d / 2 + 2); obj.add(v); const vr = new THREE.Mesh(new THREE.BoxGeometry(vw + .6, .4, 4.6), whiteTrim); vr.position.set(sx, 7.2, d / 2 + 2); obj.add(vr); }
  if (Math.random() < .35) { const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.3, .2, .6, 10), whiteTrim); dish.rotation.x = -1.1; dish.position.set(rnd(-w / 3, w / 3), b.h - 2, d / 2 + .6); obj.add(dish); }
}
