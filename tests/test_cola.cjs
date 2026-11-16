/* Unitarios de cola.js (sin navegador), con la fachada de planta real de plantas.js y una base falsa
 * que confirma, deja sin confirmar (sin conexión) o rechaza cada escritura.
 * Uso: node tests/test_cola.cjs  → imprime «N comprobaciones OK» o sale con 1.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const RAIZ = path.join(__dirname, '..');
let ok = 0;
async function check(nombre, fn) { try { await fn(); ok++; } catch (e) { console.error('FALLA · ' + nombre + '\n  ' + e.message); process.exitCode = 1; } }
const pausa = () => new Promise((r) => setTimeout(r, 0));
const clon = (o) => JSON.parse(JSON.stringify(o));

/* plantas.js + cola.js en un contexto aislado (como en la página: plantas.js primero). */
const ctx = { location: { search: '' }, document: { write() {} } };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'plantas.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'cola.js'), 'utf8'), ctx);
const { PlantasObra, ColaObra } = ctx;
const ATALAYA = ctx.PLANTAS.atalaya;
const DEMO = Object.assign(clon(ATALAYA), { id: 'demo', legadoRaiz: false, prefijoDatos: 'plantas/demo/', plantillas: null });

/* Base falsa: apunta {op, path, val}; modo 'ok' confirma, 'sin' no confirma nunca, 'rechaza' rechaza. */
function baseFalsa(modo = 'ok') {
  const ops = []; let n = 0; const b = { ops, modo };
  function prom(op, p, v) {
    ops.push({ op, path: p, val: v === undefined ? null : clon(v) });
    if (b.modo === 'ok') return Promise.resolve();
    if (b.modo === 'rechaza') { const e = new Error('Permission denied'); e.code = 'PERMISSION_DENIED'; return Promise.reject(e); }
    return new Promise(() => {});
  }
  function ref(p) {
    p = p === undefined ? '' : p;
    return {
      key: p.split('/').pop() || null,
      set: (v) => { if (b.lanza) throw new Error('SDK: valor no válido'); return prom('set', p, v); },
      update: (o) => prom('update', p, o), remove: () => prom('remove', p, null),
      push: () => ref((p ? p + '/' : '') + 'k' + (++n)), child: (c) => ref((p ? p + '/' : '') + c),
      once: () => Promise.resolve('leído ' + p), keepSynced: () => 'sincronizado ' + p
    };
  }
  b.raw = { ref };
  return b;
}
function almacen() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
/* Una «apertura de la app»: cola + fachada de la planta envuelta, sobre un almacén y una base. */
function app({ planta = ATALAYA, alm = almacen(), base = baseFalsa(), uid = 'u1', avisos = [] } = {}) {
  const fachada = PlantasObra.dbDePlanta(base.raw, planta);
  const cola = ColaObra.crear({ almacen: alm, clave: 'colaObra:' + planta.id, usuario: () => uid, aviso: (t) => avisos.push(t) });
  return { db: ColaObra.envolver(fachada, cola), fachada, cola, alm, base, avisos, guardado: () => JSON.parse(alm.getItem('colaObra:' + planta.id) || '[]') };
}

