# Puesta en marcha: mails automáticos, plataformas, costos y demo en vivo

Estado al 30/09/2026. Todo lo que dice "a verificar" son precios o límites de planes que cambian seguido: confirmarlos en la web de cada servicio al contratar.

## 1. Cómo se conecta todo

```
Persona (celular)                      Baiking (Gastón / Belén)
   │                                        │
   ▼                                        ▼
Sitio participa.baiking.com.ar        Panel (admin.html) ◄──► Google Sheets
   │  formulario + comprobante              │  "Llegó / No llegó", "Carta recibida"
   ▼                                        ▼
API en Vercel (api/*.js) ───────────► Supabase (base de datos + archivos)
   │  crea la orden, guarda el comprobante,        ▲
   │  lo lee con Claude, asigna el bloque          │ cron diario: sheets-sync, recordatorios
   ▼
Resend (mails) ──► casilla de la persona      Respuestas ──► belen.baiking@gmail.com
```

- **Sitio**: páginas estáticas (HTML, CSS, JS). Vive en Vercel, en el subdominio `participa.baiking.com.ar`.
- **API**: funciones en Vercel (`api/checkout`, `api/admin`, `api/recordatorios`, etc.). Es el único lugar con permisos sobre la base y con las claves de los servicios.
- **Base de datos y archivos**: Supabase (Postgres + Storage). Guarda las órdenes (cada orden pagada con su bloque de números correlativos, `numero_desde`–`numero_hasta`: tantos como pesos tiene el precio; no hay filas por número), los comprobantes y las marcas de conciliación.
- **Lectura de comprobantes**: la API de Claude (Anthropic). Lee la imagen o el PDF y devuelve monto, cuenta destino, fecha y número de operación; la API compara con la orden.
- **Mails**: Resend, por API. Cada mail sale desde `api/_lib/notificaciones.js` con el diseño de la marca. La casilla de respuestas es `belen.baiking@gmail.com`.
- **Planilla**: Google Sheets por API (cuenta de servicio). Espejo de todas las órdenes y columna "Llegó la plata" editable desde el celular.
- **WhatsApp (opcional, después)**: Meta Cloud API. Hoy está apagado; el sitio solo promete mails.

## 2. Los siete mails automáticos y quién los dispara

| # | Mail | Se manda cuando | A quién |
|---|------|-----------------|---------|
| 1 | Recibimos tu comprobante | La persona toca "Participar" con el comprobante adjunto | Esa persona |
| 2 | ¡Listo! Tu producto y tus participaciones (con el bloque "del N.º X al N.º Y" y el link de entrega) | Baiking marca "Llegó" (panel o planilla) o la aprobación automática valida el comprobante | Esa persona |
| 3 | Registramos tus datos: ahora mandá la carta | Alguien completa el formulario sin cargo | Esa persona |
| 4 | Recibimos tu carta y ya estás participando | Baiking marca "Carta recibida" en el panel | Esa persona |
| 5 | Datos para transferir | Solo si una orden entra sin comprobante (falló la subida) | Esa persona |
| 6 | Falta una semana para el sorteo | 27/11 a las 10:00 (cron diario) | Todas las personas con alguna orden |
| 7 | ¡Hoy es el sorteo! 21:00 en vivo (con los bloques de todas sus órdenes) | 4/12 a las 10:00 (cron diario) | Todas las personas con participaciones confirmadas |

Los mails 1 a 5 salen en el momento, desde la misma función que procesa la acción. Los 6 y 7 los manda `api/recordatorios`, que un cron de Vercel llama todos los días a las 10:00; el endpoint decide si hoy corresponde mandar algo y marca cada envío para que salga una sola vez. Vista previa de todos: `node scripts/mails-preview.mjs` (o la página publicada). El mail 2 informa el bloque de participaciones de la orden ("Tus participaciones: del N.º X al N.º Y (N participaciones)"; en la vía gratuita, "Tu participación: N.º X") y lleva el botón "Descargar / Ver {producto}" con el link de entrega (`packs[].entrega_url`; el curso usa `curso.url_acceso`): mientras los links estén vacíos, avisa que el producto llega aparte.

Reglas de envío: un solo botón por mail, remitente `Baiking <sorteo@baiking.com.ar>`, respuestas a `belen.baiking@gmail.com`, leyenda legal al pie, versión en texto plano incluida. Los mails de confirmación no se duplican aunque el sistema reintente (marca en la base).

## 3. Por qué Resend y no otra cosa

- **Resend**: API simple, buena entregabilidad, plan gratuito para probar (3.000 mails por mes, 100 por día, a verificar), plan pago barato. Es lo que ya está integrado.
- **Gmail (belen.baiking@gmail.com) como remitente**: no. Google limita a unos 500 mails por día, los mails masivos caen en spam y no hay API de envío transaccional. Sí sirve para recibir respuestas.
- **Mailchimp / Brevo / Tienda Nube**: son para newsletters; para mails disparados por acciones (comprobante recibido, participación asignada) son más caros y más complicados.
- **WhatsApp**: mejor tasa de apertura, pero requiere cuenta de Meta Business, número verificado, plantillas aprobadas y costo por mensaje. Queda como segunda etapa.

Para mandar desde `@baiking.com.ar` hace falta verificar el dominio en Resend: dos registros DNS (DKIM y SPF) en el proveedor donde está baiking.com.ar. Si prefieren no tocar el dominio principal, se puede verificar solo un subdominio (por ejemplo `mail.baiking.com.ar`) y mandar desde `sorteo@mail.baiking.com.ar`.

