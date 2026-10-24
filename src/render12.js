/* ---------- гидранты, знаки «проезд закрыт», вертолётная площадка больницы ---------- */
let hydrantMesh = null, hydrantCap = null;
const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xc8261c, roughness: .55, metalness: .3 });
function buildHydrants() {
  for (const m of [hydrantMesh, hydrantCap]) if (m) { cityGroup.remove(m); m.geometry.dispose(); }
  const n = Math.max(1, hydrants.length), m = new THREE.Matrix4();
  hydrantMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.55, .65, 3.2, 8).translate(0, 1.6, 0), hydrantMat, n);
  hydrantCap = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, .7, .9), hydrantMat, n);
  hydrants.forEach((h, i) => { const y = gY(h.x, h.y); m.makeTranslation(X(h.x), y, Z(h.y)); hydrantMesh.setMatrixAt(i, m); m.makeRotationY(-(h.a || 0)).setPosition(X(h.x), y + 2.4, Z(h.y)); hydrantCap.setMatrixAt(i, m); });
  for (const o of [hydrantMesh, hydrantCap]) { o.count = hydrants.length; o.castShadow = true; o.frustumCulled = false; cityGroup.add(o); }
}
// знак на перекрытой улице: конусы поперёк полосы и щит «ПРОЕЗД ЗАКРЫТ»
const closedTex = canvasTex(256, 96, g => { g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, 256, 96); g.fillStyle = "#c81e1e"; g.fillRect(0, 0, 256, 10); g.fillRect(0, 86, 256, 10); g.fillStyle = "#1c1c1c"; g.font = "bold 30px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("ПРОЕЗД", 128, 44); g.fillText("ЗАКРЫТ", 128, 78); });
const closedObjs = new Map();
function closedBarrier(e, atA) {
  const g = new THREE.Group(), r = atA ? e.ra : e.rb, t = atA ? r + 3 : e.len - r - 3, p = edgePos(e, t), tx = atA ? p.tx : -p.tx, ty = atA ? p.ty : -p.ty;
  g.position.set(X(p.x), gY(p.x, p.y), Z(p.y)); g.rotation.y = -Math.atan2(ty, tx);
  for (const o of [-e.hw * .7, -e.hw * .35, 0, e.hw * .35, e.hw * .7]) g.add(trafficCone(0, o));
  g.add(signBoard(closedTex, 7, 2.6, 2, 4, -e.hw * .5 - 1.5, -Math.PI / 2));
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.4, .5, e.hw * 1.5), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: .6 })); bar.position.set(-1.2, 2.6, 0); g.add(bar);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.3, 2.6, .3), steelMat2); leg.position.set(-1.2, 1.3, s * e.hw * .7); g.add(leg); }
  return g;
}
function updateRoadSigns() {
  for (const e of RE) {
    const want = !!e.closed, has = closedObjs.get(e);
    if (want && !has) { const ga = closedBarrier(e, true), gb = closedBarrier(e, false); scene.add(ga, gb); closedObjs.set(e, [ga, gb]); }
    else if (!want && has) { for (const o of has) scene.remove(o); closedObjs.delete(e); }
  }
  for (const [e, os] of closedObjs) if (!RE.includes(e)) { for (const o of os) scene.remove(o); closedObjs.delete(e); }
}
// вертолётная площадка на крыше: круг с буквой H
const helipadTex = canvasTex(256, 256, g => { g.fillStyle = "#4a4e52"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#f0f0ea"; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.stroke(); g.fillStyle = "#f0f0ea"; g.font = "bold 150px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("H", 128, 182); g.fillStyle = "#d42020"; g.fillRect(8, 8, 48, 14); g.fillRect(25, -9, 14, 48); });
function hospitalExtras(b, obj, w, d) {
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, d) * .85, Math.min(w, d) * .85), new THREE.MeshStandardMaterial({ map: helipadTex, roughness: .8 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, b.h + .2, 0); obj.add(pad);
  // козырёк приёмного покоя над входом, на двух стойках
  const roof = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * .6, 30), 1, 10), new THREE.MeshStandardMaterial({ color: 0xe8ecee, roughness: .6 })); roof.position.set(0, 7.5, d / 2 + 5); roof.castShadow = true; obj.add(roof);
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 7.5, 8), steelMat2); post.position.set(s * Math.min(w * .6, 30) * .42, 3.75, d / 2 + 9); obj.add(post); }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * .6, 30), 1.2, .3), new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0xc81e1e, emissiveIntensity: .35 })); strip.position.set(0, 7.5, d / 2 + 10.1); obj.add(strip);
}
