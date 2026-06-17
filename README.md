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

## Notas
- Planta: **ISFV Atalaya** · Cliente: **X-ELIO**.
- Las rutas de Firebase usan **guiones bajos, nunca puntos** (no permitidos en claves de Realtime Database).
- Sincronización en tiempo real con persistencia (`keepSynced`).
- Pendiente: rediseñar el Dashboard con tema claro estilo Amelia (ref. brochure pág. 6).

*Factiun · proyecto interno.*
