/* ------------------------------------------------------------------
   Albergue Roma · Pola de Lena · lo común de la página
   - Lenis suaviza el scroll (y mueve el ScrollTrigger de los módulos).
   - Monta los módulos con su respaldo: Cruz (portada, al abrirse la cortina),
     Puertas (habitaciones) y Bajada (el perfil 2D de la etapa), estos al acercarse.
   - El hilo: la línea ocre del logo baja por la página en zetas y en cada sección
     cuelga uno de sus cinco arcos; en la cabecera, los cinco arcos de lectura; en el
     pie, los cinco se juntan en el puente del logo.
   - La línea en vivo (hora de Madrid), el foco con rombos, cookies, mapa, visor y mando.
   El simulador va en js/reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // «con-movimiento» solo sin movimiento reducido: si no, los titulares partidos se quedarían escondidos
  const motion = !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const params = new URLSearchParams(location.search);
  const sinGL = params.has('sin-gl');

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const Roma = (window.Roma = window.Roma || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();
  const NS = 'http://www.w3.org/2000/svg';

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;
  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ============ 1. titulares partidos y entradas ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/([ \t\r\n]+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) Array.from(nodo.childNodes).forEach(envolver);
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  const vistos = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  if (motion) {
    $$('[data-partir]').forEach((h) => { partir(h); vistos.observe(h); });
    $$('[data-revela]').forEach((el, i) => { el.style.setProperty('--d', i % 3); vistos.observe(el); });
  }

  /* ============ 2. Lenis (y el ScrollTrigger de los módulos) ============ */
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    lenis.stop();                       // quieto mientras está la cortina
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };
  // los módulos llaman aquí para reservar: baja al simulador y, si viene una habitación, la deja elegida
  Roma.reservar = (o) => {
    if (o && o.habitacion && Roma.motor && Roma.motor.preparar) Roma.motor.preparar({ habitacion: o.habitacion });
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reservar]');
    if (!b) return;
    e.preventDefault();
    Roma.reservar(b.dataset.reservar ? { habitacion: b.dataset.reservar } : undefined);
  });

  /* ============ 3. módulos: Cruz (portada), Puertas y Bajada ============ */
  // si su JS falla o no está, se queda el respaldo del HTML. Se guarda el respaldo para volver
  // a montar al cambiar de densidad.
  const montados = new Map();     // el → { inst, respaldo }
  const opciones = (el) => {
    const op = { movimiento: motion, densidad: sobria() ? 'sobria' : 'caminos' };
    if (el.dataset.modulo === 'cruz' && sinGL) op.gl = false;
    return op;
  };
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = Roma[el.dataset.modulo];
    if (!mod || typeof mod.montar !== 'function') return;
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones(el));
      montados.set(el, { inst, respaldo });
      if (ST && el.dataset.modulo !== 'cruz') ST.refresh();
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
    }
  }
  function remontarTodos() {
    // sobre una copia: montar otra vez mete la entrada de nuevo en el Map
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
    if (ST) ST.refresh();
  }
  const portadaCruz = $('#portada [data-modulo="cruz"]');
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    $$('[data-modulo]').forEach((el) => { if (el !== portadaCruz) ioMod.observe(el); });
  } else $$('[data-modulo]').forEach((el) => { if (el !== portadaCruz) montarModulo(el); });

  /* ============ 4. cortina: la cruz se monta cuando EMPIEZA a abrirse; Lenis, al retirarse ============ */
  let fuera = false;
  const alAbrir = () => {
    $('#portada').classList.add('abierta');
    if (portadaCruz) montarModulo(portadaCruz);
  };
  function alFuera() {
    if (fuera) return;
    fuera = true;
    clearTimeout(window.__redCortina);
    raiz.classList.remove('cortina-activa');
    raiz.classList.add('cortina-fuera');
    alAbrir();
    if (lenis) lenis.start();
    if (G) G.ticker.lagSmoothing(0);      // al retirar la cortina, nunca antes
    if (ST) ST.refresh();
    mostrarCookies();
    alScroll();
  }
  // (se engancha al final del todo, cuando ya existe todo lo que usa alFuera)

  /* ============ 5. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis && fuera) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2 || a.hasAttribute('data-reservar')) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
      setTimeout(() => {
        const t = $(destino);
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }, 1000);
    });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. la línea en vivo: el registro, según la hora de Madrid ============ */
  const vivo = $('#vivo'), vivoTxt = $('#vivo-txt');
  function pintarVivo() {
    if (!vivo) return;
    let h = 12, m = 0;
    try {
      const p = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      h = +p.find((x) => x.type === 'hour').value % 24; m = +p.find((x) => x.type === 'minute').value;
    } catch (er) { return; }
    const min = h * 60 + m;
    const abierto = min >= 13 * 60 && min < 21 * 60;
    vivo.classList.toggle('es-abierto', abierto);
    vivoTxt.textContent = abierto ? 'Registro abierto ahora: entra hasta las 21:00'
      : min < 13 * 60 ? 'Hoy el registro abre a las 13:00'
        : 'Registro de 13:00 a 21:00: mañana, desde las 13:00';
  }
  pintarVivo();
  setInterval(pintarVivo, 60000);

  /* ============ 7. el hilo: la línea baja en zetas y en cada sección cuelga un arco ============ */
  // los arcos del logo (marca/arcos.svg), cada uno con su caja, para colgarlos de la línea
  const ARCOS = $$('#lectura .arco').map((p) => p.getAttribute('d'));
  const tramos = $$('.tramo').map((t) => {
    const n = +t.dataset.tramo;
    // pares: de derecha a izquierda (el 0 empieza donde la cruz deja la línea, al 96,5 %); impares, al revés
    const izq = n % 2 === 1;
    const x0 = izq ? 6 : 96.5, x1 = izq ? 90 : 10, y0 = 4, y1 = 72;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const linea = document.createElementNS(NS, 'path');
    linea.setAttribute('class', 't-linea');
    linea.setAttribute('d', `M${x0} ${y0}L${x1} ${y1}`);
    linea.setAttribute('pathLength', '1');
    linea.style.strokeDasharray = '1';
    svg.appendChild(linea);
    t.appendChild(svg);
    let arco = null;
    if (n >= 1 && ARCOS[n - 1]) {
      // cuelga a un 82 % del tramo; su esquina de arriba toca la línea
      const f = .82, ax = x0 + (x1 - x0) * f, ay = y0 + (y1 - y0) * f;
      arco = document.createElementNS(NS, 'svg');
      arco.setAttribute('class', 't-arco-svg');
      arco.setAttribute('aria-hidden', 'true');
      arco.setAttribute('focusable', 'false');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 't-arco');
      p.setAttribute('d', ARCOS[n - 1]);
      arco.appendChild(p);
      t.appendChild(arco);
      const b = p.getBBox ? p.getBBox() : null;
      if (b && b.width) arco.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
      arco.style.cssText = `position:absolute;inset:auto;left:${ax}%;top:${ay}%;width:clamp(26px,3.6vw,54px);height:auto;transform-origin:0 0;`;
    }
    return { t, linea, arco, izq };
  });
  function pintarTramos() {
    const quietos = !motion || sobria();
    tramos.forEach(({ t, linea, arco, izq }) => {
      let p = 1;
      if (!quietos) {
        const r = t.getBoundingClientRect();
        p = cl((altoVista * .92 - r.top) / (altoVista * .55));
      }
      linea.style.strokeDashoffset = (1 - cl(p / .8)).toFixed(4);
      if (arco) {
        const a = cl((p - .7) / .3);
        // en el logo la esquina que toca la línea es la de arriba a la derecha; si el tramo baja hacia la izquierda, en espejo
        arco.style.transform = (izq ? 'translateX(-100%)' : 'translateX(100%) scaleX(-1)') + ` scaleY(${a.toFixed(3)})`;
        arco.style.opacity = a > 0 ? 1 : 0;
      }
    });
  }

  /* ============ 8. con el scroll: cabecera, lectura, paralaje de Lena y el puente del pie ============ */
  const secLectura = $$('#cab .cab__nav a[data-arco]').map((a) => ({ a, sec: $(a.getAttribute('href')), n: +a.dataset.arco }));
  const arcosLectura = $$('#lectura .arco');
  const oscuras = $$('[data-tono="oscuro"]');
  const paralajes = $$('[data-paralaje]');
  const pie = $('#pie');
  const arcosPie = $$('#pie-logo .arco');
  let pend = 0;
  function alScroll() {
    pend = 0;
    cab.classList.toggle('sc', scrollY > 24);
    // la cabecera sobre una sección oscura (la bajada, el pie) se pone oscura
    const yc = cabAlto() / 2;
    cab.classList.toggle('sobre-oscuro', scrollY > 24 && oscuras.some((s) => { const r = s.getBoundingClientRect(); return r.top <= yc && r.bottom > yc; }));
    // lectura: los arcos de las secciones ya leídas, llenos; la actual, a medias
    const medio = altoVista * .45;
    let actual = 0;
    secLectura.forEach(({ sec, n }) => { if (sec && sec.getBoundingClientRect().top < medio) actual = n; });
    arcosLectura.forEach((p, i) => {
      p.classList.toggle('es-leido', i + 1 < actual);
      p.classList.toggle('es-actual', i + 1 === actual);
    });
    secLectura.forEach(({ a, n }) => { if (n === actual) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    pintarTramos();
    // Lena: paralaje suave dentro del marco (en la caja de la foto, nunca más de 7 % del alto)
    if (motion && !sobria()) {
      paralajes.forEach((m) => {
        const r = m.getBoundingClientRect();
        if (r.bottom < -100 || r.top > altoVista + 100) return;
        const c = (r.top + r.height / 2 - altoVista / 2) / altoVista;
        m.style.setProperty('--py', (cl(c, -1, 1) * -r.height * .06).toFixed(1) + 'px');
      });
    }
    // el pie: los cinco arcos llegan uno tras otro y la línea se dibuja; abajo del todo, el puente entero
    if (pie && motion && !sobria()) {
      const max = document.documentElement.scrollHeight - altoVista;
      const tramo = Math.min(pie.offsetHeight, 760);
      const k = max - scrollY < 2 ? 1 : cl(1 - (max - scrollY) / tramo);
      pie.style.setProperty('--k', k.toFixed(4));
      arcosPie.forEach((p, i) => p.style.setProperty('--k-n', cl(k * 1.6 - i * .15).toFixed(3)));
    }
  }
  function pieEntero() {
    if (!pie) return;
    pie.style.setProperty('--k', 1);
    arcosPie.forEach((p) => p.style.setProperty('--k-n', 1));
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  if (!motion || sobria()) pieEntero();
  alScroll();

  /* ============ 9. el foco: los cuatro rombos de la cruz en las esquinas ============ */
  const rombos = document.createElement('div');
  rombos.className = 'foco-rombos';
  rombos.setAttribute('aria-hidden', 'true');
  rombos.innerHTML = '<i></i><i></i><i></i><i></i>';
  document.body.appendChild(rombos);
  let enFoco = null;
  function ponerRombos() {
    if (!enFoco || !enFoco.isConnected) { rombos.classList.remove('es-visible'); return; }
    const r = enFoco.getBoundingClientRect();
    const o = 6;
    rombos.style.transform = `translate(${(r.left - o).toFixed(1)}px, ${(r.top - o).toFixed(1)}px)`;
    rombos.style.width = (r.width + 2 * o) + 'px';
    rombos.style.height = (r.height + 2 * o) + 'px';
    const oscuro = !!enFoco.closest('[data-tono="oscuro"], .cab:not(.sc), .cab.sobre-oscuro, .menu-movil, .visor, .mando, .portada');
    rombos.style.setProperty('--foco-color', oscuro ? '#CBAB89' : '#B07E4A');
    rombos.style.setProperty('--foco-borde', oscuro ? '#16110D' : '#F3EEE6');
  }
  document.addEventListener('focusin', (e) => {
    let visible = false;
    try { visible = e.target.matches(':focus-visible'); } catch (er) {}
    enFoco = visible && e.target !== document.body ? e.target : null;
    // dentro del visor (capa superior) los rombos van dentro del diálogo
    const dlg = enFoco && enFoco.closest('dialog');
    (dlg || document.body).appendChild(rombos);
    ponerRombos();
    rombos.classList.toggle('es-visible', !!enFoco);
  });
  document.addEventListener('focusout', () => { enFoco = null; rombos.classList.remove('es-visible'); });
  addEventListener('scroll', () => { if (enFoco) requestAnimationFrame(ponerRombos); }, { passive: true });

  /* ============ 10. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'albergueroma-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  /* ============ 11. mapa de Google solo al pedirlo ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Albergue Roma, Calle Canuto Hevia 12, Pola de Lena') + '&ll=43.15677,-5.83017&z=16&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con el Albergue Roma en la calle Canuto Hevia, Pola de Lena';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 12. visor de fotos: se abre por el NOMBRE de la foto ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  // la serie se hace de la MISMA lista de miniaturas, sin repetir nombres
  function serie() {
    const vistas = new Map();
    $$('[data-visor]').forEach((b) => {
      const n = b.dataset.visor;
      if (vistas.has(n)) return;
      const img = b.querySelector('img');
      if (!img) return;
      const anchos = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((a, z) => a - z);
      const pie = b.closest('figure, li')?.querySelector('figcaption, h3');
      vistas.set(n, { n, alt: img.alt, pie: pie ? pie.textContent.replace(/\s+/g, ' ').trim() : img.alt, anchos: anchos.length ? anchos : [800], ancho: +img.getAttribute('width') || 1280, alto: +img.getAttribute('height') || 960 });
    });
    return [...vistas.values()];
  }
  let lista = [], actualV = 0, origen = null;
  function poner(i) {
    actualV = (i + lista.length) % lista.length;
    const f = lista[actualV];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    // primero la de 800 (ya en caché casi siempre), y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actualV + 1) + ' / ' + lista.length;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b || !visor || typeof visor.showModal !== 'function') return;
    lista = serie();
    const i = lista.findIndex((f) => f.n === b.dataset.visor);
    if (i < 0) return;
    origen = b;
    poner(i);
    visor.showModal();
    if (lenis) lenis.stop();
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actualV - 1));
    $('#visor-sig').addEventListener('click', () => poner(actualV + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actualV - 1); else if (e.key === 'ArrowRight') poner(actualV + 1); });
    visor.addEventListener('close', () => { if (lenis) lenis.start(); if (origen) origen.focus({ preventScroll: true }); });
  }

  /* ============ 13. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      if (sobria() || !motion) pieEntero();
      paralajes.forEach((m) => m.style.removeProperty('--py'));
      remontarTodos();
      alScroll();
      window.dispatchEvent(new CustomEvent('roma:densidad', { detail: sobria() ? 'sobria' : 'caminos' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 14. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => { anchoVista = innerWidth; altoVista = innerHeight; window.dispatchEvent(new CustomEvent('roma:resize')); alScroll(); }, 200);
  });

  // lo que usan los módulos
  Roma.web = {
    motion, quieto, sobria, lenis, irA,
    get fuera() { return fuera; }, get altoVista() { return altoVista; }, esBarra, montados,
  };

  /* ============ 15. la cortina, al final: alFuera usa la cabecera, el hilo y las cookies ============ */
  if (Roma.cortina && !raiz.classList.contains('cortina-fuera')) {
    Roma.cortina.alAbrirse(alAbrir);
    Roma.cortina.alRetirarse(alFuera);
    // red de seguridad propia por si la cortina se atasca
    setTimeout(() => { if (!fuera) { try { Roma.cortina.retirar(); } catch (er) {} alFuera(); } }, 7500);
  } else {
    const c = $('#cortina'); if (c) c.hidden = true;
    // sin cortina (movimiento reducido, ?sin-cortina o sin cortina.js): fuera ya
    alFuera();
  }
})();
