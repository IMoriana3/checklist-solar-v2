# Checklist Solar v2 — ISFV Atalaya

> PWA de checklists de obra para plantas fotovoltaicas: control de construcción, calidad, punchlist, mapa y resumen, con datos en tiempo real.

## Qué es
Aplicación web progresiva (PWA) para el seguimiento de obra de la planta **ISFV Atalaya**. Permite registrar y consultar, seguidor a seguidor (`PV<nn>/Sub<n>`), el avance de construcción, los controles de calidad y el punchlist de incidencias, con **sincronización en tiempo real** entre dispositivos.

## Funcionalidades
- **Auth** con Firebase (email + contraseña); las cuentas las crea el supervisor.
- **Construcción** 🏗️ — checklist de avance por seguidor, con autor y fecha (log de cambios).
- **Calidad** ✅ — controles de calidad por seguidor con su propio workflow.
- **Punchlist** 📝 — incidencias (PV, sub, fase, seguidor, pilar, campo, descripción) con ciclo detectado → reparado → verificado.
- **Mapa** 🗺️ — vista de la planta. **Resumen** 📊 — consolidado de Construcción + Calidad.
- **Exportación a Excel** 📥 de todos los datos. **Admin** — utilidades y carga de datos demo.

## Uso
1. Abre `index.html` (o el despliegue); instálala como PWA si quieres.
2. **Login** con email y contraseña. ¿Sin cuenta? Crear cuenta y pide credenciales a tu supervisor.
3. Trabaja por seguidor en Construcción / Calidad / Punchlist; revisa Mapa y Resumen; exporta a Excel.

## Stack
HTML / JS — **PWA** instalable (`manifest.json` + `sw.js`) · **Firebase** Authentication + Realtime Database (proyecto `construccionxamai`, región `europe-west1`) · GitHub Pages.

## Despliegue (URL)
GitHub Pages: https://imoriana3.github.io/checklist-solar-v2/ · `.nojekyll` incluido.

## Varias plantas (`plantas.js`)
La app ya no lleva Atalaya escrita a mano: cada planta tiene un perfil en **`plantas.js`** con su
nombre y marca, el plan de obra, el fichero de seguidores y **los soportes de cada tipo de seguidor**.
- **Elegir planta:** `index.html?planta=<id>`. Sin parámetro se abre Atalaya, así que los enlaces de
  siempre siguen funcionando. Si la planta no existe, la app se para y no cae en Atalaya.
- **Dónde se guardan los datos:** Atalaya, en la raíz de la base, como siempre (no se ha movido nada).
  Cualquier otra planta, sólo bajo `plantas/<id>/`. Los usuarios (`users/`) son comunes.
- **Sin soportes no se abre:** si una planta no declara cuántos soportes tiene cada tipo de
  seguidor, la app lo dice y no la abre, porque tendría que inventarlos. Antes, a falta de datos,
  el plan suponía 15.000 hincas.
- **Para dar de alta una planta:** añade su perfil a `PLANTAS` y su fichero de seguidores (mismo
  formato que `master.js`). `tests/test_plantas.cjs` dice qué falta, si falta algo.
- **Requisito en Firebase (consola):** las reglas de seguridad tienen que permitir leer y escribir
  bajo `plantas/<id>/` a los usuarios de esa planta. No viven en este repo.

## Tests
`bash tests/correr.sh` (Node 22 + Playwright con Chromium). Comprueban que Atalaya lee y escribe
exactamente las mismas rutas que antes del cambio (`tests/fixtures/linea_base_atalaya.json`), que una
planta desconocida o sin soportes no toca la base y que una planta nueva sólo usa `plantas/<id>/`.
Firebase se sustituye por un doble de prueba: no hay red ni datos reales.

## Notas
- Planta: **ISFV Atalaya** · Cliente: **X-ELIO**.
- Las rutas de Firebase usan **guiones bajos, nunca puntos** (no permitidos en claves de Realtime Database).
- Sincronización en tiempo real (`keepSynced`). Ojo: en el navegador es **en memoria**, no en disco; lo
  pendiente sin conexión se pierde si se cierra la app antes de reconectar (auditoría Construct F0, H-04).
- Pendiente: rediseñar el Dashboard con tema claro estilo Amelia (ref. brochure pág. 6).

*Factiun · proyecto interno.*
