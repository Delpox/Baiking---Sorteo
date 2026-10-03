# 04 · Checklist de lanzamiento

Estado al 30/09: las decisiones de la reunión del 28/09 con Gastón y Belén, el modelo de tres productos del 29/09, la regla de participaciones proporcionales al precio del 29/09 por la tarde (ajustada el 30/09: cada $1.000 = 1 participación, precios $10.000 / $19.000 / $29.000, Strattos S7 valuada en $3.862.320, FAQ de 4 preguntas y claim sin ejemplo numérico) y el hero del 30/09 están aplicados en `config/campaign.json` (detalle en `docs/02` §4). Lo marcado con `[x]` ya está hecho.

## A. Legal y administrativo (antes de publicar nada)

- [ ] Abogado revisa `bases-y-condiciones.html` con el texto nuevo: tres productos digitales con participaciones proporcionales al precio (cada $1.000 = 1 participación: 10 / 19 / 29, hasta 58 pagas por persona; es el tipo de esquema que `docs/08` calificó de riesgo alto: Baiking decidió mantenerlo con la vía gratuita de 1 participación y hay que validarlo antes de publicar), cada producto una sola vez por persona (cláusulas 3 y 5.1; `docs/02` §2 y §4.3), vía gratuita con carta y 1 participación (cláusula 5.3; desde el 30/09 sin pregunta propia en la FAQ: confirmar que el link del final de la página, la cláusula y la leyenda alcanzan como visibilidad), sin escribano (cláusulas 5.5 y 7: sorteo en vivo por Instagram, grabado, cantidad total de participaciones publicada antes de sortear), pago únicamente por transferencia con comprobante y confirmación al acreditarse (cláusula 5.2), revocación del contenido digital (cláusula 10), alcance territorial (cláusula 2), aviso antifraude (`docs/05` §5). Lo que la revisión interna dejó abierto está en `docs/08` §3 y §5.
- [x] Razón social, CUIT y domicilio cargados en `config/campaign.json` → `legal` (X Centro Pilar SRL, CUIT 30-71025912-3, Las Camelias 3327, Del Viso).
- [ ] Confirmar con Gastón que la promoción la organiza esa sociedad (los datos salieron de la cuenta bancaria).
- [ ] Nota de consulta al IPLyC (Lotería de la Provincia de Buenos Aires) y a la OMIC de Pilar sobre registro de sorteos promocionales; guardar respuesta.
- [ ] Definir alcance geográfico (todo el país vs exclusión de CABA, Mendoza, Neuquén, Río Negro y Salta) o tramitar autorización en LOTBA.
- [ ] Contador (X Centro Pilar SRL): IVA de los productos digitales, IIBB y código de actividad (854990 o el que indique), impuesto al cheque del 0,6 % sobre cada acreditación y SIRCREB en la cuenta de Galicia, tratamiento del premio (Ley 20.630), en qué cuenta se cobra. Ver `docs/05` §4.
- [ ] Factura por cada compra (a nombre de quien paga, concepto = el producto comprado: "Fondos de pantalla Baiking", "Checklist pre-salida" o "Curso Baiking de Mantenimiento", sin mencionar el sorteo): definir cómo se emite (facturador con API o carga manual desde la planilla exportada del panel) y en qué momento (al aprobar la transferencia).
- [ ] Registrar la base de datos de participantes ante la AAIP (Ley 25.326) y publicar la política de privacidad.
- [ ] (Opcional) Escribano para el acta del sorteo: no se comunica; solo si el abogado lo pide. Cotizar en el Colegio de Escribanos PBA, delegación Pilar.
- [ ] Reservar con el importador (Polygon Bikes Argentina) la disponibilidad de los tres modelos en la fecha de entrega: se entrega una sola bici, la que elija quien gana (Siskiu T7, Tambora o Strattos S7).
- [x] Botón de arrepentimiento visible en el sitio (link en el footer a la cláusula 15 de las bases).
- [ ] Confirmar el mail de contacto de la cláusula 15 y del footer (`belen.baiking@gmail.com`).

## B. Producto y contenido

