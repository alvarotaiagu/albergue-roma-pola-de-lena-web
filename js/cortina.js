/* ------------------------------------------------------------------
   Albergue Roma · cortina «La celosía» (agente Cruz)
   1. Los cinco puntos del símbolo: el centro ocre y luego las cuatro esquinas.
   2. La cruz se dibuja rombo a rombo desde el centro con un trazo ocre y se rellena.
   3. La cruz se multiplica en una celosía (retícula de cruces y rosetas, como una
      celosía prerrománica) que cubre la pantalla en ondas desde el centro.
   4. Luz cálida por los huecos: la piedra queda a contraluz.
   5. La celosía se abre desde el centro (las cruces se apartan y giran hacia fuera,
      con profundidad) y por el hueco aparece la portada; la cruz central vuela a su
      sitio (Roma.cruz.sitio) y aterriza sobre los puntos que llegan o sobre el SVG
      del respaldo. alAbrirse(fn) dispara cuando EMPIEZA a abrirse.
   Unos 2,9 s. Se salta si la página tardó más de 2 s. Se retira SIEMPRE (finally,
   red de 7 s aquí, red de 6,5 s en la parte y otra en la cabeza de la web).
   Expone window.Roma.cortina = { alAbrirse(fn), alRetirarse(fn), retirar(), abierta, fuera }.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const w = window, d = document, h = d.documentElement;
  const Roma = (w.Roma = w.Roma || {});
  const c = d.getElementById('cortina');

  /* ============ el contrato: alAbrirse / alRetirarse / retirar ============ */
  const alAbrir = [], alFuera = [];
  let abierta = false, fuera = false;
  const llamar = (fn) => { try { fn(); } catch (er) { console.warn('Cortina:', er); } };
  function abrir() {
    if (abierta) return;
    abierta = true;
    h.classList.add('cortina-abriendo');
    try { w.dispatchEvent(new CustomEvent('roma:cortina-abre')); } catch (er) {}
    alAbrir.splice(0).forEach(llamar);
  }
  function retirar() {
    if (fuera) return;
    fuera = true;
    clearTimeout(red); clearTimeout(w.__romaRedCortina); clearTimeout(w.__redCortina);
    abrir();
    if (c) c.hidden = true;
    h.classList.remove('cortina-activa', 'cortina-abriendo', 'cortina-vuela');
    h.classList.add('cortina-fuera');
    try { w.dispatchEvent(new CustomEvent('roma:cortina-fuera')); } catch (er) {}
    alFuera.splice(0).forEach(llamar);
  }
  Roma.cortina = {
    alAbrirse(fn) { if (typeof fn !== 'function') return; if (abierta) llamar(fn); else alAbrir.push(fn); },
    alRetirarse(fn) { if (typeof fn !== 'function') return; if (fuera) llamar(fn); else alFuera.push(fn); },
    retirar,
    get abierta() { return abierta; },
    get fuera() { return fuera; },
  };
  const red = setTimeout(retirar, 7000);

  let reducido = false;
  try { reducido = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (er) {}
  if (!c || reducido || !h.classList.contains('cortina-activa') || performance.now() > 2000 || d.hidden || !c.animate) {
    retirar();
    return;
  }
  const sobria = h.classList.contains('densidad-sobria');

  /* ============ utilidades ============ */
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, ctx) => (ctx || c).querySelector(s);
  const $$ = (s, ctx) => Array.from((ctx || c).querySelectorAll(s));
  const SALE = 'cubic-bezier(.16,1,.3,1)', ABRE = 'cubic-bezier(.66,0,.22,1)', DIBUJA = 'cubic-bezier(.55,.05,.25,1)';
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const anima = (el, kf, op) => el.animate(kf, Object.assign({ fill: 'both', easing: SALE }, op));
  const fotogramas = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  // tween con rAF y un reloj que se traga los atascos (un salto de más de 100 ms cuenta como 1/30 s)
  function tween(ms, fn, ease) {
    return new Promise((res) => {
      let previo = performance.now(), hecho = 0;
      const paso = (ahora) => {
        const dt = ahora - previo; previo = ahora;
        hecho += dt > 100 ? 33 : Math.max(0, dt);
        const t = Math.min(1, hecho / ms);
        fn(ease ? ease(t) : t);
        if (t < 1) requestAnimationFrame(paso); else res();
      };
      requestAnimationFrame(paso);
    });
  }
  // la misma curva que ABRE, para el hueco (bezier .66,0,.22,1 resuelta por búsqueda)
  function bezier(x1, y1, x2, y2) {
    const B = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    return (x) => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (B(m, x1, x2) < x) lo = m; else hi = m; } return B((lo + hi) / 2, y1, y2); };
  }
  const easeAbre = bezier(.66, 0, .22, 1);

  /* ============ la geometría (la de marca/cruz.svg: punta del pétalo a 19,3 del centro) ============ */
  const PUNTA = 19.3, CAJA = 22;              // el svg de cada cruz va de -22 a 22
  const PETALO = 'M-4.05 -6V-14.9C-4.05 -17.2 -1.6 -19.05 0 -19.3C1.6 -19.05 4.05 -17.2 4.05 -14.9V-6Z';
  const MEDIO_I = 'M0 -6H-4.05V-14.9C-4.05 -17.2 -1.6 -19.05 0 -19.3', MEDIO_D = 'M0 -6H4.05V-14.9C4.05 -17.2 1.6 -19.05 0 -19.3';
  const ROMBO = 'M0 -4.75L3.99 -0.76Q4.75 0 3.99 0.76L0 4.75L-3.99 0.76Q-4.75 0 -3.99 -0.76Z';
  const ROMBOS = [[-13.21, -16.44], [14.13, -16.44], [14.13, 16.56], [-13.21, 16.56]];

  const vw = innerWidth, vh = innerHeight, cx = vw / 2, cy = vh / 2;
  const movil = vw < 700;
  // tamaño de cada cruz de la celosía (px de centro a punta)
  const R = Math.round(Math.max(movil ? 34 : 40, Math.min(84, Math.min(vw, vh) * (movil ? .1 : .085))));
  const LADO = 2 * R * CAJA / PUNTA;
  const TRAZO_PX = movil ? 1.25 : 1.5;
  const trazo = (r) => (TRAZO_PX * PUNTA / r).toFixed(3);
  c.style.setProperty('--cortina-lado', LADO.toFixed(1) + 'px');
  c.style.setProperty('--cortina-trazo', trazo(R));
  const dmax = Math.hypot(cx, cy);

  /* ============ la celosía ============ */
  const celosia = $('.cortina__celosia');
  const muro = $('.cortina__muro');
  const cruces = [], rosetas = [];
  if (!sobria) {
    const paso = R * (movil ? 2.5 : 2.32);
    const ni = Math.ceil((cx + paso) / paso), nj = Math.ceil((cy + paso) / paso);
    const frag = d.createDocumentFragment();
    for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
      const x = cx + i * paso, y = cy + j * paso;
      if (i === 0 && j === 0) continue;
      if (x < -LADO / 2 || x > vw + LADO / 2 || y < -LADO / 2 || y > vh + LADO / 2) continue;
      const el = d.createElement('i');
      el.className = 'cortina__x';
      el.style.cssText = `left:${(x - LADO / 2).toFixed(1)}px;top:${(y - LADO / 2).toFixed(1)}px;width:${LADO.toFixed(1)}px;height:${LADO.toFixed(1)}px`;
      el.innerHTML = '<svg viewBox="-22 -22 44 44" focusable="false" aria-hidden="true"><use href="#cortina-x"/></svg>';
      frag.appendChild(el);
      cruces.push({ el, x, y, dx: x - cx, dy: y - cy, d: Math.hypot(x - cx, y - cy), az: Math.random() });
    }
    celosia.appendChild(frag);
    // las rosetas (un rombo en cada esquina de celda), en un solo SVG dentro del muro
    const sv = d.createElementNS(NS, 'svg');
    sv.setAttribute('class', 'cortina__rosetas');
    sv.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    sv.setAttribute('aria-hidden', 'true');
    const esc = (R / PUNTA) * .78;
    for (let j = -nj - 1; j <= nj; j++) for (let i = -ni - 1; i <= ni; i++) {
      const x = cx + (i + .5) * paso, y = cy + (j + .5) * paso;
      if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) continue;
      const g = d.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${esc.toFixed(3)})`);
      const u = d.createElementNS(NS, 'use');
      u.setAttribute('href', '#cortina-rombo');
      g.appendChild(u);
      sv.appendChild(g);
      rosetas.push({ el: u, d: Math.hypot(x - cx, y - cy) });
    }
    muro.appendChild(sv);
  }

  const cruz = $('.cortina__cruz');
  const halo = $('.cortina__halo');
  const centro = $('.cortina__centro');
  const puntos = $$('.cortina__puntos use');
  const brazos = $$('.cortina__trazos > g');
  const rellenos = $('.cortina__rellenos');
  const luz = $('.cortina__luz');
  c.classList.add('es-lista');            // el muro ya tapa: la capa de fuera se vuelve transparente

  /* ============ adónde vuela la cruz central ============ */
  function destino() {
    const el = d.querySelector('[data-modulo="cruz"]');
    if (!el) return null;
    let s = null;
    try { if (Roma.cruz && Roma.cruz.sitio) s = Roma.cruz.sitio(el); } catch (er) {}
    if (!s) {
      // sin el módulo: el SVG del respaldo (marca/cruz.svg: viewBox 0 0 40 44 con el centro en 20,22)
      const sv = el.querySelector('.cruz-respaldo, .portada__cruz, svg');
      if (!sv) return null;
      const r = sv.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const vb = sv.viewBox && sv.viewBox.baseVal;
      if (vb && vb.width === 40 && vb.height === 44) {
        // el SVG puede estar con preserveAspectRatio por defecto (centrado): escala = la menor
        const k = Math.min(r.width / 40, r.height / 44);
        s = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: PUNTA * k };
      } else s = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 * .88 };
    }
    if (!s || !(s.r > 4)) return null;
    if (s.y + s.r < 0 || s.y - s.r > vh || s.x + s.r < 0 || s.x - s.r > vw) return null;   // fuera de la vista
    return s;
  }

  // la cruz que se queda en la portada: un SVG propio (sin <use>, que dependen de la cortina)
  function testigo(s, viva) {
    const lado = 2 * s.r * CAJA / PUNTA;
    const t = d.createElement('div');
    t.className = 'cortina-testigo';
    t.setAttribute('aria-hidden', 'true');
    t.style.cssText = `left:${(s.x - lado / 2 + scrollX).toFixed(1)}px;top:${(s.y - lado / 2 + scrollY).toFixed(1)}px;width:${lado.toFixed(1)}px;height:${lado.toFixed(1)}px`;
    t.style.setProperty('--cortina-trazo', trazo(s.r));
    const pet = [0, 90, 180, 270].map((a) => `<path transform="rotate(${a})" d="${PETALO}"/>`).join('');
    const med = [0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><path d="${MEDIO_I}"/><path d="${MEDIO_D}"/></g>`).join('');
    const rom = ROMBOS.map(([x, y]) => `<path transform="translate(${x} ${y})" d="${ROMBO}"/>`).join('');
    t.innerHTML = `<svg viewBox="-22 -22 44 44" focusable="false" aria-hidden="true">
      <g class="cortina__rellenos" style="fill-opacity:${viva ? 0 : 1}">${pet}</g>
      <g class="cortina__trazos">${med}</g>
      <g class="cortina__puntos"><g style="fill-opacity:${viva ? 0 : 1}">${rom}</g><circle class="cortina__centro" r="3.85"/></g></svg>`;
    // las rombos del testigo son <path>, no <use>: mismos colores
    t.querySelectorAll('.cortina__puntos path').forEach((p) => { p.style.fill = 'var(--c-castano)'; p.style.stroke = 'var(--c-ocre)'; p.style.strokeWidth = 'var(--cortina-trazo)'; });
    d.body.appendChild(t);
    return t;
  }

  /* ============ la función ============ */
  (async function correr() {
    let s = null, vuelo = null;
    try {
      await fotogramas(2);                   // que pase el primer tirón de la carga (main.js, fuentes)

      // 1. los cinco puntos: el centro y luego las esquinas
      anima(halo, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700 });
      anima(centro, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.35)', offset: .6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 420 });
      puntos.forEach((p, i) => anima(p, [{ opacity: 0, transform: 'scale(0) rotate(-90deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { duration: 380, delay: 170 + i * 70 }));
      await espera(380);

      // 2. la cruz se dibuja rombo a rombo desde el centro (arriba, derecha, abajo, izquierda) y se rellena
      brazos.forEach((g, i) => g.querySelectorAll('path').forEach((p) =>
        anima(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 430, delay: i * 115, easing: DIBUJA })));
      await espera(115 * 3 + 300);
      anima(rellenos, [{ fillOpacity: 0 }, { fillOpacity: 1 }], { duration: 380, easing: 'ease-out' });
      anima(halo, [{ opacity: 1, transform: 'scale(1)' }, { opacity: .55, transform: 'scale(2.6)' }], { duration: 900 });
      await espera(sobria ? 380 : 140);

      if (!sobria) {
        // 3. la celosía: la cruz se multiplica en ondas desde el centro
        const pasoOnda = 62, cel = R * (movil ? 2.5 : 2.32);
        cruces.forEach((x) => anima(x.el, [
          { opacity: 0, transform: 'scale(.35) rotate(-45deg)' },
          { opacity: 1, transform: 'scale(1) rotate(0deg)' },
        ], { duration: 420, delay: (x.d / cel) * pasoOnda }));
        rosetas.forEach((x) => anima(x.el, [{ opacity: 0 }, { opacity: .85 }], { duration: 360, delay: 60 + (x.d / cel) * pasoOnda }));
        const ultimo = Math.max(0, ...cruces.map((x) => x.d)) / cel * pasoOnda;
        await espera(Math.min(520, ultimo * .55));

        // 4. luz cálida por los huecos: la piedra queda a contraluz
        c.classList.add('es-luz');
        anima(luz, [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 620, easing: 'cubic-bezier(.3,.1,.3,1)' });
        await espera(Math.max(380, Math.min(560, ultimo * .45 + 120)));
      }

      // 5. se abre desde el centro: la portada ya se mueve detrás
      s = destino();
      c.classList.add('es-abriendo');
      h.classList.add('cortina-vuela');
      abrir();                                   // ← main.js monta la portada aquí
      s = s || destino();
      const dur = 980;

      // el hueco
      const hf = Math.min(vw, vh) * .36;
      muro.style.setProperty('--hf', hf.toFixed(0) + 'px');
      const hueco = tween(dur + 60, (k) => muro.style.setProperty('--hr', (k * (dmax + 40) - hf * (1 - k)).toFixed(1) + 'px'), easeAbre);
      if (!sobria) anima(luz, [{ opacity: 1, transform: 'scale(1)' }, { opacity: .7, transform: 'scale(1.7)' }], { duration: dur, easing: ABRE });

      // las cruces se apartan y giran hacia fuera, con profundidad (las de dentro, primero)
      cruces.forEach((x) => {
        const f = x.d / dmax, nx = x.dx / (x.d || 1), ny = x.dy / (x.d || 1);
        const empuje = dmax * (.55 + .4 * (1 - f));
        const z = 120 + 360 * (1 - f);
        const ry = Math.max(-1, Math.min(1, x.dx / (vw / 2))) * 68;
        const rx = -Math.max(-1, Math.min(1, x.dy / (vh / 2))) * 52;
        const rz = (x.dx >= 0 ? 1 : -1) * (24 + 40 * x.az);
        anima(x.el, [
          { opacity: 1, transform: 'translate3d(0,0,0) rotateZ(0deg) rotateY(0deg) rotateX(0deg)' },
          { opacity: 1, offset: .5 },
          { opacity: 0, transform: `translate3d(${(nx * empuje).toFixed(0)}px,${(ny * empuje).toFixed(0)}px,${z.toFixed(0)}px) rotateZ(${rz.toFixed(0)}deg) rotateY(${ry.toFixed(0)}deg) rotateX(${rx.toFixed(0)}deg)` },
        ], { duration: dur - 120 * f, delay: 200 * f, easing: ABRE });
      });

      // la cruz central vuela a su sitio en la portada
      cruz.classList.add('es-vuela');
      const viva = () => { const el = d.querySelector('[data-modulo="cruz"]'); return !!(el && el.classList.contains('cruz--viva')); };
      if (s) {
        const k = s.r / R;
        const tx = s.x - cx, ty = s.y - cy;
        anima(halo, [{ opacity: .55 }, { opacity: 0 }], { duration: 400 });
        vuelo = anima(cruz, [
          { transform: 'translate(0px,0px) scale(1)' },
          { transform: `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${k.toFixed(4)})` },
        ], { duration: dur + 40, easing: ABRE });
        const sw0 = trazo(R), sw1 = trazo(s.r);
        $$('.cortina__trazos path, .cortina__puntos use').forEach((p) => anima(p, [{ strokeWidth: sw0 }, { strokeWidth: sw1 }], { duration: dur + 40, easing: ABRE }));
        if (viva()) anima(rellenos, [{ fillOpacity: 1 }, { fillOpacity: 0 }], { duration: dur * .8, delay: dur * .2, easing: 'ease-in' });
        await vuelo.finished;
      } else {
        anima(cruz, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 600, easing: ABRE });
        await hueco;
      }
      await hueco;

      // aterriza: el testigo se queda sobre la portada (fuera de la cortina) y se va mientras llegan los puntos
      if (s) {
        const esViva = viva();
        const t = testigo(s, esViva);
        h.classList.remove('cortina-vuela');
        const a = t.animate([{ opacity: 1 }, { opacity: 0 }], esViva
          ? { duration: 1500, delay: 250, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' }
          : { duration: 320, delay: 60, easing: 'ease-out', fill: 'both' });
        a.finished.then(() => t.remove(), () => t.remove());
        setTimeout(() => t.remove(), 4000);
      }
    } catch (er) {
      console.warn('Cortina:', er);
    } finally {
      retirar();
    }
  })();

  // para las pruebas
  w.__romaCortina = { R, sobria, cruces: cruces.length, rosetas: rosetas.length };
})();
