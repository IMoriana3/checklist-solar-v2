Checklist Solar v2 — ISFV ATALAYA
> PWA de checklists de obra para plantas fotovoltaicas: control de
> construcción, calidad, punchlist, mapa y resumen, con datos en tiempo real.
Planta: ISFV ATALAYA · Cliente: XAMAI · X-ELIO · Versión: v2.8
¿Qué es?
Aplicación web progresiva (PWA) para el seguimiento de obra de la planta
fotovoltaica ISFV ATALAYA. Permite registrar y consultar, seguidor a
seguidor (`PV<nn>/Sub<n>`), el avance de construcción, los controles de calidad
y el punchlist de incidencias, con sincronización en tiempo real entre
dispositivos.
Funcionalidades
Acceso con Firebase Auth (email + contraseña); las cuentas las crea el supervisor.
Construcción 🏗️ — checklist de avance por seguidor, con registro de autor y fecha (log de cambios).
Calidad ✅ — controles de calidad por seguidor, con su propio workflow.
Punchlist 📝 — alta de incidencias (PV, sub, fase, seguidor, pilar, campo, descripción) y ciclo detectado → reparado → verificado.
Mapa 🗺️ — vista de la planta.
Resumen 📊 — consolidado de Construcción + Calidad.
Exportación a Excel 📥 de todos los datos.
Admin — utilidades de administración y carga de datos demo.
Acceso
Pantalla de login → Entrar con email y contraseña.
¿Sin cuenta? Crear cuenta y pide las credenciales a tu supervisor.
Stack
HTML / JS — PWA instalable (`manifest.json`)
Firebase — Authentication + Realtime Database
(proyecto `construccionxamai`, región `europe-west1`)
GitHub Pages (despliegue)
Notas técnicas
Las rutas de Firebase usan guiones bajos, nunca puntos (no se permiten en
las claves de Realtime Database).
Sincronización en tiempo real con persistencia (`keepSynced`).
Pendientes
[ ] Rediseñar el Dashboard con tema claro estilo Amelia (ref. brochure pág. 6).
Historial
v2.8 — Todos los módulos funcionando.