## 4. Plataformas, planes y costos

| Servicio | Para qué | Para la demo | Para la campaña | Costo (a verificar) |
|----------|----------|--------------|-----------------|---------------------|
| Vercel | Sitio + API + crons | Hobby (gratis) | Pro | Hobby es solo para uso no comercial; Pro ≈ USD 20 por mes. Hobby permite 2 crons diarios (justo los que usamos). |
| Supabase | Base de datos + comprobantes | Free (gratis) | Pro | Free se pausa tras 7 días sin uso y no tiene backups; Pro ≈ USD 25 por mes. |
| Resend | Mails | Free (gratis) | Pro | Free: 3.000 por mes y 100 por día; con más de 100 participantes, el recordatorio no entra en un día. Pro ≈ USD 20 por mes (50.000 mails). |
| Anthropic (Claude) | Lectura de comprobantes | Crédito prepago | Crédito prepago | Por uso: entre USD 0,01 y 0,03 por comprobante; 1.000 comprobantes ≈ USD 10 a 30. Cargar USD 20 alcanza para arrancar. |
| Google Sheets | Planilla compartida | Gratis | Gratis | Sin costo; requiere una cuenta de servicio en Google Cloud (gratis). |
| Dominio | participa.baiking.com.ar | Gratis | Gratis | Subdominio del dominio que ya tienen; solo hay que agregar un registro DNS. |
| WhatsApp Cloud API | Avisos (opcional) | No | Opcional | Costo por mensaje; se evalúa después. |

Estimación: la demo sale USD 0 más el crédito de Claude. La campaña, con planes Pro donde hace falta, ronda **USD 70 a 100 por mes** durante octubre, noviembre y diciembre, más el uso de Claude. Se puede arrancar en gratis y pasar a Pro en la semana del lanzamiento.

## 5. Qué hay que crear y quién

| Paso | Lo hace | Detalle |
|------|---------|---------|
| Acceso a GitHub | Baiking | Instalar la app de Claude en el repositorio (o darle acceso a Delfina como colaboradora). Sin esto, el código viaja en zip. |
| Cuenta de Vercel | Baiking (o Delfina) | Crear la cuenta, importar el repositorio, elegir el proyecto. Vercel despliega solo con cada cambio. |
| Proyecto en Supabase | Baiking (o Delfina) | Crear el proyecto (región São Paulo), correr `supabase/schema.sql` en el editor SQL, crear el bucket `comprobantes` (privado). |
| Cuenta de Resend | Baiking | Verificar el dominio o subdominio (DNS) y crear una API key. |
| API key de Anthropic | Baiking | console.anthropic.com, cargar crédito, crear la key. |
| DNS | Baiking (quien administre baiking.com.ar) | 1 registro para el subdominio del sitio (Vercel lo indica) + 2 registros de Resend. |
| Variables de entorno en Vercel | Delfina | Todas las de `.env.example`: Supabase, Resend, `MAIL_FROM`, `ADMIN_TOKEN`, `BASE_URL`, `ANTHROPIC_API_KEY`, `TRANSFERENCIAS_AUTO_APROBAR=false`, `INBOUND_SECRET`, `CRON_SECRET`, Google Sheets. |
| Google Sheets | Delfina + Gastón | Crear la planilla, compartirla con la cuenta de servicio y con Gastón (guía en docs/06). |
| Config final | Delfina | `checkout.modo: "api"`, precios confirmados y links de entrega de los tres productos (`packs[].precio`, `packs[].entrega_url`, `curso.url_acceso`), valor de la Strattos, dominio. |

## 6. Plan de la demo en vivo

1. **Día 1**: cuentas y DNS (paso 5). Con eso, Delfina despliega el sitio en modo real y corre el esquema en Supabase.
2. **Día 2**: pruebas internas con el token de administración: una orden con un comprobante de prueba (una captura cualquiera) para ver la lectura de la IA y los mails; una participación sin cargo; "Carta recibida"; el panel y la planilla.
3. **Día 3**: prueba real: una transferencia de $10.000 (el pack de fondos de pantalla: 10.000 participaciones) desde una cuenta propia a la de X Centro Pilar SRL, comprobante real, "Llegó" desde el panel, mail con el bloque ("del N.º X al N.º Y"). Revisar que el mail no caiga en spam (Gmail, Outlook, Hotmail).
4. **Antes de abrir (15/10)**: bases validadas por el abogado, fotos del local y de Gastón, precio de la Strattos, `TRANSFERENCIAS_AUTO_APROBAR` decidido, planes Pro contratados si hace falta, y una prueba de los recordatorios con `?tipo=semana&test=mail` a una casilla propia.

Mientras la demo esté en vivo antes del lanzamiento, el sitio puede llevar un aviso "versión de prueba" y un precio de prueba, para que nadie compre de verdad por error.

## 7. Lo que sigue estando pendiente de decidir

- Aprobación automática de comprobantes (recomendación: apagada al principio).
- Sorteo: generador aleatorio en vivo o Quiniela nocturna de la Provincia como fuente del número.
- Cartas que llegan después del cierre y registros rechazados (hoy bloquean el DNI).
- Participaciones proporcionales al precio ($1 = 1; hasta 47.000 pagas por persona, una compra por producto) frente a una gratuita: es el esquema que `docs/08` calificó de riesgo alto y Baiking decidió mantenerlo con la vía gratuita de 1 participación; validar con el abogado antes de publicar (`docs/08` §3, filas 1 a 5; `docs/02` §4.3).
