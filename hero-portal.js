// Hero-ul primei pagini: cod sursa -> fragmente -> particule -> retea -> portal.
// Condus doar de scroll. createHero(container, opts) -> { setProgress, jumpTo, setActiv, dispose } | null
//
// Portat din designul „CodeCare Homepage v2" (Claude Design). Doua schimbari fata
// de original: three.js vine de pe jsdelivr (site-ul nu are bundler), iar
// `setActiv(false)` opreste bucla de desenare cand hero-ul nu mai e pe ecran —
// altfel cele 11.000 de particule s-ar recalcula la fiecare cadru cat timp
// vizitatorul citeste restul paginii.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const CODE_LINES = [
  'const digitalProduct = {',
  '  idea: true,',
  '  design: true,',
  '  code: true,',
  '  possibilities: Infinity',
  '}'
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function pathVal(p, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, v0] = stops[i], [p1, v1] = stops[i + 1];
    if (p <= p1) return mix(v0, v1, smooth(p0, p1, p));
  }
  return stops[stops.length - 1][1];
}

function sprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function sampleCode(step) {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 560;
  const x = c.getContext('2d');
  const lh = 74, ox = 90, oy = 70;
  x.fillStyle = '#fff';
  x.textBaseline = 'top';
  x.font = '500 56px "JetBrains Mono", ui-monospace, monospace';
  CODE_LINES.forEach((l, i) => x.fillText(l, ox, oy + i * lh));
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y += step) {
    for (let px = 0; px < c.width; px += step) {
      if (d[(y * c.width + px) * 4 + 3] > 130) pts.push([px, y, Math.floor((y - oy) / lh)]);
    }
  }
  // Textul e scris aliniat la stanga, deci centrul canvasului nu e centrul
  // codului: in design, blocul apărea deplasat spre stanga. Centram dupa
  // conturul punctelor efectiv desenate.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const cx = pts.length ? (minX + maxX) / 2 : c.width / 2;
  const cy = pts.length ? (minY + maxY) / 2 : c.height / 2;
  return { pts, w: c.width, h: c.height, rows: CODE_LINES.length, cx, cy };
}

