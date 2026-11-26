/*

The Kawaii Spatial Diorama, 3D engine.
   
Needs js/vendor/three-diorama.min.js (window.THREE) and js/app.js (window.GM635). 
   
https://www.tooplate.com/view/2171-spatial-diorama

*/

(function () {
'use strict';
const Bus = window.GM635;
const THREE = window.THREE;
if (!Bus) return;
if (!THREE || !THREE.WebGLRenderer) { Bus.fail('three-missing'); return; }
const { OrbitControls, RoundedBoxGeometry } = THREE;

/* 푸밤: 템플릿 vendor 묶음에 빠진 기능 보충 (claude.ai 미리보기는 CDN 전체판을 써서 몰랐던 부분)
   BackSide(외곽선), Float32BufferAttribute(머리 다발), CatmullRomCurve3 + TubeGeometry(곱슬 컬) */
if (THREE.BackSide == null) THREE.BackSide = 1;
if (!THREE.Plane) {
  /* 가구 끌기용 바닥면 (Ray.intersectPlane 이 쓰는 부분만) */
  THREE.Plane = class {
    constructor(normal, constant = 0){ this.normal = normal; this.constant = constant; this.isPlane = true; }
    distanceToPoint(p){ return this.normal.dot(p) + this.constant; }
  };
}
if (!THREE.Float32BufferAttribute) {
  THREE.Float32BufferAttribute = class extends THREE.BufferAttribute {
    constructor(arr, size, norm){ super(new Float32Array(arr), size, norm); }
  };
}
if (!THREE.CatmullRomCurve3) {
  /* 점들을 부드럽게 잇는 곡선 (가장자리 점은 복제) */
  THREE.CatmullRomCurve3 = class {
    constructor(points){ this.points = points; }
    getPoint(t){
      const P = this.points, n = P.length - 1, x = Math.min(Math.max(t, 0), 1) * n;
      const i = Math.min(Math.floor(x), n - 1), u = x - i;
      const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n)];
      const u2 = u * u, u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      return new THREE.Vector3(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
    }
  };
}
if (!THREE.TubeGeometry) {
  /* 곡선을 따라가는 관: 평행 이동 프레임으로 비틀림 없이 */
  THREE.TubeGeometry = class extends THREE.BufferGeometry {
    constructor(curve, seg = 48, radius = 0.05, radial = 8){
      super();
      const V = THREE.Vector3, pts = [], tans = [];
      for (let i = 0; i <= seg; i++) pts.push(curve.getPoint(i / seg));
      for (let i = 0; i <= seg; i++) tans.push(pts[Math.min(i + 1, seg)].clone().sub(pts[Math.max(i - 1, 0)]).normalize());
      let nrm = new V(0, 1, 0); if (Math.abs(nrm.dot(tans[0])) > 0.9) nrm.set(1, 0, 0);
      nrm.sub(tans[0].clone().multiplyScalar(nrm.dot(tans[0]))).normalize();
      const pos = [], nor = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const T = tans[i];
        nrm.sub(T.clone().multiplyScalar(nrm.dot(T))).normalize();
        const B = new V().crossVectors(T, nrm);
        for (let j = 0; j <= radial; j++) {
          const a = j / radial * Math.PI * 2, c = -Math.cos(a), s = Math.sin(a);
          const d = new V(c * nrm.x + s * B.x, c * nrm.y + s * B.y, c * nrm.z + s * B.z);
          pos.push(pts[i].x + d.x * radius, pts[i].y + d.y * radius, pts[i].z + d.z * radius);
          nor.push(d.x, d.y, d.z);
        }
      }
      for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      this.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      this.setIndex(idx);
    }
  };
}



