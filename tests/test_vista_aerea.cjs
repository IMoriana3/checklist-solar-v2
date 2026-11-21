/* Banco de la vista aérea de cada seguidor (vista_aerea.js; propietario, 18/11/2026: «Hazla ya con el
 * aviso incorporado»).
 *  1. El chequeo del fichero de soportes, en node, con seguidores sintéticos de forma conocida: uno bien
 *     formado no avisa (bifila y monofila, largo y corto) y cada defecto da su aviso y sólo el suyo
 *     («N» al sur, soporte fuera de línea, vano, cardán desplazado, motora movida, soportes que faltan,
 *     seguidor sin soportes). Sin fichero de soportes no hay tarjeta. El plegado se recuerda.
 *  2. Atalaya: con una muestra fija del fichero ANTERIOR, el chequeo sigue cazando sus defectos (TR01.015,
 *     TR01.016, TR01.048; auditoría en SolarGPTfull, docs/audit/OBRA-VISTA-AEREA__SolarGPTfull.md). Con el
 *     RECONSTRUIDO (18/11) no avisa ninguno y cada seguidor lleva su confianza (57 / 952 / 747).
 *  3. llToUtm frente a pyproj 3.7.2 / PROJ 9.5.1 (EPSG:32630 → EPSG:4326), a menos de 1 cm, y coherente
 *     con utmToLL de la app.
 *  4. En el navegador, con Firebase falso:
 *     - la tarjeta en Construcción y en Calidad › Cimentaciones, con el estado de cada soporte y el elegido;
 *     - la confianza del número (confirmado, pista, deducido) en la cabecera y en su nota, y en la ficha lo
 *       deducido de cada soporte (perfil, profundidades, posición);
 *     - tocar un soporte (o Intro) lo abre;
 *     - el aviso, y el plegado que se recuerda al volver a abrir;
 *     - el GPS emulado cae sobre el soporte, y lejos dice a cuánto está;
 *     - una planta sin fichero de soportes no enseña la tarjeta;
 *     - nada de esto escribe en la base.
 * Uso: node tests/test_vista_aerea.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { abrirApp, conPerfil, PLANTA_DEMO, MASTER_DEMO } = require('./arnes_navegador.cjs');

const RAIZ = path.join(__dirname, '..');
let ok = 0, fallos = 0;
function check(nombre, cond, detalle) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre + (detalle ? '\n  ' + detalle : '')); } }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// ── Contexto de node: el módulo, los vanos de la app (getTramoTol de index.html, sin copiarlos) y los datos.
const IDX = leer('index.html');
const TRAMOS = /var TRAMO_NOM=\{[\s\S]*?\nfunction getTramoTol\(type,piIdx\)\{[\s\S]*?\n\}/.exec(IDX);
if (!TRAMOS) { console.error('FALLA · no encuentro TRAMO_NOM/getTramoTol en index.html'); process.exit(1); }
function contexto(conDatos) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(TRAMOS[0] + '\nglobalThis.getTramoTol=getTramoTol;', ctx);
  vm.runInContext(leer('vista_aerea.js'), ctx);
  if (conDatos) {
    vm.runInContext(leer('master.js').replace('const MASTER_DATA', 'globalThis.MASTER_DATA'), ctx);
    vm.runInContext(leer('master_con.js').replace('const MASTER_CON', 'globalThis.MASTER_CON'), ctx);
    vm.runInContext(leer('plantas.js'), ctx);
  }
  return ctx;
}
const C = contexto(true);
const TIPOS = C.PLANTAS.atalaya.soportesPorTipo;
const tramo = C.getTramoTol;

/* Nombres del fichero de soportes, escritos aparte (tal como vienen en master_con.js) para no probar
 * la función de nombres con ella misma. */
