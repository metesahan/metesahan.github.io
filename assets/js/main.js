/* ==========================================================================
   main.js · Lenis smooth scroll + GSAP ScrollTrigger reveal sistemi,
   liquid glass marquee, nav davranışı.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  // Kütüphaneler yüklenemezse içeriği asla gizli bırakma
  if (!hasGSAP) {
    root.classList.remove('js');
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  window.__revealReady = true;

  /* ------------------------------------------------------------------
     1. Lenis
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduceMotion && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  // Menü / anchor linkleri
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      // Odak, kaydırma BİTTİKTEN sonra verilir: iOS Safari erken odakta sayfayı
      // aniden atlatıp animasyonları bozuyordu. Bitince tetikleyiciler de tazelenir.
      const done = () => {
        if (target !== 0) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        if (window.ScrollTrigger) window.ScrollTrigger.update();
      };
      if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -24, duration: 1.4, onComplete: done });
      else {
        if (target === 0) window.scrollTo({ top: 0 });
        else target.scrollIntoView();
        done();
      }
    });
  });

  /* ------------------------------------------------------------------
     2. Liquid glass marquee (soldan sağa, kesintisiz)
     ------------------------------------------------------------------ */
  const marquee = document.querySelector('[data-marquee]');
  const track = marquee && marquee.querySelector('[data-track]');
  const baseGroup = track && track.querySelector('[data-group]');
  let marqueeTween = null;

  function buildMarquee() {
    if (!track || !baseGroup) return;
    track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
    if (marqueeTween) marqueeTween.kill();

    const groupW = baseGroup.getBoundingClientRect().width;
    if (!groupW) return;
    const copies = Math.ceil(window.innerWidth / groupW) + 1;
    for (let i = 0; i < copies; i++) {
      const c = baseGroup.cloneNode(true);
      c.setAttribute('data-clone', '');
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }

    if (reduceMotion) return;
    // x: -groupW → 0 : içerik sağa akar; bir grup genişliğinde döngü kusursuz kapanır
    marqueeTween = gsap.fromTo(track, { x: -groupW }, {
      x: 0, duration: groupW / 55, ease: 'none', repeat: -1,
    });
  }

  if (track) {
    // Fontlar yüklendikten sonra ölç, genişlik doğru olsun
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(buildMarquee);
    let rw = window.innerWidth;
    window.addEventListener('resize', () => {
      if (Math.abs(window.innerWidth - rw) < 2) return;
      rw = window.innerWidth;
      buildMarquee();
    });

    // Kaydırma hızına göre şerit hafifçe hızlanır, sonra sakinleşir
    if (lenis) {
      const speed = { v: 1 };
      lenis.on('scroll', ({ velocity }) => {
        const target = 1 + Math.min(Math.abs(velocity) * 0.08, 2.5);
        gsap.to(speed, {
          v: target, duration: 0.3, overwrite: true,
          onUpdate: () => marqueeTween && marqueeTween.timeScale(speed.v),
          onComplete: () => gsap.to(speed, {
            v: 1, duration: 1.2, ease: 'power2.out',
            onUpdate: () => marqueeTween && marqueeTween.timeScale(speed.v),
          }),
        });
      });
    }

    // Ekran dışındayken durdur (pil)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (!marqueeTween) return;
        entry.isIntersecting ? marqueeTween.play() : marqueeTween.pause();
      }).observe(marquee);
    }
  }

  /* ------------------------------------------------------------------
     Sertifika görüntüleyici: masaüstünde site içinde açılır.
     Telefonlarda tarayıcılar PDF'i çerçeve içinde düzgün göstermediği
     için bağlantı normal şekilde yeni sekmede açılır.
     ------------------------------------------------------------------ */
  const viewer = document.getElementById('cert-viewer');
  if (viewer && typeof viewer.showModal === 'function') {
    const img = viewer.querySelector('[data-viewer-img]');
    const title = viewer.querySelector('#viewer-title');

    document.querySelectorAll('[data-cert-view]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        title.textContent = btn.dataset.title || 'Sertifika';
        img.alt = (btn.dataset.title || 'Sertifika') + ' sertifikası';
        img.src = btn.getAttribute('href');
        viewer.showModal();
        // Kapat butonu otomatik odaklanıp halka göstermesin; odak pencerenin kendisinde
        viewer.focus();
        if (lenis) lenis.stop();
      });
    });

    const close = () => viewer.open && viewer.close();
    viewer.querySelector('[data-viewer-close]').addEventListener('click', close);
    // Panel dışına (arka plana) tıklayınca kapan
    viewer.addEventListener('click', (e) => { if (e.target === viewer) close(); });
    viewer.addEventListener('close', () => { if (lenis) lenis.start(); });
    // Sağ tık menüsünü kapat (kaydet / yazdır seçenekleri görünmesin)
    img.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ------------------------------------------------------------------
     İletişim formu: statik site olduğu için sunucu yok; mesaj,
     ziyaretçinin e-posta uygulamasında hazır şekilde açılır.
     ------------------------------------------------------------------ */
  const form = document.querySelector('[data-contact-form]');
  if (form) {
    const note = form.querySelector('[data-form-note]');
    const noteText = note.textContent;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      form.querySelectorAll('input, textarea').forEach((f) => {
        const valid = f.value.trim() !== '' && f.checkValidity();
        f.closest('.field').classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) {
        note.textContent = 'Lütfen tüm alanları doğru şekilde doldurun.';
        note.classList.add('is-error');
        return;
      }
      note.textContent = noteText;
      note.classList.remove('is-error');
      const d = new FormData(form);
      const subject = `Portfolyo üzerinden mesaj: ${d.get('name')}`;
      const body = `${d.get('message')}\n\n${d.get('name')}\n${d.get('email')}`;
      window.location.href = `mailto:metesahantr@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
    form.addEventListener('input', (e) => {
      const f = e.target.closest('.field');
      if (f) f.classList.remove('is-invalid');
    });
  }

  if (reduceMotion) return; // Kalan her şey animasyon

  /* ------------------------------------------------------------------
     3. Blur-to-clear reveal: sayfadaki TÜM metin, çizgi, düğüm, kart
     ------------------------------------------------------------------ */
  const SELECTOR = 'h2, h3, p, li, .rv, .node, .label';
  const main = document.getElementById('main');
  const all = Array.from(main.querySelectorAll(SELECTOR)).filter((el) => !el.classList.contains('no-rv'));
  const set = new Set(all);

  // Aynı anda hem ebeveyn hem çocuk animasyonu olmasın: ebeveyn bütün olarak belirir
  const targets = [];
  all.forEach((el) => {
    let p = el.parentElement, nested = false;
    while (p && p !== main) {
      if (set.has(p)) { nested = true; break; }
      p = p.parentElement;
    }
    if (nested) el.style.opacity = '1';
    else targets.push(el);
  });

  const FROM = { opacity: 0, y: 20, filter: 'blur(10px)' };
  const TO = {
    opacity: 1, y: 0, filter: 'blur(0px)',
    duration: 1.1, ease: 'power3.out',
    clearProps: 'filter,transform',
  };

  const hero = document.querySelector('.hero');
  // İlk ekranda zaten görünen her şey (hero, şerit, paragraf) açılış sekansıyla gelir;
  // kaydırma tetikleyicisi sayfanın en üstünde bunları yakalayamaz
  const fold = window.innerHeight * 0.92;
  const inFirstScreen = (el) => hero.contains(el) || el.getBoundingClientRect().top + window.scrollY < fold;
  const heroTargets = targets.filter(inFirstScreen);
  const scrollTargets = targets.filter((el) => !inFirstScreen(el));
  const navTargets = Array.from(document.querySelectorAll('.nav-in'));

  // Nodes: blur yerine küçükten büyüğe (7px'lik bir noktada blur görünmez)
  const nodeTargets = scrollTargets.filter((el) => el.classList.contains('node'));
  const textTargets = scrollTargets.filter((el) => !el.classList.contains('node'));

  gsap.set([...navTargets, ...heroTargets, ...textTargets], FROM);
  gsap.set(nodeTargets, { opacity: 0, scale: 0 });

  // 3a. Açılış sekansı: yavaş ve katmanlı.
  //     Sıra: başlık satırları → çizgi → etiket + paragraf → şerit → menü.
  //     Fontlar yüklenene kadar beklenir (en fazla 1.2 sn), metin kayması görünmesin.
  const heroLines = hero.querySelectorAll('.hero-title .rv');
  gsap.set(heroLines, { y: '100%', opacity: 0, filter: 'blur(12px)' });
  const heroHr = hero.querySelectorAll('.hr');
  gsap.set(heroHr, { scaleX: 0, opacity: 1 });
  const inHero = heroTargets.filter((el) => hero.contains(el) && !el.closest('.hero-title'));
  const belowHero = heroTargets.filter((el) => !hero.contains(el));

  const intro = gsap.timeline({ paused: true });
  intro
    .to(heroLines, {
      y: '0%', opacity: 1, filter: 'blur(0px)',
      duration: 1.9, ease: 'expo.out', stagger: 0.28, clearProps: 'filter,transform',
    }, 0)
    .to(heroHr, { scaleX: 1, duration: 2, ease: 'expo.inOut' }, 0.7)
    .to(inHero, { ...TO, duration: 1.6, stagger: 0.18 }, 1.25)
    .to(belowHero, { ...TO, duration: 1.6, stagger: 0.14 }, 1.7)
    .to(navTargets, { ...TO, duration: 1.4, stagger: 0.08 }, 1.9);

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))])
    .then(() => setTimeout(() => intro.play(), 350));   // kısa bir sessizlik, sonra açılış

  // 3b. Aşağı kaydırınca bulanıktan netleşerek gelir,
  //     yukarı kaydırınca aynı yoldan yavaşça söner
  const OUT = { ...FROM, duration: 0.8, ease: 'power2.in', stagger: 0.04, overwrite: true };

  ScrollTrigger.batch(textTargets, {
    start: 'clamp(top 92%)',
    onEnter: (batch) => gsap.to(batch, { ...TO, stagger: 0.07, overwrite: true }),
    onLeaveBack: (batch) => gsap.to(batch, OUT),
  });

  ScrollTrigger.batch(nodeTargets, {
    start: 'clamp(top 88%)',
    onEnter: (batch) => gsap.to(batch, { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(3)', stagger: 0.08, overwrite: true }),
    onLeaveBack: (batch) => gsap.to(batch, { opacity: 0, scale: 0, duration: 0.6, ease: 'power2.in', overwrite: true }),
  });

  // Yatay çizgiler (hero dışındaki .hr)
  main.querySelectorAll('.hr').forEach((hr) => {
    if (hero.contains(hr)) return;
    gsap.fromTo(hr, { scaleX: 0, opacity: 1 }, {
      scaleX: 1, duration: 1.4, ease: 'expo.inOut',
      scrollTrigger: { trigger: hr, start: 'clamp(top 92%)', toggleActions: 'play none none reverse' },
    });
  });

  // 1px bölüm çizgileri (border'lar) ekrana girerken soldan çizilir
  main.querySelectorAll('.entries, .certs, .tools').forEach((el) => {
    el.style.borderTopColor = 'transparent';
    const line = document.createElement('span');
    line.setAttribute('aria-hidden', 'true');
    Object.assign(line.style, {
      display: 'block', height: '1px', background: 'var(--hair)',
      transformOrigin: 'left', marginTop: '-1px', position: 'relative',
      gridColumn: '1 / -1',   // ızgara listelerde (araçlar) ilk hücreyi kaplayıp kaydırmasın
    });
    el.prepend(line);
    gsap.fromTo(line, { scaleX: 0 }, {
      scaleX: 1, duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: el, start: 'clamp(top 92%)', toggleActions: 'play none none reverse' },
    });
  });

  /* ------------------------------------------------------------------
     4. Timeline axis: kaydırmayla aşağı doğru çizilir
     ------------------------------------------------------------------ */
  const axis = document.querySelector('.axis-line');
  if (axis) {
    gsap.fromTo(axis, { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '[data-axis]', start: 'top 75%', end: 'bottom bottom', scrub: 0.6 },
    });
  }

  // Ekranın ortasındaki satırın düğümü bakır tona döner
  document.querySelectorAll('.entry, .cert, .sec-head').forEach((row) => {
    const node = row.querySelector(':scope > .node');
    if (!node || node.classList.contains('node--accent')) return;
    ScrollTrigger.create({
      trigger: row, start: 'top 60%', end: 'bottom 40%',
      toggleClass: { targets: node, className: 'is-active' },
    });
  });

  /* ------------------------------------------------------------------
     5. Nav: aşağı kaydırınca gizlen, yukarıda belir; aktif bölüm
     ------------------------------------------------------------------ */
  const nav = document.querySelector('.nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      nav.classList.toggle('is-hidden', y > 200 && y > lastY + 2);
      if (y < lastY - 2) nav.classList.remove('is-hidden');
      lastY = y;
    },
  });

  document.querySelectorAll('.navlink').forEach((link) => {
    const sec = document.querySelector(link.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      toggleClass: { targets: link, className: 'is-active' },
    });
  });

  // Fontlar yüklenince ölçüleri tazele
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
