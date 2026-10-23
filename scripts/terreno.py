# «La bajada · De la nieve del puerto a tu litera» (sección #bajada): datos del perfil 2D (sin 3D: decisión de Álvaro, 2026-10-23).
#
# Fuentes (se descargan una vez a ref/terreno/, que NO se publica; User-Agent genérico del proyecto y pausas):
#   - El camino: OpenStreetMap, relación 2661682 «Camino del Salvador» (León → Oviedo), solo sus vías dentro de la caja.
#     Se encadena en un grafo y se toma el camino más corto desde el punto más cercano al Puerto de Pajares (nodo
#     34856291, collado, 1.379 m en OSM) hasta Pola de Lena. Datos © colaboradores de OpenStreetMap (ODbL).
#   - Del camino a la puerta: las calles de OSM alrededor del albergue y Dijkstra (la puerta = el punto de la calle
#     Canuto Hevia que da Nominatim, 43,15677 −5,83017: el portal 12 no está en OSM).
#   - Los pueblos y la Peña Ubiña: nodos de OSM por su id (nombre en castellano, como lo escribe Gronze).
#   - Relieve: MDT05 del IGN por WCS (Elevacion4258_5, metros enteros), en 2 × 2 hojas cosidas.
#     © Instituto Geográfico Nacional, CC BY 4.0.
#
# Las cifras (km, altitudes, desnivel) salen de aquí y SOLO de aquí: img/terreno/bajada.json.
#   - Distancia: la línea de OSM medida en planta (como las guías), punto a punto.
#   - Altitudes: MDT05 con interpolación bilineal cada 5 m de camino, suavizado de 15 m (quita el escalón de metro).
#   - Desnivel acumulado: umbral de 2 m (un repecho de menos de 2 m no cuenta).
#   Ojo: los 1.273 m de Gronze son el desnivel negativo de la etapa 4, que empieza en Pajares; aquí se baja desde el
#   puerto, así que no se mezclan: la web dice «del puerto a tu litera» con lo medido aquí.
#
# Salida en img/terreno/:
#   bajada.json               el contrato con la web: km, metros más abajo, paradas con km y altitud, perfil cada 100 m
#   perfil.svg                el perfil de la bajada (respaldo de la web: altitud por km con las cinco paradas)
#
# Uso (desde la carpeta de la web): python -I scripts/terreno.py            (solo-bajar: solo las descargas)
import heapq, json, math, pathlib, sys, time, urllib.error, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None
sys.stdout.reconfigure(encoding='utf-8')

R = pathlib.Path(__file__).resolve().parent.parent
FUENTE = R / 'ref' / 'terreno'
OUT = R / 'img' / 'terreno'
FUENTE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'AlbergueRomaWeb/1.0 (relieve y camino para la web del albergue)'}

REL = 2661682                                   # «Camino del Salvador» (OSM), León → Oviedo
PUERTA = (43.15677, -5.83017)                   # C/ Canuto Hevia (DATOS: Nominatim; el 12 no está en OSM)
S, N, O, E = 42.972, 43.176, -5.990, -5.715     # del puerto a Pola, con la Peña Ubiña al oeste (≈22,4 × 22,6 km)
lat0 = (S + N) / 2
KX, KZ = 111320 * math.cos(math.radians(lat0)), 110950
ancho, alto = (E - O) * KX, (N - S) * KZ

