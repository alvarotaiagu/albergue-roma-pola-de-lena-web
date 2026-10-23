/* Genera las páginas a partir de sus fuentes *.src.html:
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo. Si no existe (la cortina mientras
      el agente Cruz no la haya dejado), avisa y deja un comentario.
   2. <!--svg:marca/x.svg|clase=a|id=b|viewBox=…|quitar=g1,g2--> → el SVG en línea, sin <title> ni role,
      con aria-hidden, la clase y el id pedidos, otro viewBox si se pide y sin los <g class="…"> de «quitar».
   3. <!--si-existe:ruta-->A<!--si-no-->B<!--fin-si--> → A si el archivo existe; si no, B (el póster del 3D).
   3 bis. <!--json:img/terreno/bajada.json|id=x--> → <script type="application/json" id="x"> con ese JSON
      compactado (los datos del perfil de la bajada, para js/bajada.js; así funciona también en file://).
   4. <img data-foto="nombre" …> → <picture> con AVIF, WebP y JPG en todos los anchos de
      img/fotos/fotos.json (el <img> conserva sus demás atributos).
   5. Los <link> y <script> de CSS/JS propios que aún no existen (los módulos de otros agentes
      mientras no estén) se quitan con un aviso: la web no pide archivos que no hay.
   6. Ejecuta versionar.mjs para poner ?v=<huella> a CSS y JS.
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).map((f) => [f.nombre, f]));
const avisos = [];
const avisar = (t) => { if (!avisos.includes(t)) { avisos.push(t); console.warn('  ' + t); } };

function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { avisar('(falta ' + ruta + ': se deja un comentario)'); return `<!-- falta ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});

const svgEnLinea = (html) => html.replace(/<!--svg:([^|>\s]+)((?:\|[^|>]*)*)-->/g, (m, ruta, resto) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { avisar('(falta ' + ruta + ')'); return ''; }
  const op = Object.fromEntries(resto.split('|').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  let s = fs.readFileSync(f, 'utf8').trim()
    .replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/^<svg\b([^>]*)>/, (t, a) => {
      a = a.replace(/\s(?:role|aria-labelledby|aria-label|width|height|class|id)="[^"]*"/g, '');
      if (op.viewBox) a = a.replace(/\sviewBox="[^"]*"/, ` viewBox="${op.viewBox}"`);
      return `<svg${op.id ? ` id="${op.id}"` : ''}${op.clase ? ` class="${op.clase}"` : ''}${a} aria-hidden="true" focusable="false">`;
    });
  for (const g of (op.quitar || '').split(',').filter(Boolean)) {
    s = s.replace(new RegExp(`<g class="${g}"[^>]*>[\\s\\S]*?</g>`, 'g'), '').replace(new RegExp(`<path class="${g}"[^>]*/>`, 'g'), '');
  }
  return s;
});

const condicionales = (html) => html.replace(/<!--si-existe:([^\s>]+)-->([\s\S]*?)<!--si-no-->([\s\S]*?)<!--fin-si-->/g,
  (m, ruta, si, no) => (fs.existsSync(path.join(RAIZ, ruta)) ? si : no));

const jsonEnLinea = (html) => html.replace(/<!--json:([^|>\s]+)\|id=([\w-]+)-->/g, (m, ruta, id) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { avisar('(falta ' + ruta + ')'); return ''; }
  const datos = JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8'))).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${id}">${datos}</script>`;
});

const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="((?:css)\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (avisar('(sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script src="((?:js)\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (avisar('(sin ' + r + ': se quita su <script>)'), '')));

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(jsonEnLinea(condicionales(svgEnLinea(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8'))))));
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
if (avisos.length) console.warn(`\n${avisos.length} aviso(s): lo que falta de los módulos se queda en su respaldo.`);
