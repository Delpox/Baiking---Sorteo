# 03 · Automatizaciones: comprobantes, mail, WhatsApp y recordatorios

## 1. Qué pasa automáticamente hoy (modo `api`, único medio: transferencia)

| Momento | Qué hace el sistema | Archivo |
|---|---|---|
| La persona completa el formulario con el comprobante adjunto | Valida los datos, rechaza con `409` si esa persona (DNI) ya compró ese producto, crea la orden en estado `pendiente` (con un código interno `BK-XXXXX` que no se muestra), guarda el comprobante en Storage y lo manda a leer | `api/checkout.js`, `api/_lib/validar.js`, `api/_lib/comprobante.js` |
| Claude lee el comprobante | Extrae monto, fecha, cuenta destino, titular, referencia y señales de edición; los chequeos quedan en `comprobante_datos`; la orden pasa a `en_revision` y sale el mail "Recibimos tu comprobante" | `api/_lib/comprobante.js` (`leerComprobante`, `evaluarComprobante`, `procesarComprobante`), `api/_lib/notificaciones.js` |
| Aprobación | Desde el panel ("Aprobar" / "Rechazar", o "Llegó" / "No llegó" en la conciliación), desde la planilla de Google Sheets (columna "Llegó la plata", `docs/06`) o automática si `TRANSFERENCIAS_AUTO_APROBAR=true` y todos los chequeos dan bien | `admin.html`, `api/admin.js`, `api/_lib/sheets.js`, `api/_lib/comprobante.js` |
| Orden aprobada | Marca la orden `pagada`, **asigna un bloque correlativo de números de forma atómica** (uno por cada $1.000 del precio, 10, 19 o 29: `numero_desde`–`numero_hasta`, con el contador `ediciones.ultimo_numero`) y dispara las notificaciones | `api/_lib/confirmar.js`, `supabase/schema.sql` (`asignar_participaciones`) |
| Mail de confirmación | Resend: "¡Listo, {nombre}! {producto} y tus participaciones": el bloque ("Tus participaciones: del N.º X al N.º Y (N participaciones)"), bici elegida, fecha del sorteo, botón "Descargar / Ver {producto}" con el link de entrega (`packs[].entrega_url`; el curso, `curso.url_acceso`; vacío = "te llega en un mail aparte"), lo que incluye y link a las bases | `api/_lib/notificaciones.js` (`armarMailConfirmacion`, `describirRango`) |
| WhatsApp | Envía la plantilla aprobada por la API oficial de Meta (si está configurada), con el bloque en `{{2}}` | `api/_lib/notificaciones.js` |
| Vuelve al sitio | `/gracias?orden=...` muestra "comprobante en revisión" con los chequeos o, ya aprobada, el bloque de números (`rango: { desde, hasta, cantidad }`); permite volver a subir el comprobante | `gracias.html`, `assets/js/gracias.js`, `api/orden.js`, `api/comprobante.js` |
| Comprobante por mail | Los mails a `belen.baiking@gmail.com` reenviados a `/api/inbound-email` se procesan igual: busca la orden por el mail del remitente (o por el código interno, si aparece) | `api/inbound-email.js` |
| Participación sin cargo | Registra 1 participación por DNI en estado `pendiente` y manda el mail "Registramos tus datos: ahora mandá la carta"; cuando Baiking marca "Carta recibida" en el panel se asigna su número (un bloque de uno) y sale el mail de confirmación ("Recibimos tu carta y registramos tu participación") | `api/participacion-gratuita.js`, `api/admin.js` (`carta_recibida`, `carta_rechazada`), `api/_lib/carta.js` |
| Recordatorios | Cron diario de Vercel (10:00 de Buenos Aires): "Falta una semana para el sorteo" (27/11, a todas las personas con alguna orden) y "¡Hoy es el sorteo!" (4/12, a las personas con participaciones confirmadas, con los bloques de todas sus órdenes), una sola vez por edición | `api/recordatorios.js`, `vercel.json` |
| Planilla | Cron diario (y al instante, desde el hook de cada cambio de estado): espeja las órdenes en Google Sheets (columna "números" con el texto del bloque) y aplica los `SI`/`NO` de "Llegó la plata" | `api/sheets-sync.js`, `api/_lib/sheets.js` |
| Padrón | Exporta el CSV del padrón: una fila por orden pagada con su bloque (`numero_desde`, `numero_hasta`, `cantidad`), ordenado por `numero_desde` y sin huecos, para el sorteo en vivo y la planilla (desde el panel, token en `Authorization: Bearer`) | `api/export.js` |

