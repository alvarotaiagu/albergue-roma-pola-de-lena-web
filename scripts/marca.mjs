/* La marca del Albergue Roma en iconos: su cruz (marca/cruz.svg, redibujada del logo) sobre --noche.
   El logo del cliente NO se rediseña: aquí solo se coloca.
   Uso: node scripts/marca.mjs → marca/favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png
   e img/og.jpg (1200×630). Necesita antes img/fotos/ (scripts/fotos.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOCHE = '#16110D', OCRE = '#B07E4A', OCRE_CLARO = '#CBAB89', CAL = '#F3EEE6';

// el interior de marca/cruz.svg (viewBox 40×44), con los colores para fondo oscuro
const cruz = fs.readFileSync(path.join(RAIZ, 'marca/cruz.svg'), 'utf8')
  .replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replace(/fill="#683C10"/g, `fill="${OCRE_CLARO}"`).replace(/fill="#B07E4A"/g, `fill="${OCRE}"`);
const icono = (tam, radio) => {
  const lado = tam * .7, s = lado / 44, x = (tam - 40 * s) / 2, y = (tam - 44 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">`
    + `<rect width="${tam}" height="${tam}" rx="${radio}" fill="${NOCHE}"/>`
    + `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})">${cruz}</g></svg>`;
};

fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), icono(64, 12));
await sharp(Buffer.from(icono(64, 12))).resize(32, 32).png().toFile(path.join(RAIZ, 'marca/favicon-32.png'));
await sharp(Buffer.from(icono(512, 0))).resize(180, 180).png().toFile(path.join(RAIZ, 'marca/apple-touch-icon.png'));
await sharp(Buffer.from(icono(512, 0))).png().toFile(path.join(RAIZ, 'marca/icono-512.png'));

// og:image 1200×630: el puerto de Pajares muy oscuro, la cruz grande a la derecha y la frase a la izquierda
const foto = await sharp(path.join(RAIZ, 'img/fotos/puerto-ubinas-2-1280.jpg')).resize(1200, 630, { fit: 'cover' })
  .modulate({ brightness: .42, saturation: .6 }).toBuffer();
const s = 430 / 44;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="v" x1="0" x2="1"><stop offset="0" stop-color="${NOCHE}" stop-opacity=".92"/><stop offset=".62" stop-color="${NOCHE}" stop-opacity=".55"/><stop offset="1" stop-color="${NOCHE}" stop-opacity=".2"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#v)"/>
  <g transform="translate(${(900 - 20 * s).toFixed(1)} ${(315 - 22 * s).toFixed(1)}) scale(${s.toFixed(3)})">${cruz}</g>
  <text x="70" y="250" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="74" letter-spacing="-2" fill="${CAL}">Todos los caminos</text>
  <text x="70" y="330" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="74" letter-spacing="-2" fill="${CAL}">llevan a Roma.</text>
  <text x="72" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${OCRE_CLARO}">Albergue en Pola de Lena · Camino del Salvador</text>
  <text x="72" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#E4DBCF">Al final de la bajada de Pajares · camas desde 15 €</text>
</svg>`;
await sharp(foto).composite([{ input: Buffer.from(og) }]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('marca/ e img/og.jpg listos');
