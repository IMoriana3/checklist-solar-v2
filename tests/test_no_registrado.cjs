/* Banco de B3: lo que nadie ha registrado no se presenta como registrado (auditoría Construct F0, H-05).
 *  1. Pantalla de calidad, en edición y en sólo lectura: en comprobaciones, montaje y módulos, lo no
 *     registrado no tiene ninguna opción marcada y dice «sin rellenar»; lo registrado sale marcado.
 *  2. Excel de checklist: cada hoja lleva sólo lo registrado de su seguidor. La plantilla es un checklist
 *     ya relleno (seguidor 3 de PV14/02) y antes sus valores salían en lo que nadie había medido.
 *  3. Excel de alturas: sin altura medida no se calculan profundidad de hincado ni % de hincado.
 *  4. Una planta sin plantillas de Excel no exporta: la plantilla de otra obra lleva su proyecto, su
 *     cliente y sus firmas.
 * Firebase es un doble de prueba (sin red ni datos reales); JSZip es el mismo 3.10.1 que carga la app.
 * Uso: node tests/test_no_registrado.cjs
 */
const fs = require('fs');
const path = require('path');
const { abrirApp, conPerfil, PLANTA_DEMO, MASTER_DEMO } = require('./arnes_navegador.cjs');

const RAIZ = path.join(__dirname, '..');
const JSZIP_URL = 'jszip/3.10.1/jszip.min.js';
const JSZIP = fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'), 'utf8');
let ok = 0, fallos = 0;
function check(nombre, cond, detalle) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre + (detalle ? '\n  ' + detalle : '')); } }

// Seguidor TR01.001 (bifila corto, PV1): pocas cosas registradas, el resto sin tocar.
const REGISTRADO = {
  fm_0_altura: 1111,
  fm_0_galvanizado: 'NO', // comprobación registrada con un valor distinto del esperado
  fm_0_golpes: 'NO', // registrada con el valor esperado
  mont_ms_par: 'NO', mont_ms_sup: 'SI',
  mod_mod_disp_vigas: 'SI', mod_mod_union_sb: 'NO'
};
const SEMILLA = { quality: { TR01_001: REGISTRADO } };

/* En la página: para cada {k, label}, qué opciones salen marcadas, si dice «sin rellenar» y su aria-pressed. */
function leerFilas(items) {
  const divs = Array.from(document.querySelectorAll('div'));
  return items.map(({ k, label }) => {
    const el = divs.find((d) => d.firstChild && d.firstChild.nodeType === 3 && d.firstChild.textContent.trim() === label);
    if (!el) return { k, encontrada: false };
    const fila = el.parentElement;
    const botones = Array.from(fila.querySelectorAll('button'));
    const marcada = (b) => /border:\s*\d+px solid var\(--(ok|no)\)/.test(b.getAttribute('style') || '');
    return {
      k, encontrada: true,
      marcadas: botones.filter(marcada).map((b) => b.textContent.trim()),
      ariaCoincide: botones.every((b) => b.getAttribute('aria-pressed') === String(marcada(b))),
      sinRellenar: /sin rellenar/.test(fila.textContent)
    };
  });
}

/* En la página: lee un .xlsx (Blob) y devuelve {nombreHoja: {celda: {v, f}}} con las cadenas compartidas resueltas. */
const LEER_XLSX = `window.__leerXlsx = async function (blob) {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const zip = await JSZip.loadAsync(blob); const p = new DOMParser();
  const xml = async (n) => p.parseFromString(await zip.file(n).async('string'), 'application/xml');
  const wb = await xml('xl/workbook.xml'); const rels = await xml('xl/_rels/workbook.xml.rels');
  const ss = [];
  if (zip.file('xl/sharedStrings.xml')) {
    const d = await xml('xl/sharedStrings.xml');
    for (const si of Array.from(d.getElementsByTagNameNS(NS, 'si'))) ss.push(Array.from(si.getElementsByTagNameNS(NS, 't')).map((t) => t.textContent).join(''));
  }
  const hojas = {};
  for (const sh of Array.from(wb.getElementsByTagNameNS(NS, 'sheet'))) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === sh.getAttribute('r:id'));
    const d = await xml('xl/' + rel.getAttribute('Target').replace(/^\\/?xl\\//, ''));
    const celdas = {};
    for (const c of Array.from(d.getElementsByTagNameNS(NS, 'c'))) {
      const v = c.getElementsByTagNameNS(NS, 'v')[0], f = c.getElementsByTagNameNS(NS, 'f')[0];
      if (!v && !f) continue;
      celdas[c.getAttribute('r')] = { v: v ? (c.getAttribute('t') === 's' ? ss[+v.textContent] : v.textContent) : null, f: f ? f.textContent : null };
    }
    hojas[sh.getAttribute('name')] = celdas;
  }
  return hojas;
};`;

