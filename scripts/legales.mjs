/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   El titular y su NIF no se publican en ninguna fuente que tengamos: van como PENDIENTE visible. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<p class="aviso">PENDIENTE: nombre o razón social del titular, NIF/CIF y número de registro de turismo del Principado de Asturias.</p>
<dl>
  <dt>Nombre comercial</dt><dd>Albergue Roma</dd>
  <dt>Dirección</dt><dd>C/ Canuto Hevia, 12 · 33630 La Pola (Lena), Asturias</dd>
  <dt>Teléfono</dt><dd><a href="tel:+34677856645">677 856 645</a></dd>
  <dt>Correo</dt><dd><a href="mailto:albergueroma@gmail.com">albergueroma@gmail.com</a></dd>
</dl>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre el Albergue Roma, en Pola de Lena (Asturias), a 250 m del Camino del Salvador. Los precios y las condiciones pueden cambiar: los que valen son los que se confirman al reservar.</p>
<p>Por ahora, la reserva de esta web es una demostración: la ocupación es de ejemplo, los precios son los «desde» publicados en Gronze y no se envía, se guarda ni se cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotos del albergue son del titular o se usan con su permiso. Las fotos de Lena son de Mongolo1984 en Wikimedia Commons, con licencia CC BY-SA 4.0 (el enlace al original va con cada foto). El perfil de la bajada se ha hecho con datos de OpenStreetMap (ODbL) y el MDT05 del Instituto Geográfico Nacional (CC BY 4.0). Las letras Sora, Figtree y Yellowtail se usan con sus licencias libres.</p>
<p class="aviso">PENDIENTE: confirmar que las fotos del albergue (sacadas de su ficha en Booking) se pueden usar en esta web.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Google Maps, Wikimedia Commons, OpenStreetMap) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar, al llamarnos o al escribirnos: nombre, teléfono, correo, las fechas y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<p>La reserva de esta web es, por ahora, una demostración: lo que escribas en ella no sale de tu navegador ni se guarda.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal (el registro de viajeros) y siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a <a href="mailto:albergueroma@gmail.com">albergueroma@gmail.com</a> o llamando al <a href="tel:+34677856645">677 856 645</a>. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>albergueroma-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>albergueroma-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Sora, Figtree y Yellowtail) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>jsDelivr</b>: las librerías que suavizan el desplazamiento y mueven las animaciones (Lenis y GSAP) se descargan de jsDelivr, que recibe tu dirección IP. No instalan cookies.</li>
</ul>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. Los puntos de la cruz de la portada y la bajada que se mueve con el desplazamiento son un adorno: la misma información está en el texto.</p>
<h2>El albergue</h2>
<p>Según su ficha en Gronze, el albergue es accesible para personas con movilidad reducida.</p>
<p class="aviso">PENDIENTE: confirmar si hay ascensor (las fuentes no coinciden), qué habitación y qué baño son accesibles y cómo es la entrada.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al <a href="tel:+34677856645">677 856 645</a> o escribe a <a href="mailto:albergueroma@gmail.com">albergueroma@gmail.com</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Albergue Roma</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Sora:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
<meta name="theme-color" content="#16110D">
</head>`;

const MARCA = `<a class="marca" href="./" aria-label="Albergue Roma, Pola de Lena: a la portada"><!--svg:marca/logo.svg|clase=marca__logo|viewBox=0 5 298 45|quitar=logo-puente,logo-lugar--></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
<style>
  .no-hay { background: var(--noche); color: var(--cal); min-height: 100svh; display: grid; place-items: center; text-align: center; padding: 24px; --foco: var(--ocre-claro); --foco-hueco: var(--noche); }
  .no { display: grid; gap: 22px; justify-items: center; max-width: 32em; }
  .no svg { width: min(26vw, 96px); height: auto; }
  .no .cruz-petalos, .no .cruz-rombos { fill: var(--ocre-claro); }
  .no h1 { font: 800 clamp(2.4rem, 7vw, 3.8rem)/1 var(--f-tit); letter-spacing: -.04em; }
  .no p { color: var(--niebla); }
  .no a:not(.btn) { color: var(--cal); }
</style>
  <main class="no">
    <!--svg:marca/cruz.svg-->
    <h1>Este camino no lleva a Roma</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. El albergue sigue donde estaba: en la calle Canuto Hevia, en La Pola.</p>
    <a class="btn btn--ocre" href="./#reservar">Ver camas libres</a>
    <a href="./">Volver a la portada</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
