# 02 · Mecánica de la promoción y decisiones

## 1. El modelo que construimos

**"Productos digitales + una participación por compra"** (modelo del 29/09; el anterior, "curso + escalera de chances", quedó reemplazado: ver §4.2 y `docs/08`). Baiking vende tres productos digitales reales, cada uno con su contenido y su precio: el pack de fondos de pantalla, el checklist pre-salida en PDF y el **Curso Baiking de Mantenimiento** (en video, lo da Gastón: cómo preparar la bici para una carrera o salida, lavado y lubricación sin herramientas específicas, ajuste general, errores comunes y cómo evitarlos). **Cada compra otorga exactamente una (1) participación** en el sorteo de una Polygon, cualquiera sea el producto y su precio: nadie paga por más probabilidad. Además existe la **vía gratuita** (formulario + carta a la tienda, una por persona), con la misma participación, porque la ley lo exige. Se cobra únicamente por transferencia bancaria: el comprobante se adjunta en el mismo formulario, la participación cuenta recién cuando se valida y el producto llega por mail, como link.

```
Participante ──► elige un producto (y la bici que prefiere) ──► ve alias/CBU en el formulario, transfiere y adjunta el comprobante ──► "Participar"
                                                                                    │
                        ┌───────────────────────────────────────────────────────────┘
                        ▼
      orden pendiente ──► Claude lee el comprobante ──► en_revision ──► aprobación (panel, planilla o automática) ──► pagada
                                                                                                                       │
                        ┌──────────────────────────────────────────────────────────────────────────────────────────────┘
                        ▼
              asigna el número correlativo ──► mail con el producto (link) + número ──► página "gracias"
                        │
                        ▼
      padrón cerrado y publicado (cantidad total de participaciones) ──► sorteo en vivo por Instagram, grabado (sorteo.html / scripts/sorteo.mjs) ──► acta
```

Diferencias con Autoloop, y por qué:

| Autoloop | Baiking | Motivo |
|---|---|---|
| Packs de 1/3/5/10 "chances" del mismo PDF | Tres productos digitales distintos (fondos, checklist, curso), con contenido y precio propios; cada compra da una (1) participación, igual que la vía gratuita; cada producto se compra una sola vez por persona | Revisión legal del 29/09 (`docs/08` §5, camino C): lo que se paga es el producto, nunca la probabilidad |
| Sin vía gratuita | Formulario "Participación sin cargo" + carta a la tienda (1 por DNI), con la misma participación | Lealtad Comercial, DNU 274/2019 art. 14 |
| "Tu número de sorteo", "quedan pocos números", "más compras = más chances" | "Participación/participaciones" en el sitio, las bases, los mails y el panel (`config/campaign.json` → `unidad`); "sin obligación de compra" en todas las piezas | Riesgo con Meta, Defensa del Consumidor y loterías provinciales |
| Cobro por transferencia con el comprobante por WhatsApp, a mano | Transferencia con el comprobante adjunto en el mismo checkout, leído por IA, aprobado desde el panel o la planilla y con factura por cada compra | Trazabilidad, sin comisión de pasarela, sin contracargos |
| Sorteo en vivo | Sorteo en vivo por Instagram, grabado, con el padrón cerrado y publicado antes (cantidad total de participaciones) y acta descargable de `sorteo.html` | Transparencia auditable sin escribano |

Escribano: queda como opción recomendada pero no comunicada, solo si el abogado lo pide (presupuesto de referencia en §3).

## 2. Los tres productos (decisión del 29/09)

Cada producto tiene contenido y precio propios y **todos dan la misma participación: una (1)**. Están cargados en `config/campaign.json` → `packs` (precios `[A CONFIRMAR]` con Gastón):

| Producto (`packs[].id`) | Incluye | Precio | Participaciones |
|---|---|---|---|
| Fondos de pantalla Baiking (`fondos`) | Pack de fondos de pantalla en alta resolución (celular y computadora) | $5.000 | 1 |
| Checklist pre-salida (`checklist`) | Checklist pre-salida en PDF + los fondos de pantalla | $12.000 | 1 |
| Curso Baiking de Mantenimiento (`curso`, destacado) | Curso en video (4 módulos) + checklist + fondos | $25.000 | 1 |