const NOMBRES = {
  bifila: { motor: (n) => (n === 'MP' ? 'MOTORA-W' : n.replace('-MP', '') + 'W'), conducida: (n) => (n === 'MP-FC' ? 'CARDAN-E' : n + 'E') },
  monofila: { motor: (n) => (n === 'MP' ? 'MOTORA' : n.replace('-MP', '')) }
};
/* Un seguidor sintético con los vanos de proyecto de la app, filas a 4,5 m y «N» al norte. */
function sintetico(tipo, cambia) {
  const t = TIPOS[tipo], bi = !!t.conducida, vanos = [];
  const mp = t.motor.indexOf('MP');
  for (let k = 0; k + 1 < t.motor.length; k++) vanos.push(tramo(tipo, k < mp ? k : k + 1).nom / 1000);
  const largo = vanos.reduce((a, b) => a + b, 0), x0 = 700000, yN = 4300000 + largo;
  const fila = (nombres, dx, conducida) => {
    const nom = NOMBRES[bi ? 'bifila' : 'monofila'][conducida ? 'conducida' : 'motor'];
    let y = yN; return nombres.map((n, i) => { if (i) y -= vanos[i - 1]; return { p: nom(n), x: x0 + dx, y: y, z: 500, co: 501.5 }; });
  };
  const sup = fila(t.motor, 0, false).concat(bi ? fila(t.conducida, 4.5, true) : []);
  const mot = sup.find((s) => /^MOTORA/.test(s.p));
  const d = { pv: 1, num: 1, type: tipo, n: sup.length, mx: mot.x, my: mot.y, sub: 0 };
  if (cambia) cambia(sup, d);
  return { d, sup };
}
function va(datos, soportes, almacen) { return C.VistaAerea.crear({ datos, soportes, tipos: TIPOS, tramo, almacen }); }
function avisos(s) { return va({ T: s.d }, { T: s.sup }).chequeo('T').map((a) => a.tipo); }
const mueve = (nombre, dx, dy) => (sup) => { const s = sup.find((q) => q.p === nombre); s.x += dx; s.y += dy; };
// Da la vuelta N-S al seguidor alrededor de su centro (la motora se queda a ~1-2 cm, dentro de su tolerancia).
const alReves = (sup) => { const ys = sup.map((s) => s.y), c = (Math.max(...ys) + Math.min(...ys)) / 2; sup.forEach((s) => { s.y = 2 * c - s.y; }); };

