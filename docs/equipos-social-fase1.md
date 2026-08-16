# Equipos / Social — Fase 1: equipos + membresia (2026-08-16)

Doc espejo del plan que vive en el frontend
(`canchas-app-flutter/docs/equipos-social-plan.md`). Este archivo documenta
especificamente lo que se implemento en este repo (backend) para la Fase 1.

---

## Hallazgo previo: scaffold legacy retirado

Antes de escribir codigo nuevo se encontro un scaffold viejo ya montado en la
API (`models/equipos.js`, `retos.js`, `partidos.js` + sus controllers/routes,
en `/api/equipos`, `/api/retos`, `/api/partidos`) que:

- No lo consumia el frontend actual (cero referencias en
  `canchas-app-flutter`).
- Tenia un modelo de datos incompatible con el plan: `Reto` era
  jugador-vs-jugador (no equipo-vs-equipo), `Usuario.equipo_id` era una
  referencia unica (asumia un solo equipo por usuario, contra la decision
  fundacional 1 del plan).
- Tenia codigo roto: `retos.controller.js:obtenerReto` referenciaba un
  `Partidos` nunca importado; `validar-generales.js:retoYaExistente`
  referenciaba un `Equipos` nunca importado.

Se retiro completo (commit `refactor(equipos): retirar scaffold legacy de
equipos/retos/partidos`), incluyendo `Usuario.equipo_id` y sus 3
`.populate()` en `usuarios.controller.js` (`obtenerUsuarios`,
`obtenerMiUsuario`, `obtenerUsuario`). `/api/jugadores` y `/api/solicitudes`
quedaron intactos — el primero se reusa para busqueda de jugadores (Fase 3),
el segundo es reservas de cancha, sin relacion con equipos pese al nombre
parecido.

## Modelo de datos nuevo

- **`models/equipos.js`** (`Equipo`): `nombre`, `deporte` (ref `Deporte`),
  `descripcion`, `nombreArchivoImagen`, `capitan` (ref `Usuario`), `estado`
  (soft delete), y 4 campos de record (`puntuacion`/`victorias`/`derrotas`/
  `empates`) que quedan en 0 hasta la Fase 6 — nada los escribe todavia.
- **`models/equipo-membresias.js`** (`EquipoMembresia`): una sola coleccion
  para roster + solicitudes/invitaciones pendientes (el campo `estado`
  distingue ambos casos, no hacen falta 2 colecciones). Campos clave:
  `equipo`, `usuario`, `deporte` (denormalizado desde el equipo al crear la
  membresia), `rol` (`capitan`/`miembro`), `origen`
  (`creacion`/`solicitud`/`invitacion`), `estado`
  (`pendiente`/`aceptada`/`rechazada`).

### Los 2 indices que hacen cumplir las reglas del plan

```js
// Una sola solicitud/invitacion pendiente por par equipo+usuario a la vez
// (se puede volver a pedir despues de un rechazo — no es un unique global).
{ equipo: 1, usuario: 1 } unique, partialFilterExpression: { estado: 'pendiente' }

// Decision fundacional 1: como mucho una membresia ACEPTADA por usuario y
// deporte, sin importar en que equipo. Es la garantia real contra
// condiciones de carrera; el controller ademas chequea esto antes de
// escribir para devolver un 400 legible en vez de un error crudo de Mongo.
{ usuario: 1, deporte: 1 } unique, partialFilterExpression: { estado: 'aceptada' }
```

## Reglas de autorizacion (extraidas como funciones puras, testeadas)

`helpers/equipos-social.js` — sin acceso a DB, mismo criterio que
`helpers/reservation-reputation.js` (este repo no tiene
mongodb-memory-server, asi que la logica de negocio real vive en funciones
puras para poder testearla con `node --test`):

- `puedeGestionarEquipo`: capitan del equipo, o admin.
- `puedeResponderMembresia`: una solicitud (el jugador pidio unirse) la
  responde el capitan; una invitacion (el capitan invito) la responde el
  jugador invitado. Nunca el que la origino.
- `puedeExpulsarMiembro`: capitan o admin, nunca a otro capitan.
- `puedeSalirDelEquipo`: cualquier miembro, nunca el capitan (para dejar el
  equipo como capitan hay que borrarlo — no hay transferencia de capitania
  en esta fase).

