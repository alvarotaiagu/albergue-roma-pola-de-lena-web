/* Prepara las fotos de la web. Uso: node scripts/fotos.mjs [nombre…]
   - Fuentes: ref/fotos-booking (las del albergue, de Booking, 3000×2250) y ref/fotos-lena
     (Wikimedia Commons, Mongolo1984, CC BY-SA 4.0, 3840×2560). Lista y recortes en
     scripts/fotos-lista.json. Nada de fotos generadas con IA.
   - NUNCA amplía: anchos 480, 800, 1280 y 1920 solo si caben (y `max` por foto: las de dentro
     se quedan en 1280, a tamaño contenido).
   - Gradación común:
       · las de Lena: un punto más cálidas, verdes algo menos chillones y negros suaves, para que
         casen con el castaño de la marca;
       · las de dentro: medio balance de blancos «mundo gris» (quita el frío del fluorescente),
         un poco de calidez y negros algo levantados.
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json (lo lee construir.mjs
     para poner width/height y srcset). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, 'ref');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

const TODAS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const pedidas = process.argv.slice(2);
const FOTOS = pedidas.length ? TODAS.filter((f) => pedidas.includes(f.nombre)) : TODAS;
const ANCHOS = [480, 800, 1280, 1920];

function peso(h, centro, ancho) {
  let d = Math.abs(h - centro); if (d > 180) d = 360 - d;
  return d >= ancho ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / ancho);
}

function gradar(data, canales, { interior = false, fuerza = 1 } = {}) {
  const n = data.length / canales;
  let gr = 1, gg = 1, gb = 1;
  if (interior) {
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < data.length; i += canales) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
    const mr = sr / n, mg = sg / n, mb = sb / n, mm = (mr + mg + mb) / 3;
    gr = 1 + 0.5 * (mm / mr - 1); gg = 1 + 0.5 * (mm / mg - 1); gb = 1 + 0.5 * (mm / mb - 1);
  }
  const LEVANTE = interior ? 0.035 : 0.045;
  for (let i = 0; i < data.length; i += canales) {
    let r = Math.min(1, data[i] * gr / 255), g = Math.min(1, data[i + 1] * gg / 255), b = Math.min(1, data[i + 2] * gb / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c > 0) {
      if (max === r) h = 60 * (((g - b) / c) % 6);
      else if (max === g) h = 60 * ((b - r) / c + 2);
      else h = 60 * ((r - g) / c + 4);
      if (h < 0) h += 360;
    }
    let s = max === 0 ? 0 : c / max;
    const v = max;
    // Lena: verdes (~95º) y azules de cielo (~215º) un poco menos chillones; dentro: casi igual
    s *= interior ? 0.96 : 0.95 * (1 - 0.16 * peso(h, 95, 50) - 0.12 * peso(h, 215, 40));
    const cc = v * s, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = v - cc;
    let rr, g2, bb;
    if (h < 60) [rr, g2, bb] = [cc, x, 0];
    else if (h < 120) [rr, g2, bb] = [x, cc, 0];
    else if (h < 180) [rr, g2, bb] = [0, cc, x];
    else if (h < 240) [rr, g2, bb] = [0, x, cc];
    else if (h < 300) [rr, g2, bb] = [x, 0, cc];
    else [rr, g2, bb] = [cc, 0, x];
    r = rr + m0; g = g2 + m0; b = bb + m0;
    const curva = (t) => LEVANTE + (1 - LEVANTE - 0.015) * t;
    r = curva(r); g = curva(g); b = curva(b);
    // un punto más cálidas
    r = Math.min(1, r * 1.022 + 0.004); g = Math.min(1, g * 1.004); b *= interior ? 0.965 : 0.955;
    const o0 = data[i], o1 = data[i + 1], o2 = data[i + 2];
    data[i] = Math.round(o0 + (r * 255 - o0) * fuerza);
    data[i + 1] = Math.round(o1 + (g * 255 - o1) * fuerza);
    data[i + 2] = Math.round(o2 + (b * 255 - o2) * fuerza);
  }
  return data;
}

async function una(f) {
  const fuente = path.join(REF, f.ruta);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  let base = sharp(fuente).rotate();
  if (f.recorte) base = base.extract(f.recorte);
  const meta = await base.clone().metadata();
  const W0 = f.recorte ? f.recorte.width : (meta.orientation >= 5 ? meta.height : meta.width);
  const tope = Math.min(W0, f.max || 1920);
  // se reduce ANTES de gradar (nunca se amplía)
  const { data, info } = await base.resize({ width: tope, withoutEnlargement: true, kernel: 'lanczos3' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  gradar(data, info.channels, { interior: !!f.interior, fuerza: f.fuerza ?? 1 });
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  const W = info.width, H = info.height;
  const anchos = [...new Set([...ANCHOS.filter((w) => w < W - 30), W])];
  for (const w of anchos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' });
    if (w < W) p = p.sharpen({ sigma: 0.5, m1: 0.5, m2: 1 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await p.clone().avif({ quality: f.aq ?? 48, effort: 5 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: f.wq ?? 72 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(dst + '.jpg');
  }
  console.log(f.nombre.padEnd(24), anchos.join(','), `${W}x${H}`);
  return { nombre: f.nombre, anchos, ancho: W, alto: H, origen: f.ruta, recorte: f.recorte || null, lena: !!f.lena };
}

// de tres en tres (sharp ya usa varios hilos; más no compensa y satura el PC)
const hechas = [];
for (let i = 0; i < FOTOS.length; i += 3) hechas.push(...await Promise.all(FOTOS.slice(i, i + 3).map(una)));

const ruta = path.join(SALIDA, 'fotos.json');
const previas = fs.existsSync(ruta) && pedidas.length ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : [];
const todas = [...previas.filter((p) => !hechas.some((h) => h.nombre === p.nombre)), ...hechas];
todas.sort((a, b) => TODAS.findIndex((t) => t.nombre === a.nombre) - TODAS.findIndex((t) => t.nombre === b.nombre));
fs.writeFileSync(ruta, JSON.stringify(todas, null, 1));
console.log(hechas.length + ' fotos');
