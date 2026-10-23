/* ------------------------------------------------------------------
   Albergue Roma · «De la nieve del puerto a tu litera» · la bajada en 2D
   (sin 3D: decisión de Álvaro, 2026-10-23)
   La sección se queda fija y, con el scroll, bajas del Puerto de Pajares a la puerta:
   - detrás, las fotos de cada tramo (Mongolo1984, CC BY-SA 4.0) se funden según el km;
   - delante, el altímetro y el contador de km, y el pueblo por el que pasas;
   - abajo, el perfil real (MDT05 del IGN sobre el trazado de OSM): la línea ocre del logo
     se dibuja hasta donde vas y en las cinco paradas cuelgan sus cinco arcos;
   - al final, el remate: «Del puerto a tu litera: 1.061 m más abajo» y «Ver camas libres».
   Las cifras salen SOLO de img/terreno/bajada.json (scripts/terreno.py), que construir.mjs
   mete en la página como <script type="application/json" id="bajada-datos">.
   Contrato: Roma.bajada.montar(el, { movimiento, densidad }) → { destruir() }.
   Con movimiento reducido o en la sobria: quieto, entero y sin fijar.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const Roma = (window.Roma = window.Roma || {});
  const NS = 'http://www.w3.org/2000/svg';
  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const coma = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const mil = (m) => { m = Math.round(m); return m >= 1000 ? Math.floor(m / 1000) + '.' + String(m % 1000).padStart(3, '0') : String(m); };

  // las fotos de cada tramo, por el km donde empiezan (lugar según el título del original en Commons)
  const C = 'https://commons.wikimedia.org/wiki/File:Camino%20de%20San%20Salvador%2C%20';
  const FOTOS = [
    { km: 0, n: 'puerto-ubinas-1', l: 'Puerto de Pajares', u: C + 'Puerto%20de%20Pajares%2002.jpg' },
    { km: 1.4, n: 'bajada-ubinas-2', l: 'Entre el puerto y Pajares', u: C + 'tratto%20del%20cammino%20tra%20Puerto%20de%20Pajares%20e%20Pajares%2008.jpg' },
    { km: 3.6, n: 'bajada-ubinas-1', l: 'Entre el puerto y Pajares, con las Ubiñas', u: C + 'tratto%20del%20cammino%20tra%20Puerto%20de%20Pajares%20e%20Pajares%2005.jpg' },
    { km: 7.2, n: 'mar-de-nubes-2', l: 'Entre Santa Marina y Llanos de Somerón', u: C + 'tratto%20del%20cammino%20tra%20Santa%20Marina%20e%20Llanos%20de%20Somer%C3%B3n%2003.jpg' },
    { km: 8.6, n: 'someron-burro', l: 'Entre Santa Marina y Llanos de Somerón', u: C + 'tratto%20del%20cammino%20tra%20Santa%20Marina%20e%20Llanos%20de%20Somer%C3%B3n%2001.jpg' },
    { km: 14.5, n: 'fresneo-herias-1', l: 'Entre Fresneo y Herías', u: C + 'tratto%20di%20cammino%20tra%20Fresneo%20a%20Her%C3%ADas%2004.jpg' },
    { km: 16.6, n: 'fresneo-bosque', l: 'Entre Fresneo y Herías', u: C + 'tratto%20di%20cammino%20tra%20Fresneo%20a%20Her%C3%ADas%2006.jpg' },
    { km: 19.3, n: 'herias-aldea', l: 'Herías', u: C + 'Her%C3%ADas%2002.jpg' },
    { km: 20.1, n: 'herias-campomanes', l: 'Entre Herías y Campomanes', u: C + 'tratto%20di%20cammino%20tra%20Her%C3%ADas%20e%20Campomanes%2002.jpg' },
    { km: 23.6, n: 'santa-cristina-2', l: 'Santa Cristina de Lena', u: C + 'Iglesia%20de%20Santa%20Cristina%20de%20Lena%2C%2003.jpg' },
    { km: 25.5, n: 'vega-ciego-puente', l: 'Vega del Ciego', u: C + 'Vega%20del%20Ciego%2001.jpg' },
    { km: 27.6, n: 'pola-paseo', l: 'La Pola', u: C + 'La%20Pola%20de%20Lena%2C%2001.jpg' },
  ];
  const ANCHOS = [480, 800, 1280, 1920];
  // pueblos que el trazado de OSM no cruza de verdad (su nodo cae lejos): fuera del perfil
  const FUERA = ['frecha'];

  function datos() {
    const s = document.getElementById('bajada-datos');
    if (!s) return null;
    try { return JSON.parse(s.textContent); } catch (er) { return null; }
  }
  const nodo = (tag, cls, attrs) => {
    const e = tag.startsWith('svg:') ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    if (cls) e.setAttribute('class', cls);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    return e;
  };

  function montar(el, opciones) {
    const D = datos();
    if (!D || !D.perfil) throw new Error('sin datos de la bajada');
    if (el.dataset.montado) return { destruir() {} };
    const op = Object.assign({ movimiento: true, densidad: 'caminos' }, opciones);
    const quieto = !op.movimiento || op.densidad === 'sobria';
    const KM = D.perfil.km, ALT = D.perfil.alt, TOT = KM[KM.length - 1];
    const AMIN = 250, AMAX = 1450;
    const X = (km) => (km / TOT) * 100;
    const Y = (a) => ((AMAX - a) / (AMAX - AMIN)) * 100;
    const altEn = (km) => {
      let i = 1;
      while (i < KM.length - 1 && KM[i] < km) i++;
      const t = cl((km - KM[i - 1]) / ((KM[i] - KM[i - 1]) || 1));
      return ALT[i - 1] + (ALT[i] - ALT[i - 1]) * t;
    };
    // los sitios por los que pasas, por orden: las cinco paradas y los pueblos del camino
    const sitios = D.paradas.map((p, i) => Object.assign({ parada: i }, p))
      .concat(D.pueblos.filter((p) => !FUERA.includes(p.id)))
      .sort((a, b) => a.km - b.km);
    sitios[sitios.length - 1].t = 'La Pola · la puerta del albergue';

    el.textContent = '';
    el.dataset.montado = '1';
    const bj = nodo('div', 'bj' + (quieto ? ' es-quieto' : ''));
    const pin = nodo('div', 'bj__pin');
    bj.appendChild(pin);

    /* fotos */
    const capaFotos = nodo('div', 'bj__fotos');
    const fotos = (quieto ? FOTOS.filter((f) => f.n === 'bajada-ubinas-1') : FOTOS).map((f) => {
      const caja = nodo('div', 'bj__foto');
      const pic = document.createElement('picture');
      const av = nodo('source', null, { type: 'image/avif', sizes: '100vw' });
      const wb = nodo('source', null, { type: 'image/webp', sizes: '100vw' });
      const img = nodo('img', null, { alt: '', width: 1920, height: 1280, decoding: 'async' });
      pic.append(av, wb, img);
      caja.appendChild(pic);
      capaFotos.appendChild(caja);
      const cargar = () => {
        if (img.dataset.cargada) return;
        img.dataset.cargada = '1';
        const set = (ext) => ANCHOS.map((w) => `img/fotos/${f.n}-${w}.${ext} ${w}w`).join(', ');
        av.srcset = set('avif'); wb.srcset = set('webp');
        img.sizes = '100vw'; img.srcset = set('jpg'); img.src = `img/fotos/${f.n}-1280.jpg`;
      };
      return Object.assign({}, f, { caja, img, cargar });
    });
    pin.appendChild(capaFotos);
    pin.appendChild(nodo('div', 'bj__velo'));

    /* panel: dónde estás, altitud y km */
    const panel = nodo('div', 'bj__panel');
    const envP = nodo('div', 'env');
    const lugar = nodo('p', 'bj__lugar', { 'aria-live': 'off' });
    const lugarS = nodo('small'); lugarS.textContent = 'Ahora pasas por';
    const lugarB = nodo('b');
    lugar.append(lugarS, lugarB);
    const cifras = nodo('div', 'bj__cifras');
    const cifra = (txt) => {
      const c = nodo('p', 'bj__cifra'); const b = nodo('b'); const s = nodo('span'); s.textContent = txt;
      c.append(b, s); cifras.appendChild(c); return b;
    };
    const bAlt = cifra('de altitud');
    const bKm = cifra(`recorridos de ${coma(TOT)}`);
    envP.append(lugar, cifras);
    panel.appendChild(envP);
    pin.appendChild(panel);

    /* la gráfica: el monte, la línea que falta (a trazos), la hecha (ocre), los pueblos, las paradas y tú */
    const graf = nodo('div', 'bj__grafica');
    const envG = nodo('div', 'env');
    const lienzo = nodo('div', 'bj__lienzo');
    const svg = nodo('svg:svg', 'bj__svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    const pts = KM.map((k, i) => `${X(k).toFixed(3)} ${Y(ALT[i]).toFixed(3)}`);
    svg.appendChild(nodo('svg:path', 'bj__monte', { d: `M0 100L${pts.join('L')}L100 100Z` }));
    svg.appendChild(nodo('svg:path', 'bj__base', { d: `M${pts.join('L')}` }));
    const hecho = nodo('svg:path', 'bj__hecho', { d: 'M0 0' });
    svg.appendChild(hecho);
    lienzo.appendChild(svg);
    const pueblos = sitios.filter((s) => s.parada === undefined).map((s) => {
      const d = nodo('i', 'bj__pueblo', { title: s.t });
      d.style.left = X(s.km) + '%'; d.style.top = Y(altEn(s.km)) + '%';
      lienzo.appendChild(d);
      return { s, d };
    });
    // los arcos del logo (de la cabecera, ya en la página) para colgarlos en las paradas
    const arcosLogo = Array.from(document.querySelectorAll('#lectura .arco')).map((p) => p.getAttribute('d'));
    const paradas = D.paradas.map((p, i) => {
      const d = nodo('div', 'bj__parada');
      d.style.left = X(p.km) + '%'; d.style.top = Y(altEn(p.km)) + '%';
      if (arcosLogo[i]) {
        const s = nodo('svg:svg', null, { 'aria-hidden': 'true', focusable: 'false' });
        const a = nodo('svg:path', null, { d: arcosLogo[i] });
        s.appendChild(a);
        d.appendChild(s);
        lienzo.appendChild(d);
        try { const b = a.getBBox(); if (b.width) s.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`); } catch (er) {}
      } else lienzo.appendChild(d);
      const et = nodo('span');
      et.textContent = p.t;
      const sm = nodo('small'); sm.textContent = `km ${coma(p.km)} · ${mil(p.alt)} m`;
      et.appendChild(sm);
      d.appendChild(et);
      return { p, d };
    });
    const marca = nodo('div', 'bj__marca', { 'aria-hidden': 'true' });
    marca.appendChild(nodo('i'));
    lienzo.appendChild(marca);
    const eje = nodo('div', 'bj__eje', { 'aria-hidden': 'true' });
    // cada 5 km en su sitio, y el total al final si no cae encima del último
    const marcas = []; for (let k = 0; k <= TOT - 1.5; k += 5) marcas.push([k, `${k} km`]);
    marcas.push([TOT, `${coma(TOT)} km`]);
    marcas.forEach(([k, t]) => { const s = nodo('span'); s.textContent = t; s.style.left = X(k) + '%'; eje.appendChild(s); });
    lienzo.appendChild(eje);
    envG.appendChild(lienzo);
    graf.appendChild(envG);
    pin.appendChild(graf);

    /* el crédito de la foto que se ve */
    const credito = nodo('a', 'bj__credito', { rel: 'noopener', target: '_blank' });
    pin.appendChild(credito);

    /* el remate */
    const remate = nodo('div', 'bj__remate');
    const r1 = nodo('p');
    r1.innerHTML = `Del puerto a tu litera: <b>${mil(D.mas_abajo)} m</b> más abajo.`;
    const r2 = nodo('p');
    r2.textContent = `${coma(TOT)} km por el Camino del Salvador, de ${mil(D.alt_puerto)} m en el puerto a ${mil(D.alt_puerta)} m en la puerta. Aquí tienes tu cama.`;
    const btn = nodo('a', 'btn btn--ocre', { href: '#reservar', 'data-reservar': '' });
    btn.textContent = 'Ver camas libres';
    const r3 = nodo('p', 'bj__honesto');
    r3.textContent = D.textos && D.textos.honesto ? D.textos.honesto : '';
    remate.append(r1, r2, btn, r3);
    pin.appendChild(remate);

    // un resumen para lectores de pantalla (lo visual es aria-hidden o cambia con el scroll)
    const resumen = nodo('p', 'vh');
    resumen.textContent = `${D.textos.resumen} Paradas: ${D.paradas.map((p) => `${p.t}, km ${coma(p.km)}, ${mil(p.alt)} m`).join('; ')}.`;
    bj.appendChild(resumen);
    el.appendChild(bj);

    /* pintar un km */
    let fotoActual = -1, sitioActual = -1;
    function pintarKm(km, p) {
      const a = altEn(km);
      bAlt.innerHTML = `${mil(a)}<small>m</small>`;
      bKm.innerHTML = `${coma(km)}<small>km</small>`;
      // la línea hecha, hasta donde vas
      let i = 0; const parte = [];
      while (i < KM.length && KM[i] <= km) { parte.push(pts[i]); i++; }
      parte.push(`${X(km).toFixed(3)} ${Y(a).toFixed(3)}`);
      hecho.setAttribute('d', 'M' + parte.join('L'));
      marca.style.left = X(km) + '%'; marca.style.top = Y(a) + '%';
      // el sitio por el que pasas: el último que has dejado atrás (con 150 m de margen)
      let s = 0;
      sitios.forEach((x, j) => { if (x.km <= km + 0.15) s = j; });
      if (s !== sitioActual) {
        sitioActual = s;
        const x = sitios[s];
        lugarS.textContent = s === sitios.length - 1 ? 'Has llegado' : (km - x.km > 0.6 ? 'Después de' : 'Ahora pasas por');
        lugarB.textContent = x.t;
      } else if (s < sitios.length - 1) {
        lugarS.textContent = km - sitios[s].km > 0.6 ? 'Después de' : 'Ahora pasas por';
      }
      paradas.forEach(({ p: q, d }, j) => {
        d.classList.toggle('es-pasada', q.km <= km + 0.05);
        const sig = paradas[j + 1];
        d.classList.toggle('es-actual', q.km <= km + 0.05 && (!sig || sig.p.km > km + 0.05));
      });
      pueblos.forEach(({ s: q, d }) => d.classList.toggle('es-pasado', q.km <= km));
      // la foto del tramo (y se precarga la siguiente)
      let f = 0;
      fotos.forEach((x, j) => { if (x.km <= km) f = j; });
      if (f !== fotoActual) {
        fotoActual = f;
        fotos[f].cargar(); if (fotos[f + 1]) fotos[f + 1].cargar();
        fotos.forEach((x, j) => x.caja.classList.toggle('es-actual', j === f));
        credito.href = fotos[f].u;
        credito.textContent = `${fotos[f].l} · Foto: Mongolo1984 · CC BY-SA 4.0`;
      }
      // un leve acercamiento dentro de cada foto
      const sigKm = fotos[f + 1] ? fotos[f + 1].km : TOT;
      fotos[f].caja.style.setProperty('--z', cl((km - fotos[f].km) / ((sigKm - fotos[f].km) || 1)).toFixed(3));
      remate.classList.toggle('es-visible', p >= .93);
    }

    if (quieto) {
      pintarKm(TOT, 1);
      remate.classList.add('es-visible');
      return { destruir() { delete el.dataset.montado; } };
    }

    /* con el scroll */
    bj.style.setProperty('--bj-alto', innerWidth < 700 ? '420vh' : '520vh');
    let pend = 0;
    const alto = () => (Roma.web && Roma.web.altoVista) || innerHeight;
    function alScroll() {
      pend = 0;
      const r = bj.getBoundingClientRect();
      const rec = r.height - alto();
      const p = rec > 0 ? cl(-r.top / rec) : 0;
      // un respiro arriba (el puerto) y abajo (el remate)
      const km = cl((p - .04) / .84) * TOT;
      pintarKm(km, p);
    }
    const onScroll = () => { if (!pend) pend = requestAnimationFrame(alScroll); };
    addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => { bj.style.setProperty('--bj-alto', innerWidth < 700 ? '420vh' : '520vh'); alScroll(); };
    addEventListener('roma:resize', onResize);
    alScroll();
    return {
      destruir() {
        removeEventListener('scroll', onScroll);
        removeEventListener('roma:resize', onResize);
        if (pend) cancelAnimationFrame(pend);
        delete el.dataset.montado;
      },
    };
  }

  Roma.bajada = { montar };
})();