// ── 1 · Seguidores sintéticos
for (const tipo of ['bifila_largo', 'bifila_corto', 'monofila_largo', 'monofila_corto']) {
  const s = sintetico(tipo);
  check(tipo + ' bien formado: ningún aviso (y sus nombres se encuentran en el fichero)', igual(avisos(s), []), JSON.stringify(avisos(s)));
}
const casos = [
  ['«N» al sur (filas al revés)', sintetico('bifila_largo', alReves), ['ns', 'ns']],
  ['un soporte 0,5 m fuera de línea', sintetico('bifila_largo', mueve('2NW', 0.5, 0)), ['recta']],
  ['un vano 50 mm largo', sintetico('bifila_largo', (sup) => { ['3SW', '4SW'].forEach((n) => { sup.find((q) => q.p === n).y -= 0.05; }); }), ['vano']],
  ['la fila conducida 1 m corrida a lo largo', sintetico('bifila_largo', (sup) => { sup.filter((q) => /E$/.test(q.p)).forEach((q) => { q.y += 1; }); }), ['enfrente']],
  ['la motora de master.js a 0,2 m', sintetico('bifila_largo', (sup, d) => { d.mx += 0.2; }), ['motora']],
  ['dos soportes de la conducida no están en el fichero', sintetico('bifila_largo', (sup) => { sup.splice(sup.findIndex((q) => q.p === '3SE'), 2); }), ['faltan']],
  ['monofila corto con «N» al sur', sintetico('monofila_corto', alReves), ['ns']]
];
for (const [nombre, s, esperado] of casos) check('aviso de «' + nombre + '»: sólo ' + JSON.stringify(esperado), igual(avisos(s), esperado), JSON.stringify(avisos(s)));
{
  const s = sintetico('bifila_corto');
  check('seguidor sin soportes en el fichero: lo dice', igual(va({ T: s.d }, { OTRO: s.sup }).chequeo('T').map((a) => a.tipo), ['sin']));
  check('planta sin fichero de soportes: no hay tarjeta', va({ T: s.d }, null).tarjeta('T', { pliega: 'p' }) === '');
  const mem = {}; const almacen = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const v = va({ T: s.d }, { T: s.sup }, almacen);
  const abierta = v.tarjeta('T', { pliega: 'p', leyenda: [] });
  v.plegar(true);
  const cerrada = v.tarjeta('T', { pliega: 'p', leyenda: [] });
  check('plegada: la tarjeta abierta dibuja y la plegada no, y se recuerda en el almacén',
    abierta.includes('<svg') && !cerrada.includes('<svg') && v.plegada() === true && mem['vistaAerea.plegada'] === '1');
  const roto = { getItem: () => { throw new Error('modo privado'); }, setItem: () => { throw new Error('modo privado'); } };
  let sinError = true; try { const v2 = va({ T: s.d }, { T: s.sup }, roto); v2.plegar(true); sinError = v2.plegada() === false; } catch (e) { sinError = false; }
  check('sin almacén (modo privado): ni falla ni se queda plegada', sinError);
  const svg = v.svg('T', { estado: (f, i) => ({ clase: i === 0 ? 'ok' : i === 1 ? 'no' : 'vacio', texto: 'x' }), sel: { fila: 'conducida', i: 2 }, toca: 'tocaPrueba' });
  const yDe = (f, i) => { const m = new RegExp('data-fila="' + f + '" data-i="' + i + '"[^>]*>[\\s\\S]*?<circle cx="[\\d.]+" cy="([\\d.]+)"').exec(svg); return m ? +m[1] : NaN; };
  check('SVG: 10 soportes, la motora como cuadrado, el cardán girado, el elegido marcado y sin NaN',
    (svg.match(/class="va-sop"/g) || []).length === 10 && (svg.match(/<rect x=/g) || []).length === 2 && /rotate\(45 /.test(svg) &&
    (svg.match(/data-sel="1"/g) || []).length === 1 && /data-fila="conducida" data-i="2"[^>]*data-sel="1"/.test(svg) && !svg.includes('NaN'));
  check('SVG: al norte arriba (el «2N» se dibuja más arriba que el «2S») y cada soporte llama a su función', yDe('motor', 0) < yDe('motor', 4) && svg.includes('onclick="tocaPrueba(\'conducida\',2)"'), yDe('motor', 0) + ' ' + yDe('motor', 4));
  check('SVG: el estado de cada soporte llega a su dibujo', /data-i="0" data-clase="ok"/.test(svg) && /data-i="1" data-clase="no"/.test(svg) && /data-i="2" data-clase="vacio"/.test(svg));
}

// ── 2 · Datos de Atalaya
// 2a · El fichero ANTERIOR (muestra fija de main ea9a38b): el chequeo tiene que seguir cazando sus defectos.
{
  const M = JSON.parse(leer('tests/fixtures/soportes_anteriores_muestra.json'));
  const v = va(M.datos, M.soportes);
  check('fichero anterior, TR01.015: sólo los «N» al sur, en las dos filas', igual(v.chequeo('TR01.015').map((a) => a.tipo), ['ns', 'ns']));
  check('fichero anterior, TR01.016: vano, N al sur, fila fuera de línea, vano y motora/cardán a 66 m', igual(v.chequeo('TR01.016').map((a) => a.tipo), ['vano', 'ns', 'recta', 'vano', 'enfrente']) &&
    v.chequeo('TR01.016').some((a) => a.texto.includes('66,26 m')));
  check('fichero anterior, monofila TR01.048: sus soportes se encuentran por su nombre («MOTORA», «4N»…)', !v.chequeo('TR01.048').some((a) => a.tipo === 'faltan') && v.filas('TR01.048')[0].pts.every(Boolean));
}
// 2b · El fichero RECONSTRUIDO (18/11/2026): ningún seguidor avisa y cada uno lleva la confianza de su número.
{
  const v = va(C.MASTER_DATA, C.MASTER_CON);
  const codes = Object.keys(C.MASTER_DATA), conAviso = codes.filter((c) => v.chequeo(c).length);
  check('Atalaya reconstruida: ninguno de los 1.756 seguidores avisa (forma, vanos, N al norte, motora)', codes.length === 1756 && conAviso.length === 0, conAviso.slice(0, 5).join(' '));
  const n = {}; codes.forEach((c) => { n[C.MASTER_DATA[c].conf] = (n[C.MASTER_DATA[c].conf] || 0) + 1; });
  check('confianza: 57 confirmados, 952 con pista y 747 deducidos (todos tienen una)', igual(n, { confirmado: 57, pista: 952, deducido: 747 }), JSON.stringify(n));
  check('TR01.015 confirmado, TR01.016 con pista, TR01.022 deducido', C.MASTER_DATA['TR01.015'].conf === 'confirmado' && C.MASTER_DATA['TR01.016'].conf === 'pista' && C.MASTER_DATA['TR01.022'].conf === 'deducido');
}

// ── 3 · Coordenadas
const PYPROJ = [ // pyproj 3.7.2 / PROJ 9.5.1, EPSG:32630 → EPSG:4326
  { x: 681306.44, y: 4273605.18, lat: 38.5924333297, lng: -0.9181863215 },
  { x: 680538.09, y: 4271884.35, lat: 38.5770919554, lng: -0.9274490643 },
  { x: 681928.59, y: 4272031.19, lat: 38.5781307165, lng: -0.9114578161 },
  { x: 500000.0, y: 4000000.0, lat: 36.1447180988, lng: -3.0 }
];
for (const r of PYPROJ) { const u = C.VistaAerea.llToUtm(r.lat, r.lng); const e = Math.hypot(u.x - r.x, u.y - r.y); check('llToUtm frente a pyproj en (' + r.x + ', ' + r.y + '): ' + e.toFixed(4) + ' m ≤ 0,01', e <= 0.01); }

// ── 4 · Estáticos: se carga y se guarda para abrir sin conexión
const SW = leer('sw.js');
check('el service worker guarda vista_aerea.js para abrir sin conexión', SW.includes("'./vista_aerea.js'"));
check('index.html carga vista_aerea.js después de cola.js y antes del código de la app',
  IDX.indexOf('<script src="cola.js"></script>') < IDX.indexOf('<script src="vista_aerea.js"></script>') &&
  IDX.indexOf('<script src="vista_aerea.js"></script>') < IDX.indexOf('firebase.initializeApp('));

// ── 5 · En el navegador
const est = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k + '_estado', v]));
const SEMILLA = {
  construction: { TR01_015: est({ fm_0: 'hincada', fm_1: 'hincada', fm_4: 'hincada', fm_6: 'rechazo', fc_0: 'hincada' }) },
  quality: { TR01_015: { fm_0_altura: 1500, fm_0_vert_ns: 95, fm_1_altura: 1490, fm_1_vert_ns: 120, fm_2_torsion: 'SI' } }
};
const pantalla = (page, screen, set) => page.evaluate(([s, x]) => { Object.assign(V, x); V.screen = s; R(); }, [screen, set]).then(() => page.waitForTimeout(350));
const leerVista = (page) => page.evaluate(() => {
  const sops = Array.from(document.querySelectorAll('#va-svg .va-sop'));
  const av = document.getElementById('va-aviso'), cab = document.getElementById('va-cab');
  return {
    tarjeta: !!document.getElementById('va-card'), svg: !!document.getElementById('va-svg'), codigo: (document.getElementById('va-svg') || { getAttribute: () => null }).getAttribute('data-codigo'),
    n: sops.length, clases: sops.map((g) => g.getAttribute('data-fila') + ':' + g.getAttribute('data-i') + ':' + g.getAttribute('data-clase')),
    sel: sops.filter((g) => g.getAttribute('data-sel') === '1').map((g) => g.getAttribute('data-fila') + ':' + g.getAttribute('data-i')),
    aviso: av ? av.textContent : null, badge: !!document.getElementById('va-badge'), expandida: cab ? cab.getAttribute('aria-expanded') : null,
    conf: (document.getElementById('va-confianza') || document.getElementById('va-conf-badge') || { getAttribute: () => null }).getAttribute('data-conf'),
    confBadge: (document.getElementById('va-conf-badge') || {}).textContent || null, confNota: (document.getElementById('va-confianza') || {}).textContent || null,
    escrituras: (window.__FB_LOG || []).filter((x) => /^(set|update|push|remove)$/.test(x.op)).length
  };
});
const cuenta = (clases, c) => clases.filter((x) => x.endsWith(':' + c)).length;