- [x] Precios de los tres productos fijados el 30/09 (`packs[].precio`: $10.000 fondos · $19.000 checklist · $29.000 curso; `packs[].participaciones`: 10 · 19 · 29). Si cambian, `packs[].participaciones` tiene que quedar en `precio / 1.000` (`npm run check` da error si no coinciden).
- [ ] Producir el pack de fondos de pantalla (alta resolución, celular y computadora) y cargar su link de entrega en `packs[].entrega_url` del producto `fondos`.
- [ ] Producir el checklist pre-salida en PDF y cargar su link en `packs[].entrega_url` del producto `checklist` (incluye también los fondos: un solo link o una carpeta).
- [ ] Grabar los 4 módulos del curso en video (lista en `config/campaign.json` → `curso.modulos`): preparar la bici ante una carrera o salida · lavado y lubricación sin herramientas específicas · ajuste general · errores comunes y cómo evitarlos. No se promete "acceso de por vida" ni consultas por WhatsApp: no agregarlo en ninguna pieza.
- [ ] Subir el curso a YouTube como no listado y cargar el link en `curso.url_acceso` (o en `packs[].entrega_url` del producto `curso` si se arma una carpeta con todo: el curso incluye además el checklist, los fondos y el tutorial de lavado). Mientras los tres links estén vacíos, el mail de confirmación avisa que el producto llega aparte y hay que mandarlo a mano.
- [ ] (Opcional) Foto vertical del local con Gastón y las bicis → `assets/img/local.jpg` y `marca.foto_hero`. Desde el 30/09 el hero muestra las tres bicis; la foto queda por si algún día vuelve.
- [ ] Foto de Gastón en bici (sección del curso) → `assets/img/gaston.jpg` y `marca.foto_gaston`.
- [x] Fotos de las tres Polygon cargadas (`assets/img/siskiu-t7.webp`, `tambora.webp`, `strattos.webp` → `bicis[].imagen`; son las del hero). Con `null` se usan las ilustraciones.
- [x] Logo real cargado: `assets/img/logo-baiking-rojo.png` (header, footer, OG), `logo-baiking-blanco.png` y `logo-baiking-circulo.png` (favicons, redes, mails); `marca.logo` en la config.
- [x] Identidad definida: fondo blanco con acentos rojo Baiking `#eb0627`, header rojo con el logo centrado (variables en `:root` de `assets/css/styles.css`).
- [ ] Imagen para redes `assets/img/og.png` (1200×630): regenerar con `node scripts/og-image.mjs` cuando estén las fotos y los colores finales; leyenda "Sin obligación de compra".
- [ ] Video de Gastón (60-90 s) explicando la promo, para Instagram.
- [ ] Revisar con Gastón los 4 textos de `faq[]` (desde el 30/09 sin las preguntas sobre participar sin comprar y sobre la forma de pago), las descripciones de los tres productos (`packs[].descripcion`, `incluye`), la del curso y el texto del premio (service a los 30 días y garantía oficial siguen `[A CONFIRMAR]`).

## C. Técnico

