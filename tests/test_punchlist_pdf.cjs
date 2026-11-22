/* Comprueba el contrato del exportador con jsPDF sin navegador ni Firebase. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extrac = (inicio, fin) => src.slice(src.indexOf(inicio),src.indexOf(fin,src.indexOf(inicio)));
const archivo = 'Punchlist_PV1_Sub2_hincado.pdf';
let items = [], ops = [];
class PDF {
  setFontSize(){}
  setFont(){}
  setLineWidth(){}
  setTextColor(){}
  line(){}
  addPage(){ops.push(['page']);}
  text(s,x,y){assert.ok(y<=279,'texto fuera de página');ops.push(['text',s]);}
  splitTextToSize(s){return [s];}
  getImageProperties(s){
    if(s.endsWith('AAAA'))throw new Error('foto dañada');
    return {width:720,height:480};
  }
  addImage(s,type,x,y,w,h){assert.ok(y+h<=279);ops.push(['image',s,type,w,h]);}
  save(nombre){assert.equal(nombre,archivo);}
}
const ctx = {
  window:{jspdf:{jsPDF:PDF}},
  PLANTA:{nombre:'Planta de prueba'},
  WF_LABELS:{hincado:'Hincado'},
  U:{name:'Inspector'}, getPLItems:()=>items, toast:()=>{}
};
vm.createContext(ctx);
vm.runInContext(extrac('function textoMedida(', 'function fichaIncidenciaMedida(')+
  extrac('function exportPunchlistPDF(', '// VERSIONING'),ctx);

const manual = {id:'manual',d:{tracker:'TR01.014',pilar:'MP',desc:'Incidencia manual',estado:'pendiente'}};
items=[manual];
ctx.exportPunchlistPDF(1,2,'hincado');
assert.ok(ops.some(op=>op[1]==='Incidencia manual'));
assert.equal(ops.some(op=>op[0]==='page'),false);

const medida = valor => ({valor,unidad:'º',min:88,max:102,control:'Verticalidad N-S',autor:'Inspector',fecha:2000});
items=[...Array(47).fill(manual),{id:'nc',d:{
  tracker:'TR01.015',pilar:'3N-MP',estado:'verificado',medicion:medida(120),reinspeccion:medida(102),
  foto:'data:image/jpeg;base64,abcd',historial:[{estado:'verificado',medicion:medida(111),reinspeccion:medida(100),foto:'data:image/jpeg;base64,AAAA'}]
}}];
ops=[];
ctx.exportPunchlistPDF(1,2,'hincado');
for(const expected of ['Medidas y evidencias del Punchlist','TR01.015 · 3N-MP','Verticalidad N-S','Medida inicial: 120','Reinspección: 102','Incidencia anterior 1','Medida inicial: 111','Reinspección: 100','Foto: no disponible en el PDF.']){
  assert.ok(ops.some(op=>op[0]==='text'&&op[1].includes(expected)),expected);
}
assert.equal(ops.filter(op=>op[0]==='image').length,1);
assert.ok(ops.filter(op=>op[0]==='page').length>=2);
console.log('PDF Punchlist: incidencias manuales, medidas, foto, historial y paginación OK');
