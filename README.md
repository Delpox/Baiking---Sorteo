# Baiking · Productos digitales + participación por una Polygon

Sitio y sistema para la primera edición de la promoción de **Baiking Tienda de Bicis** (Del Viso, Pilar): la gente compra uno de los tres **productos digitales** de Baiking (pack de fondos de pantalla, checklist pre-salida en PDF o el **Curso Baiking de Mantenimiento** en video, que lo da Gastón) y cada compra incluye tantas participaciones en el sorteo de una Polygon como pesos tiene su precio: **cada $1 es una participación** ($10.000 son 10.000 números en el sorteo; el curso, $25.000, son 25.000). Se sortea **una sola bici** y quien gana elige entre la **Siskiu T7** (trail), la **Tambora** (gravel) o la **Strattos** (ruta, a confirmar); Gastón la entrega personalmente, esté donde esté. Se paga únicamente por **transferencia bancaria**, con el comprobante adjunto en el mismo formulario, y el producto llega por mail. Sorteo en vivo por Instagram, grabado, con el padrón publicado antes de sortear. **Sin obligación de compra:** la vía gratuita (formulario + carta) da una (1) participación por persona, que entra en el mismo padrón que las demás.

> Estado: demo lista para mostrar (modo `demo`, sin cobros reales). Decisiones del 28/09 (solo transferencia, sin escribano, sin tope de participaciones, identidad roja), modelo del 29/09 (tres productos digitales), regla del 29/09 por la tarde (participaciones proporcionales al precio: $1 = 1, decisión comercial de Baiking) y hero del 30/09 (las tres bicis, claim "Cada $1 es una participación") aplicados en `config/campaign.json`. Pendientes: precios de los tres productos ($10.000 / $12.000 / $25.000, a confirmar con Gastón), los links de entrega de los productos (`packs[].entrega_url`, `curso.url_acceso`), fechas (propuesta 15/10 → 4/12), versión de la Tambora y de la Strattos, foto de Gastón, dominio `participa.baiking.com.ar` y validación de las bases por el abogado (el esquema proporcional es el que `docs/08` calificó de riesgo alto). Ver `docs/02-mecanica-y-decisiones.md` §4 y `docs/04-checklist-lanzamiento.md`.

## Qué hay en el repositorio

