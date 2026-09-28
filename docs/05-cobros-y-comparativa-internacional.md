# 05 · Cobros: cuánto se lleva cada medio, riesgos y cómo lo hacen en otros países

> **Nota del 28/09, después de la reunión con Gastón y Belén:** Baiking decidió cobrar **únicamente por transferencia bancaria, sin descuento** (`checkout.mercadopago.habilitada: false`, `descuento_pct: 0`) y sortear **sin escribano** (en vivo por Instagram, grabado, con el padrón publicado). Las comparaciones con Mercado Pago, el "descuento neutro" y las recomendaciones de §3 y §8 quedan como referencia por si se reactiva Mercado Pago (`docs/03` §8). Lo que sigue vigente para esta edición: §2 (fila "Transferencia bancaria directa"), §4 (impuesto al cheque del 0,6 % por ser SRL: el organizador es X Centro Pilar SRL), §5 (riesgos de comprobantes y aviso antifraude) y §6-7 (comparativa y benchmarks; donde dice "escribano", leer "opcional, no comunicado"). El código `BK-XXXXX` que se menciona más abajo ya no se le pide al participante: es solo un identificador interno de la orden.

> Este documento resume tres relevamientos hechos el 28/09/2026 (comisiones y medios de cobro en Argentina, regulación de "comprá y participá" en ocho países, y casos reales de sorteos de bicis). El proxy del entorno bloqueó las páginas oficiales, así que los datos salen de extractos de buscador; lo marcado **"a verificar"** hay que confirmarlo en la cuenta de Mercado Pago de Baiking, con el contador o con el abogado antes del lanzamiento del 15/10. Los porcentajes efectivos incluyen el IVA del 21 % sobre la comisión (caso monotributo); si Baiking es Responsable Inscripto, ese IVA es crédito fiscal y el costo real es la comisión sin IVA. Los importes están redondeados a pesos enteros. Acá usamos la palabra **chances** porque así lo decidió Baiking (`config/campaign.json` → `unidad`); en las bases y ante cualquier organismo son "participaciones bonificadas" (ver `docs/02` §5).

## 1. Resumen ejecutivo

- **Mercado Pago no cobra según el medio de pago sino según el plazo en que liberás la plata**: al instante 6,29 % + IVA (≈ 7,6 % efectivo), a 14-18 días 3,39 % + IVA (≈ 4,1 %), a 30-35 días 1,49-1,79 % + IVA (≈ 1,8-2,2 %). Sobre el pack "Más elegido" de $45.000 son $3.425, $1.846 y $811-975. Elegir 14-18 días es un clic en "Costos y cuotas" y ahorra ≈ $35.000 por cada $1.000.000 vendido frente a "al instante" (≈ $279.000 con 300 órdenes). La campaña no necesita la plata antes: las bicis ya están en el stock de Baiking y el premio se entrega en diciembre.
- **La trampa no es la comisión, son las cuotas sin interés**: si Baiking las absorbe, 3 cuotas suman ≈ 12,5 % + IVA (a verificar) y el costo total de un pago a 18 días pasa de 4,1 % a ≈ 19 %. Cuotas sí, pero con interés a cargo del cliente.
- **La transferencia "sin comisión" no es gratis ni segura**: si Baiking es SRL/SA paga 0,6 % de impuesto al cheque por cada acreditación, el banco retiene SIRCREB, alguien tiene que conciliar cada pago y el comprobante editado es la estafa más común. El **5 % de descuento configurado hoy pierde plata** frente a Mercado Pago a 14-18 días (−$3.592 por cada $1.000.000 con un mix 60/40); el descuento neutro es 4,1 % (3,5 % si hay impuesto al cheque; 2,9 % si se paga un proveedor de conciliación). Recomendación: 3 % o nada, y aprobar cada transferencia recién después de verla acreditada.
- **Las retenciones de Ingresos Brutos (SIRTAC, SIRCUPA, SIRCREB) no son un costo nuevo**: son pagos a cuenta de un impuesto que Baiking debe igual; si está en el Régimen Simplificado de PBA, directamente no aplican. Lo único que sí es costo es el impuesto al cheque (y solo para sociedades).
- **Del resto del mundo aprendimos dos cosas**: (1) en pagos, las tarjetas cuestan 2-7 % y los rieles cuenta-a-cuenta 0-1,2 % en todos lados (Pix, Khipu, iDEAL, ACH, UPI), y los comercios los aprovechan con un identificador único por orden y descuentos chicos, nunca "a mano"; (2) en promociones, "comprá y participá" es legal por diseño en Reino Unido y Estados Unidos porque existe una vía gratuita de igual dignidad, en España porque no hay sobreprecio, y en Brasil, México, Uruguay y Colombia solo con autorización previa, fianza y tasa. Argentina es el único de los nueve donde está prohibido condicionar la participación a la compra: la vía gratuita no es un extra, es el núcleo de la defensa.
- **Cinco decisiones para Gastón** (detalle en §8): (1) plazo de liberación de Mercado Pago (propuesta: 14-18 días); (2) transferencia sí o no, y con qué descuento (propuesta: sí, 3 % o 0 %, nunca 5 %); (3) cómo se concilian las transferencias (propuesta: revisión manual contra el extracto hasta que haya un CVU único por orden); (4) cuotas (propuesta: solo con interés a cargo del cliente); (5) encuadre fiscal y cuenta de cobro con el contador antes del 15/10 (RI o monotributo, tipo societario, cuenta o CVU exclusivo de la campaña, Cuenta DNI para el taller).

## 2. Cuánto se lleva cada medio de cobro

Costo efectivo = comisión × 1,21 (IVA incluido, caso monotributo). Última columna: estado del dato según el relevamiento.

