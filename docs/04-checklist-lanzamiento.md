# 04 · Checklist de lanzamiento

## A. Legal y administrativo (antes de publicar nada)

- [ ] Abogado revisa `bases-y-condiciones.html` (en especial cláusulas 2, 7 y 9) y el modelo de packs. Completar razón social, CUIT y domicilio en `config/campaign.json` → `legal`.
- [ ] Nota de consulta al IPLyC (Lotería de la Provincia de Buenos Aires) y a la OMIC de Pilar sobre registro de sorteos promocionales; guardar respuesta.
- [ ] Definir alcance geográfico (todo el país vs exclusión de CABA, Mendoza, Neuquén, Río Negro y Salta) o tramitar autorización en LOTBA.
- [ ] Contador: facturación del curso (RI/monotributo, IVA, código de actividad 854990 o el que indique), tratamiento del premio (Ley 20.630), retenciones de IIBB en Mercado Pago (SIRTAC/SIRCUPA).
- [ ] Facturación automática por cada orden (integración de Mercado Pago o Tienda Nube con el facturador).
- [ ] Registrar la base de datos de participantes ante la AAIP (Ley 25.326) y publicar la política de privacidad.
- [ ] Contratar escribano para certificar el padrón y el acta del sorteo (Colegio de Escribanos PBA, delegación Pilar).
- [ ] Comprar/reservar las dos bicis con el importador (Polygon Bikes Argentina) para asegurar stock en la fecha de entrega.
- [ ] Botón de arrepentimiento visible en el sitio (link en el footer a la cláusula 15 de las bases y al mail).

## B. Producto y contenido

- [ ] Grabar las 8 clases del curso (guion en `config/campaign.json` → `curso.modulos`) y armar la guía PDF.
- [ ] Definir el alojamiento del curso y cargar `curso.url_acceso`.
- [ ] Armar el kit de limpieza y definir el service incluido (qué incluye, cómo se reserva el turno).
- [ ] Fotos oficiales de la Siskiu T7 y la Tambora en fondo oscuro o recortadas (PNG). Cargarlas en `assets/img/` y referenciarlas en `bicis[].imagen`.
- [ ] Logo de Baiking en SVG (`assets/img/logo.svg`) y reemplazar el wordmark del nav si corresponde. Ajustar colores en `:root` de `assets/css/styles.css` si la marca usa otros.
- [ ] Imagen para redes (`assets/img/og.png`, 1200×630) con la leyenda "Sin obligación de compra".
- [ ] Video de Gastón (60-90 s) explicando la promo, para el hero y para Instagram.
- [ ] Validar con Gastón el texto de la cita en "Somos Baiking".

## C. Técnico

- [ ] Crear proyecto en **Supabase**, ejecutar `supabase/schema.sql`, ajustar fechas de la edición.
- [ ] Crear aplicación en **Mercado Pago** (Checkout Pro), obtener `MP_ACCESS_TOKEN` de producción y configurar el webhook `https://<dominio>/api/webhooks/mercadopago` (evento "Pagos") con su clave secreta.
- [ ] Crear cuenta en **Resend**, verificar el dominio y obtener `RESEND_API_KEY`.
- [ ] (Opcional) WhatsApp Cloud API: número, plantilla aprobada y token.
- [ ] Deploy en **Vercel**: importar el repositorio, cargar las variables de `.env.example`, dominio `participa.baiking.com.ar` (o subcarpeta del sitio actual vía redirección).
- [ ] Cambiar `checkout.modo` a `api` en `config/campaign.json` y desplegar.
- [ ] Prueba de punta a punta con credenciales de prueba de Mercado Pago: compra → webhook → números → mail → página gracias.
- [ ] Prueba de la vía gratuita y del bloqueo por DNI repetido.
- [ ] Definir `ADMIN_TOKEN` y probar `/api/export?token=...`.
- [ ] Analítica: agregar Meta Pixel / GA4 si se va a hacer pauta (respetar consentimiento).
- [ ] Protección anti-bots en el formulario gratuito (Cloudflare Turnstile o Vercel WAF) si aparece abuso.

## D. Comunicación

- [ ] Calendario de contenidos (ver `docs/03-automatizaciones.md` §4) cargado en Metricool.
- [ ] Todas las piezas con "Sin obligación de compra · Bases en baiking.com.ar/participa" y sin las palabras rifa/chances/números.
- [ ] Pauta en Meta configurada como promoción de un curso (no como sorteo) para evitar rechazos.
- [ ] Highlights de Instagram: "Cómo participar", "El curso", "Las bicis", "Sorteo".

## E. Día del sorteo

- [ ] Cierre de inscripciones automático (fecha en la config) y exportación del padrón (`/api/export`) → enviar al escribano.
- [ ] Ensayar `sorteo.html` con el padrón de prueba; el día del sorteo cargar el CSV real y usar "Pantalla completa" para el vivo.
- [ ] Transmisión en vivo por Instagram con el escribano presente; descargar el acta JSON al terminar.
- [ ] Contactar a la persona ganadora (llamada + mail + WhatsApp) y publicar el resultado.
- [ ] Cargar el ganador en `config/campaign.json` → `ganadores` para que aparezca en el sitio.

## F. Después

- [ ] Entrega documentada (acta, DNI, foto) y contenido de la entrega para redes.
- [ ] Encuesta corta a compradores del curso (testimonios para la edición #2).
- [ ] Reporte final: órdenes, ingresos, costos, conversión por canal.

## G. Panel y transferencias (agregado)

- [ ] `ADMIN_TOKEN` largo y aleatorio en Vercel; abrir `admin.html`, ingresar el token y verificar KPIs, gráficos y tabla con las primeras órdenes de prueba.
- [ ] Activar el beacon de presencia (`panel.presencia: true` en la config si el checkout no está en modo `api`).
- [ ] Decidir si se ofrece transferencia (`checkout.transferencia.habilitada`) y con qué descuento; completar alias, CBU, titular, CUIT y banco.
- [ ] Crear el bucket privado `comprobantes` en Supabase Storage.
- [ ] `ANTHROPIC_API_KEY` en Vercel para la lectura automática de comprobantes; `TRANSFERENCIAS_AUTO_APROBAR=false` hasta tener conciliación bancaria.
- [ ] (Opcional) Correo entrante `pagos@baiking.com.ar` → `/api/inbound-email` con `INBOUND_SECRET` (ver `docs/03-automatizaciones.md` §7).
- [ ] Probar el circuito completo con una transferencia real de $1 entre cuentas propias: mail de instrucciones → carga del comprobante → revisión en el panel → aprobación → mail con números.