Idempotencia: el paso a `en_revision` es un update condicional (si la orden se aprobó o rechazó desde el panel mientras se leía el comprobante, no se le pisa el estado); `confirmarOrden` devuelve el mismo bloque (`rango`) si ya fue asignado y los mails/WhatsApp se marcan como enviados en la orden. Un comprobante nunca reabre una orden `rechazada`, `reembolsada` o `anulada`.

## 2. Mails (Resend)

- Remitente: `MAIL_FROM` (propuesto: `Baiking <sorteo@baiking.com.ar>`, con respuestas a `belen.baiking@gmail.com`). Hay que **verificar el dominio baiking.com.ar en Resend** (registros DKIM/SPF en el DNS) para que no caiga en spam.
- Casilla de contacto y comprobantes: `belen.baiking@gmail.com` (`checkout.transferencia.email_comprobantes` y `contacto.email` en la config).

- Todos comparten el marco de `marcoMail`: header rojo con el logo, un solo botón, pie con contacto, leyenda legal y link a las bases, versión en texto plano. Vista previa con datos de ejemplo: `node scripts/mails-preview.mjs` → `dist/mails.html`.

Son siete (el orden es el de `docs/07` §2):

1. **"Recibimos tu comprobante"** (`armarMailComprobanteRecibido`): sale apenas se procesa el comprobante (adjunto en la inscripción, subido en `/gracias` o llegado por mail). Cuerpo: recibimos el comprobante de tu transferencia de $X por {producto}; lo estamos revisando; en cuanto se acredite te mandamos otro mail con tu producto y tu participación (en general, en menos de 48 hs); botón "Ver el estado de mi orden".
2. **Confirmación** (`armarMailConfirmacion`): sale al aprobar. Asunto "¡Listo, {nombre}! {producto} y tus participaciones · Baiking". Cuerpo: "Confirmamos tu pago de {producto}. Ya tenés tu producto y, como bonificación sin cargo, quedaste participando por tu {bici} con N participaciones: del N.º X al N.º Y"; el bloque en grande ("Tus participaciones: del N.º X al N.º Y (N participaciones)", `describirRango`, formato es-AR con miles), sorteo, bici elegida, botón "Descargar / Ver {producto}" con el link de entrega (`packs[].entrega_url`; el curso usa `curso.url_acceso` y agrega `curso.acceso_texto`; si el link está vacío: "Tu producto te llega en un mail aparte, apenas esté listo"), lista "Incluye:", link permanente a la orden, bases y leyenda legal.
3. **"Registramos tus datos: ahora mandá la carta"** (`armarMailGratuitaPendiente`): al completar el formulario sin cargo. Dirección de la tienda, qué tiene que incluir la carta (nombre, DNI, mail, por qué debería ganar), fecha límite (15 días), botón "Ver el estado de mi participación". Una sola vez por orden (marca `instrucciones_enviado_at`).
4. **Carta confirmada** (`armarMailConfirmacion` con `gratuita: true`): cuando Baiking marca "Carta recibida" en el panel. Asunto "¡Listo, {nombre}! Registramos tu participación sin cargo · Baiking"; "Recibimos tu carta y registramos tu participación sin obligación de compra", "Tu participación: N.º X" (un solo número, en el mismo padrón que las demás); sin botón de producto.
5. **"Reservamos tu lugar · datos para transferir"** (`armarMailTransferencia`): solo si una orden entra sin comprobante o el adjunto no se pudo procesar (fallback): monto, alias, CBU, titular, CUIT, banco y botón "Subir el comprobante"; las respuestas van a `email_comprobantes`. En el flujo normal no sale: la persona transfiere antes de enviar el formulario.
6. **"Falta una semana para el sorteo"** (`armarMailRecordatorioSemana`): lo manda `api/recordatorios` 7 días antes de `edicion.fecha_sorteo` a todas las personas con alguna orden (pagada, en revisión o pendiente), una por mail. Tres variantes: general (fecha del sorteo, cierre de inscripciones, botón "Ver los productos": "si todavía no tenés alguno de los productos, estás a tiempo; cada uno se compra una sola vez por persona"), comprobante (su última orden por transferencia sigue pendiente: botón "Subir el comprobante") y carta (su participación sin cargo espera la carta: fecha límite y dirección).
7. **"¡Hoy es el sorteo! 21:00 en vivo"** (`armarMailRecordatorioSorteo`): el día del sorteo, a cada persona con órdenes pagadas, con los bloques de todas sus órdenes juntos ("del N.º 121 al N.º 130 y del N.º 2.412 al N.º 2.440", `describirRangos`) y el botón "Ver el vivo" (Instagram).