(async () => {
  await check('con conexión: escribe una vez y no deja nada guardado', async () => {
    const a = app();
    await a.db.ref('quality/TR01_001').update({ mont_ms_par: 'NO' });
    await pausa();
    assert.deepEqual(a.base.ops, [{ op: 'update', path: 'quality/TR01_001', val: { mont_ms_par: 'NO' } }]);
    assert.equal(a.alm.getItem('colaObra:atalaya'), null);
  });

  // Una sesión sin conexión que escribe de todo y se cierra sin que nada llegue al servidor.
  const alm = almacen();
  const s1 = app({ alm, base: baseFalsa('sin') });
  s1.db.ref('quality/TR01_001').update({ mont_ms_par: 'NO', mont_ms_par_ts: { '.sv': 'timestamp' } });
  const p = s1.db.ref('quality_log').push({ field: 'mont_ms_par', value: 'NO' });
  s1.db.ref('locks/TR01_001').remove();
  s1.db.ref().update({ 'construction/TR01_001/f1': 'hincada' });
  s1.db.ref('workflow').child('TR01_001').set({ state: 'ok' });
  await pausa();
  const ESPERADO = [
    { op: 'update', ruta: 'quality/TR01_001', valor: { mont_ms_par: 'NO', mont_ms_par_ts: { '.sv': 'timestamp' } } },
    { op: 'set', ruta: 'quality_log/' + p.key, valor: { field: 'mont_ms_par', value: 'NO' } },
    { op: 'remove', ruta: 'locks/TR01_001', valor: null },
    { op: 'update', ruta: '', valor: { 'construction/TR01_001/f1': 'hincada' } },
    { op: 'set', ruta: 'workflow/TR01_001', valor: { state: 'ok' } }
  ];
  await check('sin conexión: todo queda guardado en el dispositivo, en orden y con su usuario', () => {
    const g = s1.guardado();
    assert.deepEqual(g.map(({ op, ruta, valor }) => ({ op, ruta, valor })), ESPERADO);
    assert.ok(g.every((e) => e.uid === 'u1' && typeof e.id === 'string' && typeof e.t === 'number'));
  });
  await check('push devuelve su clave y se guarda como set en esa misma clave', () => {
    assert.match(p.key, /^k\d+$/); assert.equal(typeof p.then, 'function');
    assert.equal(s1.base.ops[1].path, 'quality_log/' + p.key);
  });

  // La app se vuelve a abrir con conexión: otra cola y otra base, mismo almacén.
  const s2 = app({ alm });
  const n2 = s2.cola.reenviar(s2.fachada, 'u1');
  await pausa(); await pausa();
  await check('al volver a abrir con conexión, se reenvía todo en el mismo orden, la misma clave y las mismas rutas', () => {
    assert.equal(n2, 5);
    assert.deepEqual(s2.base.ops.map(({ op, path: q, val }) => ({ op, ruta: q, valor: val })), ESPERADO);
  });
  await check('confirmado por el servidor, el dispositivo queda limpio', () => assert.equal(alm.getItem('colaObra:atalaya'), null));

  await check('no se reenvía dos veces en la misma sesión', async () => {
    const a2 = almacen(); const sA = app({ alm: a2, base: baseFalsa('sin') });
    sA.db.ref('quality/T').update({ x: 1 });
    const sB = app({ alm: a2, base: baseFalsa('sin') });
    assert.equal(sB.cola.reenviar(sB.fachada, 'u1'), 1);
    assert.equal(sB.cola.reenviar(sB.fachada, 'u1'), 0);
    assert.equal(sB.base.ops.length, 1);
    // y lo que escribe esta misma sesión tampoco se «reenvía» como si viniera de antes
    sB.db.ref('quality/T2').update({ y: 2 });
    assert.equal(sB.cola.reenviar(sB.fachada, 'u1'), 0);
  });

  await check('lo de otro usuario no se reenvía con este; espera a su dueño', async () => {
    const a3 = almacen(); const de1 = app({ alm: a3, base: baseFalsa('sin'), uid: 'u1' });
    de1.db.ref('quality/T').update({ x: 1 });
    const de2 = app({ alm: a3, uid: 'u2' });
    assert.equal(de2.cola.reenviar(de2.fachada, 'u2'), 0);
    assert.equal(de2.base.ops.length, 0);
    assert.equal(de2.guardado().length, 1);
    const otraVez1 = app({ alm: a3, uid: 'u1' });
    assert.equal(otraVez1.cola.reenviar(otraVez1.fachada, 'u1'), 1);
    await pausa(); await pausa();
    assert.equal(a3.getItem('colaObra:atalaya'), null);
  });

  await check('si el servidor la rechaza, sale de la cola y se avisa (no se insiste)', async () => {
    const a = app({ base: baseFalsa('rechaza') });
    await a.db.ref('users/u1/role').set('admin').catch(() => {});
    await pausa();
    assert.equal(a.alm.getItem('colaObra:atalaya'), null);
    assert.match(a.avisos.join(' '), /no aceptó.*users\/u1\/role.*PERMISSION_DENIED/);
  });

  await check('si el SDK la rechaza al momento, no queda guardada y el error llega a la app', () => {
    const a = app(); a.base.lanza = true;
    assert.throws(() => a.db.ref('quality/T').set(undefined), /valor no válido/);
    assert.equal(a.alm.getItem('colaObra:atalaya'), null);
  });

  await check('sin sesión (alta de cuenta) se escribe como antes, sin guardar nada', async () => {
    const a = app({ uid: null });
    await a.db.ref('users/nuevo').set({ name: 'X' });
    assert.equal(a.base.ops.length, 1); assert.equal(a.alm.m.size, 0);
  });

  await check('si el navegador no deja guardar, la escritura sale igual y se avisa una sola vez', async () => {
    const roto = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const a = app({ alm: roto });
    await a.db.ref('quality/T').update({ x: 1 });
    await a.db.ref('quality/T').update({ x: 2 });
    assert.equal(a.base.ops.length, 2);
    assert.equal(a.avisos.filter((t) => /no deja guardar/.test(t)).length, 1);
    const sin = app({ alm: null });
    await sin.db.ref('quality/T').update({ x: 3 });
    assert.equal(sin.base.ops.length, 1); assert.equal(sin.avisos.length, 1);
  });

  await check('otra planta: se guarda la ruta de la app y se reenvía dentro de plantas/<id>/ (usuarios aparte)', async () => {
    const a4 = almacen(); const d1 = app({ planta: DEMO, alm: a4, base: baseFalsa('sin') });
    d1.db.ref('quality/T').update({ x: 1 }); d1.db.ref('users/u1/role').set('calidad'); d1.db.ref().update({ 'a/b': 1 });
    assert.deepEqual(d1.base.ops.map((o) => o.path), ['plantas/demo/quality/T', 'users/u1/role', 'plantas/demo']);
    assert.deepEqual(d1.guardado().map((e) => e.ruta), ['quality/T', 'users/u1/role', '']);
    assert.equal(a4.getItem('colaObra:atalaya'), null);
    const d2 = app({ planta: DEMO, alm: a4 });
    d2.cola.reenviar(d2.fachada, 'u1');
    assert.deepEqual(d2.base.ops.map((o) => o.path), ['plantas/demo/quality/T', 'users/u1/role', 'plantas/demo']);
  });

  await check('lecturas, escuchas y demás van directas al SDK, sin pasar por la cola', async () => {
    const a = app();
    assert.equal(await a.db.ref('construction').once('value'), 'leído construction');
    assert.equal(a.db.ref().keepSynced(true), 'sincronizado ');
    assert.equal(a.db.ref('quality/TR01_001').key, 'TR01_001');
    assert.equal(a.base.ops.length, 0); assert.equal(a.alm.m.size, 0);
  });

  await check('push sin valor sólo da la clave: no escribe ni guarda', () => {
    const a = app(); const r = a.db.ref('punchlist').push();
    assert.match(r.key, /^k\d+$/); assert.equal(a.base.ops.length, 0); assert.equal(a.alm.m.size, 0);
  });

  console.log(ok + ' comprobaciones OK');
  if (ok < 14) { console.error('menos comprobaciones de las esperadas: el vacío no es un PASS'); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