```
index.html                  Landing: hero (las tres bicis + selector de producto, claim "Cada $1 es una participación" y barra de tiempo), lo esencial, el premio, cómo funciona, el curso, el sorteo, FAQ, footer compacto
participa-sin-cargo.html    Vía gratuita de participación (obligatoria por Lealtad Comercial): formulario + carta a la tienda
gracias.html                Estado de la orden: comprobante en revisión (con los chequeos), carta pendiente o bloque de números asignado; permite volver a subir el comprobante
bases-y-condiciones.html    Bases y condiciones (borrador para revisión legal)
sorteo.html                 Herramienta para el sorteo en vivo (carga el padrón por bloques, verifica su integridad y su hash, sortea un número con crypto, exporta acta)
admin.html                  Panel en tiempo real: KPIs, gráficos, transferencias por revisar ("Llegó / No llegó"), cartas pendientes ("Carta recibida"), órdenes (admin.html?demo=1 = datos de ejemplo)
config/campaign.json        ÚNICA fuente de verdad: fechas, bicis, productos (packs) y precios, curso, contacto, textos legales, datos de transferencia
assets/css/                 styles.css (sitio) · admin.css (panel)
assets/js/                  app.js (landing y formulario de compra con el comprobante) · gracias.js (estado de la orden) · admin.js (panel)
assets/img/                 Sprite de íconos/ilustraciones, logo real (logo-baiking-*.png), fotos de las bicis (*.webp), favicons, og.html → og.png (sin build)
api/checkout.js             POST · crea la orden por transferencia con el comprobante adjunto (Claude lo lee); 409 si esa persona (DNI) ya compró ese producto; si se reactiva Mercado Pago, crea la preferencia
api/webhooks/mercadopago.js POST · webhook de MP (firma verificada): desactivado, queda por si se reactiva
api/orden.js                GET · resumen de una orden, sus chequeos y su bloque de números (`rango: { desde, hasta, cantidad }`; página /gracias)
api/participacion-gratuita.js POST · vía gratuita: 1 participación por DNI y edición; queda pendiente hasta que llega la carta
api/comprobante.js          POST · carga posterior del comprobante desde /gracias · GET (admin) · abre el comprobante
api/inbound-email.js        POST · comprobantes que llegan por mail a belen.baiking@gmail.com, reenviados por un servicio de correo entrante (X-Inbound-Secret)
api/admin.js                GET · datos del panel (KPIs `participaciones_total` y `numeros_emitidos`) · POST · aprobar o rechazar transferencias, marcar "Llegó / No llegó", "Carta recibida" / "Carta rechazada" (devuelven el `rango` asignado; y sincronizar un pago de MP si se reactiva) (ADMIN_TOKEN)
api/recordatorios.js        GET/POST · mails "falta una semana" y "hoy es el sorteo" (cron diario de Vercel; ?tipo=…&test=mail para probar)
api/sheets-sync.js          GET/POST · espejo de las órdenes en Google Sheets y lectura de la columna "Llegó la plata" (cron diario)
api/progreso.js             GET · participaciones ocupadas sobre el cupo (sin uso: la barra del sitio es lineal en el tiempo; queda por si se fija un tope)
api/ping.js                 POST · beacon de presencia ("en el sitio ahora" / "visitas hoy" en el panel)
api/export.js               GET · padrón CSV: una fila por orden pagada con su bloque `numero_desde`–`numero_hasta` (sorteo en vivo y planilla; Authorization: Bearer)
api/_lib/                   db (Supabase) · mercadopago (preferencias, firma del webhook) · pagos-mp (aplica el estado de un pago a la orden)
                            · confirmar (pagada + bloque de números + avisos) · notificaciones (los 7 mails por Resend, y WhatsApp) · comprobante (Storage, lectura
                            con Claude, chequeos) · carta (dirección y plazo de la vía gratuita) · sheets (planilla) · validar y telefono (datos de la persona, WhatsApp) · http
supabase/schema.sql         Base de datos Postgres: ediciones (contador `ultimo_numero`), órdenes (bloque `numero_desde`–`numero_hasta`), presencia, RPC `asignar_participaciones` y vista `padron_sorteo`
vercel.json                 Crons diarios (sheets-sync, recordatorios), cabeceras y URLs limpias
scripts/                    check (validaciones), screenshots (Playwright), build-demo (HTML autocontenido), og-image (imagen para redes), sorteo (CLI),
                            mails-preview (vista previa de los mails), doc-page (docs → página)
docs/                       01 investigación legal · 02 mecánica y decisiones · 03 automatizaciones · 04 checklist · 05 cobros y comparativa internacional
                            · 06 Google Sheets · 07 puesta en marcha · 08 revisión legal (del modelo anterior)
```

## Cómo verlo

```bash
npm run dev            # sirve el sitio en http://localhost:3000 (modo demo, sin backend)
npm run check          # valida config, íconos, links y sintaxis del backend
npm run screenshots    # capturas desktop + móvil de todas las páginas en ./screenshots (requiere Playwright)
npm run sorteo -- padron.csv   # sorteo por línea de comandos (alternativa a sorteo.html); deja el registro JSON
node scripts/build-demo.mjs    # genera ./dist con cada página en un solo archivo HTML (para compartir)
node scripts/mails-preview.mjs # genera dist/mails.html con los 7 mails automáticos y datos de ejemplo
node scripts/og-image.mjs      # genera assets/img/og.png (imagen para compartir en redes; no está en el repo)
```

En modo `demo` el botón "Participar" simula el envío del formulario con el comprobante y muestra "Comprobante recibido", sin cobrar.

