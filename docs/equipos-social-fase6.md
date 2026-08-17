# Equipos / Social — Fase 6: Puntuación visible (2026-08-17)

Doc espejo del plan (`canchas-app-flutter/docs/equipos-social-plan.md`,
sección "Fase 6"). Backend de esta fase. Frontend queda para la
siguiente entrega, con este contrato ya cerrado — mismo orden que las
fases anteriores.

## Qué se agregó

### Helper puro (`helpers/puntuacion-social.js`)

- `resolveIncrementosPuntuacion({golesRetador, golesRetado})`: formula v1
  del plan, deliberadamente simple — puntos estilo liga (3 al ganar, 1 al
  empatar, 0 al perder), nada de Elo. Devuelve el incremento de
  `{puntuacion, victorias, derrotas, empates}` para cada lado
  (`retador`/`retado`), listo para usar como `$inc` de Mongoose.
- Un 0-0 no es un caso especial acá — ya llegó como "confirmado" desde
  `resolveEstadoResultado` (Fase 5), que sí distingue 0-0 real de "sin
  reportar" con `!= null`. Para esta función, golesRetador===golesRetado
  (sea 0-0 o 2-2) siempre es empate.

### Wiring (`controllers/resultados-reto.controller.js`)

- `reportarResultado` ahora actualiza `Equipo.puntuacion/victorias/derrotas/empates`
  de los 2 equipos, **en el mismo momento en que `resultado.estado` pasa a
  `'confirmado'`** — nunca en `'en_disputa'` (decisión fundacional 3 del
  plan: un resultado en disputa "simplemente no puntúa", sin resolución
  posterior que lo recalcule).
- Pasa una sola vez por reto: una vez `confirmado`, el chequeo ya
  existente (`resultado.estado !== 'pendiente'` → 400) impide volver a
  reportar, así que no hay forma de que este bloque corra 2 veces para el
  mismo reto.
- Usa `Equipos.updateOne({_id}, {$inc: ...})` sobre los 2 equipos en
  paralelo (`Promise.all`) — no relee ni reescribe el documento completo
  del equipo, solo incrementa (evita una condición de carrera si 2 retos
  del mismo equipo se confirman casi al mismo tiempo).

### Modelo `Equipo` (`models/equipos.js`)

Sin cambios — los 4 campos (`puntuacion`, `victorias`, `derrotas`,
`empates`) ya existían desde Fase 1, con el comentario explícito de que
"nada los escribe todavía". Esta fase es exactamente eso: la primera
escritura. Los endpoints que devuelven un `Equipo` (`obtenerEquipo`,
`obtenerEquipos`, `obtenerMisEquipos`) ya los exponían en el JSON de
siempre (son campos normales del schema) — no hizo falta tocar ningún
controller de lectura.

## Decisiones explícitas (para no "suponer")

- **Solo resultados confirmados puntúan**, tal cual el plan. Un reto
  `en_disputa` no tiene ningún efecto sobre `Equipo` — ni siquiera un
  registro de "partido jugado sin definir", eso queda fuera de alcance.
- **Formula fija v1 (3/1/0), sin configuración por deporte/liga.** El
  plan es explícito: "nada de Elo todavía — eso es ajuste fino para más
  adelante si el sistema se usa de verdad". No se agregó ningún campo de
  configuración especulativo.
- **El incremento es atómico (`$inc`), no un read-modify-write.** Se
  evaluó recalcular todo el historial de retos confirmados de un equipo
  en cada consulta (fuente de verdad derivada) en vez de mantener
  contadores — se descartó por ahora: son 4 enteros que solo cambian en
  un único punto de escritura ya identificado, y recalcular en cada
  lectura sería más trabajo sin necesidad real todavía.

## No implementado en esta fase (a propósito)

- Pantallas de frontend (mostrar V-D-E y puntos en el detalle de un
  equipo, en la búsqueda pública, etc.) — siguiente entrega, con este
  contrato ya cerrado.
- Ninguna tabla de posiciones/ranking entre equipos — el plan solo pide
  "puntuación visible como referencia", no un sistema competitivo de
  liga con ordenamiento. Si hace falta más adelante, es una fase aparte.
- Nada de deshacer puntuación si un reto confirmado se pudiera "corregir"
  después — no existe esa operación (Fase 5 ya estableció que un
  resultado confirmado es terminal, sin edición), así que no hace falta
  un camino de reversión.

## Tests

- `puntuacion-social.test.js` (nuevo): 4 casos —
  `resolveIncrementosPuntuacion` con victoria del retador, victoria del
  retado, empate, y el caso explícito de 0-0 (para que quede claro que no
  es un caso especial de esta función, a diferencia de `resolveEstadoResultado`
  en Fase 5).
- Sin tests de integración contra Mongo real (mismo caveat de siempre:
  sin infraestructura de test de DB en este entorno) — el `$inc` sobre
  `Equipos.updateOne` no se probó contra datos reales, confiado al mismo
  patrón que ya usa el resto del dominio (`EquipoMembresia`, contadores
  agregados en `equipos.controller.js`).

## Riesgos / pendiente de verificar

- No se probó contra una base de datos real (mismo caveat de siempre). Se
  verificó con `node -c` de cada archivo tocado, un smoke test que
  instancia `Server` completo sin conectar a DB, y la suite de tests
  (`node --test`, 31/31 verdes: 4 casos nuevos para
  `resolveIncrementosPuntuacion`).
- Si en el futuro se agrega alguna forma de "deshacer" un reto jugado
  (por ejemplo, un admin corrigiendo un error grave), el incremento de
  puntuación quedaría desincronizado — no existe ese camino hoy, así que
  no se construyó nada para ese caso, pero queda como riesgo documentado
  si se agrega más adelante.