Reglas:
- **Una compra por producto y por persona (DNI).** `api/checkout.js` responde `409` ("cada producto se compra una sola vez por persona") si ya hay una orden de ese producto con ese DNI en estado `pendiente`, `en_revision` o `pagada`; las rechazadas o anuladas no cuentan. Productos distintos sí: como máximo tres participaciones pagas por persona, más la gratuita.
- **El precio no escala con las participaciones.** `scripts/check.mjs` solo pide precios crecientes de un producto al siguiente y avisa si algún producto otorgara más participaciones que otro ("nadie debería pagar por más probabilidad").
- **Entrega por mail, como link.** El mail de confirmación lleva el botón "Descargar / Ver {producto}" con `packs[].entrega_url` (Drive, PDF, YouTube no listado); el curso, si no tiene `entrega_url`, usa `curso.url_acceso` y muestra `curso.acceso_texto`. Hoy los tres links están vacíos: hasta cargarlos, el mail avisa que el producto llega aparte. Producir los tres productos es contenido pendiente (`docs/04` sección B).
- No hay tope de participaciones (`edicion.cupo_total: null`): el checkout nunca corta ventas. La barra del hero no mide ventas: es lineal en el tiempo, 0 % el 15/10 (`edicion.inicio`) y 100 % el 4/12 ("Ya pasó el X % del tiempo para participar").
- La palabra que se usa es "participación/participaciones" y se cambia en un solo lugar: `config/campaign.json` → `unidad`. El sitio, los mails, el panel y `scripts/sorteo.mjs` la leen de ahí.
- **Lo que queda del riesgo legal** (`docs/08` §3 y §5): la escalera ya no está, pero el abogado tiene que validar que la vía gratuita (formulario + carta postal, 1 por persona) sea equivalente frente a hasta tres participaciones pagas por persona, el alcance territorial y la renuncia a la revocación del contenido digital (bases, cláusula 10). Las mitigaciones que hay que sostener: los productos son reales y se entregan de verdad; la vía gratuita sigue activa y visible; el sorteo es en vivo, grabado y con el padrón publicado; la factura dice el producto comprado, sin mencionar el sorteo; nunca se comunica "más compras = más participaciones".

## 3. Escenarios económicos (ilustrativos: cargar números reales)

Supuestos: bici al costo para Baiking ≈ $2.600.000 (quien gana elige entre la Siskiu T7, PVP $3.664.500, la Tambora y la Strattos; se presupuesta con la más cara de las opciones habilitadas: con la Tambora A4, valor de referencia ≈ $3.600.000, el costo es parejo; si se habilitara la G5 habría que sumar del orden de $1.000.000 al fijo, y la Strattos todavía no tiene versión ni valor, ver `docs/01` §5); escribano $100.000 (desde el 28/09 es opcional; la partida queda como reserva); producción de los tres productos (grabar el curso, diseñar el checklist y los fondos) $300.000; entrega del premio e imprevistos $250.000 (la primera edición no tiene premios adicionales, `sorteo.premios_secundarios` está vacío; esta reserva cubre el viaje de Gastón o el embalaje y envío a domicilio sin costo para quien gana, el primer service sin cargo a los 30 días y contingencias; el costo real del envío queda a verificar); costo de cobro: transferencia directa sin comisión de pasarela, más el impuesto al cheque del 0,6 % sobre cada acreditación por ser SRL (`docs/05` §4; SIRCREB es pago a cuenta de IIBB, no costo) y la lectura del comprobante por IA (≈ USD 0,02-0,03 por orden, `docs/03` §7, despreciable); mezcla de ventas estimada entre los tres productos: 50 % curso ($25.000) · 30 % checklist ($12.000) · 20 % fondos ($5.000). Los precios están a confirmar: si cambian, recalcular.

- Ticket promedio ≈ **$17.100** (una participación por orden; una persona puede tener hasta tres órdenes, una por producto).
- Costo variable por orden ≈ 0,6 % ≈ **$100** (los productos digitales no tienen costo por unidad).
- Margen de contribución por orden ≈ **$17.000**.
- Costos fijos ≈ **$3.250.000** → **punto de equilibrio ≈ 192 órdenes**.

