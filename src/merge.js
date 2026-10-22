/* ---------- склейка домов в блоки: сотни зданий за несколько вызовов отрисовки ---------- */
const CHUNK = 400;
let chunkMeshes = new Map();
const _mn = new THREE.Matrix3(), _mp = new THREE.Vector3();
function appendMesh(buckets, mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
  _mn.getNormalMatrix(mesh.matrixWorld);
  for (const g of groups) {
    const mat = mats[g.materialIndex] || mats[0];
    let bk = buckets.get(mat); if (!bk) { bk = { p: [], n: [], u: [] }; buckets.set(mat, bk); }
    for (let k = g.start; k < g.start + g.count; k++) {
      const i = idx ? idx.getX(k) : k;
      _mp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); bk.p.push(_mp.x, _mp.y, _mp.z);
      _mp.fromBufferAttribute(nor, i).applyMatrix3(_mn).normalize(); bk.n.push(_mp.x, _mp.y, _mp.z);
      if (uv) bk.u.push(uv.getX(i), uv.getY(i)); else bk.u.push(0, 0);
    }
  }
}
function chunkKey(b) { return Math.floor((b.x0 + b.x1) / 2 / CHUNK) + ":" + Math.floor((b.y0 + b.y1) / 2 / CHUNK); }
function rebuildChunk(key) {
  for (const m of chunkMeshes.get(key) || []) { cityGroup.remove(m); m.geometry.dispose(); }
  const buckets = new Map();
  for (const b of buildings) if (b.chunk === key && !b.detached && b.obj) { b.obj.updateMatrixWorld(true); b.obj.traverse(o => { if (o.isMesh) appendMesh(buckets, o); }); }
  const out = [];
  for (const [mat, bk] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(bk.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(bk.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(bk.u, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; cityGroup.add(m); out.push(m);
  }
  chunkMeshes.set(key, out);
}
function mergeBuildings() {
  for (const ms of chunkMeshes.values()) for (const m of ms) m.geometry.dispose();
  chunkMeshes = new Map();
  const keys = new Set();
  for (const b of buildings) { b.chunk = chunkKey(b); b.detached = false; keys.add(b.chunk); }
  for (const k of keys) rebuildChunk(k);
}
// дом, который горит или рушится, отделяется от блока и анимируется сам
const dirtyChunks = new Set();
function detachBuilding(b) {
  if (b.detached || !b.obj) return;
  b.detached = true; cityGroup.add(b.obj); dirtyChunks.add(b.chunk);
}
function flushChunks() { if (!dirtyChunks.size) return; for (const k of dirtyChunks) rebuildChunk(k); dirtyChunks.clear(); }
