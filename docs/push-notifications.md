# Notificaciones push (FCM)

## Por que

Hasta ahora el ecosistema tenia todas las piezas menos la del medio: la app
registra su token de dispositivo (`POST /usuarios/me/push-token`) y el backend
lo guarda en `usuario.devicePushTokens`, pero nadie enviaba nada. En la
practica eso significaba que un aviso importante — "tu reserva fue
confirmada" — solo se veia si el usuario abria la app por su cuenta.

## Estado actual

| Pieza | Estado |
|---|---|
| App registra/desregistra token (`PushNotificationsService`) | Ya existia |
| Backend guarda tokens (`devicePushTokens`) | Ya existia |
| **Backend envia push ante cambios de estado de reserva** | **Implementado aca** |
| Credenciales de Firebase cargadas | Pendiente (accion manual, ver abajo) |
| App con `firebase_messaging` (token real + recepcion) | Pendiente |
| Job periodico para `avisosDisponibilidad` ("aviso de cupo") | Pendiente |

Mientras no haya credenciales cargadas, el envio queda **desactivado sin romper
nada**: `helpers/push-sender.js` detecta que falta la configuracion, lo
registra una vez en el log y devuelve `{ ok: false, reason: 'not_configured' }`.
El backend, los tests y el flujo de reservas siguen funcionando igual.

## Que se envia hoy

`helpers/push-reservas.js` arma el contenido y `controllers/reservas.controller.js`
lo dispara en los dos momentos que le importan al usuario:

- **`PUT /reservas/:id`** — cuando el complejo confirma o rechaza. Solo se
  envia si el estado cambio de verdad (un PUT que toca otro campo no
  interrumpe al usuario).
- **`POST /reservas/:id/cerrar`** — cierre operativo. `completada` importa
  especialmente porque abre la ventana de 24 h para calificar: si el usuario se
  entera recien la proxima vez que abre la app, esa ventana puede haber
  vencido.

Los textos siguen a los que la app ya muestra como aviso in-app
(`booking_notifications_sync_service.dart`), para que la push y la bandeja de
avisos no parezcan dos eventos distintos. El `data` viaja con
`{ tipo, reservaId, estado }`, las mismas claves que la app ya usa, para poder
abrir la reserva concreta al tocar la notificacion.

Tokens muertos: si FCM responde que un token ya no sirve (app desinstalada,
token rotado), se borra del usuario. Sin eso la lista crece para siempre con
basura y cada envio desperdicia cuota.

## Que falta hacer a mano (no se puede automatizar desde el repo)

1. **Crear el proyecto en Firebase Console** y registrar las dos apps
   (Android e iOS).
2. **Descargar los archivos de configuracion de la app movil**:
   `google-services.json` (Android) y `GoogleService-Info.plist` (iOS).
3. **iOS**: generar la clave de APNs (`.p8`) en el Apple Developer Portal y
   cargarla en Firebase Console → Cloud Messaging. Sin esto no llega nada a
   iPhone, aunque Android ya funcione.
4. **Backend**: crear una cuenta de servicio
   (Configuracion del proyecto → Cuentas de servicio → Generar nueva clave
   privada) y cargar el JSON resultante como variable de entorno.

## Configuracion del backend

Se acepta cualquiera de las dos formas, segun lo que permita el hosting:

```bash
# Opcion A: el JSON completo en una variable (lo comodo en Render/Heroku,
# que no dejan subir archivos sueltos). Debe ir en una sola linea.
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"..."}'

# Opcion B: ruta a un archivo (el default de las librerias de Google).
GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/service-account.json
```

La clave privada del JSON lleva `\n` escapados: si se pegan como saltos de
linea reales, la variable se corta y la inicializacion falla.

**No commitear el JSON de la cuenta de servicio**: da acceso de administrador
al proyecto de Firebase.

## Verificacion

```bash
npm test    # incluye test/push-notifications.test.js
```

Los tests cubren la logica pura (limpieza de tokens, deteccion de tokens
muertos, normalizacion del payload de `data`, textos de cada estado). El envio
real contra FCM no se testea: requiere credenciales y red.
