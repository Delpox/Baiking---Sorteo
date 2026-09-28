# 02 · Mecánica de la promoción y decisiones

## 1. El modelo que construimos

**"Curso Baiking + chances"**: Baiking vende un producto real, el **Curso Baiking de Mantenimiento** (en video, lo da Gastón: cómo preparar la bici para una carrera o salida, lavado y lubricación sin herramientas específicas, ajuste general, errores comunes y cómo evitarlos), y regala, como bonificación, chances para el sorteo de una Polygon. Además existe una **vía gratuita** de participación (una por persona) porque la ley lo exige. Se cobra únicamente por transferencia bancaria: el comprobante se adjunta en el mismo formulario y la participación cuenta recién cuando se valida.

```
Participante ──► elige chances ──► ve alias/CBU en el formulario, transfiere y adjunta el comprobante ──► "Participar"
                                                                    │
                        ┌───────────────────────────────────────────┘
                        ▼
      orden pendiente ──► Claude lee el comprobante ──► en_revision ──► aprobación (panel, o automática) ──► pagada
                                                                                                             │
                        ┌────────────────────────────────────────────────────────────────────────────────────┘
                        ▼
              asigna números correlativos ──► mail + WhatsApp ──► página "gracias"
                        │
                        ▼
      padrón cerrado y publicado (cantidad total de chances) ──► sorteo en vivo por Instagram, grabado (sorteo.html) ──► acta
```

Diferencias con Autoloop, y por qué:

| Autoloop | Baiking | Motivo |
|---|---|---|
| Packs de 1/3/5/10 "chances" del mismo PDF | Misma escalera (1 a 200 chances) pero con un producto real: el curso en video de Gastón, con acceso al confirmarse el pago | Decisión del 28/09; el riesgo de "rifa encubierta" queda anotado en §2 y en `docs/01` §2.4 |
| Sin vía gratuita | Formulario "Participación sin cargo" (1 por DNI) | Lealtad Comercial, DNU 274/2019 art. 14 |
| "Tu número de sorteo", "quedan pocos números" | "Chances" en el sitio (`config/campaign.json` → `unidad`), "participaciones bonificadas" en bases y facturas, "sin obligación de compra" en todas las piezas | Riesgo con Meta y loterías provinciales |
| Cobro por transferencia con el comprobante por WhatsApp, a mano | Transferencia con el comprobante adjunto en el mismo checkout, leído por IA, aprobado desde el panel y con factura por cada compra | Trazabilidad, sin comisión de pasarela, sin contracargos |
| Sorteo en vivo | Sorteo en vivo por Instagram, grabado, con el padrón cerrado y publicado antes (cantidad total de chances) y acta descargable de `sorteo.html` | Transparencia auditable sin escribano |

Escribano: queda como opción recomendada pero no comunicada, solo si el abogado lo pide (presupuesto de referencia en §3).

## 2. Escalera de precios (decisión del 28/09: copiar la estructura de Autoloop)

Todas las opciones incluyen el mismo curso y lo que cambia es la cantidad de chances. Está cargada en `config/campaign.json` → `packs`:

| Opción | Precio | Precio por chance | Descuento vs. 1 chance |
|---|---|---|---|
| 1 chance | $10.000 | $10.000 | — |
| 2 chances | $15.000 | $7.500 | 25 % |
| 4 chances | $25.000 | $6.250 | 38 % |
| 6 chances | $35.000 | $5.833 | 42 % |
| 10 chances | $45.000 | $4.500 | 55 % (destacado "Recomendado") |
| 15 chances | $70.000 | $4.667 | 53 % |
| 20 chances | $90.000 | $4.500 | 55 % |
| 30 chances | $120.000 | $4.000 | 60 % |
| 50 chances | $150.000 | $3.000 | 70 % |
| 200 chances | $300.000 | $1.500 | 85 % (etiqueta "Mejor precio") |