/* En la página: lanza una exportación, se queda con el fichero en vez de descargarlo y lo lee. */
async function exportar(page, llamada) {
  return page.evaluate(async (llamada) => {
    window.__DESCARGA = null;
    window.dlBlob = function (blob, name) { window.__DESCARGA = { blob, name }; };
    (new Function(llamada))();
    for (let i = 0; i < 150 && !window.__DESCARGA; i++) await new Promise((r) => setTimeout(r, 100));
    if (!window.__DESCARGA) return null;
    return { nombre: window.__DESCARGA.name, hojas: await window.__leerXlsx(window.__DESCARGA.blob) };
  }, llamada);
}

const col = (n) => String.fromCharCode(64 + n);
// Zonas de datos del checklist: mediciones y comprobaciones de fila motora y conducida, columnas F..P.
const FILAS_DATOS = [[31, 37], [39, 54], [57, 63], [65, 80]];
function celdasDeDatos(celdas) {
  const out = {};
  for (const [a, b] of FILAS_DATOS) for (let r = a; r <= b; r++) for (let c = 6; c <= 16; c++) {
    const x = celdas[col(c) + r]; if (x && (x.v != null || x.f != null)) out[col(c) + r] = x.v != null ? x.v : '=' + x.f;
  }
  return out;
}

