/* Banco de navegador de H-04: lo escrito sin conexión no se pierde al cerrar la app.
 * El doble de Firebase hace lo que documenta Firebase para el SDK web: sin conexión, el servidor no
 * confirma nada y lo pendiente muere con la página. Cada «apertura» es una página nueva en el MISMO
 * navegador (mismo almacenamiento local), como quien cierra la app y la vuelve a abrir.
 *  1. Sin conexión, un cambio de calidad queda guardado en el dispositivo y el servidor no lo tiene.
 *  2. Al volver a abrir con conexión, se sube solo (mismo valor, misma clave del registro) y avisa.
 *  3. Una tercera apertura no lo vuelve a subir.
 *  4. Lo de un usuario no se sube con la sesión de otro; espera a su dueño.
 *  5. Si el servidor lo rechaza, sale de la cola y la app lo dice.
 * Uso: node tests/test_sin_conexion.cjs
 */
const { abrirApp } = require('./arnes_navegador.cjs');

let ok = 0, fallos = 0;
function check(nombre, cond, detalle) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre + (detalle ? '\n  ' + detalle : '')); } }

const A = { uid: 'u-a', email: 'a@prueba.invalid' }, B = { uid: 'u-b', email: 'b@prueba.invalid' };
const SEMILLA = { users: { 'u-a': { name: 'Inspector A', role: 'calidad' }, 'u-b': { name: 'Inspector B', role: 'calidad' } } };

/* Espera a que la app tenga sesión y deja pasar un momento para lo que haga al entrar. */
async function conSesion(page) {
  await page.waitForFunction(() => typeof U !== 'undefined' && U && U.uid, null, { timeout: 5000 });
  await page.waitForTimeout(400);
}
const cola = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('colaObra:atalaya') || '[]'));
const servidor = (page) => page.evaluate(() => window.__FB_SERVIDOR.filter((w) => !/^users\//.test(w.path)));
const escribir = (page, valor) => page.evaluate((v) => setQualField('TR01.001', 'mont_ms_par', v), valor);

(async () => {
  const app = await abrirApp({ usuario: A, semilla: SEMILLA, offline: true });
  const errores = [];
  try {
    // 1 · Sin conexión
    const p1 = app.page; await conSesion(p1);
    await escribir(p1, 'NO');
    await p1.waitForTimeout(300);
    const g1 = await cola(p1);
    // La clave que generó el SDK sin conexión para la entrada del registro (lo que «escribió» la página)
    const claveSinConexion = await p1.evaluate(() => (window.__FB_LOG.find((l) => l.op === 'set' && /^quality_log\//.test(l.path)) || {}).path);
    check('sin conexión: el cambio queda guardado en el dispositivo (el dato y su entrada de registro)',
      g1.length === 2 && g1[0].op === 'update' && g1[0].ruta === 'quality/TR01_001' && g1[0].valor.mont_ms_par === 'NO' &&
      g1[1].op === 'set' && /^quality_log\//.test(g1[1].ruta) && g1[1].valor.field === 'mont_ms_par' && g1.every((e) => e.uid === 'u-a'),
      JSON.stringify(g1));
    check('sin conexión: el servidor todavía no tiene nada', (await servidor(p1)).length === 0);
    errores.push(...app.errores);
    await p1.close();

    // 2 · Se vuelve a abrir con conexión
    const s2 = await app.otraPagina({ offline: false }); await conSesion(s2.page);
    const sv2 = await servidor(s2.page);
    const dato = sv2.find((w) => w.op === 'update' && w.path === 'quality/TR01_001');
    const reg = sv2.find((w) => w.op === 'set' && /^quality_log\//.test(w.path));
    check('al volver a abrir con conexión, el cambio llega al servidor', dato && dato.val.mont_ms_par === 'NO' && dato.val.mont_ms_par_by === 'Inspector A', JSON.stringify(sv2));
    check('y su entrada de registro, con la misma clave que se generó sin conexión (no se duplica)',
      reg && claveSinConexion && reg.path === claveSinConexion && reg.val.value === 'NO', JSON.stringify({ claveSinConexion, sv2 }));
    check('después, el dispositivo queda limpio', (await cola(s2.page)).length === 0);
    const aviso = await s2.page.evaluate(() => document.getElementById('toast').textContent);
    check('la app dice que está subiendo lo pendiente', /Subiendo 2 cambios/.test(aviso), aviso);
    errores.push(...s2.errores);
    await s2.page.close();

    // 3 · Una tercera apertura no lo repite
    const s3 = await app.otraPagina({ offline: false }); await conSesion(s3.page);
    check('una nueva apertura no vuelve a subir nada', (await servidor(s3.page)).length === 0, JSON.stringify(await servidor(s3.page)));
    errores.push(...s3.errores);
    await s3.page.close();

    // 4 · Otro usuario en el mismo dispositivo
    const s4 = await app.otraPagina({ offline: true }); await conSesion(s4.page);
    await escribir(s4.page, 'SI'); await s4.page.waitForTimeout(300);
    errores.push(...s4.errores);
    await s4.page.close();
    const s5 = await app.otraPagina({ offline: false, usuario: B }); await conSesion(s5.page);
    check('lo de A no se sube con la sesión de B y sigue guardado', (await servidor(s5.page)).length === 0 && (await cola(s5.page)).length === 2);
    errores.push(...s5.errores);
    await s5.page.close();
    const s6 = await app.otraPagina({ offline: false, usuario: A }); await conSesion(s6.page);
    const sv6 = await servidor(s6.page);
    check('cuando vuelve A, se sube lo suyo', sv6.some((w) => w.path === 'quality/TR01_001' && w.val.mont_ms_par === 'SI') && (await cola(s6.page)).length === 0, JSON.stringify(sv6));
    errores.push(...s6.errores);
    await s6.page.close();

    check('sin errores de página en todas las aperturas', errores.length === 0, JSON.stringify(errores));

    // 5 · El servidor rechaza el cambio de calidad (como unas reglas sin permiso)
    const s7 = await app.otraPagina({ offline: false, rechaza: ['quality/'] }); await conSesion(s7.page);
    await escribir(s7.page, 'NO'); await s7.page.waitForTimeout(400);
    const aviso7 = await s7.page.evaluate(() => document.getElementById('toast').textContent);
    const g7 = await cola(s7.page);
    check('rechazado: sale de la cola (no se insiste) y la app lo dice', g7.length === 0 && /no aceptó.*quality\/TR01_001.*PERMISSION_DENIED/.test(aviso7),
      JSON.stringify({ g7, aviso7 }));
  } finally {
    await app.cerrar();
  }

  console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
  if (fallos || ok !== 11) process.exitCode = 1; // 2 + 4 + 1 + 2 + 1 (errores) + 1: si cambia, que sea a propósito
})().catch((e) => { console.error(e); process.exitCode = 1; });