| Medio | Comisión + IVA | Costo efectivo | Acreditación | Contracargos | Esfuerzo operativo para Baiking | Dato |
|---|---|---|---|---|---|---|
| **Mercado Pago Checkout Pro, dinero al instante** | 6,29 % + IVA (6,39 % en el esquema nuevo reportado en agosto 2026) | 7,61 % (7,73 %) | Inmediata | Sí. El Programa de Protección al Vendedor **no cubre servicios ni productos digitales**: un contracargo sobre el curso no está protegido | Nulo: ya integrado (`api/checkout.js`, webhook, mail, WhatsApp) | Esquema de plazos **a verificar en la cuenta de Baiking** ("Costos y cuotas"): viejo instante/10/18/35 o nuevo instante/14/30 |
| **Mercado Pago, 14-18 días** | 3,39 % + IVA | 4,10 % | 14 o 18 días según esquema | Idem | Nulo | Coincide en las fuentes; plazo exacto a verificar |
| **Mercado Pago, 30-35 días** | 1,49 % + IVA (35 días, esquema viejo) · 1,79 % + IVA (30 días, esquema nuevo) | 1,80 % · 2,17 % | 30-35 días: las ventas de la última semana (cierre 3/12) llegan a principios de enero | Idem | Nulo | A verificar |
| **Mercado Pago, cuotas sin interés** (costo que se suma al del plazo) | 2 cuotas 9,79 % · 3 cuotas 12,49 % · 6 cuotas 19,79 % · 9 cuotas 28,19 % · 12 cuotas 33,49 %, + IVA (otras guías: 6-8 % / 12-15 % / 22-28 % para 3 / 6 / 12) | A 18 días: 3 cuotas ≈ 19,2 % · 6 cuotas ≈ 28,0 % · 12 cuotas ≈ 44,6 % | Según plazo elegido | Idem | Nulo (se activa en la cuenta) | **A verificar en "Costos y cuotas > Por ofrecer cuotas"** |
| **Pago Nube** (Tienda Nube; Baiking ya tiene tienda) | Plan Inicial: tarjetas/MODO 6,40 % (1 día) · 4,45 % (7 días) · 3,50 % (14 días); transferencia 1,50 %. Planes Esencial/Impulso/Escala: hasta 5,59 / 3,89 / 2,99 % y transferencia 0,85 % (todo + IVA) | 7,74 / 5,38 / 4,24 %; transferencia 1,81 % (Inicial) | 1 / 7 / 14 días | Tarjetas sí; transferencia no. La transferencia se concilia sola (CVU de la tienda + DNI del comprador validado) | Medio: hay que vender los packs desde la tienda (modo `externo`) y asignar las chances por webhook `order/paid` o export. Con QR MODO impone 3 cuotas sin interés que absorbe el vendedor | Coincide en tres fuentes; comisión por venta del plan de Tienda Nube a verificar |
| **Getnet** (Santander) | Crédito en 1 pago 2 % + IVA a 8 días hábiles (ejemplo oficial: $50.000 → $1.210); guías: débito 2,29 % / crédito 3,79 %; adelanto inmediato ≈ 0,53 % por cada 10 días | 2,42 % (crédito 1 pago) | 8 días hábiles (adelantable) | Sí | Alto: alta de comercio con Santander e integración propia (Get Link & Pay para links) | A verificar |
| **Payway** (Prisma) | Débito 1 % + IVA (24 h hábiles) · crédito 1,8 % + IVA (8-18 días hábiles según tarjeta) | 1,21 % / 2,18 % | 1-18 días hábiles | Sí | Alto: alta de comercio, cuenta bancaria, integración Decidir; el checkout pierde la marca "Mercado Pago" | Extractos de la ayuda oficial |
| **Cuenta DNI Comercios** (Banco Provincia) | 0,6 % final (bonificado 3 meses; hasta 12 con adhesión Visa/Mastercard); sin mantenimiento | 0,6 % | Inmediata | No (transferencia) | Bajo para el taller y ventas por WhatsApp (QR interoperable + link de pago manual desde la app). **No tiene API ni integración con el sitio o Tienda Nube**: no sirve para el checkout web | Confirmado en la web del banco |
| **QR interoperable / Transferencias 3.0** | Tope BCRA 0,8 % + IVA | 0,97 % | Inmediata, irrevocable | No | Medio: para la web necesita un QR dinámico por orden, que lo dan agregadores (Talo, Pago Nube, Mobbex, Pagos360) | Tope confirmado (norma 2021 vigente) |
| **Transferencia bancaria directa** (alias/CBU + comprobante; lo implementado hoy, `docs/03` §7) | 0 % de comisión. Si Baiking es persona jurídica: 0,6 % de impuesto al cheque por cada acreditación (a verificar con el contador). SIRCREB como pago a cuenta | 0 % (persona humana, caja de ahorro) a 0,6 % (SRL/SA), más el tiempo de conciliación | Inmediata | No hay contracargo, pero sí **comprobantes editados o de transferencias no acreditadas** | Alto: revisar cada comprobante contra el home banking; el panel y la lectura por IA lo reducen a segundos por orden, pero no lo eliminan | — |
| **Transferencia con conciliación automática** (Talo: CVU y alias único por orden; Pronto Pago: CVU por cliente; Pagos360, Mobbex: a cotizar) | Talo 0,8-1 % + IVA según volumen | 0,97-1,21 % | Inmediata | No | Bajo una vez integrado: el proveedor avisa por webhook y la orden pasa a `pagada` sola (2-3 días de desarrollo, espejo de `api/webhooks/mercadopago.js`) | Talo coincide en tres fuentes; los demás no publican precio |
| **DEBIN** | ≈ 0 (BBVA no cobra el débito; intercambio máximo 0,3 % entre bancos; DEBIN Programado permite cuotas con débito) | ≈ 0-0,3 % | Inmediata | No | Alto: el cliente tiene que aprobar el débito en su home banking y la conciliación exige API del banco o un agregador | A verificar con el banco de Baiking |

Otros relevados, por si aparecen en la conversación: MODO no cobra comisión propia (paga la del gateway: Payway, Getnet, Pago Nube); Naranja X crédito 1,8 % + IVA desde el 28/7/2026; Ualá Bis link de pago 4,9 % + IVA inmediato (débito con lector 2,9 %, QR 0,8 %); Mobbex ≈ 2,09 % débito / 3,59 % crédito + IVA, negociable, acepta DEBIN y transferencia. Dentro de Checkout Pro los extractos mencionan "pago con transferencia desde cualquier banco", pero no aparece ni la comisión ni la mecánica: a verificar en el simulador de Mercado Pago. Además, el BCRA confirmó el 24/9/2026 que Mercado Pago tendrá licencia bancaria antes de fin de año: conviene volver a mirar la tabla de costos el 15/10.

Contexto de mercado (CACE, primer semestre 2026): tarjetas 46 % de los pagos online, billeteras 21 %, débito online 12 %; 6 de cada 10 empresas ofrecen cuotas y el 54 % de las ventas financiadas se hacen en 3-6 cuotas. Según Talo, las transferencias pasaron del 17,9 % del e-commerce argentino en 2024 al 24-27 % en 2026, empujadas por descuentos del 5-10 % (con 10 % off, entre el 30 y el 50 % de los clientes transfiere).

## 3. Qué significa en plata para la escalera de Baiking

### 3.1 Neto por pack según cómo se cobre

Mercado Pago al instante 7,61 %; a 14-18 días 4,10 %; a 30-35 días 2,17 % (30 días) a 1,80 % (35 días). En transferencia el descuento lo paga Baiking y no hay comisión (si es SRL/SA, restar además 0,6 % de impuesto al cheque). Las dos últimas columnas comparan la transferencia con 5 % (la configuración actual de `checkout.transferencia.descuento_pct`) contra Mercado Pago.

| Pack | Precio | MP al instante | MP 14-18 días | MP 30-35 días | Transf. 5 % off | Transf. 3 % off | 5 % off vs MP instante | 5 % off vs MP 14-18 d |
|---|---|---|---|---|---|---|---|---|
| 1 chance | $10.000 | $9.239 | $9.590 | $9.783 a $9.820 | $9.500 | $9.700 | +$261 | −$90 |
| 2 chances | $15.000 | $13.858 | $14.385 | $14.675 a $14.730 | $14.250 | $14.550 | +$392 | −$135 |
| 4 chances | $25.000 | $23.097 | $23.975 | $24.459 a $24.549 | $23.750 | $24.250 | +$653 | −$225 |
| 6 chances | $35.000 | $32.336 | $33.564 | $34.242 a $34.369 | $33.250 | $33.950 | +$914 | −$314 |
| 10 chances | $45.000 | $41.575 | $43.154 | $44.025 a $44.189 | $42.750 | $43.650 | +$1.175 | −$404 |
| 15 chances | $70.000 | $64.672 | $67.129 | $68.484 a $68.738 | $66.500 | $67.900 | +$1.828 | −$629 |
| 20 chances | $90.000 | $83.150 | $86.308 | $88.051 a $88.377 | $85.500 | $87.300 | +$2.350 | −$808 |
| 30 chances | $120.000 | $110.867 | $115.078 | $117.401 a $117.837 | $114.000 | $116.400 | +$3.133 | −$1.078 |
| 50 chances | $150.000 | $138.584 | $143.847 | $146.751 a $147.296 | $142.500 | $145.500 | +$3.916 | −$1.347 |
| 200 chances | $300.000 | $277.167 | $287.694 | $293.502 a $294.591 | $285.000 | $291.000 | +$7.833 | −$2.694 |

Lectura: el 5 % por transferencia solo le conviene a Baiking si Mercado Pago está configurado "al instante". Contra 14-18 días pierde entre $90 (pack de $10.000) y $2.694 (pack de $300.000) por orden; contra 30-35 días pierde entre $283 y $9.591. Con 3 % la transferencia vuelve a quedar arriba de Mercado Pago a 14-18 días (+$110 en el pack de $10.000, +$496 en el de $45.000, +$3.306 en el de $300.000), pero sigue abajo de Mercado Pago a 30-35 días.

### 3.2 Escenario general: 60 % paga con Mercado Pago y 40 % por transferencia

Costo total (comisión de Mercado Pago sobre el 60 % + descuento sobre el 40 %) por cada $1.000.000 vendido a precio de lista, comparado con cobrar el 100 % por Mercado Pago al mismo plazo. Entre paréntesis, cuánto se ahorra (+) o se pierde (−) por ofrecer la transferencia.

| Plazo de liberación de MP | 100 % Mercado Pago | 60/40, transferencia sin descuento | 60/40, 3 % off | 60/40, 5 % off (configuración actual) | 60/40, 10 % off |
|---|---|---|---|---|---|
| Al instante (7,61 %) | $76.109 | $45.665 (+$30.444) | $57.665 (+$18.444) | $65.665 (+$10.444) | $85.665 (−$9.556) |
| 14-18 días (4,10 %) | $41.019 | $24.611 (+$16.408) | $36.611 (+$4.408) | $44.611 (−$3.592) | $64.611 (−$23.592) |
| 30 días (2,17 %) | $21.659 | $12.995 (+$8.664) | $24.995 (−$3.336) | $32.995 (−$11.336) | $52.995 (−$31.336) |
| 35 días (1,80 %) | $18.029 | $10.817 (+$7.212) | $22.817 (−$4.788) | $30.817 (−$12.788) | $50.817 (−$32.788) |

