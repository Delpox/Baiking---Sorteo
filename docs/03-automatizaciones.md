# 03 · Automatizaciones: mail, WhatsApp y recordatorios

## 1. Qué pasa automáticamente hoy (modo `api`)

| Momento | Qué hace el sistema | Archivo |
|---|---|---|
| El participante completa el formulario | Valida datos, crea la orden en estado `pendiente` y redirige a Mercado Pago | `api/checkout.js` |
| Mercado Pago aprueba el pago | Recibe el webhook (firma verificada), marca la orden `pagada`, **asigna números correlativos de forma atómica** y dispara notificaciones | `api/webhooks/mercadopago.js`, `supabase/schema.sql` (`asignar_participaciones`) |
| Notificación por mail | Envía el mail de confirmación con Resend: números, bici elegida, fecha del sorteo, link al curso y a las bases | `api/_lib/notificaciones.js` |
| Notificación por WhatsApp | Envía la plantilla aprobada por la API oficial de Meta (si está configurada) | `api/_lib/notificaciones.js` |
| Vuelve al sitio | La página `/gracias?orden=...` muestra los números (y reintenta sola si el webhook demora) | `gracias.html`, `api/orden.js` |
| Participación sin cargo | Registra 1 participación por DNI, asigna número y manda el mail | `api/participacion-gratuita.js` |
| Padrón | Exporta CSV de todas las participaciones pagas para el escribano y el sorteo | `api/export.js` |

Idempotencia: Mercado Pago puede mandar el mismo webhook varias veces; la función SQL devuelve los mismos números si ya fueron asignados y los mails/WhatsApp se marcan como enviados en la orden.

## 2. Mail de confirmación (Resend)

- Remitente: `MAIL_FROM` (por ejemplo `Baiking <hola@baiking.com.ar>`). Hay que **verificar el dominio baiking.com.ar en Resend** (registros DKIM/SPF en el DNS) para que no caiga en spam.
- Asunto: "¡Listo, {nombre}! Tu {pack} y tus participaciones · Baiking".
- Cuerpo: saludo, confirmación del pack, números en grande, bici elegida, fecha y hora del sorteo, botón "Entrar al curso", link permanente a la orden, link a bases, leyenda legal.
- Versión sin cargo: mismo mail sin el botón del curso y con la frase "Registramos tu participación sin obligación de compra".

Texto de referencia (el HTML está en `api/_lib/notificaciones.js`):

```
¡Ya estás adentro, Delfina!
Confirmamos tu pago de Curso + Service (Curso online de Mantenimiento y Puesta a Punto de tu Bici).
Tus participaciones: 0142 · 0143 · 0144 · 0145 · 0146
Bici elegida: Polygon Siskiu T7
Sorteo en vivo: viernes, 4 de diciembre, 21:00 hs por Instagram @baikingtiendadebicis
Acceso al curso: <link>
Orden: <uuid>
Bases y condiciones: <link>
```

## 3. WhatsApp

### Opción A · API oficial de Meta (automático)

1. Crear una cuenta de WhatsApp Business Platform en Meta Business (o vía un BSP como 360dialog / Twilio) con el número 11 5728-0056 (o uno nuevo, ya que el número actual de la tienda no puede usarse a la vez en la app y en la API).
2. Crear y enviar a aprobación una plantilla **categoría "Utility"**, nombre `participacion_confirmada`, idioma `es_AR`:

```
Hola {{1}}, ¡ya estás participando por tu Polygon con Baiking! 🚵
Tus participaciones: {{2}}
Participás por: {{3}}
Sorteo en vivo: {{4}} por Instagram @baikingtiendadebicis.
Ver el detalle y tu comprobante: {{5}}
Sin obligación de compra. Bases: baiking.com.ar/participa/bases-y-condiciones
```

