/* Albergue Roma · las habitaciones, en UN solo sitio.
   Lo leen el módulo Puertas (js/puertas.js) y el simulador (js/reserva.js).

   OJO: solo «Carabanzo» es un nombre real (el cartel de la foto bk-470115509).
   Los demás nombres, el reparto de las 6 privadas (2 dobles + 4 cuádruples) y
   las 5 literas por dormitorio son SUPUESTOS, a confirmar con el dueño
   (PENDIENTES.md). Precios: los «desde» de Gronze (15 € cama, 35 € doble,
   55 € cuádruple).

   Coordenadas: nodos «place» de OpenStreetMap (Overpass / Nominatim,
   consultados el 2026-10-23). Carabanzo no está en la etapa 4: es un pueblo de
   Lena al nordeste de La Pola. Llanos de Somerón = «Chanos» en OSM (parroquia
   de Somerón). Fresneo = el de Las Puentes, junto a Puente de los Fierros (hay
   otro Fresneo cerca de Villallana que no es el del camino).
*/
(function () {
  'use strict';
  var Roma = (window.Roma = window.Roma || {});

  Roma.albergue = {
    nombre: 'Albergue Roma',
    direccion: 'C/ Canuto Hevia, 12 · 33630 La Pola (Lena), Asturias',
    telefono: '+34 677 856 645',
    telefonoVisible: '677 856 645',
    correo: 'albergueroma@gmail.com',
    // calle Canuto Hevia (OSM 95742197); el portal 12 no está en OSM
    coords: { lat: 43.15677, lon: -5.83017 },
    estacion: { lat: 43.15865, lon: -5.83113 },
    registro: { desde: '13:00', hasta: '21:00', porConfirmar: true },
    sinHoraDeCierre: true
  };

  /* tipo: 'compartido' (cama a cama) | 'cuadruple' | 'doble' (habitación entera)
     unidad: lo que se paga a «desde»: 'cama' o 'habitacion'
     orden: orden por el camino, de Pajares a La Pola (Carabanzo, aparte)
     fotos: nombres de img/fotos/<nombre>-<ancho>.(avif|webp|jpg); hay pocas,
            así que se repiten (el README lo dice) */
  Roma.habitaciones = [
    {
      id: 'pajares', nombre: 'Pajares', real: false,
      tipo: 'compartido', tipoTexto: 'Dormitorio compartido, con literas',
      plazas: 10, literas: 5, desde: 15, unidad: 'cama',
      tiene: ['literas de hierro', 'taquilla individual con llave', 'ropa de cama'],
      fotos: ['dormitorio-grande', 'litera'],
      lugar: { lat: 43.0179491, lon: -5.7726416, nota: 'inicio de la etapa 4' }
    },
    {
      id: 'carabanzo', nombre: 'Carabanzo', real: true,
      tipo: 'compartido', tipoTexto: 'Dormitorio compartido, con literas',
      plazas: 10, literas: 5, desde: 15, unidad: 'cama',
      tiene: ['literas de hierro', 'taquilla individual con llave', 'ropa de cama'],
      fotos: ['dormitorio-taquillas', 'cartel-carabanzo', 'dormitorio-focos'],
      lugar: { lat: 43.1854312, lon: -5.7860441, nota: 'pueblo de Lena, al nordeste de La Pola' }
    },
    {
      id: 'santa-marina', nombre: 'Santa Marina', real: false,
      tipo: 'cuadruple', tipoTexto: 'Habitación cuádruple, dos literas',
      plazas: 4, literas: 2, desde: 55, unidad: 'habitacion',
      tiene: ['dos literas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['dormitorio-focos'],
      lugar: { lat: 43.0247126, lon: -5.7887816 }
    },
    {
      id: 'someron', nombre: 'Llanos de Somerón', real: false,
      tipo: 'cuadruple', tipoTexto: 'Habitación cuádruple, dos literas',
      plazas: 4, literas: 2, desde: 55, unidad: 'habitacion',
      tiene: ['dos literas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['litera'],
      lugar: { lat: 43.0415578, lon: -5.7895886, nota: '«Chanos» en OSM' }
    },
    {
      id: 'herias', nombre: 'Herías', real: false,
      tipo: 'cuadruple', tipoTexto: 'Habitación cuádruple, dos literas',
      plazas: 4, literas: 2, desde: 55, unidad: 'habitacion',
      tiene: ['dos literas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['dormitorio-grande'],
      lugar: { lat: 43.0959303, lon: -5.8075392 }
    },
    {
      id: 'campomanes', nombre: 'Campomanes', real: false,
      tipo: 'cuadruple', tipoTexto: 'Habitación cuádruple, dos literas',
      plazas: 4, literas: 2, desde: 55, unidad: 'habitacion',
      tiene: ['dos literas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['dormitorio-taquillas'],
      lugar: { lat: 43.1054181, lon: -5.8185558 }
    },
    {
      id: 'fresneo', nombre: 'Fresneo', real: false,
      tipo: 'doble', tipoTexto: 'Habitación doble, dos camas',
      plazas: 2, camas: 2, desde: 35, unidad: 'habitacion',
      tiene: ['dos camas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['habitacion-dos-camas'],
      lugar: { lat: 43.0754311, lon: -5.7701175, nota: 'el de Las Puentes, junto a Puente de los Fierros' }
    },
    {
      id: 'vega-ciego', nombre: 'Vega del Ciego', real: false,
      tipo: 'doble', tipoTexto: 'Habitación doble, dos camas',
      plazas: 2, camas: 2, desde: 35, unidad: 'habitacion',
      tiene: ['dos camas', 'taquillas con llave', 'ropa de cama'],
      fotos: ['habitacion-dos-camas'],
      lugar: { lat: 43.1394497, lon: -5.8243203 }
    }
  ];

  /* Pueblos de la etapa 4 por orden (Gronze), con su nodo de OSM, para mapas
     y perfiles. km: solo los que da Gronze; el resto, null (que no se invente). */
  Roma.etapa = {
    nombre: 'Etapa 4 del Camino del Salvador: Pajares → Pola de Lena',
    km: 23.8, sube: 595, baja: 1273, fuente: 'Gronze',
    pueblos: [
      { nombre: 'Puerto de Pajares', lat: 42.9926727, lon: -5.7594953, nota: 'fin de la etapa 3' },
      { nombre: 'Pajares', lat: 43.0179491, lon: -5.7726416 },
      { nombre: 'San Miguel del Río', lat: 43.0158811, lon: -5.7850966 },
      { nombre: 'Santa Marina', lat: 43.0247126, lon: -5.7887816 },
      { nombre: 'Llanos de Somerón', lat: 43.0415578, lon: -5.7895886 },
      { nombre: 'Puente de los Fierros', lat: 43.0707461, lon: -5.7692827 },
      { nombre: 'Fresneo', lat: 43.0754311, lon: -5.7701175 },
      { nombre: 'Herías', lat: 43.0959303, lon: -5.8075392 },
      { nombre: 'La Frecha', lat: 43.0948262, lon: -5.7995281 },
      { nombre: 'Campomanes', lat: 43.1054181, lon: -5.8185558, kmHastaPola: 7.1 },
      { nombre: 'Santa Cristina de Lena', lat: 43.1273212, lon: -5.8143486, nota: 'iglesia prerrománica' },
      { nombre: 'Palacio', lat: 43.1279523, lon: -5.8034604 },
      { nombre: 'Vega del Ciego', lat: 43.1394497, lon: -5.8243203 },
      { nombre: 'Pola de Lena', lat: 43.15677, lon: -5.83017, nota: 'Albergue Roma' }
    ]
  };

  /* Precios supuestos del simulador (los «desde» de Gronze) */
  Roma.precios = { cama: 15, doble: 35, cuadruple: 55, supuesto: true };

  Roma.habitacion = function (id) {
    for (var i = 0; i < Roma.habitaciones.length; i++) {
      if (Roma.habitaciones[i].id === id) return Roma.habitaciones[i];
    }
    return null;
  };
})();
