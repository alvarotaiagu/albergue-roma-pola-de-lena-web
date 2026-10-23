"""Vectoriza el logo del Albergue Roma (ref/logo/logo-web-300.png, 300x140) REDIBUJÁNDOLO.

No se calca con potrace: la cruz, las letras y los cinco arcos se rehacen con
geometría limpia y medidas sacadas del PNG (memoria feedback_logo_jpg_redibujar_rectas).

- La cruz: 4 pétalos (rectángulo de 8,1 de ancho con la punta exterior en ojiva),
  punto central ocre (r 3,85) y 4 rombos en las esquinas. Medidas por centroides de alfa.
- Las letras: trazo de 3,9 con remates y uniones redondas sobre la línea media de cada asta
  (medida por centroides fila a fila); los puntos ocres, círculos en su centroide.
- Los cinco arcos: cada uno es una dovela de arranque (pata vertical + curva exterior e
  interior en cuarto de elipse que acaban en punta + corte inferior inclinado). Sus 9
  parámetros se ajustan por IoU contra el alfa ampliado x8 (scipy, Nelder-Mead).
- La línea que baja: ajuste lineal de los centroides por columna.
- «Pola de Lena»: contornos de Figtree Light (OFL) sacados con fontTools, encajados en la
  caja medida (es una palo seco fina; la del logo no se conoce). Si no hay fuente local,
  se usa marca/pola-de-lena.json ya guardado.

Uso: python -I scripts/logo.py   → marca/logo.svg, marca/cruz.svg, marca/arcos.svg,
     marca/logo-medidas.json (y escribe en pantalla el IoU de cada pieza).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import optimize

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PNG = os.path.join(RAIZ, 'ref', 'logo', 'logo-web-300.png')
MARCA = os.path.join(RAIZ, 'marca')
OCRE, CASTANO, NEGRO = '#B07E4A', '#683C10', '#1A1612'
K = 8  # ampliación para medir

im = np.array(Image.open(PNG).convert('RGBA')).astype(float)
ALFA = im[:, :, 3] / 255.0
R = im[:, :, 0]


def f(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


# ---------------------------------------------------------------- la cruz
CX, CY = 21.1, 27.86          # centro (pétalos)
PETALO_W = 8.1                # ancho de pétalo
P_IN, P_RECTO, P_PUNTA = 6.0, 14.9, 19.3   # distancias al centro: borde interior, fin de lo recto, punta
R_CENTRO = 3.85
ROMBO = {'dx': 13.67, 'dy': 16.5, 'cx': 21.56, 'cy': 27.92, 'r': 4.75}


def petalo(ang):
    """pétalo hacia arriba en coordenadas locales (y negativa = afuera), luego girado"""
    h = PETALO_W / 2
    pts = f'M{f(-h)} {f(-P_IN)}V{f(-P_RECTO)}C{f(-h)} {f(-P_RECTO - 2.3)} {f(-1.6)} {f(-P_PUNTA + .25)} 0 {f(-P_PUNTA)}' \
          f'C{f(1.6)} {f(-P_PUNTA + .25)} {f(h)} {f(-P_RECTO - 2.3)} {f(h)} {f(-P_RECTO)}V{f(-P_IN)}Z'
    return f'<path transform="rotate({ang})" d="{pts}"/>'


def rombo(x, y, r):
    q = r * .16  # esquinas apenas romas
    return (f'<path d="M{f(x)} {f(y - r)}L{f(x + r - q)} {f(y - q)}Q{f(x + r)} {f(y)} {f(x + r - q)} {f(y + q)}'
            f'L{f(x)} {f(y + r)}L{f(x - r + q)} {f(y + q)}Q{f(x - r)} {f(y)} {f(x - r + q)} {f(y - q)}Z"/>')


def cruz_plana(tx, ty):
    """la cruz en UN solo <g> sin grupos dentro (para logo.svg: construir.mjs quita grupos por clase)"""
    rx = ROMBO['cx'] - CX
    ry = ROMBO['cy'] - CY
    rombos = ''.join(rombo(rx + sx * ROMBO['dx'], ry + sy * ROMBO['dy'], ROMBO['r'])
                     for sy in (-1, 1) for sx in (-1, 1))
    return (f'<g class="logo-cruz" fill="{CASTANO}" transform="translate({f(tx)} {f(ty)})">'
            f'{"".join(petalo(a) for a in (0, 90, 180, 270))}{rombos}'
            f'<circle class="cruz-centro" r="{f(R_CENTRO)}" fill="{OCRE}"/></g>')


def cruz_svg_g(tx, ty):
    """grupo de la cruz con el centro en (tx, ty)"""
    rx = ROMBO['cx'] - CX
    ry = ROMBO['cy'] - CY
    rombos = ''.join(rombo(rx + sx * ROMBO['dx'], ry + sy * ROMBO['dy'], ROMBO['r'])
                     for sy in (-1, 1) for sx in (-1, 1))
    return (f'<g transform="translate({f(tx)} {f(ty)})">'
            f'<g class="cruz-petalos" fill="{CASTANO}">{"".join(petalo(a) for a in (0, 90, 180, 270))}</g>'
            f'<g class="cruz-rombos" fill="{CASTANO}">{rombos}</g>'
            f'<circle class="cruz-centro" r="{f(R_CENTRO)}" fill="{OCRE}"/></g>')


# ---------------------------------------------------------------- las letras
W_LETRA = 3.9
Y_TOP, Y_BAJO = 9.1, 29.8


def letra_A(c):  # c = x del vértice
    return (f'M{f(c - 8.25)} {f(Y_BAJO)}L{f(c - 1.25)} {f(9.4)}Q{f(c)} {f(7.3)} {f(c + 1.25)} {f(9.4)}'
            f'L{f(c + 8.3)} {f(Y_BAJO)}')


def letra_R(x):  # x = asta
    d = x - 125.46
    return (f'M{f(x)} {f(Y_BAJO)}V{f(Y_TOP)}H{f(135.4 + d)}Q{f(137.4 + d)} {f(Y_TOP)} {f(137.4 + d)} {f(11.1)}'
            f'V{f(17.4)}Q{f(137.4 + d)} {f(19.4)} {f(135.4 + d)} {f(19.4)}H{f(130.9 + d)}'
            f'M{f(133.6 + d)} {f(19.6)}L{f(139.4 + d)} {f(Y_BAJO)}')


def letra_E(x, fin_arriba, fin_abajo):
    return f'M{f(fin_arriba)} {f(Y_TOP)}H{f(x)}V{f(Y_BAJO)}H{f(fin_abajo)}'


LETRAS = {
    'A1': letra_A(56.2),
    'L': f'M70.58 8.85V{f(Y_BAJO)}H81.6',
    'B': (f'M87.88 {f(Y_BAJO)}V{f(Y_TOP)}H97.7Q99.72 {f(Y_TOP)} 99.72 11.1V17.05Q99.72 19.05 97.7 19.05H94.3'
          f'M97.9 19.05Q100.32 19.05 100.32 21.5V27.8Q100.32 {f(Y_BAJO)} 98.3 {f(Y_BAJO)}H87.88'),
    'E1': letra_E(108.31, 119.4, 119.6),
    'R1': letra_R(125.46),
    'G': (f'M157.56 14.4V11.8Q157.56 9.2 154.96 9.2H148.16Q145.56 9.2 145.56 11.8V27.1'
          f'Q145.56 29.7 148.16 29.7H155.12Q157.72 29.7 157.72 27.1V19.9'),
    'U': f'M165.82 8.8V26.4Q165.82 29.5 168.92 29.5H175.43Q178.53 29.5 178.53 26.4V8.8',
    'E2': letra_E(186.65, 196.7, 197.3),
    'R2': letra_R(212.74),
    'O': (f'M235.9 9.07H242.37Q245.37 9.07 245.37 12.07V26.81Q245.37 29.81 242.37 29.81H235.9'
          f'Q232.9 29.81 232.9 26.81V12.07Q232.9 9.07 235.9 9.07Z'),
    'M': f'M253.36 {f(Y_BAJO)}V9.4Q253.36 8.9 254.2 8.9H255L262.35 29.1L269.7 8.9H270.5Q271.34 8.9 271.34 9.4V{f(Y_BAJO)}',
    'A2': letra_A(285.14),
}
PUNTOS = [(56.3, 24.35, 2.5), (115.6, 19.0, 2.55), (152.1, 20.45, 2.55), (193.6, 19.0, 2.55), (285.55, 24.5, 2.5)]

# ---------------------------------------------------------------- la línea que baja
def medir_linea():
    xs, ys = [], []
    for x in range(48, 233, 2):
        col = ALFA[38:75, x]
        idx = np.nonzero(col > .05)[0]
        if not len(idx):
            continue
        run = [idx[0]]
        for i in idx[1:]:
            if i == run[-1] + 1:
                run.append(i)
            else:
                break
        run = np.array(run)
        w = col[run].sum()
        xs.append(x + .5)
        ys.append((col[run] * (np.arange(38, 75)[run] + .5)).sum() / w)
    m, b = np.polyfit(xs, ys, 1)
    # extremos: primera y última columna con trazo en la recta
    x0 = 46.9
    x1 = 295.0
    return {'x0': x0, 'y0': m * x0 + b, 'x1': x1, 'y1': m * x1 + b, 'grosor': 1.3, 'pendiente': m}


# ---------------------------------------------------------------- los cinco arcos
CAJAS = [(44, 75, 53, 81), (91, 123, 59, 91), (142, 175, 66, 112), (198, 235, 73, 140), (262, 296, 80, 112)]


def arco_puntos(p, n=36):
    """p = [xl, w, yb_l, yb_r, xt, yt, yc, yc2, tt]: pata vertical de ancho w desde xl, curva exterior
    cuarto de elipse de (xl, yc) a la punta (xt, yt); interior de (xl+w, yc2) a (xt, yt+tt)."""
    xl, w, ybl, ybr, xt, yt, yc, yc2, tt = p
    pts = [(xl, ybl), (xl, yc)]
    for i in range(1, n + 1):  # exterior: centro (xt, yc), radios (xt-xl, yc-yt)
        t = math.pi / 2 * i / n
        pts.append((xt - (xt - xl) * math.cos(t), yc - (yc - yt) * math.sin(t)))
    for i in range(n, -1, -1):  # interior, de la punta a la pata
        t = math.pi / 2 * i / n
        pts.append((xt - (xt - xl - w) * math.cos(t), yc2 - (yc2 - yt - tt) * math.sin(t)))
    pts.append((xl + w, ybr))
    return pts


def mascara(pts, caja):
    x0, x1, y0, y1 = caja
    img = Image.new('L', ((x1 - x0) * K, (y1 - y0) * K), 0)
    ImageDraw.Draw(img).polygon([((x - x0) * K, (y - y0) * K) for x, y in pts], fill=255)
    return np.array(img) / 255.0


def objetivo_caja(caja):
    x0, x1, y0, y1 = caja
    sub = Image.fromarray((ALFA[y0:y1, x0:x1] * 255).astype(np.uint8)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.BICUBIC)
    return (np.array(sub) / 255.0) > .5


def iou(a, b):
    return (a & b).sum() / max(1, (a | b).sum())


def ajustar_arco(caja):
    x0, x1, y0, y1 = caja
    obj = objetivo_caja(caja)
    ys, xs = np.nonzero(obj)
    bx0, bx1 = xs.min() / K + x0, xs.max() / K + x0
    by0, by1 = ys.min() / K + y0, ys.max() / K + y0
    ancho = bx1 - bx0
    p0 = [bx0 + .3, ancho * .4, by1 - .2, by1 - 1.5, bx1, by0 + .3, by0 + ancho * .55, by0 + ancho * .75, 1.2]

    def coste(p):
        if p[1] < 2 or p[8] < 0 or p[6] <= p[5] or p[7] <= p[5] + p[8] or p[4] <= p[0] + p[1]:
            return 2.0
        return 1 - iou(mascara(arco_puntos(p), caja) > .5, obj)

    mejor = optimize.minimize(coste, p0, method='Nelder-Mead',
                              options={'maxiter': 2500, 'xatol': .01, 'fatol': 1e-5, 'adaptive': True})
    mejor = optimize.minimize(coste, mejor.x, method='Nelder-Mead',
                              options={'maxiter': 2500, 'xatol': .005, 'fatol': 1e-6, 'adaptive': True})
    return [float(v) for v in mejor.x], 1 - mejor.fun


def arco_d(p):
    xl, w, ybl, ybr, xt, yt, yc, yc2, tt = p
    rx, ry = xt - xl, yc - yt
    rx2, ry2 = xt - xl - w, yc2 - yt - tt
    return (f'M{f(xl)} {f(ybl)}V{f(yc)}A{f(rx)} {f(ry)} 0 0 1 {f(xt)} {f(yt)}'
            f'L{f(xt)} {f(yt + tt)}A{f(rx2)} {f(ry2)} 0 0 0 {f(xl + w)} {f(yc2)}V{f(ybr)}Z')


# ---------------------------------------------------------------- «Pola de Lena»
def pola_de_lena():
    guardado = os.path.join(MARCA, 'pola-de-lena.json')
    rutas = [r'C:\Windows\Fonts\Figtree-Light.ttf', os.path.join(RAIZ, 'scripts', 'fuentes', 'Figtree-Light.ttf')]
    ttf = next((r for r in rutas if os.path.exists(r)), None)
    if not ttf:
        if os.path.exists(guardado):
            return json.load(open(guardado, encoding='utf-8'))
        print('aviso: sin Figtree-Light.ttf; «Pola de Lena» queda fuera', file=sys.stderr)
        return None
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    fuente = TTFont(ttf)
    gs = fuente.getGlyphSet()
    cmap = fuente.getBestCmap()
    upm = fuente['head'].unitsPerEm
    x = 0
    pen = SVGPathPen(gs)
    for ch in 'Pola de Lena':
        nombre = cmap[ord(ch)]
        TransformPen(pen, (1, 0, 0, -1, x, 0)).__class__  # noqa
        gs[nombre].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        x += gs[nombre].width
    alto_may = fuente['OS/2'].sCapHeight
    datos = {'d': pen.getCommands(), 'ancho': x, 'alto_may': alto_may, 'upm': upm}
    json.dump(datos, open(guardado, 'w', encoding='utf-8'))
    return datos


def medir_pola():
    sub = ALFA[38:50, 232:296] * (R[38:50, 232:296] > 140)
    ys, xs = np.nonzero(sub > .3)
    return {'x0': int(232 + xs.min()), 'x1': int(232 + xs.max() + 1), 'y0': int(38 + ys.min()), 'y1': int(38 + ys.max() + 1)}


# ---------------------------------------------------------------- salida
def main():
    os.makedirs(MARCA, exist_ok=True)
    linea = medir_linea()
    arcos = []
    for caja in CAJAS:
        p, io = ajustar_arco(caja)
        arcos.append({'p': p, 'iou': round(io, 4)})
        print('arco', caja, 'IoU %.3f' % io)

    pol = pola_de_lena()
    caja_pola = medir_pola()
    pola_g = ''
    if pol:
        s = (caja_pola['y1'] - caja_pola['y0'] - .2) / pol['alto_may']
        sx = (caja_pola['x1'] - caja_pola['x0']) / (pol['ancho'] * s)
        pola_g = (f'<path class="logo-lugar" fill="{OCRE}" transform="translate({f(caja_pola["x0"])} {f(caja_pola["y1"] - .1)}) '
                  f'scale({s * sx:.5f} {s:.5f})" d="{pol["d"]}"/>')

    letras = ''.join(f'<path d="{d}"/>' for d in LETRAS.values())
    puntos = ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}"/>' for x, y, r in PUNTOS)
    linea_el = (f'<path class="logo-linea" d="M{f(linea["x0"])} {f(linea["y0"])}L{f(linea["x1"])} {f(linea["y1"])}" fill="none" '
                f'stroke="{OCRE}" stroke-width="{f(linea["grosor"])}" stroke-linecap="round"/>')
    arcos_el = ''.join(f'<path class="arco arco-{i + 1}" d="{arco_d(a["p"])}"/>' for i, a in enumerate(arcos))

    logo = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140" width="300" height="140" role="img" aria-labelledby="t">'
            f'<title id="t">Albergue Roma · Pola de Lena</title>'
            f'{cruz_plana(CX, CY)}'
            f'<g class="logo-letras" fill="none" stroke="{NEGRO}" stroke-width="{W_LETRA}" stroke-linecap="round" stroke-linejoin="round">{letras}</g>'
            f'<g class="logo-puntos" fill="{OCRE}">{puntos}</g>'
            f'{pola_g}'
            f'<g class="logo-puente" fill="{OCRE}">{linea_el}{arcos_el}</g></svg>\n')
    open(os.path.join(MARCA, 'logo.svg'), 'w', encoding='utf-8').write(logo)

    # cruz suelta: centro en (20, 22), viewBox con origen 0
    cruz = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44" width="40" height="44" role="img" aria-label="Cruz del Albergue Roma">'
            f'{cruz_svg_g(20, 22)}</svg>\n')
    open(os.path.join(MARCA, 'cruz.svg'), 'w', encoding='utf-8').write(cruz)

    # la línea y los cinco arcos: viewBox con origen 0 (desplazados -44, -42)
    arcos_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 254 99" width="254" height="99" role="img" aria-label="Los cinco arcos del Albergue Roma">'
                 f'<g class="logo-puente" fill="{OCRE}" transform="translate(-44 -42)">{linea_el}{arcos_el}</g></svg>\n')
    open(os.path.join(MARCA, 'arcos.svg'), 'w', encoding='utf-8').write(arcos_svg)

    medidas = {
        'fuente': 'ref/logo/logo-web-300.png (300x140), medido con scripts/logo.py',
        'colores': {'ocre': OCRE, 'castano': CASTANO, 'letras': '#000 en el PNG; ' + NEGRO + ' en el SVG'},
        'cruz': {'centro': [CX, CY], 'petalo': {'ancho': PETALO_W, 'interior': P_IN, 'fin_recto': P_RECTO, 'punta': P_PUNTA},
                 'punto_central_r': R_CENTRO, 'rombos': ROMBO,
                 'nota': 'en marca/cruz.svg el centro está en (20, 22); viewBox 0 0 40 44'},
        'letras': {'trazo': W_LETRA, 'linea_alta': Y_TOP, 'linea_baja': Y_BAJO, 'puntos_ocres': PUNTOS},
        'linea': linea,
        'arcos': [{'parametros': dict(zip(['xl', 'w', 'yb_izq', 'yb_der', 'x_punta', 'y_punta', 'y_arranque_ext', 'y_arranque_int', 'grueso_punta'],
                                         [round(v, 3) for v in a['p']])), 'iou': a['iou']} for a in arcos],
        'arcos_svg': 'marca/arcos.svg está desplazado (-44, -42) respecto al logo',
        'pola_de_lena': caja_pola,
    }
    json.dump(medidas, open(os.path.join(MARCA, 'logo-medidas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('marca/logo.svg, marca/cruz.svg, marca/arcos.svg y marca/logo-medidas.json listos')


if __name__ == '__main__':
    main()