| Órdenes pagas | Ingresos | Costos variables | Costos fijos | Resultado |
|---|---|---|---|---|
| 150 | $2.565.000 | $15.400 | $3.250.000 | **−$700.400** |
| 300 | $5.130.000 | $30.800 | $3.250.000 | **+$1.849.200** |
| 600 | $10.260.000 | $61.600 | $3.250.000 | **+$6.948.400** |
| 1.000 | $17.100.000 | $102.600 | $3.250.000 | **+$13.747.400** |

Qué cambia respecto del cálculo anterior (escalera de chances, 28/09): el ticket promedio baja de ≈ $26.500 (≈ 4,6 chances por orden) a ≈ $17.100 y el punto de equilibrio sube de ≈ 124 a ≈ 192 órdenes, porque ya no se vende probabilidad: el ingreso depende de cuánta gente compra un producto (y cuántos de los tres), no de cuántas participaciones suma cada uno. El costo de cobro no cambia: ≈ 0,6 % por orden al cobrar solo por transferencia (contra ≈ 8 % con Mercado Pago), a cambio del trabajo de conciliar cada comprobante contra el home banking de Galicia y del riesgo de comprobantes editados (`docs/03` §7, `docs/05` §5).

Con 121K seguidores en Instagram, 300 órdenes equivale a una conversión del 0,25 % de la audiencia. Además, todos los compradores quedan en una base de datos con mail y WhatsApp (clientes para el taller y para la edición siguiente).

Sensibilidad: si la vía gratuita representa el 30 % de las participaciones, no cambia el resultado económico: solo baja la probabilidad de que gane un comprador. Con una participación por compra, la vía gratuita y la paga valen lo mismo por diseño; la vía gratuita tiene que ser visible y equivalente (`docs/08` §3, filas 4 y 5), no un trámite escondido.

## 4. Registro de decisiones

Fuente de verdad: estas tablas y `config/campaign.json`. Las decisiones del 28/09 siguen vigentes salvo las marcadas "(reemplazado el 29/09)".

### 4.1 Decisiones del 28/09 (reunión con Gastón y Belén)

