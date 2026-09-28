# Baiking · Curso + Participación por una Polygon

Sitio y sistema para la primera edición de la promoción de **Baiking Tienda de Bicis** (Del Viso, Pilar): la gente hace el **Curso Baiking de Mantenimiento** (en video, lo da Gastón) y participa por una **Polygon Siskiu T7** o una **Polygon Tambora**, a su elección. Se paga únicamente por **transferencia bancaria**, con el comprobante adjunto en el mismo formulario. Sorteo en vivo por Instagram, grabado, con el padrón publicado antes de sortear. **Sin obligación de compra.**

> Estado: demo lista para mostrar (modo `demo`, sin cobros reales). Decisiones de Baiking del 28/09 aplicadas en `config/campaign.json` (solo transferencia, sin escribano, sin tope de chances, escalera de precios, identidad roja). Pendientes: fechas (propuesta 15/10 → 4/12), versión de la Tambora, fotos, dominio `participa.baiking.com.ar` y revisión legal de las bases. Ver `docs/02-mecanica-y-decisiones.md` §4 y `docs/04-checklist-lanzamiento.md`.

## Qué hay en el repositorio

```
index.html                  Landing: hero (foto del local + escalera de chances), lo esencial, el premio, cómo funciona, el curso, el sorteo, FAQ, footer compacto
participa-sin-cargo.html    Vía gratuita de participación (obligatoria por Lealtad Comercial)
gracias.html                Estado de la orden: comprobante en revisión (con los chequeos) o números asignados; permite volver a subir el comprobante
bases-y-condiciones.html    Bases y condiciones (borrador para revisión legal)
sorteo.html                 Herramienta para el sorteo en vivo (carga el padrón, sortea con crypto, exporta acta)
admin.html                  Panel en tiempo real: KPIs, gráficos, transferencias por revisar, órdenes (admin.html?demo=1 = datos de ejemplo)
config/campaign.json        ÚNICA fuente de verdad: fechas, bicis, curso, packs, precios, contacto, textos legales, datos de transferencia
assets/css/                 styles.css (sitio) · admin.css (panel)
assets/js/                  app.js (landing y formulario de compra con el comprobante) · gracias.js (estado de la orden) · admin.js (panel)
assets/img/                 Sprite de íconos/ilustraciones, logo real (logo-baiking-*.png), favicons, og.html → og.png (sin build)
api/checkout.js             POST · crea la orden por transferencia con el comprobante adjunto (Claude lo lee); si se reactiva Mercado Pago, crea la preferencia
api/webhooks/mercadopago.js POST · webhook de MP (firma verificada): desactivado, queda por si se reactiva
api/orden.js                GET · resumen de una orden, sus chequeos y sus números (página /gracias)
api/participacion-gratuita.js POST · vía gratuita: 1 participación por DNI y edición
api/comprobante.js          POST · carga posterior del comprobante desde /gracias · GET (admin) · abre el comprobante
api/inbound-email.js        POST · comprobantes que llegan por mail a belen.baiking@gmail.com, reenviados por un servicio de correo entrante (X-Inbound-Secret)
api/admin.js                GET · datos del panel · POST · aprobar o rechazar transferencias (y sincronizar un pago de MP si se reactiva) (ADMIN_TOKEN)
api/progreso.js             GET · chances ocupadas sobre el cupo (sin uso: la barra del sitio es lineal en el tiempo; queda por si se fija un tope)
api/ping.js                 POST · beacon de presencia ("en el sitio ahora" / "visitas hoy" en el panel)
api/export.js               GET · padrón CSV de participaciones pagas (sorteo en vivo y planilla; Authorization: Bearer)
api/_lib/                   db (Supabase) · mercadopago (preferencias, firma del webhook) · pagos-mp (aplica el estado de un pago a la orden)
                            · confirmar (pagada + números + avisos) · notificaciones (Resend y WhatsApp) · comprobante (Storage, lectura
                            con Claude, chequeos) · validar y telefono (datos de la persona, WhatsApp) · http
supabase/schema.sql         Base de datos Postgres: ediciones, órdenes, participaciones, presencia y asignación atómica de números
scripts/                    check (validaciones), screenshots (Playwright), build-demo (HTML autocontenido), og-image (imagen para redes), sorteo (CLI)
docs/                       01 investigación legal · 02 mecánica y decisiones · 03 automatizaciones · 04 checklist · 05 cobros y comparativa internacional
```

