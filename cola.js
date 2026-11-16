/* Cola local de escrituras de la app de control de obra (auditoría Construct F0, H-04).
 *
 * El SDK web de Realtime Database sólo guarda en MEMORIA lo escrito sin conexión. Lo dice Firebase en
 * «Read and Write Data on the Web», apartado «Work with data offline»: «The Firebase Realtime Database
 * web APIs do not persist data offline outside of the session» y «the web page must not be closed
 * before the data is written to the server». En obra, sin cobertura, cerrar la app antes de
 * recuperarla perdía lo apuntado.
 *
 * Esta cola apunta cada escritura en el almacenamiento del navegador ANTES de mandarla y la borra
 * cuando el servidor la confirma. Al volver a abrir la app con el mismo usuario, lo que quedó sin
 * confirmar se manda otra vez, en el mismo orden y por la misma fachada de la planta.
 *  · set, update y remove se reenvían tal cual: repetirlos deja la base igual.
 *  · push se apunta con la clave que ya generó el SDK y se reenvía como set en esa clave: si el
 *    servidor llegó a recibirlo, no se duplica la entrada del registro.
 *  · Las rutas se guardan tal como las pide la app (relativas a la planta): un reenvío no puede
 *    escribir fuera de la planta. Hay una cola por planta.
 *  · Sólo se reenvía lo de quien lo escribió (autoría y permisos); lo de otro usuario espera a que
 *    vuelva a entrar ese usuario.
 *  · Si el servidor rechaza una escritura (p. ej. permisos), sale de la cola y se avisa; no se insiste.
 *  · Si el navegador no deja guardar (modo privado, sin espacio), la app sigue como antes y lo avisa.
 *  · Si un cambio llegó al servidor y se perdió la confirmación, el reenvío repite el mismo valor; si
 *    entre medias otro usuario cambió ese mismo dato, gana el reenvío, igual que cuando el SDK
 *    reconecta sin cerrar la app.
 */
(function (global) {
  'use strict';

  function unir(a, b) { return a ? a + '/' + b : String(b); }
  function rel(p) { return (p === undefined || p === null) ? '' : String(p); }
  function motivo(err) { return (err && (err.code || err.message)) || String(err); }

  /* opts: almacen (como localStorage, o null si el navegador no lo da), clave, usuario() → uid o null,
   * aviso(texto) para lo que la persona debe saber. */
  function crear(opts) {
    var almacen = opts.almacen, clave = opts.clave, aviso = opts.aviso || function () {};
    var enVuelo = {}, n = 0, avisadoSinAlmacen = false;
    var sesion = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    function sinAlmacen() {
      if (!avisadoSinAlmacen) {
        avisadoSinAlmacen = true;
        aviso('Este navegador no deja guardar los cambios pendientes: sin conexión, no cierres la app hasta que vuelva');
      }
      return false;
    }
    function leer() {
      if (!almacen) return [];
      try { var v = JSON.parse(almacen.getItem(clave) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }
    function guardar(lista) {
      if (!almacen) return sinAlmacen();
      try { if (lista.length) almacen.setItem(clave, JSON.stringify(lista)); else almacen.removeItem(clave); return true; } catch (e) { return sinAlmacen(); }
    }
    function quitar(id) { delete enVuelo[id]; guardar(leer().filter(function (e) { return e.id !== id; })); }
    function seguir(e, p) {
      p.then(function () { quitar(e.id); }, function (err) {
        quitar(e.id);
        aviso('El servidor no aceptó un cambio (' + (e.ruta || 'raíz') + '): ' + motivo(err));
      });
      return p;
    }

    /* Apunta la escritura, la manda con enviar() y la borra cuando el servidor la confirma. */
    function escribir(op, ruta, valor, enviar) {
      var uid = opts.usuario();
      if (!uid) return enviar(); // sin sesión (p. ej. el alta de una cuenta): como antes
      var e = { id: sesion + '-' + (++n), uid: uid, t: Date.now(), op: op, ruta: ruta, valor: valor === undefined ? null : valor };
      enVuelo[e.id] = true;
      var lista = leer(); lista.push(e); guardar(lista);
      var p;
      try { p = enviar(); } catch (err) { quitar(e.id); throw err; } // el SDK la rechazó al momento: no se guarda
      return seguir(e, p);
    }

    /* Vuelve a mandar, por la fachada de la planta, lo que quedó sin confirmar de este usuario. */
    function reenviar(fachada, uid) {
      var lista = leer().filter(function (e) { return e.uid === uid && !enVuelo[e.id]; });
      lista.forEach(function (e) {
        enVuelo[e.id] = true;
        var r = fachada.ref(e.ruta === '' ? undefined : e.ruta), p;
        try { p = e.op === 'remove' ? r.remove() : r[e.op](e.valor); } catch (err) {
          quitar(e.id); aviso('Un cambio guardado no era válido y se descarta: ' + motivo(err)); return;
        }
        seguir(e, p);
      });
      return lista.length;
    }

    function pendientes(uid) { return leer().filter(function (e) { return uid === undefined || e.uid === uid; }); }

    return { escribir: escribir, reenviar: reenviar, pendientes: pendientes };
  }

  /* La fachada de la planta (PlantasObra.dbDePlanta) con sus escrituras pasando por la cola. Lo demás
   * (lecturas, escuchas, consultas) va directo al SDK, sin tocarlo. */
  function envolver(fachada, cola) {
    function conCola(r, ruta) {
      return new Proxy(r, {
        get: function (t, k) {
          if (k === 'set') return function (v) { return cola.escribir('set', ruta, v, function () { return t.set(v); }); };
          if (k === 'update') return function (o) { return cola.escribir('update', ruta, o, function () { return t.update(o); }); };
          if (k === 'remove') return function () { return cola.escribir('remove', ruta, null, function () { return t.remove(); }); };
          if (k === 'push') {
            return function (v) {
              var hijo = t.push(); // sólo genera la clave, sin escribir
              if (v === undefined) return hijo;
              var p = cola.escribir('set', unir(ruta, hijo.key), v, function () { return hijo.set(v); });
              return { key: hijo.key, ref: hijo, then: p.then.bind(p), catch: p.catch.bind(p) };
            };
          }
          if (k === 'child') return function (c) { return conCola(t.child(c), unir(ruta, c)); };
          var x = Reflect.get(t, k, t);
          return typeof x === 'function' ? x.bind(t) : x;
        }
      });
    }
    return { ref: function (p) { return conCola(fachada.ref(p), rel(p)); }, ruta: fachada.ruta };
  }

  global.ColaObra = { crear: crear, envolver: envolver };
})(typeof window !== 'undefined' ? window : this);