Ajustes a esa tabla:
- Si Baiking es SRL/SA, restar ≈ $2.300 por cada $1.000.000 (0,6 % de impuesto al cheque sobre los ≈ $380.000-400.000 transferidos). Con 3 % off y MP a 14-18 días, el ahorro queda en ≈ $2.080; con 5 % la pérdida sube a ≈ $5.900.
- Si la transferencia se concilia con un proveedor tipo Talo (1 % + IVA sobre lo transferido), sin descuento: ahorra $25.604 (MP instante), $11.568 (14-18 días) o $2.372 (35 días); con 3 % off y MP a 14-18 días ya pierde $287. Es decir: el proveedor se paga solo si reemplaza el descuento, no si se suma.
- Lo que no está en la tabla y también cuenta: el tiempo de revisar 40 % de las órdenes a mano (con 300 órdenes son 120 comprobantes) y el riesgo de un comprobante falso aprobado (§5).

**Descuento neutro** (el que deja el mismo neto que cobrar todo por Mercado Pago):

| Plazo de MP | Transferencia directa (persona humana, caja de ahorro) | Directa, sociedad (0,6 % impuesto al cheque) | Con proveedor de CVU único (1 % + IVA) |
|---|---|---|---|
| Al instante | 7,61 % | 7,05 % | 6,48 % |
| 14-18 días | 4,10 % | 3,52 % | 2,93 % |
| 30 días | 2,17 % | 1,58 % | 0,97 % |
| 35 días | 1,80 % | 1,21 % | 0,60 % |

### 3.3 Efecto en el modelo de `docs/02` §3

`docs/02` §3 supone "comisiones + retenciones ≈ 8 %" con un ticket promedio de $26.500 y costos fijos de $3.250.000. Como las retenciones no son costo (§4), el 8 % es conservador. Recalculado con la escalera actual:

| Supuesto de comisión | Comisión por orden | Margen por orden | Punto de equilibrio |
|---|---|---|---|
| 8 % (lo que dice `docs/02`) | $2.120 | $24.380 | ≈ 133 órdenes (`docs/02` lo redondea a 135) |
| Mercado Pago al instante (7,61 %) | $2.017 | $24.483 | ≈ 133 |
| Mercado Pago 14-18 días (4,10 %) | $1.087 | $25.413 | ≈ 128 |
| Mercado Pago 30-35 días (2,17-1,80 %) | $574-478 | $25.926-26.022 | ≈ 125 |
| Transferencia conciliada, Talo (1,21 %) | $321 | $26.179 | ≈ 124 |
| 60 % MP 14-18 días + 40 % transferencia 5 % off | — | $25.318 | ≈ 128 |
| Idem con 3 % off | — | $25.530 | ≈ 127 |
| Idem sin descuento | — | $25.848 | ≈ 126 |

Dos cosas que en `docs/02` §3 quedaron viejas frente a esta investigación (no se reescribieron; se dejan anotadas acá): el "8 %" incluye retenciones que no son costo, y la frase "transferencia con 5 %: neto ≈ +$800 por orden" solo vale contra ese 8 % (o contra Mercado Pago al instante: +$692); contra Mercado Pago a 14-18 días la misma orden deja −$238.

Ahorro total por elegir bien el plazo, con el ticket de $26.500: pasar de "al instante" a 14-18 días ahorra $139.483 con 150 órdenes, $278.966 con 300 y $557.931 con 600; pasar de 14-18 a 35 días ahorra otros $91.385 / $182.770 / $365.541. Importa, pero importa menos que vender 20 órdenes más.

## 4. Retenciones e impuestos que aparecen al cobrar

Regla general: **las retenciones de Ingresos Brutos y las percepciones de IVA no son costos nuevos, son pagos a cuenta** de impuestos que Baiking debe de todos modos. Adelantan caja y, si la alícuota del padrón es más alta que el impuesto real, generan saldo a favor que hay que recuperar. La única excepción que sí es costo es el impuesto a los débitos y créditos.

| Concepto | Qué grava y quién retiene | Alícuota | Naturaleza | Si Baiking es monotributista (Régimen Simplificado de IIBB de PBA) | Si Baiking es Responsable Inscripto |
|---|---|---|---|---|---|
| **SIRTAC** (ARBA RN 28/22, desde 1/1/2023) | Cobros con tarjeta y por plataformas de pago (Mercado Pago checkout/link, Payway, Getnet); retiene la plataforma | Padrón mensual de la Comisión Arbitral: 0,01-5 % según actividad y riesgo fiscal; 3 % si no está inscripto y supera 10 operaciones y $200.000 | Pago a cuenta de IIBB (comercio minorista PBA 2026: 3,5 %; el curso como servicio de capacitación puede tener otra alícuota, **a verificar** código NAIIB) | Excluido | Aplica; se descuenta en la declaración mensual |
| **SIRCUPA** (ARBA RN 25/2025, desde 1/10/2025) | Acreditaciones en cuentas de pago (el CVU de Mercado Pago, Ualá, etc.); retiene el PSP. Excluye sueldos, préstamos y transferencias entre cuentas propias | 0,01-5 % por padrón | Pago a cuenta de IIBB | Excluido | Aplica |
| **SIRCREB** | Acreditaciones en cuentas bancarias (transferencias al CBU); retiene el banco | 0 % (cumplidor) a 5 % (alto riesgo); típico 0,3-2 % | Pago a cuenta de IIBB. Cobrar por transferencia no evita retenciones: cambia SIRTAC/SIRCUPA por SIRCREB | Excluido | Aplica |
| **IVA sobre la comisión** | La pasarela factura su comisión con IVA 21 % | 21 % de la comisión (≈ 0,7 puntos sobre 3,39 %) | Costo o crédito fiscal según régimen | **Costo** (por eso los "costos efectivos" de §2) | **Crédito fiscal**: el costo real es la comisión sin IVA (3,39 % a 14-18 días) |
| **Percepción de IVA sobre comisiones** (RG 5319, modificada por RG 5794/2025) | Mercado Pago a Responsables Inscriptos | 3 % de la comisión | Pago a cuenta de IVA | No aplica | Aplica (**a verificar** con el contador) |
| **Impuesto a los débitos y créditos** (Ley 25.413, "impuesto al cheque") | Cada acreditación y cada débito en cuentas corrientes de personas jurídicas; desde enero 2026 extendido a cuentas de pago/billeteras para los sujetos alcanzados, con marchas y contramarchas en septiembre 2026 (**a verificar**) | 0,6 % + 0,6 % | **Costo de caja.** Las micro y pequeñas empresas computan el 100 % como pago a cuenta de Ganancias (a verificar) | Exento: cajas de ahorro de personas humanas y transferencias entre monotributistas | Aplica si es SRL/SA: la "transferencia directa al CBU" cuesta ≈ 0,6 %, no 0 % |
| **Ingresos Brutos** (el impuesto en sí) | Ventas del curso y de los packs | 3,5 % general comercio minorista PBA 2026 (curso: a verificar) | Impuesto real | Cuota fija mensual del Régimen Simplificado | Declaración mensual, neta de SIRTAC/SIRCUPA/SIRCREB |

Qué cambia según el encuadre:
- **Monotributista dentro del Régimen Simplificado de PBA (Monotributo Unificado)**: paga un monto fijo mensual y queda afuera de SIRTAC, SIRCUPA y SIRCREB. El riesgo es otro: un pico de $5-20 millones en 7 semanas puede superar el tope de la categoría y sacarlo del monotributo (ARCA cruza billeteras con facturación, `docs/01` §4). Tema para el contador antes del 15/10.
- **Responsable Inscripto**: el IVA de la comisión se recupera, así que Mercado Pago a 14-18 días cuesta 3,39 % y no 4,10 %; a cambio sufre las tres retenciones (pago a cuenta, con posible saldo a favor) y la percepción del 3 %. Cómo se factura el curso con IVA (gravado o exento como servicio educativo) queda en la lista del contador de `docs/04` sección A: cambia el precio neto más que cualquier comisión.
- **Persona jurídica (SRL/SA)**: impuesto al cheque en toda acreditación bancaria y, según cómo termine la norma de 2026, también en la cuenta de Mercado Pago. Persona humana con caja de ahorro: no.
- Consultar en ARBA los padrones SIRTAC/SIRCUPA/SIRCREB del CUIT de Baiking para conocer la alícuota del mes (el padrón se actualiza mensualmente).
- Fuera de los cobros pero en el mismo presupuesto: el impuesto a los premios de la Ley 20.630 (31 % sobre el 90 %, responsable el organizador) daría ≈ $1.022.000 sobre una Siskiu T7 de $3.664.500 si alcanzara a esta promoción; `docs/01` §2.1 lo deja "a verificar con contador".