## Cómo verlo

```bash
npm run dev            # sirve el sitio en http://localhost:3000 (modo demo, sin backend)
npm run check          # valida config, íconos, links y sintaxis del backend
npm run screenshots    # capturas desktop + móvil de todas las páginas en ./screenshots (requiere Playwright)
node scripts/build-demo.mjs   # genera ./dist con cada página en un solo archivo HTML (para compartir)
node scripts/og-image.mjs     # genera assets/img/og.png (imagen para compartir en redes; no está en el repo)
```

En modo `demo` el botón "Participar" simula el envío del formulario con el comprobante y muestra "Comprobante recibido", sin cobrar.

## Modos de cobro (`config/campaign.json` → `checkout.modo`)

| Modo | Qué hace | Cuándo usarlo |
|---|---|---|
| `demo` | Simula la compra en el navegador | Para mostrar el proyecto |
| `api` | Crea la orden por transferencia con el comprobante adjunto, Claude lo lee, se aprueba (panel o automático), asigna números y notifica por mail/WhatsApp | Producción |
| `externo` | Redirige cada pack a `packs[].url_externa` (por ejemplo, un producto en la Tienda Nube de Baiking) | Si se prefiere cobrar desde la tienda existente |

Medio de pago: únicamente transferencia bancaria, sin descuento (decisión del 28/09: `checkout.transferencia.habilitada: true`, `descuento_pct: 0`). Mercado Pago está desactivado (`checkout.mercadopago.habilitada: false`); la integración sigue en `api/` y con `true` el modal vuelve a mostrar el selector (cómo reactivarlo: `docs/03-automatizaciones.md` §8). Qué se lleva cada medio: `docs/05-cobros-y-comparativa-internacional.md`.

## Cómo se cobra: transferencia con el comprobante en el checkout

1. En el formulario de inscripción la persona ve el monto exacto y los datos bancarios (alias `baiking.bicis`, CBU, titular X Centro Pilar SRL, CUIT, Banco Galicia, con botones "Copiar"), transfiere desde su banco y **adjunta el comprobante** (foto, captura o PDF; las imágenes se reducen a 1600 px en el navegador) antes de tocar "Participar".
2. Un solo `POST api/checkout` con los datos y `comprobante: { tipo, nombre, contenido_base64 }`: `api/checkout.js` crea la orden en estado `pendiente` con el monto exacto, guarda el archivo en el bucket privado `comprobantes` de Supabase Storage y, si hay `ANTHROPIC_API_KEY`, Claude lo lee (monto, fecha, cuenta destino, titular, señales de edición) y lo compara con la orden (`api/_lib/comprobante.js`). La orden pasa a `en_revision` y la persona recibe el mail "Recibimos tu comprobante"; `/gracias?orden=...` muestra el estado.
3. En `admin.html` la orden aparece en "Transferencias por revisar" con los chequeos en verde/rojo y el link al comprobante. **Aprobar** (después de ver la acreditación en el home banking de Galicia) la pasa a `pagada`, asigna los números y manda el mail "chances confirmadas" con el acceso al curso (+ WhatsApp); **Rechazar** la cierra. Con `TRANSFERENCIAS_AUTO_APROBAR=true` se aprueba sola cuando todos los chequeos dan bien y la confianza es ≥ 0,8.
4. Si el comprobante no llegó o fue rechazado, la persona lo sube de nuevo desde `/gracias` (`POST api/comprobante`) o lo manda por mail a `belen.baiking@gmail.com`; con un servicio de correo entrante ese mail llega a `/api/inbound-email`, que busca la orden por el mail del remitente.

