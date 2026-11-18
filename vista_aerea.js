/* Vista aérea de un seguidor con sus soportes (control de obra).
 *
 * Pregunta del propietario (18/11/2026): «¿podríamos tener una vista aérea de cada tracker con sus
 * soportes?». Decisión, el mismo día: «Hazla ya con el aviso incorporado».
 *
 * Dibuja, al norte arriba y a escala, los soportes que el fichero de soportes de la planta
 * (master_con.js en Atalaya) da al seguidor: el estado de cada uno, el elegido, la motora (■) y el
 * cardán (◆), los soportes de los vecinos en gris, una barra de 10 m y la posición GPS de quien la
 * mira. Es un SVG: no necesita cobertura ni teselas. Tocar un soporte lo abre.
 *
 * EL AVISO. Antes de dibujar comprueba que esos soportes forman el seguidor de su tipo, con las medidas
 * de la propia app: filas rectas, vanos nominales de getTramoTol (TRAMO_NOM ± TRAMO_TOL) medidos en 3D
 * entre cabezas de soporte (en ladera el vano en planta es más corto), motora y cardán enfrentados,
 * los «N» al norte de los «S» y la motora donde la pone el fichero de seguidores. Si algo no cuadra lo
 * dice y dibuja lo que dice el fichero: no lo arregla ni inventa nada. Con el fichero anterior de Atalaya
 * avisaba en los 1.756 seguidores (auditoría en SolarGPTfull, docs/audit/OBRA-VISTA-AEREA__SolarGPTfull.md,
 * H-24 y H-25). Con el reconstruido (18/11/2026) no avisa en ninguno, y lo que enseña es la CONFIANZA del
 * número de cada seguidor (master.js, «conf»: confirmado, pista o deducido). La ficha de cada soporte, el
 * aviso GPS y el Excel de alturas salen del mismo fichero.
 *
 * Coordenadas: UTM huso 30 (WGS84), como utmToLL de index.html. Nombres: los de la app (plantas.js)
 * se buscan en el fichero con su convención: fila motor «4N-MP» → «4NW», «MP» → «MOTORA-W» (en
 * monofila, «4N» y «MOTORA»); fila conducida «4N» → «4NE», «MP-FC» → «CARDAN-E».
 */