function hasWebGL(){
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (!hasWebGL()) Bus.fail('webgl');
else {
  try { boot(); }
  catch (err) { console.error(err); Bus.fail('boot'); }
}

function boot(){
  const V3 = THREE.Vector3;
  const stage = document.getElementById('stage');
  const reduced = () => Bus.reduced;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* Candy palette: the brief's Blush, Mint and Lavender pushed brighter so they survive
     3D shading, plus butter and sky accents for small props. Brief originals, for reference:
     Blush #FFD1DC, Mint #C8E6C9, Lavender #E6E6FA */
  const COL = {
    white: 0xFFFFFF, ink: 0x1F1B24,
    blush: 0xFFC3D3, mint: 0xB4E8BD, lav: 0xDEDAFB,
    blushDeep: 0xFF9DBD, mintDeep: 0x7FD498, lavDeep: 0xB9B1F0,
    blushSoft: 0xFFE3EB, lavSoft: 0xF0EEFF,
    butter: 0xFFE27A, sky: 0x9FD8FF,
    /* 푸밤: 벽 색, HO1·HO2 토끼 목도리 색 */
    wall: 0xCEDEF2,
    ho1: 0xE6DC6A, ho2: 0x4A6FD8
  };

  /* ---------- Renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xffffff, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 260);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xFFE3EB, 1.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xFFFDF8, 1.35);
  key.position.set(6, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 32 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xF1EEFF, 0.55);
  fill.position.set(-5, 4, 9);
  scene.add(fill);

  /* ---------- Primitive helpers ---------- */
  const mat = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o || {}));
  const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  const rbox = (w, h, d, r, color, o) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.002)), mat(color, o)));
  const sph = (r, color, o, seg = 32) => shade(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat(color, o)));
  const cyl = (rt, rb, h, color, o, seg = 32) => shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o)));
  const cap = (r, len, color, o) => shade(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat(color, o)));
  const put = (m, x, y, z, parent) => { m.position.set(x, y, z); (parent || scene).add(m); return m; };

  function radialTexture(stops, size = 256){
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(s => grd.addColorStop(s[0], s[1]));
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const shadowTex = radialTexture([[0, 'rgba(78,66,128,0.34)'], [0.45, 'rgba(78,66,128,0.13)'], [1, 'rgba(78,66,128,0)']]);
  /* floating shadow: lavender core with a blush halo, never grey on the white page */
  const floatTex = radialTexture([[0, 'rgba(126,112,196,0.30)'], [0.42, 'rgba(196,150,196,0.14)'], [0.75, 'rgba(255,209,220,0.06)'], [1, 'rgba(255,209,220,0)']]);
  const softTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']], 64);

  /* ---------- Room shell ---------- */
  const FLOOR = 0.06;
  const floatShadow = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ map: floatTex, transparent: true, depthWrite: false }));
  floatShadow.renderOrder = 0;
  floatShadow.rotation.x = -Math.PI / 2; floatShadow.position.y = -1.6;
  scene.add(floatShadow);

  /* cutting-mat dot grid on the white page, fading out toward the edges */
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uFade: { value: 1 },
      uDot: { value: new THREE.Vector3(0.725, 0.702, 0.910) },   /* #B9B3E8 */
      uMark: { value: new THREE.Vector3(0.957, 0.655, 0.737) }   /* #F4A7BC */
    },
    vertexShader: `
      varying vec2 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uFade; uniform vec3 uDot; uniform vec3 uMark;
      varying vec2 vW;
      void main(){
        float fade = 1.0 - smoothstep(8.0, 25.0, length(vW));
        vec2 g = vW / 0.7;
        vec2 id = floor(g + 0.5);
        float d = length(fract(g + 0.5) - 0.5);
        bool major = mod(id.x, 5.0) == 0.0 && mod(id.y, 5.0) == 0.0;
        float r = major ? 0.11 : 0.065;
        float aa = fwidth(d) * 1.2;
        float dotA = 1.0 - smoothstep(r - aa, r + aa, d);
        float a = dotA * fade * uFade * (major ? 0.75 : 0.55);
        if (a < 0.002) discard;
        gl_FragColor = vec4(major ? uMark : uDot, a);
      }`
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), gridMat);
  grid.rotation.x = -Math.PI / 2; grid.position.y = -1.66; grid.renderOrder = -1;
  scene.add(grid);

  /* a few pastel clouds and stars drifting outside the room */
  const ambient = [];
  function cloud(x, y, z, s, color){
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
    [[0, 0, 0, 0.55], [0.58, -0.08, 0.02, 0.42], [-0.58, -0.1, 0.04, 0.4], [0.2, 0.34, 0.02, 0.4], [-0.24, 0.26, -0.04, 0.34]].forEach(b => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(b[3], 24, 18), mat(color, { emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.95 }));
      m.position.set(b[0], b[1], b[2]); m.scale.y = 0.86; g.add(m);
    });
    scene.add(g); ambient.push({ g, base: g.position.clone(), s, seed: Math.random() * 6, spin: 0 });
  }
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.19 : 0.45; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
  starGeo.center();
  function starObj(x, y, z, s, color){
    const m = new THREE.Mesh(starGeo, mat(color, { emissive: color, emissiveIntensity: 0.2, roughness: 0.55 }));
    m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m);
    ambient.push({ g: m, base: m.position.clone(), s, seed: Math.random() * 6, spin: 0.5 });
  }
  /* placed in the page margins of the default isometric view */
  cloud(-1.6, 0.2, 7.4, 1.15, 0xEAE7FF);
  cloud(6.4, 3.7, -4.6, 1.0, 0xFFE8EF);
  cloud(8.2, 0.25, -1.55, 0.75, 0xE4F7E8);
  starObj(7.0, 2.2, -2.6, 0.75, COL.butter);
  starObj(-2.5, 1.8, 7.2, 0.55, COL.blushDeep);
  let amb = 1;

  put(rbox(10.8, 0.9, 10.8, 0.32, 0xC6C0F2), 0, -0.45, 0);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    put(rbox(2.07, 0.12, 2.07, 0.05, (i + j) % 2 ? COL.lavSoft : 0xFFF5F8), i * 2.1, 0, j * 2.1);
  }
  const floorPick = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5), new THREE.MeshBasicMaterial({ visible: false }));
  floorPick.rotation.x = -Math.PI / 2; floorPick.position.y = FLOOR; floorPick.userData.floor = true;
  scene.add(floorPick);

  put(rbox(10.8, 5.2, 0.4, 0.18, COL.wall, { emissive: COL.wall, emissiveIntensity: 0.32 }), 0, 2.6, -5.2);
  put(rbox(0.4, 5.2, 10.8, 0.18, COL.wall, { emissive: COL.wall, emissiveIntensity: 0.32 }), -5.2, 2.6, 0);
  put(rbox(10.4, 0.3, 0.14, 0.06, COL.white), 0, 0.2, -4.96);
  put(rbox(0.14, 0.3, 10.4, 0.06, COL.white), -4.96, 0.2, 0);

  /* bead garland on the back wall */
  const beadCols = [COL.lavDeep, COL.butter, COL.mintDeep, COL.blushDeep, COL.sky, COL.white];
  for (let i = 0; i < 17; i++) {
    const x = -4.4 + i * 0.55, y = 4.55 - 0.32 * Math.sin((i / 16) * Math.PI);
    put(sph(0.1, beadCols[i % 6], null, 16), x, y, -4.92);
  }
  /* ---------- 침대: 누르면 둘이 올라가 잠듦 (방이 어두워지고 Zzz) ---------- */
  const BED = { x: 3.55, z: -1.3 };
  const bed = new THREE.Group(); bed.position.set(BED.x, FLOOR, BED.z); scene.add(bed);
  [[-0.82, -1.0], [0.82, -1.0], [-0.82, 1.0], [0.82, 1.0]].forEach(q => put(cyl(0.07, 0.06, 0.18, 0xE9E4D8, null, 12), q[0], 0.09, q[1], bed));
  put(rbox(1.9, 0.22, 2.25, 0.08, 0xF3EFE6), 0, 0.27, 0, bed);                     /* 틀 */
  put(rbox(1.8, 0.24, 2.1, 0.1, COL.white), 0, 0.48, 0.02, bed);                  /* 매트리스 */
  put(rbox(1.82, 0.06, 1.62, 0.03, 0xCEDEF2), 0, 0.6, 0.26, bed);                 /* 시트 */
  const headboard = put(rbox(1.95, 1.15, 0.16, 0.08, 0x8FA6DA), 0, 0.75, -1.1, bed);   /* 헤드보드 */
  [-0.45, 0.45].forEach(x => put(rbox(0.72, 0.16, 0.42, 0.08, COL.white), x, 0.68, -0.4, bed));   /* 베개 */
  const blanket = put(rbox(1.84, 0.5, 1.0, 0.22, 0xCEDEF2), 0, 0.67, 0.85, bed);   /* 폭신한 이불: 평소엔 발치에 납작하게 개어 둠 */
  blanket.scale.set(1, 0.2, 0.36);
  bed.userData.paint = [headboard]; bed.userData.paint2 = [blanket];                 /* 색 바꾸기: 헤드보드 / 이불 */
  bed.traverse(o => { o.userData.bed = true; });
  /* 잠든 기운: 침대 옆 따뜻한 불빛 + 떠오르는 Z */
  const bedLamp = new THREE.PointLight(0xFFD9A0, 0, 6, 1.6); bedLamp.position.set(BED.x - 1.3, 2.2, BED.z - 0.6); scene.add(bedLamp);
  const zTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#5565AA'; g.font = '900 50px Nunito, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const zs = Array.from({ length: 6 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
    sp.visible = false; scene.add(sp); return { sp, life: 1, from: new V3() };
  });

  /* shelf above the TV */
  put(rbox(2.3, 0.12, 0.5, 0.05, COL.white), -2.0, 3.75, -4.75);
  [[-2.8, 0.42, COL.mintDeep], [-2.6, 0.5, COL.blushDeep], [-2.4, 0.38, COL.sky], [-2.22, 0.3, COL.butter]].forEach(b => put(rbox(0.16, b[1], 0.36, 0.04, b[2]), b[0], 3.81 + b[1] / 2, -4.75));
  put(sph(0.2, COL.mintDeep, null, 20), -1.3, 4.0, -4.75);
  put(cyl(0.15, 0.12, 0.2, COL.blush, null, 20), -1.3, 3.9, -4.75);

  /* 러그: 파스텔 노랑 */
  put(cyl(2.3, 2.3, 0.02, 0xFAEDB2, null, 64), 0.2, 0.07, 0.5).castShadow = false;
  const rugEdge = put(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.05, 10, 80), mat(COL.mint)), 0.2, 0.08, 0.5);
  rugEdge.rotation.x = Math.PI / 2; rugEdge.receiveShadow = true;

  /* plant: also the secret sprout, which grows in three stages and blooms */
  const plant = new THREE.Group(); plant.position.set(-3.9, 0, 3.8); scene.add(plant);
  plant.userData.paint = [put(cyl(0.38, 0.3, 0.62, COL.blush), 0, 0.37, 0, plant)];
  put(cyl(0.34, 0.34, 0.04, 0x8f7fa6, null, 24), 0, 0.67, 0, plant);
  const leafG = new THREE.Group(); leafG.position.y = 0.7; plant.add(leafG);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const leaf = put(sph(0.2, COL.mintDeep, null, 20), Math.cos(a) * 0.18, 0.32 + (i % 2) * 0.12, Math.sin(a) * 0.18, leafG);
    leaf.scale.set(0.7, 1.6, 0.7); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  const stem = put(cyl(0.032, 0.04, 1, COL.mintDeep, null, 12), 0, 0.7, 0, plant);
  const flowerHead = new THREE.Group(); plant.add(flowerHead);
  flowerHead.rotation.set(0.35, Math.PI / 4, 0);
  const bud = put(sph(0.13, COL.butter, { emissive: 0xFFE27A, emissiveIntensity: 0.25 }, 16), 0, 0, 0, flowerHead);
  const petalRing = new THREE.Group(); flowerHead.add(petalRing);
  const petalCols = [COL.blush, COL.blushDeep, COL.blush, COL.lavDeep, COL.blush, COL.blushDeep, COL.blush, COL.sky];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, piv = new THREE.Group(); piv.rotation.z = a; petalRing.add(piv);
    const pt = put(sph(0.16, petalCols[i], { roughness: 0.6 }, 16), 0, 0.2, -0.02, piv); pt.scale.set(0.62, 1, 0.3);
  }
  const sprout = { g: { x: 0, v: 0 }, target: 0, stage: 0, bloom: { x: 0, v: 0, target: 0 } };
  function poseSprout(){
    const g = Math.max(0, sprout.g.x), b = Math.max(0, sprout.bloom.x);
    const H = 0.8 + g * 0.95;
    stem.scale.y = H; stem.position.y = 0.7 + H / 2;
    flowerHead.position.y = 0.7 + H;
    leafG.scale.set(1 + g * 0.3, 1 + g * 0.45, 1 + g * 0.3);
    bud.scale.setScalar(1 + g * 0.35 + b * 0.25);
    petalRing.scale.setScalar(Math.max(0.001, b));
    petalRing.visible = b > 0.002;
  }
  poseSprout();

  /* 물 주기: 물뿌리개(평소엔 숨김)와 물방울 */
  const can = new THREE.Group(); can.visible = false; scene.add(can);
  {
    const body = put(cyl(0.085, 0.095, 0.15, 0x9FD8FF, null, 20), 0, 0, 0, can);
    body.castShadow = false;
    put(cyl(0.087, 0.087, 0.02, 0xFFFFFF, null, 20), 0, 0.075, 0, can);
    const sp = put(cyl(0.014, 0.022, 0.2, 0x9FD8FF, null, 10), 0, 0.03, 0.14, can); sp.rotation.x = 1.0;   /* 주둥이 */
    put(sph(0.026, 0xFFFFFF, null, 10), 0, 0.09, 0.22, can);
    const hd = put(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), mat(0x9FD8FF)), 0, 0.07, -0.08, can); hd.rotation.y = Math.PI / 2;
  }
  const CAN_TIP = new V3(0, 0.09, 0.23);
  const waterDrops = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), mat(0x9FD8FF, { transparent: true, emissive: 0x9FD8FF, emissiveIntensity: 0.3, roughness: 0.2 }));
    m.scale.set(0.8, 1.3, 0.8); m.visible = false; scene.add(m);
    return { m, vel: new V3(), alive: false };
  });

  /* ---------- 가구: 소파 · 식탁(2인) · 주방 · 냉장고 · 스탠드 조명 ----------
     userData.paint = 가구 배치 편집의 '색 바꾸기'로 색이 바뀌는 주요 부분 */
  const SOFA = { x: -4.45, z: -1.2 };
  const sofa = new THREE.Group(); sofa.position.set(SOFA.x, FLOOR, SOFA.z); scene.add(sofa);
  {
    const g = sofa;
    const body = 0x8FA6DA, cushion = 0xB9C8EA;
    [[-0.35, -1.0], [0.35, -1.0], [-0.35, 1.0], [0.35, 1.0]].forEach(q => put(cyl(0.05, 0.04, 0.12, 0xE9E4D8, null, 10), q[0], 0.06, q[1], g));
    g.userData.paint = [
      put(rbox(0.95, 0.36, 2.2, 0.12, body), 0, 0.3, 0, g),                          /* 바닥 */
      put(rbox(0.28, 0.75, 2.2, 0.12, body), -0.34, 0.75, 0, g)                       /* 등받이 */
    ];
    [-1, 1].forEach(sd => g.userData.paint.push(put(rbox(0.95, 0.5, 0.24, 0.1, body), 0, 0.5, sd * 0.98, g)));   /* 팔걸이 */
    [-0.47, 0.47].forEach(z => put(rbox(0.66, 0.16, 0.9, 0.07, cushion), 0.1, 0.55, z, g));   /* 방석 */
    const pil = put(rbox(0.14, 0.4, 0.4, 0.08, 0xF2E6A0), -0.13, 0.82, -0.55, g); pil.rotation.z = -0.25;   /* 노란 쿠션 */
    const pil2 = put(rbox(0.14, 0.38, 0.38, 0.08, 0x5565AA), -0.13, 0.8, 0.6, g); pil2.rotation.set(0, 0.2, -0.25);   /* 파란 쿠션 */
  }
  /* 2인용 식탁 + 의자 2개 (서로 마주 봄). 누르면 둘이 앉음 */
  const TABLE = { x: -1.3, z: 3.45 };
  const table = new THREE.Group(); table.position.set(TABLE.x, FLOOR, TABLE.z); scene.add(table);
  {
    const g = table, wood = 0xF3EFE6, chairCol = 0x8FA6DA;
    const top = put(rbox(1.0, 0.07, 0.78, 0.04, wood), 0, 0.74, 0, g);                 /* 상판 */
    [[-0.42, -0.31], [0.42, -0.31], [-0.42, 0.31], [0.42, 0.31]].forEach(q => put(cyl(0.035, 0.03, 0.7, wood, null, 10), q[0], 0.36, q[1], g));
    put(rbox(0.3, 0.008, 0.74, 0.004, 0xFFD1DC), 0, 0.779, 0, g);                      /* 가운데 분홍 러너 */
    /* 접시 · 컵 (각자 자리 앞) */
    [-1, 1].forEach(sd => {
      put(cyl(0.15, 0.12, 0.022, COL.white, null, 28), sd * 0.27, 0.79, 0, g);
      put(cyl(0.1, 0.1, 0.006, 0xF6F1FF, null, 24), sd * 0.27, 0.803, 0, g);
      put(cyl(0.045, 0.04, 0.1, sd < 0 ? 0xF2E6A0 : 0xDDE3F5, null, 16), sd * 0.3, 0.83, sd * -0.24, g);   /* 컵: HO1 노랑, HO2 파랑 */
      put(sph(0.028, 0xFFC3D3, null, 10), sd * 0.27, 0.82, 0.02, g);                   /* 접시 위 딸기 */
    });
    put(cyl(0.035, 0.045, 0.12, 0xC8E6C9, null, 14), 0, 0.84, 0.18, g);              /* 작은 꽃병 */
    put(sph(0.045, 0xFFC3D3, null, 12), 0, 0.93, 0.18, g);
    /* 의자: 식탁 양쪽, 등받이는 바깥 */
    const chairs = [-1, 1].map(sd => {
      const ch = new THREE.Group(); ch.position.set(sd * 0.82, 0, 0); g.add(ch);
      const seatM = put(rbox(0.46, 0.07, 0.46, 0.04, chairCol), 0, 0.45, 0, ch);
      const back = put(rbox(0.07, 0.5, 0.46, 0.04, chairCol), sd * 0.2, 0.74, 0, ch);
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(q => put(cyl(0.025, 0.025, 0.42, 0xE9E4D8, null, 8), q[0], 0.21, q[1], ch));
      return [seatM, back];
    });
    g.userData.paint = [top];
    g.userData.paint2 = chairs.flat();                                                 /* 의자도 같이 바꿀 수 있게 */
  }
  table.scale.setScalar(1.3);                                                          /* 캐릭터 크기에 맞게 */

  /* 욕조: 누르면 HO1·HO2가 같이 들어가 마주 보고 씻음 (거품·비눗방울·고무 오리). 아무 데나 누르면 나옴 */
  const BATH = { x: -1.5, z: 3.7 };
  const bath = new THREE.Group(); bath.position.set(BATH.x, FLOOR, BATH.z); scene.add(bath);
  const bathFoam = [], bathBubbles = [];
  let bathWater, bathDuck;
  {
    const g = bath, shell = 0xFFFFFF, gold = 0xF2D27A, L = 1.9, W = 1.08, H = 0.62, T = 0.1;
    const walls = [
      put(rbox(L, H, T, 0.05, shell), 0, H / 2 + 0.12, -W / 2 + T / 2, g),
      put(rbox(L, H, T, 0.05, shell), 0, H / 2 + 0.12, W / 2 - T / 2, g),
      put(rbox(T, H, W, 0.05, shell), -L / 2 + T / 2, H / 2 + 0.12, 0, g),
      put(rbox(T, H, W, 0.05, shell), L / 2 - T / 2, H / 2 + 0.12, 0, g),
      put(rbox(L, 0.1, W, 0.05, shell), 0, 0.17, 0, g)                                 /* 바닥 */
    ];
    put(rbox(L + 0.06, 0.06, 0.12, 0.03, 0xFFD1DC), 0, H + 0.12, -W / 2 + T / 2, g);   /* 분홍 테두리 */
    put(rbox(L + 0.06, 0.06, 0.12, 0.03, 0xFFD1DC), 0, H + 0.12, W / 2 - T / 2, g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => put(sph(0.08, gold, { metalness: 0.3, roughness: 0.4 }, 14), q[0] * (L / 2 - 0.18), 0.08, q[1] * (W / 2 - 0.15), g));   /* 금빛 발 */
    /* 수도꼭지 (HO2 쪽 끝 벽 위) */
    const chrome = { metalness: 0.5, roughness: 0.3 };
    put(cyl(0.035, 0.035, 0.3, 0xD7DCE6, chrome, 12), L / 2 - 0.05, H + 0.27, 0, g).castShadow = false;
    const spout = put(cyl(0.03, 0.03, 0.22, 0xD7DCE6, chrome, 12), L / 2 - 0.15, H + 0.4, 0, g); spout.rotation.z = Math.PI / 2;
    [-0.1, 0.1].forEach(z => put(sph(0.05, z < 0 ? 0xF2E6A0 : 0x9FD8FF, null, 12), L / 2 - 0.05, H + 0.35, z, g));   /* 손잡이: 노랑·파랑 */
    /* 물: 반투명 하늘색 (몸이 물에 잠겨 보이게) */
    bathWater = put(rbox(L - 0.18, 0.05, W - 0.18, 0.02, 0x9FD8FF, { transparent: true, opacity: 0.72, emissive: 0x9FD8FF, emissiveIntensity: 0.25, roughness: 0.15 }), 0, 0.52, 0, g);
    bathWater.castShadow = false;
    /* 거품: 들어가면 부풀어 오름 */
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399, r = 0.25 + (i % 5) * 0.08;
      const f = put(sph(0.09 + (i % 3) * 0.035, COL.white, { roughness: 0.55, emissive: 0xFFFFFF, emissiveIntensity: 0.15 }, 14),
        clamp(Math.cos(a) * r * 1.9, -L / 2 + 0.2, L / 2 - 0.2), 0.57, clamp(Math.sin(a) * r, -W / 2 + 0.18, W / 2 - 0.18), g);
      f.castShadow = false; f.scale.setScalar(0.001); f.visible = false; f.userData.seed = i;
      bathFoam.push(f);
    }
    /* 고무 오리 */
    bathDuck = new THREE.Group(); bathDuck.position.set(0, 0.56, 0.18); g.add(bathDuck);
    const db = put(sph(0.1, 0xFFE27A, null, 18), 0, 0.03, 0, bathDuck); db.scale.set(1.25, 0.8, 1);
    put(sph(0.065, 0xFFE27A, null, 16), 0.07, 0.12, 0, bathDuck);
    const beak = put(sph(0.03, 0xF4A04A, null, 10), 0.13, 0.11, 0, bathDuck); beak.scale.set(1.4, 0.6, 1);
    [-1, 1].forEach(sd => put(sph(0.012, COL.ink, null, 8), 0.115, 0.14, sd * 0.035, bathDuck));
    bathDuck.rotation.y = -0.6;
    g.userData.paint = walls;
  }
  bath.scale.setScalar(1.2);
  bathDuck.traverse(o => { o.userData.duck = true; });   /* 욕조 안에서 오리만 따로 누를 수 있게 */
  /* 물장구 물방울 (욕조 안에서 HO1을 누르면 서로 물을 튀김) */
  const bathSplash = Array.from({ length: 24 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x9FD8FF, { transparent: true, opacity: 0.85, emissive: 0x9FD8FF, emissiveIntensity: 0.35, roughness: 0.15 }));
    m.visible = false; m.castShadow = false; scene.add(m);
    return { m, vel: new V3(), alive: false, life: 0 };
  });
  /* 떠오르는 비눗방울 */
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), mat(0xE8F6FF, { transparent: true, opacity: 0.55, emissive: 0xBFE6FF, emissiveIntensity: 0.4, roughness: 0.1 }));
    m.visible = false; m.castShadow = false; scene.add(m);
    bathBubbles.push({ m, life: 0, max: 2, alive: false, vel: new V3(), sz: 1 });
  }

  /* 작은 주방: 싱크대 + 가스레인지(조리대). 뒷벽 TV와 서랍장 사이 */
  const KITCHEN = { x: -0.22, z: -4.56 };
  const kitchen = new THREE.Group(); kitchen.position.set(KITCHEN.x, FLOOR, KITCHEN.z); scene.add(kitchen);
  let ovenPivot, ovenGlass, ovenInner;                                                 /* 쿠키 굽기에서 씀 */
  {
    const g = kitchen, base = 0xF4F1FA;
    const body = put(rbox(1.08, 0.84, 0.62, 0.05, base), 0, 0.44, 0, g);               /* 아래 수납장 */
    put(rbox(0.49, 0.66, 0.02, 0.02, 0xFFFFFF), -0.265, 0.46, 0.312, g);                 /* 왼쪽: 수납장 문 */
    put(cyl(0.016, 0.016, 0.12, 0xB9B1F0, null, 8), -0.06, 0.62, 0.33, g);
    /* 오른쪽: 오븐 (문은 아래 경첩 기준으로 앞으로 열림, 안이 주황색으로 빛남) */
    ovenInner = put(rbox(0.44, 0.5, 0.02, 0.02, 0x2A2530, { emissive: 0xFF8A3D, emissiveIntensity: 0 }), 0.265, 0.42, 0.302, g);
    ovenPivot = new THREE.Group(); ovenPivot.position.set(0.265, 0.13, 0.318); g.add(ovenPivot);
    put(rbox(0.48, 0.6, 0.03, 0.02, 0xFFFFFF), 0, 0.3, 0.0, ovenPivot);
    ovenGlass = put(rbox(0.32, 0.2, 0.012, 0.01, 0x3A3340, { emissive: 0xFF8A3D, emissiveIntensity: 0, roughness: 0.2 }), 0, 0.3, 0.018, ovenPivot);
    const oh = put(cyl(0.014, 0.014, 0.3, 0xB9B1F0, null, 8), 0, 0.53, 0.04, ovenPivot); oh.rotation.z = Math.PI / 2;
    put(rbox(1.14, 0.06, 0.68, 0.025, 0xF7F3EA), 0, 0.89, 0.01, g);                     /* 상판 */
    /* 싱크대 (왼쪽) */
    put(rbox(0.42, 0.03, 0.36, 0.02, 0xA9B4C8, { metalness: 0.4, roughness: 0.35 }), -0.27, 0.915, 0.04, g);
    put(rbox(0.34, 0.02, 0.28, 0.02, 0x7E899E, { metalness: 0.4, roughness: 0.35 }), -0.27, 0.925, 0.04, g);
    put(cyl(0.018, 0.022, 0.24, 0xC9CFDA, { metalness: 0.5, roughness: 0.3 }, 10), -0.27, 1.04, -0.22, g);
    const spout = put(cyl(0.015, 0.015, 0.18, 0xC9CFDA, { metalness: 0.5, roughness: 0.3 }, 10), -0.27, 1.15, -0.14, g); spout.rotation.x = Math.PI / 2;
    put(cyl(0.02, 0.02, 0.05, 0xFFC3D3, null, 10), -0.17, 1.0, -0.22, g);             /* 손잡이 */
    /* 가스레인지 (오른쪽) */
    put(rbox(0.44, 0.02, 0.4, 0.015, 0x3A3A44), 0.27, 0.93, 0.03, g);
    [[0.17, -0.06], [0.37, 0.1]].forEach(([x, z]) => {
      const r = put(new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 24), mat(0x6B6B70)), x, 0.945, z, g); r.rotation.x = Math.PI / 2;
    });
    put(cyl(0.1, 0.09, 0.12, 0xFFD1DC, null, 24), 0.17, 1.01, -0.06, g);               /* 냄비 */
    put(cyl(0.1, 0.1, 0.015, 0xFFE3EB, null, 24), 0.17, 1.075, -0.06, g);
    put(sph(0.02, 0xFFFFFF, null, 8), 0.17, 1.09, -0.06, g);
    [0.18, 0.36].forEach(x => put(cyl(0.022, 0.022, 0.03, 0x3A3A44, null, 10), x, 0.8, 0.33, g).rotation.x = Math.PI / 2);   /* 불 조절 손잡이 */
    put(rbox(1.14, 0.42, 0.04, 0.02, 0xE4F7E8), 0, 1.13, -0.31, g);                    /* 벽 타일 */
    g.userData.paint = [body];
  }

  /* 냉장고: 누르면 문이 열리고 안에 술병·과일·식재료. 다시 누르면 닫힘 */
  const FRIDGE = { x: 0.72, z: -4.52 };
  const fridge = new THREE.Group(); fridge.position.set(FRIDGE.x, FLOOR, FRIDGE.z); scene.add(fridge);
  const fridgeDoor = { x: 0, v: 0, target: 0 };
  let fridgePivot, fridgeGlow;
  {
    const g = fridge, W = 0.78, H = 1.86, D = 0.68, col = 0xDDE3F5, lining = 0xFFFFFF;
    const paint = [];
    const y0 = 0.04;
    paint.push(put(rbox(W, H, 0.06, 0.03, col), 0, y0 + H / 2, -D / 2 + 0.03, g));            /* 뒤 */
    [-1, 1].forEach(sd => paint.push(put(rbox(0.06, H, D, 0.03, col), sd * (W / 2 - 0.03), y0 + H / 2, 0, g)));   /* 옆 */
    paint.push(put(rbox(W, 0.06, D, 0.03, col), 0, y0 + H - 0.03, 0, g));                    /* 위 */
    paint.push(put(rbox(W, 0.06, D, 0.03, col), 0, y0 + 0.03, 0, g));                        /* 아래 */
    fridgeGlow = put(rbox(W - 0.12, H - 0.14, 0.02, 0.01, lining, { emissive: 0xFFF6DD, emissiveIntensity: 0 }), 0, y0 + H / 2, -D / 2 + 0.07, g);   /* 안쪽 벽 (열리면 밝아짐) */
    put(rbox(W - 0.1, 0.04, D - 0.06, 0.015, lining), 0, 1.4, 0, g);                         /* 냉동칸 칸막이 */
    [0.6, 1.02].forEach(y => put(rbox(W - 0.12, 0.018, D - 0.1, 0.008, 0xE3F1FA, { transparent: true, opacity: 0.85 }), 0, y, 0, g));   /* 유리 선반 */
    put(rbox(W - 0.14, 0.24, D - 0.14, 0.03, 0xDFF3E4, { transparent: true, opacity: 0.7 }), 0, 0.2, 0.02, g);   /* 채소 칸 */
    /* 채소 칸: 당근 · 양상추 · 브로콜리 */
    const carrot = put(cyl(0.001, 0.03, 0.18, 0xF59A4A, null, 10), -0.18, 0.28, 0.05, g); carrot.rotation.z = 1.2;
    put(sph(0.016, 0x7FD498, null, 8), -0.1, 0.31, 0.05, g);
    put(sph(0.09, 0x9ED47F, null, 14), 0.05, 0.3, 0, g).scale.set(1, 0.8, 1);
    put(sph(0.05, 0x5DAE6B, null, 12), 0.2, 0.3, 0.06, g);
    /* 아래 칸: 달걀 판 · 우유 */
    put(rbox(0.3, 0.03, 0.18, 0.01, 0xF3E6C8), -0.12, 0.335, 0.08, g);
    for (let i = 0; i < 6; i++) { const e = put(sph(0.032, 0xFFF8EC, null, 12), -0.22 + (i % 3) * 0.1, 0.375, 0.04 + Math.floor(i / 3) * 0.08, g); e.scale.y = 1.25; }
    put(rbox(0.13, 0.2, 0.13, 0.015, 0xFFFFFF), 0.2, 0.43, -0.05, g);                         /* 우유팩 */
    put(rbox(0.135, 0.05, 0.135, 0.012, 0x9FD8FF), 0.2, 0.53, -0.05, g);
    put(rbox(0.06, 0.03, 0.01, 0.004, 0x5565AA), 0.2, 0.43, 0.018, g);
    /* 가운데 칸: 와인 · 맥주 */
    const wine = new THREE.Group(); wine.position.set(-0.2, 0.61, -0.04); g.add(wine);
    put(cyl(0.048, 0.048, 0.22, 0x2F5D3A, { roughness: 0.3 }, 16), 0, 0.11, 0, wine);
    put(cyl(0.018, 0.04, 0.06, 0x2F5D3A, { roughness: 0.3 }, 12), 0, 0.25, 0, wine);
    put(cyl(0.019, 0.019, 0.06, 0x2F5D3A, { roughness: 0.3 }, 10), 0, 0.31, 0, wine);
    put(cyl(0.021, 0.021, 0.04, 0x8E2F45, null, 10), 0, 0.345, 0, wine);
    put(rbox(0.07, 0.07, 0.01, 0.005, 0xF7F3EA), 0, 0.11, 0.048, wine);
    [0, 1].forEach(i => {
      const b = new THREE.Group(); b.position.set(0.05 + i * 0.11, 0.61, 0.02 - i * 0.06); g.add(b);
      put(cyl(0.035, 0.035, 0.15, 0x8A4B1E, { roughness: 0.3 }, 14), 0, 0.075, 0, b);
      put(cyl(0.014, 0.03, 0.05, 0x8A4B1E, { roughness: 0.3 }, 10), 0, 0.175, 0, b);
      put(cyl(0.016, 0.016, 0.02, 0xF2E6A0, null, 10), 0, 0.21, 0, b);
      put(rbox(0.05, 0.05, 0.01, 0.004, 0xF2E6A0), 0, 0.08, 0.035, b);
    });
    /* 위 칸: 과일 접시 (사과 · 귤 · 포도) */
    put(cyl(0.2, 0.16, 0.03, 0xFFFFFF, null, 24), 0, 1.04, 0.02, g);
    put(sph(0.06, 0xE5484D, null, 16), -0.1, 1.11, 0.03, g);
    put(cyl(0.006, 0.006, 0.03, 0x6B4A2E, null, 6), -0.1, 1.18, 0.03, g);
    [[0.02, -0.05], [0.07, 0.06], [-0.03, 0.1]].forEach(([x, z]) => put(sph(0.045, 0xF59A4A, null, 14), x, 1.1, z, g).scale.y = 0.85);
    [[0, 0], [0.035, 0], [-0.035, 0], [0.018, 0.03], [-0.018, 0.03], [0, 0.06], [0.018, -0.03], [-0.018, -0.03], [0, -0.06]].forEach(([dx, dz], i) => put(sph(0.022, 0x8B5FBF, null, 8), 0.13 + dx, 1.07 + (i < 3 ? 0.03 : 0), -0.05 + dz, g));
    /* 냉동칸: 아이스크림 통 */
    put(cyl(0.07, 0.06, 0.09, 0xFFE3EB, null, 16), -0.12, 1.47, 0, g);
    put(rbox(0.2, 0.06, 0.14, 0.01, 0xDFF3FF), 0.13, 1.45, 0.02, g);
    /* 문: 왼쪽 경첩 기준으로 회전 (열린 문이 카메라 쪽을 가리지 않게) */
    fridgePivot = new THREE.Group(); fridgePivot.position.set(-W / 2, 0, D / 2); g.add(fridgePivot);
    paint.push(put(rbox(W, H, 0.07, 0.04, col), W / 2, y0 + H / 2, 0.035, fridgePivot));
    put(rbox(W - 0.08, 0.012, 0.01, 0.004, 0xB9C3DE), W / 2, 1.4, 0.075, fridgePivot);       /* 냉동칸 줄 */
    put(rbox(0.04, 0.42, 0.05, 0.02, 0xFFFFFF), W - 0.1, 1.05, 0.09, fridgePivot);          /* 손잡이 */
    put(rbox(0.04, 0.22, 0.05, 0.02, 0xFFFFFF), W - 0.1, 1.6, 0.09, fridgePivot);
    put(rbox(W - 0.14, 0.012, 0.06, 0.004, 0xFFFFFF), W / 2, 0.8, -0.03, fridgePivot);    /* 문 안쪽 선반 */
    [[0.22, 0xFFC3D3], [0.36, 0x9FD8FF], [0.52, 0xF2E6A0]].forEach(([x, c]) => put(cyl(0.025, 0.025, 0.12, c, null, 10), x, 0.87, -0.03, fridgePivot));   /* 문 칸 음료 */
    put(sph(0.05, 0xFFC3D3, null, 12), 0.25, 1.65, 0.08, fridgePivot).scale.z = 0.3;          /* 하트 자석 */
    g.userData.paint = paint;
  }
  /* 스탠드 조명: 늘 은은하게 켜져 있고, 잘 때는 방의 주 조명이 됨 */
  const LAMP = { x: -4.45, z: 0.55 };
  const lamp = new THREE.Group(); lamp.position.set(LAMP.x, FLOOR, LAMP.z); scene.add(lamp);
  put(cyl(0.24, 0.26, 0.05, 0xE9E4D8, null, 24), 0, 0.03, 0, lamp);
  put(cyl(0.03, 0.03, 1.95, 0xE9E4D8, null, 10), 0, 1.0, 0, lamp);
  const lampShade = put(cyl(0.2, 0.34, 0.42, 0xF2E6A0, { emissive: 0xFFE9A8, emissiveIntensity: 0.35, side: THREE.DoubleSide }, 28), 0, 2.05, 0, lamp);
  lampShade.castShadow = false;
  const lampLight = new THREE.PointLight(0xFFE2A8, 0.6, 5.5, 1.6); lampLight.position.set(LAMP.x + 0.3, 1.85, LAMP.z); scene.add(lampLight);

  /* ---------- Section objects ---------- */
  const sections = {};
  function makeSection(id, group, anchor){
    group.userData.section = id;
    group.userData.anchor = anchor;
    group.userData.hover = { x: 0, v: 0, target: 0 };
    group.userData.mats = [];
    group.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) group.userData.mats.push(o.material); });
    group.userData.baseScale = group.scale.clone();
    sections[id] = group;
  }

  /* 01 TV */
  const tv = new THREE.Group(); tv.position.set(-2.0, FLOOR, -4.1); scene.add(tv);
  put(rbox(2.3, 0.72, 1.05, 0.22, COL.lavDeep), 0, 0.46, 0, tv);
  [[-0.95, -0.38], [0.95, -0.38], [-0.95, 0.38], [0.95, 0.38]].forEach(p => put(cyl(0.06, 0.05, 0.12, COL.white, null, 12), p[0], 0.06, p[1], tv));
  put(rbox(0.5, 0.08, 0.04, 0.02, COL.white), -0.5, 0.46, 0.53, tv);
  put(rbox(0.5, 0.08, 0.04, 0.02, COL.white), 0.5, 0.46, 0.53, tv);
  tv.userData.paint = [put(rbox(2.0, 1.5, 0.95, 0.3, COL.blush), 0, 1.58, 0, tv)];
  put(rbox(1.68, 1.18, 0.1, 0.12, COL.white), 0, 1.64, 0.44, tv);
  put(sph(0.05, COL.mintDeep, null, 12), -0.75, 0.93, 0.47, tv);
  put(sph(0.05, COL.lavDeep, null, 12), -0.6, 0.93, 0.47, tv);
  [[-0.3, 0.45, COL.mintDeep], [0.3, -0.45, COL.lavDeep]].forEach(a => {
    const piv = new THREE.Group(); piv.position.set(a[0], 2.3, 0); piv.rotation.z = a[1]; tv.add(piv);
    put(cyl(0.025, 0.025, 0.8, COL.ink, null, 8), 0, 0.4, 0, piv);
    put(sph(0.09, a[2], { emissive: a[2], emissiveIntensity: 0.4 }, 16), 0, 0.82, 0, piv);
  });
  /* the screen: an animated canvas */
  const SCW = 768, SCH = 522;
  const scCanvas = document.createElement('canvas'); scCanvas.width = SCW; scCanvas.height = SCH;
  const sg = scCanvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(scCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const screen = put(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.02), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })), 0, 1.64, 0.495, tv);
  const tvGlow = new THREE.PointLight(0xFFD1DC, 2.4, 5, 1.6); tvGlow.position.set(0, 1.64, 1.3); tv.add(tvGlow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xFFC2D2, transparent: true, opacity: 0.55, depthWrite: false }));
  halo.scale.set(4.2, 3.4, 1); halo.position.set(0, 1.64, -0.6); tv.add(halo);
  function star(x, y, r, a){
    sg.save(); sg.translate(x, y); sg.globalAlpha = a; sg.fillStyle = '#ffffff'; sg.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const an = i * Math.PI / 4; sg.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    sg.closePath(); sg.fill(); sg.restore();
  }
  /* TV 화면 그림: PL이 고른 그림(서버 settings 'tv_image')이 있으면 그 그림을, 없으면 원래 화면 */
  let tvImg = null;
  function setTvImage(url){
    if (!url) { tvImg = null; drawScreen(time); return; }
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { tvImg = im; drawScreen(time); };
    im.src = url;
  }
  function drawScreen(t){
    if (tvImg) {
      const ia = tvImg.naturalWidth / tvImg.naturalHeight, sa = SCW / SCH;
      const w = ia > sa ? SCH * ia : SCW, h = ia > sa ? SCH : SCW / ia;   /* 화면을 꽉 채우게 (넘치는 부분은 잘림) */
      sg.globalAlpha = 1; sg.fillStyle = '#fff'; sg.fillRect(0, 0, SCW, SCH);
      sg.drawImage(tvImg, (SCW - w) / 2, (SCH - h) / 2, w, h);
      sg.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 0; y < SCH; y += 5) sg.fillRect(0, y, SCW, 2);
      const vg2 = sg.createRadialGradient(SCW / 2, SCH / 2, SCH * 0.35, SCW / 2, SCH / 2, SCW * 0.62);
      vg2.addColorStop(0, 'rgba(255,255,255,0)'); vg2.addColorStop(1, 'rgba(196,191,239,0.25)');
      sg.fillStyle = vg2; sg.fillRect(0, 0, SCW, SCH);
      screenTex.needsUpdate = true;
      return;
    }
    const grd = sg.createLinearGradient(0, 0, SCW, SCH);
    grd.addColorStop(0, '#DCD7FF'); grd.addColorStop(0.5, '#FFBDD0'); grd.addColorStop(0.85, '#FFE9A8'); grd.addColorStop(1, '#AEEBB8');
    sg.globalAlpha = 1; sg.fillStyle = grd; sg.fillRect(0, 0, SCW, SCH);
    const still = reduced();
    for (let i = 0; i < 16; i++) {
      const x = (i * 131) % SCW + (still ? 0 : Math.sin(t * 0.4 + i) * 8);
      const y = (i * 79 + 40) % SCH + (still ? 0 : Math.cos(t * 0.3 + i * 2) * 6);
      star(x, y, 7 + (i % 3) * 4, still ? 0.7 : 0.45 + 0.45 * Math.abs(Math.sin(t * 1.3 + i)));
    }
    const cx = SCW * 0.7, cy = SCH * 0.5;
    sg.globalAlpha = 0.6; sg.fillStyle = '#ffffff';
    sg.beginPath(); sg.arc(cx, cy, 158, 0, Math.PI * 2); sg.fill();
    sg.globalAlpha = 1;
    const blink = !still && (t % 3.7) < 0.13 ? 0.12 : 1;
    sg.fillStyle = '#1F1B24';
    [-56, 56].forEach(dx => { sg.beginPath(); sg.ellipse(cx + dx, cy - 14, 17, 24 * blink, 0, 0, Math.PI * 2); sg.fill(); });
    if (blink > 0.5) { sg.fillStyle = '#ffffff'; [-56, 56].forEach(dx => { sg.beginPath(); sg.arc(cx + dx + 6, cy - 24, 6, 0, Math.PI * 2); sg.fill(); }); }
    sg.fillStyle = '#FF8FB3';
    [-100, 100].forEach(dx => { sg.beginPath(); sg.ellipse(cx + dx, cy + 26, 26, 15, 0, 0, Math.PI * 2); sg.fill(); });
    sg.strokeStyle = '#1F1B24'; sg.lineWidth = 7; sg.lineCap = 'round'; sg.lineJoin = 'round';
    sg.beginPath(); sg.moveTo(cx - 24, cy + 26); sg.quadraticCurveTo(cx - 12, cy + 44, cx, cy + 28); sg.quadraticCurveTo(cx + 12, cy + 44, cx + 24, cy + 26); sg.stroke();
    sg.fillStyle = '#1F1B24'; sg.beginPath(); sg.roundRect(34, 30, 104, 40, 20); sg.fill();
    sg.fillStyle = '#ffffff'; sg.font = '800 22px Nunito, Quicksand, sans-serif'; sg.textBaseline = 'middle'; sg.fillText('채널 1', 50, 51);
    sg.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 0; y < SCH; y += 5) sg.fillRect(0, y, SCW, 2);
    const vg = sg.createRadialGradient(SCW / 2, SCH / 2, SCH * 0.3, SCW / 2, SCH / 2, SCW * 0.62);
    vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(196,191,239,0.35)');
    sg.fillStyle = vg; sg.fillRect(0, 0, SCW, SCH);
    screenTex.needsUpdate = true;
  }
  drawScreen(0);
  makeSection('hero', tv, new V3(0, 2.72, 0.3));

  /* 02 Floating frame with the ripple plane */
  const frame = new THREE.Group(); frame.position.set(-4.3, 2.75, 1.55); frame.rotation.y = Math.PI / 2; scene.add(frame);
  put(rbox(2.5, 1.9, 0.18, 0.14, COL.lavDeep), 0, 0, 0, frame);
  put(rbox(2.28, 1.68, 0.2, 0.1, COL.white), 0, 0, 0.01, frame);
  put(sph(0.11, COL.blushDeep, null, 16), 0, 1.0, 0.1, frame);
  [-1, 1].forEach(s => { const l = put(sph(0.16, COL.blushDeep, null, 16), s * 0.2, 1.0, 0.08, frame); l.scale.set(1.35, 0.8, 0.55); l.rotation.z = s * 0.3; });
  const PW = 2.0, PH = 1.4;
  const rippleU = {
    uTime: { value: 0 }, uStart: { value: -10 }, uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uAmp: { value: 0.1 }, uIdle: { value: 1 },
    uTexA: { value: null }, uTexB: { value: null }, uHasA: { value: 0 }, uHasB: { value: 0 },
    uCoverA: { value: new THREE.Vector2(1, 1) }, uCoverB: { value: new THREE.Vector2(1, 1) }, uMix: { value: 0 }, uWipe: { value: new THREE.Vector2(0.5, 0.5) }
  };
  const rippleMat = new THREE.ShaderMaterial({
    uniforms: rippleU,
    vertexShader: `
      uniform float uTime; uniform float uStart; uniform vec2 uOrigin; uniform float uAmp; uniform float uIdle;
      varying vec2 vUv; varying float vWave;
      void main(){
        vUv = uv;
        vec3 p = position;
        float t = max(uTime - uStart, 0.0);
        float d = length((uv - uOrigin) * vec2(${(PW / PH).toFixed(3)}, 1.0));
        float front = t * 0.55;
        float env = exp(-t * 1.2) * (1.0 - smoothstep(front, front + 0.2, d));
        float w = sin(d * 30.0 - t * 16.0) * env * exp(-d * 1.6);
        float idle = sin(uv.x * 5.0 + uTime * 1.3) * sin(uv.y * 4.0 + uTime * 0.9) * uIdle;
        p.z += w * uAmp + (idle + 1.0) * 0.018;
        vWave = w + idle * 0.25;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTexA; uniform sampler2D uTexB; uniform float uHasA; uniform float uHasB;
      uniform vec2 uCoverA; uniform vec2 uCoverB; uniform float uMix; uniform vec2 uOrigin; uniform vec2 uWipe;
      varying vec2 vUv; varying float vWave;
      vec3 pastel(vec2 uv){
        vec3 a = vec3(0.902, 0.902, 0.980), b = vec3(1.0, 0.820, 0.863), c = vec3(0.784, 0.902, 0.788);
        vec3 col = mix(a, b, smoothstep(0.0, 0.8, uv.x + uv.y * 0.3));
        return mix(col, c, smoothstep(0.6, 1.2, uv.y + uv.x * 0.25));
      }
      vec3 cover(sampler2D t, vec2 uv, vec2 s){ return texture2D(t, (uv - 0.5) * s + 0.5).rgb; }
      void main(){
        vec2 dir = normalize(vUv - uOrigin + 1e-5);
        vec2 uv = clamp(vUv + dir * vWave * 0.022, 0.001, 0.999);
        vec3 A = mix(pastel(uv), cover(uTexA, uv, uCoverA), uHasA);
        vec3 B = mix(pastel(uv), cover(uTexB, uv, uCoverB), uHasB);
        float d = length((vUv - uWipe) * vec2(${(PW / PH).toFixed(3)}, 1.0));
        float r = uMix * 1.9;
        vec3 col = mix(B, A, smoothstep(r - 0.22, r, d));
        col += vWave * 0.2;
        col = mix(col, vec3(1.0, 0.82, 0.86), 0.05);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const picture = put(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH, 110, 77), rippleMat), 0, 0, 0.24, frame);
  makeSection('gallery', frame, new V3(0, 1.3, 0));

  /* 03 Cabinet with four drawers */
  const cab = new THREE.Group(); cab.position.set(2.3, FLOOR, -4.2); scene.add(cab);
  cab.userData.paint = [put(rbox(2.3, 2.4, 1.2, 0.2, COL.mint), 0, 1.3, 0, cab)];
  [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]].forEach(p => put(sph(0.08, COL.white, null, 12), p[0], 0.07, p[1], cab));
  const drawerCols = [COL.blush, COL.lav, COL.white, COL.blush];
  const drawers = drawerCols.map((c, i) => {
    const g = new THREE.Group(); g.position.set(0, 2.12 - i * 0.54, 0.52); cab.add(g);
    put(rbox(1.8, 0.38, 0.9, 0.05, COL.lavSoft), 0, -0.02, -0.42, g);
    put(sph(0.1, [COL.butter, COL.mintDeep, COL.sky, COL.blushDeep][i], { emissive: 0xffffff, emissiveIntensity: 0.1 }, 16), -0.4 + i * 0.25, 0.12, -0.15, g);
    put(rbox(1.96, 0.46, 0.14, 0.08, c), 0, 0, 0.08, g);
    put(sph(0.07, COL.white, null, 16), 0, 0, 0.18, g);
    return { g, out: { x: 0, v: 0 }, target: 0 };
  });
  put(cyl(0.22, 0.22, 0.38, COL.sky, null, 24), -0.6, 2.69, 0, cab);
  put(sph(0.22, COL.blushDeep, null, 24), -0.6, 2.88, 0, cab).scale.y = 0.45;
  put(cyl(0.05, 0.14, 0.26, COL.white, null, 16), 0.55, 2.63, 0, cab);
  put(sph(0.26, COL.butter, { emissive: 0xFFE27A, emissiveIntensity: 0.6 }, 24), 0.55, 2.95, 0, cab);
  makeSection('cabinet', cab, new V3(0, 3.35, 0.3));

  /* 04 우체통: 화분과 같은 분홍 기둥형 우체통. 둥근 지붕, 투입구, 흰 표지판 */
  const MAILRED = COL.blush;                       /* 화분 색과 같게 */
  const MAILDARK = 0xE9A2B4;                       /* 받침·띠용 조금 진한 분홍 */
  const mail = new THREE.Group(); mail.position.set(3.75, FLOOR, 2.9); mail.rotation.y = Math.PI / 4; mail.scale.setScalar(0.72); scene.add(mail);   /* 크기: 0.72배 */
  put(rbox(0.98, 0.12, 0.84, 0.04, MAILDARK), 0, 0.06, 0, mail);                       /* 받침 */
  put(rbox(0.86, 1.3, 0.72, 0.1, MAILRED), 0, 0.77, 0, mail);                           /* 몸통 */
  const roof = put(cyl(0.36, 0.36, 0.86, MAILRED, null, 32), 0, 1.42, 0, mail);        /* 둥근 지붕 */
  roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.88);
  put(rbox(0.9, 0.06, 0.76, 0.02, MAILDARK), 0, 1.4, 0, mail);                           /* 지붕 아래 띠 */
  put(rbox(0.5, 0.07, 0.05, 0.03, 0x6B3A48), 0, 1.2, 0.36, mail);                        /* 투입구 */
  put(rbox(0.56, 0.03, 0.06, 0.015, MAILDARK), 0, 1.255, 0.37, mail);                   /* 투입구 덮개 */
  put(rbox(0.44, 0.3, 0.02, 0.03, COL.white), 0, 0.82, 0.365, mail);                    /* 표지판 */
  /* 표지판 속 편지봉투 */
  put(rbox(0.22, 0.14, 0.01, 0.01, 0xFBE1E8), 0, 0.83, 0.378, mail);
  [-1, 1].forEach(sd => { const l = put(rbox(0.13, 0.015, 0.01, 0.004, COL.blushDeep), sd * 0.055, 0.865, 0.384, mail); l.rotation.z = sd * -0.55; });
  put(rbox(0.32, 0.05, 0.02, 0.01, MAILDARK), 0, 0.52, 0.365, mail);                    /* 수거 시간 칸 */
  const flag = new THREE.Group(); mail.add(flag);                                        /* (원래 깃발 자리: 비워 둠) */
  const flagS = { x: -1.45, v: 0, target: -1.45 };
  flag.rotation.x = flagS.x;
  makeSection('mail', mail, new V3(0, 2.0, 0));

  /* 05 키 큰 책장 = 기록장. 파란 책 = 명장면, 노란 책 = 주사위 명예의 전당 (누르면 그 탭으로)
     뒷벽 주방과 냉장고 사이 빈자리. TV 위 작은 선반은 장식 그대로 */
  const SHELF = { x: 0.45, z: -4.6 };
  const shelf = new THREE.Group(); shelf.position.set(SHELF.x, FLOOR, SHELF.z); scene.add(shelf);
  {
    const g = shelf, W = 0.98, H = 2.35, D = 0.42, wood = 0xF3EFE6, paint = [];
    [-1, 1].forEach(sd => paint.push(put(rbox(0.05, H, D, 0.02, wood), sd * (W / 2 - 0.025), H / 2, 0, g)));   /* 옆판 */
    paint.push(put(rbox(W + 0.06, 0.06, D + 0.04, 0.025, wood), 0, H + 0.01, 0, g));                      /* 윗판 */
    paint.push(put(rbox(W, 0.1, D, 0.02, wood), 0, 0.05, 0, g));                                          /* 받침 */
    put(rbox(W - 0.06, H - 0.1, 0.02, 0.01, 0xFFF8EE), 0, H / 2, -D / 2 + 0.02, g);                       /* 뒤판 */
    const SH = [0.1, 0.55, 1.0, 1.45, 1.9];                                                                /* 칸 바닥 높이 */
    SH.slice(1).forEach(y => paint.push(put(rbox(W - 0.08, 0.035, D - 0.04, 0.012, wood), 0, y - 0.0175, 0.01, g)));
    /* 책 한 줄: [폭, 높이, 색, 기울기] → 책등에 흰 띠. tag가 있으면 눌러서 그 탭으로 */
    const row = (y, books, tag, x0) => {
      let x = x0 == null ? -W / 2 + 0.07 : x0;
      books.forEach(([w, h, c, lean]) => {
        const b = new THREE.Group(); b.position.set(x + w / 2, y, 0.03); b.rotation.z = lean || 0; g.add(b);
        const m = put(rbox(w, h, 0.28, 0.012, c, { roughness: 0.6, emissive: c, emissiveIntensity: tag ? 0.12 : 0 }), 0, h / 2, 0, b);
        put(rbox(w + 0.002, 0.03, 0.01, 0.004, 0xFFFFFF), 0, h * 0.72, 0.141, b);
        put(rbox(w + 0.002, 0.015, 0.01, 0.004, 0xFFFFFF), 0, h * 0.25, 0.141, b);
        if (tag) b.traverse(o => { o.userData.recTab = tag; });
        x += w + 0.008 + (lean ? 0.02 : 0);
      });
    };
    const BLUE = [0x5565AA, 0x6F7FC4, 0x4A5A9E, 0x8796D6, 0x5565AA, 0x3F4E8C, 0x7383C8];
    const YEL = [0xF2E6A0, 0xE8D77A, 0xF7EDB8, 0xEBDB86, 0xF2E6A0, 0xF0E08E];
    /* 맨 위 칸: 장식 (화분 · 별 · 작은 책) */
    put(cyl(0.07, 0.06, 0.1, 0xFFD1DC, null, 16), -0.3, SH[4] + 0.05, 0.03, g);
    put(sph(0.08, 0x7FD498, null, 14), -0.3, SH[4] + 0.15, 0.03, g).scale.y = 1.2;
    const st = put(new THREE.Mesh(starGeo, mat(0xFFE27A, { emissive: 0xFFE27A, emissiveIntensity: 0.25 })), 0.02, SH[4] + 0.17, 0.03, g); st.scale.setScalar(0.32);
    row(SH[4], [[0.06, 0.26, 0xE6E6FA], [0.05, 0.3, 0xFFC3D3], [0.06, 0.24, 0xC8E6C9, -0.25]], null, 0.16);
    /* 파란 책 = 명장면 */
    row(SH[3], BLUE.map((c, i) => [0.075 + (i % 3) * 0.01, 0.34 + (i % 4) * 0.025, c, i === 6 ? -0.22 : 0]), 'scenes');
    /* 노란 책 = 주사위 명예의 전당 + 작은 주사위 */
    row(SH[2], YEL.map((c, i) => [0.08 + (i % 2) * 0.012, 0.33 + (i % 3) * 0.03, c, i === 5 ? -0.2 : 0]), 'dice');
    const die = put(rbox(0.09, 0.09, 0.09, 0.018, 0xFFFFFF), 0.36, SH[2] + 0.045, 0.06, g); die.rotation.y = 0.5;
    [[0, 0.046, 0], [0.02, 0.046, 0.02], [-0.02, 0.046, -0.02]].forEach(([dx, dy, dz]) => put(sph(0.009, 0xE5484D, null, 8), dx, dy, dz, die));
    die.traverse(o => { o.userData.recTab = 'dice'; });
    /* 아래 칸들: 다른 색 장식 책 · 상자 · 바구니 */
    row(SH[1], [[0.07, 0.36, 0xFFC3D3], [0.06, 0.32, 0xC8E6C9], [0.08, 0.38, 0xE6E6FA], [0.06, 0.3, 0xFFD9B8], [0.07, 0.35, 0xB4E8BD, -0.18]]);
    put(rbox(0.22, 0.16, 0.24, 0.03, 0xCEDEF2), 0.3, SH[1] + 0.08, 0.02, g);
    put(rbox(0.38, 0.05, 0.26, 0.012, 0xFFE3EB), -0.18, SH[0] + 0.025, 0.03, g);                          /* 눕혀 둔 큰 책 */
    put(rbox(0.36, 0.05, 0.25, 0.012, 0xDEDAFB), -0.17, SH[0] + 0.075, 0.03, g).rotation.y = 0.08;
    put(cyl(0.15, 0.13, 0.22, 0xF2E6A0, null, 20), 0.27, SH[0] + 0.11, 0.03, g);                           /* 바구니 */
    put(sph(0.07, 0xFFFFFF, null, 12), 0.25, SH[0] + 0.22, 0.03, g);
    g.userData.paint = paint;
  }
  makeSection('records', shelf, new V3(0, 2.62, 0.1));

  /* ---------- 캐릭터 (원래 Mochi 토끼 자리) ---------- */
  /* ---------- 푸밤 캐릭터 (HO1·HO2 꼬마) ----------
     머리 큰 SD 체형: 둥근 머리 + 사다리꼴 몸통 + 발 두 개, 회색 외곽선.
     눈 깜빡임·걷기·점프는 원래 토끼 모션을 그대로 씀. */
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x6B6B70, side: THREE.BackSide });
  function outline(m, sx, sy, sz){
    const o = new THREE.Mesh(m.geometry, OUTLINE);
    o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    o.castShadow = false; o.receiveShadow = false;
    m.add(o); return o;
  }
  const SKIN = 0xFBE3D6;
  const FLUSH_COL = new THREE.Color(0xFF8F8F);   /* 목욕 오래 하면 볼 색 */
  /* 캐릭터별 색·머리 모양: 여기 숫자만 바꾸면 됨 */
  const CHARS = {
    ho1: { style: 'curly', hair: 0xF0E6A8, hairDark: 0xD5C47C,
           shirt: 0x3A3A44, collar: 0xF3F3F5, tie: 0x24242A,
           eyeIn: 0x5B6BD0, eyeInW: 0.07, eyeInH: 0.075, eyeInY: -0.04, eyeY: -0.09, cheek: 0xF3B8B2 },
    ho2: { style: 'bob', hair: 0x4F5D98, hairHi: 0x8C96C8, hairDark: 0x3E4A80,
           shirt: 0xE8E9EE, collar: 0x8E7E92, tie: 0x6E6074,
           eyeIn: 0x4F72D6, eyeInW: 0.085, eyeInH: 0.13, eyeInY: -0.015, eyeY: -0.1, cheek: 0xDDAA94,
           mole: [0.5, -0.16] }   /* 점: [옆 각도(+는 보는 사람 기준 오른쪽), 눈에서 아래로] */
  };
  const HR = 0.46, HY = 1.0;   /* 머리 반지름, 머리 높이 */
  /* 구 위의 한 점: th = 정수리에서 내려온 각도, ph = 정면(0)에서 돈 각도 */
  const onHead = (r, th, ph) => new V3(r * Math.sin(th) * Math.sin(ph), r * Math.cos(th), r * Math.sin(th) * Math.cos(ph));

  /* 머리카락 도우미: 구를 늘리고 접어서 가닥 끝이 있는 머리 껍데기를 만듦 */
  const tri = x => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);           /* 0~1 삼각파: 가닥 끝 모양 */
  const mix = (a, b, k) => a + (b - a) * k;
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };   /* 가닥마다 다른 길이 */
  /* 가닥 하나의 모양: w = 폭(라디안), p = 끝 뾰족함(클수록 뾰족). tip은 가닥 가운데 1, 사이 0 */
  const strand = (x, w, p) => { const n = x / w, i = Math.floor(n + 0.5), f = n - i; return { i, f, tip: Math.pow(Math.max(0, 1 - 2 * Math.abs(f)), p) }; };
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  function hairShell(o){
    /* 구의 위도(0~1)를 머리 끝선(limit)에 딱 맞게 늘려서, 가닥 끝이 계단 없이 매끈하게 떨어지도록 함.
       위도 0~E: 바깥 면 / E~1: 끝에서 둥글게 접혀 안쪽 면으로 올라감(두께감) */
    const g = new THREE.SphereGeometry(1, 256, 90);
    const pos = g.attributes.position, v = new V3();
    const cols = o.color ? new Float32Array(pos.count * 3) : null;
    const cl = o.color ? new THREE.Color(o.light) : null, cd = o.color ? new THREE.Color(o.dark) : null, tmpC = new THREE.Color();
    const E = 0.86, TH = HR * (o.thick || 0.08);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const u = Math.acos(clamp(v.y, -1, 1)) / Math.PI, ph = Math.atan2(v.x, v.z);
      const lim = o.limit(ph);
      let t, r, k = 0;
      if (u <= E) { t = u / E * lim; r = o.radius(t, ph); }
      else {
        k = (u - E) / (1 - E);
        const R = o.radius(lim, ph);
        if (k < 0.5) {                                                   /* 끝: 반원으로 둥글게 */
          const a = k / 0.5 * Math.PI;
          t = lim + (TH * 0.5 / R) * Math.sin(a);
          r = R - TH * 0.5 * (1 - Math.cos(a));
        } else {                                                         /* 안쪽 면: 조금 올라가서 끝 */
          t = lim - 0.3 * sstep(0.5, 1, k);
          r = o.radius(t, ph) - TH;
        }
      }
      const p = onHead(r, t, ph);
      pos.setXYZ(i, p.x, p.y * 1.03, p.z);
      if (cols) { tmpC.copy(cl).lerp(cd, mix(o.color(Math.min(t, lim), ph), 1, sstep(0.15, 0.6, k))); cols.set([tmpC.r, tmpC.g, tmpC.b], i * 3); }
    }
    if (cols) g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    /* 이음새 없이 매끈하게: 같은 자리 꼭짓점의 법선을 평균 */
    const nrm = g.attributes.normal, groups = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
      let e = groups.get(key); if (!e) { e = [0, 0, 0, []]; groups.set(key, e); }
      e[0] += nrm.getX(i); e[1] += nrm.getY(i); e[2] += nrm.getZ(i); e[3].push(i);
    }
    groups.forEach(e => { const l = Math.hypot(e[0], e[1], e[2]) || 1; e[3].forEach(i => nrm.setXYZ(i, e[0] / l, e[1] / l, e[2] / l)); });
    return shade(new THREE.Mesh(g, o.mat));
  }
  /* 머리 표면 위에 2D 선(pts)을 따라 말린 컬을 그림 */
  function curlTube(ph, th, pts, R, thick, material){
    const b = onHead(1, th, ph), right = new V3(Math.cos(ph), 0, -Math.sin(ph));
    const up = new V3(0, 1, 0).addScaledVector(b, -b.y).normalize();
    const path = pts.map(([x, y]) => b.clone().addScaledVector(right, x).addScaledVector(up, y).normalize().multiplyScalar(R));
    const curve = new THREE.CatmullRomCurve3(path);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, thick, 8, false), material);
  }
  /* 끝으로 갈수록 가늘어지는 컬 + 같은 모양의 회색 외곽선. 머리 표면 위 2D 선(pts)을 따라감 */
  function curlLock(ph, th, pts, R, r0, r1, material){
    const b = onHead(1, th, ph), right = new V3(Math.cos(ph), 0, -Math.sin(ph));
    const up = new V3(0, 1, 0).addScaledVector(b, -b.y).normalize();
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => b.clone().addScaledVector(right, x).addScaledVector(up, y).normalize().multiplyScalar(R)));
    const SEG = 40, RAD = 10, P = [], T = [];
    for (let i = 0; i <= SEG; i++) P.push(curve.getPoint(i / SEG));
    for (let i = 0; i <= SEG; i++) T.push(P[Math.min(i + 1, SEG)].clone().sub(P[Math.max(i - 1, 0)]).normalize());
    const build = extra => {
      const n = b.clone(); n.sub(T[0].clone().multiplyScalar(n.dot(T[0]))).normalize();
      const pos = [], idx = [];
      for (let i = 0; i <= SEG; i++) {
        const s = i / SEG, tt = T[i];
        n.sub(tt.clone().multiplyScalar(n.dot(tt))).normalize();
        const bn = new V3().crossVectors(tt, n);
        const rr = mix(r0, r1, Math.pow(s, 1.3)) * Math.min(1, 0.6 + s * 5) + extra;   /* 뿌리는 살짝 가늘게, 끝은 뾰족하게 */
        for (let j = 0; j <= RAD; j++) {
          const a = j / RAD * Math.PI * 2, cn = -Math.cos(a) * rr * 0.8, sb = Math.sin(a) * rr;   /* 살짝 납작한 단면 (three.js 관과 같은 면 방향) */
          pos.push(P[i].x + n.x * cn + bn.x * sb, P[i].y + n.y * cn + bn.y * sb, P[i].z + n.z * cn + bn.z * sb);
        }
      }
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, d = a + RAD + 1; idx.push(a, d, a + 1, d, d + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const m = new THREE.Mesh(build(0), material);
    const o = new THREE.Mesh(build(0.008), OUTLINE); o.castShadow = false; o.receiveShadow = false;
    m.add(o);
    return m;
  }

  /* 직모 가닥 단면: 가닥 가운데 1, 가닥 사이 0. 앞·옆·뒤 가닥 폭을 limit과 똑같이 맞춤 */
  /* HO2 가르마: 보는 사람 기준 오른쪽(+) 2:8. -0.45로 바꾸면 반대쪽 */
  const PART_PH = 0.45;
  const partSide = ph => (ph > PART_PH ? 1 : -1);
  /* 가르마에서 갈라져 내려오는 앞머리 결: 정수리 쪽은 가르마에 모이고, 끝은 그대로 */
  const sweepU = (t, ph) => ph + partSide(ph) * 0.32 * (1.3 - clamp(t, 0.3, 1.3));
  const partLine = (t, ph) => Math.exp(-Math.pow((ph - PART_PH) / 0.06, 2)) * sstep(0.25, 0.45, t) * (1 - sstep(1.15, 1.35, t));
  /* 직모 가닥 단면: 가닥 가운데 1, 가닥 사이 0 */
  function bobLocks(t, ph){
    const a = Math.abs(ph);
    const k1 = sstep(0.95, 1.25, a), k2 = sstep(2.1, 2.5, a);
    const pf = Math.cos(Math.PI * strand(sweepU(t, ph), 0.19, 1).f) * sstep(0.35, 0.8, t);
    const ps = Math.cos(Math.PI * strand(a, 0.23, 1).f) * sstep(0.75, 1.15, t);
    const pb = Math.cos(Math.PI * strand(a, 0.22, 1).f) * sstep(0.75, 1.15, t);
    return pf * (1 - k1) * (1 - k2) + ps * k1 * (1 - k2) + pb * k2;
  }
  function makeChibi(c, tag){
    const bunny = new THREE.Group(); scene.add(bunny);
    bunny.rotation.order = 'YXZ';                                  /* 눕기: 방향 먼저, 그다음 뒤로 젖힘 */
    const bob = new THREE.Group(); bunny.add(bob);
    const tilt = new THREE.Group(); bob.add(tilt);

    /* 몸통: 아래가 넓은 사다리꼴 */
    const body = put(cyl(0.19, 0.3, 0.52, c.shirt, null, 28), 0, 0.36, 0, tilt);
    outline(body, 1.09, 1.03, 1.09);
    /* 셔츠 깃과 넥타이 (몸통 앞면 기울기에 맞춤) */
    const slope = Math.atan2(0.11, 0.52);
    const collar = put(rbox(0.15, 0.13, 0.02, 0.008, c.collar), 0, 0.555, 0.205, tilt); collar.rotation.x = slope;
    const tie = put(rbox(0.055, 0.26, 0.02, 0.008, c.tie), 0, 0.43, 0.24, tilt); tie.rotation.x = slope;

    /* 머리 */
    const head = put(sph(HR, SKIN, null, 40), 0, HY, 0, tilt);
    outline(head, 1.05);

    /* 머리카락: 걸을 때 살짝 흔들리도록 그룹으로 묶음 */
    const hair = new THREE.Group(); hair.position.set(0, HY, 0); tilt.add(hair);
    hair.userData.side = 0;
    const hairMat = mat(c.hair, { roughness: 0.7, side: THREE.DoubleSide, emissive: c.hair, emissiveIntensity: 0.18 });

    if (c.style === 'bob') {
      /* 직모 2:8: 껍데기 하나에 다발 굴곡(가운데 볼록, 사이 홈)과 뾰족한 가닥 끝을 같이 새김.
         따로 떠 있는 얇은 리본 대신이라 외곽선이 끊기지 않고 깔끔함 */
      const shell = hairShell({
        thick: 0.07,
        limit(ph){
          const a = Math.abs(ph);
          const sF = strand(ph, 0.19, 1.5);
          let front = 1.43 + (0.1 + 0.05 * hash(sF.i + 101)) * sF.tip;           /* 앞머리: 눈 바로 위까지 */
          if (sF.i === 0) front += 0.15 * sF.tip;                                 /* 미간으로 내려오는 가닥 */
          front -= 0.1 * Math.exp(-Math.pow((ph - PART_PH) / 0.1, 2));             /* 가르마 자리 */
          const sS = strand(a, 0.23, 1.5), side = 1.72 + (0.1 + 0.05 * hash(sS.i + 61)) * sS.tip;
          const sB = strand(a, 0.22, 1.5), back = 1.94 + (0.08 + 0.04 * hash(sB.i + 81)) * sB.tip;
          return mix(mix(front, side, sstep(0.95, 1.25, a)), back, sstep(2.0, 2.4, a));
        },
        radius(t, ph){
          const a = Math.abs(ph);
          let r = HR * (1.075 + 0.04 * Math.sin(t));
          r += HR * 0.016 * bobLocks(t, ph) * (0.8 + 0.4 * hash(strand(sweepU(t, ph), 0.19, 1).i + 5));   /* 다발 볼록·홈 */
          r -= HR * 0.05 * partLine(t, ph);                                        /* 가르마 홈 */
          const fz = sstep(0.95, 1.25, t) * (1 - sstep(1.0, 1.3, a));            /* 앞머리는 이마에 붙게 (부드럽게) */
          r = mix(r, Math.max(r - HR * 0.03, HR * 1.07), fz);
          return r;
        },
        color(t, ph){
          const sheen = Math.exp(-Math.pow((t - 0.62) / 0.13, 2)) * (0.6 + 0.4 * Math.cos(ph));
          const nearPart = Math.exp(-Math.pow((ph - PART_PH) / 0.14, 2)) * sstep(0.15, 0.35, t) * (1 - sstep(1.1, 1.35, t));
          const groove = 0.5 - 0.5 * bobLocks(t, ph);
          return clamp(0.6 - 0.35 * sheen * (1 - groove) + 0.3 * groove + 0.2 * nearPart + 0.6 * partLine(t, ph), 0, 1);
        },
        mat: mat(0xffffff, { roughness: 0.9, side: THREE.DoubleSide, vertexColors: true, emissive: c.hair, emissiveIntensity: 0.04 }),
        light: c.hairHi, dark: c.hairDark
      });
      hair.add(shell); outline(shell, 1.03);

    } else {
      /* 곱슬: 크고 둥근 웨이브 덩어리. 정수리에서 흘러내리는 물결 결 + 가르마 양옆으로 늘어진 컬 다발,
         다발 끝은 말려 올라가고 눈썹~눈 위까지 덮음 */
      /* 5:5 가르마: 가운데(ph=0)에서 양쪽으로 갈라져 내려가는 결 */
      const midPart = (t, ph) => Math.exp(-Math.pow(ph / 0.06, 2)) * sstep(0.25, 0.45, t) * (1 - sstep(1.1, 1.3, t));
      const u5 = (t, ph) => ph + Math.sign(ph) * 0.3 * (1.3 - clamp(t, 0.3, 1.3));
      const ridge = (t, ph) => (0.45 * Math.sin(u5(t, ph) * 10 + 1.2 * Math.sin(t * 7)) + 0.55 * Math.sin(t * 11 + ph * 5) * Math.sin(ph * 9 - t * 4)) * sstep(0.2, 0.65, t);
      const limit1 = ph => {
        const a = Math.abs(ph);
        const s1 = strand(ph + 0.15, 0.3, 0.5), L1 = hash(s1.i + 7);
        const front = 1.38 + (0.13 + 0.06 * L1) * s1.tip - 0.08 * Math.exp(-Math.pow(ph / 0.11, 2));   /* 앞머리: 눈 바로 위까지 (가르마 자리는 살짝만 올라감) */
        const s2 = strand(a, 0.3, 0.5), L2 = hash(s2.i + 19);
        const side = 1.7 + (0.15 + 0.08 * L2) * s2.tip;
        const s3 = strand(a, 0.32, 0.6);
        const back = 1.92 + 0.08 * s3.tip;
        return mix(mix(front, side, sstep(0.9, 1.2, a)), back, sstep(2.0, 2.4, a));
      };
      const shell = hairShell({
        thick: 0.09,
        limit: limit1,
        radius(t, ph){
          const a = Math.abs(ph);
          let r = HR * (1.14 + 0.05 * Math.pow(Math.sin(t), 2) + 0.03 * ridge(t, ph));
          const fz = sstep(1.05, 1.3, t) * (1 - sstep(0.95, 1.25, a));
          r = mix(r, Math.max(r - HR * 0.03, HR * 1.1), fz);                     /* 앞 다발은 이마에 붙게 (부드럽게) */
          r -= HR * 0.05 * midPart(t, ph);                                       /* 가르마 홈 */
          return r;
        },
        color(t, ph){ return Math.max(0.85 * sstep(0.2, 0.9, 0.5 - 0.5 * ridge(t, ph)) * sstep(0.25, 0.7, t), midPart(t, ph)); },
        mat: mat(0xffffff, { roughness: 0.7, side: THREE.DoubleSide, vertexColors: true, emissive: c.hair, emissiveIntensity: 0.12 }),
        light: c.hair, dark: c.hairDark
      });
      hair.add(shell); outline(shell, 1.03);
      /* 다발 끝에서 바깥으로 말려 올라가는 컬: 끝이 가늘어지고 외곽선이 있어 깔끔하게 */
      const curlCol = new THREE.Color(c.hair).lerp(new THREE.Color(c.hairDark), 0.25).getHex();
      const curlMat = mat(curlCol, { roughness: 0.65, emissive: curlCol, emissiveIntensity: 0.14 });
      const hook = [[0, 0.05], [0, -0.01], [-0.012, -0.06], [-0.038, -0.092], [-0.07, -0.088], [-0.084, -0.06], [-0.072, -0.036]];
      /* 앞: 눈 바깥쪽 양옆에 하나씩 (가르마·눈 앞은 비움) */
      [-0.66, 0.66].forEach(ph => {
        const flip = ph < 0 ? 1 : -1;                                         /* 얼굴 바깥쪽으로 말림 */
        hair.add(shade(curlLock(ph, limit1(ph) - 0.1, hook.map(([x, y]) => [x * flip * 1.25, y * 1.25]), HR * 1.16, 0.034, 0.009, curlMat)));
      });
      /* 귀 옆·뒤: 조금 더 큰 컬 */
      [[-1.3, 1], [-1.75, 1], [1.3, -1], [1.75, -1], [2.55, 1], [-2.55, -1]].forEach(([ph, flip]) => {
        hair.add(shade(curlLock(ph, limit1(ph) - 0.1, hook.map(([x, y]) => [x * flip * 1.45, y * 1.45]), HR * 1.2, 0.036, 0.009, curlMat)));
      });
    }

    /* 눈: 회색 네모 + 파란 눈동자 (깜빡일 때 세로로 납작해짐) */
    const eyes = [-1, 1].map(s => {
      const a = s * 0.33, ey = c.eyeY == null ? -0.03 : c.eyeY, rr = Math.sqrt(HR * HR - ey * ey) - 0.005;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * rr, HY + ey, Math.cos(a) * rr); g.rotation.y = a; tilt.add(g);
      put(rbox(0.13, 0.19, 0.04, 0.025, 0x55555C, { roughness: 0.4 }), 0, 0, 0, g);
      put(rbox(c.eyeInW, c.eyeInH, 0.04, 0.02, c.eyeIn, { roughness: 0.35 }), 0, c.eyeInY, 0.012, g);
      return g;
    });

    /* 볼터치 */
    const cheeks = [-1, 1].map(s => {
      const a = s * 0.62, y = (c.eyeY == null ? -0.03 : c.eyeY) - 0.07, rr = Math.sqrt(HR * HR - y * y) - 0.02;
      const ch = put(sph(0.075, c.cheek, null, 16), Math.sin(a) * rr, HY + y, Math.cos(a) * rr, tilt);
      ch.rotation.y = a; ch.scale.set(1, 0.55, 0.35); return ch;
    });

    /* 눈 밑 점 */
    if (c.mole) {
      const y = (c.eyeY == null ? -0.03 : c.eyeY) + c.mole[1], a = c.mole[0], rr = Math.sqrt(HR * HR - y * y);
      put(sph(0.011, 0x3E3A46, { roughness: 0.5 }, 10), Math.sin(a) * rr, HY + y, Math.cos(a) * rr, tilt);
    }

    /* 쿠키 먹을 때 표정 (평소엔 숨김): smile = ^^ 눈 + 웃는 입, yuck = >< 눈 + 꼬불 입 + 땀
       얼굴 위 한 점(a = 좌우 각도, y = 높이)에 붙이는 도우미 */
    const ink = mat(0x3E3A46, { roughness: 0.5, emissive: 0x3E3A46, emissiveIntensity: 0.3 });
    const onFace = (a, y, out) => {
      const rr = Math.sqrt(HR * HR - y * y) + (out || 0.004), g = new THREE.Group();
      g.position.set(Math.sin(a) * rr, HY + y, Math.cos(a) * rr); g.rotation.y = a; tilt.add(g); g.visible = false; return g;
    };
    const ey0 = c.eyeY == null ? -0.03 : c.eyeY;
    const arc = (r, t) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20, Math.PI), ink);
    const happyEyes = [-1, 1].map(s => { const g = onFace(s * 0.33, ey0 - 0.02); g.add(arc(0.05, 0.016)); return g; });
    const yuckEyes = [-1, 1].map(s => {
      const g = onFace(s * 0.33, ey0 - 0.03), dir = -s;            /* 보는 쪽에서 > < 모양 (가운데를 향함) */
      [1, -1].forEach(up => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.022, 0.012, 1, 0.003), ink); b.position.set(0, up * 0.021, 0); b.rotation.z = -up * dir * 0.5; g.add(b); });
      return g;
    });
    const smile = onFace(0, ey0 - 0.17); { const m = arc(0.05, 0.014); m.rotation.z = Math.PI; smile.add(m); }
    const frown = onFace(0, ey0 - 0.18);
    [-1.5, -0.5, 0.5, 1.5].forEach((k, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.038, 0.014, 0.012, 1, 0.003), ink); b.position.set(k * 0.03, 0, 0); b.rotation.z = i % 2 ? -0.6 : 0.6; frown.add(b); });
    const sweat = put(sph(0.045, 0xA9D4F5, { roughness: 0.2, emissive: 0x7FB8E8, emissiveIntensity: 0.3 }, 14), -0.52, HY + 0.12, 0.22, tilt);
    sweat.scale.set(0.8, 1.3, 0.8); sweat.visible = false;
    /* 손에 든 쿠키 (입 앞, 한 입씩 작아짐) + 작은 손 */
    const snack = new THREE.Group(); snack.position.set(0.1, HY - 0.36, HR * 0.95); tilt.add(snack); snack.visible = false;
    const snackC = put(cyl(0.075, 0.075, 0.025, COL.white, { roughness: 0.85 }, 18), 0, 0.03, 0, snack); snackC.rotation.x = Math.PI / 2 - 0.35;
    put(sph(0.05, SKIN, null, 14), 0.02, -0.04, -0.01, snack);
    const faceFx = { happyEyes, yuckEyes, smile, frown, sweat, snack, snackC };

    /* 발: 흰 타원 + 외곽선 */
    const feet = [-1, 1].map(s => {
      const f = put(sph(0.11, COL.white, null, 16), s * 0.15, 0.06, 0.08, bunny);
      f.scale.set(1.15, 0.5, 1.4); outline(f, 1.18); return f;
    });

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1; scene.add(shadow);
    /* 목욕할 때만: 머리 위 접은 수건 + 거품 모자 (평소엔 숨김) */
    const towel = new THREE.Group(); towel.position.set(0, HY + 0.5, -0.03); towel.rotation.x = -0.12; tilt.add(towel); towel.visible = false;
    const towelCol = tag === 'bunny' ? 0xFFD1DC : 0xCFE6FF;
    put(rbox(0.38, 0.08, 0.27, 0.035, towelCol, { roughness: 0.95 }), 0, 0, 0, towel);
    put(rbox(0.3, 0.07, 0.21, 0.03, towelCol, { roughness: 0.95 }), 0, 0.065, 0, towel);
    put(rbox(0.385, 0.018, 0.04, 0.008, 0xFFFFFF, { roughness: 0.9 }), 0, 0.01, 0.1, towel);   /* 줄무늬 */
    const foamHat = new THREE.Group(); foamHat.position.set(0, HY + 0.62, -0.03); tilt.add(foamHat); foamHat.visible = false;
    [[0, 0, 0, 0.15], [-0.11, -0.03, 0.04, 0.1], [0.12, -0.02, -0.03, 0.11], [0.02, 0.15, 0, 0.1], [0.03, 0.26, 0.01, 0.06]].forEach(([x, y, z, r]) =>
      put(sph(r, COL.white, { roughness: 0.55, emissive: 0xFFFFFF, emissiveIntensity: 0.15 }, 16), x, y, z, foamHat));
    const bathWear = { body, collar, tie, towel, foamHat, cheeks, shirt: c.shirt, cheek: c.cheek };

    bunny.traverse(o => { o.userData[tag] = true; });
    /* ears 자리에 머리카락 그룹을 넣어 걸을 때 살짝 흔들리게 함 (sway = 흔들림 세기) */
    return { bunny, bob, tilt, head, ears: [hair], eyes, feet, shadow, sway: 0.14, faceFx, bathWear };
  }
  /* HO1: 조종하는 캐릭터 (노란 곱슬) */
  const B1 = makeChibi(CHARS.ho1, 'bunny');
  const { bunny, head, feet } = B1;
  /* HO2: HO1을 따라다니는 캐릭터 (파란 단발) */
  const B2 = makeChibi(CHARS.ho2, 'buddy');

  const bun = {
    pos: new V3(0.3, 0, 0.8), target: null, moving: false, phase: 0, gait: 0,
    face: 0.7, faceTarget: 0.7, idle: 0, lock: 0, jumpY: 0, jumpV: 0,
    squash: { x: 0, v: 0 }, ear: { x: 0, v: 0 }, onArrive: null, faceAfter: null, stuck: 0, blinkT: 2.5, pendingOpen: null
  };
  /* HO2 토끼 상태: HO1 옆을 따라다니고, HO1이 뛰면 조금 늦게 같이 뜀 */
  const bun2 = {
    pos: new V3(-0.7, 0, 1.5), moving: false, phase: 0, gait: 0,
    face: 0.7, faceTarget: 0.7, idle: 0, jumpY: 0, jumpV: 0,
    squash: { x: 0, v: 0 }, ear: { x: 0, v: 0 }, blinkT: 1.3, hopDelay: 0, hopV: 0, breathSeed: 1.7
  };
  const FOLLOW_FAR = 1.45, FOLLOW_STOP = 1.08, PERSONAL = 0.98;
  /* 잠자기: k = 0(깨어 있음) ~ 1(침대에 누움) */
  const sleep = { on: false, k: 0, zT: 0, zi: 0 };
  const BED_SIDE = [new V3(BED.x - 1.45, 0, BED.z + 0.55), new V3(BED.x - 1.4, 0, BED.z - 0.55)];
  bun.bedSlot = new V3(BED.x - 0.47, 0.98, BED.z + 0.85);
  bun2.bedSlot = new V3(BED.x + 0.47, 0.98, BED.z + 0.85);
  function goSleep(){
    if (sleep.on || Bus.mode !== 'room' || fl.active) return;
    walkTo(BED_SIDE[0].x, BED_SIDE[0].z, Math.PI / 2 + bedYaw, () => { sleep.on = true; Bus.audio.hop(); });
  }
  function wakeUp(){
    if (!sleep.on) return;
    sleep.on = false;
    bun.pos.copy(BED_SIDE[0]); bun2.pos.copy(BED_SIDE[1]);
    bun.target = null; bun.moving = false; bun.idle = 0; bun2.idle = 0; bun2.moving = false;
    Bus.audio.hop();
  }
  /* 앉기: 소파(나란히) · 식탁(마주 봄). 잠자기와 같은 방식: k = 0(서 있음) ~ 1(앉음)
     자리 좌표는 가구 기준으로 만들어 두고, 가구를 옮기면 같이 따라감(아래 movable) */
  const seat = { on: false, k: 0, where: null };
  const wpos = (g, x, y, z) => { g.updateMatrixWorld(true); return g.localToWorld(new V3(x, y, z)); };
  const SEATS = {
    sofa: {
      slots: [wpos(sofa, 0.12, 0.56, -0.47), wpos(sofa, 0.12, 0.56, 0.47)], yaw: [Math.PI / 2, Math.PI / 2],
      stand: [wpos(sofa, 1.15, 0, -0.5), wpos(sofa, 1.15, 0, 0.6)]
    },
    table: {
      slots: [wpos(table, -0.82, 0.43, 0), wpos(table, 0.82, 0.43, 0)], yaw: [Math.PI / 2, -Math.PI / 2],
      stand: [wpos(table, -0.85, 0, -0.9), wpos(table, 0.85, 0, -0.9)]   /* 러그 쪽(열린 쪽)에서 다가감 */
    },
    bath: {   /* 욕조 양 끝에 마주 보고 앉음 (HO1 = 왼쪽, HO2 = 수도꼭지 쪽) */
      slots: [wpos(bath, -0.5, 0.2, 0), wpos(bath, 0.5, 0.2, 0)], yaw: [Math.PI / 2, -Math.PI / 2],
      stand: [wpos(bath, -0.45, 0, 1.05), wpos(bath, 0.45, 0, 1.05)]   /* 앞(방 쪽 긴 면)에서 다가감 */
    }
  };
  const bathFx = { k: 0, bubT: 0, talkT: 0, talk: 0, q: [], t: 0, soak: 0, hot: false, was: false, water: -1, foam: 0, duck: { y: 0, v: 0, spin: 0 } };
  const BATH_TEXT = [['따끈따끈~', '♨'], ['개운하다!', '♥'], ['거품 봐!', '…후우.'], ['노래 부를까?', '♪'], ['오리 귀엽지?', '네.'], ['여기가 천국이야~', '…좋네요.']];
  const BATH_WATER = [['보글보글~', '♪'], ['거품 더 넣을까?', '이미 많은데요.'], ['비눗방울 크다!', '…예쁘네요.'], ['후~ 불어 볼래?', '후.']];
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  /* 욕조 반응: 순서대로 일어날 일을 줄 세워 두고(q) stepBath에서 시간 맞춰 실행. 나오면 다 취소 */
  const bathSaid = new Set();
  function bsay(who, text, cls, secs){ bathSaid.add(text); say(who, text, cls, secs); }
  function bathLater(sec, fn){ bathFx.q.push({ at: bathFx.t + sec, fn }); }
  const bathBusy = () => bathFx.q.length > 0;
  const headOf = s => (s === bun ? B1 : B2).head.getWorldPosition(new V3());
  function bubbleBurst(at, n){
    for (let i = 0; i < n; i++) {
      const b = bathBubbles.find(x => !x.alive); if (!b) break;
      b.alive = true; b.life = 0; b.max = 1.4 + Math.random() * 1.2; b.sz = 0.7 + Math.random() * 1.1;
      b.m.position.copy(at).add(new V3((Math.random() - 0.5) * 0.4, Math.random() * 0.1, (Math.random() - 0.5) * 0.4));
      b.vel.set((Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
      b.m.visible = true;
    }
  }
  /* from이 to 얼굴 쪽으로 물을 튀김 (포물선) */
  function splashAt(from, to){
    const a = headOf(from), b = headOf(to), G = 7;
    a.y -= 0.4;
    for (let i = 0; i < (reduced() ? 4 : 9); i++) {
      const d = bathSplash.find(x => !x.alive); if (!d) break;
      d.alive = true; d.life = 0; d.m.visible = true; d.m.scale.setScalar(0.7 + Math.random() * 0.6);
      d.m.position.copy(a).add(new V3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25));
      const tt = 0.5 * (0.85 + Math.random() * 0.3);
      d.vel.set((b.x + (Math.random() - 0.5) * 0.35 - d.m.position.x) / tt,
                (b.y + (Math.random() - 0.4) * 0.3 - d.m.position.y + 0.5 * G * tt * tt) / tt,
                (b.z + (Math.random() - 0.5) * 0.35 - d.m.position.z) / tt);
    }
  }
  const shake = (s, k) => { fxOf(s).shiver = reduced() ? 0.2 : k; };
  /* HO1 누름: 물장구 → HO2가 맞고 반격 */
  function bathSplashFight(){
    bun.expr = 'smile'; bsay('ho1', pickOne(['에잇!', '물 공격~!', '받아라!']), 'ok', 1.4);
    splashAt(bun, bun2); Bus.audio.drop(1); bun.squash.v -= 2;
    bathLater(0.55, () => { bun2.expr = 'yuck'; shake(bun2, 0.6); bsay('ho2', '…!', 'emo', 1.1); });
    bathLater(1.5, () => { bun2.expr = 'smile'; splashAt(bun2, bun); Bus.audio.drop(2); bun2.squash.v -= 2; bsay('ho2', pickOne(['반격입니다.', '받으세요.', '두 배로 돌려드릴게요.']), 'emo', 1.3); });
    bathLater(2.05, () => { bun.expr = 'yuck'; shake(bun, 0.6); bsay('ho1', '으앗, 차가워!', 'bad', 1.5); });
    bathLater(3.3, () => { bun.expr = 'smile'; spawnHearts(1); bsay('ho1', '하하하!', 'ok', 1.4); });
    bathLater(4.4, () => { bun.expr = null; bun2.expr = null; });
  }
  /* HO2 누름: 거품 모자. 없음 → HO1 머리에 → HO2 머리에 → HO2가 털어냄 (돌아가며) */
  function bathFoamHat(){
    const st = bathFx.foam; bathFx.foam = (st + 1) % 3;
    if (st === 0) {
      bun2.expr = 'smile'; bsay('ho2', '가만히 계세요.', 'emo', 1.4); Bus.audio.poof();
      bathLater(0.5, () => { bun.foamOn = true; bubbleBurst(headOf(bun).add(new V3(0, 0.55, 0)), 4); Bus.audio.chime(); });
      bathLater(1.3, () => { bun.expr = 'smile'; bsay('ho1', '이게 뭐야~?', 'ok', 1.5); });
      bathLater(2.4, () => { spawnHearts(1, 'ho2'); bsay('ho2', '잘 어울리세요.', 'emo', 1.5); });
      bathLater(3.6, () => { bun.expr = null; bun2.expr = null; });
    } else if (st === 1) {
      bun.expr = 'smile'; bsay('ho1', '나도 해 줄게!', 'ok', 1.4); Bus.audio.poof();
      bathLater(0.5, () => { bun.foamOn = false; bun2.foamOn = true; bubbleBurst(headOf(bun2).add(new V3(0, 0.55, 0)), 4); Bus.audio.chime(); });
      bathLater(1.3, () => { bun2.expr = 'yuck'; bsay('ho2', '…….', 'emo', 1.4); });
      bathLater(2.5, () => { bun2.expr = null; spawnHearts(2); bsay('ho1', '똑같아졌다!', 'ok', 1.5); });
      bathLater(3.6, () => { bun.expr = null; });
    } else {
      shake(bun2, 0.8); bsay('ho2', '(부르르)', 'emo', 1.3);
      bathLater(0.5, () => { bun2.foamOn = false; bubbleBurst(headOf(bun2).add(new V3(0, 0.5, 0)), 7); Bus.audio.poof(); });
      bathLater(1.3, () => { bun.expr = 'yuck'; bsay('ho1', '아깝다~', 'bad', 1.4); });
      bathLater(2.6, () => { bun.expr = null; });
    }
  }
  /* 오리 누름: 폴짝 뛰며 한 바퀴 + 꽥 */
  function bathDuckSqueak(){
    const D = bathFx.duck; D.v = reduced() ? 1.2 : 2.4; D.spin = Math.PI * 2;
    Bus.audio.drop(3); bubbleBurst(bathDuck.getWorldPosition(new V3()), 5);
    bun.expr = 'smile'; bsay('ho1', '꽥꽥!', 'ok', 1.3);
    bathLater(0.8, () => bsay('ho2', pickOne(['…귀엽네요.', '꽥.', '이름 있어요?']), 'emo', 1.5));
    bathLater(2.2, () => { bun.expr = null; });
  }
  /* 물·거품·욕조 누름: 비눗방울이 뭉게뭉게 + 한마디씩 */
  function bathWaterTap(at){
    at.y = bath.localToWorld(new V3(0, 0.6, 0)).y;
    Bus.audio.poof(); bubbleBurst(at, reduced() ? 4 : 9);
    const t = BATH_WATER[bathFx.water = (bathFx.water + 1) % BATH_WATER.length];
    bun.expr = 'smile'; bsay('ho1', t[0], 'ok', 1.6);
    bathLater(0.7, () => { bun2.expr = 'smile'; bsay('ho2', t[1], 'emo', 1.6); });
    bathLater(2.0, () => { bun.expr = null; bun2.expr = null; });
  }
  /* 욕조 안에서 누른 곳: 반응했으면 true, 아니면(방 다른 곳) false → 일어남 */
  function bathTap(cx, cy){
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0]; if (!hit) return false;
    const u = hit.object.userData;
    if (!(u.bunny || u.buddy || u.duck || u.use === 'bath')) return false;
    if (bathBusy()) return true;                         /* 반응하는 중엔 기다림 */
    bathFx.talkT = Math.max(bathFx.talkT, 8);
    if (u.bunny) bathSplashFight();
    else if (u.buddy) bathFoamHat();
    else if (u.duck) bathDuckSqueak();
    else bathWaterTap(hit.point.clone());
    return true;
  }
  /* 60Hz: 줄 선 반응 실행, 물방울, 오리, 거품 모자, 오래 있으면 얼굴 빨개짐 */
  function stepBath(h){
    const inB = seat.where === 'bath' && seat.on && seat.k >= 1;
    bathFx.t += h;
    if (inB) {
      bathFx.was = true;
      const due = bathFx.q.filter(e => e.at <= bathFx.t);
      bathFx.q = bathFx.q.filter(e => e.at > bathFx.t);
      due.forEach(e => e.fn());
      bathFx.soak += h;
      if (!bathFx.hot && bathFx.soak > 40 && !bathBusy()) {
        bathFx.hot = true; bathFx.talkT = Math.max(bathFx.talkT, 8);
        bun.expr = 'yuck'; bsay('ho1', '머리가 핑~…', 'bad', 1.8);
        bathLater(1.0, () => bsay('ho2', '얼굴 빨개요. 이제 나갈까요?', 'emo', 2));
        bathLater(2.8, () => { bun.expr = null; });
      }
    } else if (bathFx.was && !seat.on) {                 /* 나오면 반응 취소·정리 */
      bathFx.was = false; bathFx.q = []; bathFx.soak = 0; bathFx.hot = false; bathFx.foam = 0;
      bun.foamOn = bun2.foamOn = false; bun.expr = bun2.expr = null;
      ['ho1', 'ho2'].forEach(w => { if (!bubs[w].hidden && bathSaid.has(bubs[w].textContent)) hush(w); });
    }
    const flushK = sstep(12, 38, bathFx.soak);
    [bun, bun2].forEach(s => {
      s.foam = (s.foam || 0) + ((s.foamOn ? 1 : 0) - (s.foam || 0)) * Math.min(1, h * 9);
      s.flush = inB ? Math.max(s.flush || 0, flushK) : Math.max(0, (s.flush || 0) - h * 0.25);
    });
    if (seat.where === 'bath') spring(bun2.squash, 0, 190, 11, h);   /* 앉아 있을 땐 HO2 출렁임을 여기서 */
    const D = bathFx.duck;
    if (D.v !== 0 || D.y > 0) { D.v -= 9 * h; D.y += D.v * h; if (D.y <= 0) { D.y = 0; D.v = 0; } }
    D.spin = Math.max(0, D.spin - h * 9);
    bathSplash.forEach(d => {
      if (!d.alive) return;
      d.life += h; d.vel.y -= 7 * h; d.m.position.addScaledVector(d.vel, h);
      if (d.life > 0.75) { d.alive = false; d.m.visible = false; }
    });
  }
  Object.values(SEATS).forEach(S => { S.yaw0 = S.yaw.slice(); });
  function sitDown(where){
    if (seat.on || sleep.on || seat.k > 0 || Bus.mode !== 'room' || fl.active) return;
    const S = SEATS[where];
    seatWalk(S, 0, () => { seat.where = where; seat.on = true; Bus.audio.hop(); if (where === 'table') tableHint(); if (where === 'bath') { Bus.audio.poof(); bathFx.talkT = 0.9; } });
  }
  /* 앉을 자리까지 걸어감. 가구에 막혀 멀리서 멈추면 옆으로 돌아가는 길(경유지)을 잡아 다시 감 (최대 3번) */
  function seatWalk(S, tries, done){
    const goal = S.stand[0];
    walkTo(goal.x, goal.z, S.yaw[0], () => {
      const dx = goal.x - bun.pos.x, dz = goal.z - bun.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6 || tries >= 3) { done(); return; }
      const ux = dx / d, uz = dz / d;
      const cands = [1, -1].map(sd => resolve(new V3(bun.pos.x - uz * 1.6 * sd + ux * 0.6, 0, bun.pos.z + ux * 1.6 * sd + uz * 0.6)));
      const len = c => Math.hypot(c.x - bun.pos.x, c.z - bun.pos.z) + Math.hypot(goal.x - c.x, goal.z - c.z);
      let c = len(cands[0]) <= len(cands[1]) ? cands[0] : cands[1];
      if (tries % 2) c = c === cands[0] ? cands[1] : cands[0];      /* 두 번째엔 반대쪽으로 */
      walkTo(c.x, c.z, null, () => seatWalk(S, tries + 1, done));
    });
  }
  function standUp(){
    if (!seat.on) return;
    seat.on = false;
    const S = SEATS[seat.where];
    bun.pos.copy(S.stand[0]); bun2.pos.copy(S.stand[1]); resolve(bun.pos); resolve(bun2.pos);
    bun.target = null; bun.moving = false; bun.idle = 0; bun2.idle = 0; bun2.moving = false;
    Bus.audio.hop();
  }

  /* 냉장고 문: 누르면 HO1이 앞으로 가고 문이 열림. 다시 누르면 닫힘 */
  const FRIDGE_SPOT = { x: FRIDGE.x - 1.1, z: FRIDGE.z + 1.25, face: Math.PI * 0.8 };   /* 열린 문 왼쪽에 서서 안을 봄 */
  function toggleFridge(){
    const open = fridgeDoor.target < 0.5;
    fridgeDoor.target = open ? 1.95 : 0;
    if (open) { fridgeDoor.v += 2; Bus.audio.drawerOpen(2); walkTo(FRIDGE_SPOT.x, FRIDGE_SPOT.z, FRIDGE_SPOT.face); }
    else Bus.audio.drawerClose(2, false);
  }

  /* 화분 물 주기: HO1이 화분 앞으로 가서 물뿌리개를 기울임. 세 번 주면 꽃이 핌 */
  const water = { on: false, t: 0, dropT: 0, grown: false };
  function goWater(){
    if (water.on || sleep.on || seat.on || Bus.mode !== 'room' || fl.active) return;
    const sp = SPOTS.secret, face = Math.atan2(plant.position.x - sp.x, plant.position.z - sp.z);
    walkTo(sp.x, sp.z, face, () => { water.on = true; water.t = 0; water.dropT = 0; water.grown = false; bun.faceTarget = Math.atan2(plant.position.x - bun.pos.x, plant.position.z - bun.pos.z); bun.lock = 3; });
  }
  function waterGrow(){
    if (sprout.stage >= 3) { grownReaction(); return; }
    sprout.stage++; sprout.target = sprout.stage / 3; sprout.g.v += 1.2;
    Bus.audio.drop(sprout.stage);
    if (sprout.stage === 3) setTimeout(() => {
      sprout.bloom.target = 1; sprout.bloom.v += 2;
      burstPetals(reduced() ? 6 : 18); Bus.audio.bloom(); hop(4.6);
    }, 500);
  }

  /* 다 자란 뒤 물 주기: 꽃이 살랑 + 반짝이, 그리고 세 가지 반응 중 하나(지난번과 다른 것)
     0: 꽃잎이 조금 날리고 HO1이 폴짝 / 1: 하트가 나오고 HO2가 폴짝 / 2: 나비 한 마리가 날아옴 */
  const sway = { x: 0, v: 0 };
  let lastReact = -1;
  function grownReaction(){
    let k; do { k = Math.floor(Math.random() * 3); } while (k === lastReact); lastReact = k;
    sway.v += 3.4; twinkle(12);
    if (k === 0) { burstPetals(reduced() ? 4 : 7); hop(3.6); Bus.audio.chime(); }
    else if (k === 1) { spawnHearts(3); hopBud(3.6); Bus.audio.chime(); }
    else { flyButterfly(); Bus.audio.secret(); }
  }
  /* 반짝이: 꽃 둘레에서 위로 떠오르며 깜빡 */
  const twinkles = Array.from({ length: 14 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xFFF1A8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending || 2 }));   /* 2 = 더하기 섞기 (vendor 묶음엔 이름이 없음) */
    sp.visible = false; scene.add(sp); return { sp, life: 1, from: new V3(), seed: 0 };
  });
  function twinkle(n, at){   /* at: 반짝일 자리 (생략하면 꽃) */
    const c = at ? at.clone() : flowerHead.getWorldPosition(new V3());
    twinkles.slice(0, n).forEach((s, i) => {
      const a = i / n * Math.PI * 2;
      s.life = -i * 0.04; s.seed = Math.random() * 6; s.sp.visible = false;
      s.from.set(c.x + Math.cos(a) * (0.25 + Math.random() * 0.2), c.y - 0.1 + Math.random() * 0.3, c.z + Math.sin(a) * (0.25 + Math.random() * 0.2));
    });
  }
  /* 나비: 멀리서 날아와 꽃 둘레를 두 바퀴 돌고 떠남 */
  const butterfly = new THREE.Group(); butterfly.visible = false; butterfly.scale.setScalar(1.8); scene.add(butterfly);
  const bWings = [];
  {
    put(cap(0.018, 0.1, 0x3A3A44), 0, 0, 0, butterfly).rotation.x = Math.PI / 2;
    [-1, 1].forEach(sd => {
      const piv = new THREE.Group(); butterfly.add(piv);
      const up = put(sph(0.08, 0xFFC3D3, { roughness: 0.6, side: THREE.DoubleSide }, 14), sd * 0.075, 0, -0.02, piv); up.scale.set(1, 0.12, 0.8);
      const lo = put(sph(0.055, 0xFFE27A, { roughness: 0.6, side: THREE.DoubleSide }, 12), sd * 0.055, 0, 0.06, piv); lo.scale.set(1, 0.12, 0.8);
      piv.userData.sd = sd; bWings.push(piv);
    });
    butterfly.traverse(o => { o.castShadow = false; });
  }
  const bfly = { on: false, t: 0, from: new V3(), to: new V3() };
  function flyButterfly(){
    const c = flowerHead.getWorldPosition(new V3());
    bfly.on = true; bfly.t = 0; butterfly.visible = true;
    bfly.from.set(c.x + 3.2, c.y + 2.2, c.z + 2.6);
    bfly.to.set(c.x + 1.5, c.y + 2.6, c.z + 3.2);
  }
  const _bp = new V3(), _bn = new V3();
  function butterflyAt(t, out){
    const c = flowerHead.getWorldPosition(_bn);
    const ring = (a, y) => out.set(c.x + Math.cos(a) * 0.38, c.y + 0.15 + y, c.z + Math.sin(a) * 0.38);
    if (t < 1.6) { const k = ease(t / 1.6); ring(0, 0); return out.lerpVectors(bfly.from, out.clone(), k).add(_bp.set(0, Math.sin(k * Math.PI) * 0.4, 0)); }
    if (t < 4.6) { const u = (t - 1.6) / 3; return ring(u * Math.PI * 4, Math.sin(u * Math.PI * 6) * 0.08); }
    const k = ease(Math.min(1, (t - 4.6) / 1.6)); ring(0, 0);
    return out.lerpVectors(out.clone(), bfly.to, k);
  }
  function stepFx(h){
    spring(sway, 0, 40, 3.2, h);
    twinkles.forEach(s => {
      if (s.life >= 1) { s.sp.visible = false; return; }
      s.life += h / 1.4; if (s.life < 0) return;
      s.sp.visible = true;
      s.sp.position.set(s.from.x, s.from.y + s.life * 0.6, s.from.z);
      const tw = 0.5 + 0.5 * Math.sin(s.life * 18 + s.seed);
      s.sp.scale.setScalar(0.12 + 0.12 * tw);
      s.sp.material.opacity = Math.sin(Math.PI * Math.min(1, s.life)) * (0.5 + 0.5 * tw);
    });
    if (bfly.on) {
      bfly.t += h;
      const p = butterflyAt(bfly.t, new V3()), q = butterflyAt(bfly.t + 0.05, new V3());
      butterfly.position.copy(p);
      butterfly.lookAt(q);
      const flap = Math.sin(bfly.t * 24) * 0.9;
      bWings.forEach(w => { w.rotation.z = w.userData.sd * flap; });
      if (bfly.t > 6.2) { bfly.on = false; butterfly.visible = false; }
    }
  }
  /* 다시 심기: 새싹부터 다시 (누구나) */
  function replant(){
    sprout.stage = 0; sprout.target = 0; sprout.bloom.target = 0; sprout.g.v -= 0.6;
    Bus.audio.back(); sway.v += 1.5;
    showPlantPanel();
  }

  /* 물 주기 패널: 물을 주면 화분 위에 잠깐 뜸. 새싹 단계 + '다시 심기' */
  const plantPanel = document.createElement('div');
  plantPanel.className = 'plant-panel'; plantPanel.hidden = true;
  plantPanel.setAttribute('role', 'status');
  plantPanel.innerHTML = '<span class="pp-txt" id="ppTxt"></span><button type="button" class="pp-btn" id="ppReplant">다시 심기</button>';
  document.body.appendChild(plantPanel);
  const ppCss = document.createElement('style');
  ppCss.textContent =
    '.plant-panel{position:fixed;z-index:30;left:0;top:0;transform:translate(-50%,-100%);display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border-radius:999px;background:rgba(255,255,255,.95);border:1.5px solid #1F1B24;box-shadow:0 4px 0 #1F1B24;font:800 13px Quicksand,Nunito,"Gowun Dodum",sans-serif;color:#1F1B24;white-space:nowrap;transition:opacity .25s}' +
    '.plant-panel[hidden]{display:none}' +
    '.pp-btn{min-height:36px;padding:0 12px;border-radius:999px;border:1.5px solid #1F1B24;background:#C8E6C9;font:800 13px Quicksand,Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.pp-btn:active{transform:translateY(1px)}' +
    'body.layout-edit .plant-panel,body:not([data-mode="room"]) .plant-panel{display:none}';
  document.head.appendChild(ppCss);
  let ppUntil = 0;
  function showPlantPanel(){
    const s = sprout.stage;
    plantPanel.querySelector('#ppTxt').textContent = s >= 3 ? '🌸 꽃이 활짝 폈어요' : s === 0 ? '🌱 새싹이에요 · 물을 주면 자라요' : '🌱 새싹 ' + '●'.repeat(s) + '○'.repeat(3 - s);
    plantPanel.querySelector('#ppReplant').hidden = s === 0;
    plantPanel.hidden = false; ppUntil = performance.now() + 9000;
  }
  plantPanel.querySelector('#ppReplant').addEventListener('click', replant);
  plantPanel.addEventListener('pointerenter', () => { ppUntil = performance.now() + 9000; });

  /* =========================================================
     쿠키 굽기 (게스트도 하는 놀이). 주방을 누르면 "누가 구울까?"
     류스케(HO1) = 늘 성공, 아키사(HO2) = 늘 탐. 결과 쟁반은 식탁 위로 (한 번에 하나)
     ========================================================= */
  const COOK_TEXT = {                                   /* 화면 문구: 여기만 바꾸면 됨 */
    ask: '누가 구울까?', ho1: '류스케(HO1)가 굽기', ho2: '아키사(HO2)가 굽기', cancel: '취소',
    success: '성공!', success2: '성공했어요!', fail: '…탔네요.', yum: '맛있다!', bitter: '…으윽.', hint: '🍪 쿠키를 눌러 봐'
  };
  const COOK = { spot: wpos(kitchen, 0.27, 0, 1.0), watch: wpos(kitchen, -0.6, 0, 1.35) };   /* 굽는 자리 · 지켜보는 자리 (주방을 옮기면 따라감) */
  const cook = { on: false, who: null, t: 0, ready: false, a1: false, a2: false, wait: 0, ticks: 0, result: null, eat: null };
  let budTarget = null;                                 /* 굽기·먹기 동안 HO2가 갈 자리 {x,z,face,arrived} */
  const COOKIE_COL = { raw: 0xF3E2B8, good: 0xD99A4E, burnt: 0x2B211C };
  /* 반죽 그릇 */
  const bowl = new THREE.Group(); bowl.visible = false; scene.add(bowl);
  put(cyl(0.13, 0.08, 0.1, 0xFFD1DC, null, 20), 0, 0, 0, bowl);
  put(cyl(0.115, 0.115, 0.01, 0xF3E2B8, null, 20), 0, 0.045, 0, bowl);
  const whisk = put(cyl(0.008, 0.008, 0.2, 0xC9CFDA, null, 6), 0.03, 0.1, 0, bowl); whisk.rotation.z = 0.4;
  bowl.traverse(o => { o.castShadow = false; });
  /* 쿠키 쟁반 */
  let tray = null;                                      /* { g, cookies[], kind: 'raw'|'good'|'burnt' } */
  function makeTray(){
    const g = new THREE.Group(); scene.add(g);
    put(rbox(0.46, 0.02, 0.32, 0.01, 0xC9CFDA, { metalness: 0.4, roughness: 0.4 }), 0, 0, 0, g);
    const cookies = [];
    for (let i = 0; i < 6; i++) {
      const c = put(cyl(0.055, 0.055, 0.02, COOKIE_COL.raw, { roughness: 0.85 }, 18), -0.14 + (i % 3) * 0.14, 0.02, -0.07 + Math.floor(i / 3) * 0.14, g);
      cookies.push(c);
    }
    g.traverse(o => { o.userData.use = 'tray'; if (o.isMesh) pickables.push(o); });
    return { g, cookies, kind: 'raw' };
  }
  function dropTray(){
    if (!tray) return;
    tray.g.traverse(o => { const k = pickables.indexOf(o); if (k >= 0) pickables.splice(k, 1); });
    scene.remove(tray.g); tray = null;
  }
  function colorTray(kind){ tray.kind = kind; tray.cookies.forEach(c => c.material.color.setHex(COOKIE_COL[kind])); }
  /* 탄 연기 */
  const smoke = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3A3540, transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
    m.visible = false; scene.add(m); return { m, life: 1, vel: new V3() };
  });
  function puffSmoke(at){
    smoke.forEach((s, i) => {
      s.life = -i * 0.03; s.m.position.copy(at); s.m.visible = false;
      s.vel.set((Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.9, 0.3 + Math.random() * 0.6);
    });
  }
  /* 말풍선 (선택지 · 타이머 · 결과 · 땀) */
  const cookCss = document.createElement('style');
  cookCss.textContent =
    '.cook-menu{position:fixed;z-index:31;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:20px;background:#fff;border:1.5px solid #1F1B24;box-shadow:0 4px 0 #1F1B24;font:800 14px Quicksand,Nunito,"Gowun Dodum",sans-serif;color:#1F1B24;min-width:200px}' +
    '.cook-menu[hidden],.cook-bub[hidden]{display:none}' +
    '.cook-menu b{font:900 15px Nunito,"Gowun Dodum",sans-serif;text-align:center;margin-bottom:2px}' +
    '.cook-menu button{min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid #1F1B24;background:#fff;font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.cook-menu button.h1{background:#F2E6A0}.cook-menu button.h2{background:#DDE3F5}.cook-menu button.x{border-color:#D9D5E3;color:#6E6878}' +
    '.cook-menu::after{content:"";position:absolute;left:50%;bottom:-9px;width:14px;height:14px;background:#fff;border-right:1.5px solid #1F1B24;border-bottom:1.5px solid #1F1B24;transform:translateX(-50%) rotate(45deg)}' +
    '.cook-bub{position:fixed;z-index:30;left:0;top:0;transform:translate(-50%,-100%);padding:6px 14px;border-radius:999px;background:#fff;border:1.5px solid #1F1B24;box-shadow:0 3px 0 #1F1B24;font:900 16px Nunito,"Gowun Dodum",sans-serif;color:#1F1B24;white-space:nowrap;pointer-events:none}' +
    '.cook-bub.ok{background:#F6DE8A}.cook-bub.bad{background:#DCCFF5}.cook-bub.emo{background:none;border:0;box-shadow:none;font-size:26px;padding:0}.cook-bub.ho2{background:#CDE6FF}' +
    'body.layout-edit .cook-menu,body.layout-edit .cook-bub,body:not([data-mode="room"]) .cook-menu,body:not([data-mode="room"]) .cook-bub{display:none}';
  document.head.appendChild(cookCss);
  const cookMenu = document.createElement('div');
  cookMenu.className = 'cook-menu'; cookMenu.hidden = true; cookMenu.setAttribute('role', 'dialog'); cookMenu.setAttribute('aria-label', COOK_TEXT.ask);
  cookMenu.innerHTML = '<b>' + COOK_TEXT.ask + '</b><button type="button" class="h1" data-bake="ho1">' + COOK_TEXT.ho1 + '</button><button type="button" class="h2" data-bake="ho2">' + COOK_TEXT.ho2 + '</button><button type="button" class="x" data-bake="">' + COOK_TEXT.cancel + '</button>';
  document.body.appendChild(cookMenu);
  const bubs = { ho1: document.createElement('div'), ho2: document.createElement('div') };
  Object.values(bubs).forEach(b => { b.className = 'cook-bub'; b.hidden = true; b.setAttribute('role', 'status'); document.body.appendChild(b); });
  const bubT = { ho1: 0, ho2: 0 };
  function say(who, text, cls, secs){ if (who === 'ho2') cls = 'ho2';   /* HO2 대사는 늘 연한 파랑 말풍선 */
    const b = bubs[who]; b.textContent = text; b.className = 'cook-bub' + (cls ? ' ' + cls : ''); b.hidden = false; bubT[who] = secs || 0; }
  function hush(who){ bubs[who].hidden = true; bubT[who] = 0; }
  cookMenu.addEventListener('click', e => {
    const b = e.target.closest('[data-bake]'); if (!b) return;
    cookMenu.hidden = true;
    if (b.dataset.bake) startCook(b.dataset.bake);
  });
  function openCookMenu(){
    if (cook.on || Bus.mode !== 'room' || edit.on) return;
    if (sleep.on) wakeUp(); if (seat.on) standUp();
    cookMenu.hidden = false;
    try { cookMenu.querySelector('.h1').focus({ preventScroll: true }); } catch (e) {}
  }
  const fxOf = s => (s.fx = s.fx || { sway: 0, shiver: 0, hold: 0 });
  function startCook(who){
    if (cook.on || water.on) return;
    if (sleep.on) wakeUp(); if (seat.on) standUp();
    dropTray(); hush('ho1'); hush('ho2');
    Object.assign(cook, { on: true, who, t: 0, ready: false, a1: false, a2: false, wait: 0, ticks: 0, result: null, eat: null });
    const kf = kitchen.rotation.y + Math.PI, baker = COOK.spot, watcher = COOK.watch;
    const watchFace = Math.atan2(baker.x - watcher.x, baker.z - watcher.z);
    const mine = who === 'ho1' ? baker : watcher, other = who === 'ho1' ? watcher : baker;
    walkTo(mine.x, mine.z, who === 'ho1' ? kf : watchFace, () => { cook.a1 = true; });
    /* HO2: 굽는 사람이면 조리대를, 지켜보는 사람이면 굽는 자리를 봄 */
    budTarget = { x: other.x, z: other.z, face: who === 'ho2' ? kf : watchFace, arrived: false };
  }
  /* 요리를 그만두고 원래대로 (메뉴 · 가구 배치 편집을 열 때) */
  function cancelCook(){
    cookMenu.hidden = true;
    if (!cook.on && !cook.eat) return;
    cook.on = false; cook.eat = null; budTarget = null;
    bowl.visible = false; ovenInner.material.emissiveIntensity = 0; ovenGlass.material.emissiveIntensity = 0; ovenPivot.rotation.x = 0;
    if (tray && tray.kind === 'raw') dropTray();
    [bun, bun2].forEach(s => { if (s.fx) { s.fx.sway = 0; s.fx.shiver = 0; } });
    clearFaces(); hush('ho1'); hush('ho2');
  }
  function clearFaces(){ [bun, bun2].forEach(s => { s.expr = null; s.bite = 0; s.chew = 0; }); }
  const atTable = () => seat.on && seat.where === 'table';
  /* 쟁반 누르기: 둘이 식탁 의자에 앉아서 쿠키를 하나씩 들고 먹음
     류스케(HO1)가 구운 쿠키 = 웃으면서 / 아키사(HO2)가 구운(탄) 쿠키 = 찡그리면서 */
  function eatTray(){
    if (!tray || cook.on || cook.eat || tray.kind === 'raw' || Bus.mode !== 'room') return;
    if (sleep.on) wakeUp();
    if (seat.on && !atTable()) standUp();               /* 소파에 앉아 있었으면 일어나서 식탁으로 */
    cook.eat = { kind: tray.kind, t: 0, go: 0, asked: false, started: false };
  }
  /* 식탁에 앉았을 때 쟁반이 있으면 알려 줌 */
  function tableHint(){ if (tray && tray.kind !== 'raw' && !cook.eat) say('ho1', COOK_TEXT.hint, '', 2.4); }
  function eatOne(who){
    const c = tray && tray.cookies.find(x => x.visible); if (!c) return false;
    c.visible = false; c.traverse(o => { const k = pickables.indexOf(o); if (k >= 0) pickables.splice(k, 1); });
    return true;
  }
  const tw = (a, b, t) => sstep(a, b, t);
  /* 진행: 모이기 → 반죽(0~2) → 틀로 찍기(2~2.8) → 오븐에 넣기(2.8~3.8) → 굽기 ⏲3·2·1 → 결과 → 쟁반 식탁으로 */
  function stepCook(h){
    Object.keys(bubT).forEach(k => { if (bubT[k] > 0) { bubT[k] -= h; if (bubT[k] <= 0) hush(k); } });
    smoke.forEach(s => {
      if (s.life >= 1) { s.m.visible = false; return; }
      s.life += h / 1.6; if (s.life < 0) return;
      s.m.visible = true; s.m.position.addScaledVector(s.vel, h); s.vel.multiplyScalar(1 - h * 0.8);
      s.m.scale.setScalar(0.6 + s.life * 2.2); s.m.material.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, s.life));
    });
    [bun, bun2].forEach(s => { const fx = fxOf(s); fx.shiver = Math.max(0, fx.shiver - h); });
    if (cook.eat) { stepEat(h); return; }
    if (!cook.on) return;
    const D = reduced() ? 0.5 : 1;                     /* 움직임 줄이기 설정이면 짧게 */
    if (!cook.ready) {
      cook.wait += h;
      if ((cook.a1 && (!budTarget || budTarget.arrived)) || cook.wait > 9) { cook.ready = true; cook.t = 0; }
      return;
    }
    cook.t += h / D;
    const T = cook.t, bs = cook.who === 'ho1' ? bun : bun2, fx = fxOf(bs);
    const B = cook.who === 'ho1' ? B1 : B2;
    /* 반죽 젓기: 그릇을 앞에 들고 몸을 좌우로 */
    if (T < 2.0) {
      bowl.visible = true;
      const f = bs.face; bowl.position.set(bs.pos.x + Math.sin(f) * 0.42, FLOOR + 0.62, bs.pos.z + Math.cos(f) * 0.42);
      whisk.rotation.y = T * 14;
      fx.sway = Math.sin(T * 10) * 0.16;
      cook.tick = (cook.tick || 0) - h; if (cook.tick <= 0) { cook.tick = 0.28; Bus.audio.tap(); }
      return;
    }
    if (!tray) { bowl.visible = false; fx.sway = 0; tray = makeTray(); }
    const onCounter = kitchen.localToWorld(new V3(0.0, 0.93, 0.08)), inOven = kitchen.localToWorld(new V3(0.265, 0.32, 0.12));
    tray.g.rotation.y = kitchen.rotation.y;
    /* 틀로 찍기: 조리대 위 쟁반, 몸이 두 번 콩콩 */
    if (T < 2.8) {
      tray.g.position.copy(onCounter);
      if (T - h / D < 2.2 && T >= 2.2) { bs.squash.v -= 2.5; Bus.audio.tap(); }
      if (T - h / D < 2.55 && T >= 2.55) { bs.squash.v -= 2.5; Bus.audio.tap(); }
      return;
    }
    /* 오븐에 넣기: 문이 열렸다 닫힘 */
    if (T < 3.8) {
      ovenPivot.rotation.x = 1.25 * tw(2.8, 3.05, T) * (1 - tw(3.55, 3.8, T));
      tray.g.position.lerpVectors(onCounter, inOven, tw(3.0, 3.4, T));
      if (T - h / D < 2.8) Bus.audio.drawerOpen(1);
      if (T - h / D < 3.55 && T >= 3.55) Bus.audio.drawerClose(1, true);
      return;
    }
    /* 굽기: 오븐 안이 주황색으로, 머리 위 ⏲ 3 · 2 · 1 */
    if (T < 6.8) {
      tray.g.visible = false;
      const glow = 0.6 + 0.4 * Math.sin(T * 6);
      ovenInner.material.emissiveIntensity = 1.2 * glow; ovenGlass.material.emissiveIntensity = 0.9 * glow;
      const left = Math.ceil(6.8 - T);
      if (left !== cook.ticks) { cook.ticks = left; say(cook.who, '⏲ ' + left, '', 0); Bus.audio.tap(); }
      return;
    }
    /* 결과 */
    if (!cook.result) {
      cook.result = cook.who === 'ho1' ? 'good' : 'burnt';
      tray.g.visible = true; colorTray(cook.result);
      ovenInner.material.emissiveIntensity = 0; ovenGlass.material.emissiveIntensity = 0;
      const mouth = kitchen.localToWorld(new V3(0.265, 0.45, 0.45));
      if (cook.result === 'good') {
        Bus.audio.chime(); setTimeout(() => Bus.audio.chime(), 180);    /* 띵 */
        say(cook.who, cook.who === 'ho2' ? COOK_TEXT.success2 : COOK_TEXT.success, 'ok', 2.6);
        twinkle(reduced() ? 6 : 14, mouth.clone().add(new V3(0, 0.3, 0)));
        hop(4.0); hopBud(4.0);
        spawnHearts(reduced() ? 1 : 3); spawnHearts(reduced() ? 1 : 2, 'ho2');
      } else {
        Bus.audio.poof();                                                 /* 펑 */
        puffSmoke(mouth);
        say('ho2', '💦 ' + COOK_TEXT.fail, 'bad', 2.6);                  /* 아키사 머리 위 땀방울 + 문구 */
        fxOf(bun2).shiver = reduced() ? 0.5 : 1.2;                       /* 아키사 흠칫 떨림 */
        setTimeout(() => { if (cook.on) hop(3.2); }, reduced() ? 300 : 900);   /* 류스케: 잠깐 굳었다가 폴짝(당황) */
      }
    }
    /* 오븐에서 꺼내서 식탁으로 */
    ovenPivot.rotation.x = 1.25 * tw(6.8, 7.0, T) * (1 - tw(7.6, 7.9, T));
    const out = kitchen.localToWorld(new V3(0.265, 0.6, 0.6));
    const onTable = table.localToWorld(new V3(0, 0.81, -0.12));
    if (T < 7.6) tray.g.position.lerpVectors(inOven, out, tw(6.9, 7.4, T));
    else tray.g.position.lerpVectors(out, onTable, tw(7.6, 8.6, T)).add(new V3(0, Math.sin(Math.PI * tw(7.6, 8.6, T)) * 0.5, 0));
    tray.g.rotation.y = mix(kitchen.rotation.y, table.rotation.y, tw(7.6, 8.6, T));
    if (T > 8.8) { cook.on = false; budTarget = null; bun.idle = 0; bun2.idle = 0; }
  }
  /* 먹기 진행: 식탁에 앉기 → 둘이 쿠키를 하나씩 집음 → 세 입 오물오물 → 반응
     류스케 쿠키(good) = ^^ 웃는 얼굴 + 하트 / 아키사 쿠키(burnt) = >< 찡그린 얼굴 + 땀 + 부르르 */
  const EAT_AT = [0.3, 0.9, 1.5, 2.1, 2.4];           /* 집기 · 한 입 · 두 입 · 세 입 · 반응 (초) */
  function stepEat(h){
    const e = cook.eat;
    if (!atTable() || seat.k < 1) {
      e.t += h;
      if (!e.asked && !seat.on && seat.k === 0 && !sleep.on) { e.asked = true; sitDown('table'); }
      if (e.t > 12) { cook.eat = null; clearFaces(); }   /* 못 앉으면 그만 */
      return;
    }
    if (!e.started) {
      e.started = true; hush('ho1'); hush('ho2');
      e.p = [{ s: bun, P: B1, who: 'ho1', o: 0, n: 0 }, { s: bun2, P: B2, who: 'ho2', o: 0.3, n: 0 }];
    }
    e.go += h;
    const good = e.kind === 'good';
    spring(bun2.squash, 0, 190, 11, h);                 /* 앉아 있는 동안 HO2 몸 출렁임 */
    e.p.forEach(p => {
      const s = p.s;
      s.chew = Math.max(0, (s.chew || 0) - h);
      if (p.n >= EAT_AT.length || e.go < EAT_AT[p.n] + p.o) return;
      if (p.n === 0) {                                  /* 쟁반에서 하나 집기 */
        if (!eatOne()) { p.n = EAT_AT.length; return; }
        p.P.faceFx.snackC.material.color.setHex(COOKIE_COL[e.kind]);
        s.bite = 3; s.expr = good ? 'smile' : null; Bus.audio.tap();
      } else if (p.n < 4) {                             /* 한 입씩 */
        s.bite--; s.chew = 0.45; s.squash.v -= 1.6; Bus.audio.tap();
        if (!good) { s.expr = 'yuck'; fxOf(s).shiver = Math.max(fxOf(s).shiver, reduced() ? 0.2 : 0.45); }
      } else {                                          /* 다 먹고 반응 */
        if (good) { spawnHearts(p.who === 'ho1' ? 2 : 1, p.who === 'ho2' ? 'ho2' : undefined); say(p.who, p.who === 'ho1' ? COOK_TEXT.yum : '♥', p.who === 'ho1' ? 'ok' : 'emo', 1.6); }
        else { fxOf(s).shiver = reduced() ? 0.5 : 1.3; say(p.who, p.who === 'ho1' ? COOK_TEXT.bitter : '💦', p.who === 'ho1' ? 'bad' : 'emo', 1.6); }
      }
      p.n++;
    });
    if (e.go > EAT_AT[4] + 0.3 + 1.4) {                 /* 표정 풀고 끝. 다 먹었으면 쟁반 치움 */
      cook.eat = null; clearFaces();
      if (tray && !tray.cookies.some(c => c.visible)) dropTray();
    }
  }
  /* HO2를 정해진 자리로 (굽기·먹기 동안) */
  function budGoto(h){
    const t = budTarget, dx = t.x - bun2.pos.x, dz = t.z - bun2.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.08) {
      const mv = Math.min(d, SPEED * 1.15 * h);
      bun2.pos.x += dx / d * mv; bun2.pos.z += dz / d * mv; resolve(bun2.pos);
      bun2.faceTarget = Math.atan2(dx, dz); bun2.moving = true;
      const prev = Math.floor(bun2.phase / Math.PI);
      bun2.phase += h * STEP_RATE * Math.PI; if (Math.floor(bun2.phase / Math.PI) !== prev) bun2.squash.v += 1.1;
      bun2.gait = Math.min(1, bun2.gait + h * 7);
      t.stuck = (t.stuck || 0) + (mv < SPEED * h * 0.2 ? h : 0);
      if (t.stuck > 1.2) t.arrived = true;
    } else {
      t.arrived = true; bun2.moving = false; bun2.gait = Math.max(0, bun2.gait - h * 5);
      bun2.faceTarget = t.face;
    }
    bun2.face += wrapA(bun2.faceTarget - bun2.face) * Math.min(1, h * 9);
    if (bun2.jumpV !== 0 || bun2.jumpY > 0) {
      bun2.jumpV -= 13 * h; bun2.jumpY += bun2.jumpV * h;
      if (bun2.jumpY <= 0) { const impact = -bun2.jumpV; bun2.jumpY = 0; bun2.jumpV = 0; bun2.squash.v += impact * 1.1; }
    }
    spring(bun2.squash, 0, 190, 11, h);
  }
  /* 말풍선 위치: 메뉴는 주방 위, 결과·타이머는 각자 머리 위 */
  function placeCookUI(){
    if (!cookMenu.hidden) {
      const s = toScreen(kitchen.localToWorld(new V3(0, 1.7, 0.3)));
      cookMenu.style.left = Math.min(Math.max(s.x, 120), window.innerWidth - 120) + 'px';
      cookMenu.style.top = Math.max(s.y, 200) + 'px';
    }
    [['ho1', B1], ['ho2', B2]].forEach(([k, P]) => {
      const b = bubs[k]; if (b.hidden) return;
      const s = toScreen(P.head.getWorldPosition(new V3()).add(new V3(0, 0.75, 0)));
      b.style.left = s.x + 'px'; b.style.top = s.y + 'px';
    });
  }

  const OBST = [
    { x: -2.0, z: -4.1, r: 1.35 }, { x: 2.3, z: -4.2, r: 1.45 }, { x: 3.75, z: 2.9, r: 0.55 },
    { x: -3.9, z: 3.8, r: 0.62 },
    { x: BED.x, z: BED.z - 0.55, r: 0.95 }, { x: BED.x, z: BED.z + 0.55, r: 0.95 },   /* 침대 */
    { x: SOFA.x, z: SOFA.z - 0.55, r: 0.7 }, { x: SOFA.x, z: SOFA.z + 0.55, r: 0.7 },  /* 소파 */
    { x: TABLE.x, z: TABLE.z, r: 0.62 }, { x: TABLE.x - 1.07, z: TABLE.z, r: 0.34 }, { x: TABLE.x + 1.07, z: TABLE.z, r: 0.34 },   /* 식탁, 의자 */
    { x: KITCHEN.x - 0.27, z: KITCHEN.z, r: 0.4 }, { x: KITCHEN.x + 0.27, z: KITCHEN.z, r: 0.4 },   /* 주방 */
    { x: FRIDGE.x, z: FRIDGE.z, r: 0.45 },                                            /* 냉장고 */
    { x: SHELF.x, z: SHELF.z, r: 0.5 },                                               /* 책장 */
    { x: LAMP.x, z: LAMP.z, r: 0.3 },                                                 /* 조명 */
    { x: BATH.x - 0.55, z: BATH.z, r: 0.68 }, { x: BATH.x + 0.55, z: BATH.z, r: 0.68 }   /* 욕조 */
  ];
  const BOUND = 4.45, BUN_R = 0.42;
  function resolve(p){
    p.x = clamp(p.x, -BOUND, BOUND); p.z = clamp(p.z, -BOUND, BOUND);
    for (const o of OBST) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + BUN_R;
      if (d < min) { const k = min / (d || 1e-4); p.x = o.x + dx * k; p.z = o.z + dz * k; }
    }
    p.x = clamp(p.x, -BOUND, BOUND); p.z = clamp(p.z, -BOUND, BOUND);
    return p;
  }
  function walkTo(x, z, faceAfter, onArrive){
    bun.target = resolve(new V3(x, 0, z));
    if (!bun.moving) bun.phase = Math.ceil(bun.phase / Math.PI) * Math.PI;
    bun.moving = true; bun.faceAfter = faceAfter == null ? null : faceAfter; bun.onArrive = onArrive || null; bun.stuck = 0;
    bun.bestD = Infinity; bun.noProg = 0;
  }
  const SPOTS = {
    hero: { x: -2.0, z: -2.35, face: Math.PI },
    gallery: { x: -2.9, z: 1.55, face: -Math.PI / 2 },
    cabinet: { x: 2.3, z: -2.45, face: Math.PI },
    mail: { x: 2.9, z: 3.75, face: Math.PI / 4 },
    records: { x: SHELF.x + 0.75, z: SHELF.z + 1.15, face: Math.PI * 1.15 },   /* 책장 앞 오른쪽 (카메라를 가리지 않게) */
    secret: { x: -3.1, z: 2.95, face: -2.4 }   /* 화분 물 주는 자리 (화분 옆: 화면에서 옆모습이 보이게) */
  };

  /* Jump trigger zones: an object opens when Mochi jumps within reach of it */
  const TRIG = {
    hero: { x: -2.0, z: -4.1, r: 1.35 }, gallery: { x: -4.3, z: 1.55, r: 0.6 },
    cabinet: { x: 2.3, z: -4.2, r: 1.45 }, mail: { x: 3.75, z: 2.9, r: 0.55 },
    records: { x: SHELF.x, z: SHELF.z, r: 0.5 }
  };
  const REACH = 0.75;
  function nearSection(){
    let best = null, bd = Infinity;
    for (const id in TRIG) {
      const t = TRIG[id], d = Math.hypot(bun.pos.x - t.x, bun.pos.z - t.z) - t.r - BUN_R;
      if (d < bd) { bd = d; best = id; }
    }
    return bd < REACH ? best : null;
  }
  function jumpAction(){
    if (sleep.on) { wakeUp(); return; }
    if (cook.eat) return;
    if (seat.on) { standUp(); return; }
    if (seat.k > 0 || water.on || cook.on) return;
    if (Bus.mode !== 'room' || fl.active || bun.jumpY > 0.01 || bun.jumpV !== 0) return;
    const id = nearSection();
    hop(4.4);
    Bus.audio.hop();
    if (id) {
      const t = TRIG[id];
      bun.faceTarget = Math.atan2(t.x - bun.pos.x, t.z - bun.pos.z); bun.lock = 2;
      bun.moving = false; bun.target = null; keys.clear();
      bun.pendingOpen = id;
    }
  }

  /* ---------- Particles: hearts, dust, floor ring, sparkles ---------- */
  const heartShape = new THREE.Shape();
  heartShape.moveTo(5, 5);
  heartShape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  heartShape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  heartShape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  heartShape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  heartShape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  heartShape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 4, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.6, bevelThickness: 1.6, curveSegments: 18 });
  heartGeo.center(); heartGeo.rotateZ(Math.PI); heartGeo.scale(0.024, 0.024, 0.024);
  const hearts = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(heartGeo, mat(i % 3 === 1 ? COL.blush : COL.blushDeep, { transparent: true, emissive: 0xFFB3C6, emissiveIntensity: 0.25, roughness: 0.45 }));
    m.visible = false; m.castShadow = true; scene.add(m);
    hearts.push({ m, life: 0, max: 2.6, vel: new V3(), spin: 0, pop: { x: 0, v: 0 }, alive: false });
  }
  const petalBurst = [];
  const petalGeo = new THREE.SphereGeometry(0.07, 12, 8); petalGeo.scale(0.6, 1, 0.22);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(petalGeo, mat([COL.blush, COL.blushDeep, COL.butter, COL.lav, COL.sky, COL.mint][i % 6], { transparent: true, roughness: 0.6 }));
    m.visible = false; scene.add(m);
    petalBurst.push({ m, life: 0, max: 2.6, vel: new V3(), spin: 0, seed: i, size: 1, alive: false });
  }
  function burstPetals(n){
    const from = flowerHead.getWorldPosition(new V3());
    petalBurst.slice(0, n).forEach((p, i) => {
      const a = i / n * Math.PI * 2 + Math.random() * 0.4;
      p.alive = true; p.life = -i * 0.02; p.m.visible = false; p.m.position.copy(from);
      p.vel.set(Math.cos(a) * (0.9 + Math.random() * 0.6), 1.6 + Math.random() * 1.2, Math.sin(a) * (0.9 + Math.random() * 0.6));
      p.spin = (Math.random() - 0.5) * 8; p.size = 0.8 + Math.random() * 0.6; p.m.material.opacity = 1;
    });
  }
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 1 }));
    m.visible = false; scene.add(m); puffs.push({ m, life: 1, alive: false });
  }
  let puffIdx = 0;
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: COL.lavDeep, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return { m, t: 1, delay: 0 };
  });
  const SPARK = 70;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK * 3), sparkCol = new Float32Array(SPARK * 3), sparkSeed = new Float32Array(SPARK);
  const sparkPalette = [new THREE.Color(COL.blushDeep), new THREE.Color(COL.mintDeep), new THREE.Color(COL.lavDeep)];
  for (let i = 0; i < SPARK; i++) {
    sparkPos.set([(Math.random() - 0.5) * 9, 0.4 + Math.random() * 4.2, (Math.random() - 0.5) * 9], i * 3);
    const c = sparkPalette[i % 3]; sparkCol.set([c.r, c.g, c.b], i * 3); sparkSeed[i] = Math.random() * 10;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.12, map: softTex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(sparks);
  const sparkBase = sparkPos.slice();

  /* ---------- Camera, controls, flights ---------- */
  const HOME_T = new V3(0, 0.9, -0.2);
  const HOME_DIR = new V3(1, 0.78, 1).normalize();
  function homeDistance(){
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max(18.5, (camera.aspect < 0.9 ? 12.8 : 15.5) / (2 * tanH * camera.aspect), 11.5 / (2 * tanH));
  }
  const homePose = () => ({ pos: HOME_T.clone().addScaledVector(HOME_DIR, homeDistance()), tgt: HOME_T.clone() });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.6;
  controls.minPolarAngle = 0.7; controls.maxPolarAngle = 1.22;
  controls.minAzimuthAngle = 0.12; controls.maxAzimuthAngle = 1.46;
  let zoomDist = null;
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (Bus.mode !== 'room' || fl.active || !controls.enabled) return;
    let d = e.deltaY; if (e.deltaMode === 1) d *= 18; else if (e.deltaMode === 2) d *= 400;
    const base = zoomDist == null ? camera.position.distanceTo(controls.target) : zoomDist;
    zoomDist = clamp(base * Math.exp(clamp(d, -240, 240) * 0.0011), controls.minDistance, controls.maxDistance);
  }, { passive: false, capture: true });
  function setDistanceLimits(){ const d = homeDistance(); controls.minDistance = d * 0.55; controls.maxDistance = d * 1.35; }
  setDistanceLimits();
  const hp = homePose();
  camera.position.copy(hp.pos); controls.target.copy(hp.tgt); controls.update();
  const lookTarget = controls.target.clone();

  const tmpQ = new THREE.Quaternion();
  function focusPose(id){
    const a = camera.aspect, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), portrait = a < 0.9, wide = a >= 0.9;
    if (id === 'hero') {
      const c = screen.getWorldPosition(new V3()), n = new V3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(tmpQ));
      const d = Math.min(1.02 / (2 * tanH), 1.5 / (2 * tanH * a)) * 0.9;
      if (portrait) c.add(new V3(0.26, -0.22, 0));
      return { pos: c.clone().addScaledVector(n, d), tgt: c };
    }
    if (id === 'gallery') {
      const c = picture.getWorldPosition(new V3()), n = new V3(0, 0, 1).applyQuaternion(picture.getWorldQuaternion(tmpQ));
      const d = Math.min(PH / (2 * tanH), PW / (2 * tanH * a)) * (portrait ? 0.95 : 1.22);
      return { pos: c.clone().addScaledVector(n, d), tgt: c };
    }
    if (id === 'cabinet') {
      const c = cab.localToWorld(new V3(0, 1.4, 0.6));
      const pos = c.clone().add(new V3(0, 1.1, portrait ? 10.5 : 7.4));
      const shift = wide ? new V3(1.55, 0, 0) : new V3(0, -1.6, 0);
      return { pos: pos.add(shift), tgt: c.add(shift) };
    }
    if (id === 'records') {
      /* 책장 정면에서, 패널(오른쪽)에 가리지 않게 책장이 왼쪽에 오도록 */
      const c = shelf.localToWorld(new V3(0, 1.25, 0.2));
      const n = new V3(0, 0, 1).applyQuaternion(shelf.getWorldQuaternion(tmpQ)); n.y = 0; n.normalize();
      const pos = c.clone().addScaledVector(n, portrait ? 8.6 : 5.8).add(new V3(0, portrait ? 4.2 : 2.9, 0));   /* 위에서 내려다봐서 캐릭터 머리에 안 가림 */
      const camRight = new V3().crossVectors(n.clone().negate(), new V3(0, 1, 0)).normalize();
      const shift = wide ? camRight.multiplyScalar(1.9) : new V3(0, -1.5, 0);
      return { pos: pos.add(shift), tgt: c.add(shift) };
    }
    if (id === 'secret') {
      const c = plant.localToWorld(new V3(0, 1.45, 0)).add(new V3(SPOTS.secret.x, 1.25, SPOTS.secret.z)).multiplyScalar(0.5);
      const dir = new V3(1, 0.42, 0.55).normalize();
      const pos = c.clone().addScaledVector(dir, portrait ? 11 : 7.6);
      const view = c.clone().sub(pos).normalize(), right = new V3().crossVectors(view, camera.up).normalize();
      const shift = wide ? right.multiplyScalar(1.3) : new V3(0, -1.4, 0);
      return { pos: pos.add(shift), tgt: c.add(shift) };
    }
    const mb = mail.localToWorld(new V3(0, 1.0, 0)), sp = new V3(SPOTS.mail.x, 0.7, SPOTS.mail.z);
    const c = mb.add(sp).multiplyScalar(0.5);
    const dir = new V3(1, 0.42, 1).normalize();
    const pos = c.clone().addScaledVector(dir, portrait ? 10 : 7);
    const view = c.clone().sub(pos).normalize(), right = new V3().crossVectors(view, camera.up).normalize();
    const shift = wide ? right.multiplyScalar(1.15) : new V3(0, -1.5, 0);
    return { pos: pos.add(shift), tgt: c.add(shift) };
  }

  const fl = { active: false, t: 0, start: 0, dur: 1, fromP: new V3(), fromT: new V3(), dest: null, mid: null, midFired: false, done: null, arc: 0 };
  function fly(dest, dur, arc, mid, done){
    zoomDist = null;
    fl.active = true; fl.t = 0; fl.start = performance.now(); fl.dur = reduced() ? 0.35 : dur; fl.arc = reduced() ? 0 : arc;
    fl.fromP.copy(camera.position); fl.fromT.copy(lookTarget);
    fl.dest = dest; fl.mid = mid || null; fl.midFired = false; fl.done = done || null;
    controls.enabled = false;
  }
  let focusId = null;

  /* ---------- Hover / hotspots ---------- */
  const hotspotEls = {};
  document.querySelectorAll('[data-hotspot]').forEach(el => { hotspotEls[el.getAttribute('data-hotspot')] = el; });
  if (hotspotEls.kitchen) hotspotEls.kitchen.addEventListener('click', () => openCookMenu());   /* '요리하기' 말풍선 */
  let hovered = null;
  function setHovered(id){
    if (hovered === id) return;
    if (hovered && hotspotEls[hovered]) hotspotEls[hovered].classList.remove('is-hover');
    hovered = id;
    if (id && hotspotEls[id]) hotspotEls[id].classList.add('is-hover');
    renderer.domElement.style.cursor = id ? 'pointer' : '';
  }
  document.querySelectorAll('.hotspot').forEach(el => {
    el.addEventListener('pointerenter', () => setHovered(el.getAttribute('data-hotspot')));
    el.addEventListener('pointerleave', () => setHovered(null));
  });

  /* ---------- Raycasting ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = [floorPick];
  Object.values(sections).forEach(g => g.traverse(o => { if (o.isMesh) pickables.push(o); }));
  bunny.traverse(o => { if (o.isMesh) pickables.push(o); });
  B2.bunny.traverse(o => { if (o.isMesh) pickables.push(o); });
  bed.traverse(o => { if (o.isMesh) pickables.push(o); });
  /* 눌러서 쓰는 가구: 소파(앉기) · 식탁(앉기) · 냉장고(문) · 화분(물 주기) */
  [[sofa, 'sofa'], [table, 'table'], [bath, 'bath'], [fridge, 'fridge'], [plant, 'plant'], [kitchen, 'kitchen']].forEach(([g, tag]) => g.traverse(o => { o.userData.use = tag; if (o.isMesh) pickables.push(o); }));
  function sectionOf(o){ while (o) { if (o.userData.section) return o.userData.section; o = o.parent; } return null; }
  function pick(cx, cy){
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return null;
    const sec = sectionOf(hit.object);
    if (sec && hit.object.userData.recTab) return { type: 'section', id: sec, tab: hit.object.userData.recTab };   /* 파란 책·노란 책 */
    if (sec) return { type: 'section', id: sec };
    if (hit.object.userData.bunny) return { type: 'bunny' };
    if (hit.object.userData.buddy) return { type: 'buddy' };
    if (hit.object.userData.bed) return { type: 'bed' };
    if (hit.object.userData.use) return { type: hit.object.userData.use };
    if (hit.object.userData.floor) return { type: 'floor', point: hit.point };
    return null;
  }
  /* 식탁에 앉아 있을 때: 캐릭터 머리에 가려져도 쟁반·식탁을 눌렀으면 먹기 */
  function hitsTray(cx, cy){
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables, false).some(x => x.object.userData.use === 'tray' || x.object.userData.use === 'table');
  }
  const canvas = renderer.domElement;
  let down = null, hoverXY = null;
  canvas.addEventListener('pointerdown', e => { if (edit.on) return; down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointermove', e => { hoverXY = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' }; });
  canvas.addEventListener('pointerleave', () => { hoverXY = null; setHovered(null); });
  canvas.addEventListener('pointerup', e => {
    if (!down || edit.on) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), long = performance.now() - down.t > 600;
    down = null;
    if (moved > 7 || long || Bus.mode !== 'room' || fl.active) return;
    if (sleep.on) { wakeUp(); return; }                 /* 자는 중엔 아무 데나 누르면 깸 */
    if (cook.eat) return;                                /* 먹는 동안엔 눌러도 그대로 */
    if (seat.on && seat.where === 'bath') {              /* 욕조: 캐릭터·오리·물을 누르면 반응, 다른 데 누르면 나옴 */
      if (seat.k < 1 || !bathTap(e.clientX, e.clientY)) standUp();
      return;
    }
    if (seat.on) {                                       /* 앉아 있을 땐 아무 데나 누르면 일어남 (식탁에서 쿠키 누르면 먹음) */
      if (atTable() && seat.k >= 1 && tray && tray.kind !== 'raw' && hitsTray(e.clientX, e.clientY)) eatTray(); else standUp();
      return;
    }
    if (seat.k > 0 || water.on) return;
    if (cook.on || cook.eat) return;                     /* 굽거나 먹는 동안엔 눌러도 안 걸음 */
    const h = pick(e.clientX, e.clientY);
    if (!cookMenu.hidden && (!h || h.type !== 'kitchen')) { cookMenu.hidden = true; return; }   /* 다른 데 누르면 선택지 닫힘 */
    if (!h) return;
    if (h.type === 'section') { kick(h.id); if (h.tab && window.PUBAM_RECORDS) window.PUBAM_RECORDS.setTab(h.tab); Bus.open(h.id); }
    else if (h.type === 'bunny') jumpAction();
    else if (h.type === 'buddy') { hopBud(4.4); Bus.audio.hop(); }
    else if (h.type === 'bed') goSleep();
    else if (h.type === 'sofa' || h.type === 'table' || h.type === 'bath') sitDown(h.type);
    else if (h.type === 'fridge') toggleFridge();
    else if (h.type === 'plant') { sprout.g.v += 1.5; goWater(); }
    else if (h.type === 'kitchen') openCookMenu();
    else if (h.type === 'tray') eatTray();
    else if (h.type === 'floor') { walkTo(h.point.x, h.point.z); showRing(bun.target); }
  });
  function kick(id){ if (sections[id]) sections[id].userData.hover.v -= 2.2; else if (id === 'secret') sprout.g.v += 2.5; }
  function showRing(p){ rings.forEach((r, i) => { r.m.position.set(p.x, FLOOR + 0.03, p.z); r.t = 0; r.delay = i * 0.12; r.m.visible = true; }); }

  /* keyboard steering */
  const keys = new Set();
  const KEYMAP = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const isField = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && Bus.mode === 'room' && !isField(e.target)) {
      e.preventDefault();
      if (!e.repeat) jumpAction();
      return;
    }
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || Bus.mode !== 'room' || !KEYMAP[e.code]) return;
    if (e.target.closest && e.target.closest('.track')) return;
    e.preventDefault(); keys.add(KEYMAP[e.code]);
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space' && Bus.mode === 'room' && !isField(e.target)) e.preventDefault();
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
  });
  window.addEventListener('blur', () => keys.clear());

  /* ---------- 가구 배치 편집 (PL 전용 예정) ----------
     '가구 배치' 버튼 → 가구를 눌러 끌면 이동, '돌리기'로 45도씩 회전, '저장하고 끝내기'로 저장.
     지금은 이 브라우저(localStorage)에 저장. 로그인·서버를 붙이면 그쪽에 저장하도록 바꿀 예정.
     권한: window.PUBAM_CAN_EDIT = false 로 두면 버튼이 안 보임 (나중에 PL 로그인 여부로 설정). */
  const LAYOUT_KEY = 'pubam-layout-v1';
  const canEditLayout = () => window.PUBAM_CAN_EDIT !== false;
  let bedYaw = 0;
  const movables = [];
  /* 가구 하나 등록: 같이 움직여야 하는 좌표(장애물, 걸어갈 자리, 점프 범위 등)를 가구 기준 좌표로 기억해 둠 */
  function movable(id, name, g, r, deps){
    g.updateMatrixWorld(true);
    const it = { id, name, g, r, ry0: g.rotation.y, home: { x: g.position.x, z: g.position.z, ry: g.rotation.y }, deps: [], meshes: [] };
    deps.forEach(d => it.deps.push({ local: g.worldToLocal(d.at.clone()), set: d.set }));
    g.traverse(o => { if (o.isMesh) { it.meshes.push(o); o.userData.movable = it; } });
    movables.push(it);
    return it;
  }
  const obstDep = o => ({ at: new V3(o.x, 0, o.z), set: w => { o.x = w.x; o.z = w.z; } });
  const spotDep = sp => { const f0 = sp.face; return { at: new V3(sp.x, 0, sp.z), set: (w, dy) => { sp.x = w.x; sp.z = w.z; if (f0 != null) sp.face = f0 + dy; } }; };
  const trigDep = t => ({ at: new V3(t.x, 0, t.z), set: w => { t.x = w.x; t.z = w.z; } });
  const vecDep = v => ({ at: v.clone(), set: w => v.copy(w) });
  const findObst = (x, z) => OBST.find(o => Math.abs(o.x - x) < 1e-6 && Math.abs(o.z - z) < 1e-6);

  /* 소파·조명·빈백은 그룹으로 묶여 있어야 움직일 수 있음 */
  movable('tv', 'TV', tv, 1.3, [obstDep(findObst(-2.0, -4.1)), spotDep(SPOTS.hero), trigDep(TRIG.hero)]);
  movable('cabinet', '서랍장', cab, 1.4, [obstDep(findObst(2.3, -4.2)), spotDep(SPOTS.cabinet), trigDep(TRIG.cabinet)]);
  movable('mail', '우체통', mail, 0.6, [obstDep(findObst(3.75, 2.9)), spotDep(SPOTS.mail), trigDep(TRIG.mail)]);
  movable('plant', '화분', plant, 0.6, [obstDep(findObst(-3.9, 3.8)), spotDep(SPOTS.secret)]);
  movable('bed', '침대', bed, 1.5, [
    obstDep(findObst(BED.x, BED.z - 0.55)), obstDep(findObst(BED.x, BED.z + 0.55)),
    vecDep(BED_SIDE[0]), vecDep(BED_SIDE[1]), vecDep(bun.bedSlot), vecDep(bun2.bedSlot), vecDep(bedLamp.position),
    { at: new V3(), set: (w, dy) => { bedYaw = dy; } }
  ]);
  /* 앉는 자리·일어설 자리·앉는 방향이 가구를 따라가게 */
  const seatDeps = S => [...S.slots.map(vecDep), ...S.stand.map(vecDep), { at: new V3(), set: (w, dy) => { S.yaw = S.yaw0.map(a => a + dy); } }];
  movable('sofa', '소파', sofa, 1.2, [obstDep(findObst(SOFA.x, SOFA.z - 0.55)), obstDep(findObst(SOFA.x, SOFA.z + 0.55)), ...seatDeps(SEATS.sofa)]);
  movable('table', '식탁', table, 1.2, [obstDep(findObst(TABLE.x, TABLE.z)), obstDep(findObst(TABLE.x - 1.07, TABLE.z)), obstDep(findObst(TABLE.x + 1.07, TABLE.z)), ...seatDeps(SEATS.table)]);
  movable('kitchen', '주방', kitchen, 0.75, [obstDep(findObst(KITCHEN.x - 0.27, KITCHEN.z)), obstDep(findObst(KITCHEN.x + 0.27, KITCHEN.z)), vecDep(COOK.spot), vecDep(COOK.watch)]);
  movable('fridge', '냉장고', fridge, 0.55, [obstDep(findObst(FRIDGE.x, FRIDGE.z)), spotDep(FRIDGE_SPOT)]);
  movable('bath', '욕조', bath, 1.2, [obstDep(findObst(BATH.x - 0.55, BATH.z)), obstDep(findObst(BATH.x + 0.55, BATH.z)), ...seatDeps(SEATS.bath)]);
  movable('lamp', '조명', lamp, 0.4, [obstDep(findObst(LAMP.x, LAMP.z)), vecDep(lampLight.position)]);
  movable('shelf', '책장', shelf, 0.6, [obstDep(findObst(SHELF.x, SHELF.z)), spotDep(SPOTS.records), trigDep(TRIG.records)]);

  /* 처음 배치 = 지금 사이트에 저장된 배치(2026-11-25) + 새 책장. '처음 배치로'도 여기로 돌아감 */
  const SITE_DEFAULT = {
    tv: { x: -3.087, z: -4.229, ry: 0.7854 }, bed: { x: 4.2, z: -0.035, ry: 0 }, lamp: { x: -4.034, z: 4.65, ry: 0 },
    mail: { x: 2.857, z: 4.12, ry: 0.7854 }, sofa: { x: -4.016, z: -1.21, ry: 0 }, plant: { x: -4.01, z: 3.648, ry: 0 },
    table: { x: -0.828, z: 3.816, ry: 0 }, fridge: { x: 1.375, z: -4.576, ry: 0 }, cabinet: { x: 3.863, z: -4.228, ry: 0 },
    kitchen: { x: -0.62, z: -4.575, ry: 0 }, shelf: { x: 0.45, z: -4.6, ry: 0 },
    bath: { x: -2.0, z: 3.0, ry: 0.7854 }
  };
  movables.forEach(it => { const d = SITE_DEFAULT[it.id]; if (d) it.home = { x: d.x, z: d.z, ry: d.ry }; });

  /* 색 바꾸기: 가구마다 바꿀 수 있는 주요 부분. [이름, 메시들] */
  const PAINT_PARTS = {
    sofa: [['소파', sofa.userData.paint]],
    bed: [['헤드보드', bed.userData.paint], ['이불', bed.userData.paint2]],
    table: [['식탁', table.userData.paint], ['의자', table.userData.paint2]],
    kitchen: [['수납장', kitchen.userData.paint]],
    fridge: [['냉장고', fridge.userData.paint]],
    tv: [['TV', tv.userData.paint]],
    cabinet: [['서랍장', cab.userData.paint]],
    shelf: [['책장', shelf.userData.paint]],
    plant: [['화분', plant.userData.paint]],
    bath: [['욕조', bath.userData.paint]]
  };
  movables.forEach(it => {
    it.paint = (PAINT_PARTS[it.id] || []).map(([label, meshes]) => ({ label, meshes, orig: '#' + meshes[0].material.color.getHexString(), cur: null }));
  });
  function setPaint(it, i, hex){
    const p = it.paint[i]; if (!p) return;
    p.cur = hex && hex.toLowerCase() !== p.orig ? hex.toLowerCase() : null;
    p.meshes.forEach(m => m.material.color.set(p.cur || p.orig));
  }

  function applyDeps(it){
    it.g.updateMatrixWorld(true);
    const dy = it.g.rotation.y - it.ry0;
    it.deps.forEach(d => d.set(it.g.localToWorld(d.local.clone()), dy));
  }
  function placeItem(it, x, z, ry){
    const lim = 4.95 - it.r * 0.5;
    it.g.position.x = clamp(x, -lim, lim); it.g.position.z = clamp(z, -lim, lim);
    if (ry != null) it.g.rotation.y = ry;
    applyDeps(it);
  }
  function layoutData(){
    const o = {};
    movables.forEach(it => {
      o[it.id] = { x: +it.g.position.x.toFixed(3), z: +it.g.position.z.toFixed(3), ry: +it.g.rotation.y.toFixed(4) };
      const c = (it.paint || []).map(p => p.cur);                                   /* 바꾼 색 (안 바꾼 부분은 null) */
      if (c.some(Boolean)) o[it.id].c = c;
    });
    return o;
  }
  function applyLayout(data){
    if (!data) return;
    movables.forEach(it => {
      const d = data[it.id]; if (!d) return;
      placeItem(it, d.x, d.z, d.ry);
      (it.paint || []).forEach((p, i) => setPaint(it, i, d.c && d.c[i] || null));
    });
    resolve(bun.pos); resolve(bun2.pos);
  }
  /* 불러오기 순서: 서버(layout 표)에 저장한 배치 > 사이트 기본 배치(window.PUBAM_LAYOUT) > 처음 배치
     서버에 연결 못 하면 예전처럼 이 브라우저(localStorage)에 남은 배치를 씀 */
  const PB = window.PUBAM;
  (function loadLayout(){
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) {}
    applyLayout(window.PUBAM_LAYOUT || SITE_DEFAULT);
    if (!PB || !PB.sb) { applyLayout(local); return; }
    PB.sb.from('layout').select('data').eq('id', 1).maybeSingle().then(r => {
      if (r.data && r.data.data) applyLayout(r.data.data);
      else if (r.error) applyLayout(local);
    }, () => applyLayout(local));
  })();
  async function saveLayout(data){
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(data)); } catch (e) {}
    if (!PB || !PB.sb) return '이 브라우저에만 저장했어요';
    const r = await PB.sb.from('layout').update({ data }).eq('id', 1).select('id');
    if (r.error || !r.data || !r.data.length) return '서버 저장 실패 · ' + (r.error ? PB.msg(r.error) : '권한이 없어요');
    return '저장했어요';
  }

  /* 편집 상태와 선택 표시(바닥 고리) */
  const edit = { on: false, sel: null, drag: false, pid: null, off: new V3() };
  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 56), new THREE.MeshBasicMaterial({ color: 0x5565AA, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  selRing.rotation.x = -Math.PI / 2; selRing.visible = false; selRing.renderOrder = 2; scene.add(selRing);
  const floorPlane = new THREE.Plane(new V3(0, 1, 0), -FLOOR);
  function floorPoint(cx, cy){
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(floorPlane, new V3());
  }
  function pickItem(cx, cy){
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const all = []; movables.forEach(it => all.push(...it.meshes));
    const hit = ray.intersectObjects(all, false)[0];
    return hit ? hit.object.userData.movable : null;
  }

  /* 편집 도구 막대 (화면 위쪽 가운데) */
  const ui = document.createElement('div');
  ui.className = 'layout-bar';
  ui.innerHTML =
    '<button type="button" class="lb-btn lb-main" id="lbToggle">가구 배치</button>' +
    '<div class="lb-tools" id="lbTools" hidden>' +
      '<span class="lb-sel" id="lbSel" aria-live="polite">가구를 눌러 끌어서 옮기세요</span>' +
      '<button type="button" class="lb-btn" id="lbRot" disabled>돌리기</button>' +
      '<button type="button" class="lb-btn" id="lbPaint" hidden aria-expanded="false" aria-controls="lbPal">색 바꾸기</button>' +
      '<button type="button" class="lb-btn" id="lbReset">처음 배치로</button>' +
      '<button type="button" class="lb-btn" id="lbCopy">배치 코드 복사</button>' +
      '<button type="button" class="lb-btn lb-main" id="lbDone">저장하고 끝내기</button>' +
    '</div>' +
    '<div class="lb-pal" id="lbPal" hidden role="group" aria-label="색 고르기">' +
      '<div class="lb-parts" id="lbParts"></div>' +
      '<div class="lb-sw" id="lbSw"></div>' +
      '<div class="lb-row"><label class="lb-free">직접 고르기 <input type="color" id="lbColor"></label><button type="button" class="lb-btn lb-sm" id="lbOrig">원래 색</button></div>' +
    '</div>' +
    '<textarea class="lb-code" id="lbCode" readonly hidden aria-label="배치 코드"></textarea>';
  const css = document.createElement('style');
  css.textContent =
    '.layout-bar{position:fixed;z-index:35;top:calc(var(--gutter,24px) + 64px);right:var(--gutter,24px);display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100vw - 2 * var(--gutter,24px));font-family:Quicksand,Nunito,system-ui,sans-serif}' +
    '.lb-tools{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;padding:8px;border-radius:22px;background:rgba(255,255,255,.92);border:1px solid #cfd4e6;box-shadow:0 10px 24px -12px rgba(31,27,36,.4)}' +
    '.layout-bar[hidden],.lb-tools[hidden],.lb-code[hidden],.lb-pal[hidden],.lb-btn[hidden]{display:none}' +
    '.lb-pal{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:20px;background:rgba(255,255,255,.96);border:1px solid #cfd4e6;box-shadow:0 10px 24px -12px rgba(31,27,36,.4);max-width:min(340px,calc(100vw - 24px))}' +
    '.lb-parts{display:flex;flex-wrap:wrap;gap:6px}.lb-parts:empty{display:none}' +
    '.lb-parts button{min-height:36px;padding:0 12px;border-radius:999px;border:1.5px solid #cfd4e6;background:#fff;font:700 13px Quicksand,Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.lb-parts button[aria-pressed="true"]{border-color:#1F1B24;background:#1F1B24;color:#fff}' +
    '.lb-sw{display:flex;flex-wrap:wrap;gap:8px}' +
    '.lb-sw button{width:40px;height:40px;border-radius:50%;border:1.5px solid #1F1B24;background:var(--c);cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08)}' +
    '.lb-sw button[aria-pressed="true"]{outline:3px solid #5565AA;outline-offset:2px}' +
    '.lb-row{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '.lb-free{display:flex;align-items:center;gap:8px;font:700 13px Quicksand,Nunito,"Gowun Dodum",sans-serif;color:#3a4166}' +
    '.lb-free input{width:44px;height:36px;border:1.5px solid #cfd4e6;border-radius:10px;padding:2px;background:#fff;cursor:pointer}' +
    '.lb-sm{min-height:36px;padding:0 12px;font-size:13px;box-shadow:0 2px 0 #1F1B24}' +
    '.lb-btn{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid #1F1B24;background:#fff;font:700 14px Quicksand,Nunito,system-ui,sans-serif;color:#1F1B24;cursor:pointer;box-shadow:0 3px 0 #1F1B24}' +
    '.lb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1F1B24}.lb-btn:disabled{opacity:.4;cursor:default}' +
    '.lb-main{background:#5565AA;color:#fff;border-color:#2E3870;box-shadow:0 3px 0 #2E3870}' +
    '.lb-sel{font-weight:700;font-size:13px;color:#3a4166;padding:0 8px}' +
    '.lb-code{width:min(420px,calc(100vw - 48px));height:90px;border-radius:14px;border:1.5px solid #cfd4e6;padding:10px;font:12px/1.4 ui-monospace,monospace;background:#fff}' +
    'body.layout-edit .dock,body.layout-edit #hotspots,body.layout-edit .hint,body.layout-edit .pb-who{display:none}' +
    'body:not([data-mode="room"]) .layout-bar{display:none}' +
    'body.closeup .hud-top,body.closeup .dock,body.closeup #hotspots,body.closeup .hint,body.closeup .layout-bar,body.closeup .pb-who,body.closeup .credit{display:none!important}' +
    '@media (max-width:820px){.layout-bar{top:auto;bottom:86px;right:12px}}';
  document.head.appendChild(css);
  document.body.appendChild(ui);
  const $ = id => ui.querySelector('#' + id);
  /* PL로 로그인했을 때만 '가구 배치' 버튼이 보임 */
  function syncEditBtn(){
    const ok = canEditLayout() && !!(PB ? PB.isPL() : true);
    ui.hidden = !ok;
    if (!ok && edit.on) setEdit(false);
  }
  ui.hidden = true;
  if (PB) PB.onAuth(syncEditBtn); else syncEditBtn();

  function select(it){
    edit.sel = it;
    selRing.visible = !!it;
    $('lbRot').disabled = !it;
    $('lbSel').textContent = it ? it.name + ' 선택됨 · 끌어서 옮기기' : '가구를 눌러 끌어서 옮기세요';
    const canPaint = !!(it && it.paint && it.paint.length);
    $('lbPaint').hidden = !canPaint;
    if (!canPaint) showPal(false); else if (!$('lbPal').hidden) { palPart = 0; drawPal(); }
  }

  /* 색 바꾸기 팔레트: 사이트 색 + 흰색 + 직접 고르기. 바꾼 색은 '저장하고 끝내기' 때 배치와 같이 서버에 저장 */
  const SWATCHES = [['하늘', '#cedef2'], ['노랑', '#f2e6a0'], ['파랑', '#5565aa'], ['분홍', '#ffd1dc'], ['라벤더', '#e6e6fa'], ['민트', '#c8e6c9'], ['흰색', '#ffffff']];
  let palPart = 0;
  function showPal(on){ $('lbPal').hidden = !on; $('lbPaint').setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) { palPart = 0; drawPal(); } }
  function drawPal(){
    const it = edit.sel; if (!it || !it.paint.length) return;
    const p = it.paint[palPart], now = p.cur || p.orig;
    $('lbParts').innerHTML = it.paint.length > 1 ? it.paint.map((q, i) => '<button type="button" data-part="' + i + '" aria-pressed="' + (i === palPart) + '">' + q.label + '</button>').join('') : '';
    $('lbSw').innerHTML = SWATCHES.map(([n, c]) => '<button type="button" data-sw="' + c + '" style="--c:' + c + '" aria-label="' + n + '" title="' + n + '" aria-pressed="' + (now === c) + '"></button>').join('');
    $('lbColor').value = now;
  }
  function paintSel(hex){ if (!edit.sel) return; setPaint(edit.sel, palPart, hex); drawPal(); }
  function setEdit(on){
    if (on && sleep.on) wakeUp();
    if (on && seat.on) standUp();
    if (on) cancelCook();                                 /* 가구 배치 편집을 열면 요리 취소 */
    edit.on = on; select(null); showPal(false);
    document.body.classList.toggle('layout-edit', on);
    $('lbTools').hidden = !on; $('lbToggle').hidden = on; $('lbCode').hidden = true;
    bun.moving = false; bun.target = null; keys.clear();
  }
  $('lbToggle').addEventListener('click', () => setEdit(true));
  $('lbRot').addEventListener('click', () => { if (edit.sel) placeItem(edit.sel, edit.sel.g.position.x, edit.sel.g.position.z, edit.sel.g.rotation.y + Math.PI / 4); });
  $('lbReset').addEventListener('click', () => {
    movables.forEach(it => { placeItem(it, it.home.x, it.home.z, it.home.ry); it.paint.forEach((p, i) => setPaint(it, i, null)); });
    resolve(bun.pos); resolve(bun2.pos); if (!$('lbPal').hidden) drawPal();
  });
  $('lbPaint').addEventListener('click', () => showPal($('lbPal').hidden));
  $('lbParts').addEventListener('click', e => { const b = e.target.closest('[data-part]'); if (b) { palPart = +b.dataset.part; drawPal(); } });
  $('lbSw').addEventListener('click', e => { const b = e.target.closest('[data-sw]'); if (b) paintSel(b.dataset.sw); });
  $('lbColor').addEventListener('input', e => { if (edit.sel) setPaint(edit.sel, palPart, e.target.value); });
  $('lbColor').addEventListener('change', () => drawPal());
  $('lbOrig').addEventListener('click', () => paintSel(null));
  $('lbCopy').addEventListener('click', () => {
    const code = JSON.stringify(layoutData());
    const box = $('lbCode'); box.value = code; box.hidden = false; box.select();
    try { navigator.clipboard.writeText(code).then(() => { $('lbSel').textContent = '배치 코드를 복사했어요'; }, () => {}); } catch (e) {}
  });
  $('lbDone').addEventListener('click', async () => {
    const b = $('lbDone'); b.disabled = true; $('lbSel').textContent = '저장하는 중…';
    const msg = await saveLayout(layoutData());
    b.disabled = false;
    setEdit(false);
    const t = $('lbToggle'); t.textContent = msg;
    setTimeout(() => { t.textContent = '가구 배치'; }, 2200);
  });

  /* 끌어서 옮기기: OrbitControls보다 먼저 받아서 화면이 돌지 않게 함 */
  canvas.addEventListener('pointerdown', e => {
    if (!edit.on) return;
    const it = pickItem(e.clientX, e.clientY);
    select(it);
    if (!it) return;                                   /* 빈 곳을 끌면 원래처럼 화면 회전 */
    e.stopImmediatePropagation();
    const p = floorPoint(e.clientX, e.clientY); if (!p) return;
    edit.drag = true; edit.pid = e.pointerId;
    edit.off.set(it.g.position.x - p.x, 0, it.g.position.z - p.z);
    controls.enabled = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }, { capture: true });
  canvas.addEventListener('pointermove', e => {
    if (!edit.on) return;
    if (edit.drag && e.pointerId === edit.pid && edit.sel) {
      const p = floorPoint(e.clientX, e.clientY);
      if (p) placeItem(edit.sel, p.x + edit.off.x, p.z + edit.off.z);
    } else if (e.pointerType === 'mouse') {
      canvas.style.cursor = pickItem(e.clientX, e.clientY) ? 'grab' : '';
    }
  });
  const endDrag = () => {
    if (!edit.drag) return;
    edit.drag = false; edit.pid = null;
    if (!fl.active) controls.enabled = true;
    resolve(bun.pos); resolve(bun2.pos);
  };
  canvas.addEventListener('pointerup', e => { if (edit.on && edit.drag) { e.stopImmediatePropagation(); endDrag(); } }, { capture: true });
  canvas.addEventListener('pointercancel', endDrag);
  /* 편집 중엔 숫자키·스페이스로 메뉴가 열리지 않게 */
  window.addEventListener('keydown', e => { if (edit.on && (/^[1-4]$/.test(e.key) || e.code === 'Space' || KEYMAP[e.code])) e.stopImmediatePropagation(); }, true);

  /* ---------- Simulation (fixed 60 Hz substeps) ---------- */
  const H = 1 / 60;
  const SPEED = 1.9, STEP_RATE = 4.4;
  const spring = (s, target, k, c, h) => { s.v += (k * (target - s.x) - c * s.v) * h; s.x += s.v * h; };
  const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const fwd = new V3(), rgt = new V3();

  function hop(v){
    if (bun.jumpY > 0.01) return;
    bun.jumpV = reduced() ? v * 0.6 : v; bun.squash.v -= 3.5;
    bun2.hopDelay = 0.14; bun2.hopV = v * 0.92;   /* HO2도 살짝 늦게 따라 뜀 */
  }
  function hopBud(v){ if (bun2.jumpY > 0.01) return; bun2.jumpV = reduced() ? v * 0.6 : v; bun2.squash.v -= 3.5; }
  function footstep(n){
    Bus.audio.tap();
    bun.squash.v += 1.1;
    const foot = feet[n % 2], p = puffs[puffIdx++ % puffs.length];
    p.m.position.copy(foot.getWorldPosition(new V3())); p.m.position.y = FLOOR + 0.06;
    p.life = 0; p.alive = true; p.m.visible = true;
  }
  function spawnHearts(n, who){   /* who: 생략 = HO1, 'ho2' = HO2 머리에서 */
    const P2 = who === 'ho2', headP = (P2 ? B2.head : head).getWorldPosition(new V3()).add(new V3(0, 0.1, 0));
    const f = P2 ? bun2.face : bun.face, dir = new V3(Math.sin(f), 0, Math.cos(f));
    for (let i = 0; i < n; i++) {
      const h = hearts.find(x => !x.alive); if (!h) break;
      h.alive = true; h.life = -i * 0.08; h.m.visible = false;
      h.m.position.copy(headP).addScaledVector(dir, 0.35);
      const spread = (i - (n - 1) / 2) * 0.55;
      h.vel.copy(dir).multiplyScalar(0.9).add(new V3(dir.z * spread, 2.2 + Math.random() * 0.8, -dir.x * spread));
      h.spin = (Math.random() - 0.5) * 3; h.pop.x = 0; h.pop.v = 0;
      h.m.material.opacity = 1;
    }
  }

  function step(h, t){
    const asleep = sleep.on || sleep.k > 0 || seat.on || seat.k > 0 || water.on;   /* 자거나 앉아 있거나 물 주는 중엔 안 걸음 */
    seat.k = clamp(seat.k + (seat.on ? h : -h) / 0.6, 0, 1);
    if (seat.k === 0 && !seat.on) seat.where = seat.where && null;
    sleep.k = clamp(sleep.k + (sleep.on ? h : -h) / 0.8, 0, 1);
    /* keyboard walking */
    if (keys.size && Bus.mode === 'room' && !fl.active && !asleep && !cook.on && !cook.eat) {
      fwd.copy(controls.target).sub(camera.position); fwd.y = 0; fwd.normalize();
      rgt.crossVectors(fwd, camera.up).normalize();
      const d = new V3();
      if (keys.has('f')) d.add(fwd); if (keys.has('b')) d.sub(fwd);
      if (keys.has('r')) d.add(rgt); if (keys.has('l')) d.sub(rgt);
      if (d.lengthSq() > 0) { d.normalize(); walkTo(bun.pos.x + d.x * 0.6, bun.pos.z + d.z * 0.6); }
    }
    /* walking */
    if (bun.moving && bun.target && !asleep) {
      const dx = bun.target.x - bun.pos.x, dz = bun.target.z - bun.pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.04) arrive();
      else {
        const move = Math.min(dist, SPEED * h);
        const bx = bun.pos.x, bz = bun.pos.z;
        /* 가구에 막히면 옆으로 비켜 돌아감: 곧장 → 같은 쪽으로 조금씩 더 꺾어 봄 → 반대쪽 */
        const ux = dx / dist, uz = dz / dist, sd = bun.side || 1;
        let moved = false;
        for (const a of [0, sd * 0.5, sd * 0.95, sd * 1.4, -sd * 0.5, -sd * 0.95, -sd * 1.4]) {
          const c = Math.cos(a), s = Math.sin(a);
          _cand.set(bx + (ux * c - uz * s) * move, 0, bz + (ux * s + uz * c) * move);
          resolve(_cand);
          if (Math.hypot(_cand.x - bx, _cand.z - bz) > move * 0.6) {
            bun.pos.x = _cand.x; bun.pos.z = _cand.z; moved = true;
            if (a !== 0) bun.side = Math.sign(a);
            break;
          }
        }
        if (!moved) { bun.pos.x += ux * move; bun.pos.z += uz * move; resolve(bun.pos); }
        /* 1.2초 동안 목표에 가까워지지 않으면(가구 사이에 낌) 그 자리에서 도착 처리 */
        if (dist < bun.bestD - 0.05) { bun.bestD = dist; bun.noProg = 0; } else bun.noProg = (bun.noProg || 0) + h;
        if (bun.noProg > 1.2) { arrive(); }
        const real = Math.hypot(bun.pos.x - bx, bun.pos.z - bz);
        bun.stuck = real < move * 0.25 ? bun.stuck + h : 0;
        if (bun.stuck > 0.4) arrive();
        bun.faceTarget = Math.atan2(dx, dz);
        const prev = Math.floor(bun.phase / Math.PI);
        bun.phase += h * STEP_RATE * Math.PI;
        const now = Math.floor(bun.phase / Math.PI);
        if (now !== prev) footstep(now);
        bun.gait = Math.min(1, bun.gait + h * 7);
      }
    } else {
      bun.gait = Math.max(0, bun.gait - h * 5);
      bun.idle += h;
      if (bun.idle > 2.2 && bun.lock <= 0 && Bus.mode === 'room' && !cook.on && !cook.eat) bun.faceTarget = Math.atan2(camera.position.x - bun.pos.x, camera.position.z - bun.pos.z);
    }
    bun.lock -= h;
    bun.face += wrapA(bun.faceTarget - bun.face) * Math.min(1, h * 9);

    /* jump + springs */
    if (bun.jumpV !== 0 || bun.jumpY > 0) {
      bun.jumpV -= 13 * h; bun.jumpY += bun.jumpV * h;
      if (bun.pendingOpen && bun.jumpV <= 0) { const id = bun.pendingOpen; bun.pendingOpen = null; kick(id); Bus.open(id); }
      if (bun.jumpY <= 0) { const impact = -bun.jumpV; bun.jumpY = 0; bun.jumpV = 0; bun.squash.v += impact * 1.1; if (impact > 1.5) Bus.audio.tap(); }
    }
    spring(bun.squash, 0, 190, 11, h);
    spring(bun.ear, -0.38 * bun.gait + clamp(-bun.jumpV * 0.09, -0.5, 0.5), 95, 6.5, h);
    if (!(sleep.on || sleep.k > 0 || seat.on || seat.k > 0)) stepBud(h);
    spring(fridgeDoor, fridgeDoor.target, 60, 9, h);
    stepWater(h);
    stepBath(h);
    Object.values(sections).forEach(g => { const hv = g.userData.hover; spring(hv, hv.target, 170, 12, h); });
    drawers.forEach(d => spring(d.out, d.target, 230, 15, h));
    spring(sprout.g, sprout.target, 110, 8, h);
    spring(sprout.bloom, sprout.bloom.target, 90, 6.5, h);
    stepFx(h);
    stepCook(h);
    petalBurst.forEach(p => {
      if (!p.alive) return;
      p.life += h;
      if (p.life < 0) return;
      p.m.visible = true;
      p.vel.y -= 0.6 * h; p.vel.multiplyScalar(1 - h * 0.6);
      p.m.position.addScaledVector(p.vel, h);
      p.m.position.x += Math.sin(t * 3 + p.seed) * 0.004;
      p.m.rotation.x += p.spin * h; p.m.rotation.z += p.spin * 0.7 * h;
      const k = p.life / p.max; p.m.material.opacity = 1 - clamp((k - 0.55) / 0.45, 0, 1);
      p.m.scale.setScalar(Math.min(1, p.life * 8) * p.size);
      if (p.life > p.max) { p.alive = false; p.m.visible = false; }
    });
    spring(flagS, flagS.target, 110, 7.5, h);

    /* hearts */
    hearts.forEach(p => {
      if (!p.alive) return;
      p.life += h;
      if (p.life < 0) return;
      p.m.visible = true;
      spring(p.pop, 1, 140, 9, h);
      p.vel.y += (0.9 - p.vel.y) * h * 1.6;
      p.vel.x *= 1 - h * 0.9; p.vel.z *= 1 - h * 0.9;
      p.m.position.addScaledVector(p.vel, h);
      p.m.quaternion.copy(camera.quaternion);
      p.m.rotateZ(Math.sin(t * 3 + p.spin) * 0.3);
      p.m.rotateY(p.life * p.spin);
      const s = Math.max(0.001, p.pop.x); p.m.scale.setScalar(s);
      p.m.material.opacity = 1 - clamp((p.life / p.max - 0.6) / 0.4, 0, 1);
      if (p.life > p.max) { p.alive = false; p.m.visible = false; }
    });
    puffs.forEach(p => {
      if (!p.alive) return;
      p.life += h * 2;
      const s = 0.4 + p.life * 1.4; p.m.scale.set(s, s * 0.6, s);
      p.m.position.y += h * 0.15;
      p.m.material.opacity = 0.7 * (1 - p.life);
      if (p.life >= 1) { p.alive = false; p.m.visible = false; }
    });
    rings.forEach(r => {
      if (r.t >= 1) return;
      if (r.delay > 0) { r.delay -= h; return; }
      r.t += h / 0.75;
      const s = 0.5 + ease(Math.min(r.t, 1)) * 1.6; r.m.scale.set(s, s, s);
      r.m.material.opacity = 0.9 * (1 - r.t);
      if (r.t >= 1) r.m.visible = false;
    });
  }
  /* HO2 토끼: HO1과 멀어지면 걸어서 따라가고, 너무 붙으면 살짝 비켜섬 */
  function stepBud(h){
    if (budTarget) { budGoto(h); return; }               /* 굽기·먹기 동안은 정해진 자리로 */
    /* 물 주는 동안 HO2는 앞을 가리지 않게 옆에 서서 구경함 */
    if (water.on) {
      const wx = SPOTS.secret.x + 0.9, wz = SPOTS.secret.z - 0.75;
      const ddx = wx - bun2.pos.x, ddz = wz - bun2.pos.z, dd = Math.hypot(ddx, ddz);
      if (dd > 0.08) {
        const mv = Math.min(dd, SPEED * 1.15 * h);
        bun2.pos.x += ddx / dd * mv; bun2.pos.z += ddz / dd * mv; resolve(bun2.pos);
        bun2.faceTarget = Math.atan2(ddx, ddz); bun2.moving = true;
        bun2.phase += h * STEP_RATE * Math.PI; bun2.gait = Math.min(1, bun2.gait + h * 7);
      } else {
        bun2.moving = false; bun2.gait = Math.max(0, bun2.gait - h * 5);
        bun2.faceTarget = Math.atan2(plant.position.x - bun2.pos.x, plant.position.z - bun2.pos.z);
      }
      bun2.face += wrapA(bun2.faceTarget - bun2.face) * Math.min(1, h * 9);
      spring(bun2.squash, 0, 190, 11, h);
      return;
    }
    let dx = bun.pos.x - bun2.pos.x, dz = bun.pos.z - bun2.pos.z, d = Math.hypot(dx, dz) || 1e-4;
    if (d > FOLLOW_FAR || (bun2.moving && d > FOLLOW_STOP)) {
      const move = Math.max(0, Math.min(d - FOLLOW_STOP, SPEED * 1.15 * h));
      bun2.pos.x += dx / d * move; bun2.pos.z += dz / d * move;
      resolve(bun2.pos);
      bun2.faceTarget = Math.atan2(dx, dz);
      bun2.moving = true; bun2.idle = 0;
      const prev = Math.floor(bun2.phase / Math.PI);
      bun2.phase += h * STEP_RATE * Math.PI;
      if (Math.floor(bun2.phase / Math.PI) !== prev) bun2.squash.v += 1.1;
      bun2.gait = Math.min(1, bun2.gait + h * 7);
    } else {
      if (bun2.moving) bun2.phase = Math.ceil(bun2.phase / Math.PI) * Math.PI;
      bun2.moving = false;
      bun2.gait = Math.max(0, bun2.gait - h * 5);
      bun2.idle += h;
      /* 멈추면 잠깐 HO1을 보다가, 시간이 지나면 화면 쪽을 봄 */
      bun2.faceTarget = bun2.idle > 2.6 && Bus.mode === 'room'
        ? Math.atan2(camera.position.x - bun2.pos.x, camera.position.z - bun2.pos.z)
        : Math.atan2(dx, dz);
    }
    dx = bun.pos.x - bun2.pos.x; dz = bun.pos.z - bun2.pos.z; d = Math.hypot(dx, dz) || 1e-4;
    if (d < PERSONAL) {
      const push = PERSONAL - d;
      bun2.pos.x -= dx / d * push; bun2.pos.z -= dz / d * push;
      resolve(bun2.pos);
    }
    bun2.face += wrapA(bun2.faceTarget - bun2.face) * Math.min(1, h * 9);
    if (bun2.hopDelay > 0) { bun2.hopDelay -= h; if (bun2.hopDelay <= 0) hopBud(bun2.hopV); }
    if (bun2.jumpV !== 0 || bun2.jumpY > 0) {
      bun2.jumpV -= 13 * h; bun2.jumpY += bun2.jumpV * h;
      if (bun2.jumpY <= 0) { const impact = -bun2.jumpV; bun2.jumpY = 0; bun2.jumpV = 0; bun2.squash.v += impact * 1.1; }
    }
    spring(bun2.squash, 0, 190, 11, h);
    spring(bun2.ear, -0.38 * bun2.gait + clamp(-bun2.jumpV * 0.09, -0.5, 0.5), 95, 6.5, h);
  }
  /* 물 주기 연출: 물뿌리개를 들고(0~0.35초) 기울여 붓고(~1.9초) 내려놓음(~2.4초). 붓는 동안 물방울 */
  const _dir = new V3(), _rgt = new V3(), _tip = new V3(), _cand = new V3();
  function stepWater(h){
    waterDrops.forEach(d => {
      if (!d.alive) return;
      d.vel.y -= 7 * h; d.m.position.addScaledVector(d.vel, h);
      if (d.m.position.y < FLOOR + 0.7) { d.alive = false; d.m.visible = false; }
    });
    if (!water.on) { can.visible = false; return; }
    water.t += h;
    const T = water.t, f = bun.face;
    _dir.set(Math.sin(f), 0, Math.cos(f)); _rgt.set(_dir.z, 0, -_dir.x);
    const lift = sstep(0, 0.35, T) * (1 - sstep(2.0, 2.4, T));
    const tip = sstep(0.35, 0.7, T) * (1 - sstep(1.75, 2.05, T));
    can.visible = lift > 0.01;
    can.position.set(bun.pos.x + _dir.x * 0.55 - _rgt.x * 0.2, FLOOR + 0.8 + 0.2 * lift, bun.pos.z + _dir.z * 0.55 - _rgt.z * 0.2);   /* 큰 머리에 가리지 않게 앞으로 들어 올림 */
    can.rotation.set(0, f, 0); can.rotateX(tip * 0.9);
    can.scale.setScalar(Math.max(0.001, 2.0 * lift));
    if (tip > 0.6) {
      water.dropT -= h;
      if (water.dropT <= 0) {
        water.dropT = 0.045;
        const d = waterDrops.find(x => !x.alive);
        if (d) {
          can.updateMatrixWorld(true); can.localToWorld(_tip.copy(CAN_TIP));
          d.alive = true; d.m.visible = true; d.m.position.copy(_tip);
          d.vel.copy(_dir).multiplyScalar(0.55 + Math.random() * 0.25); d.vel.x += (Math.random() - 0.5) * 0.2; d.vel.z += (Math.random() - 0.5) * 0.2; d.vel.y = -0.2;
        }
      }
    }
    if (!water.grown && T > 1.3) { water.grown = true; waterGrow(); showPlantPanel(); }
    if (T > 2.4) { water.on = false; can.visible = false; bun.idle = 0; }
  }
  function arrive(){
    bun.moving = false; bun.idle = 0; bun.stuck = 0;
    if (bun.faceAfter != null) { bun.faceTarget = bun.faceAfter; bun.lock = 3; }
    const cb = bun.onArrive; bun.onArrive = null; bun.faceAfter = null;
    if (cb) cb();
  }

  /* ---------- Ripple texture feed from the HTML slider ---------- */
  const texCache = new Map();
  let curTex = -1, pending = null, lastRipple = -10;
  /* WebGL may only sample an image that is CORS-clean. Opened from file:// (double-clicked),
     local images are never clean, so the frame keeps its pastel gradient instead of erroring. */
  function canSample(img){
    const src = img.currentSrc || img.src || '';
    if (location.protocol === 'file:') return /^https?:/i.test(src) && !!img.crossOrigin;
    try { return new URL(src, location.href).origin === location.origin || !!img.crossOrigin; } catch (e) { return false; }
  }
  function textureFor(i, img){
    if (texCache.has(i)) return texCache.get(i);
    if (img && !canSample(img)) {
      /* double-clicked page: use the bundled data-URI copy of this image, if the package ships one */
      const alt = (window.GM635_FRAME_TEXTURES || [])[i];
      if (!alt) return null;
      if (!img.__frameAlt) {
        const a = new Image();
        a.onload = () => { if (curTex === -1 && i === 0) setPicture(0, img); };
        a.src = alt; img.__frameAlt = a;
      }
      if (!img.__frameAlt.complete || !img.__frameAlt.naturalWidth) return null;
      img = img.__frameAlt;
    }
    if (!img || !img.complete || !img.naturalWidth) {
      if (img && !img.dataset.wait) { img.dataset.wait = '1'; img.addEventListener('load', () => { if (curTex === -1 && i === 0) setPicture(0, img); }, { once: true }); }
      return null;
    }
    const tex = new THREE.Texture(img);
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    const ia = img.naturalWidth / img.naturalHeight, pa = PW / PH;
    const cover = ia > pa ? new THREE.Vector2(pa / ia, 1) : new THREE.Vector2(1, ia / pa);
    const entry = { tex, cover }; texCache.set(i, entry); return entry;
  }
  function setPicture(i, img, u, v){
    const e = textureFor(i, img); if (!e || i === curTex) return;
    if (curTex === -1 && rippleU.uHasA.value === 0) {
      rippleU.uTexA.value = e.tex; rippleU.uCoverA.value.copy(e.cover); rippleU.uHasA.value = 1; curTex = i; return;
    }
    rippleU.uTexB.value = e.tex; rippleU.uCoverB.value.copy(e.cover); rippleU.uHasB.value = 1;
    rippleU.uWipe.value.set(u == null ? 0.5 : u, v == null ? 0.5 : 1 - v);
    rippleU.uMix.value = 0; pending = i; curTex = i;
  }
  const galleryImgs = document.querySelectorAll('#track img');
  if (galleryImgs[0]) setPicture(0, galleryImgs[0]);
  function startRipple(u, v, amp){
    rippleU.uOrigin.value.set(u, 1 - v);
    rippleU.uStart.value = rippleU.uTime.value;
    rippleU.uAmp.value = (reduced() ? 0.3 : 1) * amp;
    lastRipple = rippleU.uTime.value;
  }

  /* ---------- Engine API for the UI layer ---------- */
  const engine = {
    focus(id, onReveal){
      if (sleep.on) wakeUp();
      cancelCook();                                       /* 메뉴를 열면 요리 취소 */
      focusId = id;
      setHovered(null);
      const s = SPOTS[id];
      walkTo(s.x, s.z, s.face);
      if (id === 'gallery') rippleU.uIdle.value = reduced() ? 0 : 1;
      fly(() => focusPose(id), id === 'hero' ? 1.35 : 1.2, id === 'hero' ? 0.35 : 0.9, onReveal, null);
      if (reduced() && onReveal) setTimeout(onReveal, 360);
    },
    home(){
      focusId = null;
      drawers.forEach(d => { d.target = 0; });
      fly(homePose, 1.15, 0.9, null, () => { controls.target.copy(HOME_T); lookTarget.copy(HOME_T); controls.enabled = true; controls.update(); });
    },
    resetView(){ if (Bus.mode === 'room') fly(homePose, 0.9, 0.3, null, () => { controls.target.copy(HOME_T); lookTarget.copy(HOME_T); controls.enabled = true; controls.update(); }); },
    ripple(i, u, v, img){ setPicture(i, img, u, v); startRipple(u, v, 0.12); },
    setTvImage,
    sit: sitDown, stand: standUp, water: goWater, fridge: toggleFridge, replant, butterfly: flyButterfly,
    bake: startCook, cookMenu: openCookMenu, eatTray, cancelCook,
    get cookState(){ return { on: cook.on, ready: cook.ready, t: +cook.t.toFixed(2), result: cook.result, eat: !!cook.eat, faces: [bun.expr || '-', bun.bite || 0, bun2.expr || '-', bun2.bite || 0].join(','), tray: tray ? tray.kind + ':' + tray.cookies.filter(c => c.visible).length : null }; },
    get state(){ return { seat: Object.assign({}, seat), water: water.on, sprout: sprout.stage, fridge: fridgeDoor.target, bun: [bun.pos.x, bun.pos.z, bun.moving], bun2: [bun2.pos.x, bun2.pos.z] }; },
    rippleMove(i, u, v){ if (rippleU.uTime.value - lastRipple > 0.55) startRipple(u, v, 0.08); },
    drawer(i, on){ if (drawers[i]) { drawers[i].target = on ? 0.62 : 0; if (on) drawers[i].out.v += 1.5; } },
    grow(stage){
      sprout.stage = stage; sprout.target = stage / 3; sprout.g.v += 1.2;
      hop(2.6);
    },
    bloom(){
      sprout.bloom.target = 1; sprout.bloom.v += 2;
      burstPetals(reduced() ? 6 : 18);
      hop(4.6);
    },
    get sprout(){ return { stage: sprout.stage, g: sprout.g.x, bloom: sprout.bloom.x }; },
    celebrate(){
      hop(4.6);
      spawnHearts(reduced() ? 2 : 5);
      flagS.target = 0; flagS.v -= 6;
      setTimeout(() => { flagS.target = -1.45; }, 3200);
    },
    project(id){
      const g = sections[id]; if (!g) return null;
      const p = id === 'mail' ? mail.localToWorld(new V3(0, 1.2, 0.4)) : g.localToWorld(g.userData.anchor.clone());
      return toScreen(p);
    },
    get bunny(){ return { x: bun.pos.x, z: bun.pos.z, moving: bun.moving, jumpY: bun.jumpY }; },
    walkTo,
    pick,
    get camera(){ return camera; },
    get flying(){ return fl.active; },
    jump: jumpAction,
    bathPlay: k => ({ ho1: bathSplashFight, ho2: bathFoamHat, duck: bathDuckSqueak })[k](),
    get near(){ return nearSection(); },
    get heartsAlive(){ return hearts.filter(h => h.alive && h.m.visible).length; }
  };
  function toScreen(v){
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }

  /* ---------- Resize ---------- */
  let lastAspect = camera.aspect;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    setDistanceLimits();
    if (Bus.mode === 'room' && !fl.active && Math.abs(camera.aspect - lastAspect) / lastAspect > 0.15) {
      const p = homePose(); camera.position.copy(p.pos); controls.target.copy(p.tgt); lookTarget.copy(p.tgt); controls.update();
    }
    lastAspect = camera.aspect;
  });

  /* ---------- Frame loop ---------- */
  const clock = new THREE.Clock();
  let acc = 0, time = 0, screenT = 0;
  const parallax = new V3(), parTarget = new V3();
  const tmp = new V3();
  window.addEventListener('pointermove', e => {
    parTarget.set((e.clientX / window.innerWidth - 0.5) * 0.08, -(e.clientY / window.innerHeight - 0.5) * 0.05, 0);
  }, { passive: true });

  /* 토끼 한 마리의 모양(걷기·숨쉬기·눈 깜빡임·그림자)을 상태값에 맞춤 */
  function poseBunny(P, s, dt, still){
    const se = ease(sleep.k), sk = seat.where ? ease(seat.k) : 0;
    if (se > 0 && s.bedSlot) {
      /* 침대로 폴짝 올라가 등을 대고 누움 (머리는 헤드보드 쪽) */
      const arc = Math.sin(Math.PI * se) * 0.7;
      P.bunny.position.set(mix(s.pos.x, s.bedSlot.x, se), mix(FLOOR + 0.02, s.bedSlot.y, se) + arc, mix(s.pos.z, s.bedSlot.z, se));
      P.bunny.rotation.set(-Math.PI / 2 * se, s.face + wrapA(bedYaw - s.face) * se, 0);
    } else if (sk > 0) {
      /* 소파·의자로 폴짝 올라가 앉음 (HO1 = 첫 자리, HO2 = 둘째 자리) */
      const S = SEATS[seat.where], i = s === bun ? 0 : 1, slot = S.slots[i];
      const arc = Math.sin(Math.PI * sk) * 0.45;
      P.bunny.position.set(mix(s.pos.x, slot.x, sk), mix(FLOOR + 0.02, slot.y, sk) + arc, mix(s.pos.z, slot.z, sk));
      P.bunny.rotation.set(0, s.face + wrapA(S.yaw[i] - s.face) * sk, 0);
    } else {
      P.bunny.position.set(s.pos.x, FLOOR + 0.02, s.pos.z);
      P.bunny.rotation.set(0, s.face, 0);
    }
    const wave = Math.sin(s.phase);
    P.bob.position.y = (still ? 0 : Math.abs(wave) * 0.13 * s.gait) + s.jumpY;
    P.tilt.rotation.z = still ? 0 : Math.cos(s.phase) * 0.13 * s.gait;
    P.tilt.rotation.x = s.gait * 0.08;
    /* 굽기 연출: 반죽 저을 때 몸 좌우 흔들기, 흠칫·부르르 떨림 */
    if (s.fx) {
      P.tilt.rotation.z += s.fx.sway || 0;
      P.bob.position.x = s.fx.shiver > 0 && !still ? Math.sin(time * 70) * 0.035 * Math.min(1, s.fx.shiver) : 0;
    }
    const breathe = still ? 0 : Math.sin(time * (2.4 - se) + (s.breathSeed || 0)) * (0.012 + 0.018 * se) * (1 - s.gait);
    const sq = clamp(s.squash.x, -0.28, 0.28);
    P.bob.scale.set(1 + sq * 0.55, 1 - sq + breathe, 1 + sq * 0.55);
    P.feet.forEach((f, i) => {
      const lift = s.gait * Math.max(0, i ? -wave : wave) * 0.11;
      f.position.y = 0.06 + lift + s.jumpY * 0.9 + 0.08 * sk;
      f.position.z = 0.1 + (still ? 0 : Math.max(0, i ? -wave : wave) * 0.08 * s.gait) + 0.2 * sk;   /* 앉으면 발을 앞으로 */
    });
    P.ears.forEach(e => { e.rotation.x = s.ear.x * (P.sway == null ? 1 : P.sway); e.rotation.z = -e.userData.side * (0.08 + (still ? 0 : Math.sin(time * 1.7 + e.userData.side + (s.breathSeed || 0)) * 0.05)); });
    s.blinkT -= dt;
    const blinking = s.blinkT < 0.16;
    P.eyes.forEach(e => { e.scale.y = blinking || se > 0.8 ? 0.12 : 1; });   /* 자는 동안은 눈 감음 */
    if (s.blinkT < 0) s.blinkT = Math.random() < 0.25 ? 0.4 : 2.0 + Math.random() * 2.2;   /* 가끔 두 번 연속 깜빡 */
    /* 쿠키 먹는 표정: s.expr = 'smile' | 'yuck' | null, s.bite = 손에 남은 쿠키(3~0), s.chew = 오물오물 */
    const F = P.faceFx;
    if (F) {
      const ex = s.expr || null, chew = (s.chew || 0) > 0 && !still ? Math.abs(Math.sin(time * 16)) : 0;
      P.eyes.forEach(e => { e.visible = !ex; });
      F.happyEyes.forEach(g => { g.visible = ex === 'smile'; });
      F.yuckEyes.forEach(g => { g.visible = ex === 'yuck'; });
      F.smile.visible = ex === 'smile'; F.frown.visible = ex === 'yuck'; F.sweat.visible = ex === 'yuck';
      F.smile.scale.set(1, 1 + chew * 0.5, 1); F.frown.scale.set(1 - chew * 0.2, 1 + chew * 0.6, 1);
      if (ex === 'yuck') F.sweat.position.y = HY + 0.12 - ((time * 0.25) % 0.12);
      const b = s.bite || 0;
      F.snack.visible = b > 0;
      if (b > 0) F.snackC.scale.setScalar([0, 0.45, 0.72, 1][b]);
    }
    /* 목욕: 욕조에 들어가면 옷을 벗음(몸통·발 = 살색, 깃·넥타이 숨김) + 머리에 수건.
       오래 있으면 볼이 빨개짐(s.flush 0~1), 거품 모자(s.foam 0~1) */
    const BW = P.bathWear;
    if (BW) {
      const bare = seat.where === 'bath' && seat.k > 0.55;
      if (BW.bare !== bare) {
        BW.bare = bare;
        BW.body.material.color.setHex(bare ? SKIN : BW.shirt);
        BW.collar.visible = BW.tie.visible = !bare;
        P.feet.forEach(f => f.material.color.setHex(bare ? SKIN : COL.white));
      }
      BW.towel.visible = bare;
      const fh = s.foam || 0;
      BW.foamHat.visible = fh > 0.02;
      BW.foamHat.scale.setScalar(Math.max(0.001, fh * (1 + (still ? 0 : Math.sin(time * 3) * 0.04))));
      const fl2 = s.flush || 0;
      BW.cheeks.forEach(ch => { ch.material.color.setHex(BW.cheek).lerp(FLUSH_COL, fl2 * 0.8); ch.scale.set(1 + fl2 * 0.35, 0.55 + fl2 * 0.2, 0.35); });
    }
    P.shadow.position.set(P.bunny.position.x, FLOOR + 0.035, P.bunny.position.z);
    const ss = 1 - Math.min(s.jumpY, 1.2) * 0.4; P.shadow.scale.set(ss, ss, ss);
    P.shadow.material.opacity = ss * (1 - se) * (1 - 0.6 * sk);
  }

  let perfN = 0, perfSum = 0, perfStage = 0;
  function adapt(raw){
    if (perfStage > 1) return;
    perfN++; perfSum += raw;
    if (perfN < 90) return;
    const avg = perfSum / perfN; perfN = 0; perfSum = 0;
    if (avg > 0.034) {
      perfStage++;
      renderer.setPixelRatio(Math.max(perfStage > 1 ? 0.75 : 1, renderer.getPixelRatio() - 0.5));
      if (perfStage > 1) { renderer.shadowMap.type = THREE.PCFShadowMap; key.shadow.mapSize.set(1024, 1024); key.shadow.map && key.shadow.map.dispose(); key.shadow.map = null; }
      renderer.setSize(window.innerWidth, window.innerHeight);
    } else perfStage = 2;
  }
  function frameLoop(){
    const rawDt = clock.getDelta();
    adapt(rawDt);
    const dt = Math.min(rawDt, 0.1);
    time += dt;
    acc += dt;
    let n = 0;
    while (acc >= H && n < 8) { step(H, time); acc -= H; n++; }
    if (n === 8) acc = 0;
    const still = reduced();

    /* bunny pose */
    poseBunny(B1, bun, dt, still);
    poseBunny(B2, bun2, dt, still);

    if (edit.sel) { selRing.position.set(edit.sel.g.position.x, FLOOR + 0.03, edit.sel.g.position.z); selRing.scale.setScalar(edit.sel.r); }

    /* 목욕 연출: 거품 부풀기, 오리 둥실, 비눗방울, 번갈아 한마디 */
    {
      const inBath = seat.where === 'bath';
      bathFx.k = inBath ? ease(seat.k) : Math.max(0, bathFx.k - dt * 2);
      const fk = bathFx.k;
      bathFoam.forEach(f => {
        const w = still ? 0 : Math.sin(time * 2 + f.userData.seed) * 0.06;
        f.visible = fk > 0.01; f.scale.setScalar(Math.max(0.001, fk * (1 + w)));
      });
      bathWater.position.y = 0.52 + fk * 0.04;
      bathDuck.position.y = 0.56 + fk * 0.06 + (still ? 0 : Math.sin(time * 2.2) * 0.012) + bathFx.duck.y / 1.2;
      bathDuck.rotation.z = still ? 0 : Math.sin(time * 1.6) * 0.12;
      bathDuck.rotation.y = -0.6 + bathFx.duck.spin;
      if (inBath && seat.on && seat.k >= 1) {
        bathFx.bubT -= dt;
        if (bathFx.bubT <= 0 && !still) {
          bathFx.bubT = 0.35 + Math.random() * 0.4;
          const b = bathBubbles.find(x => !x.alive);
          if (b) {
            b.alive = true; b.life = 0; b.max = 1.8 + Math.random(); b.sz = 0.6 + Math.random() * 0.9;
            b.m.position.copy(bath.localToWorld(new V3((Math.random() - 0.5) * 1.3, 0.62, (Math.random() - 0.5) * 0.6)));
            b.vel.set((Math.random() - 0.5) * 0.25, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.25);
            b.m.visible = true;
          }
        }
        if (bathFx.talkT > 0) {
          bathFx.talkT -= dt;
          if (bathFx.talkT <= 0 && bathBusy()) bathFx.talkT = 3;   /* 반응 중이면 잠깐 미룸 */
          else if (bathFx.talkT <= 0) {
            const t = BATH_TEXT[bathFx.talk++ % BATH_TEXT.length];
            bsay('ho1', t[0], 'ok', 2);
            setTimeout(() => { if (seat.where === 'bath' && seat.on) bsay('ho2', t[1], 'emo', 1.8); }, 700);
            spawnHearts(1); bathFx.talkT = 6;
          }
        }
      } else if (!(inBath && seat.on) && (bathFx.talkT !== 0 || fk > 0)) {   /* 욕조에서 나오면 말풍선 정리 */
        bathFx.talkT = 0;
        ['ho1', 'ho2'].forEach(w => { if (!bubs[w].hidden && bathSaid.has(bubs[w].textContent)) hush(w); });
      }
      bathBubbles.forEach(b => {
        if (!b.alive) return;
        b.life += dt;
        const u = b.life / b.max;
        if (u >= 1) { b.alive = false; b.m.visible = false; return; }
        b.m.position.addScaledVector(b.vel, dt);
        b.m.position.x += Math.sin(time * 3 + b.max * 7) * 0.003;
        b.m.scale.setScalar(b.sz * (u < 0.15 ? u / 0.15 : u > 0.9 ? 1 + (u - 0.9) * 4 : 1));
        b.m.material.opacity = u > 0.9 ? 0.55 * (1 - (u - 0.9) * 10) : 0.55;
      });
    }

    /* 잠자기 연출: 이불 덮기, 방 어둡게, Zzz */
    {
      const n = ease(sleep.k);
      blanket.position.set(0, mix(0.67, 1.05, n), mix(0.85, 0.5, n));
      blanket.scale.set(1, mix(0.2, 1, n), mix(0.36, 0.95, n));
      hemi.intensity = 1.4 * (1 - 0.55 * n);
      key.intensity = 1.35 * (1 - 0.6 * n);
      fill.intensity = 0.55 * (1 - 0.3 * n);
      bedLamp.intensity = 2.2 * n;
      lampLight.intensity = 0.6 + 1.4 * n;
      lampShade.material.emissiveIntensity = 0.35 + 0.5 * n;
      renderer.toneMappingExposure = 1.05 * (1 - 0.2 * n);
      if (sleep.on && sleep.k >= 1) {
        sleep.zT -= dt;
        if (sleep.zT <= 0) {
          sleep.zT = 0.9;
          const z = zs[sleep.zi++ % zs.length], slot = (sleep.zi % 2 ? bun : bun2).bedSlot;
          z.life = 0; z.from.set(slot.x - Math.sin(bedYaw), slot.y + 0.55, slot.z - Math.cos(bedYaw)); z.sp.visible = true;
        }
      }
      zs.forEach(z => {
        if (z.life >= 1) { z.sp.visible = false; return; }
        z.life = Math.min(1, z.life + dt / 2.2);
        z.sp.position.set(z.from.x + 0.3 * z.life, z.from.y + 0.9 * z.life, z.from.z - 0.1 * z.life);
        z.sp.scale.setScalar(0.22 + 0.18 * z.life);
        z.sp.material.opacity = Math.sin(Math.PI * z.life);
      });
    }

    /* ambient page decor: fades away while a section is open */
    amb += ((Bus.mode === 'room' ? 1 : 0) - amb) * Math.min(1, dt * (still ? 20 : 3.5));
    gridMat.uniforms.uFade.value = amb;
    floatShadow.material.opacity = 0.55 + 0.45 * amb;
    ambient.forEach((a, i) => {
      const k = amb < 0.01 ? 0 : amb;
      a.g.visible = k > 0;
      a.g.scale.setScalar(a.s * (0.6 + 0.4 * k) * (k > 0 ? 1 : 0));
      a.g.position.set(a.base.x, a.base.y + (still ? 0 : Math.sin(time * 0.6 + a.seed) * 0.25) - (1 - k) * 0.8, a.base.z + (still ? 0 : Math.cos(time * 0.4 + a.seed) * 0.2));
      if (a.spin) a.g.rotation.set(0.2, still ? 0.6 : time * a.spin + a.seed, still ? 0 : Math.sin(time + a.seed) * 0.2);
      else a.g.rotation.y = still ? 0 : Math.sin(time * 0.2 + a.seed) * 0.15;
    });

    /* section objects: hover jelly + idle motion, and the jump-reach glow */
    const nearRaw = Bus.mode === 'room' && !fl.active && !sleep.on && !seat.on && seat.k === 0 ? nearSection() : null;   /* 앉거나 자는 중엔 '열기' 말풍선 안 띄움 */
    const nearId = nearRaw && !TRIG[nearRaw].hidden ? nearRaw : null;
    Object.values(sections).forEach(g => {
      const hv = g.userData.hover;
      hv.target = (hovered === g.userData.section || nearId === g.userData.section) && Bus.mode === 'room' ? 1 : 0;
      const s = 1 + hv.x * 0.045;
      g.scale.set(g.userData.baseScale.x * s, g.userData.baseScale.y * (1 + hv.x * 0.06), g.userData.baseScale.z * s);
      const glow = Math.max(0, hv.x) * 0.16;
      g.userData.mats.forEach(m => { if (!m.userData.base) m.userData.base = { e: m.emissive.clone(), i: m.emissiveIntensity }; if (m.userData.base.i > 0.05) return; m.emissive.copy(m.color); m.emissiveIntensity = glow; });
    });
    frame.position.y = 2.75 + (still ? 0 : Math.sin(time * 1.1) * 0.07);
    frame.rotation.z = still ? 0 : Math.sin(time * 0.8) * 0.018;
    drawers.forEach(d => { d.g.position.z = 0.52 + d.out.x; });
    fridgePivot.rotation.y = -fridgeDoor.x;                                        /* 냉장고 문 (왼쪽 경첩 기준 회전) */
    fridgeGlow.material.emissiveIntensity = 0.9 * clamp(fridgeDoor.x / 1.2, 0, 1);  /* 열리면 안이 환해짐 */
    poseSprout();
    flowerHead.rotation.z = (still ? 0 : Math.sin(time * 1.3) * 0.08 * (0.3 + sprout.g.x)) + sway.x * 0.35;   /* 물 주면 살랑 */
    leafG.rotation.z = sway.x * 0.1;
    /* 물 주기 패널: 화분 위에 붙어 다님, 9초 뒤 사라짐 */
    if (!plantPanel.hidden) {
      if (performance.now() > ppUntil) plantPanel.hidden = true;
      else {
        const s = toScreen(plant.localToWorld(tmp.set(0, 2.3, 0)));
        plantPanel.style.left = Math.min(Math.max(s.x, 150), window.innerWidth - 150) + 'px';
        plantPanel.style.top = Math.max(s.y, 120) + 'px';
      }
    }
    petalRing.rotation.z = still ? 0 : time * 0.25 * sprout.bloom.x;
    flag.rotation.x = flagS.x;
    tvGlow.intensity = 2.2 + (still ? 0 : Math.sin(time * 2) * 0.5);
    halo.material.opacity = 0.45 + (still ? 0 : Math.sin(time * 2) * 0.1);
    screenT += dt;
    if (screenT > 1 / 12) { screenT = 0; drawScreen(time); }

    /* ripple plane */
    rippleU.uTime.value = time;
    if (pending !== null) {
      rippleU.uMix.value = Math.min(1, rippleU.uMix.value + dt * (still ? 6 : 1.6));
      if (rippleU.uMix.value >= 1) {
        rippleU.uTexA.value = rippleU.uTexB.value; rippleU.uCoverA.value.copy(rippleU.uCoverB.value); rippleU.uHasA.value = 1;
        rippleU.uMix.value = 0; pending = null;
      }
    }

    /* sparkles */
    if (!still) {
      for (let i = 0; i < SPARK; i++) {
        const s = sparkSeed[i];
        sparkPos[i * 3] = sparkBase[i * 3] + Math.sin(time * 0.3 + s) * 0.25;
        sparkPos[i * 3 + 1] = sparkBase[i * 3 + 1] + Math.sin(time * 0.5 + s * 2) * 0.3;
        sparkPos[i * 3 + 2] = sparkBase[i * 3 + 2] + Math.cos(time * 0.35 + s) * 0.25;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    /* camera */
    if (fl.active) {
      fl.t = Math.min(1, (performance.now() - fl.start) / 1000 / fl.dur);
      const e = ease(fl.t), d = fl.dest();
      camera.position.lerpVectors(fl.fromP, d.pos, e);
      camera.position.y += Math.sin(Math.PI * e) * fl.arc;
      lookTarget.lerpVectors(fl.fromT, d.tgt, e);
      camera.lookAt(lookTarget);
      if (!fl.midFired && fl.t >= 0.58) { fl.midFired = true; if (fl.mid) fl.mid(); }
      if (fl.t >= 1) { fl.active = false; const cb = fl.done; fl.done = null; if (cb) cb(); }
    } else if (focusId && Bus.mode === focusId) {
      parallax.lerp(still ? tmp.set(0, 0, 0) : parTarget, Math.min(1, dt * 3));
      const p = focusPose(focusId);
      const right = new V3().subVectors(p.tgt, p.pos).normalize().cross(camera.up).normalize();
      const scale = focusId === 'hero' ? 0.25 : 1;
      camera.position.copy(p.pos).addScaledVector(right, parallax.x * scale).add(tmp.set(0, parallax.y * scale, 0));
      lookTarget.copy(p.tgt);
      camera.lookAt(lookTarget);
    } else if (controls.enabled) {
      if (zoomDist != null) {
        const cur = camera.position.distanceTo(controls.target);
        let nd = still ? zoomDist : cur + (zoomDist - cur) * (1 - Math.exp(-dt * 9));
        if (Math.abs(zoomDist - nd) < 0.002) { nd = zoomDist; zoomDist = null; }
        camera.position.sub(controls.target).setLength(nd).add(controls.target);
      }
      controls.update();
      lookTarget.copy(controls.target);
    }

    /* hover pick (room only, mouse) */
    if (hoverXY && !hoverXY.touch && Bus.mode === 'room' && !fl.active && !edit.on) {
      const hp2 = pick(hoverXY.x, hoverXY.y);
      setHovered(hp2 && hp2.type === 'section' ? hp2.id : null);
      if (hp2 && /^(bunny|buddy|bed|sofa|table|bath|fridge|plant|kitchen|tray)$/.test(hp2.type)) renderer.domElement.style.cursor = 'pointer';
    }

    /* HTML hotspots follow their 3D anchors */
    const showHot = Bus.mode === 'room' && !fl.active;
    for (const id in hotspotEls) {
      const el = hotspotEls[id], g = sections[id];
      /* 메뉴가 아닌 말풍선(주방 = 요리하기)은 가구 위 자리 */
      const s = toScreen(g ? g.localToWorld(tmp.copy(g.userData.anchor)) : kitchen.localToWorld(tmp.set(-0.25, 1.15, 0.3)));
      const off = s.behind || s.x < -40 || s.x > window.innerWidth + 40 || s.y < 20 || s.y > window.innerHeight;
      el.classList.toggle('is-hidden', !showHot || off || (!g && (cook.on || !!cook.eat || !cookMenu.hidden || !bubs.ho1.hidden || !bubs.ho2.hidden)));   /* 요리 중엔 '요리하기' 숨김 */
      el.classList.toggle('is-near', id === nearId);
      const half = (el.offsetWidth || 0) / 2, cx = Math.min(Math.max(s.x, half + 8), window.innerWidth - half - 8);
      el.style.setProperty('--tail', (s.x - cx).toFixed(1) + 'px');
      el.style.setProperty('--x', cx.toFixed(1) + 'px');
      el.style.setProperty('--y', s.y.toFixed(1) + 'px');
    }

    placeCookUI();
    /* 확인용 근접 카메라: 주소 끝에 ?closeup=ho1 (또는 ho2) &yaw=각도 &d=거리 */
    if (CLOSEUP) {
      const B = CLOSEUP.who === 'ho2' ? B2 : B1, O = B === B1 ? B2 : B1;
      O.bunny.visible = false; O.shadow.visible = false;
      document.body.classList.add('closeup');
      const c = B.head.getWorldPosition(new V3());
      const yaw = B.bunny.rotation.y + CLOSEUP.yaw;
      camera.position.set(c.x + Math.sin(yaw) * CLOSEUP.d, c.y + CLOSEUP.h, c.z + Math.cos(yaw) * CLOSEUP.d);
      camera.lookAt(c.x, c.y - 0.1, c.z);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frameLoop);
  }
  const CLOSEUP = (() => {
    const s = new URLSearchParams(location.search), who = s.get('closeup');
    if (!who) return null;
    return { who, yaw: +(s.get('yaw') || 0), d: +(s.get('d') || 3.2), h: +(s.get('h') || 0.35) };
  })();

  /* 서버에 저장된 TV 화면 그림 불러오기 */
  if (PB && PB.sb) PB.sb.from('settings').select('value').eq('key', 'tv_image').maybeSingle().then(r => { const p = r.data && r.data.value && r.data.value.path; if (p) setTvImage(PB.mediaUrl(p)); }, () => {});
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); });
  Bus.attach(engine);
  requestAnimationFrame(frameLoop);
}
})();