## Modos de cobro (`config/campaign.json` → `checkout.modo`)

| Modo | Qué hace | Cuándo usarlo |
|---|---|---|
| `demo` | Simula la compra en el navegador | Para mostrar el proyecto |
| `api` | Crea la orden por transferencia con el comprobante adjunto, Claude lo lee, se aprueba (panel, planilla o automático), asigna el bloque de números y notifica por mail/WhatsApp | Producción |
| `externo` | Redirige cada producto a `packs[].url_externa` (por ejemplo, un producto en la Tienda Nube de Baiking) | Si se prefiere cobrar desde la tienda existente |

Medio de pago: únicamente transferencia bancaria, sin descuento (decisión del 28/09: `checkout.transferencia.habilitada: true`, `descuento_pct: 0`). Mercado Pago está desactivado (`checkout.mercadopago.habilitada: false`); la integración queda dormida en `api/` y con `true` el modal vuelve a mostrar el selector (cómo reactivarlo: `docs/03-automatizaciones.md` §8). Qué se lleva cada medio: `docs/05-cobros-y-comparativa-internacional.md` (escrito para el modelo anterior; lo de medios de cobro sigue valiendo).

## Cómo se cobra: transferencia con el comprobante en el checkout

1. En el formulario de inscripción la persona elige el producto y la bici por la que participa, ve el monto exacto y los datos bancarios (alias `baiking.bicis`, CBU, titular X Centro Pilar SRL, CUIT, Banco Galicia, con botones "Copiar"), transfiere desde su banco y **adjunta el comprobante** (foto, captura o PDF; las imágenes se reducen a 1600 px en el navegador) antes de tocar "Participar".
2. Un solo `POST api/checkout` con los datos y `comprobante: { tipo, nombre, contenido_base64 }`. Antes de crear la orden, `api/checkout.js` responde `409` si esa persona (DNI) ya tiene una orden de ese producto (pendiente, en revisión o pagada): **cada producto se compra una sola vez por persona**; productos distintos sí (con los tres, 10.000 + 12.000 + 25.000 = 47.000 participaciones pagas como máximo por persona). Después crea la orden en estado `pendiente` con el monto exacto, guarda el archivo en el bucket privado `comprobantes` de Supabase Storage y, si hay `ANTHROPIC_API_KEY`, Claude lo lee (monto, fecha, cuenta destino, titular, señales de edición) y lo compara con la orden (`api/_lib/comprobante.js`). La orden pasa a `en_revision` y la persona recibe el mail "Recibimos tu comprobante"; `/gracias?orden=...` muestra el estado.
3. En `admin.html` la orden aparece en "Transferencias por revisar" con los chequeos en verde/rojo y el link al comprobante. **Aprobar** o marcar **"Llegó"** (después de ver la acreditación en el home banking de Galicia) la pasa a `pagada`, asigna un bloque correlativo de números (tantos como pesos tiene el precio: "Tus participaciones: del N.º X al N.º Y") y manda el mail de confirmación con el link del producto (`packs[].entrega_url`; el curso usa `curso.url_acceso`; mientras estén vacíos, el mail avisa que el producto llega aparte) (+ WhatsApp); **Rechazar** la cierra. Con `TRANSFERENCIAS_AUTO_APROBAR=true` se aprueba sola cuando todos los chequeos dan bien y la confianza es ≥ 0,8.
4. Si el comprobante no llegó o fue rechazado, la persona lo sube de nuevo desde `/gracias` (`POST api/comprobante`) o lo manda por mail a `belen.baiking@gmail.com`; con un servicio de correo entrante ese mail llega a `/api/inbound-email`, que busca la orden por el mail del remitente.

La IA lee el comprobante, pero no puede saber si la plata entró: un comprobante editado pasa los chequeos. Por eso el valor por defecto es `TRANSFERENCIAS_AUTO_APROBAR=false` y se aprueba desde el panel después de ver la acreditación (buscar por monto exacto, fecha y nombre o CUIT del ordenante). El código `BK-XXXXX` sigue existiendo como identificador interno de la orden, pero ya no se le muestra al participante ni se le pide en el concepto. Detalle y riesgos en `docs/03-automatizaciones.md` §7; costos y conciliación automática en `docs/05-cobros-y-comparativa-internacional.md`.

