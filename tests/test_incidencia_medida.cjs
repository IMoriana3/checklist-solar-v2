/* Flujo de incidencia desde una medida real en Firebase falso. */
const assert = require('node:assert/strict');
const { abrirApp } = require('./arnes_navegador.cjs');

const tracker = 'TR01.015', campo = 'fm_1_vert_ns', id = 'med_TR01_015_' + campo;
const calidad = { [campo]: 120, [campo+'_ts']: 2000, [campo+'_by']: 'Inspector' };
const legado = { tracker, pilar:'3N-MP', pv:1, sub:0, phase:'hincado', desc:'Manual', estado:'pendiente' };
const foto = {
  name:'poste.png',mimeType:'image/png',
  buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==','base64')
};
const leer = page => page.evaluate(id => window.__FB_STORE.punchlist?.[id], id);
const pantalla = (page, mode) => page.evaluate(([tracker, mode]) => {
  Object.assign(V, {screen:mode,calTr:tracker,qTab:'cim',qFila:'motor',qPi:1,viewOnly:false});
  R();
}, [tracker, mode]);
const abrir = page => page.getByText('Abrir incidencia', {exact:true}).click();
const guardar = page => page.getByRole('button', {name:'Añadir al Punchlist'}).click();
const estado = (page, expected) => page.waitForFunction(([id, expected]) => window.__FB_STORE.punchlist?.[id]?.estado === expected, [id, expected]);
const guardarMedida = (page, valor, ts) => page.evaluate(([campo, valor, ts]) => {
  return db.ref('quality/TR01_015').update({[campo]:valor,[campo+'_ts']:ts,[campo+'_by']:'Reinspector'});
}, [campo, valor, ts]);
(async () => {
  const app = await abrirApp({semilla:{quality:{TR01_015:calidad},punchlist:{legacy:legado}}});
  const {page} = app;
  try {
    await pantalla(page,'qualtracker');
    await abrir(page);
    await page.locator('input[name=foto]').setInputFiles(foto);
    await guardar(page);
    await estado(page,'pendiente');
    await page.getByText('Ver incidencia · pendiente',{exact:true}).waitFor();
    let p = await leer(page);
    assert.equal(p.campo,campo);
    assert.equal(p.pilar,'3N-MP');
    assert.equal(p.medicion.valor,120);
    assert.equal(p.medicion.max,102);
    assert.equal(p.medicion.autor,'Inspector');
    assert.match(p.foto,/^data:image\/jpeg;base64,/);
    assert.equal(await page.getByText('Abrir incidencia',{exact:true}).count(),0);
    assert.equal(await page.evaluate(() => window.__FB_STORE.punchlist.legacy.desc),'Manual');

    await page.evaluate(id => setPLEstado(id,'reparado'), id);
    await estado(page,'reparado');
    const reparada = await leer(page);
    await page.getByText('Ver incidencia · reparado',{exact:true}).click();
    await page.getByRole('button',{name:'Verificar con la nueva medida'}).click();
    await page.getByText('Registra una medida conforme posterior a la reparación.',{exact:true}).waitFor();
    assert.equal((await leer(page)).estado,'reparado');

    await guardarMedida(page,102,reparada.fechaReparacion+1);
    await page.getByRole('button',{name:'Verificar con la nueva medida'}).click();
    await estado(page,'verificado');
    p = await leer(page);
    assert.equal(p.medicion.valor,120);
    assert.equal(p.reinspeccion.valor,102);
    assert.equal(p.reinspeccion.autor,'Reinspector');

    await guardarMedida(page,103,reparada.fechaReparacion+2);
    await pantalla(page,'qualtracker');
    await abrir(page);
    await guardar(page);
    await estado(page,'pendiente');
    p = await leer(page);
    assert.equal(p.medicion.valor,103);
    assert.equal(p.historial.length,1);
    assert.equal(p.historial[0].reinspeccion.valor,102);

    await page.evaluate(() => { U.role='construccion'; V.viewOnly=true; R(); });
    await page.getByText('Ver incidencia · pendiente',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Añadir al Punchlist'}).count(),0);
    assert.deepEqual(app.errores,[]);
    console.log('Incidencia con foto, reparación, reinspección, nueva incidencia e historial OK');
  } finally {await app.cerrar()}
  const desconectada = await abrirApp({offline:true,semilla:{quality:{TR01_015:calidad}}});
  try {
    const page = desconectada.page;
    await pantalla(page,'qualtracker');
    await abrir(page);
    await page.locator('input[name=foto]').setInputFiles(foto);
    await page.getByRole('button',{name:'Guardar borrador'}).click();
    await page.getByText('Borrador de incidencia',{exact:true}).waitFor();
    assert.equal(await leer(page),undefined);
    await page.close();

    // Al reabrir con conexión, el servidor puede mostrar ya otra lectura. Se envía la original.
    const semilla = {quality:{TR01_015:{...calidad,[campo]:102}}};
    const reabierta = await desconectada.otraPagina({offline:false,semilla});
    await reabierta.page.evaluate(([tracker,campo]) => {
      const clave = claveBorradorIncidencia(U.uid,tracker,campo);
      const copia = localStorage.getItem(clave);
      localStorage.setItem(claveBorradorIncidencia('otro-usuario',tracker,campo),copia);
      localStorage.setItem(clave.replace(prefijoBorradorIncidencia(U.uid),'obra:nc:otra-planta:'+U.uid+':'),copia);
    },[tracker,campo]);
    await pantalla(reabierta.page,'calselect');
    const borradores = reabierta.page.getByRole('region',{name:'Borradores de incidencias'});
    await borradores.getByText('Borradores de incidencias (1)',{exact:true}).waitFor();
    await borradores.getByRole('button',{name:/TR01\.015.*3N-MP/}).click();
    await reabierta.page.getByRole('link',{name:'Descargar foto del borrador'}).waitFor();
    assert.equal(await reabierta.page.evaluate(() => V.qPi),1);
    await reabierta.page.getByRole('button',{name:'Enviar borrador'}).click();
    await estado(reabierta.page,'pendiente');
    const nc = await leer(reabierta.page);
    assert.equal(nc.medicion.valor,120);
    assert.match(nc.foto,/^data:image\/jpeg;base64,/);
    assert.ok(nc.fechaCaptura<=nc.fechaDeteccion);
    await reabierta.page.getByText('Ver incidencia · pendiente',{exact:true}).click();
    assert.equal(await reabierta.page.getByRole('button',{name:'Descartar borrador'}).count(),0);
    await pantalla(reabierta.page,'calselect');
    assert.equal(await borradores.count(),0);
    assert.deepEqual(reabierta.errores,[]);
    console.log('Borrador offline con foto, cierre de página y envío de la lectura original OK');
  } finally {await desconectada.cerrar()}
  const fase = await abrirApp({semilla:{
    workflow:{'1_0_hincado':{state:'CAL'}},
    punchlist:{
      primera:legado,
      segunda:{...legado,estado:'reparado'},
      otroSubcampo:{...legado,sub:1},
      otraFase:{...legado,phase:'montaje'}
    }
  }});
  try {
    const page = fase.page;
    await page.evaluate(() => {Object.assign(V,{screen:'caldetail',calPv:1,calSub:0,viewOnly:false});R()});
    const aprobar = page.getByRole('button',{name:'✅ Aprobado',exact:true});
    await page.getByText('Quedan 2 incidencias por verificar.',{exact:true}).waitFor();
    assert.equal(await aprobar.isEnabled(),false);
    // Aunque la vista no tenga la caché cargada, la acción comprueba los datos de la fase.
    await page.evaluate(async () => { CACHE.punchlist={}; await setWFState(1,0,'hincado','OK','admin'); });
    assert.equal(await page.evaluate(() => window.__FB_STORE.workflow['1_0_hincado'].state),'CAL');
    assert.equal(await page.evaluate(() => window.__FB_STORE.workflow_log),undefined);

    await page.evaluate(async () => {
      await db.ref('punchlist/primera').update({estado:'verificado'});
      await db.ref('punchlist/segunda').update({estado:'verificado'});
      ONLINE=false;
      await setWFState(1,0,'hincado','OK','manual');
    });
    assert.equal(await page.evaluate(() => window.__FB_STORE.workflow['1_0_hincado'].state),'CAL');
    await page.evaluate(async () => {
      ONLINE=true;
      await Promise.all([setWFState(1,0,'hincado','OK','manual'),setWFState(1,0,'hincado','OK','manual')]);
    });
    const aprobacion = await page.evaluate(() => ({
      estado:window.__FB_STORE.workflow['1_0_hincado'].state,
      log:Object.values(window.__FB_STORE.workflow_log).map(item => [item.key,item.state])
    }));
    assert.deepEqual(aprobacion,{estado:'OK',log:[['1_0_hincado','OK']]});
    assert.deepEqual(fase.errores,[]);
    console.log('Aprobación de fase: incidencias pendientes, reparadas, datos por fase y conexión OK');
  } finally {await fase.cerrar()}
})().catch(error => {console.error(error);process.exitCode=1});
