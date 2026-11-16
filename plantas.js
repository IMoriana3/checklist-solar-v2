/* Perfiles de planta de la app de control de obra (multiplanta, B2.1).
 *
 * Cada planta declara aquí lo que hasta ahora estaba escrito a mano para Atalaya dentro de
 * index.html: nombre y marca, plan de obra, dónde viven sus datos en Firebase y CUÁNTOS SOPORTES
 * tiene cada tipo de seguidor.
 *
 * Reglas (decisiones del propietario, 16/11/2026):
 *  · Lo que una planta no declara, la app no lo inventa. Sin soportes por tipo de seguidor la app
 *    NO abre la planta: «no tenemos info del número de soportes del resto de proyectos».
 *  · Atalaya guarda sus datos en la RAÍZ de la base desde el principio (legado). No se mueven:
 *    para Atalaya la app lee y escribe exactamente las mismas rutas que antes.
 *  · Cualquier otra planta escribe SOLO bajo «plantas/<id>/». Así una planta nueva no puede pisar
 *    los datos de Atalaya ni de otra planta. Los perfiles de usuario («users/…») son comunes.
 *  · Selección con ?planta=<id>. Sin parámetro, Atalaya (las URL de hoy siguen funcionando).
 *    Una planta desconocida NO cae en Atalaya: la app se para antes de tocar la base.
 *  · Las plantillas de Excel son de la obra: llevan dentro su proyecto, cliente, tolerancias y firmas.
 *    Una planta sin plantillas no exporta Excel; nunca se le ponen las de otra (B3, 16/11/2026).
 */
