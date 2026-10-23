/* Albergue Roma · el simulador de camas (DEMOSTRACIÓN)
   No envía, guarda ni cobra nada, y lo dice. La ocupación es inventada pero siempre la misma
   para cada noche y cada cama. Parte del de Eco dos Teixos, rehecho para este albergue:
   - Un plano dibujado (orientativo, no es el plano): los dos dormitorios con sus literas cama a
     cama (arriba y abajo) y las seis habitaciones privadas por su nombre.
   - Camas sueltas (eliges cuántas pulsando en el plano) o una habitación privada entera.
   - Precios supuestos: los «desde» de Gronze (15 € la cama, 35 € la doble, 55 € la cuádruple),
     por noche. Peregrino de paso: sin mínimo de noches; por defecto, esta noche.
   Las habitaciones salen de js/datos-habitaciones.js (Roma.habitaciones): un solo sitio.
   API: Roma.motor.preparar({ habitacion: 'carabanzo' | 'fresneo' | … }) */
(() => {
  'use strict';
  const raiz = document.getElementById('motor');
  const Roma = (window.Roma = window.Roma || {});
  if (!raiz || !Roma.habitaciones) return;

  const HABS = Roma.habitaciones;
  const HAB = Object.fromEntries(HABS.map((x) => [x.id, x]));
  const DORMS = HABS.filter((x) => x.tipo === 'compartido');
  const PRIVS = HABS.filter((x) => x.tipo !== 'compartido');
  const CAMA = (Roma.precios && Roma.precios.cama) || 15;
  const MAX_NOCHES = 7;
  const MAX_CAMAS = 8;
  const DIA = 864e5;
  const TEL = '677 856 645';

  // las camas de los dormitorios: «pajares-3-a» = Pajares, litera 3, arriba
  const CAMAS = [];
  DORMS.forEach((d) => { for (let n = 1; n <= (d.literas || 5); n++) ['a', 'b'].forEach((p) => CAMAS.push({ id: `${d.id}-${n}-${p}`, dorm: d.id, n, arriba: p === 'a' })); });
  const CAMA_POR_ID = Object.fromEntries(CAMAS.map((c) => [c.id, c]));

  /* ---------- fechas como claves 'AAAA-MM-DD' en hora local ---------- */
  const clave = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const fecha = (k) => new Date(k + 'T00:00');
  const sumar = (k, n) => { const x = fecha(k); x.setDate(x.getDate() + n); return clave(x); };
  const noches = (a, b) => Math.round((fecha(b) - fecha(a)) / DIA);
  const HOY = clave(new Date());
  const fmtDia = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
  const eur = (n) => n.toLocaleString('es-ES') + ' €';
  const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  /* ---------- ocupación inventada: cada cama y cada habitación la suya, siempre la misma ---------- */
  const azar = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  // el Camino del Salvador: de abril a octubre, y agosto lleno; en invierno, casi vacío
  const NIVEL_MES = [0.12, 0.14, 0.24, 0.5, 0.6, 0.58, 0.72, 0.82, 0.68, 0.42, 0.16, 0.14];
  const nivel = (k) => {
    const x = fecha(k), dsem = x.getDay();
    let n = NIVEL_MES[x.getMonth()];
    if (dsem === 5 || dsem === 6) n += 0.1;
    return Math.min(0.95, n);
  };
  // las de abajo se llenan antes que las de arriba
  const camaLibre = (id, k) => k >= HOY && azar(k + '#' + id) > nivel(k) * (CAMA_POR_ID[id].arriba ? 0.82 : 1.1);
  const habLibre = (id, k) => k >= HOY && azar(k + '#' + id) > nivel(k) * 0.95;
  const enRango = (fn, ini, fin) => { for (let k = ini; k < fin; k = sumar(k, 1)) if (!fn(k)) return false; return true; };
  const camaLibreRango = (id, ini, fin) => enRango((k) => camaLibre(id, k), ini, fin);
  const habLibreRango = (id, ini, fin) => enRango((k) => habLibre(id, k), ini, fin);

  /* ---------- estado ---------- */
  const primeroMes = (k) => k.slice(0, 7) + '-01';
  const nuevo = () => ({ modo: 'camas', ini: HOY, fin: sumar(HOY, 1), camas: [], hab: null, foco: null, paso: 'elegir', mes: primeroMes(HOY), msg: '', error: false, datos: {}, loc: '' });
  const st = nuevo();
  const nMeses = () => (innerWidth >= 1280 ? 2 : 1);
  // las noches que mira el plano: las elegidas o, mientras eliges la salida, la de llegada
  const rango = () => (st.ini ? [st.ini, st.fin || sumar(st.ini, 1)] : null);

  const estado = (k) => {
    if (k < HOY) return 'pasado';
    if (st.modo === 'camas') {
      if (st.camas.length) return st.camas.every((c) => camaLibre(c, k)) ? 'libre' : 'completo';
      const n = CAMAS.filter((c) => camaLibre(c.id, k)).length;
      return n === 0 ? 'completo' : n <= 3 ? 'pocos' : 'libre';
    }
    if (st.hab) return habLibre(st.hab, k) ? 'libre' : 'completo';
    const n = PRIVS.filter((x) => habLibre(x.id, k)).length;
    return n === 0 ? 'completo' : n <= 1 ? 'pocos' : 'libre';
  };
  const nocheValida = (k) => estado(k) !== 'completo' && estado(k) !== 'pasado';
  const rangoValido = (a, b) => enRango(nocheValida, a, b);

  const total = () => {
    if (!st.ini || !st.fin) return 0;
    const n = noches(st.ini, st.fin);
    if (st.modo === 'camas') return st.camas.length * CAMA * n;
    return st.hab ? HAB[st.hab].desde * n : 0;
  };
  const listo = () => !!(st.ini && st.fin && (st.modo === 'camas' ? st.camas.length : st.hab));

  /* ---------- elegir fechas ---------- */
  const elegir = (k) => {
    st.msg = ''; st.error = false;
    if (!st.ini || st.fin || k <= st.ini) {
      if (!nocheValida(k)) return;
      st.ini = k; st.fin = null; st.msg = 'Ahora elige el día de salida.';
    } else if (noches(st.ini, k) > MAX_NOCHES) {
      st.msg = `Por la web, hasta ${MAX_NOCHES} noches. Para más, llama al ${TEL}.`; st.error = true;
    } else if (!rangoValido(st.ini, k)) {
      if (nocheValida(k)) { st.ini = k; st.fin = null; st.msg = 'Había una noche completa por medio: empezamos desde aquí. Elige la salida.'; }
      else { st.msg = 'Hay una noche completa por medio. Prueba otras fechas.'; st.error = true; }
    } else {
      st.fin = k;
    }
    limpiarOcupadas();
    pintar();
  };
  // si con las noches nuevas alguna cama o la habitación elegida ya no está libre, se suelta y se dice
  function limpiarOcupadas() {
    const r = rango(); if (!r) return;
    const antes = st.camas.length;
    st.camas = st.camas.filter((c) => camaLibreRango(c, r[0], r[1]));
    if (st.camas.length < antes) st.msg = (st.msg ? st.msg + ' ' : '') + 'Alguna cama que tenías ya no está libre esas noches: elige otra.';
    if (st.hab && !habLibreRango(st.hab, r[0], r[1])) { st.msg = (st.msg ? st.msg + ' ' : '') + `«${HAB[st.hab].nombre}» no está libre esas noches.`; st.hab = null; }
  }

  /* ---------- pintar ---------- */
  const h = (tag, attrs, ...hijos) => {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    hijos.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : String(c)); });
    return el;
  };

  const calendario = () => {
    const n = nMeses();
    const meses = [];
    for (let i = 0; i < n; i++) {
      const p = fecha(st.mes); p.setMonth(p.getMonth() + i);
      const k0 = clave(p), y = p.getFullYear(), m = p.getMonth();
      const desfase = (p.getDay() + 6) % 7, dias = new Date(y, m + 1, 0).getDate();
      const celdas = [];
      for (let j = 0; j < desfase; j++) celdas.push(h('span', { 'aria-hidden': 'true' }));
      for (let x = 1; x <= dias; x++) {
        const k = clave(new Date(y, m, x));
        const e = estado(k);
        const salidaPosible = st.ini && !st.fin && k > st.ini && noches(st.ini, k) <= MAX_NOCHES && rangoValido(st.ini, k);
        const usable = (e !== 'completo' && e !== 'pasado') || salidaPosible;
        let cls = 'dia';
        if (k === st.ini) cls += ' es-ini';
        else if (k === st.fin) cls += ' es-fin';
        else if (st.ini && st.fin && k > st.ini && k < st.fin) cls += ' es-dentro';
        if (k === HOY) cls += ' es-hoy';
        const txt = e === 'pasado' ? 'pasado' : e === 'completo' ? (salidaPosible ? 'completo, pero se puede salir ese día' : 'completo') : e === 'pocos' ? 'queda poco' : 'libre';
        celdas.push(h('button', {
          type: 'button', class: cls, 'data-k': k, 'data-estado': salidaPosible && e === 'completo' ? 'libre' : e,
          'aria-disabled': usable ? null : 'true',
          'aria-pressed': k === st.ini || k === st.fin ? 'true' : 'false',
          'aria-label': `${fmtLargo.format(fecha(k))}${k === HOY ? ' (hoy)' : ''}, ${txt}`,
          onclick: () => { if (usable) elegir(k); },
        }, x));
      }
      meses.push(h('div', { class: 'm-mes' },
        h('h4', { class: 'm-mes-tit' }, mayus(fmtMes.format(fecha(k0)))),
        h('div', { class: 'm-sem', 'aria-hidden': 'true' }, ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((s) => h('span', null, s))),
        h('div', { class: 'm-dias' }, celdas)));
    }
    const limite = primeroMes(clave(new Date(new Date().getFullYear(), new Date().getMonth() + 12 - n, 1)));
    const mover = (d) => { const p = fecha(st.mes); p.setMonth(p.getMonth() + d); st.mes = clave(p); pintar(); };
    const ant = h('button', { type: 'button', class: 'redondo', 'aria-label': 'Mes anterior', onclick: () => mover(-1) }, '‹');
    const sig = h('button', { type: 'button', class: 'redondo', 'aria-label': 'Mes siguiente', onclick: () => mover(1) }, '›');
    ant.disabled = st.mes <= primeroMes(HOY);
    sig.disabled = st.mes >= limite;
    return h('div', { class: 'm-cal' },
      h('div', { class: 'm-cal-nav' }, h('h3', { class: 'm-et' }, '1 · Tus noches'), ant, sig),
      h('div', { class: 'm-meses', style: `--n-meses:${n}` }, meses),
      h('div', { class: 'm-leyenda' },
        h('span', null, h('i'), 'Hay sitio'),
        h('span', null, h('i', { class: 'l-pocos' }), 'Queda poco'),
        h('span', null, h('i', { class: 'l-completo' }), 'Completo'),
        h('span', null, h('i', { class: 'l-tuya' }), 'Tus noches')));
  };

  const conmutarCama = (id) => {
    st.msg = ''; st.error = false;
    if (st.camas.includes(id)) st.camas = st.camas.filter((c) => c !== id);
    else if (st.camas.length >= MAX_CAMAS) { st.msg = `Por la web, hasta ${MAX_CAMAS} camas. Para un grupo, llama al ${TEL}.`; st.error = true; }
    else st.camas = [...st.camas, id];
    pintar();
    raiz.querySelector(`[data-cama="${id}"]`)?.focus();
  };
  const elegirHab = (id) => {
    st.msg = ''; st.error = false;
    st.hab = st.hab === id ? null : id;
    pintar();
    raiz.querySelector(`[data-hab="${id}"]`)?.focus();
  };

  // el plano: orientativo (no es el plano del albergue). Arriba los dos dormitorios, el pasillo y abajo las seis privadas
  const plano = () => {
    const r = rango();
    const dormitorio = (d) => {
      const literas = [];
      for (let n = 1; n <= (d.literas || 5); n++) {
        literas.push(h('div', { class: 'litera' }, ['a', 'b'].map((p) => {
          const id = `${d.id}-${n}-${p}`, sel = st.camas.includes(id);
          const libre = r ? camaLibreRango(id, r[0], r[1]) : true;
          return h('button', {
            type: 'button', class: 'cama', 'data-cama': id, 'data-libre': libre ? 'si' : 'no',
            'aria-pressed': String(sel), disabled: !libre && !sel,
            'aria-label': `${d.nombre}, litera ${n}, cama de ${p === 'a' ? 'arriba' : 'abajo'}: ${sel ? 'elegida' : libre ? 'libre' : 'ocupada esas noches'}`,
            onclick: () => conmutarCama(id),
          }, p === 'a' ? 'arriba' : 'abajo');
        })));
      }
      return h('div', { class: 'cuarto cuarto--dorm' + (st.foco === d.id ? ' es-foco' : ''), 'data-dorm': d.id, role: 'group', 'aria-label': `Dormitorio ${d.nombre}: ${d.literas} literas` },
        h('span', { class: 'cuarto__nombre', 'aria-hidden': 'true' }, d.nombre),
        h('div', { class: 'literas' }, literas));
    };
    const privada = (x) => {
      const libre = r ? habLibreRango(x.id, r[0], r[1]) : true, sel = st.hab === x.id;
      return h('button', {
        type: 'button', class: 'cuarto cuarto--priv' + (st.foco === x.id ? ' es-foco' : ''), 'data-hab': x.id, 'data-libre': libre ? 'si' : 'no',
        'aria-pressed': String(sel), disabled: !libre && !sel,
        'aria-label': `${x.nombre}, ${x.tipoTexto.toLowerCase()}, ${x.desde} € la noche: ${sel ? 'elegida' : libre ? 'libre' : 'ocupada esas noches'}`,
        onclick: () => elegirHab(x.id),
      },
      h('span', { class: 'cuarto__nombre', 'aria-hidden': 'true' }, x.nombre),
      h('span', { class: 'cuarto__tipo', 'aria-hidden': 'true' }, x.tipo === 'doble' ? 'doble · 2 camas' : 'cuádruple · 2 literas'),
      h('span', { class: 'cuarto__precio', 'aria-hidden': 'true' }, libre ? `${x.desde} €` : 'ocupada'));
    };
    return h('div', { class: 'plano ' + (st.modo === 'camas' ? 'modo-camas' : 'modo-priv') },
      h('div', { class: 'plano__fila plano__fila--dorm' }, DORMS.map(dormitorio)),
      h('div', { class: 'plano__pasillo', 'aria-hidden': 'true' }, 'pasillo'),
      h('div', { class: 'plano__fila plano__fila--priv' }, PRIVS.map(privada)));
  };

  const textoElegido = () => {
    if (st.modo === 'camas') {
      if (!st.camas.length) return '—';
      const por = {};
      st.camas.forEach((c) => { const x = CAMA_POR_ID[c]; (por[x.dorm] = por[x.dorm] || []).push(x); });
      return Object.entries(por).map(([d, cs]) => `${HAB[d].nombre}: ${cs.map((x) => `litera ${x.n} ${x.arriba ? 'arriba' : 'abajo'}`).join(', ')}`).join(' · ');
    }
    return st.hab ? `${HAB[st.hab].nombre} (${HAB[st.hab].tipo === 'doble' ? 'doble' : 'cuádruple'})` : '—';
  };

  const resumen = () => {
    const n = st.ini && st.fin ? noches(st.ini, st.fin) : 0;
    const t = total();
    return h('div', { class: 'm-res' },
      h('dl', { class: 'm-fechas' },
        h('div', null, h('dt', null, 'Llegada'), h('dd', { id: 'm-llega' }, st.ini ? fmtDia.format(fecha(st.ini)) + (st.ini === HOY ? ' (hoy)' : '') : 'elige un día')),
        h('div', null, h('dt', null, 'Salida'), h('dd', { id: 'm-sale' }, st.fin ? fmtDia.format(fecha(st.fin)) : '—')),
        h('div', null, h('dt', null, 'Noches'), h('dd', { id: 'm-noches' }, n || '—'))),
      h('h3', { class: 'm-et' }, st.modo === 'camas' ? '2 · Tus camas, en el plano' : '2 · Tu habitación, en el plano'),
      h('p', { class: 'plano__nota' }, st.modo === 'camas'
        ? `Pulsa las camas que quieras: una por persona, arriba o abajo. En azul, las libres esas noches; en gris, las ocupadas. Dibujo orientativo: no es el plano del albergue.`
        : 'Pulsa la habitación que quieras: en azul, las libres esas noches. Dibujo orientativo: no es el plano del albergue.'),
      plano(),
      h('dl', { class: 'm-total' },
        h('dt', null, st.modo === 'camas' ? 'Camas' : 'Habitación'), h('dd', { id: 'm-elegido' }, textoElegido()),
        h('dt', null, 'Precio'), h('dd', null, st.modo === 'camas' ? `${CAMA} € por cama y noche` : st.hab ? `${HAB[st.hab].desde} € por noche` : '—'),
        h('dt', null, 'Total'), h('dd', { class: 'm-suma', id: 'm-total' }, t ? eur(t) : '—', t ? h('small', null, 'pago a la llegada (supuesto) · ropa de cama incluida') : null)),
      h('div', { class: 'm-acciones' },
        h('button', { type: 'button', class: 'btn btn--castano', id: 'm-seguir', disabled: !listo(), onclick: seguir }, 'Seguir'),
        h('span', { class: 'plano__nota' }, 'No se envía ni se cobra nada: es una demostración.')),
      h('p', { class: 'm-msg' + (st.error ? ' es-error' : ''), id: 'm-msg', 'aria-live': 'polite' }, st.msg));
  };

  const alMotor = () => { if (raiz.getBoundingClientRect().top < 0) (Roma.web && Roma.web.irA ? Roma.web.irA(raiz) : raiz.scrollIntoView({ block: 'start' })); };
  const seguir = () => {
    if (!listo()) return;
    st.paso = 'datos'; st.msg = ''; st.error = false; pintar();
    alMotor();
    document.getElementById('m-nombre')?.focus({ preventScroll: true });
  };

  const HORAS = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  const formulario = () => {
    const v = st.datos;
    const campo = (id, et, attrs) => h('div', { class: 'm-campo' }, h('label', { for: id }, et), h('input', Object.assign({ id, name: id, value: v[id] || '' }, attrs)));
    const horas = h('select', { id: 'm-hora', name: 'm-hora' }, h('option', { value: '' }, 'Elige una hora'), HORAS.map((x) => h('option', { value: x, selected: v['m-hora'] === x }, x)));
    const area = h('textarea', { id: 'm-notas', name: 'm-notas', rows: '3' }); area.value = v['m-notas'] || '';
    const n = noches(st.ini, st.fin);
    return h('form', { class: 'm-datos', novalidate: true, onsubmit: confirmar },
      h('p', { class: 'ancho' }, h('b', null, `${fmtDia.format(fecha(st.ini))} → ${fmtDia.format(fecha(st.fin))} · ${plural(n, 'noche', 'noches')}`), h('br'),
        `${textoElegido()} · ${eur(total())}`),
      campo('m-nombre', 'Nombre y apellidos', { type: 'text', autocomplete: 'name', required: true }),
      campo('m-correo', 'Correo', { type: 'email', autocomplete: 'email', required: true }),
      campo('m-tel', 'Móvil', { type: 'tel', autocomplete: 'tel', required: true }),
      h('div', { class: 'm-campo' }, h('label', { for: 'm-hora' }, 'Hora de llegada (registro de 13:00 a 21:00)'), horas),
      h('div', { class: 'm-campo ancho' }, h('label', { for: 'm-notas' }, 'Algo que debamos saber (opcional: si vienes en bici, si llegas tarde…)'), area),
      h('label', { class: 'm-acepto' }, h('input', { type: 'checkbox', id: 'm-peregrino', checked: !!v['m-peregrino'] }), h('span', null, 'Hago el Camino (con credencial)')),
      h('label', { class: 'm-acepto' }, h('input', { type: 'checkbox', id: 'm-ok', checked: !!v['m-ok'] }), h('span', null, 'He leído la ', h('a', { href: 'privacidad.html', class: 'enlace' }, 'política de privacidad'), '.')),
      h('p', { class: 'm-msg es-error ancho', id: 'm-error', 'aria-live': 'assertive' }, st.msg),
      h('div', { class: 'm-acciones ancho' },
        h('button', { type: 'submit', class: 'btn btn--castano' }, 'Confirmar la reserva'),
        h('button', { type: 'button', class: 'btn-sec', onclick: () => { guardar(); st.paso = 'elegir'; st.msg = ''; pintar(); } }, 'Volver al plano')),
      h('p', { class: 'demo-aviso ancho' }, h('b', null, 'Demostración: '), 'al confirmar no se envía, guarda ni cobra nada. En la web real, el albergue confirmaría la reserva.'));
  };
  const guardar = () => {
    ['m-nombre', 'm-correo', 'm-tel', 'm-hora', 'm-notas'].forEach((id) => { const el = document.getElementById(id); if (el) st.datos[id] = el.value; });
    ['m-ok', 'm-peregrino'].forEach((id) => { const el = document.getElementById(id); if (el) st.datos[id] = el.checked; });
  };

  function confirmar(e) {
    e.preventDefault();
    guardar();
    const v = st.datos, faltan = [];
    if (!v['m-nombre'] || v['m-nombre'].trim().length < 2) faltan.push(['m-nombre', 'el nombre']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v['m-correo'] || '')) faltan.push(['m-correo', 'un correo válido']);
    if ((v['m-tel'] || '').replace(/\D/g, '').length < 9) faltan.push(['m-tel', 'un móvil']);
    if (!v['m-hora']) faltan.push(['m-hora', 'la hora de llegada']);
    if (!v['m-ok']) faltan.push(['m-ok', 'aceptar la privacidad']);
    raiz.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    if (faltan.length) {
      const txt = faltan.map((f) => f[1]);
      document.getElementById('m-error').textContent = 'Falta ' + (txt.length > 1 ? txt.slice(0, -1).join(', ') + ' y ' + txt[txt.length - 1] : txt[0]) + '.';
      faltan.forEach(([id]) => document.getElementById(id).setAttribute('aria-invalid', 'true'));
      document.getElementById(faltan[0][0]).focus();
      return;
    }
    const num = String(Math.floor(azar(v['m-nombre'] + st.ini + st.fin + Date.now()) * 900) + 100);
    st.loc = `ROM-${st.ini.slice(2).replace(/-/g, '')}-${num}`;
    st.paso = 'hecho'; pintar();
    alMotor();
    raiz.querySelector('.m-hecho h3')?.focus({ preventScroll: true });
  }

  const hecho = () => {
    const n = noches(st.ini, st.fin);
    return h('div', { class: 'm-hecho' },
      h('h3', { tabindex: '-1' }, 'Reserva anotada'),
      h('p', { class: 'm-loc', id: 'm-loc' }, st.loc),
      h('p', null, `${mayus(fmtLargo.format(fecha(st.ini)))} → ${fmtLargo.format(fecha(st.fin))} · ${plural(n, 'noche', 'noches')}`),
      h('p', null, `${textoElegido()} · ${eur(total())}, a pagar al llegar (supuesto).`),
      h('p', null, `Llegada hacia las ${st.datos['m-hora']}. El registro es de 13:00 a 21:00 y no hay hora de cierre: te dan un código para entrar y salir.`),
      h('p', { class: 'demo-aviso' }, h('b', null, 'Es una demostración: '), 'no se ha enviado, guardado ni cobrado nada. Para reservar de verdad, llama al ', h('a', { href: 'tel:+34677856645' }, TEL), ' o escribe a ', h('a', { href: 'mailto:albergueroma@gmail.com' }, 'albergueroma@gmail.com'), '.'),
      h('button', { type: 'button', class: 'btn-sec', onclick: () => { Object.assign(st, nuevo(), { modo: st.modo }); pintar(); } }, 'Hacer otra prueba'));
  };

  function pintar() {
    const activo = document.activeElement && raiz.contains(document.activeElement) ? document.activeElement : null;
    const foco = activo ? (activo.dataset.k ? `[data-k="${activo.dataset.k}"]` : activo.id ? '#' + activo.id : null) : null;
    raiz.textContent = '';
    const modo = h('div', { class: 'm-modo', role: 'group', 'aria-label': 'Qué reservas' },
      h('button', { type: 'button', id: 'm-modo-camas', 'aria-pressed': String(st.modo === 'camas'), onclick: () => cambiarModo('camas') }, 'Camas sueltas'),
      h('button', { type: 'button', id: 'm-modo-priv', 'aria-pressed': String(st.modo === 'priv'), onclick: () => cambiarModo('priv') }, 'Habitación privada'));
    const pasos = h('ol', { class: 'm-pasos', 'aria-label': 'Pasos' },
      [['elegir', 'Noches y cama'], ['datos', 'Tus datos'], ['hecho', 'Listo']].map(([k, t], i) => h('li', { 'aria-current': st.paso === k ? 'step' : null }, h('b', null, i + 1), h('span', null, t))));
    raiz.append(h('div', { class: 'm-cab' }, st.paso === 'elegir' ? modo : h('span'), pasos));
    if (st.paso === 'elegir') raiz.append(h('div', { class: 'm-cuerpo' }, calendario(), resumen()));
    else if (st.paso === 'datos') raiz.append(formulario());
    else raiz.append(hecho());
    if (foco) raiz.querySelector(foco)?.focus({ preventScroll: true });
  }

  const cambiarModo = (m) => {
    if (st.modo === m) return;
    st.modo = m; st.camas = []; st.hab = null; st.foco = null; st.error = false;
    st.msg = m === 'priv' ? 'Una habitación entera para ti o tu grupo: doble con dos camas o cuádruple con dos literas.' : '';
    if (st.ini && !st.fin) st.fin = sumar(st.ini, 1);
    if (st.ini && st.fin && !rangoValido(st.ini, st.fin)) { st.ini = st.fin = null; st.msg = 'Esas noches está completo: elige otras.'; }
    pintar();
  };

  /* ---------- API: «Ver si hay sitio» desde las puertas ---------- */
  const preparar = (o = {}) => {
    const x = o.habitacion && HAB[o.habitacion];
    if (!x) return;
    st.paso = 'elegir'; st.error = false; st.camas = []; st.hab = null; st.foco = x.id;
    if (x.tipo === 'compartido') {
      // el dormitorio: la primera noche desde hoy con alguna cama libre en él
      st.modo = 'camas';
      let k = HOY;
      for (let i = 0; i < 120 && !CAMAS.some((c) => c.dorm === x.id && camaLibre(c.id, k)); i++) k = sumar(k, 1);
      st.ini = k; st.fin = sumar(k, 1);
      st.msg = `Dormitorio «${x.nombre}»: ${k === HOY ? 'esta noche' : 'el ' + fmtDia.format(fecha(k))}. Pulsa en el plano la cama que quieras.`;
    } else {
      st.modo = 'priv';
      let k = HOY;
      for (let i = 0; i < 120 && !habLibre(x.id, k); i++) k = sumar(k, 1);
      st.ini = k; st.fin = sumar(k, 1); st.hab = x.id;
      st.msg = `«${x.nombre}»: ${k === HOY ? 'libre esta noche' : 'la primera noche libre es el ' + fmtDia.format(fecha(k))}. Cambia las noches si quieres.`;
    }
    st.mes = primeroMes(st.ini);
    pintar();
  };

  // al cambiar de ancho de verdad (nunca por la barra del móvil), uno o dos meses
  let meses = nMeses();
  window.addEventListener('roma:resize', () => { if (nMeses() !== meses) { meses = nMeses(); if (st.paso === 'elegir') pintar(); } });
  Roma.motor = { preparar };
  window.__motor = { st, CAMAS, PRIVS, DORMS, camaLibre, habLibre, camaLibreRango, habLibreRango, estado, elegir, cambiarModo, preparar, total, sumar, HOY, conmutarCama, elegirHab };
  // si esta noche no queda nada, la propuesta de inicio es la primera noche con sitio
  if (!rangoValido(st.ini, st.fin)) { let k = HOY; for (let i = 0; i < 60 && !nocheValida(k); i++) k = sumar(k, 1); st.ini = k; st.fin = sumar(k, 1); st.mes = primeroMes(k); }
  pintar();
})();
