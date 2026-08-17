# Equipos / Social — Fase 5: Confirmación de resultado (2026-08-17)

Doc espejo del plan (`canchas-app-flutter/docs/equipos-social-plan.md`,
sección "Fase 5"). Backend de esta fase. Frontend queda para la siguiente
entrega, con este contrato ya cerrado — mismo orden que las fases
anteriores.

## Qué se agregó

### Modelo `ResultadoReto` (`models/resultados-reto.js`)

- `reto`: ref única a `Reto` (`unique: true` — nunca hay más de un
  `ResultadoReto` por reto, se upsertea el mismo documento con cada
  reporte, no se crea uno nuevo por capitán).
- `reporteRetador`/`reporteRetado`: `{golesRetador, golesRetado,
  reportadoPor, reportadoEn}` cada uno. **Los dos reportan en el mismo
  marco de referencia** (goles del equipo retador y goles del equipo
  retado, siempre en ese orden) — no "mis goles/goles del rival" de cada
  capitán, que exigiría invertir uno de los 2 reportes antes de comparar
  y es más superficie para un bug de signo.
- `estado`: `pendiente | confirmado | en_disputa`. Decisión fundacional 3
  del plan: **sin arbitraje en v1** — si los 2 marcadores no coinciden,
  el reto queda `en_disputa` para siempre, sin resolución automática ni
  manual. No hay pantalla de arbitraje que construir, es un estado
  terminal como cualquier otro.

### Helpers puros (`helpers/resultados-reto-social.js`)

- `identificarLadoReportante`: qué lado del reto es `usuarioId` —
  `'retador' | 'retado' | null`. **A propósito no reusa
  `puedeGestionarReto`** (que sí deja pasar a un admin): reportar un
  resultado está atado a *qué lado sos*, y un admin no tiene un lado
  propio — no tiene sentido que reporte en nombre de ninguno de los 2
  capitanes.
- `resolveEstadoResultado`: `pendiente` mientras falte algún reporte
  completo, `confirmado` si coinciden, `en_disputa` si no. Usa `!= null`
  (no `truthy`) para no confundir un 0-0 real con "todavía no reportó" —
  testeado explícitamente.

### Endpoints (`routes/retos.js`)

- `POST /retos/:id/resultado` (`{golesRetador, golesRetado}`) — reporta el
  resultado. Requiere: reto `estado: 'jugado'`, que quien reporta sea
  capitán de uno de los 2 equipos (nunca admin, ver arriba), y que el
  resultado siga `pendiente` (una vez `confirmado`/`en_disputa`, queda
  fijo — no se puede editar un resultado ya definido). Un capitán SÍ
  puede reportar de nuevo para corregirse mientras el otro todavía no
  reportó (el documento sigue en `pendiente`).
- `GET /retos/:id/resultado` — mismos autorizados que ver el reto
  (`puedeGestionarReto`, con admin).
- `GET /retos/:id` (`obtenerReto`) ahora **embebe** `resultado` en la
  respuesta cuando el reto está `jugado`, en vez de forzar al frontend a
  un segundo request — el detalle del reto siempre necesita saber si ya
  hay un resultado reportado para dibujar el bloque correcto, no es un
  dato opcional que se pida a demanda.

## Decisiones explícitas (para no "suponer")

- **No se toca `Equipo.puntuacion`/`victorias`/`derrotas`/`empates` en
  esta fase.** Esos campos ya existen desde Fase 1, sin que nada los
  escriba — calcular puntaje a partir de resultados confirmados es
  explícitamente Fase 6 del plan, todavía no arrancada.
- **Un resultado en disputa no tiene salida.** No hay endpoint para
  "reintentar", "resetear" ni "arbitrar" — coincide con la decisión
  fundacional 3 tal cual está escrita en el plan, no es un descuido.
- **Reportar exige `reto.estado === 'jugado'`**, no alcanza con que haya
  una reserva vinculada con fecha pasada — `jugado` ya es la
  confirmación explícita de que el partido se disputó (Fase 4, B4:
  cualquiera de los 2 capitanes lo marca), reportar un resultado antes de
  eso adelantaría un paso que todavía no pasó.

## No implementado en esta fase (a propósito)

- Pantallas de frontend (reportar resultado, ver resultado/estado de
  disputa) — siguiente entrega, con este contrato ya cerrado.
- Puntuación visible / ranking de equipos — Fase 6 del plan.
- Notificación al otro capitán cuando alguien reporta, o cuando el
  resultado queda confirmado/en disputa — Fase 7 (notificaciones), fuera
  de alcance acá, mismo criterio que Fase 4.
- Sin límite de tiempo para reportar un resultado después de `jugado` —
  si en el uso real hace falta una caducidad (mismo patrón que B1 de
  Fase 4), se agrega después.

## Riesgos / pendiente de verificar

- No se probó contra una base de datos real (mismo caveat de siempre). Se
  verificó con `node -c` de cada archivo tocado, un smoke test que
  instancia `Server` completo sin conectar a DB, y la suite de tests
  (`node --test`, 27/27 verdes: 5 casos nuevos para
  `identificarLadoReportante`/`resolveEstadoResultado`).
- El `unique: true` sobre `ResultadoReto.reto` no se probó contra Mongo
  real (el índice se declara en el schema, Mongoose lo crea en la
  colección al conectar) — confiado a que el mismo patrón ya funciona en
  otros índices únicos parciales de este dominio (`EquipoMembresia`,
  `Reto`), no verificado con datos reales.