Texto de referencia del mail de confirmación (el HTML está en `api/_lib/notificaciones.js`; kicker "Productos digitales + sorteo"):

```
¡Ya estás adentro, Delfina!
Confirmamos tu pago de Curso Baiking de Mantenimiento. Ya tenés tu producto y, como bonificación sin cargo, quedaste participando por tu Polygon Siskiu T7 con 29 participaciones: del N.º 2.412 al N.º 2.440.
Tus participaciones: del N.º 2.412 al N.º 2.440 (29 participaciones)
Bici elegida: Polygon Siskiu T7
Sorteo en vivo: viernes, 4 de diciembre, 21:00 hs por Instagram @baikingtiendadebicis
Descargar / ver Curso Baiking de Mantenimiento: <link>   (mientras el link esté vacío: "Tu producto te llega en un mail aparte, apenas esté listo.")
Incluye:
- Curso en video: cómo preparar tu bici, lavado y lubricación, ajuste general, errores comunes
- Checklist pre-salida en PDF
- Pack de fondos de pantalla
- Tutorial de lavado (YouTube no listado)
Orden: <uuid>
Ver tus participaciones: <link>/gracias?orden=<uuid>
```

En la vía gratuita el mismo mail dice "Tu participación: N.º 1.587" (un solo número). Los números van con separador de miles y sin ceros a la izquierda, en todas las piezas.

Los mails 6 y 7 son idempotentes por edición (`ediciones.recordatorio_semana_at` / `recordatorio_sorteo_at`) y salen en lotes de 100 por `/emails/batch` de Resend. Para probar sin marcar nada: `GET /api/recordatorios?tipo=semana&test=mail@dominio` (o `tipo=sorteo`) con el token de admin; `&forzar=1` manda hoy aunque no sea la fecha. El cron es `"0 13 * * *"` UTC en `vercel.json` (10:00 de Buenos Aires) y se autoriza con `CRON_SECRET`.

## 3. WhatsApp

### Opción A · API oficial de Meta (automático)

1. Crear una cuenta de WhatsApp Business Platform en Meta Business (o vía un BSP como 360dialog / Twilio) con el número 11 5728-0056 (o uno nuevo, ya que el número actual de la tienda no puede usarse a la vez en la app y en la API).
2. Crear y enviar a aprobación una plantilla **categoría "Utility"**, nombre `participacion_confirmada`, idioma `es_AR`:

```
Hola {{1}}, ¡ya estás participando por tu Polygon con Baiking! 🚵
Tus participaciones: {{2}}
Participás por: {{3}}
Sorteo en vivo: {{4}} por Instagram @baikingtiendadebicis.
Ver el detalle de tu orden: {{5}}
Sin obligación de compra. Bases: participa.baiking.com.ar/bases-y-condiciones
```

