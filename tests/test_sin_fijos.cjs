/* Guard estático: lo que es de una planta vive en plantas.js, no escrito a mano en las páginas.
 * Si alguien vuelve a escribir «ISFV ATALAYA», una fecha de obra o la tabla de soportes en index.html,
 * la app volvería a enseñar Atalaya en cualquier otra planta. Uso: node tests/test_sin_fijos.cjs
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
let ok = 0, fallos = 0;
function check(nombre, cond) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre); } }

const PAGINAS = ['index.html', 'dashboard.html'];
const PROHIBIDOS = ['ISFV ATALAYA', 'XAMAI', 'X-ELIO', 'Xamai Global', "'2025-06-02'", "'2026-09-15'", "'1.756 trackers'",
  'totalPilars=15000', 'var PCFG={', 'base64,', '<script src="master.js">', '<script src="master_con.js">', 'Dashboard ATALAYA'];

for (const p of PAGINAS) {
  const t = fs.readFileSync(path.join(RAIZ, p), 'utf8');
  for (const s of PROHIBIDOS) check(p + ' no contiene «' + s + '»', !t.includes(s));
  check(p + ' carga plantas.js antes del código de la app', t.includes('<script src="plantas.js"></script>') &&
    t.indexOf('<script src="plantas.js"></script>') < t.indexOf('firebase.initializeApp('));
  check(p + ' se para sin planta válida antes de iniciar Firebase', /if\(!window\.PLANTA\)\{[\s\S]*?throw new Error\('PLANTA no disponible'\)\}\s*\n\S*[\s\S]*?firebase\.initializeApp\(/.test(t) &&
    t.indexOf('if(!window.PLANTA)') < t.indexOf('firebase.initializeApp('));
  // Toda la base pasa por la fachada de la planta. firebase.database() sólo puede aparecer al crearla
  // y en goOnline (que no lee ni escribe rutas).
  const usos = t.split('firebase.database()').length - 1;
  const legitimos = (t.match(/PlantasObra\.dbDePlanta\(firebase\.database\(\),PLANTA\)/g) || []).length +
    (t.match(/firebase\.database\(\)\.goOnline\(\)/g) || []).length;
  check(p + ': ningún firebase.database() se salta la fachada de la planta (' + usos + ' usos, ' + legitimos + ' legítimos)', usos > 0 && usos === legitimos);
}
const idx = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
check('el importador de la v1 (escribe en la raíz) sólo se ofrece a la planta de legado', /if\(PLANTA\.legadoRaiz\)h\+='<a href="import\.html"/.test(idx));
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
check('el service worker guarda plantas.js para abrir sin conexión', sw.includes("'./plantas.js'"));

console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
if (fallos || ok < 34) process.exitCode = 1;