(async () => {
  const app = await abrirApp({ semilla: SEMILLA });
  try {
    const { page } = app;
    const errores0 = app.errores.length;
    const esc0 = (await leerVista(page)).escrituras;
    // Construcción
    await pantalla(page, 'contractor', { conTr: 'TR01.015', conPi: 4, conFila: 'motor', viewOnly: false });
    let r = await leerVista(page);
    check('Construcción: tarjeta con los 18 soportes de TR01.015', r.tarjeta && r.svg && r.codigo === 'TR01.015' && r.n === 18, JSON.stringify(r));
    check('Construcción: 4 hincados, 1 rechazo y 13 sin hincar, como la base', cuenta(r.clases, 'ok') === 4 && cuenta(r.clases, 'no') === 1 && cuenta(r.clases, 'vacio') === 13 &&
      r.clases.includes('motor:6:no') && r.clases.includes('conducida:0:ok'), JSON.stringify(r.clases));
    check('Construcción: el elegido es el de la pantalla (motora)', igual(r.sel, ['motor:4']), JSON.stringify(r.sel));
    check('Construcción, TR01.015: sin aviso de forma, marcado «✓ confirmado» y con su nota', !r.badge && r.aviso === null && r.conf === 'confirmado' && r.confBadge === '✓ confirmado' &&
      /^✓ Seguidor confirmado/.test(r.confNota || ''), JSON.stringify(r));
    await page.click('#va-svg .va-sop[data-fila="conducida"][data-i="2"]');
    await page.waitForTimeout(350);
    r = await leerVista(page);
    const vsel = await page.evaluate(() => [V.conFila, V.conPi]);
    check('tocar el «2N» de la conducida lo abre (fila y soporte) y queda marcado', igual(vsel, ['conducida', 2]) && igual(r.sel, ['conducida:2']), JSON.stringify([vsel, r.sel]));
    await page.focus('#va-svg .va-sop[data-fila="motor"][data-i="1"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    check('con el teclado (Intro) también se abre', igual(await page.evaluate(() => [V.conFila, V.conPi]), ['motor', 1]));
    await pantalla(page, 'contractor', { conTr: 'TR01.016', conPi: 4, conFila: 'motor' });
    r = await leerVista(page);
    check('TR01.016: «número deducido» y la nota de pista clara con su número', !r.badge && r.conf === 'pista' && r.confBadge === 'número deducido' &&
      /^Número deducido con pista clara/.test(r.confNota || '') && r.confNota.includes('TR01.016'), JSON.stringify(r));
    const ficha = await page.evaluate(() => Array.from(document.querySelectorAll('.va-ded')).length);
    check('ficha de la motora de TR01.016: perfil y profundidades marcados «deducido» (3), la cimentación no', ficha === 3, String(ficha));
    await pantalla(page, 'contractor', { conTr: 'TR01.022', conPi: 0, conFila: 'motor' });
    r = await leerVista(page);
    check('TR01.022: «⚠️ número sin confirmar» y la nota que pide comprobarlo con el plano', r.conf === 'deducido' && r.confBadge === '⚠️ número sin confirmar' &&
      /^⚠️ Número sin confirmar/.test(r.confNota || '') && r.confNota.includes('plano'), JSON.stringify(r));
    await pantalla(page, 'contractor', { conTr: 'TR14.056', conPi: 1, conFila: 'motor' });
    const pos = await page.evaluate(() => document.body.innerText.includes('Posición deducida'));
    check('ficha del soporte de H-27 (TR14.056, 3N-MP): dice que su posición es deducida', pos);
    await pantalla(page, 'contractor', { conTr: 'TR01.016', conPi: 0, conFila: 'motor' });
    // Plegar y recordarlo
    await page.click('#va-cab');
    await page.waitForTimeout(350);
    r = await leerVista(page);
    check('plegada: sin dibujo, con la cabecera y la marca de confianza a la vista', r.tarjeta && !r.svg && r.confBadge === 'número deducido' && r.expandida === 'false', JSON.stringify(r));
    const s2 = await app.otraPagina();
    await pantalla(s2.page, 'contractor', { conTr: 'TR01.015', conPi: 0, conFila: 'motor' });
    const r2 = await leerVista(s2.page);
    check('al volver a abrir la app sigue plegada', r2.tarjeta && !r2.svg && r2.expandida === 'false', JSON.stringify(r2));
    await s2.page.click('#va-cab');
    await s2.page.waitForTimeout(350);
    check('y se despliega otra vez', (await leerVista(s2.page)).svg);
    // Calidad › Cimentaciones
    await pantalla(page, 'qualtracker', { calTr: 'TR01.015', conTr: 'TR01.015', qTab: 'cim', qFila: 'motor', qPi: 0, viewOnly: false });
    r = await leerVista(page); // desplegada: la otra página la desplegó y el almacén es el mismo
    check('Calidad: tarjeta en Cimentaciones con los 18 soportes', r.svg && r.n === 18, JSON.stringify(r));
    check('Calidad: «4N-MP» a medias, «3N-MP» no conforme (verticalidad 120°), «2N-MP» no conforme (torsión «SÍ») y el resto sin datos',
      r.clases.includes('motor:0:parcial') && r.clases.includes('motor:1:no') && r.clases.includes('motor:2:no') && cuenta(r.clases, 'vacio') === 15, JSON.stringify(r.clases));
    const botones = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => /^(4N-MP|3N-MP|2N-MP)/.test(b.textContent)).map((b) => (b.getAttribute('style').match(/border:2px solid ([^;]+);/) || [])[1]));
    check('Calidad: los botones de pilar dicen lo mismo (amarillo, rojo y rojo)', igual(botones, ['var(--warn)', 'var(--no)', 'var(--no)']), JSON.stringify(botones));
    await page.click('#va-svg .va-sop[data-fila="motor"][data-i="1"]');
    await page.waitForTimeout(350);
    check('Calidad: tocar un soporte lo abre', igual(await page.evaluate(() => [V.qFila, V.qPi]), ['motor', 1]));
    // Alternar desde el plano conserva el apoyo y aplica el modo de lectura del destino.
    const selector = page.getByRole('group', { name: 'Vista del plano' });
    await page.evaluate(() => { U.role = 'calidad'; });
    await selector.getByRole('button', { name: 'Hincado', exact: true }).click();
    await page.locator('#va-svg').waitFor();
    r = await leerVista(page);
    check('Calidad → Hincado conserva el soporte, muestra su avance y abre en solo lectura',
      igual(r.sel, ['motor:1']) && r.clases.includes('motor:1:ok') &&
      igual(await page.evaluate(() => [V.screen, V.conTr, V.viewOnly]), ['contractor', 'TR01.015', true]));
    await selector.getByRole('button', { name: 'Calidad', exact: true }).click();
    await page.locator('#va-svg').waitFor();
    r = await leerVista(page);
    check('Hincado → Calidad conserva la no conformidad del mismo soporte y recupera la edición de Calidad',
      igual(r.sel, ['motor:1']) && r.clases.includes('motor:1:no') &&
      igual(await page.evaluate(() => [V.screen, V.calTr, V.viewOnly]), ['qualtracker', 'TR01.015', false]));
    await page.evaluate(() => { U.role = 'admin'; });
    await pantalla(page, 'qualtracker', { qTab: 'mont' });
    check('Calidad › Montaje: sin tarjeta (no va por soporte)', !(await leerVista(page)).tarjeta);
    // GPS emulado: sobre la motora de TR01.015, y lejos
    const base = new URL(page.url()).origin;
    await page.context().grantPermissions(['geolocation'], { origin: base });
    const mp = await page.evaluate(() => { const s = MASTER_CON['TR01.015'].find((q) => q.p === 'MOTORA-W'); return utmToLL(s.x, s.y); });
    await page.context().setGeolocation({ latitude: mp.lat, longitude: mp.lng, accuracy: 3 });
    await pantalla(page, 'contractor', { conTr: 'TR01.015', conPi: 0, conFila: 'motor' });
    await page.waitForTimeout(500);
    const gps = await page.evaluate(() => {
      const tu = document.getElementById('va-tu'), m = document.querySelector('#va-svg .va-sop[data-fila="motor"][data-i="4"] rect');
      if (!tu || !m) return null;
      return { dx: +tu.getAttribute('cx') - (+m.getAttribute('x') + 6), dy: +tu.getAttribute('cy') - (+m.getAttribute('y') + 6), txt: document.getElementById('va-gps-txt').textContent };
    });
    check('GPS sobre la motora: el punto «Tú» cae encima (≤ 0,5 px) y dice la precisión', gps && Math.abs(gps.dx) <= 0.5 && Math.abs(gps.dy) <= 0.5 && gps.txt === 'GPS ± 3 m', JSON.stringify(gps));
    await page.context().setGeolocation({ latitude: mp.lat + 0.05, longitude: mp.lng, accuracy: 3 });
    await pantalla(page, 'contractor', { conTr: 'TR01.015', conPi: 0, conFila: 'motor' });
    await page.waitForTimeout(500);
    const lejos = await page.evaluate(() => ({ tu: !!document.getElementById('va-tu'), txt: document.getElementById('va-gps-txt').textContent }));
    check('GPS a 5,5 km: sin punto y dice a cuánto está', !lejos.tu && /^📍 Estás a 5,[0-9] km del seguidor$/.test(lejos.txt), JSON.stringify(lejos));
    r = await leerVista(page);
    check('la vista no escribe en la base (tocar, plegar, GPS)', r.escrituras === esc0, r.escrituras + ' frente a ' + esc0);
    check('sin errores de página', app.errores.length === errores0 && s2.errores.length === 0, JSON.stringify(app.errores.concat(s2.errores)));
  } finally { await app.cerrar(); }

  // Planta sin fichero de soportes: ni tarjeta ni errores
  const demo = await abrirApp({ extra: { '/plantas.js': conPerfil(PLANTA_DEMO), '/demo_master.js': MASTER_DEMO }, query: '?planta=demo' });
  try {
    await pantalla(demo.page, 'contractor', { conTr: 'TR01.001', conPi: 0, conFila: 'motor' });
    const r = await leerVista(demo.page);
    const cuerpo = await demo.page.evaluate(() => document.body.innerText);
    check('planta sin fichero de soportes: no enseña la tarjeta y la pantalla sale', !r.tarjeta && cuerpo.includes('TR01.001'), cuerpo.slice(0, 200));
    check('planta sin fichero de soportes: sin errores de página', demo.errores.length === 0, JSON.stringify(demo.errores));
  } finally { await demo.cerrar(); }

  console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