export function createHero(container, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;

  const mobile = window.matchMedia('(max-width: 820px)').matches;
  const dpr = Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04040a, 0.085);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 60);
  camera.position.set(0, 0, 5.4);

  const COUNT = mobile ? 3200 : 11000;
  const NODES = mobile ? 70 : 150;
  const sample = sampleCode(mobile ? 4 : 3);
  const worldW = 6.6;
  const s = worldW / sample.w;

  const A = new Float32Array(COUNT * 3); // cod
  const B = new Float32Array(COUNT * 3); // nor de fragmente
  const C = new Float32Array(COUNT * 3); // retea
  const D = new Float32Array(COUNT * 3); // colaps
  const E = new Float32Array(COUNT * 3); // portal
  const seed = new Float32Array(COUNT);
  const col = new Float32Array(COUNT * 3);
  const pos = new Float32Array(COUNT * 3);

  const PW = 2.15, PH = 3.35; // dimensiunile cadrului portalului

  for (let i = 0; i < COUNT; i++) {
    const sp = sample.pts[(Math.random() * sample.pts.length) | 0] || [640, 280, 2];
    A[i * 3] = (sp[0] - sample.cx) * s;
    A[i * 3 + 1] = -(sp[1] - sample.cy) * s;
    A[i * 3 + 2] = (sp[2] - (sample.rows - 1) / 2) * 0.26 + (Math.random() - 0.5) * 0.05;

    const ang = Math.random() * Math.PI * 2;
    const rad = 0.7 + Math.pow(Math.random(), 0.6) * 4.2;
    B[i * 3] = Math.cos(ang) * rad;
    B[i * 3 + 1] = Math.sin(ang) * rad * 0.75;
    B[i * 3 + 2] = -7 + Math.random() * 9;

    if (i < NODES) {
      const k = i + 0.5;
      const phi = Math.acos(1 - 2 * k / NODES);
      const th = Math.PI * (1 + Math.sqrt(5)) * k;
      const r = 1.75 + Math.random() * 0.25;
      C[i * 3] = Math.cos(th) * Math.sin(phi) * r;
      C[i * 3 + 1] = Math.sin(th) * Math.sin(phi) * r * 0.95;
      C[i * 3 + 2] = Math.cos(phi) * r;
    } else {
      const a2 = Math.random() * Math.PI * 2, r2 = 2.3 + Math.random() * 3.2;
      const y2 = (Math.random() - 0.5) * 5;
      C[i * 3] = Math.cos(a2) * r2;
      C[i * 3 + 1] = y2;
      C[i * 3 + 2] = Math.sin(a2) * r2 - 1;
    }

    const ac = Math.random() * Math.PI * 2, rc = Math.pow(Math.random(), 2) * 0.32;
    D[i * 3] = Math.cos(ac) * rc;
    D[i * 3 + 1] = Math.sin(ac) * rc;
    D[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

    // Finalul: in design particulele se asezau pe conturul unui cadru de portal.
    // Cu camera aproape, cadrul era mai inalt decat ecranul si din el ramaneau
    // doar doua dungi verticale la marginile ecranului. Acum se imprastie spre
    // camera, ca o trecere prin ele, si dispar.
    const ae = Math.random() * Math.PI * 2;
    const be = Math.acos(2 * Math.random() - 1);
    const re = 3 + Math.random() * 5;
    E[i * 3] = Math.sin(be) * Math.cos(ae) * re;
    E[i * 3 + 1] = Math.sin(be) * Math.sin(ae) * re * 0.8;
    E[i * 3 + 2] = Math.cos(be) * re * 0.6 + 1.5;

    seed[i] = Math.random();
    const accent = Math.random() < 0.05;
    col[i * 3] = accent ? 0.49 : 0.95;
    col[i * 3 + 1] = accent ? 0.91 : 0.95;
    col[i * 3 + 2] = accent ? 0.88 : 0.92;
    pos[i * 3] = A[i * 3]; pos[i * 3 + 1] = A[i * 3 + 1]; pos[i * 3 + 2] = A[i * 3 + 2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: mobile ? 0.045 : 0.034, map: sprite(), vertexColors: true, transparent: true,
    opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: true
  }));
  scene.add(points);

  // legaturile dintre particulele-nod
  const pairs = [];
  for (let i = 0; i < NODES; i++) {
    for (let j = i + 1; j < NODES; j++) {
      const dx = C[i * 3] - C[j * 3], dy = C[i * 3 + 1] - C[j * 3 + 1], dz = C[i * 3 + 2] - C[j * 3 + 2];
      if (Math.hypot(dx, dy, dz) < 1.15) pairs.push(i, j);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(pairs.length * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd8d8d4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // cadrul portalului
  const frame = new THREE.Group();
  const fmat = new THREE.MeshBasicMaterial({ color: 0xf4f4f0, transparent: true, opacity: 0, fog: false });
  const bar = 0.055;
  const mk = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fmat); m.position.set(x, y, 0); frame.add(m); };
  mk(PW + bar, bar, 0, PH / 2);
  mk(PW + bar, bar, 0, -PH / 2);
  mk(bar, PH + bar, -PW / 2, 0);
  mk(bar, PH + bar, PW / 2, 0);
  scene.add(frame);
  // Invizibil: barele albe erau exact dungile gri de la marginile ecranului.
  // Grupul ramane in scena doar ca onFrame sa primeasca in continuare un reper.
  frame.visible = false;

  // Stelele din spatele titlului, in locul grilei care statea inainte in
  // fundal. Apar cand particulele de la scroll dispar (p 0,86–0,97). Stau intr-un
  // grup care urmeaza camera pe axa z, deci o inconjoara oricat ar inainta ea,
  // si curg incet spre camera: cele apropiate sunt mai mari si trec mai repede,
  // cele departate abia se misca — de aici adancimea. Pe desktop grupul se
  // deplaseaza putin dupa mouse, iar deplasarea se vede mai mult la stelele
  // apropiate (paralaxa reala, nu o rotatie a imaginii).
  const STELE = mobile ? 600 : 1800;
  const ADANC = 45;
  const stelePos = new Float32Array(STELE * 3);
  const steleCol = new Float32Array(STELE * 3);
  const steleNuanta = new Float32Array(STELE * 3);
  const steleLum = new Float32Array(STELE * 2); // stralucirea de baza, faza clipirii
  let spanX = 1, spanY = 1, aspectStele = 0;

  const pozitioneazaSteaua = (i, departe) => {
    const z = departe
      ? -(ADANC - Math.random() * 6)
      : -(2 + Math.pow(Math.random(), 0.75) * (ADANC - 2));
    stelePos[i * 3] = (Math.random() * 2 - 1) * spanX * -z;
    stelePos[i * 3 + 1] = (Math.random() * 2 - 1) * spanY * -z;
    stelePos[i * 3 + 2] = z;
  };
  // Imprastiate cat vede camera (plus o margine), altfel pe un telefon tinut
  // vertical trei sferturi dintre ele ar fi in afara ecranului.
  const aseazaStelele = () => {
    const tg = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
    spanX = tg * Math.max(camera.aspect, 0.3);
    spanY = tg;
    for (let i = 0; i < STELE; i++) pozitioneazaSteaua(i, false);
  };

  for (let i = 0; i < STELE; i++) {
    const r = Math.random();
    const nuanta = r < 0.1 ? [0.49, 0.91, 0.88] : r < 0.18 ? [0.66, 0.53, 1] : [0.95, 0.95, 1];
    steleNuanta.set(nuanta, i * 3);
    steleLum[i * 2] = 0.45 + Math.random() * 0.55;
    steleLum[i * 2 + 1] = Math.random() * Math.PI * 2;
  }
  const steleGeo = new THREE.BufferGeometry();
  steleGeo.setAttribute('position', new THREE.BufferAttribute(stelePos, 3));
  steleGeo.setAttribute('color', new THREE.BufferAttribute(steleCol, 3));
  const steleMat = new THREE.PointsMaterial({
    size: mobile ? 0.1 : 0.075, map: points.material.map, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false
  });
  const stele = new THREE.Points(steleGeo, steleMat);
  stele.frustumCulled = false;
  stele.visible = false;
  scene.add(stele);

  const mouse = { x: 0, y: 0, cx: 0, cy: 0 };
  const laMouse = (e) => {
    mouse.x = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
    mouse.y = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
  };
  if (window.matchMedia('(hover: hover) and (min-width: 821px)').matches) {
    window.addEventListener('mousemove', laMouse, { passive: true });
  }

  // Incadrarea pe ecrane inguste. Pe un telefon tinut vertical camera vede
  // mult mai putin pe orizontala, iar codul si reteaua ieseau din ecran in
  // stanga si in dreapta. In loc sa micsoram scena, departam camera cu un
  // factor si atenuam ceata si marimea punctelor cu acelasi factor: imaginea
  // ramane aceeasi, doar incape. Pe desktop factorul e 1.
  const DISTANTA_START = 5.4;
  const PUNCT = mobile ? 0.045 : 0.034;
  let incadrare = 1;

  let w = 1, h = 1;
  const resize = () => {
    w = container.clientWidth || 1; h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vizibil = 2 * DISTANTA_START * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    incadrare = clamp((worldW * 1.12) / vizibil, 1, 3.4);
    scene.fog.density = 0.085 / incadrare;
    points.material.size = PUNCT * incadrare;
    camera.far = 60 * incadrare;
    // Pe telefon, bara de adresa schimba inaltimea la fiecare derulare: stelele
    // se reasaza doar la o schimbare reala de proportii (rotirea ecranului).
    if (Math.abs(camera.aspect - aspectStele) / (aspectStele || 1) > 0.15 || !aspectStele) {
      aspectStele = camera.aspect;
      aseazaStelele();
    }
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let target = 0, cur = 0, raf = 0, tAnterior = 0;
  let activ = true;
  const v = new THREE.Vector3();

  const frameRect = () => {
    const half = [];
    [[-PW / 2, PH / 2], [PW / 2, -PH / 2]].forEach(([x, y]) => {
      v.set(x * frame.scale.x, y * frame.scale.y, 0).project(camera);
      half.push([(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]);
    });
    return { x: half[0][0], y: half[0][1], w: half[1][0] - half[0][0], h: half[1][1] - half[0][1] };
  };

  const tick = (time) => {
    // Oprit cand hero-ul nu e pe ecran: nu se mai cere niciun cadru pana la
    // setActiv(true).
    if (!activ) { raf = 0; return; }

    cur += (target - cur) * 0.075;
    const p = cur;
    const t = time * 0.001;
    // Plafonat: dupa o pauza (hero-ul iesit de pe ecran) primul cadru ar
    // arunca stelele cu toata distanta pierduta.
    const dt = Math.min(0.05, tAnterior ? t - tAnterior : 0);
    tAnterior = t;

    const kA = smooth(0.20, 0.44, p);     // cod -> nor
    const kB = smooth(0.44, 0.62, p);     // nor -> retea
    const kC = smooth(0.76, 0.87, p);     // retea -> colaps
    const kD = smooth(0.86, 0.95, p);     // colaps -> portal

    for (let i = 0; i < COUNT; i++) {
      const o = i * 3;
      const d = seed[i] * 0.16;
      const a = clamp((kA - d) / (1 - d || 1), 0, 1);
      const b = clamp((kB - d * 0.6) / (1 - d || 1), 0, 1);
      let x = mix(A[o], B[o], a), y = mix(A[o + 1], B[o + 1], a), z = mix(A[o + 2], B[o + 2], a);
      x = mix(x, C[o], b); y = mix(y, C[o + 1], b); z = mix(z, C[o + 2], b);
      x = mix(x, D[o], kC); y = mix(y, D[o + 1], kC); z = mix(z, D[o + 2], kC);
      x = mix(x, E[o], kD); y = mix(y, E[o + 1], kD); z = mix(z, E[o + 2], kD);
      const drift = (0.03 + 0.05 * (1 - kD)) * (a * (1 - kC));
      pos[o] = x + Math.sin(t * 0.25 + seed[i] * 12) * drift;
      pos[o + 1] = y + Math.cos(t * 0.22 + seed[i] * 9) * drift;
      pos[o + 2] = z + Math.sin(t * 0.18 + seed[i] * 7) * drift;
    }
    geo.attributes.position.needsUpdate = true;

    for (let k = 0; k < pairs.length; k++) {
      const src = pairs[k] * 3, dst = k * 3;
      linePos[dst] = pos[src]; linePos[dst + 1] = pos[src + 1]; linePos[dst + 2] = pos[src + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;
    // Legaturile dispar odata cu colapsul: capetele lor urmeaza particulele,
    // iar cand acestea se imprastie spre camera liniile ar traversa tot ecranul.
    lineMat.opacity = Math.min(smooth(0.5, 0.64, p), 1 - smooth(0.78, 0.87, p)) * 0.5;

    fmat.opacity = Math.min(smooth(0.85, 0.93, p), 1 - smooth(0.985, 1, p)) * 0.9;
    const grow = 1 + smooth(0.94, 1, p) * 5.5;
    frame.scale.set(grow, grow, 1);

    points.material.opacity = 0.95 * (1 - smooth(0.88, 0.95, p));
    points.rotation.y = smooth(0.44, 0.9, p) * 0.35 + Math.sin(t * 0.08) * 0.02;

    camera.position.z = pathVal(p, [[0, 5.4], [0.2, 4.7], [0.44, 3.9], [0.62, 3.6], [0.78, 3.2], [0.9, 2.6], [0.97, 0.7], [1, -1.6]]) * incadrare;
    camera.position.x = Math.sin(t * 0.11) * 0.1 * (1 - smooth(0.85, 1, p));
    camera.position.y = Math.cos(t * 0.09) * 0.07 * (1 - smooth(0.85, 1, p));
    // La final camera trece prin origine (z ajunge la -1,6). Cu lookAt(0,0,0)
    // s-ar intoarce brusc cu 180° in acel moment — particulele sunt deja
    // stinse, dar stelele ar sari. De aproape de origine priveste drept inainte;
    // la z 0,5 oscilatia camerei e deja practic zero, deci trecerea nu se vede.
    if (camera.position.z > 0.5) camera.lookAt(0, 0, 0);
    else camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1);

    const vizStele = smooth(0.86, 0.97, p);
    steleMat.opacity = vizStele;
    stele.visible = vizStele > 0.001;
    if (stele.visible) {
      mouse.cx += (mouse.x - mouse.cx) * 0.04;
      mouse.cy += (mouse.y - mouse.cy) * 0.04;
      stele.position.set(-mouse.cx * 0.9, mouse.cy * 0.6, camera.position.z);
      const pas = dt * 0.7;
      for (let i = 0; i < STELE; i++) {
        const o = i * 3;
        stelePos[o + 2] += pas;
        if (stelePos[o + 2] > -1.2) pozitioneazaSteaua(i, true);
        const d = -stelePos[o + 2];
        let k = steleLum[i * 2] * (0.72 + 0.28 * Math.sin(t * (0.6 + steleLum[i * 2]) + steleLum[i * 2 + 1]));
        // Stinse foarte aproape (ar trece ca niste pete mari prin fata
        // titlului) si abia aparute in departare, ca sa nu rasara brusc.
        k *= smooth(1.2, 5, d) * (1 - smooth(ADANC - 8, ADANC, d));
        // Mai rare in dreptul textului: 0 = centrul ecranului, 1 = marginea.
        const lat = Math.hypot(stelePos[o] / (spanX * d), stelePos[o + 1] / (spanY * d));
        k *= 0.3 + 0.7 * smooth(0.12, 0.45, lat);
        steleCol[o] = steleNuanta[o] * k;
        steleCol[o + 1] = steleNuanta[o + 1] * k;
        steleCol[o + 2] = steleNuanta[o + 2] * k;
      }
      steleGeo.attributes.position.needsUpdate = true;
      steleGeo.attributes.color.needsUpdate = true;
    }

    if (opts.onFrame) opts.onFrame(frameRect(), p);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    setProgress(p) { target = clamp(p, 0, 1); },
    jumpTo(p) { target = cur = clamp(p, 0, 1); },
    setActiv(valoare) {
      if (valoare && !activ) {
        activ = true;
        if (!raf) raf = requestAnimationFrame(tick);
      } else if (!valoare) {
        activ = false;
      }
    },
    dispose() {
      activ = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', laMouse);
      geo.dispose(); lineGeo.dispose(); steleGeo.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