| Decisión | Implicancia | Dónde vive en el código |
|---|---|---|
| **Medio de pago: únicamente transferencia bancaria, sin descuento.** Mercado Pago deshabilitado (la integración queda por si se reactiva). | Sin comisión de pasarela ni contracargos; el costo de cobro es el impuesto al cheque (0,6 %, SRL). Alguien concilia cada comprobante contra el home banking de Galicia. El selector de medio de pago no se muestra (hay uno solo). | `config/campaign.json` → `checkout.transferencia` (`habilitada: true`, `descuento_pct: 0`) y `checkout.mercadopago.habilitada: false` · `api/checkout.js` · `assets/js/app.js` · reactivación: `docs/03` §8 |
| **Flujo de compra: datos bancarios y comprobante en el mismo formulario.** El participante ve alias `baiking.bicis`, CBU `0070119420000003239999`, titular X Centro Pilar SRL, CUIT 30-71025912-3, Banco Galicia, transfiere y adjunta el comprobante antes de tocar "Participar". La participación cuenta cuando el comprobante se valida (IA + aprobación automática opcional o aprobación manual desde el panel). | No hay "reserva" ni mail con instrucciones; el código `BK-XXXXX` deja de existir de cara al usuario (queda como identificador interno de la orden) y no se pide en el concepto. Estados `pendiente → en_revision → pagada`. Casilla para comprobantes por mail y contacto: `belen.baiking@gmail.com`. | `assets/js/app.js` (`renderTransferData`, `archivoABase64`, `validate`) · `api/checkout.js` (POST con `comprobante`) · `api/_lib/comprobante.js` · `admin.html`, `api/admin.js` · `TRANSFERENCIAS_AUTO_APROBAR` · `checkout.transferencia.email_comprobantes`, `contacto.email` |
| **Sin escribano.** Sorteo en vivo por Instagram, grabado, con el padrón cerrado y publicado (cantidad total de participaciones) antes de sortear. | Se saca "ante escribano" del sitio, las bases, los mails, las piezas y estos documentos. Queda como opción recomendada pero no comunicada, si el abogado lo pide. | `config` → `sorteo.metodo`, `sorteo.reglas` · `bases-y-condiciones.html` cláusulas 5.5 y 7 · `sorteo.html` (acta JSON) |
| **Sin tope de participaciones.** La barra es lineal en el tiempo (0 % el 15/10, 100 % el 4/12). | El checkout no corta ventas; la barra no mide ventas. `api/progreso` queda sin uso (solo serviría si algún día se fija un tope). | `edicion.cupo_total: null`, `edicion.inicio`, `edicion.progreso_demo_pct` · `assets/js/app.js` (`initProgreso`) |
| **Escalera de precios** 1 · 2 · 4 · 6 · 10 (recomendado) · 15 · 20 · 30 · 50 · 200 chances ($10.000 a $300.000) **(reemplazado el 29/09)**. | Reemplazada por los tres productos con una (1) participación cada uno: la revisión legal (`docs/08`) la calificó de riesgo alto. Ver §4.2 y §2. | `packs[]` (hoy, los tres productos) |
| **Curso: "Curso Baiking de Mantenimiento"**, en video, lo da Gastón: 1) preparar la bici ante una carrera o salida, 2) lavado y lubricación sin herramientas específicas, 3) ajuste general, 4) errores comunes y cómo evitarlos. | No se promete guía PDF, ni "acceso de por vida" como formato, ni consultas por WhatsApp. Falta grabarlo y definir dónde se aloja. (Actualizado el 29/09: el curso es uno de los tres productos, el destacado, e incluye el checklist pre-salida en PDF y los fondos; se aloja en YouTube no listado, `curso.url_acceso`.) | `curso` (`nombre`, `descripcion`, `docente`, `modulos`, `url_acceso` vacío) |
| **Identidad:** fondo blanco con acentos rojos (rojo Baiking `#eb0627`), header rojo con el logo centrado, logo real. | Se abandona el verde volt sobre fondo oscuro. | `assets/css/styles.css` (`:root`) · `marca.logo` · `assets/img/logo-baiking-rojo.png`, `-blanco.png`, `-circulo.png` |
| **Organizador: X Centro Pilar SRL, CUIT 30-71025912-3.** | Por ser SRL aplica el impuesto al cheque (0,6 % sobre cada acreditación, `docs/05` §4). Factura por cada compra. Confirmar con Gastón que la promoción la organiza esa sociedad. | `legal.razon_social`, `legal.cuit`, `legal.domicilio` · `checkout.transferencia.titular`, `.cuit` |
| **Página simplificada:** hero con foto del local + escalera de chances, lo esencial, el premio, cómo funciona (4 pasos: elegí tus chances → realizá el pago: "Completá el checkout y transferí el monto indicado. Subí tu comprobante de pago." → recibí tus chances → sorteo en vivo), el curso, el sorteo, 5 preguntas frecuentes, footer compacto con botón de arrepentimiento. **(Reemplazado el 29/09** en lo que hace a la escalera: hoy el hero tiene el selector de producto y los pasos son elegí tu producto → realizá el pago → recibí por mail tu producto y tu participación → sorteo en vivo; 6 preguntas frecuentes; ver §4.2.) | Se fueron "Somos Baiking", la cita de Gastón y los packs con kit/service. Faltan las fotos (local, Gastón, bicis). | `index.html` · `faq[]` · `marca.foto_hero`, `marca.foto_gaston`, `bicis[].imagen` |

### 4.2 29/09 — Modelo de tres productos

