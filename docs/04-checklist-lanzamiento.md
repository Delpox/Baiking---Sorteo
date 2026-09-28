# 04 · Checklist de lanzamiento

Estado al 28/09: las decisiones de la reunión con Gastón y Belén están aplicadas en `config/campaign.json` (detalle en `docs/02` §4). Lo marcado con `[x]` ya está hecho.

## A. Legal y administrativo (antes de publicar nada)

- [ ] Abogado revisa `bases-y-condiciones.html` con el texto nuevo: sin escribano (cláusulas 5.5 y 7: sorteo en vivo por Instagram, grabado, cantidad total de chances publicada antes de sortear), pago únicamente por transferencia con comprobante y confirmación al acreditarse (cláusula 5), escalera de 1 a 200 chances (`docs/02` §2), alcance territorial (cláusula 2), aviso antifraude (`docs/05` §5).
- [x] Razón social, CUIT y domicilio cargados en `config/campaign.json` → `legal` (X Centro Pilar SRL, CUIT 30-71025912-3, Las Camelias 3327, Del Viso).
- [ ] Confirmar con Gastón que la promoción la organiza esa sociedad (los datos salieron de la cuenta bancaria).
- [ ] Nota de consulta al IPLyC (Lotería de la Provincia de Buenos Aires) y a la OMIC de Pilar sobre registro de sorteos promocionales; guardar respuesta.
- [ ] Definir alcance geográfico (todo el país vs exclusión de CABA, Mendoza, Neuquén, Río Negro y Salta) o tramitar autorización en LOTBA.
- [ ] Contador (X Centro Pilar SRL): IVA del curso, IIBB y código de actividad (854990 o el que indique), impuesto al cheque del 0,6 % sobre cada acreditación y SIRCREB en la cuenta de Galicia, tratamiento del premio (Ley 20.630), en qué cuenta se cobra. Ver `docs/05` §4.
- [ ] Factura por cada compra (a nombre de quien paga, concepto "Curso Baiking de Mantenimiento", sin mencionar el sorteo): definir cómo se emite (facturador con API o carga manual desde la planilla exportada del panel) y en qué momento (al aprobar la transferencia).
- [ ] Registrar la base de datos de participantes ante la AAIP (Ley 25.326) y publicar la política de privacidad.
- [ ] (Opcional) Escribano para el acta del sorteo: no se comunica; solo si el abogado lo pide. Cotizar en el Colegio de Escribanos PBA, delegación Pilar.
- [ ] Comprar/reservar las dos bicis con el importador (Polygon Bikes Argentina) para asegurar stock en la fecha de entrega.
- [x] Botón de arrepentimiento visible en el sitio (link en el footer a la cláusula 15 de las bases).
- [ ] Confirmar el mail de contacto de la cláusula 15 y del footer (`belen.baiking@gmail.com`).

## B. Producto y contenido

- [ ] Grabar los 4 módulos del curso en video (lista en `config/campaign.json` → `curso.modulos`): preparar la bici ante una carrera o salida · lavado y lubricación sin herramientas específicas · ajuste general · errores comunes y cómo evitarlos. No se promete guía PDF, "acceso de por vida" ni consultas por WhatsApp: no agregarlo en ninguna pieza.
- [ ] Definir el alojamiento del curso (Drive privado, YouTube no listado, plataforma) y cargar `curso.url_acceso`; el link viaja en el mail "chances confirmadas".
- [ ] Foto vertical del local con Gastón y las bicis (hero) → `assets/img/local.jpg` y `marca.foto_hero`.
- [ ] Foto de Gastón en bici (sección del curso) → `assets/img/gaston.jpg` y `marca.foto_gaston`.
- [ ] Fotos de la Siskiu T7 y la Tambora (PNG recortado o fondo liso) → `assets/img/` y `bicis[].imagen`. Mientras estén en `null` se usan las ilustraciones.
- [x] Logo real cargado: `assets/img/logo-baiking-rojo.png` (header, footer, OG), `logo-baiking-blanco.png` y `logo-baiking-circulo.png` (favicons, redes, mails); `marca.logo` en la config.
- [x] Identidad definida: fondo blanco con acentos rojo Baiking `#eb0627`, header rojo con el logo centrado (variables en `:root` de `assets/css/styles.css`).
- [ ] Imagen para redes `assets/img/og.png` (1200×630): regenerar con `node scripts/og-image.mjs` cuando estén la foto del local y los colores finales; leyenda "Sin obligación de compra".
- [ ] Video de Gastón (60-90 s) explicando la promo, para Instagram.
- [ ] Revisar con Gastón los 5 textos de `faq[]`, la descripción del curso y el texto del premio (service a los 30 días y garantía oficial siguen `[A CONFIRMAR]`).

