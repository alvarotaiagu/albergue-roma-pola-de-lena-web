/* ------------------------------------------------------------------
   Albergue Roma · portada «Todos los caminos llevan a Roma» (agente Cruz)
   Miles de puntos ocres y de cal llegan por caminos desde los bordes de la
   pantalla (senderos que serpentean, se juntan y convergen) y se posan
   formando la cruz del logo, con su retícula de puntos alrededor.
   - La cruz respira; los puntos se apartan del puntero y vuelven (resorte).
   - Arrastrar sobre la cruz la deshace en estela; al soltar, cada punto
     vuelve por su camino. En táctil: arrastre lateral (el vertical es scroll)
     y un toque la sacude.
   - Al salir de la portada con el scroll, la cruz se deshace y los puntos
     caen en una línea que baja (la línea del logo) y se van por su extremo,
     donde empieza el hilo de la página.
   WebGL a pelo (sin librerías). Presupuesto: DPR ≤ 1,5, calidad que baja
   sola midiendo el tiempo de cada fotograma, pausa fuera de pantalla y con
   la pestaña oculta, sin simulación cuando todo está quieto y sin rAF del
   todo tras 25 s sin que pase nada.
   Contrato: Roma.cruz.montar(el, { movimiento, densidad }) → { destruir() }
   y el.dataset.montado = '1'. El HTML de el es el respaldo (SVG de la cruz y
   foto): se queda si no hay WebGL, con densidad sobria o si algo falla.
   Roma.cruz.sitio(el) → { x, y, r } en px de la ventana: centro de la cruz y
   distancia del centro a la punta de un pétalo (la usa la cortina).
   La posición sale de css/cruz.css (--cruz-x, --cruz-y, --cruz-r, --cruz-linea).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const w = window, d = document;
  const Roma = (w.Roma = w.Roma || {});

  /* ============ la cruz del logo (marca/cruz.svg; unidades del logo, punta a 19,3) ============ */
  const PUNTA = 19.3, MEDIO = 4.05, DENTRO = 6, RECTO = 14.9;
  const ROMBOS = [[-13.21, -16.44], [14.13, -16.44], [14.13, 16.56], [-13.21, 16.56]], RR = 4.75, RC = 3.85;
  const bz = (t, a, b, c, e) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * e; };
  // la punta del pétalo: curva de (4,05; 14,9) a (0; 19,3) en (lateral, profundidad)
  const PUNTA_TAB = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; PUNTA_TAB.push([bz(t, 4.05, 4.05, 1.6, 0), bz(t, 14.9, 17.2, 19.05, 19.3)]); }
  function medioAncho(p) {
    if (p < DENTRO || p > PUNTA) return -1;
    if (p <= RECTO) return MEDIO;
    for (let i = 1; i < PUNTA_TAB.length; i++) {
      const [l1, p1] = PUNTA_TAB[i];
      if (p1 >= p) { const [l0, p0] = PUNTA_TAB[i - 1]; return l0 + (l1 - l0) * ((p - p0) / ((p1 - p0) || 1)); }
    }
    return 0;
  }
  // 0 = punto central, 1 = pétalo, 2 = rombo de esquina, -1 = fuera
  function pieza(x, y) {
    if (x * x + y * y <= RC * RC) return 0;
    const ax = Math.abs(x), ay = Math.abs(y);
    const m = medioAncho(ay >= ax ? ay : ax);
    if (m >= 0 && (ay >= ax ? ax : ay) <= m) return 1;
    for (let k = 0; k < 4; k++) if (Math.abs(x - ROMBOS[k][0]) + Math.abs(y - ROMBOS[k][1]) <= RR) return 2;
    return -1;
  }
  function contornos() {
    const lado = [[-MEDIO, DENTRO], [-MEDIO, RECTO]];
    for (let i = 1; i <= 40; i++) lado.push([-PUNTA_TAB[i][0], PUNTA_TAB[i][1]]);
    for (let i = 39; i >= 0; i--) lado.push([PUNTA_TAB[i][0], PUNTA_TAB[i][1]]);
    lado.push([MEDIO, DENTRO], [-MEDIO, DENTRO]);
    const giros = [(l, p) => [l, -p], (l, p) => [p, l], (l, p) => [-l, p], (l, p) => [-p, -l]];
    const lazos = giros.map((f) => ({ pts: lado.map(([l, p]) => f(l, p)), pieza: 1 }));
    ROMBOS.forEach(([x, y]) => lazos.push({ pts: [[x, y - RR], [x + RR, y], [x, y + RR], [x - RR, y], [x, y - RR]], pieza: 2 }));
    const circ = [];
    for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; circ.push([Math.cos(a) * RC, Math.sin(a) * RC]); }
    lazos.push({ pts: circ, pieza: 0 });
    return lazos;
  }
  const longitud = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  function aLoLargo(pts, paso, desfase) {
    const out = [];
    let resto = desfase * paso;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const L = Math.hypot(x1 - x0, y1 - y0);
      let s = resto;
      while (s <= L) { const f = L ? s / L : 0; out.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]); s += paso; }
      resto = s - L;
    }
    return out;
  }

  /* ============ azar con semilla (los mismos caminos cada vez) ============ */
  function azar(semilla) {
    let a = semilla >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const gauss = (rnd) => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ============ dónde va la cruz (lo dice css/cruz.css) ============ */
  function sonda(el) {
    let s = el.querySelector(':scope > .cruz__sitio');
    if (!s) {
      s = d.createElement('i');
      s.className = 'cruz__sitio';
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return s;
  }
  function sitio(el) {
    if (!el) return null;
    const r = sonda(el).getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  }
  function linea(el, W, H) {
    const v = getComputedStyle(el).getPropertyValue('--cruz-linea').trim().split(/[\s,]+/).map(parseFloat);
    const [x1, y1, x2, y2] = v.length === 4 && v.every((n) => isFinite(n)) ? v : (W < 900 || H > W ? [.62, .5, .965, 1] : [.36, .8, .97, 1]);
    return { ax: x1 * W, ay: y1 * H, bx: x2 * W, by: y2 * H };
  }

  /* ============ los caminos: senderos desde los bordes que serpentean y se juntan ============ */
  const PUNTOS_CAMINO = 160;
  function hacerCaminos(W, H, C, r, K, rnd) {
    const m = 30;
    const borde = (ang) => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let t = Infinity;
      if (dx > 1e-6) t = Math.min(t, (W + m - C.x) / dx);
      if (dx < -1e-6) t = Math.min(t, (-m - C.x) / dx);
      if (dy > 1e-6) t = Math.min(t, (H + m - C.y) / dy);
      if (dy < -1e-6) t = Math.min(t, (-m - C.y) / dy);
      return [C.x + dx * t, C.y + dy * t];
    };
    const tri = (x) => { const f = x - Math.floor(x); return 4 * Math.abs(f - .5) - 1; };
    function tramo(a, b) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
      const amp = (.08 + rnd() * .09) * (rnd() < .5 ? -1 : 1), f1 = .7 + rnd() * 1.3, f2 = 2.2 + rnd() * 2.6, p1 = rnd() * 6.3, p2 = rnd() * 6.3;
      const zig = rnd() < .38 ? L * (.01 + rnd() * .014) : 0, fz = 5 + rnd() * 6, pz = rnd();
      const pts = [];
      for (let i = 0; i <= 72; i++) {
        const u = i / 72;
        const env = Math.pow(Math.sin(Math.PI * u), .85) * Math.pow(1 - u, .35);
        const off = amp * L * env * (.72 * Math.sin(2 * Math.PI * f1 * u + p1) + .28 * Math.sin(2 * Math.PI * f2 * u + p2)) + zig * env * tri(u * fz + pz);
        pts.push([a[0] + (b[0] - a[0]) * u + nx * off, a[1] + (b[1] - a[1]) * u + ny * off]);
      }
      return pts;
    }
    function remuestrear(pts) {
      const L = longitud(pts), M = PUNTOS_CAMINO, xs = new Float32Array(M), ys = new Float32Array(M);
      let j = 1, acc = 0, seg = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      for (let i = 0; i < M; i++) {
        const s = L * i / (M - 1);
        while (j < pts.length - 1 && acc + seg < s) { acc += seg; j++; seg = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); }
        const f = seg ? clamp((s - acc) / seg, 0, 1) : 0;
        xs[i] = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f;
        ys[i] = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f;
      }
      const nxs = new Float32Array(M), nys = new Float32Array(M);
      for (let i = 0; i < M; i++) {
        const a = Math.max(0, i - 1), b = Math.min(M - 1, i + 1);
        const dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.hypot(dx, dy) || 1;
        nxs[i] = -dy / l; nys[i] = dx / l;
      }
      return { xs, ys, nxs, nys, L };
    }
    const giro = rnd() * Math.PI * 2;
    const troncos = [], todos = [];
    for (let k = 0; k < K; k++) {
      const ang = giro + ((k + .5 + (rnd() - .5) * .7) / K) * Math.PI * 2;
      const S = borde(ang);
      const rama = (k % 5 === 1 || k % 5 === 3) && troncos.length > 0;
      let pts, uj = 1;
      if (rama) {
        // se junta con el tronco anterior a mitad de camino
        const T = troncos[troncos.length - 1];
        const idx = Math.floor((.32 + rnd() * .26) * (T.length - 1));
        const ramal = tramo(S, T[idx]);
        uj = longitud(ramal);
        pts = ramal.concat(T.slice(idx + 1));
        uj = uj / longitud(pts);
      } else {
        pts = tramo(S, [C.x, C.y]);
        troncos.push(pts);
      }
      const c = remuestrear(pts);
      c.uj = uj;
      c.ancho = rama ? 2.1 : 3.1;
      // donde el camino empieza a abrirse hacia su sitio en la cruz
      let ib = PUNTOS_CAMINO - 1;
      for (let i = 0; i < PUNTOS_CAMINO; i++) if (Math.hypot(c.xs[i] - C.x, c.ys[i] - C.y) < 1.9 * r) { ib = i; break; }
      c.ub = clamp(ib / (PUNTOS_CAMINO - 1), .5, .97);
      c.ang = Math.atan2(c.ys[ib] - C.y, c.xs[ib] - C.x);
      todos.push(c);
    }
    return todos;
  }

  /* ============ WebGL ============ */
  const VS = `
attribute vec2 a_pos; attribute vec4 a_col; attribute vec4 a_ext;
uniform vec2 u_res, u_c, u_par; uniform float u_dpr, u_time, u_r, u_breath, u_fade, u_trail, u_glow, u_vis;
varying vec4 v_col;
void main() {
  vec2 p = a_pos; vec2 dc = p - u_c; float q = length(dc) / (u_r * 1.6);
  p = u_c + dc * (1.0 + u_breath / (1.0 + q * q * q * q));
  p += u_par * a_ext.y;
  vec2 cl = p / u_res * 2.0 - 1.0;
  gl_Position = vec4(cl.x, -cl.y, 0.0, 1.0);
  float a; float s = a_ext.x;
  if (a_ext.w >= 0.0) {
    float e = u_time - a_ext.w;
    a = a_col.a * clamp(e / 0.25, 0.0, 1.0) * (0.34 + 0.66 * exp(-max(e, 0.0) * 1.1)) * u_trail;
  } else {
    a = a_col.a * (0.8 + 0.2 * sin(u_time * (1.1 + a_ext.z * 2.3) + a_ext.z * 61.0)) * u_fade;
  }
  if (u_glow > 0.5) { s *= 4.2; a *= 0.085; }
  gl_PointSize = max(s * u_dpr, 1.0);
  v_col = vec4(a_col.rgb, a * u_vis);
}`;
  const FS = `
precision mediump float;
varying vec4 v_col; uniform float u_glow;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q);
  if (r > 1.0) discard;
  float f = u_glow > 0.5 ? (1.0 - r) * (1.0 - r) : 1.0 - smoothstep(0.3, 1.0, r);
  float a = v_col.a * f;
  gl_FragColor = vec4(v_col.rgb * a, a);
}`;
  function programa(gl) {
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    return p;
  }

  const COL = {
    ocre: [.69, .494, .29], claro: [.886, .706, .498], castano: [.557, .353, .165], cal: [.953, .933, .902],
  };
  const elige = (rnd, tabla) => { let x = rnd(); for (const [p, c] of tabla) { if ((x -= p) <= 0) return c; } return tabla[tabla.length - 1][1]; };

  /* ============ montar ============ */
  function montar(el, opciones) {
    const op = Object.assign({ movimiento: true, densidad: 'caminos' }, opciones || {});
    if (!el) return { destruir() {} };
    if (el.__cruz) return el.__cruz;
    let q = '';
    try { q = w.location.search; } catch (er) {}
    const quieta = op.densidad === 'sobria';
    const sinGL = /[?&]sin-gl(=|&|$)/.test(q);
    const asa = { destruir };
    el.__cruz = asa;
    el.dataset.montado = '1';

    let canvas = null, gl = null, vivo = false, raf = 0, espera = 0;
    const quitar = [];
    const on = (o, ev, fn, opt) => { o.addEventListener(ev, fn, opt); quitar.push(() => o.removeEventListener(ev, fn, opt)); };
    const anfitrion = el.closest('section') || el.parentElement || el;
    const tactil = (w.matchMedia && w.matchMedia('(pointer: coarse)').matches) || false;
    const toqueOriginal = anfitrion.style.touchAction, cursorOriginal = anfitrion.style.cursor;

    // sobria o ?sin-gl: la cruz quieta en SVG (el respaldo); sin canvas, sin GL, sin listeners
    if (quieta || sinGL) {
      el.dataset.cruz = quieta ? 'sobria' : 'respaldo';
      el.classList.add(quieta ? 'cruz--quieta' : 'cruz--sin-gl');
      return asa;
    }


    function fallar(er) {
      if (er) console.warn('Cruz: queda el respaldo.', er);
      parar();
      if (canvas) canvas.remove();
      canvas = null; gl = null; vivo = false;
      el.classList.remove('cruz--viva');
      el.classList.add('cruz--sin-gl');
      el.dataset.cruz = 'respaldo';
    }

    try {
      canvas = d.createElement('canvas');
      canvas.className = 'cruz__lienzo';
      canvas.setAttribute('aria-hidden', 'true');
      const atr = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true, powerPreference: 'default' };
      gl = canvas.getContext('webgl', atr) || canvas.getContext('experimental-webgl', atr);
      if (!gl) { fallar(); return asa; }
    } catch (er) { fallar(er); return asa; }

    /* ---------- estado ---------- */
    const movil = innerWidth < 700 || tactil;
    const memoria = navigator.deviceMemory || 8, nucleos = navigator.hardwareConcurrency || 8;
    const ahorro = !!(navigator.connection && navigator.connection.saveData);
    let N = movil ? 3200 : (memoria <= 4 || nucleos <= 4 ? 6500 : 9000);
    if (ahorro) N = Math.min(N, 2000);
    let nAct = N, nivel = 0, dprMax = 1.5, conBrillo = true;
    let W = 0, H = 0, dpr = 1, C = { x: 0, y: 0 }, R = 100, LIN = null, caminos = [];
    let nTrazo = 0;
    // partículas (orden barajado: un prefijo es una muestra pareja, para bajar la calidad)
    const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    const tx = new Float32Array(N), ty = new Float32Array(N);
    const t0 = new Float32Array(N), du = new Float32Array(N), off = new Float32Array(N), cam = new Uint16Array(N);
    const estado = new Uint8Array(N);             // 0 llegando · 1 en su sitio · 2 en la estela · 3 volviendo
    const lag = new Uint8Array(N), ox = new Float32Array(N), oy = new Float32Array(N);
    const tr = new Float32Array(N), rd = new Float32Array(N), r0x = new Float32Array(N), r0y = new Float32Array(N), ub2 = new Float32Array(N);
    const sl = new Float32Array(N), jl = new Float32Array(N), dl = new Float32Array(N);
    const pos = new Float32Array(N * 2), atrib = new Float32Array(N * 8);
    let trazoPos = null, trazoAtr = null;

    /* ---------- GL ---------- */
    let prg, bPos, bAtr, bTPos, bTAtr, L = {}, U = {};
    function prepararGL() {
      prg = programa(gl);
      gl.useProgram(prg);
      ['a_pos', 'a_col', 'a_ext'].forEach((n) => { L[n] = gl.getAttribLocation(prg, n); });
      ['u_res', 'u_c', 'u_par', 'u_dpr', 'u_time', 'u_r', 'u_breath', 'u_fade', 'u_trail', 'u_glow', 'u_vis'].forEach((n) => { U[n] = gl.getUniformLocation(prg, n); });
      bPos = gl.createBuffer(); bAtr = gl.createBuffer(); bTPos = gl.createBuffer(); bTAtr = gl.createBuffer();
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
    }
    function enlazar(bp, ba) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bp);
      gl.enableVertexAttribArray(L.a_pos);
      gl.vertexAttribPointer(L.a_pos, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ba);
      gl.enableVertexAttribArray(L.a_col);
      gl.vertexAttribPointer(L.a_col, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(L.a_ext);
      gl.vertexAttribPointer(L.a_ext, 4, gl.FLOAT, false, 32, 16);
    }
    function tamano() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(w.devicePixelRatio || 1, dprMax);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /* ---------- construir: destinos, caminos y estelas de camino ---------- */
    function construir(llegada) {
      tamano();
      const rEl = el.getBoundingClientRect(), s = sitio(el) || { x: rEl.left + W * .7, y: rEl.top + H * .5, r: Math.min(W, H) * .3 };
      C = { x: s.x - rEl.left, y: s.y - rEl.top };
      R = s.r;
      LIN = linea(el, W, H);
      const rnd = azar(1923);
      const esc = R / PUNTA;                                  // px por unidad del logo
      const tam = clamp(R / 230, .8, 1.3);

      // los destinos: 10 % retícula, el resto la cruz (24 % de contorno y 76 % de relleno)
      const dest = [];
      const ret = [];
      const pr = 4.6, rmax = 2.05 * PUNTA;
      for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
        const x = (i + (j & 1) * .5) * pr, y = j * pr * .866;
        const rr = Math.hypot(x, y);
        if (rr > rmax || rr < PUNTA * .45) continue;
        let cerca = false;
        for (let k = 0; k < 8 && !cerca; k++) { const a = k / 8 * 6.283; if (pieza(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2) >= 0) cerca = true; }
        if (cerca || pieza(x, y) >= 0) continue;
        ret.push([x, y, Math.pow(1 - rr / rmax, 1.25)]);
      }
      const nRet = Math.min(ret.length, Math.round(N * .1));
      const nCruz = N - nRet, nCont = Math.round(nCruz * .24), nRell = nCruz - nCont;
      // contorno
      const lazos = contornos(), largo = lazos.reduce((a, l) => a + longitud(l.pts), 0);
      const pasoC = largo / nCont;
      lazos.forEach((l) => aLoLargo(l.pts, pasoC, rnd()).forEach(([x, y]) => dest.push({ x, y, p: l.pieza, borde: 1 })));
      // relleno: rejilla con temblor (más pareja que el azar puro)
      let area = 0;
      for (let y = -21.5; y < 21.5; y += .25) for (let x = -21.5; x < 21.5; x += .25) if (pieza(x, y) >= 0) area += .0625;
      const g = Math.sqrt(area / nRell);
      for (let y = -21.5; y < 21.5; y += g) for (let x = -21.5; x < 21.5; x += g) {
        const xx = x + (rnd() - .5) * g * .8, yy = y + (rnd() - .5) * g * .8;
        const p = pieza(xx, yy);
        if (p >= 0) dest.push({ x: xx, y: yy, p, borde: 0 });
      }
      while (dest.length > nCruz) dest.splice((rnd() * dest.length) | 0, 1);
      while (dest.length < nCruz) { const o = dest[(rnd() * dest.length) | 0]; dest.push({ x: o.x + (rnd() - .5) * g * .5, y: o.y + (rnd() - .5) * g * .5, p: o.p, borde: 0 }); }
      // la retícula, repartida
      for (let k = 0; k < nRet; k++) { const r0 = ret[Math.floor(k * ret.length / nRet)]; dest.push({ x: r0[0], y: r0[1], p: 3, f: r0[2] }); }
      // barajar
      for (let i = dest.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = dest[i]; dest[i] = dest[j]; dest[j] = t; }

      // los caminos
      const K = movil ? 12 : 20;
      caminos = hacerCaminos(W, H, C, R, K, rnd);

      // cada punto, por el camino que llega por su lado
      const llegadaMin = caminos.map(() => ({ t0: 1e9, du: 1 }));
      for (let i = 0; i < N; i++) {
        const o = dest[i];
        tx[i] = C.x + o.x * esc; ty[i] = C.y + o.y * esc;
        const a = Math.atan2(o.y, o.x);
        let k1 = 0, k2 = 0, d1 = 9, d2 = 9;
        for (let k = 0; k < caminos.length; k++) {
          let dd = Math.abs(a - caminos[k].ang); if (dd > Math.PI) dd = 2 * Math.PI - dd;
          if (dd < d1) { d2 = d1; k2 = k1; d1 = dd; k1 = k; } else if (dd < d2) { d2 = dd; k2 = k; }
        }
        const k = rnd() < .3 ? k2 : k1;
        cam[i] = k;
        const c = caminos[k];
        off[i] = gauss(rnd) * c.ancho * (movil ? .8 : 1);
        t0[i] = .08 + Math.pow(rnd(), 1.45) * 1.55;
        du[i] = (.95 + rnd() * .55) * (.7 + .3 * Math.min(2, c.L / 900));
        if (t0[i] < llegadaMin[k].t0) llegadaMin[k] = { t0: t0[i], du: du[i] };

        // color, tamaño, profundidad
        let col, al = .9, sz = 1.7;
        if (o.p === 3) { col = COL.ocre; al = .55 * o.f; sz = 1.35; }
        else if (o.borde) { col = elige(rnd, [[.6, COL.claro], [.25, COL.cal], [.15, COL.ocre]]); sz = 1.9; al = .95; }
        else if (o.p === 0) { col = elige(rnd, [[.55, COL.cal], [.45, COL.claro]]); sz = 2.1; al = .95; }
        else if (o.p === 2) { col = elige(rnd, [[.6, COL.ocre], [.3, COL.claro], [.1, COL.cal]]); sz = 1.75; }
        else { col = elige(rnd, [[.55, COL.ocre], [.22, COL.claro], [.15, COL.castano], [.08, COL.cal]]); sz = 1.3 + rnd() * 1.1; al = .82; }
        if (o.p !== 3 && rnd() < .025) { col = COL.cal; sz = 3.6 + rnd() * 1.2; al = 1; }
        const b = i * 8;
        atrib[b] = col[0]; atrib[b + 1] = col[1]; atrib[b + 2] = col[2]; atrib[b + 3] = al;
        atrib[b + 4] = sz * tam; atrib[b + 5] = o.p === 3 ? -.45 : (rnd() * 2 - 1); atrib[b + 6] = rnd(); atrib[b + 7] = -1;

        // la salida: su hueco en la línea que baja (por su proyección sobre la línea)
        const lx = LIN.bx - LIN.ax, ly = LIN.by - LIN.ay, l2 = lx * lx + ly * ly || 1;
        sl[i] = clamp(((tx[i] - LIN.ax) * lx + (ty[i] - LIN.ay) * ly) / l2, 0, 1) * .92 + rnd() * .08;
        jl[i] = gauss(rnd) * (movil ? 1 : 1.4);
        dl[i] = rnd() * .14 + .1 * clamp(Math.abs((tx[i] - LIN.ax) * ly - (ty[i] - LIN.ay) * lx) / Math.sqrt(l2) / (H * .6), 0, 1);
      }

      // las estelas de los caminos (puntos fijos que se encienden al pasar los primeros)
      const tp = [], ta = [];
      caminos.forEach((c, k) => {
        const m = llegadaMin[k];
        const hasta = Math.floor(c.uj * (PUNTOS_CAMINO - 1));
        for (let i = 0; i <= hasta; i += movil ? 2 : 1) {
          const x = c.xs[i], y = c.ys[i];
          if (Math.hypot(x - C.x, y - C.y) < 1.3 * R) continue;
          const u = i / (PUNTOS_CAMINO - 1);
          tp.push(x, y);
          ta.push(COL.ocre[0], COL.ocre[1], COL.ocre[2], .3, 1.25 * tam, -.6, rnd(), llegada ? m.t0 + m.du * (1 - Math.pow(1 - u, 1 / 2.2)) : -30);
        }
      });
      trazoPos = new Float32Array(tp); trazoAtr = new Float32Array(ta); nTrazo = tp.length / 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, bAtr); gl.bufferData(gl.ARRAY_BUFFER, atrib, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bTPos); gl.bufferData(gl.ARRAY_BUFFER, trazoPos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bTAtr); gl.bufferData(gl.ARRAY_BUFFER, trazoAtr, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);

      for (let i = 0; i < N; i++) {
        vx[i] = vy[i] = 0;
        if (llegada) { estado[i] = 0; const c = caminos[cam[i]]; px[i] = c.xs[0]; py[i] = c.ys[0]; }
        else { estado[i] = 1; px[i] = tx[i]; py[i] = ty[i]; }
      }
    }

    /* ---------- dónde está un punto en su camino (u de 0 a 1), con su apertura final hacia el sitio ---------- */
    let qx = 0, qy = 0;
    function enCamino(i, u) {
      const c = caminos[cam[i]], M1 = PUNTOS_CAMINO - 1;
      const f = u * M1, i0 = Math.min(M1 - 1, f | 0), k = f - i0;
      const x = c.xs[i0] + (c.xs[i0 + 1] - c.xs[i0]) * k, y = c.ys[i0] + (c.ys[i0 + 1] - c.ys[i0]) * k;
      const wb = suave(c.ub, 1, u), o = off[i] * (1 - wb);
      qx = x + c.nxs[i0] * o + wb * (tx[i] - C.x);
      qy = y + c.nys[i0] * o + wb * (ty[i] - C.y);
    }
    // la salida con el scroll: cae a su hueco en la línea y se va por el extremo
    let prog = 0;
    function haciaLinea(i, bx, by) {
      const e = clamp((prog - .04 - dl[i]) / .42, 0, 1);
      if (e <= 0) { qx = bx; qy = by; return; }
      let f = clamp((prog - .5) / .5, 0, 1); f *= f;
      const s = sl[i] + (1 - sl[i]) * f;
      const lx = LIN.bx - LIN.ax, ly = LIN.by - LIN.ay, ll = Math.hypot(lx, ly) || 1;
      const Lx = LIN.ax + lx * s - ly / ll * jl[i], Ly = LIN.ay + ly * s + lx / ll * jl[i];
      qx = bx + (Lx - bx) * e * (2 - e);
      qy = by + (Ly - by) * e * e;
    }

    /* ---------- puntero, arrastre y toque ---------- */
    const ptr = { x: 0, y: 0, dentro: false, raton: false, ult: 0 };
    let arr = null;                                   // { id, hist: [[x,y,t]], x, y, x0, y0, t0 }
    const NB = 24, BX = new Float32Array(NB), BY = new Float32Array(NB);
    let parX = 0, parY = 0, parTX = 0, parTY = 0;
    let rafaga = null;                                // toque: sacudida
    let ultimaActividad = 0;
    const local = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const enCruz = (x, y) => Math.hypot(x - C.x, y - C.y) < R * 1.15;
    const interactivo = (t) => t && t.closest && t.closest('a,button,input,select,textarea,label,summary,[role="button"],[tabindex]');
    function despertar() { ultimaActividad = t; pedir(); }

    function alMover(e) {
      if (!vivo) return;
      const [x, y] = local(e);
      ptr.x = x; ptr.y = y; ptr.dentro = true; ptr.raton = e.pointerType !== 'touch';
      if (ptr.raton) { parTX = clamp((x - C.x) / Math.max(W, H), -.5, .5) * 26; parTY = clamp((y - C.y) / Math.max(W, H), -.5, .5) * 26; }
      if (arr && e.pointerId === arr.id) {
        arr.x = x; arr.y = y;
        arr.hist.push([x, y, t]);
        if (arr.hist.length > 90) arr.hist.splice(0, arr.hist.length - 90);
      }
      if (!arr && ptr.raton) anfitrion.style.cursor = enCruz(x, y) && prog < .05 ? 'grab' : cursorOriginal;
      despertar();
    }
    function alPulsar(e) {
      if (!vivo || !op.movimiento || prog > .05 || interactivo(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const [x, y] = local(e);
      if (!enCruz(x, y)) return;
      arr = { id: e.pointerId, hist: [[x, y, t]], x, y, x0: x, y0: y, t0: t, tipo: e.pointerType };
      if (e.pointerType === 'mouse') { anfitrion.style.cursor = 'grabbing'; e.preventDefault(); }
      try { if (e.pointerType !== 'touch') anfitrion.setPointerCapture(e.pointerId); } catch (er) {}
      despertar();
    }
    function alSoltar(e) {
      if (!arr || (e && e.pointerId !== arr.id)) return;
      const corto = Math.hypot(arr.x - arr.x0, arr.y - arr.y0) < 8 && t - arr.t0 < .35;
      if (corto) rafaga = { x: arr.x, y: arr.y };
      soltar();
      if (ptr.raton) anfitrion.style.cursor = enCruz(ptr.x, ptr.y) ? 'grab' : cursorOriginal;
      despertar();
    }
    function soltar() {
      if (!arr) return;
      arr = null;
      let n = 0;
      for (let i = 0; i < nAct; i++) {
        if (estado[i] !== 2) continue;
        estado[i] = 3; n++;
        tr[i] = t + Math.random() * .32;
        rd[i] = .85 + Math.random() * .6;
        ub2[i] = Math.max(.42, caminos[cam[i]].ub - .14);
        r0x[i] = px[i]; r0y[i] = py[i];
      }
      return n;
    }
    function alSalir() { ptr.dentro = false; parTX = parTY = 0; if (!arr) anfitrion.style.cursor = cursorOriginal; despertar(); }

    /* ---------- un paso de la simulación ---------- */
    let t = 0;
    const kLleg = (x) => 1 - Math.pow(1 - x, 2.2);
    const kIO = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    function simular(pasos) {
      let ocupado = false, maxV = 0;
      const salida = prog > .0005;
      const ks = .055 + .12 * Math.min(1, prog * 8), am = salida ? .74 : .84;
      const rp = Math.max(56, R * .36), rp2 = rp * rp, fuerza = 3.1;
      const hover = ptr.dentro && ptr.raton && !arr && prog < .05;
      const rc = Math.max(30, R * .26), rc2 = rc * rc;
      // la estela: dónde estaba el puntero hace k·Δ segundos
      if (arr) {
        const h = arr.hist;
        for (let b = 0; b < NB; b++) {
          const tt = t - b * .022;
          let j = h.length - 1;
          while (j > 0 && h[j - 1][2] > tt) j--;
          const a = h[Math.max(0, j - 1)], c = h[j];
          const f = c[2] > a[2] ? clamp((tt - a[2]) / (c[2] - a[2]), 0, 1) : 1;
          BX[b] = a[0] + (c[0] - a[0]) * f; BY[b] = a[1] + (c[1] - a[1]) * f;
        }
      }
      let rx = 0, ry = 0, rr2 = 0;
      if (rafaga) { rx = rafaga.x; ry = rafaga.y; rr2 = Math.pow(R * .6, 2); }

      for (let i = 0; i < nAct; i++) {
        const e = estado[i];
        if (e === 0) {
          const tau = (t - t0[i]) / du[i];
          if (tau < 1) {
            enCamino(i, tau <= 0 ? 0 : kLleg(tau));
            if (salida) haciaLinea(i, qx, qy);
            px[i] = qx; py[i] = qy;
            ocupado = true;
            continue;
          }
          estado[i] = 1; px[i] = tx[i]; py[i] = ty[i]; vx[i] = vy[i] = 0;
        } else if (e === 3) {
          const tau = (t - tr[i]) / rd[i];
          if (tau < 0) {
            for (let s = 0; s < pasos; s++) { vx[i] *= .9; vy[i] *= .9; px[i] += vx[i]; py[i] += vy[i]; }
            r0x[i] = px[i]; r0y[i] = py[i];
            ocupado = true;
            continue;
          }
          if (tau < 1) {
            enCamino(i, ub2[i] + (1 - ub2[i]) * kIO(tau));
            const s = suave(0, .42, tau);
            px[i] = r0x[i] + (qx - r0x[i]) * s; py[i] = r0y[i] + (qy - r0y[i]) * s;
            ocupado = true;
            continue;
          }
          estado[i] = 1; vx[i] = vy[i] = 0;
        } else if (e === 2) {
          const b = lag[i];
          const gx = BX[b] + ox[i], gy = BY[b] + oy[i];
          for (let s = 0; s < pasos; s++) {
            vx[i] = (vx[i] + (gx - px[i]) * .085) * .82; vy[i] = (vy[i] + (gy - py[i]) * .085) * .82;
            px[i] += vx[i]; py[i] += vy[i];
          }
          ocupado = true;
          continue;
        }
        // en su sitio: resorte hacia el destino (o hacia la línea, al salir)
        let gx = tx[i], gy = ty[i];
        if (salida) { haciaLinea(i, gx, gy); gx = qx; gy = qy; }
        if (arr) {
          const dx = px[i] - arr.x, dy = py[i] - arr.y;
          if (dx * dx + dy * dy < rc2 && atrib[i * 8 + 5] > -.4) {
            estado[i] = 2; lag[i] = (Math.random() * NB) | 0;
            const a = Math.random() * 6.283, rr = Math.abs(gauss(Math.random)) * R * .07;
            ox[i] = Math.cos(a) * rr; oy[i] = Math.sin(a) * rr;
            vx[i] += (Math.random() - .5) * 3; vy[i] += (Math.random() - .5) * 3;
            ocupado = true;
            continue;
          }
        }
        if (rr2) {
          const dx = px[i] - rx, dy = py[i] - ry, q2 = dx * dx + dy * dy;
          if (q2 < rr2 && q2 > .01) { const dd = Math.sqrt(q2), f = (1 - dd / Math.sqrt(rr2)) * 11 / dd; vx[i] += dx * f; vy[i] += dy * f; }
        }
        for (let s = 0; s < pasos; s++) {
          let ax = (gx - px[i]) * ks, ay = (gy - py[i]) * ks;
          if (hover) {
            const dx = px[i] - ptr.x, dy = py[i] - ptr.y, q2 = dx * dx + dy * dy;
            if (q2 < rp2 && q2 > .01) { const dd = Math.sqrt(q2), f = 1 - dd / rp, F = f * f * fuerza / dd; ax += dx * F; ay += dy * F; }
          }
          vx[i] = (vx[i] + ax) * am; vy[i] = (vy[i] + ay) * am;
          px[i] += vx[i]; py[i] += vy[i];
        }
        const v2 = vx[i] * vx[i] + vy[i] * vy[i];
        if (v2 > maxV) maxV = v2;
        // aún lejos de su sitio (el resorte no ha llegado)
        if (!ocupado && Math.abs(gx - px[i]) + Math.abs(gy - py[i]) > .3) ocupado = true;
      }
      rafaga = null;
      return ocupado || maxV > .0004 || !!arr;
    }

    /* ---------- dibujar ---------- */
    let vis = 0;
    function dibujar() {
      for (let i = 0; i < nAct; i++) { pos[i * 2] = px[i]; pos[i * 2 + 1] = py[i]; }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prg);
      gl.uniform2f(U.u_res, W, H);
      gl.uniform2f(U.u_c, C.x, C.y);
      gl.uniform2f(U.u_par, parX, parY);
      gl.uniform1f(U.u_dpr, dpr);
      gl.uniform1f(U.u_time, t);
      gl.uniform1f(U.u_r, R);
      gl.uniform1f(U.u_breath, op.movimiento ? .013 * Math.sin(t * 2 * Math.PI / 5.2) * suave(2.6, 4.2, t) * aliento : 0);
      gl.uniform1f(U.u_fade, 1 - suave(.8, 1, prog));
      gl.uniform1f(U.u_trail, 1 - suave(0, .2, prog));
      gl.uniform1f(U.u_vis, vis);
      // los caminos
      gl.uniform1f(U.u_glow, 0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (nTrazo) { enlazar(bTPos, bTAtr); gl.drawArrays(gl.POINTS, 0, nTrazo); }
      // los puntos: un halo suave (solo una parte) y el punto
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos.subarray(0, nAct * 2));
      enlazar(bPos, bAtr);
      if (conBrillo) {
        gl.uniform1f(U.u_glow, 1);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, Math.floor(nAct * .22));
        gl.uniform1f(U.u_glow, 0);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      gl.drawArrays(gl.POINTS, 0, nAct);
    }

    /* ---------- calidad: si los fotogramas tardan, menos píxeles, sin halo y menos puntos ---------- */
    let cuenta = 0, suma = 0;
    function medir(dt) {
      if (t < 1.2 || dt > .25) return;
      suma += dt; cuenta++;
      if (cuenta < 45) return;
      const media = suma / cuenta; cuenta = 0; suma = 0;
      if (media > .026 && nivel < 3) bajar(media);
    }
    function bajar(media) {
      nivel++;
      if (nivel === 1) { dprMax = 1; conBrillo = false; tamano(); }
      else nAct = Math.max(800, Math.floor(nAct * .6));
      el.dataset.calidad = String(nivel);
      console.info('Cruz: calidad ' + nivel + ' (fotograma medio ' + (media * 1000).toFixed(0) + ' ms)');
    }

    /* ---------- el bucle (solo cuando hace falta) ---------- */
    let visible = true, antes = 0, acum = 0, aliento = 1, scrollSucio = true;
    function leerScroll() {
      const r = el.getBoundingClientRect();
      const p = op.movimiento ? clamp(-r.top / (r.height * .8 || 1), 0, 1) : 0;
      const cambio = Math.abs(p - prog) > 1e-4;
      prog = p;
      if (prog > .05 && arr) soltar();
      return cambio;
    }
    function pedir() {
      if (raf || !vivo || !visible || d.hidden) return;
      clearTimeout(espera); espera = 0;
      antes = performance.now();
      raf = requestAnimationFrame(cuadro);
    }
    function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(espera); espera = 0; }
    function cuadro(ahora) {
      raf = 0;
      if (!vivo) return;
      const dt = Math.max(0, (ahora - antes) / 1000); antes = ahora;
      const paso = dt > .1 ? 1 / 30 : dt;                 // reloj que se traga los atascos
      t += paso;
      acum += paso;
      const pasos = Math.min(4, Math.floor(acum * 60)); acum -= pasos / 60;
      let mueve = false;
      if (scrollSucio) { mueve = leerScroll() || mueve; scrollSucio = false; }
      vis = Math.min(1, vis + paso / .35);
      const ocupado = simular(pasos);
      parX += (parTX - parX) * .07; parY += (parTY - parY) * .07;
      const paralaje = Math.abs(parTX - parX) + Math.abs(parTY - parY) > .02;
      if (ocupado || paralaje || mueve || vis < 1) ultimaActividad = t;
      // la respiración se apaga a los 25 s sin nada (esperando a un cruce por cero para no dar un salto)
      const quieto = t - ultimaActividad > 25;
      if (quieto && Math.abs(Math.sin(t * 2 * Math.PI / 5.2)) < .03) aliento = 0; else if (!quieto) aliento = 1;
      dibujar();
      if (ocupado) medir(dt);
      if (ocupado || paralaje || mueve || vis < 1) raf = requestAnimationFrame(cuadro);
      else if (aliento > 0) espera = setTimeout(() => { espera = 0; antes = performance.now() - 33; raf = requestAnimationFrame(cuadro); }, 33);
      // y si no, nada: sin rAF hasta que pase algo (puntero, scroll, tamaño)
    }

    /* ---------- arranque ---------- */
    try {
      prepararGL();
      el.insertBefore(canvas, el.firstChild);
      construir(op.movimiento);
      vivo = true;
      el.classList.remove('cruz--sin-gl');
      el.classList.add('cruz--viva');
      el.dataset.cruz = op.movimiento ? 'gl' : 'gl-quieta';
    } catch (er) { fallar(er); return asa; }

    on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); fallar('contexto perdido'); });
    if (!op.movimiento) {
      // quieta: un solo dibujo (y otro si cambia el ancho)
      vis = 1; t = 60; dibujar();
      let ancho = innerWidth;
      on(w, 'resize', () => {
        if (innerWidth === ancho) return;
        ancho = innerWidth;
        clearTimeout(espera);
        espera = setTimeout(() => { if (vivo) { construir(false); dibujar(); } }, 180);
      });
      return asa;
    }

    anfitrion.style.touchAction = 'pan-y pinch-zoom';
    on(anfitrion, 'pointermove', alMover, { passive: true });
    on(anfitrion, 'pointerdown', alPulsar);
    on(anfitrion, 'pointerup', alSoltar);
    on(anfitrion, 'pointercancel', alSoltar);
    on(anfitrion, 'pointerleave', alSalir);
    on(w, 'scroll', () => { scrollSucio = true; pedir(); }, { passive: true });
    on(d, 'visibilitychange', () => { if (d.hidden) parar(); else pedir(); });
    // el resize de la barra del móvil (mismo ancho, poca altura) no rehace nada
    let anchoVista = innerWidth, altoVista = innerHeight, tRes = 0;
    on(w, 'resize', () => {
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;
      anchoVista = innerWidth; altoVista = innerHeight;
      clearTimeout(tRes);
      tRes = setTimeout(() => {
        if (!vivo) return;
        const llegando = t < 3.4;
        construir(false);
        if (llegando) vis = 1;
        scrollSucio = true;
        despertar();
      }, 180);
    });
    quitar.push(() => clearTimeout(tRes));
    let io = null;
    if ('IntersectionObserver' in w) {
      io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) { scrollSucio = true; pedir(); } else parar(); });
      io.observe(el);
      quitar.push(() => io.disconnect());
    }
    pedir();
    return asa;

    function destruir() {
      try {
        vivo = false;
        parar();
        quitar.splice(0).forEach((f) => f());
        if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
        if (canvas) canvas.remove();
        anfitrion.style.touchAction = toqueOriginal;
        anfitrion.style.cursor = cursorOriginal;
        canvas = null; gl = null;
      } catch (er) {}   // (con sobria o sin WebGL las variables de arriba aún no existen: TDZ, se ignora)
      const s = el.querySelector(':scope > .cruz__sitio');
      if (s) s.remove();
      el.classList.remove('cruz--viva', 'cruz--sin-gl', 'cruz--quieta');
      delete el.dataset.montado;
      delete el.dataset.cruz;
      delete el.dataset.calidad;
      delete el.__cruz;
    }
  }

  Roma.cruz = { montar, sitio };
})();
