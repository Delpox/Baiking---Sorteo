# 01 · Investigación: marco legal, el modelo Autoloop y las bicis

> Investigación realizada el 28/09/2026 con búsquedas web. Los sitios de Autoloop, Polygon y la mayoría de los medios estaban bloqueados desde el entorno de trabajo, así que varias citas provienen de extractos de buscadores. **Todo lo marcado "a verificar" debe confirmarse con abogado y contador antes de lanzar.**

## 1. Resumen ejecutivo (leer esto primero)

1. **La palabra "sorteo" no es el problema.** Los sorteos promocionales son legales y las marcas los usan todo el tiempo. Lo ilegal es **vender chances** (rifa o sorteo oneroso) sin autorización estatal: eso es "captación de juegos de azar sin autorización", **art. 301 bis del Código Penal (Ley 27.346), 3 a 6 años de prisión**.
2. **Disfrazar la venta de chances como "curso" no elimina el riesgo.** En diciembre de 2022 el IAFAS (lotería de Entre Ríos) denunció penalmente a un influencer que vendía "guías" cuyo precio variaba según la cantidad de chances: "si fuera un curso, la guía debería costar siempre lo mismo". Autoloop opera desde Gualeguaychú, Entre Ríos, con el mismo esquema (packs de 1/3/5/10 chances del mismo PDF).
3. **La Ley de Lealtad Comercial (DNU 274/2019, art. 14) prohíbe condicionar la participación a la compra.** Toda promoción con premio por azar debe tener una **vía gratuita de participación con igual probabilidad** y la leyenda **"Sin obligación de compra"** en todas las piezas. Multas de hasta 10.000.000 de Unidades Móviles (P&G, Bagley y McDonald's fueron multadas por omitir la leyenda).
4. **Camino defendible para Baiking:** producto real y facturado + una (1) participación por compra, la misma para cualquier producto y para la vía gratuita (nunca proporcional a lo gastado) + vía gratuita + bases públicas + escribano y sorteo en vivo + premio garantizado con fecha fija + lenguaje sin "rifa/chances/números/pozo". Es el modelo que construimos en este repositorio: desde el 29/09, tres productos digitales con una participación cada uno (`docs/02` §4.2; la revisión legal que motivó el cambio está en `docs/08`).
5. **Riesgos concretos documentados:** denuncias penales (Santa Fe 2026: detención y secuestro del auto; Entre Ríos 2022; Salta 2026: probation), cierre masivo de perfiles de Instagram vía convenio ALEA–Meta (Chaco: 1.624 perfiles), suspensión de cuentas de Mercado Pago ("loterías o productos de azar" está prohibido), cruces de ARCA sobre billeteras virtuales.

## 2. Marco legal en Argentina

### 2.1 Nacional

| Norma | Qué dice | Impacto para Baiking |
|---|---|---|
| **Código Penal, art. 301 bis** (Ley 27.346) | Prisión de 3 a 6 años a quien organice "cualquier modalidad o sistema de captación de juegos de azar sin autorización". Los reguladores encuadran cuando hay: pago + premio + azar + sin autorización. | Nunca vender participaciones. El pago debe ser por un producto real; la participación es una bonificación. |
| **Lealtad Comercial, DNU 274/2019 art. 14** | Prohíbe premios por azar "en razón directa o indirecta de la compra" y sorteos "condicionados en todo o en parte a la adquisición de un producto". Interpretación consolidada: la compra puede habilitar la participación, pero **debe existir una vía gratuita con igual probabilidad**. | Formulario de participación sin cargo (implementado en `/participa-sin-cargo`). Leyenda "Sin obligación de compra" en web, posts, stories y mails. |
| **Decreto 961/2017 + Res. 89/98 + Res. 241/2020** | Toda publicidad debe incluir "Sin obligación de compra", fechas de inicio y fin, y dónde ver bases (premios, alcance geográfico, requisitos). Tipografía mínima 2 mm en gráfica, 3 segundos en pantalla. | Ya está en el footer y en las bases. Repetir en cada pieza de Instagram. |
| **Decreto 588/98 (Lotería Nacional)** | **Derogado** por el DNU 95/2018; Lotería Nacional S.E. está en liquidación. No hay contralor nacional único: rigen las normas provinciales. | Una promo online de alcance nacional se revisa provincia por provincia. |
| **Ley 24.240 (Defensa del Consumidor)** | Art. 8 y 19: lo prometido en la publicidad obliga. Art. 34 + CCyC 1110-1116: derecho de revocación de 10 días en compras a distancia (no aplica a contenido digital ya descargado). Res. 424/2020: **botón de arrepentimiento** obligatorio. | Cláusula 10 de las bases + link "Botón de arrepentimiento". Facturar todo. |
| **Ley 25.326 (Datos Personales)** | Consentimiento informado, política de privacidad, registro de base ante la AAIP. | Checkbox obligatorio en el formulario; registrar la base. |
| **Ley 20.630 (Impuesto a los premios)** | 31% sobre el 90% del premio (27,9% efectivo) en "loterías, rifas y similares"; responsable: el organizador. Doctrina: los sorteos promocionales gratuitos no estaban alcanzados. | **A verificar con contador** si corresponde por premio en especie. |

### 2.2 Provincia de Buenos Aires (jurisdicción de Baiking, Del Viso – Pilar)

- Autoridad de juego: **Instituto Provincial de Lotería y Casinos (IPLyC)**, Ley 10.305.
- **Rifas: Decreto-Ley 9403/79.** Solo entidades de bien público con autorización municipal; un comercio **no** puede obtenerla.
- **Código de Faltas (Decreto-Ley 8031/73), arts. 96-105:** prohíbe juegos de azar no autorizados.
- **Promociones comerciales con premio:** no se encontró un régimen bonaerense de autorización previa (a diferencia de CABA, Mendoza, Neuquén, Río Negro y Salta). Aplica el régimen nacional de Lealtad Comercial, fiscalizado por Defensa del Consumidor provincial y las **OMIC municipales** (OMIC Pilar).
- **A verificar con abogado:** consultar por nota al IPLyC si exige registro o autorización de sorteos promocionales. Una nota respondida es la mejor defensa.

### 2.3 Otras jurisdicciones con régimen propio

- **CABA:** LOTBA (Ley 538 / 5785). Presentación de bases, arancel y autorización previa.
- **Mendoza:** Res. DFyC 118/2021: autorización previa 10 días antes y 7% del valor de los premios entregados.
- **Córdoba:** Ley 8665; impuesto a loterías, rifas y sorteos (Rentas Córdoba).
- **Santa Fe:** Lotería de Santa Fe muy activa en denuncias por 301 bis.
- **Neuquén, Río Negro, Salta (EnReJA):** regímenes propios de autorización de promociones.

**Decisión pendiente (bases, cláusula 2):** excluir esas jurisdicciones o tramitar autorización. Recomendación: primera edición con alcance nacional pero excluyendo explícitamente CABA, Mendoza, Neuquén, Río Negro y Salta salvo que el abogado indique lo contrario. **Ojo: CABA es un mercado enorme para Baiking (Pilar está a 50 km)**; vale la pena consultar el trámite en LOTBA.

## 3. Cómo funciona el modelo Autoloop (y sus clones)

**Autoloop** (Gualeguaychú, Entre Ríos · autoloopoficial.com.ar · Tienda Nube + Shopify · @autoloop_oficial):

- Vende el **"Pack de Cursos AutoLoop (PDF)"** (curso de detailing automotor) "en cualquiera de sus variantes de compra basadas en cantidad de chances".
- "Cada orden pagada y confirmada otorga participaciones según el pack elegido"; "tu número de sorteo es el número de orden".
- Premios múltiples: Fiat Uno SCR 1.6 (1°), moto Guerrero Trip 110 (2°), iPhone 16 Pro Max (3°). Otras ediciones: Amarok V6, Chevrolet Classic + Honda CB 300 + $3.000.000.
- Sorteo en vivo por Instagram/YouTube un viernes a las 21-22 hs; compras válidas hasta el día anterior a las 23:59.
- Términos: mayores de 18 residentes en Argentina; el ganador responde en 7 días hábiles; premio transferido y entregado en su casa; patente, seguro y mantenimiento posteriores a cargo del ganador; el organizador puede cambiar fecha por fuerza mayor; si cancela, reintegra solo si el contenido digital no fue enviado; "no patrocinado por YouTube ni Tienda Nube".
- **No tiene vía gratuita ni la leyenda "Sin obligación de compra"** (según los extractos disponibles).
- Además **vende el método** ("Mentoría AutoLoop: sorteos rentables paso a paso") y declara "más de 30.000 órdenes y $180 millones facturados". De ahí salen los clones Garage1, VIP Motors y Rodar Club ($9.980 por número, "quedan pocos números").

**Qué copiamos de Autoloop:** la claridad de la landing (premio grande, cómo participar en 4 pasos, packs, fecha del sorteo en vivo, ganadores anteriores, FAQ), la confirmación automática con números por mail y la transmisión en vivo.

**Qué NO copiamos:** packs de "N chances" del mismo PDF (rifa encubierta), ausencia de vía gratuita, lenguaje de rifa ("número", "quedan pocos"), cobro por transferencia con comprobante por WhatsApp (VIP Motors).

**Ejemplos que sí cumplen:** Tutu Automotores ("La presente promoción es sin obligación de compra"), ShopGallery (vía gratuita por email, 1 chance por persona, sorteo por app-sorteos.com), Autocity (1 participación por operación, sorteo por AppSorteos en vivo por Instagram).

## 4. Riesgos de plataformas y fisco

- **Mercado Pago:** "Loterías o productos de azar" está en la lista de actividades prohibidas: puede retener fondos y **cancelar la cuenta**. Por eso el ítem cobrado siempre es el producto digital comprado (fondos de pantalla, checklist o curso) y nunca "participaciones"; Mercado Pago está desactivado desde el 28/09, pero la regla vale para cualquier pasarela.
- **Tiendanube / Pago Nube:** loterías y apuestas son industrias no habilitadas. Mismo criterio de naming si se vende desde la tienda de Baiking.
- **Meta / Instagram / WhatsApp Business:** la política de comercio prohíbe promover "loterías, rifas, sorteos con dinero o valor" independientemente de licencias locales; las Normas de promociones de Instagram exigen bases oficiales y el disclaimer "no patrocinado por Instagram". Con el convenio ALEA–Meta, cualquier lotería provincial puede pedir la baja del perfil (**@baikingtiendadebicis tiene 121K seguidores: es el activo a proteger**).
- **ARCA:** cruza ingresos de billeteras virtuales con facturación; un pico de ingresos sin facturas dispara recategorización o exclusión del monotributo. Facturar cada orden automáticamente.

## 5. Las bicis

### Polygon Siskiu T7 (modelo 2026 "with UDH")
- Trail de doble suspensión, cuadro ALX aluminio 6061, 135 mm atrás / 140 mm adelante, UDH, cableado interno.
- RockShox Recon Silver RL 140 mm · RockShox Deluxe Select+ · Shimano Deore 1x12 (10-51T) · frenos Shimano MT420 4 pistones · 29" en todos los talles · Maxxis Dissector EXO+ · tija X-Fusion Manic 150/170 mm · ~15,4 kg.
- Color 2026: rojo (un solo color por modelo). Talles S/M/L/XL.
- Precio: **Baiking $3.664.500** (baiking.com.ar/productos/polygon-siskiu-t7/) · otras tiendas $3,7 M – $4,2 M · USD 1.999 en EE. UU.
- Marketing Polygon: "The Trail Hustler", "Any Trail. Any Rider.", "high-end performance without the big price tag".

### Polygon Tambora (serie gravel)
- Rasgo distintivo: **flip chips** en punteras y horquilla para pasar de geometría all-road a gravel ("dos bicis en una"); paso de cubierta hasta 700x45c; **14 puntos de anclaje**.
- Versiones y precios en Argentina: **G4** (ALX alu + horquilla carbono, MicroShift 1x10) Baiking $2.320.973 · **A4** (alu, Shimano GRX 2x11) ~$3.600.000 · **A5** (alu, GRX 2x11 hidráulico) · **G5** (carbono ACX, SRAM Apex 1x11) Baiking $5.775.000 lista / ~$4.462.500 con descuento · **G7** (carbono, Apex XPLR 1x12, ruedas carbono) USD 2.499.
- **A definir con Gastón:** qué Tambora se sortea. La **A4** (~$3,6 M) queda pareja con la Siskiu T7 ($3,66 M); la G5 es ~$1 M más cara.
- Marketing Polygon: "genuinely two-bikes-in-one", "Built for speed & adventure", "ready to carry everything your adventure demands".

### Baiking y Polygon
- **Baiking Tienda de Bicis** · Las Camelias 3327, Del Viso (1669), Pilar · 011 2154-5599 / WhatsApp 11 5728-0056 · Lun-vie 9:30-13:30 y 15:30-19:30, sáb 9-14.
- Instagram **@baikingtiendadebicis: 121K seguidores** · Facebook 62,5K · TikTok, YouTube, X (@BaikingPilar) · club de Strava.
- Marcas: Trek (dealer oficial), Cannondale, Giant, KTM, Raleigh, Fuji, Polygon; **Shimano Service Center**; accesorios marca propia BAIKING; salidas de MTB gratuitas los sábados.
- Ya vende **Siskiu T7 y Tambora A4/A5/G4/G5** en su tienda online (Tienda Nube). El importador oficial es **Polygon Bikes Argentina** (@polygonbikes.ar).
- Reseñas mencionan a "Gastón y Ezequiel" como las personas clave de la atención. No se encontró apellido ni rol formal (a completar).

## 6. Fuentes principales

Normativa: Decreto 274/2019 (Boletín Oficial) · Decreto 961/2017 · Res. 89/98 · Res. 241/2020 · DNU 95/2018 (liquidación de Lotería Nacional) · Ley 24.240 · Ley 25.326 · Ley 20.630 · Decreto-Ley 9403/79 y Ley 11.349 (PBA) · Código de Faltas PBA 8031/73 · Ley 538 CABA · Res. 118/2021 Mendoza.

Doctrina: Abeledo Gottheil (promociones en el DNU 274/2019; impuesto a los premios) · Noetinger & Armando ("Sin obligación de compra") · Estudio Nunes · Cámara Argentina de Anunciantes · Diario Judicial (multas P&G, Bagley) · Rifalo ("Rifa vs sorteo").

Casos: La Capital y Rosario3 (Santa Fe 2026) · Yogonet y Análisis Digital (Entre Ríos 2022) · Yogonet (Salta 2026) · TN24 (Chaco 2024) · El Cronista (LOTBA vs influencers 2025) · La Nación (ALEA vs Mercado Pago 2026).

Plataformas: Ayuda Mercado Pago "Loterías o productos de azar" · Tiendanube "Industrias no permitidas" · Normas de promociones de Instagram · Política de comercio de WhatsApp Business.

Modelo curso + participación: autoloopoficial.com.ar · autoloop.mitiendanube.com/terminos-y-condiciones-del-sorteo · mentoriasautoloop.com.ar · garage1.agency · sorteo.vipmotors.autos · rodarclub.com · autocity.com.ar/terminos-y-condiciones · tutuautomotores.com/bases-y-condiciones-para-sorteo · shopgallery.com/bases-condiciones/sorteo-auto.

Bicis: polygonbikes.com (Siskiu T7 with UDH 2026, Tambora series/G5/G7/A5) · 99spokes · bikesonline · bikerumor (Tambora 2024) · baiking.com.ar · sitiobike.com.ar · eltallerbikesolivos.com.ar · instagram.com/baikingtiendadebicis · instagram.com/polygonbikes.ar.