`{{2}}` es el bloque de la orden como texto: "del N.º 121 al N.º 130" (vía gratuita: "N.º 1.587"), el mismo que va en el mail (`describirRango`). (Dominio a confirmar; ver `docs/04` sección C.)

3. Cargar `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (token permanente de un usuario del sistema), `WHATSAPP_TEMPLATE_NAME` y `WHATSAPP_TEMPLATE_LANG` en Vercel. Sin estas variables, el sistema manda solo el mail (no falla).
4. Costo aproximado: una conversación "utility" en Argentina cuesta centavos de dólar; para 1.000 órdenes es despreciable.

Cuidado con la política de comercio de WhatsApp: el mensaje habla de una promoción con producto y "sin obligación de compra"; no usar la palabra "rifa".

### Opción B · Manual con WhatsApp Business (sin API)

- Exportar el padrón desde el panel (`admin.html` → "Exportar CSV"; el token viaja en el header `Authorization: Bearer`, `?token=` queda solo como fallback). El CSV trae nombre, WhatsApp y el bloque de cada orden (`numero_desde`, `numero_hasta`, `cantidad`).
- Usar "Respuestas rápidas" de WhatsApp Business con el texto de arriba y pegar el bloque ("del N.º 121 al N.º 130"). Viable hasta ~50 órdenes por día.
- Alternativa intermedia: una automatización en Make/Zapier que lea la tabla `ordenes` de Supabase y dispare mensajes por un proveedor.

## 4. Recordatorios y comunicación durante la campaña

| Cuándo | Canal | Mensaje |
|---|---|---|
| Lanzamiento | Instagram (video de Gastón), mail a clientes, WhatsApp de la tienda | "Aprendé a cuidar tu bici y participá por una Polygon. Sin obligación de compra." |
| Semanal | Instagram feed + stories con el contador | Adelantos del curso, del checklist y de los fondos, testimonios, fotos de las bicis |
| 27/11 (7 días antes del sorteo) | Mail automático (`api/recordatorios`, cron de las 10:00) a todas las personas con alguna orden | "Falta una semana para el sorteo": fecha y cierre; según la persona, "subí el comprobante", "mandá la carta" o "si todavía no tenés alguno de los productos, estás a tiempo" |
| 24 hs antes del cierre | Stories + WhatsApp | "Última oportunidad: cerramos mañana 23:59" |
| Día del sorteo | Mail automático (`api/recordatorios`) + stories | "¡Hoy es el sorteo! 21:00 en vivo" con los bloques de cada persona; en stories, la cantidad total de participaciones del padrón, el hash del CSV y el link al vivo |
| Post-sorteo | Todos | Video del sorteo, número sorteado, nombre y localidad del ganador (con su consentimiento), entrega de la bici |

Los posts y stories se pueden programar desde Metricool; los broadcasts extra, desde Resend. La base de contactos se saca de Supabase (`ordenes`) con un filtro por estado `pagada`. Las piezas comunican el producto y su precio, con el claim "Cada $1.000 es una participación" tal como está en el sitio (sin ejemplo numérico); ninguna dice "quedan pocos números", "comprá más para ganar" ni "cuantas más sumás, menos pagás" (no hay descuento por volumen), y cada producto se compra una sola vez por persona.

## 5. Contacto con la persona ganadora

1. El mismo día: llamada + mail + WhatsApp con el acta y el pedido de foto del DNI.
2. Plazo: 7 días hábiles para responder y acreditar identidad (bases, cláusula 8). Luego pasa al suplente 1 y 2.
3. Entrega: Gastón la lleva en persona (o envío embalado si vive lejos); acta de entrega firmada + foto; publicar en redes con consentimiento.
4. Cerrar el padrón: guardar el CSV, el acta JSON de `sorteo.html` y el video del vivo en una carpeta compartida.

## 6. Conectores disponibles en esta cuenta de Claude

Al armar este proyecto detectamos conectados: Gmail, Google Calendar, Google Drive, Notion, Metricool y Higgsfield. El conector **Meta (Meta_Conect)** requiere autorización desde la configuración de conectores de claude.ai antes de poder usarlo para programar publicaciones o mensajes. Con Metricool se puede programar el calendario de posts del punto 4 directamente desde una conversación.

## 7. Transferencia bancaria con comprobante leído por IA (único medio de pago)

Decisión del 28/09: se cobra únicamente por transferencia, sin descuento, y el comprobante se adjunta en el mismo formulario de inscripción. La participación cuenta recién cuando el comprobante se valida.

| Paso | Qué pasa | Archivo |
|---|---|---|
| 1 | En el formulario, al elegir el producto (y la bici por la que participa), la persona ve el monto exacto y los datos bancarios (alias `baiking.bicis`, CBU `0070119420000003239999`, titular X Centro Pilar SRL, CUIT 30-71025912-3, Banco Galicia) con botones "Copiar", transfiere desde su banco y **adjunta el comprobante** (foto, captura o PDF). El campo es obligatorio: sin comprobante no se puede tocar "Participar". Las imágenes se reducen a 1600 px (JPEG) en el navegador; los PDF hasta 3 MB. | `index.html`, `assets/js/app.js` (`renderTransferData`, `archivoABase64`, `validate`) |
| 2 | **Un solo `POST api/checkout`** con los datos de la persona, `pack_id`, `medio_pago: "transferencia"` y `comprobante: { tipo, nombre, contenido_base64 }`. Se validan los datos; si esa persona (DNI) ya tiene una orden de ese producto (`pendiente`, `en_revision` o `pagada`) la API responde `409` ("cada producto se compra una sola vez por persona"; productos distintos sí); se crea la orden `pendiente` con el monto exacto y un código interno `BK-XXXXX` (identificador de la orden en el panel y los mails; no se muestra ni se pide en el concepto) y se procesa el comprobante. Tope anti-spam: 3 órdenes por transferencia sin pagar por mail en 24 h. | `api/checkout.js`, `api/_lib/validar.js` |
| 3 | El archivo se guarda en Supabase Storage (bucket privado `comprobantes`) y **Claude lo lee**: monto, fecha, cuenta destino, titular, referencia, señales de edición y confianza (salida estructurada JSON). | `api/_lib/comprobante.js` (`guardarArchivo`, `leerComprobante`) |
| 4 | Chequeos contra la orden: monto exacto, cuenta destino (alias/CBU/CUIT/titular de la config), fecha reciente, sin señales de edición, confianza ≥ 0,8. | `evaluarComprobante()` |
| 5 | La orden pasa a **`en_revision`** (update condicional) y sale el mail "Recibimos tu comprobante". `/gracias?orden=...` muestra el estado y los chequeos. | `procesarComprobante()`, `armarMailComprobanteRecibido()`, `gracias.html` |
| 6 | En el panel la orden aparece en "Transferencias por revisar" con los chequeos en verde/rojo y el link al comprobante (URL firmada de 5 minutos). **Aprobar** (o "Llegó" en la conciliación, o `SI` en la planilla) la pasa a `pagada`, asigna el bloque de números (la respuesta trae `rango`) y manda el mail de confirmación con el link del producto (+ WhatsApp); **Rechazar** la pasa a `rechazada` con un motivo. | `admin.html`, `assets/js/admin.js`, `api/admin.js`, `api/_lib/confirmar.js` |
| 6b | Con `TRANSFERENCIAS_AUTO_APROBAR=true`, si todos los chequeos dan bien se aprueba sola sin pasar por el panel (`revisado_por: 'auto'`). | `api/_lib/comprobante.js` |
| 7 | Carga posterior: si el comprobante no llegó o fue rechazado, la persona lo sube de nuevo desde `/gracias` (`POST api/comprobante` con `{ orden_id, tipo, nombre, contenido_base64 }`; solo órdenes `pendiente` o `en_revision`). | `api/comprobante.js`, `assets/js/gracias.js` |
| 8 | Por mail: comprobantes mandados a `belen.baiking@gmail.com`. Un servicio de correo entrante reenvía el mail a `/api/inbound-email` (header `X-Inbound-Secret`), que busca la orden por el mail del remitente (la última por transferencia que siga abierta) o por el código interno si aparece, y procesa el adjunto igual que el paso 3. Sin reenvío automático, Belén revisa la casilla y aprueba desde el panel (funciona también con órdenes `pendiente`, sin comprobante cargado). | `api/inbound-email.js`, `api/admin.js` |

Estados de la orden: `pendiente` (creada) → `en_revision` (comprobante cargado y leído) → `pagada` (aprobada: recién acá cuentan las participaciones y se asigna el bloque de números). Cierres: `rechazada` (panel), `reembolsada`, `anulada`. Un comprobante nunca reabre una orden cerrada.

### El riesgo que hay que tener claro

La IA **lee** el comprobante; no puede saber si es verdadero. Los comprobantes editados (monto o destinatario cambiados con un editor de imágenes) y los de transferencias programadas o rechazadas son la estafa más común en ventas por transferencia en Argentina. Por eso:

- Dejá `TRANSFERENCIAS_AUTO_APROBAR=false` (valor por defecto): la orden queda "por revisar" y se aprueba desde el panel **después de ver la acreditación** en el home banking de Galicia. El panel muestra los chequeos de la IA para que la revisión tome 10 segundos.
- Cómo encontrar el movimiento en el extracto: monto exacto, fecha y nombre o CUIT del ordenante (la IA los lee y el panel los muestra). El código `BK-XXXXX` ya no se le pide al participante, así que no va a estar en el concepto.
- La aprobación automática no depende del código `BK-XXXXX`: `evaluarComprobante()` marca `aprobable` con comprobante válido, monto, destino y fecha correctos, sin edición y confianza ≥ 0,8 (`codigo_ok` se guarda solo como dato para el panel).
- Rechazar desde el panel las órdenes que no acreditan en 48 h (`plazo_horas`): hoy no hay anulación automática.
- Si más adelante se quiere automatizar del todo, la forma correcta es conciliar contra el banco: una cuenta recaudadora con CVU por orden o un proveedor con webhook de acreditación (ver `docs/05-cobros-y-comparativa-internacional.md` §5). Con eso se puede prender la aprobación automática con tranquilidad.

### Configuración necesaria

1. `checkout.transferencia` en `config/campaign.json`: ya cargado (alias, CBU, titular, CUIT, banco, `descuento_pct: 0`, `email_comprobantes: belen.baiking@gmail.com`, `plazo_horas: 48`).
2. Crear el bucket privado `comprobantes` en Supabase Storage.
3. `ANTHROPIC_API_KEY` en Vercel (sin ella, los comprobantes se guardan igual pero sin lectura automática).
4. `TRANSFERENCIAS_AUTO_APROBAR` en Vercel (`false` recomendado).
5. Casilla `belen.baiking@gmail.com` (Gmail). Tres formas de conectarla, de menos a más trabajo:
   - **Revisión manual (sin configurar nada):** Belén abre el mail, busca la orden en el panel por nombre o mail, mira la acreditación en Galicia y aprueba.
   - **Google Apps Script en la cuenta de Gmail:** un script con disparador cada 5 minutos que lee los mails no leídos con adjunto, arma el JSON `{ from, subject, text, html, attachments[] }` y lo manda a `/api/inbound-email` con el header `X-Inbound-Secret`. No necesita dominio propio. Ejemplo (probar antes de lanzar):

```js
// script.google.com, cuenta belen.baiking@gmail.com. Disparador: cada 5 minutos.
// Propiedad del script INBOUND_SECRET = el mismo valor que en Vercel.
function reenviarComprobantes() {
  const url = 'https://participa.baiking.com.ar/api/inbound-email'; // dominio a confirmar
  const secreto = PropertiesService.getScriptProperties().getProperty('INBOUND_SECRET');
  for (const hilo of GmailApp.search('is:unread has:attachment newer_than:2d', 0, 20)) {
    for (const m of hilo.getMessages()) {
      if (!m.isUnread()) continue;
      const attachments = m.getAttachments().map((a) => ({
        filename: a.getName(),
        content_type: a.getContentType(),
        content: Utilities.base64Encode(a.getBytes()),
      }));
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Inbound-Secret': secreto },
        payload: JSON.stringify({ from: m.getFrom(), subject: m.getSubject(), text: m.getPlainBody(), html: m.getBody(), attachments }),
        muteHttpExceptions: true,
      });
      m.markRead();
    }
  }
}
```

   - **Reenvío automático de Gmail a una casilla con correo entrante** (por ejemplo `comprobantes@baiking.com.ar` con Cloudflare Email Routing, si el DNS del dominio está en Cloudflare): en Gmail, "Reenvío y correo POP/IMAP" + un filtro "tiene adjunto → reenviar". El Worker de abajo convierte el mail en JSON y llama al endpoint. Verificar en la prueba que el remitente original llega en `from` (es lo que usa el endpoint para encontrar la orden).

```js
// worker.js (Cloudflare Email Worker) — requiere el paquete postal-mime
import PostalMime from 'postal-mime';

