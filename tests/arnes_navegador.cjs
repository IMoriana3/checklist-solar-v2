/* Arnés de navegador: abre la app con Firebase falso y mide qué rutas de la base toca y qué marca enseña.
 * Uso como módulo (lo usan los tests) o por línea de comandos para regenerar la línea base:
 *   node tests/arnes_navegador.cjs > tests/fixtures/linea_base_atalaya.json
 * Necesita Playwright con Chromium. No sale a la red: Firebase y las librerías de CDN se sirven falsos.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const STUB = fs.readFileSync(path.join(__dirname, 'stub_firebase.js'), 'utf8');
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function servidor(dir, extra) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (extra && Object.prototype.hasOwnProperty.call(extra, url)) {
        res.writeHead(200, { 'content-type': TIPOS[path.extname(url)] || 'text/plain' }); res.end(extra[url]); return;
      }
      const f = path.join(dir, url === '/' ? 'index.html' : url);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

const USUARIO_BANCO = { uid: 'u-banco', email: 'banco@prueba.invalid' };

/* Página con Firebase falso. semilla: datos iniciales de la base, además del perfil del usuario.
 * libs: {trozo de URL: código} sirve librerías de CDN reales (p. ej. JSZip para exportar); el resto
 * de scripts externos se sirven vacíos. */
async function prepararPagina(ctx, base, { usuario = null, semilla = {}, libs = {} } = {}) {
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message || e)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.includes('firebase-app-compat')) return route.fulfill({ contentType: 'application/javascript', body: STUB });
    const lib = Object.keys(libs).find((k) => u.includes(k));
    if (lib) return route.fulfill({ contentType: 'application/javascript', body: libs[lib] });
    if (u.endsWith('.js')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.fulfill({ contentType: 'text/css', body: '' });
  });
  await page.addInitScript(({ u, semilla }) => {
    window.__FB_USER = u;
    window.__FB_SEED = Object.assign(u ? { users: { [u.uid]: { name: 'Banco', role: 'admin' } } } : {}, semilla);
  }, { u: usuario, semilla });
  return { page, errores };
}

/* Un escenario: opcionalmente con sesión (usuario admin sembrado) y pantallas que recorrer. */
async function escenario(browser, base, { query = '', usuario = null, pantallas = [] } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const { page, errores } = await prepararPagina(ctx, base, { usuario });
  await page.goto(base + '/index.html' + query, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  for (const p of pantallas) {
    const paso = typeof p === 'string' ? { screen: p } : p;
    await page.evaluate((x) => {
      if (typeof V === 'undefined' || typeof R !== 'function') return;
      Object.assign(V, x.set || {}); V.screen = x.screen; R();
    }, paso);
    await page.waitForTimeout(150);
  }
  const salida = await page.evaluate(() => ({
    titulo: document.title,
    textos: Array.from(document.querySelectorAll('.login-logo,.login-title')).map((e) => e.textContent.trim()),
    cuerpo: (document.body.innerText || '').slice(0, 600),
    imgs: document.images.length,
    log: (window.__FB_LOG || []).map((x) => x.op + ' ' + x.path)
  }));
  await ctx.close();
  return { ...salida, rutas: Array.from(new Set(salida.log)).sort(), escrituras: salida.log.filter((l) => /^(set|update|push|remove) /.test(l)).length, errores };
}

/* Recorrido con sesión: las pantallas que la app abre desde sus propios botones (mismas variables). */
const PANTALLAS = [
  'modesel', 'conselect', 'calselect',
  { screen: 'contractor', set: { conTr: 'TR01.001', conPi: 0, conFila: 'motor' } },
  { screen: 'qualtracker', set: { calTr: 'TR01.001', conTr: 'TR01.001', viewOnly: false } },
  { screen: 'condetail', set: { conPv: 1, conSub: 0 } },
  { screen: 'caldetail', set: { calPv: 1, calSub: 0 } },
  'resumen', 'dashpro', 'admin'
];

async function medir({ dir = RAIZ, extra = null, query = '' } = {}) {
  const s = await servidor(dir, extra);
  const base = 'http://127.0.0.1:' + s.address().port;
  const browser = await chromium.launch();
  try {
    const sinSesion = await escenario(browser, base, { query });
    const conSesion = await escenario(browser, base, { query, usuario: USUARIO_BANCO, pantallas: PANTALLAS });
    return { sinSesion, conSesion };
  } finally {
    await browser.close();
    s.close();
  }
}

/* Para bancos interactivos: abre la app con sesión de admin y datos sembrados y devuelve la página.
 * Quien la abre llama a cerrar() al terminar. */
async function abrirApp({ dir = RAIZ, extra = null, query = '', usuario = USUARIO_BANCO, semilla = {}, libs = {} } = {}) {
  const s = await servidor(dir, extra);
  const base = 'http://127.0.0.1:' + s.address().port;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const { page, errores } = await prepararPagina(ctx, base, { usuario, semilla, libs });
    await page.goto(base + '/index.html' + query, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    return { page, errores, cerrar: async () => { await browser.close(); s.close(); } };
  } catch (e) {
    await browser.close(); s.close(); throw e;
  }
}

/* plantas.js con un perfil más, servido sólo en el banco (doble de prueba: no toca el fichero real). */
function conPerfil(perfil) {
  const src = fs.readFileSync(path.join(RAIZ, 'plantas.js'), 'utf8');
  const marca = '  var PLANTAS = {\n';
  if (!src.includes(marca)) throw new Error('no encuentro el registro de plantas en plantas.js');
  return src.replace(marca, marca + '    ' + JSON.stringify(perfil.id) + ': ' + JSON.stringify(perfil) + ',\n');
}
/* Una planta de prueba bien declarada, con un seguidor y sin plantillas de Excel. */
const PLANTA_DEMO = {
  id: 'demo', nombre: 'PLANTA DEMO', nombreCorto: 'DEMO', marca: 'CLIENTE DEMO', piePdf: 'CLIENTE DEMO', empresa: 'Empresa demo',
  codigoExport: 'DEMO', logoAlt: 'Demo', logo: 'data:image/png;base64,iVBORw0KGgo=', prefijoDatos: 'plantas/demo/', legadoRaiz: false,
  datos: { seguidores: 'demo_master.js', soportes: null }, plan: { inicio: '2026-01-01', fin: '2026-12-31' }, plantillas: null,
  soportesPorTipo: { tipo_demo: { motor: ['1N', 'MP', '1S'], conducida: null } }
};
const MASTER_DEMO = 'var MASTER_DATA = {"TR01.001":{"pv":1,"num":1,"type":"tipo_demo","n":10,"mx":0,"my":0,"sub":0}};\n';

module.exports = { medir, abrirApp, conPerfil, PLANTA_DEMO, MASTER_DEMO };

if (require.main === module) {
  medir().then((r) => {
    for (const k of Object.keys(r)) { delete r[k].log; delete r[k].cuerpo; delete r[k].imgs; }
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  }).catch((e) => { console.error(e); process.exit(1); });
}