Notas:
- No hay tope de chances (`edicion.cupo_total: null`): el checkout nunca corta ventas. La barra del hero no mide chances vendidas: es lineal en el tiempo, 0 % el 15/10 y 100 % el 4/12.
- La palabra que se usa ("chance"/"chances") se cambia en un solo lugar: `config/campaign.json` → `unidad`. Con `participación`/`participaciones` el sitio, los mails y el panel se adaptan solos.
- **Riesgo legal (ver `docs/01-investigacion.md` §2.4):** un precio que sube solo por la cantidad de chances del mismo producto digital es exactamente lo que la lotería de Entre Ríos calificó de "rifa encubierta" en 2022. Las mitigaciones que quedan en pie y conviene no tocar: el curso es real y se entrega de verdad; la vía gratuita "sin obligación de compra" sigue activa; el sorteo es en vivo por Instagram, grabado y con el padrón publicado; la factura dice "Curso Baiking de Mantenimiento" sin mencionar el sorteo; las bases hablan de "participaciones bonificadas". Vale la consulta al abogado antes de lanzar con esta estructura.
- Alternativa intermedia si el abogado lo pide: mantener la escalera pero hacer que cada escalón agregue algo real (kit, service, jersey), como estaba en la primera versión de este documento.

## 3. Escenarios económicos (ilustrativos: cargar números reales)

Supuestos: bici al costo para Baiking ≈ $2.600.000 (quien gana elige entre la Siskiu T7, PVP $3.664.500, y la Tambora; se presupuesta con la más cara de las dos opciones habilitadas: con la Tambora A4, valor de referencia ≈ $3.600.000, el costo es parejo, y si se habilitara la G5 habría que sumar del orden de $1.000.000 al fijo, ver `docs/01` §5); escribano $100.000 (desde el 28/09 es opcional; la partida queda como reserva); producción del curso $300.000; entrega del premio e imprevistos $250.000 (la primera edición no tiene premios adicionales, `sorteo.premios_secundarios` está vacío; esta reserva cubre el viaje de Gastón o el embalaje y envío a domicilio sin costo para quien gana, el primer service sin cargo a los 30 días y contingencias; el costo real del envío queda a verificar); costo de cobro: transferencia directa sin comisión de pasarela, más el impuesto al cheque del 0,6 % sobre cada acreditación por ser SRL (`docs/05` §4; SIRCREB es pago a cuenta de IIBB, no costo) y la lectura del comprobante por IA (≈ USD 0,02-0,03 por orden, `docs/03` §7, despreciable); mezcla de ventas estimada con la escalera: 35 % 1 chance · 20 % 2 · 15 % 4 · 10 % 6 · 12 % 10 · 5 % 15 · 3 % 30 o más.

- Ticket promedio ≈ **$26.500** (≈ 4,6 chances por orden).
- Costo variable por orden ≈ 0,6 % ≈ **$160** (el curso no tiene costo por unidad).
- Margen de contribución por orden ≈ **$26.340**.
- Costos fijos ≈ **$3.250.000** → **punto de equilibrio ≈ 124 órdenes** (≈ 570 chances).

| Órdenes pagas | Ingresos | Costos variables | Costos fijos | Resultado |
|---|---|---|---|---|
| 150 | $3.975.000 | $23.850 | $3.250.000 | **+$701.150** |
| 300 | $7.950.000 | $47.700 | $3.250.000 | **+$4.652.300** |
| 600 | $15.900.000 | $95.400 | $3.250.000 | **+$12.554.600** |
| 1.000 | $26.500.000 | $159.000 | $3.250.000 | **+$23.091.000** |

Qué cambia respecto del cálculo anterior: antes se descontaba ≈ 8 % de comisiones de Mercado Pago y retenciones (≈ $2.100 por orden, equilibrio ≈ 135 órdenes); al cobrar solo por transferencia el costo de cobro baja a ≈ $160 por orden y el equilibrio a ≈ 124 órdenes (≈ $1.960 más por orden, ≈ $590.000 con 300 órdenes), a cambio del trabajo de conciliar cada comprobante contra el home banking de Galicia y del riesgo de comprobantes editados (`docs/03` §7, `docs/05` §5).

Con 121K seguidores en Instagram, 300 órdenes equivale a una conversión del 0,25 % de la audiencia. Además, todos los compradores quedan en una base de datos con mail y WhatsApp (clientes para el taller y para la edición siguiente).

Sensibilidad: si la vía gratuita representa el 30 % de las participaciones (lo habitual es mucho menos), no cambia el resultado económico: solo baja la probabilidad de que gane un comprador. Se puede mitigar sin violar la ley haciendo que la vía gratuita sea correcta pero no promocionada más que lo exigido (link en el sitio, leyenda en las piezas).