- [ ] Crear proyecto en **Supabase**, ejecutar `supabase/schema.sql`, ajustar fechas de la edición, crear el bucket privado `comprobantes` en Storage.
- [ ] Crear cuenta en **Resend**, verificar el dominio (DKIM/SPF) y obtener `RESEND_API_KEY`; `MAIL_FROM` sin comillas.
- [ ] (Opcional) WhatsApp Cloud API: número, plantilla aprobada y token.
- [ ] Deploy en **Vercel**: importar el repositorio, cargar las variables de `.env.example` (sin las de Mercado Pago mientras siga desactivado; con `CRON_SECRET` para los dos crons de `vercel.json` y las `GOOGLE_*` de la planilla, `docs/06`), dominio `participa.baiking.com.ar` (a confirmar con Gastón; si cambia, actualizar `marca.sitio_url`, `legal.leyenda`, `legal.aviso_corto` y `BASE_URL`).
- [ ] `ADMIN_TOKEN` largo y aleatorio; abrir `admin.html`, ingresar el token (viaja en `Authorization: Bearer`; `?token=` queda solo como fallback) y probar "Exportar CSV".
- [ ] Cambiar `checkout.modo` a `api` en `config/campaign.json` y desplegar.
- [ ] Prueba de punta a punta con una transferencia real de $1 entre cuentas propias: formulario con el comprobante adjunto → mail "Recibimos tu comprobante" → `/gracias` con los chequeos → panel "Transferencias por revisar" → Aprobar (o "Llegó") → mail de confirmación con el bloque de números ("del N.º X al N.º Y") y el link del producto.
- [ ] Probar el camino malo: comprobante ilegible o de otro monto → Rechazar desde el panel → volver a subir desde `/gracias`.
- [ ] Probar que el mismo DNI no puede comprar dos veces el mismo producto (la API responde `409`) y sí puede comprar otro producto.
- [ ] Prueba de la vía gratuita: formulario → mail "ahora mandá la carta" → "Carta recibida" en el panel → mail de confirmación con el número; y el bloqueo por DNI repetido.
- [ ] Probar los recordatorios sin marcar nada: `GET /api/recordatorios?tipo=semana&test=mail@propio` y `?tipo=sorteo&test=mail@propio` con el token de admin.
- [ ] `npm run check` sin errores (da error si `packs[].participaciones` no es `Math.round(precio × regla_participaciones.por_peso)`, hoy `por_peso: 0.001`; avisa si las fechas y la URL de `legal.leyenda` / `aviso_corto` no coinciden con `edicion.*` y `marca.sitio_url`, si los precios no van de menor a mayor y si la vía gratuita deja de dar 1 participación).
- [ ] Analítica: agregar Meta Pixel / GA4 si se va a hacer pauta (respetar consentimiento).
- [ ] Protección anti-bots en los formularios (Cloudflare Turnstile o Vercel WAF) si aparece abuso.

## D. Comunicación

- [ ] Calendario de contenidos (ver `docs/03-automatizaciones.md` §4) cargado en Metricool.
- [ ] Todas las piezas con "Sin obligación de compra · Bases en participa.baiking.com.ar/bases-y-condiciones" (dominio a confirmar). "Participación/participaciones" en todas las piezas; "números" solo para el bloque ("del N.º 121 al N.º 130"); el claim del hero es "Cada $1.000 es una participación", sin ejemplo numérico. Nunca "chances", "rifa", "comprá tu número", "quedan pocos números", "cuantas más sumás, menos pagás" ni "ante escribano".
- [ ] Pauta en Meta configurada como venta de productos digitales (fondos, checklist, curso), no como sorteo, para evitar rechazos.
- [ ] Highlights de Instagram: "Cómo participar" (transferencia + comprobante en el formulario), "Los productos", "Las bicis", "Sorteo".

## E. Día del sorteo

- [ ] Cierre de inscripciones automático (fecha en la config) y exportación del padrón desde el panel (una fila por orden pagada con su bloque); antes del vivo publicar la cantidad total de participaciones y el hash SHA-256 del CSV (story + sitio), como dice la cláusula 5.5 de las bases, y guardar el CSV.
- [ ] Ensayar `sorteo.html` (o `node scripts/sorteo.mjs padron.csv`) con un padrón de prueba: chequeos de integridad (bloques contiguos, total = último `numero_hasta`, hash), número sorteado entre 1 y el total, orden ganadora por bloque, suplentes sin el DNI ganador; el día del sorteo cargar el CSV real y usar "Pantalla completa" para el vivo.
- [ ] Transmisión en vivo por Instagram, grabada; descargar el acta JSON al terminar (número sorteado, bloque ganador, valor crudo del RNG, hash del padrón) y publicar el video.
- [ ] Contactar a la persona ganadora (llamada + mail + WhatsApp) y publicar el resultado.
- [ ] Cargar el ganador en `config/campaign.json` → `ganadores` para que aparezca en el sitio.

## F. Después

