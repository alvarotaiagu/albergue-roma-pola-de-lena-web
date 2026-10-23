# Albergue Roma · Pola de Lena · «Todos los caminos llevan a Roma»

Propuesta de web para un albergue real del Camino del Salvador que **no la ha encargado** (su web está suspendida). En local, **sin publicar y sin commits**. Solo castellano. Encargo completo en `ENCARGO.md`; datos con fuente en `ref/DATOS-ALBERGUE-ROMA.md`; dudas en `PENDIENTES.md`.

## El concepto

Todo sale de **su logo**: la cruz de cuatro rombos con sus cinco puntos, la línea que **baja** con cinco arcos colgando y los carteles de madera con nombre de pueblo de Lena.

| Pieza | Qué es | Dónde |
|---|---|---|
| Cortina «la celosía» | los cinco puntos, la cruz que se dibuja, la celosía a contraluz que se abre | `partes/cortina.html`, `css/cortina.css`, `js/cortina.js` |
| Portada | miles de puntos llegan por caminos desde los bordes y forman la cruz (WebGL); arrastrar la deshace | `js/cruz.js`, `css/cruz.css`; respaldo: la cruz en SVG |
| El hilo | la línea ocre baja por la página en zetas y en cada sección cuelga un arco del logo; en la cabecera, los cinco arcos de lectura | `js/main.js` (7 y 8) |
| Habitaciones | un pasillo de puertas con su cartel; el nombre se escribe a pluma, la puerta se abre y sale la ficha con su minimapa | `js/puertas.js`, `css/puertas.css` |
| La bajada (2D) | la sección se fija: fotos de cada tramo, altímetro y km, y el perfil real con la línea ocre y los cinco arcos | `js/bajada.js`, datos en `img/terreno/bajada.json` |
| Reservar | simulador de camas con plano orientativo: litera a litera o una privada entera | `js/reserva.js` |
| Pie | los cinco arcos llegan y forman el puente del logo entero | `js/main.js` (8) |

**Sin 3D** (decisión de Álvaro, 2026-10-23): la bajada de Pajares iba a ser un vuelo 3D y se ha quedado en 2D. `scripts/terreno.py` ya no baja ortofoto ni hace mallas; solo saca el perfil.

## Cómo se trabaja

- Se edita **siempre** `index.src.html`, las `partes/` o `scripts/legales.mjs`; luego `node construir.mjs` (partes, SVG en línea, JSON de la bajada, `<picture>` y `?v=` con `versionar.mjs`).
- Fotos: `node scripts/fotos.mjs` (lista en `scripts/fotos-lista.json`). Marca: `node scripts/marca.mjs` (favicons y `img/og.jpg`). Legales y 404: `node scripts/legales.mjs`.
- La bajada: `python -I scripts/terreno.py` → `img/terreno/bajada.json` y `perfil.svg`. Las cifras de la web salen **solo** de ahí: 28,3 km del Puerto de Pajares a la puerta, de 1.377 m a 316 m (1.061 m más abajo). El nodo de Pajares queda a 1 km del trazado de OSM, así que el segundo arco es San Miguel del Río. La Frecha no se pinta (su nodo cae lejos del camino).
- Comprobación: `node verificar.mjs` (puerto 8861; **74 de 74** el 2026-10-23) y `node scripts/rendimiento.mjs` (8862; LCP en móvil 1,4–1,6 s, el titular). Módulos: `pruebas/cruz-probar.mjs` (8863, 45/45) y `pruebas/puertas-probar.mjs` (8864, 50/50). Ninguna pinta WebGL ni hace capturas.

## Mando de maqueta (solo con `?revision`) y receta de borrado

`?revision` enseña abajo a la izquierda el mando **Caminos / Sobria**. La sobria deja la cruz en SVG, las puertas en rejilla y la bajada quieta, y **añade** «El albergue, de un vistazo». Para entregar, se borran tres bloques:

1. `partes/cabeza.html`: el `try` que empieza en `// MANDO DE MAQUETA`.
2. `partes/pie.html`: de `<!-- MANDO DE MAQUETA` a `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: el bloque `13. MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.

`node scripts/probar-borrado-mando.mjs` comprueba la receta: sin restos y el JS se lee.

## Contrato web ↔ módulos

- `Roma.<cruz|puertas|bajada>.montar(el, { movimiento, densidad: 'caminos'|'sobria' })` → `{ destruir() }`. El HTML de `el` es el respaldo y se queda si el JS falla.
- La cortina expone `Roma.cortina.{alAbrirse, alRetirarse, retirar}`. La cruz se monta al **empezar** a abrirse; Lenis arranca al retirarse.
- `Roma.reservar({ habitacion })` baja al simulador y deja elegida esa habitación (o marca el dormitorio).
- Las habitaciones viven en un solo sitio: `js/datos-habitaciones.js`. Solo «Carabanzo» es real; el resto, de ejemplo (lo dice la web). Las fotos de los cuartos se repiten porque hay pocas.

## Qué mirar en Chrome

Ábrela con un servidor local (por ejemplo `npx serve`) o con el `verificar.mjs` parado, en `http://localhost:…/index.html`.

1. **Cortina** (~3 s): la celosía a contraluz, la apertura desde el centro y la cruz que vuela a su sitio sin salto.
2. **Portada**: los puntos que llegan por caminos y la respiración de la cruz. Que se aparten del ratón, que arrastrar sobre la cruz deje estela y vuelvan, y que con el scroll se deshaga y caiga por la línea.
3. **El hilo**: que cada tramo baje sin pisar texto y que el arco cuelgue bien de la línea (izquierda y derecha alternan, como unas zetas).
4. **Habitaciones**: el pasillo (pausa en cada puerta), el nombre escribiéndose y la puerta que gira. En el móvil, que se abran al pasar.
5. **La bajada**: el fundido de las fotos por tramo, el altímetro y la línea ocre avanzando, los cinco arcos al pasar y el remate.
6. **Reservar**: el plano (¿se entiende sin explicación?) y el paso de camas sueltas a habitación privada.
7. **Pie**: los cinco arcos llegando y el puente entero al final.
8. **`?revision`**: la sobria.

En móvil lento la cortina tarda unos 5 s en irse (con la CPU ×4 de la prueba) y hay tareas largas de ~100 ms mientras dura; si en un móvil real se nota, conviene acortarla.