**Por qué.** La revisión legal (`docs/08`) calificó el sitio con la escalera como riesgo **alto**: el curso era idéntico en todos los packs y lo único que cambiaba era la cantidad de chances, con precio unitario decreciente ("cuantas más sumás, menos pagás por cada una"). Eso es vender probabilidad: premio "en razón directa de la compra" (DNU 274/2019 art. 14), exposición al art. 301 bis del Código Penal y a las loterías provinciales ("rifa encubierta"), y la vía gratuita (1 chance contra un mínimo de 10 por compra) quedaba como una formalidad. Con tres productos distintos, cada uno con su contenido y su precio, y **una participación por compra**, el sorteo queda simple y equitativo: la participación es la misma para quien compra el producto de $5.000, el de $25.000 o para quien entra sin cargo; lo que cambia con el precio es el contenido, no la probabilidad. Es el "camino C" de `docs/08` §5, con una diferencia: en vez de un tope de una compra por DNI, cada persona puede comprar cada producto una sola vez (hasta tres participaciones pagas).

| Decisión | Implicancia | Dónde vive en el código |
|---|---|---|
| **Tres productos digitales** con contenido y precio propios: fondos de pantalla $5.000 · checklist pre-salida $12.000 · Curso Baiking de Mantenimiento $25.000 (destacado). Precios a confirmar con Gastón. | Cada producto se entrega por mail, como link. Hay que producir los tres (§5). | `packs[]` (`incluye`, `precio`, `destacado`, `entrega_url`), `curso.url_acceso` · `api/_lib/notificaciones.js` (`entregaDelProducto`) · `scripts/check.mjs` |
| **Una (1) participación por compra**, cualquiera sea el producto; la vía gratuita da la misma. | Nadie paga por más probabilidad. Se saca del sitio, las bases, los mails y estos documentos todo "sumá chances", "más compras = más chances", precio por chance y escalera. | `packs[].participaciones: 1` · `participacion_gratuita.participaciones: 1` · `faq[]` ("¿Comprar el producto más caro me da más chances?": no) · `bases-y-condiciones.html` cláusulas 3 y 5.1 |
| **Cada producto se compra una sola vez por persona (DNI).** Productos distintos sí. | Máximo tres participaciones pagas por persona. La API responde `409` si se repite. | `api/checkout.js` (`contarOrdenes` por `dni` + `packId`) · bases cláusula 5.1 |
| **"Participación/participaciones" en todas las piezas.** Ya no se usa "chances" ni en el sitio ni en la pauta. | Una sola palabra en el sitio, las bases, los mails, el panel y la planilla. | `config/campaign.json` → `unidad` · `contacto.whatsapp_mensaje` · `sorteo.metodo`, `sorteo.reglas` · `api/_lib/sheets.js` (columna `participaciones`) |
| **Página:** hero con foto del local + selector de producto ("Elegí tu producto"), claim "Una participación por compra, con la misma probabilidad que cualquier otra", barra de tiempo "Ya pasó el X % del tiempo para participar", pasos elegí tu producto → realizá el pago → recibí por mail tu producto y tu participación → sorteo en vivo. | Se fueron la escalera, "Seleccioná tus chances" y "cuantas más chances sumás, menos pagás". | `index.html` · `assets/js/app.js` (`renderLadder` dibuja los productos) |
| **Mails con el producto.** El mail de confirmación dice "Confirmamos tu pago de {producto}", lista lo que incluye y lleva el botón "Descargar / Ver {producto}" (o avisa que llega aparte si el link está vacío). El recordatorio de una semana invita a "Ver los productos" ("si todavía no tenés alguno, estás a tiempo: cada uno se compra una sola vez"). | Ningún mail habla de sumar participaciones. | `api/_lib/notificaciones.js` (`armarMailConfirmacion`, `armarMailRecordatorioSemana`) · `scripts/mails-preview.mjs` |
| **Sin cambios:** transferencia como único medio, comprobante en el formulario, sin escribano, sin tope, barra lineal en el tiempo, vía gratuita con carta, identidad roja, organizador X Centro Pilar SRL. | | Ver §4.1 |

## 5. Qué queda por decidir con Gastón (en orden)

