/* Unitarios de plantas.js (sin navegador): validación de perfiles, elección por URL, rutas por planta.
 * Uso: node tests/test_plantas.cjs  → imprime «N comprobaciones OK» o sale con 1.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'plantas.js'), 'utf8');
let ok = 0;
function check(nombre, fn) { try { fn(); ok++; } catch (e) { console.error('FALLA · ' + nombre + '\n  ' + e.message); process.exitCode = 1; } }

/* Carga plantas.js en un contexto aislado con una URL dada; registra los document.write. */
function cargar(search) {
  const escritos = [];
  const ctx = { location: { search }, document: { write: (s) => escritos.push(s) } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, escritos };
}

const { ctx } = cargar('');
const P = ctx.PlantasObra;
const ATALAYA = ctx.PLANTAS.atalaya;
const clon = (o) => JSON.parse(JSON.stringify(o));

check('sin parámetro se abre Atalaya y carga sus dos ficheros de datos', () => {
  const r = cargar('');
  assert.equal(r.ctx.PLANTA.id, 'atalaya');
  assert.deepEqual(r.escritos, ['<script src="master.js"></script>', '<script src="master_con.js"></script>']);
});
check('?planta=atalaya también', () => assert.equal(cargar('?planta=atalaya').ctx.PLANTA.id, 'atalaya'));
check('una planta desconocida NO cae en Atalaya y no carga datos', () => {
  const r = cargar('?planta=nadie');
  assert.equal(r.ctx.PLANTA, null);
  assert.match(r.ctx.PLANTA_ERROR.join(' '), /desconocida/);
  assert.deepEqual(r.escritos, []);
});
check('«__proto__» no es una planta', () => assert.equal(cargar('?planta=__proto__').ctx.PLANTA, null));
// clon(): los arrays nacen en el contexto de la VM y la comparación estricta distingue su prototipo.
check('el perfil de Atalaya es válido', () => assert.deepEqual(clon(P.problemas(ATALAYA)), []));

check('Atalaya conserva los soportes por tipo de la v1 (copiados de index.html@29330e9)', () => {
  assert.deepEqual(clon(ATALAYA.soportesPorTipo), {
    monofila_corto: { motor: ['2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP'], conducida: null },
    monofila_largo: { motor: ['4N-MP', '3N-MP', '2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP', '3S-MP', '4S-MP'], conducida: null },
    bifila_corto: { motor: ['2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP'], conducida: ['2N', '1N', 'MP-FC', '1S', '2S'] },
    bifila_largo: { motor: ['4N-MP', '3N-MP', '2N-MP', '1N-MP', 'MP', '1S-MP', '2S-MP', '3S-MP', '4S-MP'], conducida: ['4N', '3N', '2N', '1N', 'MP-FC', '1S', '2S', '3S', '4S'] }
  });
});
check('Atalaya conserva marca, plan y datos en la raíz', () => {
  assert.equal(ATALAYA.nombre, 'ISFV ATALAYA'); assert.equal(ATALAYA.marca, 'XAMAI · X-ELIO');
  assert.equal(ATALAYA.piePdf, 'XAMAI / X-ELIO'); assert.equal(ATALAYA.empresa, 'Xamai Global');
  assert.deepEqual(clon(ATALAYA.plan), { inicio: '2025-06-02', fin: '2026-09-15' });
  assert.equal(ATALAYA.prefijoDatos, ''); assert.equal(ATALAYA.legadoRaiz, true);
});