## 5. Riesgos por medio de cobro

| Medio | Riesgo | Lo que ya lo mitiga | Lo que falta |
|---|---|---|---|
| Mercado Pago | **Contracargo sin cobertura**: el Programa de Protección al Vendedor excluye servicios y productos digitales. El ítem es el curso (digital), así que un desconocimiento de compra se pierde salvo que Baiking pruebe la entrega | Se guardan DNI, mail y WhatsApp; el ítem se cobra como "Curso Baiking de Mantenimiento · Pack N" (`api/_lib/mercadopago.js`) | Registrar el acceso al curso por orden (fecha, mail) y facturar cada orden: son las pruebas que pide una disputa. Definir en las bases qué pasa con las chances de una orden con contracargo (se anulan) |
| Mercado Pago | **Suspensión de la cuenta** por "loterías o productos de azar" (actividad prohibida, `docs/01` §4). Cuanto más largo el plazo de liberación, más plata queda adentro si bloquean | Nombre del ítem sin mención al sorteo; lenguaje del sitio | Tener siempre un segundo canal vivo (la transferencia) y no concentrar toda la caja en un plazo de 30-35 días |
| Transferencia con comprobante | **Comprobante editado o de una transferencia que nunca se acreditó** (programada, rechazada, revertida, monto o destinatario cambiados con un editor de imágenes). Es la estafa más común en ventas por transferencia en Argentina | Código `BK-XXXXX` único por orden y monto exacto; la IA lee monto, cuenta destino, código, fecha y señales de edición y el panel muestra los chequeos; `TRANSFERENCIAS_AUTO_APROBAR=false` por defecto (`docs/03` §7) | Conciliar contra el banco (ver abajo). Rechazar desde el panel las órdenes que no acreditan en 48 h (`plazo_horas`): hoy no hay anulación automática |
| Transferencia | **Impuesto al cheque y SIRCREB** si se cobra en cuenta de una sociedad (§4) | — | Decidir con el contador en qué cuenta se cobra la campaña (idealmente una cuenta o CVU exclusivo: facilita el padrón para el escribano y la conciliación) |
| Cualquiera | **Ingresos sin factura**: ARCA cruza los movimientos de billeteras y bancos con la facturación (umbrales informativos 2026: $50 M por mes personas humanas / $30 M jurídicas en transferencias; superarlos no es sanción, pero un pico sin facturas dispara recategorización o exclusión del monotributo) | — | Facturación automática por orden (pendiente en `docs/04` sección A) |
| Cualquiera | **Fraude de terceros que suplantan a Baiking**: cuentas falsas de Instagram que escriben a los seguidores "ganaste, pagá el envío" o piden datos de tarjeta (caso de la fábrica Tomaselli; la UFECI reporta aumento de denuncias) | — | Publicar el aviso de abajo en la landing, en las bases, en el mail de confirmación y en un highlight de Instagram |

**Por qué la IA no alcanza sola.** La lectura automática (`api/_lib/comprobante.js`) devuelve lo que el comprobante dice, no lo que pasó en el banco: una imagen bien editada pasa todos los chequeos, y un comprobante real de una transferencia programada o rechazada también. Las "señales de edición" son un indicio, no una prueba. La única confirmación válida es la acreditación en la cuenta de Baiking, y hay dos formas de tenerla:

1. **Hoy (manual, 10-20 segundos por orden)**: con la orden `en_revision` en el panel, buscar el código `BK-XXXXX` o el monto exacto en el home banking y recién ahí apretar "Aprobar". Nunca prender `TRANSFERENCIAS_AUTO_APROBAR` con este esquema.
2. **Después (automático)**: un CVU o alias único por orden (Talo) o una cuenta recaudadora con webhook de acreditación (Pronto Pago, Pagos360): el proveedor avisa cuando la plata entró y la orden pasa a `pagada` sola, igual que con el webhook de Mercado Pago. Con eso sí se puede aprobar sin mirar. Alternativa barata mientras tanto: hacer único el monto de cada orden (por ejemplo, sumar unos pesos distintos por orden) para que el extracto se concilie de un vistazo; hoy `api/checkout.js` redondea el monto a pesos enteros.

**Texto de aviso sugerido** (landing, bases, mail y highlight "Sorteo"):

> Baiking nunca te va a pedir plata, datos de tarjeta ni claves por mensaje directo. La única cuenta oficial es @baikingtiendadebicis (fijate el nombre exacto). El resultado se anuncia en vivo el viernes 4/12 a las 21:00 y queda publicado en el sitio; a la persona ganadora la contactamos por teléfono y por mail con los datos que dejó al inscribirse, y la bici se entrega sin ningún costo. Si otra cuenta te escribe diciendo que ganaste, no respondas y avisanos por WhatsApp al 11 5728-0056. Las estafas por sorteos falsos se denuncian en la UFECI (011-5071-0040).

## 6. Cómo lo hacen en otros países