(function (global) {
  'use strict';

  var PLANTAS = {
    atalaya: {
      id: 'atalaya',
      nombre: 'ISFV ATALAYA',
      marca: 'XAMAI · X-ELIO',
      piePdf: 'XAMAI / X-ELIO',
      empresa: 'Xamai Global',
      codigoExport: 'ATALAYA',
      nombreCorto: 'ATALAYA',
      logoAlt: 'Xamai',
      // Logo del cliente tal como estaba incrustado en index.html (tres sitios, mismo fichero).
      logo: 'data:image/jpeg;base64,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',
      prefijoDatos: '',
      legadoRaiz: true,
      datos: { seguidores: 'master.js', soportes: 'master_con.js' },
      plan: { inicio: '2025-06-02', fin: '2026-09-15' },
      // Plantillas de Excel de la obra (dicen ISFV ATALAYA, X-ELIO, Villena y las firmas de Eiffage y X-Elio).
      // Las de una planta nueva van en templates/<id>/; null = esa exportación no existe para la planta.
      plantillas: { alturas: 'templates/plantilla_alturas.xlsx', checklist: 'templates/plantilla_checklist.xlsx' },
      // Soportes (pilares) por tipo de seguidor, tal como los fijó la v1 del checklist de Atalaya.
      soportesPorTipo: {
        monofila_corto: { motor: ['2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP'], conducida: null },
        monofila_largo: { motor: ['4N-MP', '3N-MP', '2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP', '3S-MP', '4S-MP'], conducida: null },
        bifila_corto: { motor: ['2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP'], conducida: ['2N', '1N', 'MP-FC', '1S', '2S'] },
        bifila_largo: { motor: ['4N-MP', '3N-MP', '2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP', '3S-MP', '4S-MP'], conducida: ['4N', '3N', '2N', '1N', 'MP-FC', '1S', '2S', '3S', '4S'] }
      }
    }
  };

  var FECHA = /^\d{4}-\d{2}-\d{2}$/;
  var MSG_SOPORTES = 'faltan los soportes por tipo de seguidor: sin ellos la app no puede llevar la obra pilar a pilar sin inventarlos';

  function texto(v) { return typeof v === 'string' && v.trim() !== ''; }
  function listaTextos(v) { return Array.isArray(v) && v.length > 0 && v.every(texto); }

  /* Lo que impide abrir una planta. Lista vacía = se puede abrir. */
  function problemas(p) {
    var out = [];
    if (!p || typeof p !== 'object') return ['perfil vacío'];
    if (!/^[a-z0-9-]+$/.test(p.id || '')) out.push('id inválido');
    ['nombre', 'nombreCorto', 'marca', 'piePdf', 'empresa', 'codigoExport', 'logoAlt'].forEach(function (k) { if (!texto(p[k])) out.push('falta «' + k + '»'); });
    if (p.legadoRaiz === true) {
      if (p.prefijoDatos !== '') out.push('una planta de legado escribe en la raíz: prefijoDatos debe ser ""');
    } else if (p.prefijoDatos !== 'plantas/' + p.id + '/') {
      out.push('prefijoDatos debe ser "plantas/' + p.id + '/"');
    }
    if (!/^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(p.logo || '')) out.push('logo inválido');
    if (!p.datos || !texto(p.datos.seguidores)) out.push('falta el fichero de seguidores');
    if (!p.plan || !FECHA.test(p.plan.inicio || '') || !FECHA.test(p.plan.fin || '') || p.plan.inicio > p.plan.fin) out.push('plan de obra inválido');
    var pl = p.plantillas, dirPl = p.legadoRaiz === true ? 'templates/' : 'templates/' + p.id + '/';
    function plantillaValida(v) { return v === null || (texto(v) && v.indexOf(dirPl) === 0 && /^[^\/]+\.xlsx$/.test(v.slice(dirPl.length))); }
    if (pl === undefined) out.push('faltan las «plantillas» de Excel de la obra (null si no tiene; nunca las de otra)');
    else if (pl !== null && !(typeof pl === 'object' && plantillaValida(pl.alturas) && plantillaValida(pl.checklist))) out.push('plantillas inválidas: alturas y checklist, cada una null o un .xlsx en ' + dirPl);
    var spt = p.soportesPorTipo;
    if (!spt || typeof spt !== 'object' || !Object.keys(spt).length) out.push(MSG_SOPORTES);
    else Object.keys(spt).forEach(function (t) {
      var c = spt[t];
      if (!c || !listaTextos(c.motor) || !(c.conducida === null || listaTextos(c.conducida))) out.push('soportes del tipo «' + t + '» incompletos');
    });
    return out;
  }

  function elegir(search) {
    var id = 'atalaya';
    var m = /(?:^|[?&])planta=([^&]*)/.exec(search || '');
    if (m) id = decodeURIComponent(m[1]);
    var p = Object.prototype.hasOwnProperty.call(PLANTAS, id) ? PLANTAS[id] : null;
    return { id: id, planta: p, problemas: p ? problemas(p) : ['planta desconocida: «' + id + '»'] };
  }

  /* La base vista desde una planta: misma interfaz que firebase.database() en lo que usa la app (ref). */
  function dbDePlanta(raw, planta) {
    var pre = planta.prefijoDatos;
    function comun(p) { return p.charAt(0) === '.' || p === 'users' || p.indexOf('users/') === 0; }
    function ruta(p) { return (pre === '' || comun(p)) ? p : pre + p; }
    return {
      ref: function (p) {
        if (p === undefined || p === null || p === '') return pre === '' ? raw.ref() : raw.ref(pre.slice(0, -1));
        return raw.ref(ruta(p));
      },
      ruta: ruta
    };
  }

  /* 1756 → «1.756» siempre (toLocaleString('es-ES') no agrupa los números de cuatro cifras). */
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* Texto de un perfil dentro de HTML construido con cadenas. */
  function html(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  global.PLANTAS = PLANTAS;
  global.PlantasObra = { elegir: elegir, problemas: problemas, dbDePlanta: dbDePlanta, miles: miles, html: html };

  var e = elegir(global.location ? global.location.search : '');
  global.PLANTA = e.problemas.length ? null : e.planta;
  global.PLANTA_ERROR = e.problemas;
  // Datos de la planta elegida, en el mismo orden y de forma síncrona, como antes las etiquetas fijas.
  if (global.PLANTA && global.document && typeof global.document.write === 'function') {
    global.document.write('<script src="' + global.PLANTA.datos.seguidores + '"><\/script>');
    if (global.PLANTA.datos.soportes) global.document.write('<script src="' + global.PLANTA.datos.soportes + '"><\/script>');
  }
})(typeof window !== 'undefined' ? window : globalThis);