Planilla compartida: todas las órdenes se espejan en un Google Sheets (`api/_lib/sheets.js`, `api/sheets-sync.js`) que Gastón puede ver desde cualquier lado; la columna "Llegó la plata" (SI/NO) se puede marcar ahí o en el panel y ambas quedan sincronizadas (cron diario en `vercel.json`, o al instante con el Apps Script de `docs/06-google-sheets.md`). Configuración paso a paso en `docs/06-google-sheets.md`.

Participación sin cargo: formulario en `/participa-sin-cargo` + carta a Las Camelias 3327 (Del Viso, Pilar) contando por qué debería ganar la bici, dentro de los 15 días; una (1) participación por persona (DNI), decisión explícita de Baiking. La orden queda `pendiente` con el mail "Registramos tus datos: ahora mandá la carta" y se confirma (número + mail) cuando Baiking marca "Carta recibida" en el panel (`api/admin.js`).

Mails automáticos (Resend, `api/_lib/notificaciones.js`), siete: comprobante recibido · confirmación (producto + bloque de participaciones: "del N.º X al N.º Y (N participaciones)") · carta pendiente · carta confirmada · datos para transferir (solo si la orden entra sin comprobante) · falta una semana para el sorteo · hoy es el sorteo. Los dos últimos los manda `api/recordatorios.js` con el cron diario de `vercel.json` (10:00 de Buenos Aires), una sola vez por edición. Vista previa: `node scripts/mails-preview.mjs`. Detalle: `docs/03` §2 y `docs/07` §2.

## Variables de entorno (`.env.example`)