| País | Modelo legal | Requisitos | Costo (tasa, fianza, impuesto) | Qué copia Baiking |
|---|---|---|---|---|
| **Reino Unido** | Legal por diseño: una "prize competition" o "free draw" paga no es lotería si hay ruta gratuita (carta por correo ordinario, "no menos conveniente", publicitada, con la misma chance por entrada) o una prueba de habilidad genuina (Gambling Act 2005 s.14 y Sch. 2). Mercado de ≈ £1.300 M por año; la Gambling Commission derivó 93 denuncias entre ago-2024 y abr-2025 | Sin licencia. Código voluntario DCMS (plazo 20/05/2026, 150+ operadores): 18+, reglas y probabilidad informadas, resultado "aleatorio y auditable". CAP Code 8.17: condiciones significativas en la pieza y ruta gratuita "clara y prominente" (la ASA rechazó tenerla "a un click") | Ninguno; el ganador no paga impuesto | Paridad y visibilidad de la ruta gratuita; sorteo en vivo con generador aleatorio y "sin prórrogas aunque no se venda todo"; 18+ y tope de entradas por persona |
| **Estados Unidos** | Sweepstakes: premio + azar sin "consideración" gracias al AMOE de igual dignidad ("NO PURCHASE NECESSARY. A purchase will not increase your chances of winning"); un tribunal federal desestimó la acusación contra Omaze porque el AMOE era adecuado | Registro y fianza en Nueva York (premios > USD 5.000, 30 días antes, USD 100) y Florida (> USD 5.000, 7 días antes, bond o fideicomiso, lista de ganadores en 60 días); Rhode Island retail > USD 500 | Bond por el valor del premio en NY/FL; el ganador tributa renta (1099-MISC, umbral USD 2.000 desde 2026) | AMOE documentado con los estándares de allá; exclusión de jurisdicciones caras (Competitive Cyclist excluye FL/NY/RI); lista y video de ganadores |
| **España** | "Combinación aleatoria con fines publicitarios": legal sin autorización si la única contraprestación es el consumo del producto **sin sobreprecio** (Ley 13/2011; Ley 25/2009). Vender papeletas es rifa: autorización DGOJ/CCAA y multas de €100.000 a €1 M | Bases ante notario (Archivo Ábaco); cláusula "la participación es un regalo por la compra y no tiene coste adicional" | Tasa del 10 % sobre el valor de mercado de los premios (modelo 685); ingreso a cuenta IRPF 19 % (en especie: coste + 20 %) | La regla del "sin sobreprecio": los packs tienen que valer por el producto; la cláusula de "bonificación por la compra" |
| **Brasil** | "Compre e concorra" = modalidad *sorteio* de la Lei 5.768/71: autorización previa de la SPA/MF (ex SECAP) por el sistema SCPC | Solo personas jurídicas al día; series de hasta 100.000 números definidos con la Loteria Federal; **número de certificado en toda pieza**; reglamento online toda la vigencia; ganador publicado en 30 días | Taxa de autorização por franja de premios (Decreto 12.307/2024); IRRF 20 % sobre el premio a cargo del promotor; multa de hasta el 100 % de los premios e inhabilitación 2-3 años | "Números de la suerte" visibles (Baiking ya asigna números correlativos); ficha legal en cada pieza (equivalente: escribano + acta); publicar el ganador en 30 días |
| **México** | Todo sorteo requiere permiso de SEGOB (Ley Federal de Juegos y Sorteos 1947); "sorteo sin venta de boletos" = la participación se obtiene gratis al comprar (exactamente el modelo "comprá y participá") | Solicitud 20 días hábiles antes (10 según despachos, a verificar), fianza por los premios, número de permiso en bases y publicidad, interventor y finiquito | Aprovechamientos como % del valor de los premios (tabla 2024/2025, a verificar); ISR 1 % retenido por el organizador | Número de permiso visible → la "ficha legal"; la mecánica "por cada compra de $X, un boleto" para una edición futura de tienda física |
| **Chile** | Zona gris parecida a la argentina: no hay régimen para promociones comerciales; las rifas con venta de números están reservadas a beneficencia, bomberos y clubes (Ley 10.262 + DS 955/1974) y el Código Penal (arts. 275-276) castiga las loterías no autorizadas | Bases protocolizadas ante notario; Ley 19.496 arts. 35-36: informar bases, cantidad de premios y plazo, y **difundir los resultados** (SERNAC: depositar en notaría no basta) | Notario; sin tasa específica; tributación del ganador según SII (a verificar) | Difundir resultados activamente; bases por campaña con número de edición; cerrar las landings viejas |
| **Uruguay** | Prohibido dar premios a consumidores salvo autorización (Ley 12.367 art. 64; Decreto 349/999) | MEF – Defensa del Consumidor 20 días antes; premios nunca en dinero; aviso a la Dirección Nacional de Loterías 5 días antes; **escribano obligatorio**; plazo de retiro del premio ≥ 60 días | Montevideo, premios > 100 UR: 5 % del valor de los premios (IVA incluido) + garantía del 20 %; IRPF 12 % sobre premios de azar (aplicación a promos a verificar) | Escribano como estándar; plazo de retiro del premio en las bases; premio nunca canjeable por dinero |
| **Colombia** | "Juego promocional" (Ley 643/2001, Decretos 2104/2016 y 1486/2024): autorización previa de Coljuegos | Solicitud ≥ 10 días antes; póliza por el 100 % de los premios; facturas de compra de los premios; premio ≤ 160 SMMLV; Coljuegos abrió 35 procesos a influencers y pidió a Meta suspender 289 cuentas | Derechos de explotación 14 % + 1 % del plan de premios; retención 20 % si el premio supera 48 UVT (≈ COP 2,51 M) | Premio comprado y facturado antes de lanzar; tomar en serio el riesgo de baja de cuentas en redes (acá, convenio ALEA–Meta) |
| **Argentina** (referencia) | Prohibido condicionar la participación a la compra (DNU 274/2019 art. 14); vender chances es captación de juego de azar (art. 301 bis CP) | Vía gratuita con igual probabilidad; leyenda "Sin obligación de compra"; regímenes provinciales de autorización (CABA, Mendoza, Neuquén, Río Negro, Salta) | Ley 20.630 sobre el premio (a verificar); Mendoza 7 % del valor de los premios; arancel LOTBA | — |

### 6.1 Ocho prácticas para importar

