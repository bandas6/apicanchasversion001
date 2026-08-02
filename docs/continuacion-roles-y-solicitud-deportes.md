# Continuacion: roles canonicos + solicitud de deportes (2026-08-01)

Doc espejo del que vive en el frontend (`canchas-app-flutter/docs/continuacion-roles-y-auditoria-rbac.md`,
seccion "Continuacion 2026-08-01 (sesion 2)"). Este archivo documenta especificamente lo que
aplica a este repo (backend).

---

## Auditoria de roles (sin cambios de codigo — el backend ya estaba correcto)

Se audito todo el repo (`grep -rn` sobre `.js`) buscando literales de rol legacy
(`ADMIN_GENERAL_ROL`, `ADMIN_ROL`, `ADMIN_USER_ROL`, `USER_ROL`) fuera de
`helpers/ensure-system-roles.js`. **Cero resultados.** El backend ya usaba nombres canonicos
(`DEV`/`ADMIN`/`USER`) en todos lados:
- `helpers/ensure-system-roles.js` — `SYSTEM_ROLES` define los 3 roles canonicos,
  `ROLE_ALIASES` traduce cualquier valor legacy al canonico, y `ensureSystemRoles()` (corre en
  cada arranque exitoso, `models/server.js`) migra `Roles`/`Usuarios.rol` existentes sin
  borrar los roles nuevos (a diferencia de una version anterior documentada en el handoff del
  frontend, que si los borraba — eso ya no aplica, este merge lo corrigio).
- `middlewares/validar-roles.js` — `ADMIN_ROLES = ['ADMIN', 'DEV']`, usado consistentemente.
- `routes/deportes.js` — `crearDeporte`/`actualizarDeporte` ya gateados a `esAdminGeneralRol`
  (exige `DEV` exacto). El deporte de prueba "hola" reportado por Jonathan lo creo alguien con
  cuenta `DEV` — no hay hueco de permisos, es dato de prueba a limpiar/completar, no un bug.
- `centro-mensajes.controller.js` — `AUDIENCIAS_VALIDAS = ['ALL','AUTHENTICATED','USER','ADMIN','DEV']`.

**Todos los bugs de roles encontrados esta sesion estaban en el frontend** (que le mandaba
valores legacy a estos endpoints ya correctos): endpoint de superadmin devolviendo 400,
usuario "promovido" sin permisos reales, mensajes de audiencia que nunca validaban. Ver el
doc del frontend para el detalle linea por linea.

---

## Flujo nuevo: solicitud de deportes (implementado, sin probar E2E)

Motivacion: el catalogo de deportes ya requeria `DEV` para crear/editar, pero no habia forma
de que un `ADMIN` (admin de complejo) pidiera un deporte faltante sin salirse de la app.
Replica el patron ya usado en `complex-claims` (solicitud → cola de revision de `DEV` →
aprobar/rechazar).

### Archivos nuevos

- `models/sport-requests.js` — coleccion `sport_requests`.
- `controllers/sport-requests.controller.js` — `crearSolicitudDeporte`,
  `obtenerMisSolicitudesDeporte`, `obtenerSolicitudesDeporteAdmin`, `revisarSolicitudDeporte`.
- `routes/sport-requests.js` — montado en `models/server.js` bajo `/api/solicitudes-deporte`.

### Reglas de negocio

- `POST /api/solicitudes-deporte` — requiere `esAdminRol` (ADMIN o DEV a nivel de
  middleware), pero el controller **bloquea explicitamente a `DEV`** con 403 (puede agregar
  deportes directamente desde el catalogo, no necesita solicitar). Valida que el nombre no
  exista ya en el catalogo real (mismo chequeo de nombre/slug case-insensitive que
  `crearDeporte`) ni tenga ya una solicitud propia pendiente con ese nombre.
- `GET /api/solicitudes-deporte/me` — cualquier usuario autenticado ve sus propias
  solicitudes.
- `GET /api/solicitudes-deporte/admin` y `PATCH /api/solicitudes-deporte/admin/:id` — solo
  `DEV` (`esAdminGeneralRol`). Al aprobar (`estado: 'aprobado'`), crea el `Deporte` real
  reusando la logica de slugify + dedupe de `deportes.controller.js` y lo enlaza en
  `deporteCreado`; si el deporte ya existe (creado por otra via mientras la solicitud estaba
  pendiente), solo enlaza el existente en vez de duplicar. Al rechazar, solo cambia `estado` +
  `respuestaRevision`. Ambos casos quedan auditados via `auditAdminGeneralAction` (mismo
  helper que el resto de acciones de superadmin).

### Estado de verificacion

Solo se verifico con `node --check` sobre todos los `.js` del repo (sin sintaxis rota). **No
se probo en runtime contra una base de datos real** — el intento de correr el backend local en
esta sesion quedo bloqueado en autenticacion de MongoDB Atlas (`bad auth`, codigo 8000;
credenciales o IP allowlist a revisar) y Jonathan decidio no priorizar resolver eso ahora.
**Antes de desplegar, probar de punta a punta:** crear solicitud como ADMIN → aprobar como
DEV → confirmar que el deporte aparece en `GET /deportes` y que `deporteCreado` quedo enlazado
correctamente.

---

## Setup local (para referencia futura)

- `.env` (gitignored) creado con: `PORT`, `SECRETORPRIVATEKEY`, `MONGO_DBCNN` (Atlas,
  cluster `cluster0/data`), `CLOUDINARY_URL`, `MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1`.
- El Node global de la maquina (v25.8.1) rompe al arrancar (`buffer-equal-constant-time` via
  `jwa`/`jsonwebtoken` usa `SlowBuffer.prototype`, removido en Node 25). Se instalo `node@20`
  via Homebrew **keg-only** (no se toco el `node` global): binario en
  `/opt/homebrew/opt/node@20/bin/node`. Reinstalar dependencias con esa version
  (`rm -rf node_modules package-lock.json && /opt/homebrew/opt/node@20/bin/npm install`) antes
  de intentar correr `node app.js` de nuevo si hace falta.
- Con eso el proceso arranca pero falla en `mongoose.connect` con `bad auth`. Pendiente:
  confirmar credenciales de Atlas o agregar la IP de la maquina al Network Access del cluster.

## Rama de esta sesion

`chore/local-dev-node20-setup` (creada desde `main`). Cambios: `package-lock.json`
(regenerado con Node 20, sin relacion con roles/deportes), `models/server.js` (registro de la
ruta nueva), mas los 3 archivos nuevos de solicitud de deportes. Sin commit todavia.