## 4. Decisiones del 28/09 (reunión con Gastón y Belén)

Fuente de verdad: esta tabla y `config/campaign.json`.

| Decisión | Implicancia | Dónde vive en el código |
|---|---|---|
| **Medio de pago: únicamente transferencia bancaria, sin descuento.** Mercado Pago deshabilitado (la integración queda por si se reactiva). | Sin comisión de pasarela ni contracargos; el costo de cobro es el impuesto al cheque (0,6 %, SRL). Alguien concilia cada comprobante contra el home banking de Galicia. El selector de medio de pago no se muestra (hay uno solo). | `config/campaign.json` → `checkout.transferencia` (`habilitada: true`, `descuento_pct: 0`) y `checkout.mercadopago.habilitada: false` · `api/checkout.js` · `assets/js/app.js` · reactivación: `docs/03` §8 |
| **Flujo de compra: datos bancarios y comprobante en el mismo formulario.** El participante ve alias `baiking.bicis`, CBU `0070119420000003239999`, titular X Centro Pilar SRL, CUIT 30-71025912-3, Banco Galicia, transfiere y adjunta el comprobante antes de tocar "Participar". La participación cuenta cuando el comprobante se valida (IA + aprobación automática opcional o aprobación manual desde el panel). | No hay "reserva" ni mail con instrucciones; el código `BK-XXXXX` deja de existir de cara al usuario (queda como identificador interno de la orden) y no se pide en el concepto. Estados `pendiente → en_revision → pagada`. Casilla para comprobantes por mail y contacto: `belen.baiking@gmail.com`. | `assets/js/app.js` (`renderTransferData`, `archivoABase64`, `validate`) · `api/checkout.js` (POST con `comprobante`) · `api/_lib/comprobante.js` · `admin.html`, `api/admin.js` · `TRANSFERENCIAS_AUTO_APROBAR` · `checkout.transferencia.email_comprobantes`, `contacto.email` |
| **Sin escribano.** Sorteo en vivo por Instagram, grabado, con el padrón cerrado y publicado (cantidad total de chances) antes de sortear. | Se saca "ante escribano" del sitio, las bases, los mails, las piezas y estos documentos. Queda como opción recomendada pero no comunicada, si el abogado lo pide. | `config` → `sorteo.metodo`, `sorteo.reglas` · `bases-y-condiciones.html` cláusulas 5.5 y 7 · `sorteo.html` (acta JSON) |
| **Sin tope de chances.** La barra es lineal en el tiempo (0 % el 15/10, 100 % el 4/12). | El checkout no corta ventas; la barra no mide chances vendidas. `api/progreso` queda sin uso (solo serviría si algún día se fija un tope). | `edicion.cupo_total: null`, `edicion.inicio`, `edicion.progreso_demo_pct` · `assets/js/app.js` (`initProgreso`) |
| **Escalera de precios** 1 · 2 · 4 · 6 · 10 (recomendado) · 15 · 20 · 30 · 50 · 200 chances ($10.000 a $300.000). | Ver §2 (precios por chance y riesgo legal). | `packs[]` |
| **Curso: "Curso Baiking de Mantenimiento"**, en video, lo da Gastón: 1) preparar la bici ante una carrera o salida, 2) lavado y lubricación sin herramientas específicas, 3) ajuste general, 4) errores comunes y cómo evitarlos. | No se promete guía PDF, ni "acceso de por vida" como formato, ni consultas por WhatsApp. Falta grabarlo y definir dónde se aloja. | `curso` (`nombre`, `descripcion`, `docente`, `modulos`, `url_acceso` vacío) |
| **Identidad:** fondo blanco con acentos rojos (rojo Baiking `#eb0627`), header rojo con el logo centrado, logo real. | Se abandona el verde volt sobre fondo oscuro. | `assets/css/styles.css` (`:root`) · `marca.logo` · `assets/img/logo-baiking-rojo.png`, `-blanco.png`, `-circulo.png` |
| **Organizador: X Centro Pilar SRL, CUIT 30-71025912-3.** | Por ser SRL aplica el impuesto al cheque (0,6 % sobre cada acreditación, `docs/05` §4). Factura por cada compra. Confirmar con Gastón que la promoción la organiza esa sociedad. | `legal.razon_social`, `legal.cuit`, `legal.domicilio` · `checkout.transferencia.titular`, `.cuit` |
| **Página simplificada:** hero con foto del local + escalera de chances, lo esencial, el premio, cómo funciona (4 pasos: elegí tus chances → realizá el pago: "Completá el checkout y transferí el monto indicado. Subí tu comprobante de pago." → recibí tus chances → sorteo en vivo), el curso, el sorteo, 5 preguntas frecuentes, footer compacto con botón de arrepentimiento. | Se fueron "Somos Baiking", la cita de Gastón y los packs con kit/service. Faltan las fotos (local, Gastón, bicis). | `index.html` · `faq[]` · `marca.foto_hero`, `marca.foto_gaston`, `bicis[].imagen` |