La IA lee el comprobante, pero no puede saber si la plata entró: un comprobante editado pasa los chequeos. Por eso el valor por defecto es `TRANSFERENCIAS_AUTO_APROBAR=false` y se aprueba desde el panel después de ver la acreditación (buscar por monto exacto, fecha y nombre o CUIT del ordenante). El código `BK-XXXXX` sigue existiendo como identificador interno de la orden, pero ya no se le muestra al participante ni se le pide en el concepto. Detalle y riesgos en `docs/03-automatizaciones.md` §7; costos y conciliación automática en `docs/05-cobros-y-comparativa-internacional.md`.

## Variables de entorno (`.env.example`)

| Variable | Para qué |
|---|---|
| `BASE_URL` | URL pública del sitio (links de los mails; back_urls y webhook de Mercado Pago si se reactiva) |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Credenciales de producción de Mercado Pago y clave secreta del webhook (solo si se reactiva) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos y Storage (solo backend) |
| `RESEND_API_KEY`, `MAIL_FROM` | Mails transaccionales |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp Cloud API (opcional; sin ellas solo se manda mail) |
| `ADMIN_TOKEN` | Panel (`admin.html`), `/api/admin`, `/api/export` y apertura de comprobantes; viaja en `Authorization: Bearer` (`?token=` solo como fallback) |
| `ANTHROPIC_API_KEY` | Lectura automática de comprobantes con Claude (opcional; sin ella quedan "por revisar" sin lectura) |
| `TRANSFERENCIAS_AUTO_APROBAR` | `true` aprueba sola la transferencia cuando todos los chequeos dan bien; recomendado `false` |
| `INBOUND_SECRET` | Secreto compartido con el servicio que reenvía los mails de `belen.baiking@gmail.com` a `/api/inbound-email` |

## Puesta en producción (resumen)

1. Supabase: ejecutar `supabase/schema.sql` y crear el bucket privado `comprobantes`.
2. Resend: dominio verificado + API key. (WhatsApp Cloud API opcional.)
3. Vercel: importar el repo, cargar las variables de `.env.example` (`ADMIN_TOKEN` para el panel, `ANTHROPIC_API_KEY` para leer comprobantes, `TRANSFERENCIAS_AUTO_APROBAR=false`, `INBOUND_SECRET` si se usa el correo entrante), dominio `participa.baiking.com.ar` (a confirmar).
4. Datos bancarios ya cargados en `checkout.transferencia`. Poner `checkout.modo: "api"` y desplegar. Probar de punta a punta con una transferencia real de $1 entre cuentas propias.
5. Solo si se reactiva Mercado Pago: credenciales de producción + webhook a `/api/webhooks/mercadopago`.

Detalle completo en `docs/04-checklist-lanzamiento.md`.

## Por qué está armado así (y no como Autoloop)

En Argentina vender "chances" es juego de azar sin autorización (art. 301 bis del Código Penal) y la Ley de Lealtad Comercial exige que toda promoción con premio tenga una vía gratuita con igual probabilidad y la leyenda "Sin obligación de compra". Por eso:

- lo que se cobra es siempre un producto real (el curso), descripto como tal en la factura de cada compra;
- las participaciones son una bonificación del curso, no un producto (en el sitio se llaman "chances" por decisión de Baiking; en bases y facturas, "participaciones bonificadas");
- existe la participación sin cargo (`/participa-sin-cargo`, una por DNI);
- el sorteo es en vivo por Instagram, grabado, con el padrón cerrado y publicado antes de sortear;
- el lenguaje evita "rifa" y "números" como producto.

Fuentes, casos y detalle: `docs/01-investigacion.md`.

## Personalizar

- **Marca:** variables en `:root` de `assets/css/styles.css` (fondo blanco, acento rojo Baiking `#eb0627`, header rojo con el logo centrado). El logo se toma de `marca.logo` en la config (`assets/img/logo-baiking-rojo.png`; también `-blanco.png` y `-circulo.png`).
- **Fotos:** `marca.foto_hero` (local), `marca.foto_gaston` (sección del curso) y `bicis[].imagen` (PNG recortado); con `null` se usan las ilustraciones del sprite.
- **Textos:** todo el copy editable está en `config/campaign.json` (curso, packs, FAQ, reglas del sorteo, legales) y en el HTML de cada sección.
- **Ganadores:** `ganadores` en la config (`{ numero, nombre, localidad, premio }`).
