/* Banco del fichero de soportes de la planta (master.js + master_con.js), tras la reconstrucción del 18/11/2026
 * (propietario: «Carga la reconstrucción marcando confirmados y deducidos»; «N es norte»; «la motora siempre al oeste»).
 * Es la puerta que faltaba: el fichero anterior agrupaba y nombraba mal los soportes y nada lo detectaba.
 *  1. Cada seguidor tiene sus n soportes con los nombres de su tipo, en orden: fila motora de 4N a 4S y, en
 *     bifila, la conducida igual (nombres del fichero: «4NW»…«MOTORA-W»…, «4NE»…«CARDAN-E»…; monofila «4N»…«MOTORA»).
 *  2. El chequeo de la vista aérea no avisa en ninguno (filas rectas, vanos de getTramoTol en 3D, motora y cardán
 *     enfrentados, «N» al norte, motora en mx,my) y en los bifila la fila motora está al oeste.
 *  3. Ninguna coordenada repetida; todos los números son números.
 *  4. Atributos coherentes: lh = pm + am y ph = lh − (co − z) (±0,5 mm); motora y cardán W6x8.5, HD y am 1,48;
 *     el resto am 1,455; perfiles y cimentaciones conocidos.
 *  5. Confianza de cada número: confirmado, pista o deducido (57 / 952 / 747); lo deducido de cada soporte sólo
 *     puede ser perfil, profundidad mínima o cimentación; una sola posición deducida (H-27).
 * Uso: node tests/test_soportes.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..');
let ok = 0, fallos = 0;
function check(nombre, cond, detalle) { if (cond) ok++; else { fallos++; console.error('FALLA · ' + nombre + (detalle ? '\n  ' + detalle : '')); } }
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const ctx = {}; vm.createContext(ctx);
const TRAMOS = /var TRAMO_NOM=\{[\s\S]*?\nfunction getTramoTol\(type,piIdx\)\{[\s\S]*?\n\}/.exec(leer('index.html'));
vm.runInContext(TRAMOS[0] + '\nglobalThis.getTramoTol=getTramoTol;', ctx);
vm.runInContext(leer('plantas.js'), ctx);
vm.runInContext(leer('vista_aerea.js'), ctx);
const P = ctx.PLANTAS.atalaya;
vm.runInContext(leer(P.datos.seguidores).replace('const MASTER_DATA', 'globalThis.MASTER_DATA'), ctx);
vm.runInContext(leer(P.datos.soportes).replace('const MASTER_CON', 'globalThis.MASTER_CON'), ctx);
const MD = ctx.MASTER_DATA, MC = ctx.MASTER_CON, codes = Object.keys(MD);
const VA = ctx.VistaAerea.crear({ datos: MD, soportes: MC, tipos: P.soportesPorTipo, tramo: ctx.getTramoTol });
const nombres = (c) => { const t = P.soportesPorTipo[MD[c].type], bi = !!t.conducida; return t.motor.map((n) => ctx.VistaAerea.nombreFichero(n, bi, false)).concat(bi ? t.conducida.map((n) => ctx.VistaAerea.nombreFichero(n, true, true)) : []); };
const esMot = (p) => /^(MOTORA|CARDAN)/.test(p);
const malos = (f) => codes.filter(f);

// 1 · nombres y número de soportes
check('1.756 seguidores, todos con soportes', codes.length === 1756 && codes.every((c) => Array.isArray(MC[c])));
const malNombre = malos((c) => MC[c].length !== MD[c].n || MC[c].map((s) => s.p).join() !== nombres(c).join());
check('cada seguidor tiene sus n soportes con los nombres de su tipo, en orden', malNombre.length === 0, malNombre.slice(0, 5).join(' '));
// 2 · forma
const conAviso = malos((c) => VA.chequeo(c).length);
check('el chequeo de la vista aérea no avisa en ninguno (forma, vanos, N al norte, motora en mx,my)', conAviso.length === 0, conAviso.slice(0, 5).map((c) => c + ' ' + JSON.stringify(VA.chequeo(c).map((a) => a.tipo))).join(' · '));
const media = (l) => l.reduce((s, q) => s + q.x, 0) / l.length;
const motoraEste = malos((c) => { const f = VA.filas(c); return f.length === 2 && !(media(f[0].pts) < media(f[1].pts)); });
check('en los bifila la fila motora está al oeste de la conducida', motoraEste.length === 0, motoraEste.slice(0, 5).join(' '));
// 3 · coordenadas y números
const vistos = new Map(); const repes = [];
codes.forEach((c) => MC[c].forEach((s) => { const k = s.x.toFixed(2) + ',' + s.y.toFixed(2); if (vistos.has(k)) repes.push(vistos.get(k) + ' = ' + c + ' ' + s.p); else vistos.set(k, c + ' ' + s.p); }));
check('ninguna coordenada repetida (26.382 soportes distintos)', repes.length === 0 && vistos.size === 26382, repes.slice(0, 3).join(' · ') + ' · ' + vistos.size);
const noNum = []; codes.forEach((c) => MC[c].forEach((s) => { ['x', 'y', 'z', 'co', 'ph', 'pm', 'am', 'lh'].forEach((k) => { if (typeof s[k] !== 'number' || !isFinite(s[k])) noNum.push(c + ' ' + s.p + ' ' + k); }); }));
check('x, y, z, cota y profundidades son números', noNum.length === 0, noNum.slice(0, 5).join(' · '));
const mxmy = malos((c) => typeof MD[c].mx !== 'number' || typeof MD[c].my !== 'number');
check('mx y my son números en todos', mxmy.length === 0);
// 4 · atributos
const inc = [];
codes.forEach((c) => MC[c].forEach((s) => {
  const mot = esMot(s.p), err = [];
  if (Math.abs(s.lh - (s.pm + s.am)) > 0.0005) err.push('lh≠pm+am');
  if (Math.abs(s.ph - (s.lh - (s.co - s.z))) > 0.0005) err.push('ph≠lh−(co−z)');
  if (s.am !== (mot ? 1.48 : 1.455)) err.push('am');
  if (mot && (s.pf !== 'W6x8.5' || s.ci !== 'HD')) err.push('motora no W6x8.5/HD');
  if (!['W6x8.5', 'C150x70x18x3'].includes(s.pf)) err.push('perfil ' + s.pf);
  if (!['HD', 'Predrilling+HD'].includes(s.ci)) err.push('cimentación ' + s.ci);
  if (err.length) inc.push(c + ' ' + s.p + ': ' + err.join(','));
}));
check('atributos coherentes (lh, ph, am; motora y cardán W6x8.5 y HD; perfiles y cimentaciones conocidos)', inc.length === 0, inc.slice(0, 5).join(' · '));
// 5 · confianza y deducciones
const conf = {}; codes.forEach((c) => { conf[MD[c].conf] = (conf[MD[c].conf] || 0) + 1; });
check('confianza de cada número: 57 confirmados, 952 con pista, 747 deducidos', JSON.stringify(conf) === JSON.stringify({ confirmado: 57, pista: 952, deducido: 747 }) || (conf.confirmado === 57 && conf.pista === 952 && conf.deducido === 747 && Object.keys(conf).length === 3), JSON.stringify(conf));
const dedMal = []; let nDed = 0, nXY = 0;
codes.forEach((c) => MC[c].forEach((s) => { if (s.ded) { nDed++; if (!Array.isArray(s.ded) || !s.ded.length || s.ded.some((k) => !['pf', 'pm', 'ci'].includes(k))) dedMal.push(c + ' ' + s.p); } if (s.xyDed) nXY++; }));
check('lo deducido de un soporte sólo es perfil, profundidad mínima o cimentación (5.812 soportes)', dedMal.length === 0 && nDed === 5812, dedMal.slice(0, 3).join(' ') + ' · ' + nDed);
check('una sola posición deducida (H-27)', nXY === 1, String(nXY));

console.log(ok + ' comprobaciones OK' + (fallos ? ' · ' + fallos + ' FALLAN' : ''));
process.exit(fallos ? 1 : 0);
