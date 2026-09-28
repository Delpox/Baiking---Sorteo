# 02 · Mecánica de la promoción y decisiones a tomar con Gastón

## 1. El modelo que construimos

**"Curso Baiking + Participación"**: Baiking vende un producto real (el curso online de mantenimiento, solo o con kit / service / jersey) y regala, como bonificación, participaciones en el sorteo de una Polygon. Además existe una **vía gratuita** de participación (una por persona) porque la ley lo exige.

```
Participante ──► elige pack ──► paga en Mercado Pago ──► webhook confirma pago
                                                              │
                        ┌─────────────────────────────────────┘
                        ▼
              asigna números correlativos ──► mail + WhatsApp ──► página "gracias"
                        │
                        ▼
          padrón certificado por escribano ──► sorteo en vivo (sorteo.html) ──► acta
```

Diferencias con Autoloop, y por qué:

| Autoloop | Baiking | Motivo |
|---|---|---|
| Packs de 1/3/5/10 "chances" del mismo PDF | Packs con **valor real creciente**: Curso · Curso + Kit · Curso + Service · Pack Full | Un precio que sube solo por la cantidad de chances es "rifa encubierta" (denuncia IAFAS 2022) |
| Sin vía gratuita | Formulario "Participación sin cargo" (1 por DNI) | Lealtad Comercial, DNU 274/2019 art. 14 |
| "Tu número de sorteo", "quedan pocos números" | "Participación", "bonificación", "sin obligación de compra" | Riesgo con Mercado Pago, Meta y loterías provinciales |
| Cobro en Shopify/Tienda Nube | Mercado Pago Checkout Pro desde el sitio (o Tienda Nube de Baiking, modo `externo`) | Trazabilidad + factura automática |
| Sorteo en vivo | Sorteo en vivo **+ escribano + padrón certificado + acta descargable** | Transparencia auditable |

## 2. Escalera de precios (decisión del 28/09: copiar la estructura de Autoloop)

El cliente decidió copiar la estructura de precios de Autoloop: todas las opciones incluyen el mismo curso y lo que cambia es la cantidad de chances. Está cargada en `config/campaign.json` → `packs`:

| Opción | Precio | Precio por chance | Descuento vs. 1 chance |
|---|---|---|---|
| 1 chance | $10.000 | $10.000 | — |
| 2 chances | $15.000 | $7.500 | 25 % |
| 4 chances | $25.000 | $6.250 | 38 % |
| 6 chances | $35.000 | $5.833 | 42 % |
| 10 chances | $45.000 | $4.500 | 55 % (destacado "Más elegido") |
| 15 chances | $70.000 | $4.667 | 53 % |
| 20 chances | $90.000 | $4.500 | 55 % |
| 30 chances | $120.000 | $4.000 | 60 % |
| 50 chances | $150.000 | $3.000 | 70 % |
| 200 chances | $300.000 | $1.500 | 85 % |

Notas:
- La palabra que se usa ("chance"/"chances") se cambia en un solo lugar: `config/campaign.json` → `unidad`. Con `participación`/`participaciones` el sitio, los mails y el panel se adaptan solos.
- **Riesgo legal (ver `docs/01-investigacion.md` §2.4):** un precio que sube solo por la cantidad de chances del mismo producto digital es exactamente lo que la lotería de Entre Ríos calificó de "rifa encubierta" en 2022. Las mitigaciones que quedan en pie y conviene no tocar: el curso es real y se entrega de verdad; la vía gratuita "sin obligación de compra" sigue activa; el sorteo es ante escribano y en vivo; en Mercado Pago se cobra "Curso · Pack N" sin mencionar el sorteo; las bases hablan de "participaciones bonificadas". Vale la consulta al abogado antes de lanzar con esta estructura.
- Alternativa intermedia si el abogado lo pide: mantener la escalera pero hacer que cada escalón agregue algo real (kit, service, jersey), como estaba en la primera versión de este documento.

## 3. Escenarios económicos (ilustrativos: cargar números reales)

Supuestos: bici al costo para Baiking ≈ $2.600.000 (PVP $3.664.500 menos margen); escribano $100.000; producción del curso $300.000; reserva para premios adicionales o imprevistos $250.000; comisiones Mercado Pago + retenciones ≈ 8 % del cobrado (ver `docs/05` para el detalle y el efecto de la transferencia); mezcla de ventas estimada con la escalera: 35 % 1 chance · 20 % 2 · 15 % 4 · 10 % 6 · 12 % 10 · 5 % 15 · 3 % 30 o más.

