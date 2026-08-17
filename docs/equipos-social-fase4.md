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
- `estado`: `pendiente | aceptado | rechazado | cancelado | jugado | caducado`
  (los 5 del plan + `caducado`, agregado en la verificación contra el brief
  de diseño — ver B1 abajo). **`jugado` no implica resultado/puntaje** — eso
  es Fase 5 (`ResultadoReto`, doble confirmación de los capitanes). Acá solo
  marca que el partido ya se disputó, como precondición para que Fase 5
  tenga sentido.
- `aceptadoEn`: fecha en que el reto pasó a `aceptado` (no se puede usar
  `updatedAt`: ese timestamp se pisa con cualquier save posterior, no solo
  con la aceptación). Alimenta la caducidad de B1.
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
- `DELETE /retos/:id/reserva` — desvincula la reserva sin cancelar el reto
  (B5 del brief de diseño): un capitán vinculó la reserva equivocada y
  quiere corregirla sin perder la aceptación ni el mensaje del reto.
- `GET /retos/reservas-vinculadas?ids=a,b,c` — de una lista de ids de
  reserva, cuáles ya están vinculadas a un reto vivo (`aceptado`/`jugado`).
  Pensado para el picker de "Vincular reserva" del frontend (pantalla
  34d/35d del diseño): antes de listar las reservas propias para elegir,
  necesita saber cuáles ya están tomadas para mostrarlas deshabilitadas
  ("Ya está en otro reto") en vez de que el usuario elija una y recién se
  entere en el 400 de `vincularReserva`.

### Corrección: un reto cerrado no debería seguir "reteniendo" su reserva

Encontrada al diseñar el picker de vincular reserva: el check de "esa
reserva ya está vinculada a otro reto" (`vincularReserva`) no filtraba por
`estado`, así que una reserva que había quedado vinculada a un reto
`cancelado`/`rechazado`/`caducado` seguía bloqueando que se usara en un
reto distinto, aunque ese primer reto ya no significara nada. Se agregó
`ESTADOS_RETO_QUE_RETIENEN_RESERVA = ['aceptado', 'jugado']` y se usa tanto
en ese check como en `obtenerReservasVinculadas` — solo un reto todavía
vivo retiene de verdad la reserva.

### Corrección: `reserva` no venía populada en la lista, y venía incompleta en el detalle

Otra encontrada diseñando el frontend: `RETO_POPULATE` (usado por
`obtenerRetosDeEquipo`, la lista) no incluía `reserva` — la fila de la
lista (L3 del brief, "sáb 20 sep, 18:00 · Jonathan") no tenía de dónde
sacar esos datos, llegaba el `ObjectId` crudo. Se agregó `reserva`
(fecha/hora/cancha) a `RETO_POPULATE`.

En el detalle (`obtenerReto`), el segundo `.populate('reserva')` que ya
existía **pisaba** el populate acotado del array anterior (mismo path, la
llamada más nueva gana) trayendo la reserva completa pero sin `cancha`,
`complejo` ni `usuario` poblados — y el diseño del detalle pide "La
reservó Diego Restrepo" (D3) y un botón "Cómo llegar" que necesita datos
del complejo. Se reemplazó por un populate explícito con esos 3 anidados.

## Verificación contra el brief de diseño de Fase 4 (B1–B6)

El brief (`implementar-fase4.md` del diseño) trajo 6 preguntas de
verificación antes de construir las pantallas. Tres ya estaban resueltas
por el backend original de esta fase; tres exigieron agregarlo:

- **B1 (caducidad de un `aceptado` sin reserva) — agregado.** Sin esto, 2
  capitanes que se aceptan y nunca coordinan la cancha dejan un reto vivo
  para siempre. Se implementó tal cual lo proponía el brief: 30 días desde
  `aceptadoEn`, nuevo estado `caducado` (distinto de `cancelado` porque el
  disparador es automático, no una decisión de un capitán), barrido
  periódico cada 10 min (`helpers/retos-lifecycle.js:runRetosLifecycleSweep`,
  wireado en `models/server.js` con el mismo `setInterval` que ya usa
  `runReservationLifecycleSweep`).
- **B2 (reserva cancelada desvincula el reto) — agregado.** Se centralizó
  en el modelo `Reserva` (`models/reservas.js`), no en cada controller que
  muta `estado`: un hook `pre('save')`/`post('save')` detecta cuándo
  `estado` deja de ser `confirmada`/`completada` y, si hay algún `Reto`
  `aceptado` apuntando a esa reserva, le pone `reserva: null`. Un solo lugar
  cubre los ~5 call sites dispersos que cambian el estado de una reserva
  (`controllers/reservas.controller.js`, `helpers/reservation-reputation.js`)
  sin tener que acordarse de tocar cada uno. **No incluye el aviso a los 2
  capitanes** que pedía el brief — eso es notificaciones (Fase 7), fuera de
  alcance acá; la UI puede mostrar el nuevo estado, pero no hay push/in-app
  todavía.
- **B3 (una reserva no puede estar en 2 retos) — ya estaba.**
  `vincularReserva` ya rechazaba (400) si otra `Reto` distinta apuntaba a
  la misma reserva.
- **B4 (quién marca "jugado") — ya estaba, coincide con lo propuesto.**
  Cualquiera de los 2 capitanes, sin resolución de conflictos — el primero
  que llama define el estado (`marcarJugado`, `puedeGestionarReto`).
- **B5 (desvincular sin cancelar el reto) — agregado.** Ver
  `DELETE /retos/:id/reserva` arriba.
- **B6 (mismo deporte obligatorio) — ya estaba.** `puedenRetarse` lo exige
  al crear el reto; `vincularReserva` además valida que la reserva sea del
  mismo deporte que el reto.

**Nota del brief que se adoptó tal cual**: la línea "El resultado todavía
no se puede confirmar" en el estado `jugado` se saca del diseño de la
pantalla — anuncia una fase que no existe y genera la pregunta que no
queremos responder todavía. `jugado` no dice nada sobre el resultado.

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
  automática de un reto `pendiente` sin responder (la caducidad de B1 solo
  aplica a `aceptado` sin reserva, no a `pendiente`) — si en el uso real
  hace falta, se agrega después.
- Sin aviso a los 2 capitanes cuando B2 desvincula una reserva cancelada —
  ver nota de B2 arriba, es trabajo de notificaciones (Fase 7).

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
- El hook de B2 (`models/reservas.js`) y el sweep de B1
  (`helpers/retos-lifecycle.js`) son lógica que solo se ejerce con
  documentos reales de Mongo (`updateMany`, hooks de Mongoose) — no hay
  test unitario posible para ellos sin `mongodb-memory-server` (no
  instalado en este repo, mismo caveat de siempre). Se verificó con
  lectura de código y el smoke test de `Server`, no con ejecución real.
