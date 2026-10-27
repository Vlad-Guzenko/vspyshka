// снимок карты сверху в PNG: node tests/mapshot.js <планировка> [файл]
// клетки сетки красятся по типу, поверх — здания (повёрнутые тоже), полосы движения и машины
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const files = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js','sim18.js', 'sim19.js', 'sim20.js'];
const src = files.filter(f => fs.existsSync(path.join(__dirname, '..', 'src', f))).map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});`;
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const layout = process.argv[2] || 'grid', out = process.argv[3] || path.join(process.env.TEMP || '.', 'map_' + layout + '.png');
const body = `
settings.fast = true; if (process.env.MAP) mapSize = process.env.MAP; const _g = genCity; genCity = () => _g(${JSON.stringify(layout)}); newCitySim(900); genCity = _g;
return { grid, GW, GH, CS, buildings, RE, RN, cars, layoutKey, blocks, trees, edgePos, regionOf, lakes, props, W, H };`;
const R = new Function(stub + src + body)();
const S = +(process.env.S || 2), w = R.GW * S, h = R.GH * S, img = Buffer.alloc(w * h * 3);
const COL = { 0: [58, 60, 62], 1: [150, 150, 146], 2: [92, 130, 70], 3: [170, 150, 120], 4: [44, 92, 40], 5: [200, 60, 60], 6: [220, 200, 60], 7: [190, 180, 160], 8: [120, 100, 80], 9: [40, 80, 120], 10: [120, 116, 110] };
// характер района подкрашивает клетки квартала (кроме дорог и домов)
const CH_COL = { center: [150, 120, 200], mid: [200, 160, 120], sleep: [120, 160, 220], cottage: [230, 200, 120], private: [190, 225, 140], old: [220, 180, 160], industry: [160, 160, 160], garages: [120, 120, 120], lake: [120, 200, 220] };
for (let gy = 0; gy < R.GH; gy++) for (let gx = 0; gx < R.GW; gx++) { const gi = gy * R.GW + gx, g = R.grid[gi]; let c = COL[g] || [255, 0, 255]; const r = R.regionOf[gi], b = r >= 0 ? R.blocks[r] : null, tc = b && !b.rural && (g === 1 || g === 2 || g === 7) ? CH_COL[b.kind === 'lake' ? 'lake' : b.ch] : null; if (tc) c = c.map((v, i) => Math.round(v * .6 + tc[i] * .4)); for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const i = ((gy * S + yy) * w + gx * S + xx) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; } }
const put = (x, y, c) => { x = Math.round(x / R.CS * S); y = Math.round(y / R.CS * S); if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; };
// контуры зданий
for (const b of R.buildings) {
  const c = b.kind === 'tower' ? [80, 70, 140] : b.kind === 'house' || b.kind === 'cottage' || b.kind === 'dacha' ? [160, 90, 70] : b.kind === 'farmhouse' || b.kind === 'barn' ? [200, 120, 60] : ['market', 'cafe', 'kinder', 'autoservice', 'manor', 'garages'].includes(b.kind) ? [240, 60, 200] : [110, 90, 70];
  if (b.rot !== undefined) { const ca = Math.cos(b.rot), sa = Math.sin(b.rot); for (let u = -b.w / 2; u <= b.w / 2; u += 1) for (const v of [-b.d / 2, b.d / 2]) { put(b.cx + u * ca - v * sa, b.cy + u * sa + v * ca, c); } for (let v = -b.d / 2; v <= b.d / 2; v += 1) for (const u of [-b.w / 2, b.w / 2]) put(b.cx + u * ca - v * sa, b.cy + u * sa + v * ca, c); }
  else { for (let x = b.x0; x <= b.x1; x += 1) { put(x, b.y0, c); put(x, b.y1, c); } for (let y = b.y0; y <= b.y1; y += 1) { put(b.x0, y, c); put(b.x1, y, c); } }
}
// осевые линии дорог и узлы
for (const e of R.RE) for (let t = 0; t <= e.len; t += 2) { const p = R.edgePos(e, t); put(p.x, p.y, e.rural ? [200, 170, 90] : e.kind === 'av' ? [250, 230, 90] : e.kind === 'ring' ? [90, 220, 250] : [235, 235, 200]); }
for (const n of R.RN) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) put(n.x + dx, n.y + dy, n.sig ? [240, 60, 60] : n.exit ? [60, 240, 60] : n.ed.length === 1 ? [240, 120, 240] : [40, 40, 40]);
for (const c of R.cars) for (let k = -6; k <= 6; k++) put(c.x + Math.cos(c.ang) * k, c.y + Math.sin(c.ang) * k, c.moving ? [80, 160, 255] : [255, 255, 255]);
fs.writeFileSync(out, png(w, h, img));
const kinds = {}; for (const b of R.buildings) kinds[b.kind] = (kinds[b.kind] || 0) + 1; const chs = {}; for (const b of R.blocks) if (!b.rural) chs[b.ch] = (chs[b.ch] || 0) + 1;
console.log(R.layoutKey, R.W + 'x' + R.H, 'nodes', R.RN.length, 'edges', R.RE.length, 'buildings', R.buildings.length, 'blocks', R.blocks.length, 'trees', R.trees.length, 'cars', R.cars.length, 'lakes', R.lakes.length, 'props', R.props.length, '->', out);
console.log('kinds', JSON.stringify(kinds)); console.log('districts', JSON.stringify(chs));
