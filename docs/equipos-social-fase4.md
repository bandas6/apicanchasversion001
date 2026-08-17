# Equipos / Social — Fase 4: Retos (2026-08-17)

Doc espejo del plan (`canchas-app-flutter/docs/equipos-social-plan.md`,
seccion "Fase 4"). Este archivo documenta el backend de esta fase. Frontend
(pantallas de retar, ver retos del equipo, vincular reserva) queda para la
siguiente entrega, ya con este contrato de API cerrado — mismo orden que
Fase 3 (backend primero, diseño despues).

## Que se agrego

### Modelo `Reto` (`models/retos.js`)

- `equipoRetador`/`equipoRetado`: refs a `Equipo`.
- `deporte`: denormalizado desde `equipoRetador.deporte` al crear el reto
  (mismo criterio que `EquipoMembresia.deporte` en Fase 1) — los 2 equipos
  tienen que jugar el mismo deporte, se valida al crear (`puedenRetarse`).
- `estado`: `pendiente | aceptado | rechazado | cancelado | jugado` (los 5
  del plan). **`jugado` no implica resultado/puntaje** — eso es Fase 5
  (`ResultadoReto`, doble confirmación de los capitanes). Acá solo marca que
  el partido ya se disputó, como precondición para que Fase 5 tenga sentido.
- `mensaje`/`fechaPropuesta`: informativos, no atan nada — lo que fija
  cuándo y dónde se juega de verdad es la reserva vinculada.
- `reserva`: ref a `Reserva`, `null` hasta que se vincula (ver abajo).
  Decisión fundacional 2 del plan: "un reto obliga a una reserva real de
  cancha" — no hay partido informal suelto en el sistema.
- Índice único parcial `{equipoRetador, equipoRetado}` con
  `estado: 'pendiente'`: evita duplicar un reto pendiente del mismo par en
  esa dirección (no bloquea que el otro equipo también te rete a vos al
  mismo tiempo — son 2 documentos distintos, cada uno con su propio
  retador).

### Helpers puros (`helpers/retos-social.js`)

Mismo criterio que `helpers/equipos-social.js`: funciones sin acceso a DB,
testeadas con `node --test` (este repo no tiene `mongodb-memory-server`).

- `puedenRetarse`: equipos distintos + mismo deporte.
- `puedeResponderReto`: solo el capitán del equipo retado (o admin) —
  el retador no puede autoaceptarse.
- `puedeGestionarReto`: cualquiera de los 2 capitanes (o admin) — coordinar
  la reserva o cancelar el reto es cosa de ambos lados, no solo de quien
  retó primero.
- "Quién puede retar en nombre de un equipo" **reusa directamente**
  `puedeGestionarEquipo` (Fase 1) en vez de duplicarlo — es exactamente la
  misma regla (capitán del equipo, o admin).

### Endpoints (`routes/retos.js` → `POST/GET/PUT/DELETE /api/retos`)

- `POST /retos` — el capitán de `equipoRetadorId` reta a `equipoRetadoId`
  (`mensaje`/`fechaPropuesta` opcionales). Valida: capitán del retador,
  equipos distintos + mismo deporte, sin bloqueo recíproco entre los 2
  capitanes (mismo check que invitar/solicitar en Fase 3), sin un reto
  pendiente ya existente en esa dirección.
- `GET /retos/equipo/:equipoId` — retos enviados + recibidos por un equipo
  (solo el capitán de ese equipo, o admin).
- `GET /retos/:id` — detalle (cualquiera de los 2 capitanes, o admin).
- `PUT /retos/:id/responder` (`{ aceptar }`) — el capitán del retado acepta
  o rechaza. Solo si sigue `pendiente`.
- `PUT /retos/:id/reserva` (`{ reservaId }`) — vincula una reserva real ya
  hecha. Requiere: reto `aceptado`, reserva a nombre de uno de los 2
  capitanes, mismo deporte que el reto, `estado: 'confirmada'`, y que esa
  reserva no esté ya vinculada a otro reto.
- `PUT /retos/:id/jugado` — marca el reto como jugado. Requiere reto
  `aceptado` con reserva vinculada **cuya fecha ya pasó** (no se puede
  marcar jugado un partido que todavía no se jugó).
- `DELETE /retos/:id` — cancela (cualquiera de los 2 capitanes, o admin),
  solo si el reto sigue `pendiente` o `aceptado` (no se cancela algo ya
  jugado/rechazado/cancelado).

## Decisiones explícitas (para no "suponer")

- **La reserva vinculada tiene que estar a nombre de un capitán, no de
  cualquier miembro del plantel.** Mismo alcance que el resto de las
  acciones de gestión de un reto (invitar, expulsar, editar equipo): son
  cosas que hace el capitán en representación del equipo. Si en el uso real
  esto resulta muy restrictivo (un jugador reserva y el capitán no puede
  ir), se amplía en una fase posterior — no se abre de entrada sin motivo.
- **Solo se acepta vincular una reserva `estado: 'confirmada'`.** Una
  reserva `'pendiente'` (esperando que el complejo la confirme) todavía no
  es "real" en el sentido de la decisión fundacional 2.
- **`jugado` no dispara nada de puntaje.** `Equipo` ya tiene los campos
  `puntuacion`/`victorias`/`derrotas`/`empates` (agregados en Fase 1, sin
  que nada los escriba todavía) — eso sigue esperando a Fase 5/6.
- **No se agregó un endpoint para "editar" un reto pendiente** (cambiar
  `equipoRetado`, `mensaje`, etc.) — si el capitán se equivocó, cancela y
  crea uno nuevo. Mismo criterio de no construir algo que no se pidió.

## No implementado en esta fase (a propósito)

- Pantallas de frontend (retar, ver retos del equipo, vincular reserva) —
  siguiente entrega, con este contrato ya cerrado.
- `ResultadoReto` / confirmación de marcador / puntaje visible — Fase 5 y 6
  del plan, todavía no arrancadas.
- Notificaciones de reto nuevo/aceptado/rechazado — Fase 7 del plan
  (extiende el sistema de la entrega 31b), fuera de alcance acá.
- Sin límite de retos pendientes simultáneos por equipo, ni expiración
  automática de un reto `pendiente` sin responder — si en el uso real hace
  falta, se agrega después.

## Riesgos / pendiente de verificar

- No se probó contra una base de datos real (mismo caveat que las fases
  anteriores). Se verificó con `node -c` de cada archivo tocado, un smoke
  test que instancia `Server` completo (fuerza el `require` de la ruta
  nueva sin conectar a DB) y la suite de tests (`node --test`, 22/22
  verdes: 6 casos nuevos para `puedenRetarse`/`puedeResponderReto`/
  `puedeGestionarReto`).
- La validación "la reserva es de un capitán" compara `reserva.usuario`
  contra `equipoRetador.capitan`/`equipoRetado.capitan` tal cual vienen del
  modelo (sin popular en profundidad) — no se probó con documentos reales
  de Mongo, solo revisión manual del código.