## 5. Qué queda por decidir con Gastón (en orden)

1. **Fecha del sorteo y vigencia.** Propuesta cargada en la config: lanzamiento 15/10, cierre 03/12 23:59, sorteo viernes 04/12 21:00 en vivo (7 semanas, entrega antes de las fiestas). Confirmar; cambiar en `config/campaign.json` y en `supabase/schema.sql`.
2. **Qué Tambora se sortea.** A4 (~$3,6 M, pareja con la T7) vs G5 (carbono, ~$4,5-5,8 M). Definir y ajustar specs/valor en la config.
3. **El curso.** Grabar los 4 módulos en video con el celular en el taller. Definir dónde se aloja (Google Drive con link privado, YouTube no listado, o plataforma tipo Hotmart) y cargar el link en `curso.url_acceso`.
4. **Facturación y contador.** X Centro Pilar SRL: IVA del curso, IIBB y código de actividad, impuesto al cheque, factura por cada compra y en qué cuenta se cobra. Ver `docs/05` §4 y `docs/04` sección A.
5. **Abogado.** Bases nuevas (sin escribano, pago por transferencia, escalera de chances) y alcance geográfico: todo el país vs excluir CABA/Mendoza/Neuquén/Río Negro/Salta, o tramitar en LOTBA. Escribano opcional solo si él lo pide.
6. **Aprobación automática de transferencias.** `TRANSFERENCIAS_AUTO_APROBAR=false` (recomendado: aprobar desde el panel después de ver la acreditación) o `true` (se aprueba sola cuando todos los chequeos dan bien). Ver `docs/03` §7.
7. **Casilla de comprobantes.** `belen.baiking@gmail.com` con reenvío automático a `/api/inbound-email` o revisión manual desde la casilla y el panel. Ver `docs/03` §7 y `docs/04` sección G.
8. **WhatsApp.** Automático con la API oficial de Meta (requiere plantilla aprobada, ver `docs/03-automatizaciones.md`) o manual desde WhatsApp Business con el listado exportado.
9. **Fotos.** Foto vertical del local con Gastón y las bicis (hero), foto de Gastón en bici (sección del curso) y fotos de las dos Polygon (Baiking ya las tiene en su tienda).
10. **Dominio.** `participa.baiking.com.ar` a confirmar (`marca.sitio_url`, `legal.leyenda`, `BASE_URL`).
11. **Plan de comunicación.** Video de Gastón explicando la promo (el activo más fuerte: confianza), posts semanales, stories con el contador, salidas de MTB como evento, pauta paga con la leyenda "Sin obligación de compra".

## 6. Lenguaje: usar / evitar

En el sitio se usa "chances" por decisión de Baiking (`config/campaign.json` → `unidad`); en las bases, las facturas, la pauta y ante cualquier organismo, "participaciones bonificadas".

| Usar | Evitar |
|---|---|
| promoción, participación, participaciones bonificadas, sorteo en vivo, sin obligación de compra, curso | rifa, números (como producto), "comprá tu número", "quedan pocos números", pozo, apuesta, jugada |
| "Con el curso participás por…" | "Comprá chances para ganar…" (fuera del sitio) |
| "Sorteo en vivo por Instagram, grabado y con el padrón publicado" | "Sorteo ante escribano" (no se contrató: no prometer lo que no se hace) · "Sorteo por la Quiniela" (salvo que el abogado lo recomiende como mecanismo) |
| "Transferí y subí el comprobante; te confirmamos en menos de 48 hs" | "Mandanos el comprobante por WhatsApp" (el circuito es el formulario o la casilla) |
