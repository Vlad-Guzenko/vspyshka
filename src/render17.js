/* ---------- указатели угроз в сцене ----------
   Над въездом, к которому идёт орда, — красный световой столб (65 м) и пульсирующее кольцо на земле; вокруг орды в поле — кольцо.
   У края экрана — плашки со стрелкой к орде и к беженцам, с численностью, временем и расстоянием; клик переносит камеру туда. */
const tmGroup = new THREE.Group(); scene.add(tmGroup);
const tmBeamMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false });
const tmObjs = new Map();
function tmMarker(key, beam) {
  let o = tmObjs.get(key); if (o) return o;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.y = .8; g.add(ring);
  let b = null; if (beam) { b = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 5, 260, 12, 1, true), tmBeamMat); b.position.y = 130; g.add(b); }
  tmGroup.add(g); o = { g, ring, beam: b, seen: 0 }; tmObjs.set(key, o); return o;
}
// DOM-слой с плашками у края экрана
const tmLayer = document.createElement("div"); tmLayer.className = "tmarks"; $("stage").appendChild(tmLayer);
const tmEls = new Map(), tmV = new THREE.Vector3();
function tmEl(key, cls) {
  let el = tmEls.get(key); if (el) return el;
  el = document.createElement("button"); el.className = "tmark " + cls; el.innerHTML = "<i></i><span></span>";
  el.addEventListener("click", () => { const p = el._to; if (!p) return; followA = null; cine = false; syncCamButtons(); camS.tx = p[0] - W / 2; camS.tz = p[1] - H / 2; camS.dist = Math.min(camS.dist, 700); });
  tmLayer.appendChild(el); tmEls.set(key, el); return el;
}
// поставить плашку. Цель в кадре — плашка над ней со стрелкой вниз. Цель вне кадра — плашка у края экрана,
// стрелка как у компаса: направление по земле от центра кадра к цели с учётом поворота камеры, в подписи — расстояние
const tmF = new THREE.Vector3();
function tmPlace(el, x, y, text) {
  el._to = [x, y]; el._seen = true;
  const cv = $("cv"), w = cv.clientWidth, h = cv.clientHeight, sr0 = cv.getBoundingClientRect(), hd = document.querySelector("header.top"), tip = document.querySelector(".tip");
  const L = document.body.classList.contains("noTools") ? 24 : 240, Rm = document.body.classList.contains("noPanel") ? 24 : 360;
  // сверху — шапка с кнопками, снизу — строка подсказки: плашки между ними
  const T = Math.max(60, (hd ? hd.getBoundingClientRect().bottom - sr0.top : 0) + 14), B = Math.max(60, tip && !tip.hidden ? sr0.bottom - tip.getBoundingClientRect().top + 10 : 0);
  tmV.set(X(x), gY(x, y) + 4, Z(y)).project(camera);
  let sx = (tmV.x + 1) / 2 * w, sy = (1 - tmV.y) / 2 * h, ang = Math.PI / 2, label = text;
  const inside = tmV.z < 1 && Math.abs(tmV.x) < 1 && Math.abs(tmV.y) < 1 && sx > L + 20 && sx < w - Rm - 20 && sy > T + 30 && sy < h - B - 20;
  if (inside) sy -= 30;
  else {
    const cxw = camC.tx + W / 2, cyw = camC.tz + H / 2, dx = x - cxw, dz = y - cyw, dist = Math.hypot(dx, dz) / 4;
    camera.getWorldDirection(tmF); let fx = tmF.x, fz = tmF.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    ang = Math.atan2(-(dx * fx + dz * fz), dx * -fz + dz * fx);
    const cx = (L + w - Rm) / 2, cy = (T + h - B) / 2, ux = Math.cos(ang), uy = Math.sin(ang);
    const k = Math.min(ux > 1e-6 ? (w - Rm - cx) / ux : ux < -1e-6 ? (L - cx) / ux : 1e9, uy > 1e-6 ? (h - B - cy) / uy : uy < -1e-6 ? (T - cy) / uy : 1e9);
    sx = cx + ux * k; sy = cy + uy * k;
    label = text + " · " + (dist >= 1000 ? (dist / 1000).toFixed(1).replace(".", ",") + " км" : Math.max(10, Math.round(dist / 10) * 10) + " м");
  }
  // не заезжать под панели и под мини-карту: плашка целиком в свободной части экрана
  const hw2 = (el.offsetWidth || 160) / 2 + 6, hh2 = (el.offsetHeight || 22) / 2 + 4;
  sx = clamp(sx, L + hw2, Math.max(L + hw2, w - Rm - hw2)); sy = clamp(sy, T + hh2, h - B - hh2);
  const mr = mini.getBoundingClientRect(), m0x = mr.left - sr0.left, m0y = mr.top - sr0.top;
  if (sx + hw2 > m0x && sx - hw2 < m0x + mr.width && sy + hh2 > m0y) sy = Math.min(sy, m0y - hh2 - 4);
  el.style.left = sx + "px"; el.style.top = sy + "px";
  el.firstChild.style.transform = `rotate(${ang}rad)`;
  el.classList.toggle("off", !inside);
  if (el.lastChild.textContent !== label) el.lastChild.textContent = label;
}
function updateThreatMarks(dt) {
  for (const o of tmObjs.values()) o.seen = 0;
  for (const el of tmEls.values()) el._seen = false;
  const pulse = .5 + .5 * Math.sin(performance.now() / 300);
  if (typeof threat !== "undefined" && threat && !(typeof fps !== "undefined" && fps.on)) {
    for (const h of threat.hordes) {
      if (h.done) continue; const en = entries[h.en]; if (!en) continue;
      // въезд, к которому идёт орда: столб и кольцо
      const m = tmMarker("he" + h.id, true); m.seen = 1;
      m.g.position.set(X(en.x), gY(en.x, en.y), Z(en.y)); const rr = 34 + 6 * pulse; m.ring.scale.set(rr, 1, rr); m.ring.material.opacity = .35 + .4 * pulse;
      tmBeamMat.opacity = .18 + .17 * pulse;
      const c = simT >= h.emergeT ? hordeCenter(h) : null;
      if (c) {
        const r = tmMarker("hc" + h.id, false); r.seen = 1; r.g.position.set(X(c.x), gY(c.x, c.y), Z(c.y)); const s = Math.max(30, c.r + 12); r.ring.scale.set(s, 1, s); r.ring.material.opacity = .5;
        const dEn = Math.hypot(c.x - en.x, c.y - en.y) / 4;
        tmPlace(tmEl("h" + h.id, "horde"), c.x, c.y, `Орда ${c.n} · ${dEn < 60 ? "у въезда" : Math.round(dEn / 10) * 10 + " м до въезда"}`);
      } else tmPlace(tmEl("h" + h.id, "horde"), en.x, en.y, `Орда ~${Math.round(h.n / 10) * 10} · у въезда через ${mmss2(hordeEta(h))}`);
    }
    for (let i = 0; i < threat.cols.length; i++) {
      const col = threat.cols[i]; if (col.done) continue; const en = entries[col.en]; if (!en) continue;
      tmPlace(tmEl("r" + i, "ref"), en.x, en.y, col.policy === "closed" ? "Беженцы · въезд закрыт" : "Беженцы · досмотр на въезде");
    }
  }
  for (const [k, o] of tmObjs) if (!o.seen) { tmGroup.remove(o.g); o.ring.geometry.dispose(); o.ring.material.dispose(); if (o.beam) o.beam.geometry.dispose(); tmObjs.delete(k); }
  for (const [k, el] of tmEls) if (!el._seen) { el.remove(); tmEls.delete(k); }
}
