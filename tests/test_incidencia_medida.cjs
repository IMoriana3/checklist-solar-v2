/* Flujo de incidencia desde una medida real en Firebase falso. */
const assert = require('node:assert/strict');
const { abrirApp } = require('./arnes_navegador.cjs');

const tracker = 'TR01.015', campo = 'fm_1_vert_ns', id = 'med_TR01_015_' + campo;
const calidad = { [campo]: 120, [campo+'_ts']: 2000, [campo+'_by']: 'Inspector' };
const legado = { tracker, pilar:'3N-MP', pv:1, sub:0, phase:'hincado', desc:'Manual', estado:'pendiente' };
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
    await page.locator('input[name=foto]').setInputFiles({
      name:'poste.png',mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==','base64')
    });
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
})().catch(error => {console.error(error);process.exitCode=1});
