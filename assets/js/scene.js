/* ==========================================================================
   scene.js · Three.js arka plan: yumuşak gölgeli, mat porselen küreler.
   Performans: pixelRatio ≤ 2, adaptif kare hızı, sekme gizlenince durur.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ICONS } from './icons.js?v=35';

const canvas = document.getElementById('bg');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const isSmall = () => window.innerWidth < 768;

function fail() { document.body.classList.add('no-webgl'); }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isTouch,
    alpha: true,              // arka plan sayfanın CSS renk geçişinden gelir
    powerPreference: 'low-power',
  });
} catch (e) {
  fail();
}

if (renderer) init();

function init() {
  /* ---------------- Renderer ---------------- */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Uzaktaki küreler sise gömülerek derinlik hissi verir
  scene.fog = new THREE.Fog(0x030304, 20, 46);

  // Stüdyo yansıması: metal ve cila yüzeyler gerçekçi parlasın
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  /* ---------------- Işıklar ---------------- */
  // Çok düşük ortam ışığı: küreler karanlıktan "çıkar", parlamaz
  scene.add(new THREE.HemisphereLight(0xe5e5e7, 0x0b0b0c, 0.45));

  // Ana ışık: sıcak, sol üstten, yumuşak gölge
  const key = new THREE.DirectionalLight(0xf2e8d8, 1.9);
  key.position.set(-8, 12, 14);
  key.castShadow = true;
  const sm = isSmall() ? 512 : 1024;
  key.shadow.mapSize.set(sm, sm);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -24, right: 24, top: 18, bottom: -18, near: 1, far: 60 });
  scene.add(key);

  // Kenar ışığı: mat bakır, arkadan; neon değil, sadece kontur
  const rim = new THREE.PointLight(0xc5a059, 22, 40, 2);
  rim.position.set(10, -2, -8);
  scene.add(rim);

  // Soğuk dolgu: fırçalanmış çelik tonu
  const fill = new THREE.DirectionalLight(0x9aa0aa, 0.35);
  fill.position.set(10, -6, 6);
  scene.add(fill);

  /* ---------------- Gölge alan görünmez duvar ---------------- */
  // Sadece kürelerin yumuşak gölgelerini gösterir; rengi sayfa arka planından gelir
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  );
  wall.position.z = -24;
  wall.receiveShadow = true;
  scene.add(wall);

  /* ---------------- Küreler ---------------- */
  const seg = isSmall() ? 40 : 64;
  const geo = new THREE.SphereGeometry(1, seg, seg);

  // Her küre, üzerindeki logonun kendi marka rengini taşır (parlak lake yüzey)
  const brand = (base, ink, extra = {}) => ({ base, ink, rough: 0.2, metal: 0.05, coat: 1.0, iri: 0.1, ...extra });
  const FINISH = {
    python:     brand('#2b5b84', '#ffffff'),                 // Python mavisi; logo kendi renklerinde
    kali:       brand('#367bf0', '#ffffff'),                 // Kali mavisi
    c:          brand('#f28c28', '#ffffff'),                 // turuncu
    html:       brand('#e34f26', '#ffffff'),                 // HTML5 turuncusu
    sql:        brand('#12a08c', '#ffffff'),                 // camgöbeği yeşil
    metasploit: brand('#7a45c2', '#ffffff'),                 // mor
    bash:       brand('#4eaa25', '#ffffff'),                 // Bash yeşili
    wireshark:  brand('#f2f4f7', '#1679a7'),                 // beyaz zemin, Wireshark mavisi
    burp:       brand('#e8453c', '#ffffff'),                 // kırmızı
    cpp:        brand('#9b4f96', '#ffffff'),                 // C++ moru
    mysql:      brand('#f29111', '#00546b'),                 // MySQL turuncusu, petrol yunus
    javascript: brand('#f7df1e', '#1b1b1b'),                 // JS sarısı
    css:        brand('#663399', '#ffffff'),                 // CSS'in resmi rengi (rebeccapurple)
    git:        brand('#f05032', '#ffffff'),                 // Git turuncu-kırmızısı
    linux:      brand('#f4f1ea', '#111111'),                 // Tux: beyaz zemin, siyah penguen
    docker:     brand('#2496ed', '#ffffff'),                 // Docker mavisi
    hackthebox: brand('#7cc200', '#111927'),                 // HTB yeşili (biraz yumuşatılmış)
    n8n:        brand('#e3354b', '#ffffff'),                 // kırmızı zemin, beyaz n8n logosu
  };


  // Aracın ikonu dokunun ön yüzüne (u = 0.25 → kameraya bakan taraf) çizilir
  const TEX_W = isSmall() ? 512 : 1024;
  function paintTexture(canvas, finish, icon) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = finish.base;
    ctx.fillRect(0, 0, W, H);
    if (!icon) return;               // dekor küre: sadece renk
    const cx = W * 0.25, cy = H * 0.5;
    const size = W * 0.15 * (icon.scale || 1);
    ctx.fillStyle = finish.ink;
    if (icon.layers) {
      // Çok renkli logo: her parça kendi rengiyle
      ctx.save();
      ctx.translate(cx - size / 2, cy - size / 2);
      ctx.scale(size / 24, size / 24);
      for (const l of icon.layers) { ctx.fillStyle = l.color; ctx.fill(new Path2D(l.path)); }
      ctx.restore();
    } else if (icon.path) {
      ctx.save();
      ctx.translate(cx - size / 2, cy - size / 2);
      ctx.scale(size / 24, size / 24);
      ctx.fill(new Path2D(icon.path));
      ctx.restore();
    } else {
      const fs = size * (icon.text.length > 3 ? 0.62 : icon.text.length > 2 ? 0.72 : 0.9);
      ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.text, cx, cy);
    }
  }

  function makeMaterial(finishName, iconName) {
    const finish = FINISH[finishName];
    const icon = iconName ? ICONS[iconName] : null;
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W; canvas.height = TEX_W / 2;
    paintTexture(canvas, finish, icon);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    // Yazı tabanlı ikonlar font yüklenince yeniden çizilir
    if (icon && icon.text && document.fonts) {
      document.fonts.load(`600 64px "JetBrains Mono"`).then(() => {
        paintTexture(canvas, finish, icon);
        map.needsUpdate = true;
      });
    }
    return new THREE.MeshPhysicalMaterial({
      map,
      roughness: finish.rough,
      metalness: finish.metal,
      clearcoat: finish.coat,
      clearcoatRoughness: 0.08,
      iridescence: finish.iri,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.05,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
  }

  // [x, y, z, yarıçap, ikon, yüzey] · içerik solda olduğu için ağırlık sağda.
  // Mobilde ilk 6 küre kullanılır.
  // Dengeli dağılım: büyük küreler kenarlarda ve köşelerde, ortadaki yazı alanı açık kalır.
  // [x, y, z, yarıçap, ikon] · mobilde ilk 6 küre kullanılır
  const LAYOUT = [
    [8.3, 3.0, -1, 1.9, 'python'],       // sağ üst
    [9.2, -3.8, -2, 1.5, 'kali'],        // sağ alt
    [-9.8, -4.2, 0, 1.0, 'c'],           // sol alt
    [-9.6, 4.6, -3, 1.2, 'html'],        // sol üst
    [4.6, -6.2, -4, 1.1, 'sql'],         // alt, sağa yakın
    [2.2, 6.6, -5, 0.8, 'metasploit'],   // üst orta
    [12, 0.2, -5, 0.8, 'bash'],          // sağ kenar orta
    [-12.8, 0.4, -7, 1.5, 'wireshark'],  // sol kenar orta, derinde
    [6.4, 0.3, 2.5, 0.38, 'burp'],       // önde küçük vurgu
    [-5.2, -6.8, -3, 0.85, 'n8n'],       // sol alt, orta derinlik
  ];
  // Derinlik katmanı: arkada kenarları saran küçük logolu küreler (mobilde ilk 6)
  const DECOR = [
    // Orta alan: derinde ve küçük, yazıların önüne geçmeden boşluğu doldurur
    [-1.6, 2.2, -9, 0.85, 'javascript'],
    [2.8, -2.4, -10, 0.95, 'docker'],
    [0.8, 4.4, -11, 0.7, 'linux'],
    // Kenarları saran halka
    [-5.5, 8.6, -12, 0.8, 'cpp'],
    [-4, -9.4, -11, 0.75, 'mysql'],
    [13.5, 8.5, -13, 0.6, 'git'],
    [-16, -7, -14, 0.8, 'css'],
    [10.5, -9.6, -13, 0.8, 'hackthebox'],
  ];
  const materials = LAYOUT.map(([, , , , icon]) => makeMaterial(icon, icon));
  const decorMaterials = DECOR.map(([, , , , icon]) => makeMaterial(icon, icon));

  const group = new THREE.Group();
  scene.add(group);
  const spheres = [];

  function buildSpheres() {
    spheres.forEach((s) => group.remove(s.mesh));
    spheres.length = 0;
    const main = (isSmall() ? LAYOUT.slice(0, 6) : LAYOUT).map((row, i) => [row, materials[i]]);
    const decor = (isSmall() ? DECOR.slice(0, 8) : DECOR).map((row, i) => [row, decorMaterials[i]]);
    const list = [...main, ...decor];
    // Yatay yayılımı ekranın görünen genişliğine ölçekle (mobilde dar)
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    const sx = Math.min(1, halfW / 11.2) * (isSmall() ? 1.25 : 1);
    // Genel boyut: masaüstünde %90, mobilde biraz daha küçük
    const sr = isSmall() ? 0.68 : 0.9;

    list.forEach(([[x, y, z, r], mat]) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(r * sr);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const base = new THREE.Vector3(x * sx, y, z);
      mesh.position.copy(base);
      group.add(mesh);
      spheres.push({
        mesh, base, r: r * sr,
        // İkonlu yüz kameraya dönük dursun
        face: Math.atan2(-base.x, camera.position.z - base.z),
        tilt: Math.atan2(-base.y, camera.position.z - base.z) * -0.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.1,
        amp: 0.25 + Math.random() * 0.35,
        push: new THREE.Vector2(),
        // 0 = en uzak, 1 = en yakın: paralaks bu değerle ölçeklenir
        depth: THREE.MathUtils.clamp((z + 22) / 25, 0.05, 1),
      });
    });
  }

  /* ---------------- Boyutlandırma ---------------- */
  let lastW = 0, lastH = 0;
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // Mobil adres çubuğu yükseklik oynamasını yok say (titremeyi önler)
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    const widthChanged = w !== lastW;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (widthChanged) buildSpheres();
  }
  resize(true);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => resize(false), 150); });

  /* ---------------- İşaretçi (fare / dokunmatik) ---------------- */
  const pointer = new THREE.Vector2(0, 0);     // -1..1
  const pointerSmooth = new THREE.Vector2(0, 0);
  const ZERO = new THREE.Vector2(0, 0);
  let pointerActive = false;
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerActive = true;
  }, { passive: true });
  const release = () => { pointerActive = false; };
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') release(); }, { passive: true });
  document.addEventListener('mouseleave', release);

  /* ---------------- Döngü + adaptif kare hızı ---------------- */
  const clock = new THREE.Clock();
  let frameInterval = 1 / 60;          // hedef
  let acc = 0;
  let samples = 0, sampleSum = 0;
  let pixelRatio = Math.min(window.devicePixelRatio, 2);
  let running = true;
  let t = 0;
  let lift = 0;

  function update(dt) {
    t += dt;
    pointerSmooth.lerp(pointerActive ? pointer : ZERO, 0.04);

    // Kamera: mikro paralaks + kaydırmayla hafif derinlik
    // Sayfa ilerlemesi 0..1: küreler sahneden çıkmadan yavaşça yukarı süzülür
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, (window.scrollY || 0) / max);
    camera.position.x = pointerSmooth.x * 0.6;
    camera.position.y = pointerSmooth.y * 0.4;
    camera.lookAt(0, 0, 0);
    lift += ((progress * 4.5 - 1) - lift) * 0.08;
    group.rotation.y = pointerSmooth.x * 0.04;

    // İşaretçinin z=0 düzlemindeki yaklaşık dünya konumu
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const px = pointerSmooth.x * halfH * camera.aspect;
    const py = pointerSmooth.y * halfH;


    for (const s of spheres) {
      const { mesh, base, phase, speed, amp } = s;
      // Organik süzülme: iki farklı frekansta sinüs
      const fx = Math.sin(t * speed + phase) * amp;
      const fy = Math.cos(t * speed * 0.8 + phase * 1.3) * amp * 1.2;
      const fz = Math.sin(t * speed * 0.6 + phase * 0.7) * amp * 0.6;

      // Mikro itme: işaretçi yakındaysa çok hafif uzaklaş
      // Katmanlı paralaks: yakın küreler kaydırmada ve fare hareketinde daha çok yer değiştirir
      const ly = lift * (0.3 + s.depth * 1.2);
      const lx = pointerSmooth.x * s.depth * 0.9;
      const dx = base.x + fx + lx - px, dy = base.y + fy + ly - py;
      const d = Math.hypot(dx, dy) || 1;
      const reach = s.r + 3.2;
      const f = pointerActive ? Math.max(0, 1 - d / reach) * 0.55 : 0;
      s.push.x += ((dx / d) * f - s.push.x) * 0.05;
      s.push.y += ((dy / d) * f - s.push.y) * 0.05;

      mesh.position.set(base.x + fx + lx + s.push.x, base.y + fy + ly + s.push.y, base.z + fz);
      // Hafif salınım: ikon hep görünür kalır, küre canlı durur
      mesh.rotation.y = s.face + Math.sin(t * speed * 0.9 + phase) * 0.35;
      mesh.rotation.x = s.tilt + Math.cos(t * speed * 0.7 + phase) * 0.12;

    }
  }

  function adapt(dt) {
    // İlk ~90 kareyi ölç; zorlanıyorsa 30 fps'e ve daha düşük çözünürlüğe in
    if (samples >= 90) return;
    samples++; sampleSum += dt;
    if (samples === 90) {
      const avg = sampleSum / samples;
      if (avg > 1 / 45) {
        frameInterval = 1 / 30;
        pixelRatio = Math.max(1, pixelRatio - 0.5);
        renderer.setPixelRatio(pixelRatio);
        resize(true);
      }
    }
  }

  let first = true;
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    acc += dt;
    if (acc < frameInterval - 0.002) return;
    const step = acc;
    acc = 0;
    adapt(step);
    update(step);
    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('is-ready'); }
  }

  if (reduceMotion) {
    update(0);
    renderer.render(scene, camera);
    canvas.classList.add('is-ready');
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!running) { running = true; clock.getDelta(); loop(); }
  });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; fail(); });

  loop();
}