## C. Técnico

- [ ] Crear proyecto en **Supabase**, ejecutar `supabase/schema.sql`, ajustar fechas de la edición, crear el bucket privado `comprobantes` en Storage.
- [ ] Crear cuenta en **Resend**, verificar el dominio (DKIM/SPF) y obtener `RESEND_API_KEY`; `MAIL_FROM` sin comillas.
- [ ] (Opcional) WhatsApp Cloud API: número, plantilla aprobada y token.
- [ ] Deploy en **Vercel**: importar el repositorio, cargar las variables de `.env.example` (sin las de Mercado Pago mientras siga desactivado), dominio `participa.baiking.com.ar` (a confirmar con Gastón; si cambia, actualizar `marca.sitio_url`, `legal.leyenda`, `legal.aviso_corto` y `BASE_URL`).
- [ ] `ADMIN_TOKEN` largo y aleatorio; abrir `admin.html`, ingresar el token (viaja en `Authorization: Bearer`; `?token=` queda solo como fallback) y probar "Exportar CSV".
- [ ] Cambiar `checkout.modo` a `api` en `config/campaign.json` y desplegar.
- [ ] Prueba de punta a punta con una transferencia real de $1 entre cuentas propias: formulario con el comprobante adjunto → mail "Recibimos tu comprobante" → `/gracias` con los chequeos → panel "Transferencias por revisar" → Aprobar → mail "chances confirmadas" con los números y el acceso al curso.
- [ ] Probar el camino malo: comprobante ilegible o de otro monto → Rechazar desde el panel → volver a subir desde `/gracias`.
- [ ] Prueba de la vía gratuita y del bloqueo por DNI repetido.
- [ ] `npm run check` sin errores (avisa si las fechas y la URL de `legal.leyenda` / `aviso_corto` no coinciden con `edicion.*` y `marca.sitio_url`).
- [ ] Analítica: agregar Meta Pixel / GA4 si se va a hacer pauta (respetar consentimiento).
- [ ] Protección anti-bots en los formularios (Cloudflare Turnstile o Vercel WAF) si aparece abuso.

## D. Comunicación

- [ ] Calendario de contenidos (ver `docs/03-automatizaciones.md` §4) cargado en Metricool.
- [ ] Todas las piezas con "Sin obligación de compra · Bases en participa.baiking.com.ar/bases-y-condiciones" (dominio a confirmar). "Chances" se usa en el sitio por decisión de Baiking; en pauta y ante organismos, "participaciones". Nunca "rifa", ni "números" como producto, ni "ante escribano".
- [ ] Pauta en Meta configurada como promoción de un curso (no como sorteo) para evitar rechazos.
- [ ] Highlights de Instagram: "Cómo participar" (transferencia + comprobante en el formulario), "El curso", "Las bicis", "Sorteo".

## E. Día del sorteo

- [ ] Cierre de inscripciones automático (fecha en la config) y exportación del padrón desde el panel; antes del vivo publicar la cantidad total de chances (story + sitio), como dice la cláusula 5.5 de las bases, y guardar el CSV.
- [ ] Ensayar `sorteo.html` con el padrón de prueba; el día del sorteo cargar el CSV real y usar "Pantalla completa" para el vivo.
- [ ] Transmisión en vivo por Instagram, grabada; descargar el acta JSON al terminar y publicar el video.
- [ ] Contactar a la persona ganadora (llamada + mail + WhatsApp) y publicar el resultado.
- [ ] Cargar el ganador en `config/campaign.json` → `ganadores` para que aparezca en el sitio.

## F. Después