function nueva(cambios) { return Object.assign(clon(ATALAYA), { id: 'nueva', legadoRaiz: false, prefijoDatos: 'plantas/nueva/', plantillas: null }, cambios || {}); }
check('una planta nueva bien declarada es válida', () => assert.deepEqual(clon(P.problemas(nueva())), []));
check('SIN soportes por tipo la planta no se abre (no se inventan)', () => {
  assert.match(P.problemas(nueva({ soportesPorTipo: null })).join(' '), /soportes/);
  assert.match(P.problemas(nueva({ soportesPorTipo: {} })).join(' '), /soportes/);
});
check('un tipo con la lista de soportes vacía no vale', () => {
  assert.match(P.problemas(nueva({ soportesPorTipo: { t: { motor: [], conducida: null } } })).join(' '), /incompletos/);
});
check('una planta nueva no puede escribir en la raíz ni en el prefijo de otra', () => {
  assert.match(P.problemas(nueva({ prefijoDatos: '' })).join(' '), /prefijoDatos/);
  assert.match(P.problemas(nueva({ prefijoDatos: 'plantas/otra/' })).join(' '), /prefijoDatos/);
});
check('el legado sólo vale en la raíz', () => assert.match(P.problemas(Object.assign(clon(ATALAYA), { prefijoDatos: 'plantas/atalaya/' })).join(' '), /raíz/));
check('Atalaya conserva sus plantillas de Excel', () => assert.deepEqual(clon(ATALAYA.plantillas),
  { alturas: 'templates/plantilla_alturas.xlsx', checklist: 'templates/plantilla_checklist.xlsx' }));
check('plantillas: hay que declararlas (o null) y una planta nueva no puede usar las de otra obra', () => {
  // Mensajes distintos a propósito: el primero dice qué falta (la clave), el segundo qué está mal.
  assert.match(P.problemas(nueva({ plantillas: undefined })).join(' '), /faltan las «plantillas»/);
  assert.match(P.problemas(nueva({ plantillas: { alturas: 'templates/plantilla_alturas.xlsx', checklist: null } })).join(' '), /plantillas inválidas.*templates\/nueva\//);
  assert.match(P.problemas(nueva({ plantillas: { alturas: 'templates/nueva/alturas.xlsx' } })).join(' '), /plantillas inválidas/);
  assert.deepEqual(clon(P.problemas(nueva({ plantillas: { alturas: 'templates/nueva/alturas.xlsx', checklist: null } }))), []);
});
check('plan con fin antes del inicio no vale', () => assert.match(P.problemas(nueva({ plan: { inicio: '2026-02-01', fin: '2026-01-01' } })).join(' '), /plan/));

function rawFalso() { const rutas = []; return { rutas, raw: { ref: (p) => { rutas.push(p === undefined ? '(raíz)' : p); return {}; } } }; }
check('Atalaya: la base ve exactamente las mismas rutas que antes', () => {
  const f = rawFalso(); const db = P.dbDePlanta(f.raw, ATALAYA);
  db.ref('construction'); db.ref('quality/TR01_001'); db.ref('users/u1'); db.ref('.info/connected'); db.ref();
  assert.deepEqual(f.rutas, ['construction', 'quality/TR01_001', 'users/u1', '.info/connected', '(raíz)']);
});
check('planta nueva: todo bajo plantas/<id>/ salvo usuarios y .info', () => {
  const f = rawFalso(); const db = P.dbDePlanta(f.raw, nueva());
  db.ref('construction'); db.ref('quality/TR01_001'); db.ref('users'); db.ref('users/u1'); db.ref('.info/connected'); db.ref(); db.ref('usersX');
  assert.deepEqual(f.rutas, ['plantas/nueva/construction', 'plantas/nueva/quality/TR01_001', 'users', 'users/u1', '.info/connected', 'plantas/nueva', 'plantas/nueva/usersX']);
});
check('1756 se escribe «1.756» como antes en el PDF', () => {
  assert.equal(P.miles(1756), '1.756'); assert.equal(P.miles(15000), '15.000'); assert.equal(P.miles(17), '17');
});
check('el texto de un perfil se escapa al meterlo en HTML', () => assert.equal(P.html('<b>"x"&\'y\''), '&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;'));

console.log(ok + ' comprobaciones OK');
if (ok < 19) { console.error('menos comprobaciones de las esperadas: el vacío no es un PASS'); process.exitCode = 1; }