(async () => {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  check('la app carga JSZip 3.10.1, el mismo que usa este banco', html.includes(JSZIP_URL));

  const app = await abrirApp({ semilla: SEMILLA, libs: { [JSZIP_URL]: JSZIP } });
  const { page } = app;
  try {
    await page.evaluate(LEER_XLSX);
    const items = await page.evaluate(() => ({
      comp: COMP.map((f) => ({ k: 'fm_0_' + f.id, label: f.label })),
      mont: MONT_ITEMS.map((f) => ({ k: 'mont_' + f.id, label: f.label })),
      mod: MOD_ITEMS.map((f) => ({ k: 'mod_' + f.id, label: f.label }))
    }));

    // 1 · Pantalla de calidad, pestañas de cimentaciones (comprobaciones del pilar 0), montaje y módulos
    for (const viewOnly of [false, true]) {
      for (const [tab, lista] of [['cim', items.comp], ['mont', items.mont], ['mod', items.mod]]) {
        await page.evaluate(({ viewOnly, tab }) => {
          Object.assign(V, { calTr: 'TR01.001', conTr: 'TR01.001', viewOnly, qTab: tab, qFila: 'motor', qPi: 0 });
          V.screen = 'qualtracker'; R();
        }, { viewOnly, tab });
        await page.waitForTimeout(200);
        const filas = await page.evaluate(leerFilas, lista);
        const modo = (viewOnly ? 'sólo lectura' : 'edición') + ' · ' + tab;
        const reg = filas.filter((f) => REGISTRADO[f.k] != null), noReg = filas.filter((f) => REGISTRADO[f.k] == null);
        check(modo + ': encuentra todas las filas y hay registradas y sin registrar', filas.every((f) => f.encontrada) && reg.length >= 1 && noReg.length >= 10,
          JSON.stringify(filas.filter((f) => !f.encontrada).map((f) => f.k)));
        check(modo + ': lo registrado sale marcado con su valor y sin «sin rellenar»',
          reg.every((f) => f.marcadas.length === 1 && f.marcadas[0] === REGISTRADO[f.k] && !f.sinRellenar), JSON.stringify(reg));
        const malas = noReg.filter((f) => f.marcadas.length !== 0 || !f.sinRellenar);
        check(modo + ': lo no registrado no tiene nada marcado y dice «sin rellenar»', malas.length === 0,
          malas.length + ' de ' + noReg.length + ', p. ej. ' + JSON.stringify(malas.slice(0, 2)));
        check(modo + ': aria-pressed dice lo mismo que se ve', filas.every((f) => f.ariaCoincide));
      }
    }

    // 2 · Excel de checklist de PV1 (52 seguidores; sólo TR01.001 tiene datos)
    const chk = await exportar(page, 'exportChecklist(1, 0)');
    check('checklist: se genera', chk && /_CHECKLIST_PV_01_SUBCAMPO_ALL\.xlsx$/.test(chk.nombre), JSON.stringify(chk && chk.nombre));
    if (chk) {
      const nombres = Object.keys(chk.hojas);
      check('checklist: una hoja por seguidor de PV1', nombres.length === 52, String(nombres.length));
      const h1 = celdasDeDatos(chk.hojas['1'] || {});
      // TR01.001 es bifila corto: pilar 0 = columna I. Altura en la fila 31, galvanizado 39, golpes 40.
      const esperado = { I31: '1111', I39: 'NO', I40: 'NO' };
      check('checklist · seguidor 1: lleva lo registrado', Object.keys(esperado).every((c) => h1[c] === esperado[c]), JSON.stringify(h1));
      const sobra = Object.keys(h1).filter((c) => !(c in esperado));
      check('checklist · seguidor 1: nada más que lo registrado (ni valores de la plantilla)', sobra.length === 0,
        sobra.length + ' celdas, p. ej. ' + sobra.slice(0, 6).map((c) => c + '=' + h1[c]).join(' '));
      const otras = nombres.filter((n) => n !== '1').filter((n) => Object.keys(celdasDeDatos(chk.hojas[n])).length > 0);
      check('checklist · los otros 51 seguidores, sin datos: hojas vacías', otras.length === 0, otras.length + ' hojas con valores, p. ej. ' + otras.slice(0, 5).join(', '));
      const c1 = chk.hojas['1'] || {};
      check('checklist · seguidor 1: cabecera con su PV y su número', c1.C4 && c1.C4.v === '1/00/' && c1.C5 && c1.C5.v === '1', JSON.stringify([c1.C4, c1.C5]));
    }

    // 3 · Excel de alturas de PV1
    const alt = await exportar(page, 'exportAlturas(1, 0)');
    check('alturas: se genera', alt && /PV_01-ALL\.xlsx$/.test(alt.nombre), JSON.stringify(alt && alt.nombre));
    if (alt) {
      const lista = alt.hojas[Object.keys(alt.hojas).find((n) => n.trim() === 'List')] || {};
      const filas = [...new Set(Object.keys(lista).map((c) => +c.replace(/^[A-Z]+/, '')).filter((r) => r >= 16))].sort((a, b) => a - b);
      const soportes = await page.evaluate(() => Object.keys(MASTER_DATA).filter((c) => MASTER_DATA[c].pv === 1)
        .reduce((n, c) => { const k = PCFG[MASTER_DATA[c].type]; return n + k.motor.length + (k.conducida ? k.conducida.length : 0); }, 0));
      const conAltura = filas.filter((r) => lista['G' + r] && lista['G' + r].v != null);
      check('alturas: una fila por soporte de PV1 y sólo la medida tiene altura', filas.length === soportes && conAltura.length === 1 && lista['G' + conAltura[0]].v === '1111',
        filas.length + ' filas de ' + soportes + ' soportes, con altura: ' + JSON.stringify(conAltura));
      check('alturas: no queda ninguna fila de ejemplo de la plantilla (PV 14/2)', filas.every((r) => !(lista['C' + r] && lista['C' + r].v === '14/2')));
      const sinGuarda = filas.filter((r) => !(lista['K' + r] && lista['K' + r].f === 'IF(G' + r + '="","",J' + r + '-G' + r + ')') ||
        !(lista['M' + r] && lista['M' + r].f === 'IF(K' + r + '="","",K' + r + '/L' + r + ')'));
      check('alturas: profundidad y % de hincado quedan vacíos mientras no haya altura', sinGuarda.length === 0,
        sinGuarda.length + ' filas, p. ej. fila ' + sinGuarda[0] + ': K=' + JSON.stringify(lista['K' + sinGuarda[0]]) + ' M=' + JSON.stringify(lista['M' + sinGuarda[0]]));
    }

    check('sin errores de página', app.errores.length === 0, JSON.stringify(app.errores));
  } finally {
    await app.cerrar();
  }

  // 4 · Planta sin plantillas de Excel
  const demo = await abrirApp({ query: '?planta=demo', extra: { '/plantas.js': conPerfil(PLANTA_DEMO), '/demo_master.js': MASTER_DEMO },
    libs: { [JSZIP_URL]: JSZIP } });
  try {
    await demo.page.evaluate(LEER_XLSX);
    const dialogo = await demo.page.evaluate(() => {
      showExportModal(); const m = document.getElementById('export-modal');
      const r = { texto: m.innerText, botones: Array.from(m.querySelectorAll('button')).map((b) => b.getAttribute('onclick') || '') };
      m.remove(); return r;
    });
    check('planta sin plantillas: el diálogo no ofrece los Excel y dice por qué',
      /DEMO no tiene plantilla de alturas/.test(dialogo.texto) && /DEMO no tiene plantilla de checklist/.test(dialogo.texto) &&
      !dialogo.botones.some((b) => /doExport(Alturas|Checklist)/.test(b)), JSON.stringify(dialogo));
    const intentos = [];
    for (const llamada of ['exportChecklist(1, 0)', 'exportAlturas(1, 0)']) {
      const r = await demo.page.evaluate(async (llamada) => {
        window.__DESCARGA = null; window.dlBlob = function (blob, name) { window.__DESCARGA = { name }; };
        (new Function(llamada))(); await new Promise((r) => setTimeout(r, 1500));
        return { descarga: window.__DESCARGA, aviso: document.getElementById('toast').textContent };
      }, llamada);
      intentos.push(r);
    }
    check('planta sin plantillas: aunque se llame a exportar, no sale ningún Excel y avisa',
      intentos.every((r) => r.descarga === null && /no tiene plantilla/.test(r.aviso)), JSON.stringify(intentos));
    check('planta sin plantillas: sin errores de página', demo.errores.length === 0, JSON.stringify(demo.errores));
  } finally {
    await demo.cerrar();
  }

  console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
  if (fallos || ok !== 39) process.exitCode = 1; // 1 + 6×4 + 6 + 4 + 1 + 3: si cambia, que sea a propósito
})().catch((e) => { console.error(e); process.exitCode = 1; });