export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const mail = await PostalMime.parse(raw);
    const attachments = (mail.attachments || []).map((a) => ({
      filename: a.filename,
      content_type: a.mimeType,
      content: btoa(String.fromCharCode(...new Uint8Array(a.content))),
    }));
    await fetch('https://participa.baiking.com.ar/api/inbound-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Inbound-Secret': env.INBOUND_SECRET },
      body: JSON.stringify({ from: message.from, subject: mail.subject, text: mail.text, html: mail.html, attachments }),
    });
  },
};
```

6. Para cualquiera de las dos vías automáticas: `INBOUND_SECRET` en Vercel. Resend, Postmark o Mailgun también tienen "inbound" con webhooks; cualquiera sirve mientras mande el JSON con ese formato.

### Costo

Una lectura con `claude-opus-5-5` sobre una imagen de comprobante ronda 2.000 a 4.000 tokens de entrada y menos de 500 de salida: aproximadamente USD 0,02 a 0,03 por comprobante. Para 500 transferencias, unos USD 15.

## 8. Mercado Pago: desactivado, cómo reactivarlo

Decisión del 28/09: no se ofrece. La integración (Checkout Pro + webhook) sigue en el repositorio y se reactiva sin tocar código:

1. `config/campaign.json` → `checkout.mercadopago.habilitada: true`. El modal vuelve a mostrar el selector de medio de pago (Mercado Pago primero, transferencia segunda) y `api/checkout.js` acepta `medio_pago: "mercadopago"`: crea la preferencia (`api/_lib/mercadopago.js`, ítem = el producto digital comprado, `pack.nombre` con su descripción, sin mencionar el sorteo) y devuelve `init_point`.
2. Vercel: `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` de producción; `BASE_URL` correcta (arma las `back_urls` y la `notification_url`).
3. En el panel de Mercado Pago: webhook `https://<dominio>/api/webhooks/mercadopago`, evento "Pagos". El webhook verifica la firma, marca la orden `pagada`, asigna el bloque de números y manda mail y WhatsApp (`api/webhooks/mercadopago.js`, `api/_lib/pagos-mp.js`). Si un webhook se pierde, el panel tiene la acción `sincronizar_mp`.
4. Elegir en "Costos y cuotas" la liberación a 14-18 días y dejar las cuotas solo con interés a cargo del cliente (`docs/05` §2 y §8). Tener en cuenta que la Protección al Vendedor no cubre productos digitales (`docs/05` §5).
5. Probar con credenciales de prueba: compra → webhook → bloque de números → mail → `/gracias`.