(function (global) {
  'use strict';

  var RECTA_M = 0.10, ENFRENTE_M = 0.10, MOTORA_M = 0.05;
  var MARGEN_X = 9, MARGEN_Y = 5, ANCHO = 340, ALTO_MAX = 300;
  var CLAVE_PLEGADA = 'vistaAerea.plegada';
  var COLOR = { ok: 'var(--ok)', no: 'var(--no)', parcial: 'var(--warn)' };
  /* Confianza del NÚMERO de cada seguidor en un fichero reconstruido (master.js, campo «conf»; propietario,
   * 18/11/2026: «Carga la reconstrucción marcando confirmados y deducidos»). Los soportes dibujados son siempre
   * los de un seguidor real; lo que puede estar deducido es qué número TR lleva. */
  var CONF = {
    confirmado: { badge: '✓ confirmado', color: 'var(--ok)', fondo: 'rgba(91,191,138,.1)',
      texto: function () { return '✓ Seguidor confirmado: el fichero anterior ya tenía estos soportes en su sitio; sólo se han corregido los nombres norte/sur.'; } },
    pista: { badge: 'número deducido', color: 'var(--info)', fondo: 'rgba(104,192,216,.08)',
      texto: function (c) { return 'Número deducido con pista clara. Los soportes son los de un seguidor real (forma, norte y motora comprobados); que sea el ' + c + ' se ha deducido del fichero anterior, que lo situaba aquí. Si en obra no cuadra, avísalo.'; } },
    deducido: { badge: '⚠️ número sin confirmar', color: 'var(--warn)', fondo: 'rgba(242,201,76,.1)',
      texto: function (c) { return '⚠️ Número sin confirmar. El seguidor dibujado es real, pero que sea el ' + c + ' es una suposición: el fichero anterior no lo distinguía de un gemelo o no daba pista. Compruébalo con el plano antes de fiarte de la ficha y del Excel de alturas.'; } }
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function m2(v) { return v.toFixed(2).replace('.', ','); }
  function f1(v) { return v.toFixed(1); }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function dist3(p, q) {
    var dz = num(p.co) && num(q.co) ? q.co - p.co : 0;
    return Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) + dz * dz);
  }

  /* Nombre de un soporte en la app → su nombre en el fichero de soportes. */
  function nombreFichero(n, bifila, conducida) {
    if (conducida) return n === 'MP-FC' ? 'CARDAN-E' : n + 'E';
    if (n === 'MP') return bifila ? 'MOTORA-W' : 'MOTORA';
    return n.replace(/-MP$/, '') + (bifila ? 'W' : '');
  }

  /* WGS84 → UTM huso 30 (meridiano central −3°), las mismas constantes que utmToLL de index.html. */
  function llToUtm(lat, lng) {
    var a = 6378137, e2 = 0.00669438, k0 = 0.9996, ep2 = e2 / (1 - e2);
    var f = lat * Math.PI / 180, dl = (lng + 3) * Math.PI / 180, s = Math.sin(f), c = Math.cos(f), t = Math.tan(f);
    var N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * dl;
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * f -
      (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * f) +
      (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * f) -
      (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * f));
    var x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
    var y = k0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 +
      (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
    return { x: x, y: y };
  }

  /* cfg: datos (MASTER_DATA), soportes (MASTER_CON, o null si la planta no tiene fichero de soportes),
   * tipos (PCFG), tramo(tipo, índice) → {nom, min, max} en mm o null (getTramoTol de la app),
   * almacen (localStorage o null) para recordar si la tarjeta está plegada. */
  function crear(cfg) {
    var datos = cfg.datos || {}, soportes = cfg.soportes || null, tipos = cfg.tipos || {};
    var tramo = cfg.tramo || function () { return null; }, almacen = cfg.almacen || null;
    var ultimo = null; // marco del último dibujo, para poner encima la posición GPS

    /* Filas del seguidor con los soportes del fichero en el orden de la app (null si no está). */
    function filas(code) {
      var d = datos[code], t = d && tipos[d.type];
      if (!t) return [];
      var sup = (soportes && soportes[code]) || [], bi = !!t.conducida, out = [];
      [['motor', 'fm', t.motor, false], ['conducida', 'fc', t.conducida, true]].forEach(function (f) {
        if (!f[2]) return;
        var pts = f[2].map(function (n) {
          var fn = nombreFichero(n, bi, f[3]);
          for (var j = 0; j < sup.length; j++) if (sup[j] && sup[j].p === fn && num(sup[j].x) && num(sup[j].y)) return sup[j];
          return null;
        });
        out.push({ fila: f[0], px: f[1], nombres: f[2].slice(), pts: pts, mp: f[2].indexOf(f[3] ? 'MP-FC' : 'MP') });
      });
      return out;
    }

    /* Lo que no cuadra entre el fichero y el seguidor de su tipo: [{tipo, texto}], vacío si nada. */
    function chequeo(code) {
      var d = datos[code], fs = filas(code), av = [];
      if (!d || !fs.length) return av;
      if (!soportes || !soportes[code] || !soportes[code].length) return [{ tipo: 'sin', texto: 'Este seguidor no tiene soportes en el fichero de proyecto' }];
      fs.forEach(function (r) {
        var F = 'Fila ' + r.fila, falta = r.pts.filter(function (p) { return !p; }).length;
        if (falta) { av.push({ tipo: 'faltan', texto: F + ': ' + falta + (falta > 1 ? ' soportes no están' : ' soporte no está') + ' en el fichero' }); return; }
        var a = r.pts[0], b = r.pts[r.pts.length - 1], L = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)), dev = 0;
        r.pts.forEach(function (p) { var e = L > 0 ? Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / L : 0; if (e > dev) dev = e; });
        if (dev > RECTA_M) av.push({ tipo: 'recta', texto: F + ': sus soportes no están en línea (uno se aparta ' + m2(dev) + ' m)' });
        for (var k = 0; k + 1 < r.pts.length; k++) {
          var t = tramo(d.type, k < r.mp ? k : k + 1);
          if (!t) continue;
          var g = dist3(r.pts[k], r.pts[k + 1]) * 1000;
          if (g < t.min || g > t.max) {
            av.push({ tipo: 'vano', texto: F + ': vano ' + r.nombres[k] + '→' + r.nombres[k + 1] + ' de ' + m2(g / 1000) + ' m (proyecto ' + m2(t.nom / 1000) + ' ± ' + m2((t.max - t.nom) / 1000) + ')' });
            break;
          }
        }
        if (L > 0 && a.y < b.y) av.push({ tipo: 'ns', texto: F + ': «' + r.nombres[0] + '» queda al sur de «' + r.nombres[r.nombres.length - 1] + '»' });
      });
      var mo = fs[0], co = fs[1];
      if (co && mo.mp >= 0 && co.mp >= 0 && mo.pts.every(Boolean) && co.pts.every(Boolean)) {
        var a2 = mo.pts[0], b2 = mo.pts[mo.pts.length - 1], L2 = Math.sqrt((b2.x - a2.x) * (b2.x - a2.x) + (b2.y - a2.y) * (b2.y - a2.y));
        if (L2 > 0) {
          var m = mo.pts[mo.mp], c = co.pts[co.mp], along = Math.abs(((c.x - m.x) * (b2.x - a2.x) + (c.y - m.y) * (b2.y - a2.y)) / L2);
          if (along > ENFRENTE_M) av.push({ tipo: 'enfrente', texto: 'Motora y cardán no están enfrentados (' + m2(along) + ' m a lo largo de la fila)' });
        }
      }
      var mot = mo.mp >= 0 ? mo.pts[mo.mp] : null;
      if (mot && num(d.mx) && num(d.my)) {
        var dm = Math.sqrt((mot.x - d.mx) * (mot.x - d.mx) + (mot.y - d.my) * (mot.y - d.my));
        if (dm > MOTORA_M) av.push({ tipo: 'motora', texto: 'La motora del fichero de soportes está a ' + m2(dm) + ' m de donde la pone el de seguidores' });
      }
      return av;
    }

    function plegada() {
      try { return !!almacen && almacen.getItem(CLAVE_PLEGADA) === '1'; } catch (e) { return false; }
    }
    function plegar(si) {
      try { if (almacen) almacen.setItem(CLAVE_PLEGADA, si ? '1' : '0'); } catch (e) { /* sin almacén: se pliega sólo en esta pantalla */ }
    }

    /* o: estado(fila, i) → {clase: ok|no|parcial|vacio, texto}, sel {fila, i}, toca (nombre de función global). */
    function svg(code, o) {
      var d = datos[code], fs = filas(code), todos = [];
      fs.forEach(function (r) { r.pts.forEach(function (p, i) { if (p) todos.push({ r: r, i: i, p: p }); }); });
      if (!todos.length) { ultimo = null; return '<div style="padding:10px;font-size:12px;color:var(--td)">Sin coordenadas de soportes para este seguidor.</div>'; }
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      todos.forEach(function (t) { x0 = Math.min(x0, t.p.x); x1 = Math.max(x1, t.p.x); y0 = Math.min(y0, t.p.y); y1 = Math.max(y1, t.p.y); });
      x0 -= MARGEN_X; x1 += MARGEN_X; y0 -= MARGEN_Y; y1 += MARGEN_Y;
      var k = Math.min(ANCHO / (x1 - x0), ALTO_MAX / (y1 - y0)), W = ANCHO, H = Math.round((y1 - y0) * k), ox = (W - (x1 - x0) * k) / 2;
      function X(x) { return ox + (x - x0) * k; }
      function Y(y) { return (y1 - y) * k; }
      ultimo = { code: code, X: X, Y: Y, k: k, W: W, H: H, sups: todos.map(function (t) { return t.p; }) };
      var s = '<svg id="va-svg" data-codigo="' + esc(code) + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Vista aérea de ' + esc(code) + '" style="display:block;background:var(--bg);border-radius:4px;touch-action:manipulation;font-family:var(--sans)">';
      // Soportes de otros seguidores que caen en el encuadre.
      if (soportes) Object.keys(soportes).forEach(function (c2) {
        if (c2 === code) return;
        (soportes[c2] || []).forEach(function (q) {
          if (q && num(q.x) && num(q.y) && q.x > x0 && q.x < x1 && q.y > y0 && q.y < y1) s += '<circle class="va-vecino" cx="' + f1(X(q.x)) + '" cy="' + f1(Y(q.y)) + '" r="2.2" fill="#3A5272"/>';
        });
      });
      // Cada fila une sus soportes en el orden de sus nombres, tal como los da el fichero.
      fs.forEach(function (r) {
        var pp = r.pts.filter(Boolean).map(function (p) { return f1(X(p.x)) + ',' + f1(Y(p.y)); }).join(' ');
        if (pp) s += '<polyline points="' + pp + '" fill="none" stroke="#8C9AAB" stroke-width="2" stroke-opacity=".55"/>';
      });
      todos.forEach(function (t) {
        var e = (o && o.estado ? o.estado(t.r.fila, t.i) : null) || { clase: 'vacio', texto: '' };
        var col = COLOR[e.clase] || 'none', borde = COLOR[e.clase] || 'var(--td)', cx = f1(X(t.p.x)), cy = f1(Y(t.p.y));
        var sel = o && o.sel && o.sel.fila === t.r.fila && o.sel.i === t.i, nombre = t.r.nombres[t.i], izq = t.r.fila === 'motor';
        var accion = o && o.toca ? o.toca + '(\'' + t.r.fila + '\',' + t.i + ')' : '';
        s += '<g class="va-sop" data-fila="' + t.r.fila + '" data-i="' + t.i + '" data-clase="' + esc(e.clase) + '"' + (sel ? ' data-sel="1"' : '') +
          (accion ? ' role="button" tabindex="0" onclick="' + accion + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' + accion + '}"' : '') +
          ' aria-label="' + esc(nombre + (e.texto ? ': ' + e.texto : '')) + '" style="cursor:pointer">';
        s += '<title>' + esc(nombre + (e.texto ? ' · ' + e.texto : '')) + '</title>';
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="14" fill="transparent" style="pointer-events:all"/>';
        if (sel) s += '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="none" stroke="var(--ac)" stroke-width="2.5"/>';
        if (t.i === t.r.mp) s += '<rect x="' + f1(X(t.p.x) - 6) + '" y="' + f1(Y(t.p.y) - 6) + '" width="12" height="12" style="fill:' + col + ';stroke:' + borde + '" stroke-width="2"' + (t.r.fila === 'conducida' ? ' transform="rotate(45 ' + cx + ' ' + cy + ')"' : '') + '/>';
        else s += '<circle cx="' + cx + '" cy="' + cy + '" r="5.5" style="fill:' + col + ';stroke:' + borde + '" stroke-width="2"/>';
        s += '<text x="' + f1(X(t.p.x) + (izq ? -10 : 10)) + '" y="' + f1(Y(t.p.y) + 3.5) + '" font-size="10.5" font-weight="600" text-anchor="' + (izq ? 'end' : 'start') + '" style="fill:' + (sel ? 'var(--ac)' : 'var(--tx)') + ';stroke:var(--bg)" stroke-width="3" paint-order="stroke">' + esc(nombre) + '</text></g>';
      });
      s += '<g id="va-gps"></g>';
      s += '<g transform="translate(' + (W - 22) + ',26)"><path d="M0,-15 L6,4 L0,0 L-6,4 Z" style="fill:var(--tx)"/><text y="16" font-size="11" font-weight="700" text-anchor="middle" style="fill:var(--tx)">N</text></g>';
      s += '<g transform="translate(12,' + (H - 14) + ')"><rect width="' + f1(10 * k) + '" height="4" style="fill:var(--tx)"/><text y="-4" font-size="10" style="fill:var(--tx)">10 m</text></g>';
      return s + '</svg>';
    }

    /* La tarjeta entera. o: lo de svg() más leyenda [[clase, texto]…] y pliega (nombre de función global).
     * Devuelve '' si la planta no tiene fichero de soportes o el seguidor no existe. */
    function tarjeta(code, o) {
      var d = datos[code];
      if (!soportes || !d || !tipos[d.type]) return '';
      var av = chequeo(code), pleg = plegada(), cf = CONF[d.conf] || null;
      var h = '<div class="card" id="va-card" style="padding:12px">';
      h += '<button type="button" id="va-cab" onclick="' + o.pliega + '()" aria-expanded="' + (pleg ? 'false' : 'true') + '" style="display:flex;width:100%;align-items:center;gap:8px;background:none;border:none;padding:0;color:var(--tx);cursor:pointer;font-family:inherit;text-align:left">' +
        '<span style="font-weight:700;font-size:14px">🛰️ Vista aérea</span>' +
        (av.length ? '<span id="va-badge" style="font-size:11px;font-weight:600;color:var(--warn)">⚠️ el fichero no cuadra</span>' :
          cf ? '<span id="va-conf-badge" data-conf="' + esc(d.conf) + '" style="font-size:11px;font-weight:600;color:' + cf.color + '">' + esc(cf.badge) + '</span>' : '') +
        '<span style="margin-left:auto;color:var(--td);font-size:13px">' + (pleg ? '▸' : '▾') + '</span></button>';
      if (!pleg) {
        h += '<div style="font-size:10.5px;color:var(--td);margin:4px 0 8px">Toca un soporte para abrirlo</div>';
        h += svg(code, o);
        var it = function (marca, txt) { return '<span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap">' + marca + esc(txt) + '</span>'; };
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px;font-size:10.5px;color:var(--td)">';
        (o.leyenda || []).forEach(function (l) { h += it(l[0] === 'vacio' ? '○' : '<span style="color:' + COLOR[l[0]] + '">●</span>', l[1]); });
        h += it('■', 'Motora') + it('◆', 'Cardán') + it('<span style="color:var(--info)">●</span>', 'Tú (GPS)') + it('<span style="color:#3A5272">●</span>', 'Vecinos') + '</div>';
        h += '<div id="va-gps-txt" style="font-size:11px;color:var(--info);margin-top:4px"></div>';
        if (cf) h += '<div id="va-confianza" role="note" data-conf="' + esc(d.conf) + '" style="margin-top:8px;padding:8px 10px;border-radius:4px;background:' + cf.fondo + ';border:1px solid ' + cf.color + ';color:' + cf.color + ';font-size:11.5px;line-height:1.45">' + esc(cf.texto(code)) + '</div>';
        if (av.length) {
          h += '<div id="va-aviso" role="note" style="margin-top:8px;padding:8px 10px;border-radius:4px;background:rgba(242,201,76,.1);border:1px solid var(--warn);color:var(--warn);font-size:11.5px;line-height:1.45">' +
            '<b>⚠️ El fichero de proyecto no cuadra con un ' + esc(d.type.replace(/_/g, ' ')) + '</b>';
          av.forEach(function (x) { h += '<br>· ' + esc(x.texto); });
          h += '<br><span style="color:var(--td)">Lo dibujado es lo que dice el fichero. La ficha de cada soporte, el aviso GPS y el Excel de alturas salen de él: compruébalos con el plano.</span></div>';
        }
      }
      return h + '</div>';
    }

    /* Pone la posición GPS sobre el último dibujo, si sigue en pantalla. Fuera del encuadre, dice a cuánto está. */
    function ponGps(lat, lng, acc) {
      if (!ultimo || !num(lat) || !num(lng) || typeof document === 'undefined') return;
      var el = document.getElementById('va-svg'), g = document.getElementById('va-gps'), txt = document.getElementById('va-gps-txt');
      if (!el || !g || el.getAttribute('data-codigo') !== ultimo.code) return;
      var u = llToUtm(lat, lng), X = ultimo.X(u.x), Y = ultimo.Y(u.y), r = num(acc) && acc > 0 ? acc * ultimo.k : 0;
      if (X >= 0 && X <= ultimo.W && Y >= 0 && Y <= ultimo.H) {
        g.innerHTML = (r ? '<circle cx="' + f1(X) + '" cy="' + f1(Y) + '" r="' + f1(r) + '" style="fill:var(--info);stroke:var(--info)" fill-opacity=".15" stroke-opacity=".5"/>' : '') +
          '<circle id="va-tu" cx="' + f1(X) + '" cy="' + f1(Y) + '" r="5" style="fill:var(--info)" stroke="#fff" stroke-width="2"/>';
        if (txt) txt.textContent = num(acc) ? 'GPS ± ' + Math.round(acc) + ' m' : '';
      } else {
        g.innerHTML = '';
        var dmin = Infinity;
        ultimo.sups.forEach(function (p) { var dd = Math.sqrt((p.x - u.x) * (p.x - u.x) + (p.y - u.y) * (p.y - u.y)); if (dd < dmin) dmin = dd; });
        if (txt) txt.textContent = '📍 Estás a ' + (dmin < 1000 ? Math.round(dmin) + ' m' : (dmin / 1000).toFixed(1).replace('.', ',') + ' km') + ' del seguidor';
      }
    }

    return { filas: filas, chequeo: chequeo, svg: svg, tarjeta: tarjeta, ponGps: ponGps, plegada: plegada, plegar: plegar };
  }

  global.VistaAerea = { crear: crear, llToUtm: llToUtm, nombreFichero: nombreFichero };
})(typeof window !== 'undefined' ? window : globalThis);