3. Cargar `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (token permanente de un usuario del sistema), `WHATSAPP_TEMPLATE_NAME` y `WHATSAPP_TEMPLATE_LANG` en Vercel. Sin estas variables, el sistema manda solo el mail (no falla).
4. Costo aproximado: una conversación "utility" en Argentina cuesta centavos de dólar; para 1.000 órdenes es despreciable.

Cuidado con la política de comercio de WhatsApp: el mensaje habla de una promoción con producto y "sin obligación de compra"; no usar palabras como "rifa" o "chances".

### Opción B · Manual con WhatsApp Business (sin API)

- Exportar el padrón desde `/api/export?token=...` (CSV con nombre, WhatsApp y números).
- Usar "Respuestas rápidas" de WhatsApp Business con el texto de arriba y pegar los números. Viable hasta ~50 órdenes por día.
- Alternativa intermedia: una automatización en Make/Zapier que lea la tabla `ordenes` de Supabase y dispare mensajes por un proveedor.

## 4. Recordatorios y comunicación durante la campaña

| Cuándo | Canal | Mensaje |
|---|---|---|
| Lanzamiento | Instagram (video de Gastón), mail a clientes, WhatsApp de la tienda | "Aprendé a cuidar tu bici y participá por una Polygon. Sin obligación de compra." |
| Semanal | Instagram feed + stories con el contador | Clases del curso como adelanto, testimonios, fotos de las bicis |
| 7 días antes del cierre | Mail + WhatsApp a quienes ya compraron | "Sumá participaciones con el pack Service / regalá el curso" |
| 24 hs antes del cierre | Stories + WhatsApp | "Última oportunidad: cerramos mañana 23:59" |
| Día del sorteo | Stories, mail | "Hoy 21:00 en vivo" + link al vivo |
| Post-sorteo | Todos | Video del sorteo, nombre y localidad del ganador (con su consentimiento), entrega de la bici |

Estos envíos se pueden programar desde Metricool (posts y stories) y desde Resend (broadcasts a la base). La base de contactos se saca de Supabase (`ordenes`) con un filtro por estado `pagada`.

## 5. Contacto con la persona ganadora

1. El mismo día: llamada + mail + WhatsApp con el acta y el pedido de foto del DNI.
2. Plazo: 7 días hábiles para responder y acreditar identidad (bases, cláusula 8). Luego pasa al suplente 1 y 2.
3. Entrega: en la tienda o envío embalado; acta de entrega firmada + foto; publicar en redes con consentimiento.
4. Cerrar el padrón: guardar el CSV, el acta JSON de `sorteo.html` y el acta notarial en una carpeta compartida.

## 6. Conectores disponibles en esta cuenta de Claude

Al armar este proyecto detectamos conectados: Gmail, Google Calendar, Google Drive, Notion, Metricool y Higgsfield. El conector **Meta (Meta_Conect)** requiere autorización desde la configuración de conectores de claude.ai antes de poder usarlo para programar publicaciones o mensajes. Con Metricool se puede programar el calendario de posts del punto 4 directamente desde una conversación.

## 7. Transferencia bancaria con comprobante leído por IA (opcional)

Idea del dueño del proyecto: cobrar por transferencia (sin comisión de Mercado Pago), que la gente mande el comprobante y que una IA lo registre sola. Quedó implementado así:

| Paso | Qué pasa | Archivo |
|---|---|---|
| 1 | En el modal el participante elige "Transferencia bancaria" (con el descuento configurado en `checkout.transferencia.descuento_pct`). | `index.html`, `assets/js/app.js` |
| 2 | Se crea la orden en estado `pendiente` con un **código único** (`BK-XXXXX`) y el monto exacto, y sale un mail con alias, CBU, titular, monto y código. | `api/checkout.js`, `api/_lib/notificaciones.js` |
| 3 | La página `/gracias` muestra los datos para transferir con botones "Copiar" y un formulario para **subir el comprobante** (foto, captura o PDF; las imágenes se achican en el navegador a 1600 px). | `gracias.html`, `assets/js/gracias.js` |
| 4 | El comprobante se guarda en Supabase Storage (bucket privado `comprobantes`) y **Claude lo lee**: monto, fecha, cuenta destino, titular, referencia, códigos detectados, señales de edición y confianza (salida estructurada JSON). | `api/comprobante.js`, `api/_lib/comprobante.js` |
| 5 | El sistema compara lo leído con la orden: monto exacto, cuenta destino (alias/CBU/CUIT/titular configurados), código presente, fecha reciente, sin señales de edición. | `evaluarComprobante()` |
| 6 | La orden pasa a **`en_revision`** y el participante recibe un mail de acuse. En el panel aparece en "Transferencias por revisar" con los chequeos en verde/rojo y el link al comprobante; **Aprobar** asigna los números y manda el mail del curso, **Rechazar** la cierra. | `admin.html`, `api/admin.js` |
| 6b | Si `TRANSFERENCIAS_AUTO_APROBAR=true` y todos los chequeos dan bien con confianza ≥ 0,8, se aprueba sola sin pasar por el panel. | `api/_lib/comprobante.js` |
| 7 | Alternativa por mail: la gente responde el mail de instrucciones (o escribe a `pagos@...`) con el comprobante adjunto. Un servicio de correo entrante reenvía el mail a `/api/inbound-email`, que busca la orden por el código (asunto o cuerpo) o por el mail del remitente y procesa el adjunto igual que el paso 4. | `api/inbound-email.js` |

### El riesgo que hay que tener claro

La IA **lee** el comprobante; no puede saber si es verdadero. Los comprobantes editados (monto o destinatario cambiados con un editor de imágenes) son la estafa más común en ventas por transferencia en Argentina. Por eso:

- Dejá `TRANSFERENCIAS_AUTO_APROBAR=false` (valor por defecto): la orden queda "por revisar" y se aprueba desde el panel **después de ver la acreditación** en el home banking o en la app de Mercado Pago. El panel ya muestra los chequeos de la IA para que la revisión tome 10 segundos.
- El código `BK-XXXXX` en el concepto de la transferencia es lo que permite encontrar el movimiento en el extracto en un segundo.
- Si más adelante se quiere automatizar del todo, la forma correcta es conciliar contra el banco: una cuenta recaudadora con CVU por cliente o un proveedor con webhook de acreditación (ver `docs/05-cobros-y-comparativa-internacional.md`). Con eso se puede prender la aprobación automática con tranquilidad.

### Configuración necesaria

1. Completar `checkout.transferencia` en `config/campaign.json`: alias, CBU, titular, CUIT, banco, descuento, mail para comprobantes, plazo.
2. Crear el bucket privado `comprobantes` en Supabase Storage.
3. `ANTHROPIC_API_KEY` en Vercel (sin ella, los comprobantes se guardan igual pero sin lectura automática).
4. Para la vía por mail: `INBOUND_SECRET` en Vercel y un servicio de correo entrante que llame al endpoint. Ejemplo con **Cloudflare Email Routing + Worker** (gratis), que recibe `pagos@baiking.com.ar` y reenvía el mail normalizado:

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

Resend, Postmark o Mailgun también tienen "inbound" con webhooks; cualquiera sirve mientras mande el JSON con ese formato.

### Costo

Una lectura con `claude-opus-5-5` sobre una imagen de comprobante ronda 2.000 a 4.000 tokens de entrada y menos de 500 de salida: aproximadamente USD 0,02 a 0,03 por comprobante. Para 500 transferencias, unos USD 15.
