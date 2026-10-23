/* Verificación de la web del Albergue Roma (Playwright, un solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs   (puerto 8861). Sin capturas: lo que hay que mirar a ojo va en el README.
   El WebGL de la cruz NO se pinta: el navegador arranca con --disable-3d-apis; se comprueba que el
   módulo monta sin errores y deja su respaldo. Todo con movimiento reducido salvo una pasada final con
   movimiento (cortina, bajada, hilo y pie). Antes de lanzarla: que no haya otra prueba en marcha
   (Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8861;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const LLAVE = 'albergueroma-cookies';

/* librerías desde una copia local: la prueba no depende del CDN ese día */
const CDN = {
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
};
const CACHE = path.join(os.tmpdir(), 'roma-cdn');
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /cdn\.jsdelivr\.net\/npm\/.*\/(lenis|gsap|ScrollTrigger)\.min\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

/* contraste WCAG 2 (los pares de tokens que se usan como texto) */
const lum = (hex) => { const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* ================= 0. archivos (sin navegador) ================= */
console.log('\n0. Archivos');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, ?nofollow">/.test(s), `${f}: charset lo primero y noindex justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!-- falta /.test(s) && !/<!--(parte|svg|json):/.test(s), `${f}: todas sus partes incluidas`);
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'img/terreno/perfil.svg', 'img/terreno/bajada.json', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png'].every((f) => fs.existsSync(path.join(RAIZ, f))), '.nojekyll, 404, manifest, og:image, perfil y favicons');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  comprobar(!/js\/3d\/|css\/3d\.css/.test(html), 'sin rastro del 3D (decisión de Álvaro): ni js/3d/ ni css/3d.css');
  comprobar(/imagesrcset="img\/fotos\/puerto-ubinas-2-480\.avif/.test(html) && /data-foto="puerto-ubinas-2"/.test(html), 'la foto de la portada va precargada (la misma que pinta el <picture>)');
  // copia honesta: sin reseñas ni promesas que el sitio no sostiene (DATOS: reseñas malas)
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  const prohibidas = ['limpi', 'impecable', 'acogedor', 'trato familiar', 'ambiente', 'el mejor', 'whatsapp', 'ascensor', 'opinion', 'reseña', 'valoraci', 'estrellas'].filter((p) => texto.toLowerCase().includes(p));
  comprobar(prohibidas.length === 0, 'la copia no promete limpieza, trato ni ambiente, ni cita reseñas, WhatsApp o ascensor', prohibidas);
  const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/terreno/bajada.json'), 'utf8'));
  const coma = (v) => v.toFixed(1).replace('.', ',');
  comprobar(texto.includes(`${coma(D.km)} km`) && texto.includes('1.377 m') && texto.includes(`${D.alt_puerta} m`), `la bajada cita las cifras medidas (${coma(D.km)} km, de ${D.alt_puerto} a ${D.alt_puerta} m) de bajada.json`);
  const m = html.match(/<script type="application\/json" id="bajada-datos">([\s\S]*?)<\/script>/);
  let ok = false; try { ok = JSON.parse(m[1]).mas_abajo === D.mas_abajo; } catch (e) {}
  comprobar(ok, 'los datos de la bajada van en la página (JSON válido, los mismos que bajada.json)');
}
{
  // contrastes de los tokens (texto ≥ 4,5:1)
  const pares = [['#1A1612', '#F3EEE6', 'tinta / cal'], ['#5A4E44', '#E8E0D3', 'tinta-2 / cal-2'], ['#745434', '#E8E0D3', 'ocre-texto / cal-2'], ['#745434', '#F3EEE6', 'ocre-texto / cal'],
    ['#B8AA98', '#16110D', 'niebla / noche'], ['#CBAB89', '#16110D', 'ocre-claro / noche'], ['#F3EEE6', '#683C10', 'cal / castaño (botón)'], ['#16110D', '#B07E4A', 'noche / ocre (botón)'],
    ['#683810', '#F1E2D2', 'aviso / aviso-fondo'], ['#FFFFFF', '#2450A0', 'blanco / taquilla (cama libre)'], ['#3F3831', '#B9B1A6', 'texto / cama ocupada'], ['#E4DBCF', '#16110D', 'texto claro / noche']];
  const malos = pares.map(([a, b, n]) => [n, contraste(a, b).toFixed(2)]).filter(([, c]) => +c < 4.5);
  comprobar(malos.length === 0, `contraste de texto ≥ 4,5:1 en los ${pares.length} pares de tokens`, malos);
}

/* ================= navegador ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
const errores = [];
async function abrir(url, { ancho = 1280, alto = 800, movimiento = false, cookies = true, js = true, toque = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1, reducedMotion: movimiento ? 'no-preference' : 'reduce', javaScriptEnabled: js, hasTouch: toque, isMobile: toque });
  await ctx.route(RE_CDN, local);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
  if (cookies) await ctx.addInitScript((k) => { try { localStorage.setItem(k, 'si'); } catch (e) {} }, LLAVE);
  const page = await ctx.newPage();
  const propios = [];
  page.on('pageerror', (e) => propios.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') propios.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) propios.push('HTTP ' + r.status() + ' ' + r.url()); });
  await page.goto(BASE + url);
  return { ctx, page, propios };
}
const sinScrollLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

try {
  /* ================= 1. escritorio, movimiento reducido ================= */
  console.log('\n1. Escritorio (1280×800, movimiento reducido)');
  {
    const { ctx, page, propios } = await abrir('index.html');
    await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'));
    const r = await page.evaluate(() => ({
      cortina: !document.getElementById('cortina') || document.getElementById('cortina').hidden,
      cab: getComputedStyle(document.getElementById('cab')).opacity,
      h1: document.querySelectorAll('h1').length,
      sinAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      abierta: document.getElementById('portada').classList.contains('abierta'),
      vivo: document.getElementById('vivo-txt').textContent,
      tramos: document.querySelectorAll('.tramo .t-linea').length,
      arcos: document.querySelectorAll('.tramo .t-arco').length,
      lectura: document.querySelectorAll('#lectura .arco').length,
      mando: document.getElementById('mando').hidden,
      vistazo: getComputedStyle(document.getElementById('vistazo')).display,
      mapa: !!document.querySelector('#mapa iframe'),
      cookies: document.getElementById('cookies').hidden,
    }));
    comprobar(r.cortina && r.cab === '1', 'con movimiento reducido no hay cortina y la cabecera está', r);
    comprobar(r.h1 === 1 && r.sinAlt === 0, 'un solo h1 y todas las imágenes con alt', r);
    comprobar(r.abierta, 'la portada se abre (titular y botones a la vista)');
    comprobar(/registro/i.test(r.vivo), 'la línea en vivo dice algo del registro según la hora de Madrid', r.vivo);
    comprobar(r.tramos === 6 && r.arcos === 5 && r.lectura === 5, 'el hilo: 6 tramos de línea y 5 arcos colgando; 5 arcos de lectura en la cabecera', r);
    comprobar(r.mando && r.vistazo === 'none', 'sin ?revision: ni mando ni «de un vistazo»');
    comprobar(!r.mapa, 'el mapa de Google no se carga solo');
    comprobar(r.cookies, 'con el aviso ya visto, no vuelve a salir');
    comprobar(await sinScrollLateral(page), 'sin scroll lateral');
    // la cruz sin WebGL: el respaldo se queda
    const cruz = await page.evaluate(() => { const s = document.querySelector('.portada__cruz'); const b = s && s.getBoundingClientRect(); return { svg: !!s && b.width > 50 && getComputedStyle(s).visibility !== 'hidden', canvas: !!document.querySelector('#portada canvas') }; });
    comprobar(cruz.svg, 'portada sin WebGL: la cruz en SVG se ve (respaldo)', cruz);
    // el foco con rombos
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    const rombos = await page.evaluate(() => { const r = document.querySelector('.foco-rombos'); return !!r && r.classList.contains('es-visible') && r.querySelectorAll('i').length === 4; });
    comprobar(rombos, 'con el teclado, el foco lleva los cuatro rombos de la cruz');
    // puertas
    await page.evaluate(() => document.getElementById('habitaciones').scrollIntoView());
    const puertas = await page.waitForFunction(() => document.querySelector('[data-modulo="puertas"]').dataset.montado === '1', null, { timeout: 5000 }).then(() => true, () => false);
    comprobar(puertas, 'el módulo Puertas se monta al acercarse');
    const nPuertas = await page.evaluate(() => document.querySelectorAll('[data-modulo="puertas"] button').length);
    comprobar(nPuertas >= 8, 'las 8 puertas son botones', nPuertas);
    // bajada, quieta (movimiento reducido): entera, con el remate
    await page.evaluate(() => document.getElementById('bajada').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('[data-modulo="bajada"]').dataset.montado === '1', null, { timeout: 5000 }).catch(() => {});
    const bj = await page.evaluate(() => ({
      quieto: !!document.querySelector('.bj.es-quieto'),
      alt: document.querySelector('.bj__cifra b')?.textContent,
      remate: document.querySelector('.bj__remate')?.textContent || '',
      arcos: document.querySelectorAll('.bj__parada.es-pasada').length,
      credito: document.querySelector('.bj__credito')?.textContent || '',
      foto: document.querySelector('.bj__foto.es-actual img')?.getAttribute('src') || '',
    }));
    comprobar(bj.quieto && bj.alt === '316m' && /1\.061 m/.test(bj.remate) && bj.arcos === 5, 'la bajada quieta: en la puerta (316 m), las 5 paradas con su arco y el remate «1.061 m más abajo»', bj);
    comprobar(/Mongolo1984/.test(bj.credito) && /bajada-ubinas-1/.test(bj.foto), 'la foto de la bajada lleva su crédito', bj);
    // visor por nombre
    await page.click('[data-visor="litera"]');
    const v1 = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre }));
    await page.keyboard.press('ArrowRight');
    const v2 = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    await page.keyboard.press('Escape');
    const v3 = await page.evaluate(() => document.getElementById('visor').open);
    comprobar(v1.open && v1.n === 'litera' && v2 === 'bano-2' && !v3, 'el visor abre la foto por su nombre, pasa a la siguiente y se cierra', { v1, v2, v3 });
    // mapa al pedirlo
    await page.click('#mapa-btn');
    comprobar(await page.evaluate(() => !!document.querySelector('#mapa iframe[src*="output=embed"]')), 'el mapa se carga al pulsar «Ver el mapa»');

    /* simulador */
    const m0 = await page.evaluate(() => { const M = window.__motor; return { modo: M.st.modo, ini: M.st.ini, n: M.CAMAS.length, privs: M.PRIVS.length }; });
    comprobar(m0.modo === 'camas' && m0.n === 20 && m0.privs === 6, 'simulador: camas sueltas por defecto, 20 camas en el plano y 6 privadas', m0);
    const libre = await page.evaluate(() => document.querySelector('#motor .cama[data-libre="si"]')?.dataset.cama);
    await page.click(`[data-cama="${libre}"]`);
    const t1 = await page.evaluate(() => ({ tot: document.getElementById('m-total').textContent, n: window.__motor.st.camas.length, noches: document.getElementById('m-noches').textContent }));
    comprobar(t1.n === 1 && t1.tot.startsWith(15 * +t1.noches + ' €'), 'una cama elegida: el total es 15 € por noche', t1);
    const ocupada = await page.evaluate(() => { const b = document.querySelector('#motor .cama[data-libre="no"]'); return b ? b.disabled : true; });
    comprobar(ocupada, 'las camas ocupadas esas noches no se pueden pulsar');
    await page.click('#m-seguir');
    await page.click('#motor form button[type="submit"]');
    const err = await page.evaluate(() => document.getElementById('m-error').textContent);
    comprobar(/Falta/.test(err), 'sin datos, el formulario dice lo que falta', err);
    await page.fill('#m-nombre', 'Prueba Peregrina');
    await page.fill('#m-correo', 'prueba@example.com');
    await page.fill('#m-tel', '600000000');
    await page.selectOption('#m-hora', '17:00');
    await page.check('#m-ok');
    await page.click('#motor form button[type="submit"]');
    const loc = await page.evaluate(() => ({ loc: document.getElementById('m-loc')?.textContent, aviso: document.querySelector('.m-hecho .demo-aviso')?.textContent || '' }));
    comprobar(/^ROM-\d{6}-\d{3}$/.test(loc.loc || '') && /no se ha enviado, guardado ni cobrado/.test(loc.aviso), 'confirmación con localizador ROM-AAMMDD-NNN y el aviso de demostración', loc);
    // «Ver si hay sitio» desde una puerta: Roma.reservar con la habitación
    await page.evaluate(() => window.Roma.reservar({ habitacion: 'fresneo' }));
    const pre = await page.evaluate(() => ({ modo: window.__motor.st.modo, hab: window.__motor.st.hab, pulsada: document.querySelector('#motor [data-hab="fresneo"]')?.getAttribute('aria-pressed') }));
    comprobar(pre.modo === 'priv' && pre.hab === 'fresneo' && pre.pulsada === 'true', 'Roma.reservar({ habitacion: "fresneo" }) deja elegida la doble Fresneo en el plano', pre);
    await page.evaluate(() => window.Roma.reservar({ habitacion: 'carabanzo' }));
    const pre2 = await page.evaluate(() => ({ modo: window.__motor.st.modo, foco: !!document.querySelector('[data-dorm="carabanzo"].es-foco') }));
    comprobar(pre2.modo === 'camas' && pre2.foco, 'Roma.reservar({ habitacion: "carabanzo" }) va a camas sueltas y marca ese dormitorio', pre2);
    comprobar(propios.length === 0, 'escritorio: sin errores de JS ni archivos que falten', propios);
    errores.push(...propios);
    await ctx.close();
  }

  /* ================= 2. versión sobria (mando de maqueta) ================= */
  console.log('\n2. Mando de maqueta: ?revision&densidad=sobria');
  {
    const { ctx, page, propios } = await abrir('index.html?revision&densidad=sobria');
    await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'));
    const r = await page.evaluate(() => ({ vistazo: getComputedStyle(document.getElementById('vistazo')).display, mando: document.getElementById('mando').hidden }));
    comprobar(r.vistazo === 'block' && !r.mando, 'la sobria añade «El albergue, de un vistazo» y el mando se ve', r);
    await page.click('#mando [data-densidad="caminos"]');
    const r2 = await page.evaluate(() => ({ vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search }));
    comprobar(r2.vistazo === 'none' && !/densidad/.test(r2.url), 'el mando pasa a «Caminos» sin recargar', r2);
    comprobar(propios.length === 0, 'mando: sin errores', propios);
    await ctx.close();
  }

  /* ================= 3. móvil ================= */
  console.log('\n3. Móvil (390×844 y 360×740)');
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const { ctx, page, propios } = await abrir('index.html', { ancho: w, alto: h, toque: true });
    await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'));
    for (const id of ['habitaciones', 'bajada', 'reservar', 'pie']) { await page.evaluate((x) => document.getElementById(x).scrollIntoView(), id); await page.waitForTimeout(150); }
    comprobar(await sinScrollLateral(page), `${w}px: sin scroll lateral con todos los módulos montados`);
    if (w === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.click('#menu-btn');
      const abierto = await page.evaluate(() => document.body.classList.contains('menu') && getComputedStyle(document.getElementById('menu-movil')).visibility === 'visible');
      await page.keyboard.press('Escape');
      const cerrado = await page.evaluate(() => !document.body.classList.contains('menu'));
      comprobar(abierto && cerrado, 'el menú del móvil se abre y se cierra con Escape');
      // el resize de la barra del móvil no rehace nada
      const antes = await page.evaluate(() => { window.__rehecho = 0; addEventListener('roma:resize', () => window.__rehecho++); return 1; });
      await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(350);
      comprobar(antes && await page.evaluate(() => window.__rehecho === 0), 'el cambio de alto de la barra del móvil no rehace nada');
    }
    comprobar(propios.length === 0, `${w}px: sin errores`, propios);
    await ctx.close();
  }

  /* ================= 4. sin JavaScript ================= */
  console.log('\n4. Sin JavaScript');
  {
    const { ctx, page } = await abrir('index.html', { js: false });
    const r = await page.evaluate(() => ({
      cortina: (() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; })(),
      habs: [...document.querySelectorAll('.habs .hab')].filter((x) => x.getBoundingClientRect().height > 50).length,
      perfil: (() => { const i = document.querySelector('.bajada__perfil-img'); return !!i && getComputedStyle(i).display !== 'none'; })(),
      pueblos: document.querySelectorAll('.bajada__pueblos li').length,
      h1: document.querySelector('h1').getBoundingClientRect().height > 0,
    }));
    comprobar(r.cortina && r.h1, 'sin JS no hay cortina y la portada se lee', r);
    comprobar(r.habs === 8 && r.perfil && r.pueblos >= 10, 'sin JS: las 8 habitaciones, el perfil de la bajada y los pueblos con su km', r);
    await ctx.close();
  }

  /* ================= 5. legales y 404 ================= */
  console.log('\n5. Legales y 404');
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html', '404.html']) {
    const { ctx, page, propios } = await abrir(f, { ancho: 390, alto: 844 });
    const ok = await page.evaluate(() => document.querySelector('h1')?.textContent.length > 3);
    comprobar(ok && propios.length === 0 && await sinScrollLateral(page), `${f}: carga, tiene h1, sin errores ni scroll lateral`, propios);
    await ctx.close();
  }

  /* ================= 6. con movimiento (una pasada, al final) ================= */
  console.log('\n6. Con movimiento (cortina, hilo, bajada, pie)');
  {
    const { ctx, page, propios } = await abrir('index.html', { movimiento: true, cookies: false });
    const tapa = await page.evaluate(() => document.documentElement.classList.contains('cortina-activa'));
    const fuera = await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera') && document.getElementById('cortina').hidden, null, { timeout: 9000 }).then(() => true, () => false);
    comprobar(tapa && fuera, 'la cortina tapa al cargar y se retira de verdad (hidden)', { tapa, fuera });
    await page.waitForTimeout(300);
    comprobar(await page.evaluate(() => !document.getElementById('cookies').hidden), 'sin haberlo visto, el aviso de cookies sale al retirarse la cortina');
    await page.click('#ck-si');
    // la bajada fijada: a mitad de su recorrido, el altímetro ya no está en el puerto
    await page.evaluate(() => document.getElementById('bajada').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('[data-modulo="bajada"]').dataset.montado === '1', null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => { const b = document.querySelector('.bj'); const r = b.getBoundingClientRect(); window.scrollTo(0, scrollY + r.top + (r.height - innerHeight) * 0.5); });
    await page.waitForFunction(() => { const t = document.querySelector('.bj__cifra b')?.textContent || ''; return t && t !== '1.377m'; }, null, { timeout: 4000 }).catch(() => {});
    const mitad = await page.evaluate(() => ({ alt: document.querySelector('.bj__cifra b').textContent, km: document.querySelectorAll('.bj__cifra b')[1].textContent, pin: getComputedStyle(document.querySelector('.bj__pin')).position, remate: document.querySelector('.bj__remate').classList.contains('es-visible') }));
    const altN = parseInt(mitad.alt.replace(/\D/g, ''), 10);
    comprobar(mitad.pin === 'sticky' && altN < 1377 && altN > 316 && !mitad.remate, 'la bajada se fija y, a mitad, el altímetro va bajando (ni puerto ni puerta) sin remate todavía', mitad);
    await page.evaluate(() => { const b = document.querySelector('.bj'); const r = b.getBoundingClientRect(); window.scrollTo(0, scrollY + r.top + (r.height - innerHeight) - 2); });
    await page.waitForFunction(() => document.querySelector('.bj__remate').classList.contains('es-visible'), null, { timeout: 4000 }).catch(() => {});
    comprobar(await page.evaluate(() => document.querySelector('.bj__remate').classList.contains('es-visible') && document.querySelector('.bj__cifra b').textContent === '316m'), 'al final de la bajada: 316 m y el remate con «Ver camas libres»');
    // el hilo: un tramo ya pasado está dibujado entero
    const tramo = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tramo="1"] .t-linea')).strokeDashoffset);
    comprobar(parseFloat(tramo) < 0.01, 'el tramo del hilo de una sección ya pasada está dibujado', tramo);
    // el pie: abajo del todo, el puente entero
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => getComputedStyle(document.getElementById('pie')).getPropertyValue('--k').trim() === '1.0000', null, { timeout: 4000 }).catch(() => {});
    const pie = await page.evaluate(() => ({ k: getComputedStyle(document.getElementById('pie')).getPropertyValue('--k').trim(), arcos: [...document.querySelectorAll('#pie-logo .arco')].map((a) => a.style.getPropertyValue('--k-n')) }));
    comprobar(pie.k === '1.0000' && pie.arcos.every((x) => x === '1.000'), 'abajo del todo, los cinco arcos forman el puente del logo', pie);
    comprobar(propios.length === 0, 'con movimiento: sin errores', propios);
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} bien, ${fallos.length} mal`);
if (fallos.length) { console.log('Fallos:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