| Variable | Para qué |
|---|---|
| `BASE_URL` | URL pública del sitio (links de los mails; back_urls y webhook de Mercado Pago si se reactiva) |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Credenciales de producción de Mercado Pago y clave secreta del webhook (solo si se reactiva) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos y Storage (solo backend) |
| `RESEND_API_KEY`, `MAIL_FROM` | Mails transaccionales |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp Cloud API (opcional; sin ellas solo se manda mail) |
| `ADMIN_TOKEN` | Panel (`admin.html`), `/api/admin`, `/api/export`, `/api/recordatorios` a mano y apertura de comprobantes; viaja en `Authorization: Bearer` (`?token=` solo como fallback) |
| `ANTHROPIC_API_KEY` | Lectura automática de comprobantes con Claude (opcional; sin ella quedan "por revisar" sin lectura) |
| `TRANSFERENCIAS_AUTO_APROBAR` | `true` aprueba sola la transferencia cuando todos los chequeos dan bien; recomendado `false` |
| `INBOUND_SECRET` | Secreto compartido con el servicio que reenvía los mails de `belen.baiking@gmail.com` a `/api/inbound-email` |
| `CRON_SECRET` | Lo manda Vercel Cron en `Authorization: Bearer` a `/api/sheets-sync` y `/api/recordatorios` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SHEETS_TAB` | Planilla de Google Sheets (espejo de órdenes y columna "Llegó la plata"; `docs/06`) |

## Puesta en producción (resumen)

1. Supabase: ejecutar `supabase/schema.sql` y crear el bucket privado `comprobantes`.
2. Resend: dominio verificado + API key. (WhatsApp Cloud API opcional.)
3. Vercel: importar el repo, cargar las variables de `.env.example` (`ADMIN_TOKEN` para el panel, `ANTHROPIC_API_KEY` para leer comprobantes, `TRANSFERENCIAS_AUTO_APROBAR=false`, `INBOUND_SECRET` si se usa el correo entrante, `CRON_SECRET` para los dos crons, las `GOOGLE_*` para la planilla), dominio `participa.baiking.com.ar` (a confirmar).
4. Datos bancarios ya cargados en `checkout.transferencia`. Confirmar los precios de `packs[]` (con `packs[].participaciones` igual al precio: `npm run check` da error si no coinciden) y cargar los links de entrega (`packs[].entrega_url`, `curso.url_acceso`). Poner `checkout.modo: "api"` y desplegar. Probar de punta a punta con una transferencia real de $1 entre cuentas propias, la vía gratuita con "Carta recibida" y los recordatorios con `?tipo=semana&test=mail`.
5. Solo si se reactiva Mercado Pago: credenciales de producción + webhook a `/api/webhooks/mercadopago`.

Detalle completo en `docs/04-checklist-lanzamiento.md` y `docs/07-puesta-en-marcha.md`.

## Por qué está armado así (y no como Autoloop)

En Argentina vender "chances" es juego de azar sin autorización (art. 301 bis del Código Penal) y la Ley de Lealtad Comercial exige que toda promoción con premio tenga una vía gratuita con igual probabilidad y la leyenda "Sin obligación de compra". La revisión legal del 29/09 (`docs/08`) calificó de riesgo alto el modelo anterior (packs de "chances" del mismo curso, a menor precio unitario cuantas más se compraban). El modelo vigente es:

- lo que se cobra es siempre un producto digital real con precio propio (fondos de pantalla, checklist, curso), descripto como tal en la factura de cada compra;
- cada compra da tantas participaciones como pesos tiene su precio ($1 = 1: `regla_participaciones.por_peso`), decisión comercial de Baiking del 29/09 por la tarde; el precio por participación es el mismo en los tres productos, sin descuento por volumen ("cuantas más sumás, menos pagás" no existe);
- cada producto se compra una sola vez por persona (DNI); productos distintos sí (máximo 47.000 participaciones pagas por persona);
- existe la participación sin cargo (`/participa-sin-cargo`, formulario + carta, una (1) participación por DNI), que entra en el mismo padrón;
- el sorteo es en vivo por Instagram, grabado, con el padrón cerrado y publicado antes de sortear (con su hash SHA-256): se sortea un número entre 1 y el total y gana la orden cuyo bloque lo contiene;
- el lenguaje es "participación" en todas las piezas (`config/campaign.json` → `unidad`); no se usa "chances" ni "rifa", y "números" solo para describir el bloque correlativo ("$10.000 son 10.000 números en el sorteo"), nunca como algo que se compra suelto.

Lo que hay que tener claro: con participaciones proporcionales al precio, el premio vuelve a estar "en razón directa de la compra" y la vía gratuita (1 participación) queda muy lejos de las 47.000 posibles por comprador. Es el tipo de esquema que `docs/08` calificó de riesgo alto; Baiking decidió mantenerlo con la vía gratuita de 1 participación, y el abogado tiene que validarlo antes de publicar (`docs/02` §4.3).

Fuentes, casos y detalle: `docs/01-investigacion.md` (investigación) y `docs/08-revision-legal.md` (revisión del modelo anterior; su nota inicial resume qué cambió después).

## Personalizar

- **Marca:** variables en `:root` de `assets/css/styles.css` (fondo blanco, acento rojo Baiking `#eb0627`, header rojo con el logo centrado). El logo se toma de `marca.logo` en la config (`assets/img/logo-baiking-rojo.png`; también `-blanco.png` y `-circulo.png`).
- **Fotos:** `bicis[].imagen` (WebP o PNG recortado; ya cargadas, van en el hero desde el 30/09), `marca.foto_gaston` (sección del curso) y `marca.foto_hero` (foto del local, hoy sin uso: queda por si algún día vuelve al hero); con `null` se usan las ilustraciones del sprite.
- **Textos:** todo el copy editable está en `config/campaign.json` (productos, curso, FAQ, reglas del sorteo, legales) y en el HTML de cada sección.
- **Ganadores:** `ganadores` en la config (`{ numero, nombre, localidad, premio }`).