- [ ] Entrega documentada (acta de entrega, DNI, foto) y contenido de la entrega para redes.
- [ ] Encuesta corta a compradores del curso (testimonios para la edición #2).
- [ ] Reporte final: órdenes, ingresos, costos, conversión por canal.

## G. Panel y transferencias

- [x] Datos bancarios cargados en `checkout.transferencia`: alias `baiking.bicis`, CBU `0070119420000003239999`, titular X Centro Pilar SRL, CUIT 30-71025912-3, Banco Galicia (cta. cte. 3239-9 119-9), `descuento_pct: 0`, `plazo_horas: 48`, `email_comprobantes: belen.baiking@gmail.com`.
- [x] Mercado Pago desactivado (`checkout.mercadopago.habilitada: false`); el formulario muestra los datos bancarios y exige el comprobante adjunto.
- [ ] Bucket privado `comprobantes` en Supabase Storage (ver C).
- [ ] `ANTHROPIC_API_KEY` en Vercel para la lectura automática de comprobantes (sin ella se guardan igual, sin lectura).
- [ ] Decidir `TRANSFERENCIAS_AUTO_APROBAR`: `false` (recomendado: se aprueba desde el panel después de ver la acreditación en Galicia) o `true` (se aprueba sola cuando todos los chequeos dan bien; un comprobante editado puede pasar). Si se activa, verificar antes que `evaluarComprobante()` en `api/_lib/comprobante.js` no exija el chequeo de código (`codigo_ok`) para `aprobable`: el participante ya no conoce el código, así que con esa condición nunca se aprobaría sola.
- [ ] Casilla de comprobantes `belen.baiking@gmail.com`: elegir entre (a) revisión manual (Belén abre el mail, busca la orden en el panel por nombre o mail y aprueba después de ver la acreditación; funciona también con órdenes `pendiente`), (b) Google Apps Script en la cuenta de Gmail que manda los mails con adjunto a `/api/inbound-email` con `INBOUND_SECRET`, o (c) reenvío automático de Gmail a una casilla con correo entrante + Worker. Detalle y ejemplos en `docs/03` §7. En cualquier caso, mirar la casilla al menos dos veces por día durante la campaña.
- [ ] Conciliación contra el home banking de Galicia: antes de cada "Aprobar", buscar la acreditación por monto exacto, fecha y nombre o CUIT del ordenante (el panel muestra lo que leyó la IA). Rechazar desde el panel las órdenes sin acreditación a las 48 h (`plazo_horas`; no se anulan solas).
- [ ] Rutina durante la campaña: quién revisa el panel y la casilla y en qué horarios (propuesta: Belén, dos veces por día), quién factura cada compra aprobada.
- [ ] Activar el beacon de presencia (`panel.presencia: true` en la config) si se quiere ver visitantes antes de pasar a modo `api`.
- [ ] Probar el circuito completo con la transferencia de $1 (ver C) y, aparte, un comprobante mandado por mail a la casilla.

## H. Cobros (detalle en `docs/05-cobros-y-comparativa-internacional.md`)

- [ ] Contador: ver sección A (impuesto al cheque 0,6 % por ser SRL, SIRCREB como pago a cuenta, IVA del curso, factura por cada compra). Ver docs/05 §4.
- [ ] Cuenta de cobro: la cuenta corriente de Galicia de X Centro Pilar SRL ya está en la config; confirmar con el contador si conviene una cuenta exclusiva para la campaña (facilita la conciliación y el padrón).
- [ ] Si las transferencias superan las 20-30 por día o la revisión se vuelve un cuello de botella: cotizar un proveedor con CVU único por orden (Talo, 0,8-1 % + IVA) y recién entonces prender la aprobación automática. Ver docs/05 §5.
- [ ] (Opcional) Adherir Cuenta DNI Comercios (0,6 %) para cobros en el taller; quien paga en el taller se inscribe igual en el sitio y se aprueba desde el panel. Ver docs/05 §8.
- [ ] Publicar el aviso antifraude ("Baiking nunca te va a pedir plata ni datos por mensaje directo") en la landing, las bases, el mail de confirmación y un highlight. Texto en docs/05 §5.
- Solo si se reactiva Mercado Pago (`checkout.mercadopago.habilitada: true`; pasos en `docs/03` §8):
  - [ ] Crear la aplicación (Checkout Pro), cargar `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` y configurar el webhook `https://<dominio>/api/webhooks/mercadopago` (evento "Pagos").
  - [ ] Elegir en "Costos y cuotas" la liberación a 14-18 días (3,39 % + IVA) y confirmar que no hay cuotas sin interés absorbidas por Baiking. Ver docs/05 §2 y §8.
  - [ ] Prueba de punta a punta con credenciales de prueba: compra → webhook → números → mail → `/gracias`.
  - [ ] Contador: SIRTAC/SIRCUPA y percepción de IVA del 3 % sobre comisiones. Ver docs/05 §4.