Tests: `test/equipos-social.test.js`, 8 casos.

## Endpoints (`/api/equipos`, `controllers/equipos.controller.js`)

| Metodo | Ruta | Que hace |
|---|---|---|
| POST | `/` | Crea equipo + membresia del capitan (`aceptada`, `origen: creacion`). |
| GET | `/` | Lista equipos activos (filtros `deporte`, `q`). |
| GET | `/:id` | Detalle + roster (membresias `aceptada`). |
| PUT | `/:id` | Editar nombre/descripcion/imagen — capitan o admin. |
| DELETE | `/:id` | Soft delete — capitan o admin. |
| GET | `/mis-equipos` | Equipos donde el usuario autenticado tiene membresia aceptada. |
| POST | `/:id/solicitudes` | Jugador pide unirse. |
| GET | `/:id/solicitudes` | Capitan ve las solicitudes entrantes pendientes. |
| POST | `/:id/invitaciones` | Capitan invita a un jugador. |
| GET | `/mis-solicitudes` | Usuario ve sus propias pendientes (enviadas + invitaciones recibidas). |
| PUT | `/:id/membresias/:membresiaId` | Aceptar/rechazar (`{ aceptar: true\|false }`). |
| DELETE | `/:id/membresias/:membresiaId` | Expulsar (capitan/admin). |
| DELETE | `/:id/membresia` | Salir del equipo (el propio usuario). |
| DELETE | `/solicitudes/:membresiaId` | Cancelar una solicitud propia pendiente. |

## Actualizacion 2026-08-16 (diseño 32 — "Mis equipos"): 2 correcciones

El diseño de las pantallas de esta fase (`implementar-mis-equipos.md`, verificaciones V4/V5)
encontro 2 huecos reales en la Fase 1 original:

- **V4**: no existia forma de que un usuario retirara su propia solicitud pendiente
  ("Lo que enviaste" > "Cancelar" en Mis solicitudes). Se agrego `cancelarSolicitud`
  (`DELETE /api/equipos/solicitudes/:membresiaId`) — borra la membresia solo si es propia,
  `origen: 'solicitud'` y sigue `pendiente`.
- **V5**: `eliminarEquipo` marcaba el equipo `estado: false` pero no tocaba las
  `EquipoMembresia` asociadas — quedaban huerfanas (roster, invitaciones y solicitudes
  pendientes apuntando a un equipo inactivo). La hoja de confirmacion de borrado en el
  frontend promete "se pierden el plantel y las solicitudes pendientes"; ahora
  `eliminarEquipo` corre `EquipoMembresia.deleteMany({ equipo: id })` despues del soft
  delete, así que esa promesa es cierta.

## No implementado en esta fase (a proposito)

- Busqueda publica de equipos/jugadores con filtros de nivel/zona — Fase 3.
- Retos, resultados, puntuacion visible — Fases 4-6.
- Notificaciones de invitacion/solicitud — Fase 7 (reusa el patron
  `reservaId`/`estado` de `SessionStore` ya construido en el frontend para
  la entrega 31b).
- Transferencia de capitania — el capitan no puede salir ni ser expulsado en
  v1; debe borrar el equipo si ya no lo quiere usar. Si esto resulta
  demasiado rigido en uso real, se agrega en una fase posterior.

## Riesgos / pendiente de verificar

- No se probo contra una base de datos real (sin entorno de Mongo en este
  sandbox) — se verifico con syntax-check (`node -c`) de cada archivo
  tocado y con un smoke test que instancia `Server` completo (fuerza el
  `require` de cada ruta, incluida la nueva, sin conectar a DB). Los 2
  indices parciales unicos de `EquipoMembresia` no se ejercitaron contra
  Mongo real — recomiendo una prueba manual de "2 solicitudes pendientes al
  mismo equipo" y "aceptar una segunda membresia del mismo deporte" antes de
  dar la fase por cerrada en produccion.
- `express-validator`'s `check('aceptar').isBoolean()` en la ruta de
  responder membresia exige que el body mande `aceptar` como boolean real
  (no `"true"` string) — a confirmar que el cliente que se conecte
  (Flutter, Fase 2 en adelante) lo mande asi.