1. **Fecha del sorteo y vigencia.** Propuesta cargada en la config: lanzamiento 15/10, cierre 03/12 23:59, sorteo viernes 04/12 21:00 en vivo (7 semanas, entrega antes de las fiestas). Confirmar; cambiar en `config/campaign.json` y en `supabase/schema.sql`.
2. **Qué Tambora y qué Strattos se sortean.** Tambora A4 (~$3,6 M, pareja con la T7) vs G5 (carbono, ~$4,5-5,8 M); versión y valor de referencia de la Strattos (`bicis[].version_nota`, `valor_referencia: null`). Definir y ajustar specs/valor en la config.
3. **Los tres productos y sus precios.** Confirmar $5.000 / $12.000 / $25.000 (`packs[].precio`). Producir el pack de fondos de pantalla (celular y computadora), el checklist pre-salida en PDF y grabar los 4 módulos del curso con el celular en el taller (YouTube no listado). Cargar los links de entrega en `packs[].entrega_url` y `curso.url_acceso`: hasta que estén, el mail de confirmación avisa que el producto llega aparte y hay que mandarlo a mano.
4. **Facturación y contador.** X Centro Pilar SRL: IVA de los productos digitales, IIBB y código de actividad, impuesto al cheque, factura por cada compra (concepto: el producto comprado) y en qué cuenta se cobra. Ver `docs/05` §4 y `docs/04` sección A.
5. **Abogado.** Bases nuevas (sin escribano, pago por transferencia, tres productos con una participación por compra, cada producto una vez por persona, vía gratuita con carta) y lo que `docs/08` dejó abierto: alcance geográfico (todo el país vs excluir CABA/Mendoza/Neuquén/Río Negro/Salta, o tramitar en LOTBA), hasta tres participaciones pagas por persona frente a una gratuita, la revocación a 10 días del contenido digital (cláusula 10). Escribano opcional solo si él lo pide.
6. **Aprobación automática de transferencias.** `TRANSFERENCIAS_AUTO_APROBAR=false` (recomendado: aprobar desde el panel después de ver la acreditación) o `true` (se aprueba sola cuando todos los chequeos dan bien). Ver `docs/03` §7.
7. **Casilla de comprobantes.** `belen.baiking@gmail.com` con reenvío automático a `/api/inbound-email` o revisión manual desde la casilla y el panel. Ver `docs/03` §7 y `docs/04` sección G.
8. **WhatsApp.** Automático con la API oficial de Meta (requiere plantilla aprobada, ver `docs/03-automatizaciones.md`) o manual desde WhatsApp Business con el listado exportado.
9. **Fotos.** Foto vertical del local con Gastón y las bicis (hero) y foto de Gastón en bici (sección del curso). Las de las tres Polygon ya están cargadas (`assets/img/*.webp`).
10. **Dominio.** `participa.baiking.com.ar` a confirmar (`marca.sitio_url`, `legal.leyenda`, `BASE_URL`).
11. **Plan de comunicación.** Video de Gastón explicando la promo (el activo más fuerte: confianza), posts semanales, stories con el contador, salidas de MTB como evento, pauta paga con la leyenda "Sin obligación de compra" y sin invitar a "sumar" participaciones.

## 6. Lenguaje: usar / evitar

Desde el 29/09 la palabra es **"participación/participaciones"** en todas las piezas: sitio, bases, facturas, mails, panel, planilla y pauta (`config/campaign.json` → `unidad`; en las bases, "participación bonificada sin cargo"). "Chances" no se usa más: era el término del modelo anterior y es el que las loterías y Meta leen como venta de probabilidad.

| Usar | Evitar |
|---|---|
| promoción, participación, sorteo en vivo, sin obligación de compra, producto digital, curso | rifa, chances, números (como producto), "comprá tu número", "quedan pocos números", pozo, apuesta, jugada |
| "Con el producto (o el curso) participás por…", "una participación por compra, con la misma probabilidad que cualquier otra" | "Comprá chances para ganar…", "sumá chances", "más compras = más chances", "cuantas más sumás, menos pagás" |
| "Sorteo en vivo por Instagram, grabado y con el padrón publicado" | "Sorteo ante escribano" (no se contrató: no prometer lo que no se hace) · "Sorteo por la Quiniela" (salvo que el abogado lo recomiende como mecanismo) |
| "Transferí y subí el comprobante; te confirmamos en menos de 48 hs" | "Mandanos el comprobante por WhatsApp" (el circuito es el formulario o la casilla) |
