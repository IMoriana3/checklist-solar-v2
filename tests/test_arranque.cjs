/* Banco de navegador de B2.1 (Playwright + Firebase falso, sin red).
 *  1. Atalaya, con y sin ?planta=atalaya, toca EXACTAMENTE las mismas rutas, enseña la misma marca y
 *     escribe lo mismo que el código anterior (línea base medida sobre main@29330e9).
 *  2. Una planta desconocida no toca la base y no cae en Atalaya; el id de la URL no se inyecta como HTML.
 *  3. Una planta sin soportes por tipo no se abre: lo dice y no toca la base.
 *  4. Una planta nueva escribe y lee sólo bajo plantas/<id>/ (usuarios y .info aparte) y enseña su marca.
 * Uso: node tests/test_arranque.cjs
 */
const fs = require('fs');
const path = require('path');
const { medir } = require('./arnes_navegador.cjs');

const BASE = require('./fixtures/linea_base_atalaya.json');
const PLANTAS_SRC = fs.readFileSync(path.join(__dirname, '..', 'plantas.js'), 'utf8');
let ok = 0, fallos = 0;
function check(nombre, cond, detalle) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre + (detalle ? '\n  ' + detalle : '')); } }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* plantas.js con un perfil más, servido sólo en este banco (doble de prueba, no toca el fichero real). */
function conPerfil(perfil) {
  const marca = '  var PLANTAS = {\n';
  if (!PLANTAS_SRC.includes(marca)) throw new Error('no encuentro el registro de plantas en plantas.js');
  return PLANTAS_SRC.replace(marca, marca + '    ' + JSON.stringify(perfil.id) + ': ' + JSON.stringify(perfil) + ',\n');
}
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const DEMO = {
  id: 'demo', nombre: 'PLANTA DEMO', nombreCorto: 'DEMO', marca: 'CLIENTE DEMO', piePdf: 'CLIENTE DEMO', empresa: 'Empresa demo',
  codigoExport: 'DEMO', logoAlt: 'Demo', logo: LOGO, prefijoDatos: 'plantas/demo/', legadoRaiz: false,
  datos: { seguidores: 'demo_master.js', soportes: null }, plan: { inicio: '2026-01-01', fin: '2026-12-31' },
  soportesPorTipo: { tipo_demo: { motor: ['1N', 'MP', '1S'], conducida: null } }
};
const DEMO_MASTER = 'var MASTER_DATA = {"TR01.001":{"pv":1,"num":1,"type":"tipo_demo","n":10,"mx":0,"my":0,"sub":0}};\n';

(async () => {
  // 1 · Atalaya idéntica a la línea base
  for (const q of ['', '?planta=atalaya']) {
    const r = await medir({ query: q });
    for (const k of ['sinSesion', 'conSesion']) {
      const a = r[k], b = BASE[k];
      check('Atalaya ' + (q || '(sin parámetro)') + ' · ' + k + ': mismas rutas, marca, escrituras y errores que antes',
        igual([a.titulo, a.textos, a.rutas, a.escrituras, a.errores], [b.titulo, b.textos, b.rutas, b.escrituras, b.errores]),
        JSON.stringify({ ahora: [a.textos, a.rutas, a.errores], antes: [b.textos, b.rutas, b.errores] }));
    }
    check('la línea base no está vacía (si lo estuviera, la igualdad no probaría nada)', BASE.conSesion.rutas.length >= 10);
  }

  // 2 · Planta desconocida, y el id de la URL no entra como HTML
  const desconocida = await medir({ query: '?planta=%3Cimg%20src%3Dx%3E' });
  for (const k of ['sinSesion', 'conSesion']) {
    const a = desconocida[k];
    check('planta desconocida · ' + k + ': no toca la base', a.rutas.length === 0, JSON.stringify(a.rutas));
    check('planta desconocida · ' + k + ': lo dice', /Planta no disponible/.test(a.cuerpo) && /desconocida/.test(a.cuerpo), a.cuerpo);
    check('planta desconocida · ' + k + ': el id se enseña como texto, sin crear elementos', a.imgs === 0 && a.cuerpo.includes('<img src=x>'));
  }
  // Sólo sin sesión: tras el login la app no pinta la marca, así que con sesión esta comprobación no podría
  // fallar nunca (lo enseñó el mutante N2: predicho 8 fallos, medido 7).
  check('planta desconocida · sinSesion: no enseña la marca de Atalaya', !/ATALAYA|XAMAI/.test(desconocida.sinSesion.cuerpo));

  // 3 · Planta sin soportes por tipo
  const sinSoportes = Object.assign({}, DEMO, { soportesPorTipo: null });
  const s3 = await medir({ query: '?planta=demo', extra: { '/plantas.js': conPerfil(sinSoportes), '/demo_master.js': DEMO_MASTER } });
  for (const k of ['sinSesion', 'conSesion']) {
    check('planta sin soportes · ' + k + ': no se abre ni toca la base', s3[k].rutas.length === 0 && /soportes/.test(s3[k].cuerpo), s3[k].cuerpo);
  }

  // 4 · Planta nueva con su prefijo
  const s4 = await medir({ query: '?planta=demo', extra: { '/plantas.js': conPerfil(DEMO), '/demo_master.js': DEMO_MASTER } });
  check('planta nueva: enseña su marca', igual(s4.sinSesion.textos, ['CLIENTE DEMO', 'PLANTA DEMO']), JSON.stringify(s4.sinSesion.textos));
  const comunes = (r) => /^(on|once) (\.info\/connected|users(\/.*)?)$/.test(r);
  const fuera = s4.conSesion.rutas.filter((r) => !comunes(r) && !/^[a-zA-Z]+ plantas\/demo(\/|$)/.test(r));
  check('planta nueva: todas sus rutas están bajo plantas/demo/ (salvo usuarios y .info)', fuera.length === 0, JSON.stringify(fuera));
  check('planta nueva: sincroniza sólo su rama', s4.conSesion.rutas.includes('keepSynced plantas/demo') && !s4.conSesion.rutas.includes('keepSynced '));
  check('planta nueva: lee sus datos de obra', s4.conSesion.rutas.includes('once plantas/demo/construction'), JSON.stringify(s4.conSesion.rutas));
  check('planta nueva: sin errores de página', s4.conSesion.errores.length === 0 && s4.sinSesion.errores.length === 0, JSON.stringify(s4.conSesion.errores));

  console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
  if (fallos || ok !== 20) process.exitCode = 1; // 6 + 7 + 2 + 5: si cambia, que sea a propósito
})().catch((e) => { console.error(e); process.exitCode = 1; });
