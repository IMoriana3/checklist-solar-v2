/* Doble de prueba de Firebase (compat 10.x) para los bancos de navegador. NO es para producción.
 * Sustituye a firebase-app-compat.js; los otros dos scripts de Firebase se sirven vacíos.
 * Registra cada operación sobre la base en window.__FB_LOG como {op, path} y guarda en memoria.
 * La sesión la decide el banco antes de cargar: window.__FB_USER (null = sin sesión) y
 * window.__FB_SEED (datos iniciales, p. ej. el perfil del usuario).
 * Sin conexión (window.__FB_OFFLINE): como el SDK web, las escrituras se ven en local pero el servidor
 * no las confirma (la promesa no se resuelve) y mueren con la página. Lo que el servidor confirma se
 * apunta en window.__FB_SERVIDOR como {op, path, val}. window.__FB_RECHAZA: prefijos de ruta que el
 * servidor rechaza (como unas reglas sin permiso).
 */
(function () {
  var LOG = window.__FB_LOG = [];
  var SERVIDOR = window.__FB_SERVIDOR = [];
  var OFF = !!window.__FB_OFFLINE, RECHAZA = window.__FB_RECHAZA || [];
  function confirmar(op, path, val) {
    if (RECHAZA.some(function (p) { return path.indexOf(p) === 0; })) { var e = new Error('PERMISSION_DENIED: banco'); e.code = 'PERMISSION_DENIED'; return Promise.reject(e); }
    if (OFF) return new Promise(function () {});
    SERVIDOR.push({ op: op, path: path, val: val === undefined ? null : JSON.parse(JSON.stringify(val)) });
    return Promise.resolve();
  }
  var ROOT = window.__FB_STORE = JSON.parse(JSON.stringify(window.__FB_SEED || {}));
  var n = 0;
  function parts(p) { return (p || '').split('/').filter(Boolean); }
  function get(p) { var v = ROOT; parts(p).forEach(function (k) { v = (v && typeof v === 'object') ? v[k] : undefined; }); return v === undefined ? null : v; }
  function put(p, val) {
    var ks = parts(p); if (!ks.length) { ROOT = window.__FB_STORE = val || {}; return; }
    var o = ROOT; ks.slice(0, -1).forEach(function (k) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (val === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(val));
  }
  function join(a, b) { return a ? a + '/' + b : b; }
  function Snap(path, val) { this.key = parts(path).pop() || null; this._p = path; this._v = val === undefined ? get(path) : val; }
  Snap.prototype.val = function () { return this._v; };
  Snap.prototype.exists = function () { return this._v !== null; };
  Snap.prototype.forEach = function (cb) { var v = this._v || {}, p = this._p; Object.keys(v).forEach(function (k) { cb(new Snap(join(p, k), v[k])); }); };
  function Ref(path) { this.path = path; this.key = parts(path).pop() || null; }
  function log(op, path) { LOG.push({ op: op, path: path }); }
  Ref.prototype.child = function (c) { return new Ref(join(this.path, c)); };
  Ref.prototype.orderByChild = function () { return this; };
  Ref.prototype.limitToLast = function () { return this; };
  Ref.prototype.startAt = function () { return this; };
  Ref.prototype.once = function (ev, cb) { log('once', this.path); var s = new Snap(this.path); if (typeof cb === 'function') cb(s); return Promise.resolve(s); };
  Ref.prototype.on = function (ev, cb) {
    log('on', this.path);
    var s = this.path === '.info/connected' ? new Snap(this.path, !OFF) : new Snap(this.path);
    if (typeof cb === 'function') setTimeout(function () { cb(s); }, 0);
    return cb;
  };
  Ref.prototype.off = function () {};
  Ref.prototype.set = function (v) { log('set', this.path); put(this.path, v); return confirmar('set', this.path, v); };
  Ref.prototype.remove = function () { log('remove', this.path); put(this.path, null); return confirmar('remove', this.path, null); };
  Ref.prototype.update = function (o) { var self = this; Object.keys(o || {}).forEach(function (k) { log('update', join(self.path, k)); put(join(self.path, k), o[k]); }); return confirmar('update', this.path, o); };
  /* Como el SDK: devuelve la referencia hija (con clave única) y, si hay valor, la escribe. */
  Ref.prototype.push = function (v) {
    var k = '-K' + Date.now().toString(36) + (++n), r = new Ref(join(this.path, k)); log('push', this.path);
    var p = Promise.resolve();
    if (v !== undefined) { put(r.path, v); p = confirmar('set', r.path, v); }
    r.then = function (a, b) { return p.then(a, b); }; r.catch = function (b) { return p.catch(b); };
    return r;
  };
  Ref.prototype.transaction = function (change) {
    var self = this, value = change(get(self.path));
    log('transaction', self.path);
    if (value === undefined) return Promise.resolve({ committed: false, snapshot: new Snap(self.path) });
    var now = Date.now();
    value = JSON.parse(JSON.stringify(value), function (k, v) { return v && v['.sv'] === 'timestamp' ? now : v; });
    return confirmar('transaction', self.path, value).then(function () {
      put(self.path, value);
      return { committed: true, snapshot: new Snap(self.path) };
    });
  };
  Ref.prototype.keepSynced = function () { log('keepSynced', this.path); };
  function database() { return { ref: function (p) { return new Ref(p || ''); }, goOnline: function () {}, goOffline: function () {} }; }
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  var listeners = [];
  var authObj = {
    currentUser: null,
    onAuthStateChanged: function (cb) { listeners.push(cb); setTimeout(function () { authObj.currentUser = window.__FB_USER || null; cb(authObj.currentUser); }, 0); return function () {}; },
    signInWithEmailAndPassword: function () { return Promise.reject(new Error('banco: sin login real')); },
    createUserWithEmailAndPassword: function () { return Promise.reject(new Error('banco: sin alta real')); },
    signOut: function () { authObj.currentUser = null; listeners.forEach(function (cb) { cb(null); }); return Promise.resolve(); }
  };
  window.firebase = { initializeApp: function () { return {}; }, database: database, auth: function () { return authObj; } };
})();