# ---------- 0. Descargas (una vez; pausa entre peticiones) ----------
def baja(url, f, minimo=20000, datos=None):
    p = FUENTE / f
    if p.exists() and p.stat().st_size > minimo: return p
    print('pido', f, flush=True)
    for intento in range(4):
        try:
            d = urllib.request.urlopen(urllib.request.Request(url, headers=UA, data=datos), timeout=300).read(); break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            codigo = getattr(e, 'code', 0)
            if (codigo and codigo < 500 and codigo != 429) or intento == 3: raise
            print('  ', codigo or e, 'otra vez en', 15 * (intento + 1), 's'); time.sleep(15 * (intento + 1))
    if len(d) < minimo: raise SystemExit(f'{f}: respuesta demasiado pequeña ({len(d)} B): {d[:300]!r}')
    p.write_bytes(d); print('  ', f, len(d) // 1024, 'KB'); time.sleep(2)
    return p

ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://overpass.osm.ch/api/interpreter']
def overpass(q, f, minimo=500):
    p = FUENTE / f
    if p.exists() and p.stat().st_size > minimo: return p
    for vuelta in range(3):
        for url in ESPEJOS:
            try:
                d = urllib.request.urlopen(urllib.request.Request(url, headers=UA, data=urllib.parse.urlencode({'data': q}).encode()), timeout=150).read()
                j = json.loads(d)
                if j.get('elements') and 'remark' not in j:
                    p.write_bytes(d); print('  ', f, 'de', url, len(d) // 1024, 'KB'); time.sleep(2); return p
                print('  ', url, 'sin elementos', j.get('remark', ''))
            except Exception as e: print('  ', url, e)
            time.sleep(4)
        time.sleep(20 * (vuelta + 1))
    raise SystemExit('Overpass no responde: vuelve a lanzar el script más tarde')

# los lugares por su id de OSM: [clave, id, tipo, nombre en la web]
LUGARES = [
    ('puerto', 34856291, 'node', 'Puerto de Pajares'), ('pajares', 34856150, 'node', 'Pajares'),
    ('sanmiguel', 1105528351, 'node', 'San Miguel del Río'), ('santamarina', 1105529815, 'node', 'Santa Marina'),
    ('someron', 4535715373, 'node', 'Llanos de Somerón'), ('fierros', 34870165, 'node', 'Puente de los Fierros'),
    ('fresneo', 1106901449, 'node', 'Fresneo'), ('herias', 1100889572, 'node', 'Herías'), ('frecha', 1100889310, 'node', 'La Frecha'),
    ('campomanes', 30826550, 'node', 'Campomanes'), ('santacristina', 219150698, 'way', 'Santa Cristina de Lena'),
    ('palacio', 1107933530, 'node', 'Palacio'), ('vegaciego', 1108312093, 'node', 'Vega del Ciego'), ('pola', 30826505, 'node', 'Pola de Lena'),
    ('ubina', 1157264807, 'node', 'Peña Ubiña'),
]
# los cinco arcos del logo. El nodo de Pajares queda a 1 km de la línea de OSM (el trazado de la relación baja por
# San Miguel del Río sin entrar en el pueblo), así que el segundo arco es San Miguel del Río.
PARADAS = ['puerto', 'sanmiguel', 'fierros', 'campomanes', 'pola']
nodos_q = ','.join(str(i) for _, i, t, _ in LUGARES if t == 'node'); vias_q = ','.join(str(i) for _, i, t, _ in LUGARES if t == 'way')
overpass(f'[out:json][timeout:120];rel({REL});way(r)({S},{O},{N},{E});out geom;', 'camino-osm.json', 20000)
overpass(f'[out:json][timeout:60];(node(id:{nodos_q});way(id:{vias_q}););out center tags;', 'lugares-osm.json')
overpass(f'[out:json][timeout:60];way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed"](around:900,{PUERTA[0]},{PUERTA[1]});out geom;', 'calles-osm.json', 5000)

HOJAS_LAT = [(S, (S + N) / 2 + .002), ((S + N) / 2 - .002, N)]
HOJAS_LON = [(O, (O + E) / 2 + .002), ((O + E) / 2 - .002, E)]
HOJAS = []
for i, (s, n) in enumerate(HOJAS_LAT):
    for j, (o, e) in enumerate(HOJAS_LON):
        f = f'mdt5-{i}{j}.tif'; HOJAS.append(f)
        baja('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion4258_5'
             f'&SUBSET=Lat({s},{n})&SUBSET=Long({o},{e})&FORMAT=image/tiff', f, 1_000_000)
# (sin 3D desde el 2026-10-23, por decisión de Álvaro: ni ortofoto PNOA ni mallas; solo el perfil 2D)

if 'solo-bajar' in sys.argv: raise SystemExit('descargas hechas')

# ---------- 1. Geometría: metros locales (x este, z sur) desde el centro de la caja ----------
def a_xz(lat, lon): return np.column_stack([(np.asarray(lon, float) - (O + E) / 2) * KX, ((S + N) / 2 - np.asarray(lat, float)) * KZ])
def largo_seg(a, b):   # a, b: arrays (lat, lon); equirrectangular con el coseno de cada tramo (< 1 m de error en 25 km)
    la = np.radians((a[:, 0] + b[:, 0]) / 2)
    return np.hypot((b[:, 0] - a[:, 0]) * 111132.95, (b[:, 1] - a[:, 1]) * 111412.84 * np.cos(la))
def metros(a, b): return float(largo_seg(np.array([a]), np.array([b]))[0])

# ---------- 2. El camino: grafo de las vías de la relación y camino más corto puerto → Pola ----------
def grafo(elementos):
    G, pos = {}, {}
    for w in elementos:
        if w.get('type') != 'way' or not w.get('geometry'): continue
        ids = w.get('nodes') or [None] * len(w['geometry'])
        pts = w['geometry']
        for k in range(len(pts)):
            nid = ids[k] if ids[k] is not None else (round(pts[k]['lat'], 7), round(pts[k]['lon'], 7))
            pos[nid] = (pts[k]['lat'], pts[k]['lon'])
            if k:
                a = ids[k - 1] if ids[k - 1] is not None else (round(pts[k - 1]['lat'], 7), round(pts[k - 1]['lon'], 7))
                d = metros(pos[a], pos[nid])
                G.setdefault(a, []).append((nid, d)); G.setdefault(nid, []).append((a, d))
    return G, pos
def dijkstra(G, a, b=None):
    dist = {a: 0.0}; prev = {}; q = [(0.0, a)]
    while q:
        d, u = heapq.heappop(q)
        if u == b: break
        if d > dist.get(u, 1e18): continue
        for v, w in G.get(u, ()):
            nd_ = d + w
            if nd_ < dist.get(v, 1e18): dist[v] = nd_; prev[v] = u; heapq.heappush(q, (nd_, v))
    return dist, prev
def recorrido(prev, a, b):
    c = [b]
    while c[-1] != a: c.append(prev[c[-1]])
    return c[::-1]
def mas_cercano(pos, p, nodos=None):
    nodos = list(nodos if nodos is not None else pos)
    arr = np.array([pos[n] for n in nodos])
    d = np.hypot((arr[:, 0] - p[0]) * 111132.95, (arr[:, 1] - p[1]) * 111412.84 * math.cos(math.radians(p[0])))
    i = int(np.argmin(d)); return nodos[i], float(d[i])

cam = json.loads((FUENTE / 'camino-osm.json').read_text(encoding='utf-8'))['elements']
G, pos = grafo(cam)
lug_osm = {e['id']: e for e in json.loads((FUENTE / 'lugares-osm.json').read_text(encoding='utf-8'))['elements']}
def coords(i):
    e = lug_osm[i]; c = e.get('center') or e; return (c['lat'], c['lon'])
LL = {k: coords(i) for k, i, _, _ in LUGARES}
ini, d_ini = mas_cercano(pos, LL['puerto'])
fin_aprox, _ = mas_cercano(pos, LL['pola'])
dist, prev = dijkstra(G, ini)
# las calles: Dijkstra desde la puerta; el pie del camino es el nodo del camino con menos calle hasta la puerta
calles = json.loads((FUENTE / 'calles-osm.json').read_text(encoding='utf-8'))['elements']
Gc, posc = grafo(calles)
puerta_n, d_puerta = mas_cercano(posc, PUERTA)
dc, prevc = dijkstra(Gc, puerta_n)
cand = [n for n in pos if n in dc and n in dist]
assert cand, 'el camino y las calles no comparten nodos'
pie = min(cand, key=lambda n: dc[n] + 1e-6 * dist[n])
print(f'puerto: nodo del camino a {d_ini:.0f} m del collado · pie del camino a {dc[pie]:.0f} m de calle de la puerta (puerta a {d_puerta:.0f} m de su calle)')
ruta_ids = recorrido(prev, ini, pie)
ll_cam = np.array([pos[n] for n in ruta_ids])
ll_calle = np.array([posc[n] for n in recorrido(prevc, puerta_n, pie)][::-1])   # pie → puerta
ll_calle = np.vstack([ll_calle, [PUERTA]])
def limpia(ll):
    seg = largo_seg(ll[:-1], ll[1:]); keep = np.concatenate([[True], seg > .05]); return ll[keep]
ll_cam = limpia(ll_cam); ll_calle = limpia(ll_calle)
s_cam = np.concatenate([[0], np.cumsum(largo_seg(ll_cam[:-1], ll_cam[1:]))])
s_calle = np.concatenate([[0], np.cumsum(largo_seg(ll_calle[:-1], ll_calle[1:]))])
LARGO_CAM, LARGO_CALLE = float(s_cam[-1]), float(s_calle[-1])
ll_tot = np.vstack([ll_cam, ll_calle[1:]]); s_tot = np.concatenate([s_cam, LARGO_CAM + s_calle[1:]])
LARGO = float(s_tot[-1])
print(f'camino OSM: {len(ll_cam)} puntos, {LARGO_CAM:.0f} m · calle hasta la puerta {LARGO_CALLE:.0f} m · total {LARGO:.0f} m')

# ---------- 3. Relieve: las cuatro hojas cosidas en la rejilla del MDT05 y recortadas a la caja ----------
hojas = [Image.open(FUENTE / f) for f in HOJAS]
px, py = hojas[0].tag_v2[33550][:2]
wD, hD = round((E - O) / px), round((N - S) / py)
dem0 = np.zeros((hD, wD), np.float32); hecho = np.zeros((hD, wD), bool)
for im in hojas:
    a = np.array(im, dtype=np.float32); x0 = round((im.tag_v2[33922][3] - O) / px); y0 = round((N - im.tag_v2[33922][4]) / py)
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(wD, x0 + a.shape[1]), min(hD, y0 + a.shape[0])
    dem0[ya:yb, xa:xb] = a[ya - y0:yb - y0, xa - x0:xb - x0]; hecho[ya:yb, xa:xb] = True
assert hecho.all(), 'faltan píxeles del MDT en la caja'
assert dem0.min() > -50 and dem0.max() < 3000, f'MDT con valores raros: {dem0.min()} {dem0.max()}'
dem_med = nd.gaussian_filter(dem0, .8)    # para medir: casi el MDT tal cual
dem = nd.gaussian_filter(dem0, 1.5)       # para pintar: sin escalones de metro en las laderas suaves
def cota_ll(lat, lon, d=dem_med):
    r = (N - np.asarray(lat)) / (N - S) * (hD - 1); c = (np.asarray(lon) - O) / (E - O) * (wD - 1)
    return nd.map_coordinates(d, [np.atleast_1d(r), np.atleast_1d(c)], order=1, mode='nearest')
def uv(lat, lon): return [round((lon - O) / (E - O), 5), round((N - lat) / (N - S), 5)]
def local(lat, lon): v = a_xz(lat, lon)[0]; return [round(float(v[0]), 1), round(float(v[1]), 1)]

# ---------- 4. El perfil: cada 5 m; altitudes, desnivel ----------
PASO_M = 5.0
t5 = np.append(np.arange(0, LARGO, PASO_M), LARGO)
lat5, lon5 = np.interp(t5, s_tot, ll_tot[:, 0]), np.interp(t5, s_tot, ll_tot[:, 1])
h5 = cota_ll(lat5, lon5)
h5s = nd.gaussian_filter1d(h5, 3.0, mode='nearest')       # 3 muestras = 15 m
def acumula(h, umbral):
    sube = baja_ = 0.0; ref = h[0]
    for v in h[1:]:
        if v - ref >= umbral: sube += v - ref; ref = v
        elif ref - v >= umbral: baja_ += ref - v; ref = v
    return sube, baja_
SUBE, BAJA = acumula(h5s, 2.0)
xz5 = a_xz(lat5, lon5)
i_max = int(np.argmax(h5s))

# ---------- 5. Los lugares: km y altitud del camino al pasar ----------
PUNTOS = {}
for k, i, _, nombre in LUGARES:
    la, lo = LL[k]
    d = np.hypot(*(xz5 - a_xz(la, lo)[0]).T); j = int(np.argmin(d))
    PUNTOS[k] = {'id': k, 't': nombre, 'osm': i, 'km': round(t5[j] / 1000, 2), 'm': round(float(t5[j])), 'alt': int(round(float(h5s[j]))),
                 'a_m': round(float(d[j])), 'en_ruta': float(d[j]) < 450, 'lat': round(la, 6), 'lon': round(lo, 6),
                 'alt_nodo': int(round(float(cota_ll(la, lo)[0])))}
# el puerto es el principio del camino; Pola, la puerta del albergue (el final)
PUNTOS['puerto'].update({'km': 0.0, 'm': 0, 'alt': int(round(float(h5s[0])))})
PUNTOS['pola'].update({'t': 'Pola de Lena', 'km': round(LARGO / 1000, 2), 'm': round(LARGO), 'alt': int(round(float(h5s[-1]))),
                       'lat': PUERTA[0], 'lon': PUERTA[1], 'nota': 'la puerta del albergue (C/ Canuto Hevia)'})
for k, p in PUNTOS.items():
    print(f'  {p["t"]:24} km {p["km"]:6} · camino {p["alt"]:5} m · nodo {p["alt_nodo"]:5} m · a {p["a_m"]:5} m del camino · {"en ruta" if p["en_ruta"] else "FUERA"}')
for k in PARADAS: assert k == 'puerto' or k == 'pola' or PUNTOS[k]['en_ruta'], f'la parada {k} no cae en el camino'
orden = sorted([p for k, p in PUNTOS.items() if p['en_ruta'] or k in ('puerto', 'pola')], key=lambda p: p['m'])
print('orden en el camino:', ' · '.join(p['t'] for p in orden if p['id'] != 'ubina'))
MAS_ABAJO = PUNTOS['puerto']['alt'] - PUNTOS['pola']['alt']

# ---------- 9. El perfil en SVG (respaldo de la web): la línea del logo, que baja, y los cinco arcos ----------
coma = lambda v, dd=1: f'{v:.{dd}f}'.replace('.', ',')
def mil(m): m = int(round(m)); return f'{m // 1000}.{m % 1000:03d}' if m >= 1000 else str(m)
SW, SH, M_IZ, M_DE, M_AR, M_AB = 1200, 420, 64, 28, 60, 64
hmin, hmax = 200, 1500
def aS(m, h): return (M_IZ + m / LARGO * (SW - M_IZ - M_DE), M_AR + (hmax - h) / (hmax - hmin) * (SH - M_AR - M_AB))
sel = np.linspace(0, len(t5) - 1, 700).astype(int)
lin = ' '.join(f'{x:.1f},{y:.1f}' for x, y in (aS(t5[i], h5s[i]) for i in sel))
x_ini, y_base = aS(0, hmin)[0], aS(0, hmin)[1]
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" role="img" aria-labelledby="perfil-t perfil-d" font-family="Sora, Figtree, system-ui, sans-serif">',
       f'<title id="perfil-t">Perfil de la bajada del Puerto de Pajares a Pola de Lena</title>',
       f'<desc id="perfil-d">{coma(LARGO / 1000)} km por el Camino del Salvador, de {mil(PUNTOS["puerto"]["alt"])} m en el puerto a {PUNTOS["pola"]["alt"]} m en la puerta del albergue: '
       + ', '.join(f'{PUNTOS[k]["t"]}, km {coma(PUNTOS[k]["km"])}, {mil(PUNTOS[k]["alt"])} m' for k in PARADAS) + '.</desc>',
       f'<rect width="{SW}" height="{SH}" fill="#16110D"/>']
for h in range(300, 1500, 200):
    y = aS(0, h)[1]
    svg.append(f'<line x1="{M_IZ}" y1="{y:.1f}" x2="{SW - M_DE}" y2="{y:.1f}" stroke="#F3EEE6" stroke-opacity=".1"/>')
    svg.append(f'<text x="{M_IZ - 10}" y="{y + 4:.1f}" text-anchor="end" font-size="13" fill="#E8E0D3" fill-opacity=".7">{mil(h)}</text>')
for km in range(0, int(LARGO // 1000) + 1, 5):
    x = aS(km * 1000, 0)[0]
    svg.append(f'<text x="{x:.1f}" y="{SH - M_AB + 22}" text-anchor="middle" font-size="13" fill="#E8E0D3" fill-opacity=".7">{km} km</text>')
svg.append(f'<polygon points="{x_ini:.1f},{SH - M_AB} {lin} {SW - M_DE},{SH - M_AB}" fill="#241B15"/>')
svg.append(f'<polyline points="{lin}" fill="none" stroke="#B07848" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>')
for n, k in enumerate(PARADAS):
    p = PUNTOS[k]; x, y = aS(p['m'], p['alt'])
    ancla = 'start' if n == 0 else ('end' if n == len(PARADAS) - 1 else 'middle')
    # el arco del logo colgando de la línea (un cuarto de arco que baja)
    svg.append(f'<path d="M{x - 9:.1f},{y + 40:.1f} L{x - 9:.1f},{y + 22:.1f} C{x - 9:.1f},{y + 10:.1f} {x + 1:.1f},{y + 6:.1f} {x + 13:.1f},{y + 6:.1f} '
               f'C{x + 4:.1f},{y + 10:.1f} {x - 1:.1f},{y + 16:.1f} {x - 1:.1f},{y + 26:.1f} L{x - 1:.1f},{y + 40:.1f} Z" fill="#B07848"/>')
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="#F3EEE6" stroke="#16110D" stroke-width="2"/>')
    svg.append(f'<text x="{x:.1f}" y="{y - 30:.1f}" text-anchor="{ancla}" font-size="15" font-weight="700" fill="#F3EEE6">{p["t"]}</text>')
    svg.append(f'<text x="{x:.1f}" y="{y - 13:.1f}" text-anchor="{ancla}" font-size="13" fill="#E8E0D3" fill-opacity=".8">km {coma(p["km"])} · {mil(p["alt"])} m</text>')
svg.append('</svg>')
(OUT / 'perfil.svg').write_text('\n'.join(svg), encoding='utf-8')

# ---------- 10. bajada.json (el contrato con la web) ----------
paso_perfil = 100
sel_p = np.append(np.searchsorted(t5, np.arange(0, LARGO, paso_perfil)), len(t5) - 1)
bajada = {
    'tramo': 'Puerto de Pajares → Pola de Lena', 'camino': 'Camino del Salvador',
    'km': round(LARGO / 1000, 1), 'metros': round(LARGO), 'km_camino': round(LARGO_CAM / 1000, 1), 'calle_m': round(LARGO_CALLE),
    'alt_puerto': PUNTOS['puerto']['alt'], 'alt_puerta': PUNTOS['pola']['alt'], 'mas_abajo': MAS_ABAJO,
    'subida': int(round(SUBE)), 'bajada': int(round(BAJA)),
    'paradas': [{k: PUNTOS[p][k] for k in ('id', 't', 'km', 'alt', 'lat', 'lon')} for p in PARADAS],
    'pueblos': [{k: p[k] for k in ('id', 't', 'km', 'alt')} for p in orden if p['id'] not in PARADAS and p['id'] != 'ubina'],
    'perfil': {'paso_m': paso_perfil, 'km': [round(float(t5[i]) / 1000, 2) for i in sel_p], 'alt': [int(round(float(h5s[i]))) for i in sel_p]},
    'textos': {
        'remate': f'Del puerto a tu litera: {mil(MAS_ABAJO)} m más abajo.',
        'resumen': f'{coma(LARGO / 1000)} km del Puerto de Pajares a la puerta, por el Camino del Salvador: de {mil(PUNTOS["puerto"]["alt"])} m a {PUNTOS["pola"]["alt"]} m.',
        'honesto': 'Trazado según OpenStreetMap y altitudes del MDT05 del IGN; las flechas del camino mandan.',
    },
    'metodo': {
        'ruta': f'OpenStreetMap, relación {REL} «Camino del Salvador»: camino más corto por sus vías desde el punto más cercano al collado del Puerto de Pajares (a {d_ini:.0f} m) hasta el pie de la calle del albergue; de ahí, {LARGO_CALLE:.0f} m por las calles de OSM hasta la puerta',
        'distancia': 'en planta, punto a punto de la línea de OSM',
        'altitud': 'MDT05 del IGN (malla de 5 m), interpolación bilineal cada 5 m y suavizado de 15 m',
        'desnivel': 'acumulado con umbral de 2 m',
        'puerta': 'C/ Canuto Hevia, punto de la calle de Nominatim (el portal 12 no está en OSM): supuesto',
        'gronze': 'Gronze da para la etapa 4 (Pajares → Pola de Lena) 23,8 km, +595 m / −1.273 m: es otro tramo (empieza en Pajares, no en el puerto)',
    },
    'fuente': 'Camino y pueblos: © colaboradores de OpenStreetMap (ODbL) · Relieve MDT05: © Instituto Geográfico Nacional (CC BY 4.0)',
    'fecha': time.strftime('%Y-%m-%d'),
}
(OUT / 'bajada.json').write_text(json.dumps(bajada, ensure_ascii=False, indent=1), encoding='utf-8')

print(f'caja {ancho / 1000:.2f} × {alto / 1000:.2f} km | bajada {LARGO:.0f} m (camino {LARGO_CAM:.0f} + calle {LARGO_CALLE:.0f}) | '
      f'puerto {PUNTOS["puerto"]["alt"]} → puerta {PUNTOS["pola"]["alt"]}: {MAS_ABAJO} m más abajo | sube {SUBE:.0f} · baja {BAJA:.0f} | '
      f'lo más alto {h5s[i_max]:.0f} m en el km {t5[i_max] / 1000:.1f} | MDT {dem.min():.0f}–{dem.max():.0f} m')
for p in sorted(OUT.iterdir()): print(f'{p.name:28} {p.stat().st_size // 1024:6} KB')