- [ ] Entrega documentada (acta de entrega, DNI, foto) y contenido de la entrega para redes.
- [ ] Encuesta corta a compradores (testimonios para la edición #2).
- [ ] Reporte final: órdenes por producto, ingresos, costos, conversión por canal.

## G. Panel y transferencias

- [x] Datos bancarios cargados en `checkout.transferencia`: alias `baiking.bicis`, CBU `0070119420000003239999`, titular X Centro Pilar SRL, CUIT 30-71025912-3, Banco Galicia (cta. cte. 3239-9 119-9), `descuento_pct: 0`, `plazo_horas: 48`, `email_comprobantes: belen.baiking@gmail.com`.
- [x] Mercado Pago desactivado (`checkout.mercadopago.habilitada: false`); el formulario muestra los datos bancarios y exige el comprobante adjunto.
- [ ] Bucket privado `comprobantes` en Supabase Storage (ver C).
- [ ] `ANTHROPIC_API_KEY` en Vercel para la lectura automática de comprobantes (sin ella se guardan igual, sin lectura).
- [ ] Decidir `TRANSFERENCIAS_AUTO_APROBAR`: `false` (recomendado: se aprueba desde el panel después de ver la acreditación en Galicia) o `true` (se aprueba sola cuando todos los chequeos dan bien; un comprobante editado puede pasar). La aprobación automática ya no depende del código `BK-XXXXX` que el participante no conoce: `aprobable` se decide por comprobante válido, monto, destino, fecha, sin edición y confianza ≥ 0,8.
- [ ] Casilla de comprobantes `belen.baiking@gmail.com`: elegir entre (a) revisión manual (Belén abre el mail, busca la orden en el panel por nombre o mail y aprueba después de ver la acreditación; funciona también con órdenes `pendiente`), (b) Google Apps Script en la cuenta de Gmail que manda los mails con adjunto a `/api/inbound-email` con `INBOUND_SECRET`, o (c) reenvío automático de Gmail a una casilla con correo entrante + Worker. Detalle y ejemplos en `docs/03` §7. En cualquier caso, mirar la casilla al menos dos veces por día durante la campaña.
- [ ] Conciliación contra el home banking de Galicia: antes de cada "Aprobar" o "Llegó", buscar la acreditación por monto exacto, fecha y nombre o CUIT del ordenante (el panel muestra lo que leyó la IA). Rechazar desde el panel las órdenes sin acreditación a las 48 h (`plazo_horas`; no se anulan solas).
- [ ] Rutina durante la campaña: quién revisa el panel y la casilla y en qué horarios (propuesta: Belén, dos veces por día), quién factura cada compra aprobada y quién marca "Carta recibida" cuando llega una carta a la tienda.
- [ ] Activar el beacon de presencia (`panel.presencia: true` en la config) si se quiere ver visitantes antes de pasar a modo `api`.
- [ ] Probar el circuito completo con la transferencia de $1 (ver C) y, aparte, un comprobante mandado por mail a la casilla.

## H. Cobros (detalle en `docs/05-cobros-y-comparativa-internacional.md`)

- [ ] Contador: ver sección A (impuesto al cheque 0,6 % por ser SRL, SIRCREB como pago a cuenta, IVA de los productos digitales, factura por cada compra). Ver docs/05 §4.
- [ ] Cuenta de cobro: la cuenta corriente de Galicia de X Centro Pilar SRL ya está en la config; confirmar con el contador si conviene una cuenta exclusiva para la campaña (facilita la conciliación y el padrón).
- [ ] Si las transferencias superan las 20-30 por día o la revisión se vuelve un cuello de botella: cotizar un proveedor con CVU único por orden (Talo, 0,8-1 % + IVA) y recién entonces prender la aprobación automática. Ver docs/05 §5.
- [ ] (Opcional) Adherir Cuenta DNI Comercios (0,6 %) para cobros en el taller; quien paga en el taller se inscribe igual en el sitio y se aprueba desde el panel. Ver docs/05 §8.
- [ ] Publicar el aviso antifraude ("Baiking nunca te va a pedir plata ni datos por mensaje directo") en la landing, las bases, el mail de confirmación y un highlight. Texto en docs/05 §5.
- Solo si se reactiva Mercado Pago (`checkout.mercadopago.habilitada: true`; pasos en `docs/03` §8):
  - [ ] Crear la aplicación (Checkout Pro), cargar `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` y configurar el webhook `https://<dominio>/api/webhooks/mercadopago` (evento "Pagos").
  - [ ] Elegir en "Costos y cuotas" la liberación a 14-18 días (3,39 % + IVA) y confirmar que no hay cuotas sin interés absorbidas por Baiking. Ver docs/05 §2 y §8.
  - [ ] Prueba de punta a punta con credenciales de prueba: compra → webhook → bloque de números → mail → `/gracias`.
  - [ ] Contador: SIRTAC/SIRCUPA y percepción de IVA del 3 % sobre comisiones. Ver docs/05 §4.