1. **Ruta gratuita "de igual dignidad"** (UK: "no menos conveniente" y misma chance por entrada; US: AMOE; Omaze da por la vía gratuita el máximo de entradas; Elite Competitions acepta postales "hasta el máximo"; Mike's Bikes limita a 1 por persona). Para Baiking: formulario online (nunca solo postal), misma fecha de cierre, mismo mail con número que a los compradores, sin exigir suscripción a marketing como condición. Queda para el abogado si, con "igual probabilidad" del art. 14, alcanza 1 chance gratuita por DNI frente a packs de hasta 200 (`docs/02` §3 lo trata como sensibilidad económica; acá aparece como riesgo legal).
2. **Leyenda tipo "NO PURCHASE NECESSARY"** adaptada: "Sin obligación de compra. Cada chance, gratuita o bonificada por una compra, tiene exactamente la misma probabilidad". Ya está en `participacion_gratuita.texto`; falta repetirla en cada pieza.
3. **Sorteo en vivo con azar verificable y padrón congelado** (UK: generador aleatorio en Facebook Live y sin prórrogas; Brasil y Colombia: lotería oficial como fuente de azar; código DCMS: resultados "aleatorios y auditables"). Publicar antes del vivo la cantidad de chances y un hash del padrón, usar en `sorteo.html` una semilla pública o un esquema de compromiso, que el escribano firme, y dejar escrito en las bases que **el sorteo se hace el 4/12 pase lo que pase con las ventas**.
4. **Publicación de ganadores con plazo** (Brasil: nombre y número en 30 días; Florida: lista en 60 días; Petersen: nombre y provincia el mismo día): nombre, localidad y número, con consentimiento, más el video del vivo y el acta descargable.
5. **Exclusiones territoriales explícitas** (Competitive Cyclist excluye FL/NY/RI para no registrarse; Renault excluyó 5 provincias en 2021; Tienda Galicia, 8): en la cláusula 2 de las bases, salvo que el abogado habilite el trámite en LOTBA.
6. **Premio garantizado antes de lanzar** (bond en NY/FL, póliza 100 % en Colombia, fianza en México, garantía 20 % en Uruguay): comprar o reservar las dos Polygon con factura del importador, mostrarlas en la tienda y decir en las bases "premio adquirido y en depósito en Baiking".
7. **"Ficha legal" en cada pieza, no solo en el footer** (número de certificado/permiso/resolución obligatorio en Brasil, México y Colombia; CAP Code: condiciones significativas en la pieza): en cada post, story y mail: "Sin obligación de compra · Participá gratis en [link] · Bases en [link] · Escribano [nombre y matrícula] · Sorteo en vivo 4/12 21:00 · Inscripción hasta 3/12 23:59 · Mayores de 18, residentes en Argentina (excl. …) · No patrocinado por Instagram/Meta". Nunca "link en bio" como único acceso a la vía gratuita.
8. **18+ verificado, tope de participaciones por persona y presupuesto para el impuesto al premio** (código DCMS; Brasil 20 %, Colombia 20 %, España 19 %, México 1 %): un tope (por ejemplo, 2 packs por DNI) hace que la promo nunca parezca un juego; y las bases deben decir qué costos asume Baiking (impuestos, armado, entrega) en vez de copiar la cláusula estadounidense "taxes are the sole responsibility of the winner", porque acá el responsable de la Ley 20.630 es el organizador.

### 6.2 Tres cosas que no sirven en Argentina

1. **La "pregunta de habilidad" británica.** Allá solo saca del régimen de lotería si "impide participar o ganar a una proporción significativa" y la Commission pide evidencia; acá el art. 14 del DNU 274 también prohíbe concursos condicionados a la compra, así que no elimina ni el azar ni el condicionamiento. Solo suma fricción.
2. **Vender entradas o "tickets" abiertamente** (UK, US, Raffall con 10 % de comisión, rifas mexicanas con boletos, Rifalo acá): es exactamente el art. 301 bis. Tampoco sirve la "alternativa en efectivo" al premio que ofrecen los operadores británicos: acerca la promo a una rifa por dinero (Uruguay directamente la prohíbe).
3. **La vía gratuita solo postal** (estándar en UK y US): en Argentina la vía gratuita tiene que ser tan conveniente como la compra, y el formulario online ya existe. Lo mismo con las herramientas extranjeras de "official rules" (Gleam, Woobox, ViralSweep, Easypromos): ninguna cubre Lealtad Comercial ni reemplaza al escribano.

## 7. Benchmarks

### 7.1 Argentina

| Caso | Mecánica | Qué toma Baiking |
|---|---|---|
| **Renault "Mi Renault" 2021** (45 bicis Venzo) | Compra o service ≥ $10.000 en talleres oficiales (25/6-25/8/2021), doble chance a miembros del programa, **sorteo ante escribano** el 1/9, ganadores publicados en la web, excluidas Tierra del Fuego, Río Negro, Neuquén, Mendoza y Salta. Vía gratuita: no aparece en los extractos (a verificar) | La plantilla local de "compra + escribano + ganadores publicados + provincias excluidas" |
| **Fundaciones Grupo Petersen 2023/2024** (Olmo Wish 290 y otra bici) | Sorteo gratuito de una semana en Instagram, "sin obligación de compra", mayores de 18; ganador anunciado el mismo día a las 17:00 con nombre y provincia. Escribano: no se menciona (a verificar) | Campaña corta e intensa; publicar nombre y localidad el mismo día |
| **Tienda Galicia (julio 2025) y BBVA "Sorteo mágico"** | Compra o vía gratuita mandando por mail un dibujo a mano del logo (+ DNI); Galicia excluye 8 provincias | La vía gratuita "con esfuerzo mínimo pero real"; el peso del régimen provincial |
| **Renault Storyadores 2022** | Seguir + comentar con una historia; "una chance por comentario"; la 3ª edición se definió por votos | Qué no hacer: chances por comentario (spam y desigualdad frente a la vía gratuita) |
| **Topmega, Canaglia, Bici Peretti/APAT, La Perseverancia** | Sorteos gratuitos en redes o eventos; La Perseverancia premia "bici + casco + seguro + voucher" | Co-branding con el importador (pedirle a Polygon Bikes Argentina un repost o un 2° premio); un premio secundario "bici + service + voucher" si se agrega en una edición futura |
| **Autoloop y clones** (Garage1, VIP Motors, Rodar Club) | Packs de 10 a 100 "chances" del mismo PDF; número de orden de Tienda Nube × chances; sorteo en vivo por YouTube un viernes a las 22:00 con cierre a las 17:00; **sin vía gratuita ni leyenda**; cobro por transferencia con comprobante por WhatsApp (VIP Motors) | Solo la claridad de la landing, la confirmación automática y el vivo. No copiar la ausencia de vía gratuita ni el cobro "pasame el comprobante" |
| **"DE TODO ARGENTINA, tus compras tienen premios"** | Solo con compras de $1,5 M a $4 M; sorteo por Lotería Nacional con los últimos dígitos del DNI, publicado en un link de AppSorteos | El link público del resultado, nada más |
| **Tomaselli (fábrica de bicis)** | Sorteos gratuitos en Instagram; aparecieron cuentas falsas que avisaban "ganaste" y pedían plata por el envío | El aviso de §5 y un único canal oficial de contacto |
| **Bicivilizados + KeruzaBikes** | Sorteo transmitido por YouTube con AppSorteos | Duplicar el sorteo con un certificado público de terceros, a costo cero |

Ninguna bicicletería argentina (Bike Point, Fusion, Sitio Bike, Reguera, Canaglia, Polygon AR, Raleigh, Trek, Specialized) tiene indexada una promo "comprá y participá" con bases públicas: Baiking sería la primera del rubro en hacerlo en regla, y eso es un argumento de comunicación ("con escribano y sin obligación de compra").

### 7.2 Afuera (bicis)

| Caso | Mecánica | Qué toma Baiking |
|---|---|---|
| **Fabex Bike, Brasil** (Oggi Hacker Sport 29") | 1 cupón cada R$ 200 de compra, en local u online | Proporcionalidad simple y comunicable: "≈ 1 chance cada $X de compra" para una edición de tienda física |
| **Politintas "Vai de Bike Elétrica", Brasil** (11 e-bikes, R$ 6.300 cada una) | 11 sorteos mensuales en la tienda con certificado SPA, ganador de cada mes publicado en el blog, entrega en 30 días | Ganadores e hitos como contenido recurrente; plazo de entrega fijado en las bases |
| **Neoenergia + Salvador Shopping y "Você de Moto Bike Elétrica", Brasil** | "Números de la suerte" en la app y certificado SPA/ME en toda pieza | Números visibles y ficha legal en cada pieza |
| **Watts y Trailstore, Chile** | Bases protocolizadas ante notario; Trailstore dejó la landing de 2020 online sin marcar que terminó | Bases por campaña; cerrar la landing al terminar |
| **Mike's Bikes "La Vuelta Giveaway", EE. UU.** | 1 entrada por cada Cervélo comprada + AMOE por postal (1 por persona) | El caso más parecido a Baiking: compra real = participaciones + vía gratuita con límite por persona |
| **Competitive Cyclist "Dream Bike", EE. UU.** (bici hasta USD 15.000) | "No purchase necessary"; excluye FL, NY y RI | Exclusión explícita de jurisdicciones con trámite |
| **Gravity Giveaways y WGT Competitions, UK** | Bicis de MTB y eléctricas; ruta postal; sorteo en vivo por Instagram | El vivo como evento; la ruta gratuita publicada con dirección concreta |
| **Hummi Bikes, Biocycle, Estrella Galicia + Velca, Iberdrola, España** | Compra o registro → bases ante notario → sorteo → ganador publicado | Estándar "notario + ganador publicado" (acá: escribano) |

### 7.3 Herramientas

Para el sorteo: AppSorteos (sorteo de lista de nombres gratis e ilimitado, certificado con URL pública que el organizador no puede editar; planes USD 9/19/49 por mes para sorteos por comentarios), Sortea2 (certificado € 2,99), Random.org Third-Party Draw Service (USD 4,95 hasta 500 participantes, registro público ≥ 5 años; tramos mayores a verificar). Rifalo (5 % + Mercado Pago) es una plataforma de rifas para escuelas y clubes: no aplica a un comercio y encuadra la operación como rifa. Para Baiking, el equivalente del "certificado" es escribano + `sorteo.html` + acta publicada, y un certificado público de AppSorteos o Random.org como duplicado auditable. Escribano: aranceles provinciales (guías 2026: $5.000 a $30.000 y más por acta); el presupuesto de $100.000 de `docs/02` es prudente, cotizar en el Colegio de Escribanos de PBA, delegación Pilar. Para vender desde Tienda Nube (modo `externo`): apps de entrega digital (Envíos Digitales, Academi, Dijital) y webhook `order/paid` firmado con HMAC-SHA256 que encaja con `confirmarOrden()`; precios de las apps y comisión por venta del plan, a verificar.

## 8. Recomendación final para Baiking

**Medios a ofrecer en el sitio, en este orden en el selector del modal** (hoy Mercado Pago aparece primero y marcado, y la transferencia segunda con la etiqueta del descuento: mantener ese orden):

1. **Mercado Pago Checkout Pro** (modo `api`, ya implementado): tarjeta de crédito, débito y dinero en cuenta. Es la marca que el comprador de Instagram conoce, asigna las chances por webhook y va a facturar solo. Texto sugerido bajo la opción: "Tarjeta de crédito, débito o dinero en cuenta. Cuotas con interés. Confirmación al instante".
2. **Transferencia bancaria**: "3 % de descuento. Te confirmamos en menos de 48 h, cuando vemos acreditada la transferencia". El copy actual dice "Sin comisiones · Recibís factura al acreditarse la transferencia" y la FAQ "¿Qué medios de pago aceptan?" solo menciona Mercado Pago: ajustar cuando se habilite (los edita otro equipo).
3. **Cuenta DNI Comercios (QR)**: solo en el taller y para quien pregunta por WhatsApp; no va en el selector porque no tiene API. Adherir ahora para aprovechar los meses bonificados. Quien paga en el taller igual se inscribe en el sitio eligiendo "Transferencia" (así queda la orden con su código) y se aprueba desde el panel una vez cobrado; el panel no crea órdenes a mano.
4. **DEBIN, Getnet, Payway, Mobbex**: no para esta edición. Solo tienen sentido si Mercado Pago bloquea la cuenta o si Baiking ya opera con alguno.

**Descuento por transferencia**: sí, pero **3 %** (bajar `checkout.transferencia.descuento_pct` de 5 a 3), o 0 % si Gastón prefiere menos trabajo de revisión. Números con un mix 60/40 y Mercado Pago a 14-18 días: con 3 % Baiking ahorra $4.408 por cada $1.000.000 (≈ $2.080 si es sociedad); con 5 % pierde $3.592 (≈ $5.900 si es sociedad); sin descuento ahorra $16.408 pero muchos menos clientes eligen transferir. El 5 % solo cierra si Mercado Pago queda "al instante" (ahorra $10.444 por millón), y eso cuesta más que lo que el descuento devuelve. Aunque el número sea chico, la transferencia vale la pena como segundo canal: no tiene contracargos y mantiene la campaña viva si Mercado Pago retiene fondos.

**Plazo de liberación de Mercado Pago**: **14-18 días** (verificar en "Costos y cuotas" cuál de los dos esquemas muestra la cuenta y elegir el escalón de 3,39 %). Es 3,5 puntos más barato que "al instante" y la caja no se resiente: las bicis ya están en stock y el premio se entrega en diciembre. 30-35 días ahorra otros 2 puntos (≈ $183.000 con 300 órdenes) pero deja hasta cinco semanas de ventas adentro de Mercado Pago, que puede retenerlas si decide que la actividad "huele a azar"; solo si Gastón acepta ese riesgo. Si al cerrar el 3/12 hiciera falta caja, se puede pasar a "al instante" por unos días.

**Cuotas**: habilitadas, **con interés a cargo del cliente** (es el comportamiento por defecto de Checkout Pro; `api/_lib/mercadopago.js` no fuerza cuotas sin interés). No absorber ninguna cuota sin interés: 3 cuotas absorbidas sobre el pack de $45.000 cuestan $8.647 (19,2 % en total, a verificar) y dejan $36.353; 6 cuotas, $12.622. Si más adelante se quiere un gancho para los packs de $120.000 en adelante, que sea con el costo ya metido en el precio.

**Conciliación de transferencias**: `TRANSFERENCIAS_AUTO_APROBAR=false`. Circuito: orden `pendiente` con código `BK-XXXXX` y monto exacto → comprobante subido o mandado a `pagos@…` → lectura por IA y chequeos en el panel → **buscar el código o el monto en el home banking** → "Aprobar" (asigna las chances y manda el curso) o "Rechazar" a las 48 h sin acreditación. Nunca reservar chances para órdenes impagas. Si las transferencias superan las 20-30 por día o la revisión se vuelve un cuello de botella, integrar un proveedor con CVU único por orden (Talo, 0,8-1 % + IVA; cotización pendiente) y recién entonces prender la aprobación automática. Cuenta o CVU exclusivo para la campaña, y una factura por cada orden.

**Qué preguntarle al contador** (antes del 15/10): RI o monotributo para esta campaña, con el pico de $5-20 M en 7 semanas; si aplica el Régimen Simplificado de IIBB de PBA (sin retenciones); alícuota de IIBB del curso (servicio) versus productos (comercio) y código de actividad; tratamiento de IVA del curso; impuesto al cheque según tipo societario y si alcanza a la cuenta de Mercado Pago en 2026; percepción de IVA del 3 % sobre comisiones; en qué cuenta cobrar (persona humana, sociedad, CVU exclusivo); Ley 20.630 sobre el premio; facturación automática por orden.

**Qué preguntarle al abogado**: si 1 chance gratuita por DNI cumple "igual probabilidad" frente a packs de hasta 200 chances, o hace falta otra regla (por ejemplo, tope de packs por DNI o más chances gratuitas); la cláusula de contracargo (chances anuladas si el pago se revierte); si conviene un tope de packs por persona; redacción del aviso antifraude en las bases; exclusiones territoriales; y la escalera de precios en sí (`docs/02` §2: un precio que sube solo por la cantidad de chances del mismo curso es lo que Entre Ríos calificó de rifa encubierta en 2022; España lo llamaría "sobreprecio").

**Decisiones para Gastón** (las mismas cinco del resumen):

1. **Plazo de liberación de Mercado Pago**: 14-18 días (propuesta) · 30-35 días · al instante. Verificar el esquema real en la cuenta.
2. **Transferencia**: ofrecerla con 3 % (propuesta) · sin descuento · no ofrecerla. El 5 % actual queda descartado con Mercado Pago a 14-18 días.
3. **Conciliación**: revisión manual contra el extracto con `TRANSFERENCIAS_AUTO_APROBAR=false` (propuesta para la primera edición) · proveedor con CVU único por orden y aprobación automática.
4. **Cuotas**: solo con interés a cargo del cliente (propuesta) · alguna cuota sin interés absorbida en los packs grandes con el costo dentro del precio.
5. **Encuadre fiscal y cuenta de cobro**: definir con el contador RI o monotributo, tipo de cuenta (persona humana o sociedad; impuesto al cheque), cuenta o CVU exclusivo para la campaña y adhesión a Cuenta DNI Comercios para el taller.

## 9. Fuentes

Todas consultadas por extractos de buscador el 28/9/2026 (las páginas estaban bloqueadas desde el entorno de trabajo). Se listan las más relevantes de los tres relevamientos.

**Mercado Pago (costos, cuotas, protección, impuestos)**
- https://www.mercadopago.com.ar/ayuda/cuanto-cuesta-recibir-pagos_33392
- https://www.mercadopago.com.ar/ayuda/comision-recibir-pagos_220
- https://www.mercadopago.com.ar/herramientas-para-vender/link-de-pago
- https://www.mercadopago.com.ar/ayuda/cuotas-sin-interes_3299
- https://www.mercadopago.com.ar/ayuda/294 (Protección al Vendedor)
- https://www.mercadopago.com.ar/ayuda/18561 (SIRTAC)
- https://www.mercadopago.com.ar/ayuda/impuesto-sobre-los-creditos-y-debitos_28158
- https://vendedores.mercadolibre.com.ar/nota/costos-de-mercado-pago-cuales-son-y-como-configurarlos
- https://vendedores.mercadolibre.com.ar/nota/iva-y-ganancias-para-responsables-inscriptos-en-mercado-pago
- https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026
- https://dptiendaonline.com/calculadora-cuotas-sin-interes-mercado-pago/
- https://fortunaweb.com.ar/blog/cuanto-cobran-realmente-las-pasarelas-de-pago-por-vender-online
- https://www.infobae.com/economia/2026/09/24/el-banco-central-confirmo-que-mercado-libre-tendra-licencia-para-operar-como-banco-antes-de-fin-de-ano/

**Otras pasarelas y medios**
- https://www.tiendanube.com/blog/pago-nube-costos/
- https://ayuda.tiendanube.com/es_AR/pago-nube-2/cuales-son-las-comisiones-de-pago-nube
- https://ayuda.tiendanube.com/preguntas-frecuentes-pago-nube/como-funcionan-los-pagos-con-transferencia-bancaria-en-pago-nube
- https://www.getnet.com.ar/beneficios/promociones-para-tus-clientes/comisiones-por-ventas
- https://ayuda.payway.com.ar/cobros/plazos-acreditacion-y-comisiones
- https://mariovadillo.com.ar/naranja-x-nuevas-comisiones-julio-2026/
- https://www.ualabis.com.ar/link-de-pago
- https://www.comparapasarelas.com/mobbex-comisiones
- https://www.modo.com.ar/comercios
- https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniComerciosFaq/
- https://www.bancoprovincia.com.ar/Noticias/Prensa/cuenta-dni-comercios-incorporo-el-link-de-pago-901
- https://www.pagos360.com/

**Transferencias, QR interoperable, DEBIN y conciliación automática**
- https://www.bcra.gob.ar/en/transfers-3-0/
- https://www.bcra.gob.ar/noticias/uno-de-cada-cuatro-pagos-con-transferencia-se-inicia-a-traves-del-codigo-qr/
- https://www.iprofesional.com/tecnologia/465317-pagos-qr-crecen-fuerte-argentina-tarjetas-pierden-terreno-septiembre-2026
- https://www.baenegocios.com/economia-finanzas/Bancos-podran-cobrar-comision-en-operaciones-con-DEBIN-y-PEI-20180103-0086.html
- https://www.bbva.com.ar/empresas/productos/cobros-pagos/cobros/DEBIN.html
- https://www.redcame.org.ar/novedades/14114/compras-en-cuotas-con-tarjetas-de-debito-se-habilito-el-pago-a-traves-del-debin-programado
- https://talo.com.ar/blogs/comisiones-pasarelas-de-pago
- https://talo.com.ar/blogs/mercado-pago-vs-transferencias
- https://talo.com.ar/blogs/descuento-por-transferencia-ecommerce
- https://docs.talo.com.ar/
- https://www.infobae.com/economia/networking/2026/03/30/pronto-pago-implementa-un-sistema-para-agilizar-y-conciliar-cobranzas-en-empresas-a-traves-de-cvu/
- https://prometeoapi.com/pago-transferencia

**Retenciones e impuestos**
- https://www.argentina.gob.ar/economia/politicatributaria/armonizacion/sirtac
- https://www.arba.gov.ar/Intranet/Legislacion/Normas/Resoluciones/2022/Res028-22.pdf
- https://contablix.ar/blog/sircupa-retencion-ingresos-brutos-billetera
- https://contablix.ar/blog/retenciones-percepciones-ecommerce-argentina-2026
- https://chequeado.com/el-explicador/preguntas-y-respuestas-sobre-la-nueva-retencion-de-ingresos-brutos-que-arba-aplicara-sobre-transferencias-a-billeteras-virtuales/
- https://www.iprofesional.com/impuestos/441901-ingresos-brutos-y-debitos-como-funcionan-las-retenciones-al-cobrar-con-mercado-pago
- https://yo-facturo.com/blog/sircreb-por-provincia-comparativa/
- https://yo-facturo.com/blog/arba-alicuotas-ingresos-brutos-2026/
- https://www.arba.gov.ar/IBSimplificado/IBS/
- https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf
- https://www.cronista.com/economia-politica/arca-definio-cambios-en-la-liquidacion-del-impuesto-al-cheque-todas-las-modificaciones-y-a-quienes-afecta/
- https://www.lanacion.com.ar/economia/dan-marcha-atras-con-una-norma-para-que-deje-de-caer-la-recaudacion-del-impuesto-al-cheque-nid14092026/
- https://www.cronista.com/economia-politica/transferencias-a-partir-de-que-monto-informa-mercado-pago-tus-movimientos-a-arca-en-2026/

**Mercado de pagos**
- https://cace.org.ar/pages/estadisticas
- https://www.iproup.com/economia-digital/70951-tarjeta-credito-cayo-e-commerce-cuotas-clave-no-perder-ventas-agosto-2026

**Pagos en otros países**
- https://www.stoqui.com.br/blog/pix-para-lojistas
- https://mindconsulting.com.br/2026/07/gateways-pagamento-online-brasil-comparativo-2026/
- https://www.khipu.com/en-us/
- https://www.milaecommerce.com/medios-de-pago-ecommerce-chile
- https://feebreaker.com/blog/stripe-vs-paypal-fees-2026
- https://stripe.com/resources/more/bizum-for-buisinesses-spain
- https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf

**Regulación de promociones por país**
- Reino Unido: https://cms.law/en/gbr/legal-updates/prize-competitions-and-free-draws-new-guidance-1 · https://www.pinsentmasons.com/out-law/guides/running-a-competition · https://www.gamblingcommission.gov.uk/about-us/freedomofinformation/prize-competitions-or-promotional-competitions · https://www.asa.org.uk/advice-online/promotional-marketing-free-entry-routes.html · https://www.mishcon.com/news/government-publishes-voluntary-code-of-good-practice-for-prize-draw-operators · https://elitecompetitions.co.uk/tnc · https://7daysperformance.co.uk/ · https://gravitygiveaways.co.uk/
- Estados Unidos: https://www.viralsweep.com/blog/no-purchase-necessary · https://www.beeliked.com/beelegal/amoe-sweepstakes-requirements-state-by-state-us-guide · https://www.fdacs.gov/Business-Services/Game-Promotions-Sweepstakes · https://codes.findlaw.com/ny/general-business-law/gbs-sect-369-e/ · https://www.ifrahlaw.com/ftc-beat/federal-court-dismisses-illegal-lottery-claims-against-omaze-emphasizing-adequacy-of-fundraisers-alternative-means-of-sweepstakes-entry/ · https://mikesbikes.com/pages/giveaway-rules-terms · https://www.competitivecyclist.com/info/bike-giveaway-official-rules
- España: https://www.boe.es/buscar/act.php?id=BOE-A-2011-9280 · https://dpej.rae.es/lema/combinaciones-aleatorias-con-fines-publicitarios · https://www.pwc.es/es/newlaw-pulse/entretenimiento-medios/rifas-ocasionales-espana-negocio-redondo-caro.html · https://sede.agenciatributaria.gob.es/Sede/Ayuda/17Presentacion/100/8_2_6_1_1.shtml · https://www.avezalia.es/bases-legales-ante-notario-y-requisitos-legales-de-los-concursos/
- Brasil: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/promocao-comercial · https://www.mattosfilho.com.br/unico/promocoes-comerciais-pontos-de-atencao/ · https://fasadv.com.br/pt/bra/publication/atualizacao-dos-valores-da-taxa-de-autorizacao-para-as-promocoes-comerciais · https://sorteza.com.br/guia-promocao-comercial-sorteio-legal-2025/
- México: https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf · https://www.gob.mx/segob/acciones-y-programas/requisitos-para-sorteos · http://www.sitios.segob.gob.mx/es/Juegos_y_Sorteos/Sorteos_sin_venta_de_boletos_ · https://wwwmat.sat.gob.mx/articulo/38032/articulo-138
- Chile: https://www.chileatiende.gob.cl/fichas/3760-autorizacion-para-realizar-rifas-sorteos-colectas-publicas · https://www.sernac.cl/portal/609/w3-propertyvalue-58796.html · https://www.theclinic.cl/2022/04/28/os-populares-sorteos-de-propiedades-en-el-limbo-de-lo-legal/ · https://www.watts.cl/docs/default-source/default-document-library/bases-de-concurso-bicicleta.pdf?sfvrsn=2
- Uruguay: https://www.impo.com.uy/bases/decretos/349-1999 · https://www.gub.uy/tramites/solicitud-autorizacion-sorteos-promocionales-presentados-empresas · https://tramites.montevideo.gub.uy/tramites-y-tributos/autorizacion/realizar-sorteos-y-promociones-para-premios-superiores-a-100-ur
- Colombia: https://www.coljuegos.gov.co/publicaciones/promocionales__pub · https://www.coljuegos.gov.co/publicaciones/307041/coljuegos-investiga-35-influenciadores-y-empresas-por-presunta-operacion-ilegal-de-rifas-y-promocionales-en-redes-sociales/ · https://mslegal.com.co/juegos-promocionales-requisitos-legales-colombia/ · https://www.asoviconal.com/terminos-sorteo

**Benchmarks argentinos**
- https://motormagazine.com.ar/sos-cliente-de-renault-participa-del-sorteo-por-una-bicicleta-venzo/
- https://www.inforeg.com.ar/renault-sorteara-45-bicicletas-venzo-entre-sus-clientes/
- https://www.fundacionesgrupopetersen.com.ar/sorteo-de-bicicleta/
- https://www.renault.com.ar/storyadores/legales-storyadores.html
- https://tienda.galicia.ar/content/11-bases-y-condiciones-sorteo-en-tienda-galicia
- https://www.bbva.com.ar/content/dam/public-web/argentina/documents/Bases_y_condiciones_wish.pdf
- https://lps.com.ar/basesycondiciones_bicicleta/
- https://autoloop.mitiendanube.com/terminos-y-condiciones-del-sorteo/
- https://app-sorteos.com/t/06cJ8PmDn59m
- https://www.diariojudicial.com/news-92346-cuidado-con-los-falsos-sorteos-en-instagram
- https://www.pagina12.com.ar/431019-estafas-online-alertan-por-el-incremento-de-sorteos-fradulen
- https://www.bicivilizados.org/category/sorteo/

**Benchmarks de bicis en el exterior**
- https://www.fabexbike.com.br/sorteio-aniversario-fabex
- https://institucional.politintas.com.br/vadebikeeletrica/
- https://www.neoenergia.com/web/bahia/w/sorteio-bicicleta-eletrica-salvador-shopping-coelba
- https://trailstore.cl/pages/bases-concurso-bicicleta-norco
- https://hummibikes.com/sorteo-bicicleta-cannondale/
- https://biocyclespain.com/sorteo-biocycle-10-aniversario/
- https://www.elespanol.com/quincemil/economia/empresas/20240403/estrella-galicia-velca-sortean-bicicletas-electricas-agosto/844916073_0.html

**Tienda Nube, herramientas de sorteo y escribanos**
- https://ayuda.tiendanube.com/es_AR/primeros-pasos/como-vender-cursos-con-tiendanube
- https://tiendanube.github.io/api-documentation/resources/webhook
- https://www.tiendanube.com/tienda-aplicaciones-nube/envios-digitales
- https://app-sorteos.com/es/certificacion-app-sorteos
- https://app-sorteos.com/en/plans
- https://www.sortea2.com/sorteos-certificados
- https://www.random.org/draws/pricing/
- https://www.rifalo.ar/blog/diferencia-rifa-sorteo
- https://escribanos.aarg.ar/blog/costos-escribano-2026/
- https://www.cesl.org.ar/PDFs/Tabla_de_aranceles.pdf
