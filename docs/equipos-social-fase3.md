# Equipos / Social — Fase 3: busqueda publica + moderacion minima (2026-08-16)

Doc espejo del plan (`canchas-app-flutter/docs/equipos-social-plan.md`,
seccion "Fase 3"). Este archivo documenta lo que se implemento en este repo
(backend) para esa fase. Frontend (pantallas de busqueda, toggle "busco
equipo", UI de reportar/bloquear) queda para la siguiente entrega, ya con
este contrato de API cerrado.

## Que se agrego

### Busqueda publica de equipos (jugadores buscan equipos)

- `GET /equipos` (ya existia desde Fase 1, filtraba por `deporte`/`q`) ahora
  tambien acepta `zona` y devuelve `jugadoresCount` por equipo (mismo
  criterio de aggregate agrupado que `obtenerMisEquipos`).
- Si hay sesion (`validarJWTOptional`, la ruta sigue siendo publica sin
  login), excluye equipos capitaneados por alguien con relacion de bloqueo
  reciproca con quien busca.

### Busqueda publica de jugadores (equipos buscan jugadores)

- `GET /jugadores` (Fase 2, ya filtraba por rol `USER`) ahora tambien acepta
  `zona`, `nivel`, `deporte` y `buscandoEquipo=true`. Todos opcionales --
  Invitar jugador (Fase 2, busca solo por nombre/apellido/correo/ciudad via
  `q`) sigue funcionando exactamente igual sin mandarlos.
- `buscandoEquipo` es un flag nuevo en `Usuario` (default `false`, opt-in):
  sin el, un jugador con rol `USER` no aparece en la busqueda publica de
  "jugadores buscando equipo" aunque siga siendo invitable directamente por
  nombre desde Invitar jugador. Se edita como cualquier otro campo de perfil
  via `PUT /usuarios/me` (whitelist ya existente, solo se agrego el campo a
  `normalizarPayloadUsuario`).
- Misma exclusion de bloqueos reciprocos que en equipos, salvo para un
  ADMIN/DEV con acceso completo (no tiene sentido perder visibilidad de
  moderacion por un bloqueo entre dos jugadores).

### Zona en Equipo

- `Equipo.zona` (string libre, catalogo `CATALOGOS_PERFIL.zonas` — mismo que
  `Usuario.zonaPreferida`, para no inventar un catalogo paralelo). Opcional:
  un equipo creado antes de esta fase queda sin zona, no se le asigna un
  valor por default.
- `crearEquipo`/`actualizarEquipo` la validan contra ese catalogo (400 si
  viene un valor que no matchea).

### Reportar (moderacion minima)

- Modelo `Reporte` nuevo (`reportante`, `tipo` [`usuario`|`equipo`],
  `objetivoId`, `motivo` [`comportamiento_inapropiado`|`spam`|
  `informacion_falsa`|`otro`], `mensaje`, `estado` [`pendiente`|`revisado`]).
- `POST /reportes` (cualquier autenticado): valida que el objetivo exista y
  bloquea auto-reporte (a uno mismo, o al propio equipo).
- `GET /reportes` (solo ADMIN/DEV): listado paginado con el reportante
  populado. **No hay pantalla de admin para esto todavia** — el dato queda
  accesible para revision manual via API, pero construir una UI de
  moderacion es trabajo aparte, no incluido en esta ronda (igual criterio
  que "no supongas": no se inventa una pantalla que no se pidio).

### Bloquear (moderacion minima)

- `Usuario.usuariosBloqueados` (array de refs a `Usuario`). Se edita
  exclusivamente via `POST /usuarios/me/bloqueos/toggle` (mismo patron que
  `toggleFavoritoUsuario`) -- se excluyo explicitamente de la whitelist del
  endpoint generico de edicion de perfil (`actualizarUsuario`) para que no
  se pueda pisar entero de un swipe.
- El bloqueo es lo que alimenta la exclusion reciproca en las 2 busquedas
  publicas de arriba. No cancela solicitudes/membresias/invitaciones ya
  existentes entre las 2 partes, solo evita que se vuelvan a descubrir.

### Fix de privacidad (prerequisito para que la busqueda publica sea segura)

`GET /equipos/:id` (`obtenerEquipo`) es publico desde Fase 1 y siempre
devolvia el roster completo, **incluidas las invitaciones pendientes**,
sin importar quien preguntara. Mientras el endpoint solo era alcanzable
sabiendo el id de memoria, el riesgo era bajo; una vez que la busqueda
publica lo hace genuinamente descubrible, cualquier visitante hubiera
podido ver a quien invito un equipo. Se cambio la ruta a
`validarJWTOptional` y el controller ahora filtra el roster a solo
`estado: 'aceptada'` para quien no sea capitan/miembro aceptado/admin de
ese equipo especifico. Comportamiento sin cambios para quien ya pertenece
al equipo (Fase 2 sigue funcionando igual).

### miEstado en el detalle de equipo

`GET /equipos/:id`, cuando hay sesion, ahora tambien devuelve `miEstado`:
`'capitan' | 'miembro' | 'solicitud_pendiente' | 'invitacion_pendiente' |
'ya_tengo_equipo_de_este_deporte' | 'disponible'` (o `null` sin sesion). Es
lo que decide que boton mostrar en el detalle publico ("Solicitar unirme"
vs "Ya sos parte" vs "Solicitud enviada" vs deshabilitado) sin que el
frontend tenga que cruzar esto a mano contra `Mis equipos`/`Mis solicitudes`.

## 2026-08-17 (verificacion contra el brief de diseño — B3/B4 completos)

El brief de diseño de las pantallas (33a-d) trajo su propio checklist de
verificacion (B1-B5), igual criterio que los V1-V6 de la Fase 2. Dos de los
5 puntos exigieron completar el backend antes de poder construir el
frontend con la copia que el diseño ya escribió:

- **B3 (bloqueo incompleto):** el bloqueo ya era reciproco y ya filtraba
  `GET /jugadores`/`GET /equipos`, pero **no** el roster de `GET /equipos/:id`
  ni las invitaciones/solicitudes -- la hoja de bloqueo promete "no van a
  poder verse en la búsqueda ni mandarse invitaciones o solicitudes", y esa
  segunda mitad no era cierta todavia. Se agrego:
  - Roster de `obtenerEquipo`: excluye usuarios con bloqueo reciproco,
    **solo para quien no pertenece al equipo** (a un companero de equipo
    real no se lo oculta de tu propio plantel por un bloqueo posterior).
  - `invitarJugador`/`solicitarUnirseEquipo`: rechazan (400) si hay bloqueo
    reciproco entre el capitan y el otro usuario.
  - Nuevo helper puro `hayBloqueoEntrePar` en `helpers/bloqueos.js` (con
    tests) para no repetir la logica de "¿cualquiera de los 2 bloqueo al
    otro?" en los 3 lugares.
- **B4 (dónde se desbloquea):** `GET /usuarios/me` ahora popula
  `usuariosBloqueados` (nombre, apellido, foto) -- antes devolvia solo los
  ObjectId crudos, sin nada para dibujar una lista de "Desbloquear".

## No implementado en esta fase (a proposito)

- **Nivel de juego (`nivelJuego`) no se usa como filtro de busqueda todavia**
  a pesar de que el backend ya lo soporta (`obtenerUsuarios` acepta `nivel`
  desde antes de esta fase) -- el campo nunca tuvo una pantalla para que el
  jugador lo cargue, asi que hoy esta vacio para practicamente todos.
  Filtrar por el ahora devolveria resultados vacios/enganosos. Se agrega un
  selector de nivel a Editar perfil en una entrega posterior, y recien ahi
  tiene sentido exponer el filtro en el frontend.

- Pantallas de frontend (busqueda de equipos, busqueda de jugadores, toggle
  "busco equipo" en el perfil, UI de reportar/bloquear) — Design + build
  en la siguiente entrega, con este contrato de API ya cerrado.
- Pantalla de admin para revisar `Reporte` — el endpoint de listado existe,
  la UI no. Se construye si/cuando haga falta.
- El bloqueo no cancela relaciones existentes (solicitudes/invitaciones/
  membresias entre las 2 partes) ni oculta el detalle de un equipo por id
  directo (`GET /equipos/:id`) -- solo afecta discovery (busqueda). Si en
  el uso real esto no alcanza, se refuerza en una fase posterior.
- Sin arbitraje de reportes ni acciones automaticas (suspension, etc.) --
  "moderacion minima" es literal: guarda el reporte, no actua sobre el.

## Riesgos / pendiente de verificar

- No se probo contra una base de datos real (mismo caveat que Fase 1). Se
  verifico con `node -c` de cada archivo tocado, un smoke test que
  instancia `Server` completo (fuerza el `require` de cada ruta nueva sin
  conectar a DB), y la suite de tests (`node --test`, 15/15 verdes: 3 casos
  nuevos para `resolveIdsBloqueados`).
- `validarJWTOptional` ahora se agrego a `GET /equipos`, `GET /equipos/:id`
  y `GET /jugadores` (antes no tenian ningun middleware de auth). Esto
  significa que un token expirado/invalido en el header ahora devuelve 401
  en vez de ignorarse silenciosamente -- mismo comportamiento que ya tenia
  `GET /usuarios` desde antes, no es un patron nuevo, pero vale confirmarlo
  en uso real por si el cliente no refresca el token a tiempo.
- Los indices unicos nuevos no aplican aca (no se agrego ningun indice
  unico en esta fase); el indice compuesto `{estado, deporte, zona}` de
  `Equipo` es solo de lectura, sin garantia que verificar.