- Ticket promedio ≈ **$26.500** (≈ 4,6 chances por orden).
- Costo variable por orden ≈ 8 % comisiones ≈ **$2.100** (el curso no tiene costo por unidad).
- Margen de contribución por orden ≈ **$24.400**.
- Costos fijos ≈ **$3.250.000** → **punto de equilibrio ≈ 135 órdenes** (≈ 620 chances).

| Órdenes pagas | Ingresos | Costos variables | Costos fijos | Resultado |
|---|---|---|---|---|
| 150 | $3.975.000 | $318.000 | $3.250.000 | **+$407.000** |
| 300 | $7.950.000 | $636.000 | $3.250.000 | **+$4.064.000** |
| 600 | $15.900.000 | $1.272.000 | $3.250.000 | **+$11.378.000** |
| 1.000 | $26.500.000 | $2.120.000 | $3.250.000 | **+$21.130.000** |

Si se cobra por transferencia con 5 % de descuento, el margen por orden baja unos $1.300 en el descuento pero sube unos $2.100 al no pagar comisión: neto ≈ +$800 por orden, más el trabajo de revisar comprobantes (ver `docs/03-automatizaciones.md` §7).

Con 121K seguidores en Instagram, 300 órdenes equivale a una conversión del 0,25 % de la audiencia. Además, cada pack Service y Full trae gente al taller (venta cruzada) y todos los compradores quedan en una base de datos con mail y WhatsApp.

Sensibilidad: si la vía gratuita representa el 30 % de las participaciones (lo habitual es mucho menos), no cambia el resultado económico: solo baja la probabilidad de que gane un comprador. Se puede mitigar sin violar la ley haciendo que la vía gratuita sea correcta pero no promocionada más que lo exigido (link en el sitio, leyenda en las piezas).

## 4. Decisiones a tomar con Gastón (en orden)

1. **Fecha del sorteo y vigencia.** Propuesta: lanzamiento 15/10, cierre 03/12 23:59, sorteo viernes 04/12 21:00 en vivo (7 semanas, entrega antes de las fiestas). Cambiar en `config/campaign.json` y en `supabase/schema.sql`.
2. **Qué Tambora se sortea.** A4 (~$3,6 M, pareja con la T7) vs G5 (carbono, ~$4,5-5,8 M). Definir y ajustar specs/valor en la config.
3. **Precios de los packs y contenido de cada uno.** Confirmar que el kit y el service existen como productos con precio propio en la tienda (refuerza que son productos reales).
4. **El curso.** Grabar 8 clases cortas (≈ 2 h) con el celular en el taller + guía PDF. Definir dónde se aloja (Google Drive con link privado, YouTube no listado, o plataforma tipo Hotmart) y cargar el link en `curso.url_acceso`.
5. **Premios adicionales.** Casco + kit (2°) y gift card (3°) son propuesta; ajustar.
6. **Razón social, CUIT y facturación.** Quién factura el curso (RI o monotributo), código de actividad, IVA. Ver `docs/01-investigacion.md` §4.
7. **Escribano.** Cotizar acta de sorteo en el Colegio de Escribanos de PBA (delegación Pilar).
8. **Alcance geográfico.** Todo el país vs excluir CABA/Mendoza/Neuquén/Río Negro/Salta. Consultar abogado y, si conviene, tramitar en LOTBA.
9. **Canal de cobro.** Mercado Pago propio desde el sitio (modo `api`, recomendado: automatiza todo) o productos en la Tienda Nube de Baiking (modo `externo`: más simple, pero la asignación de números y el mail dependen de la tienda o de un webhook adicional).
10. **WhatsApp.** Automático con la API oficial de Meta (requiere plantilla aprobada, ver `docs/03-automatizaciones.md`) o manual desde WhatsApp Business con el listado exportado.
11. **Fotos y marca.** Fotos oficiales de las dos bicis (Baiking ya las tiene en su tienda), logo de Baiking en SVG, colores de marca si difieren del verde volt propuesto.
12. **Plan de comunicación.** Video de Gastón explicando la promo (el activo más fuerte: confianza), posts semanales, stories con el contador, salidas de MTB como evento, pauta paga con la leyenda "Sin obligación de compra".
13. **Texto de la cita de Gastón** en la sección "Somos Baiking" (es una propuesta; que la diga con sus palabras).

## 5. Lenguaje: usar / evitar

| Usar | Evitar |
|---|---|
| promoción, participación, participaciones bonificadas, sorteo en vivo, sin obligación de compra, curso, pack | rifa, chances, números (como producto), "comprá tu número", "quedan pocos números", pozo, apuesta, jugada |
| "Con el curso participás por…" | "Comprá chances para ganar…" |
| "Sorteo ante escribano" | "Sorteo por la Quiniela" (salvo que el abogado lo recomiende como mecanismo) |
