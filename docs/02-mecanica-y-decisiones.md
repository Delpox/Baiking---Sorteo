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

## 2. Packs propuestos (precios a confirmar)

| Pack | Precio | Participaciones | Incluye | Costo estimado para Baiking |
|---|---|---|---|---|
| Curso | $15.000 | 1 | 8 clases en video + guía PDF + consultas por WhatsApp | ~$0 (una vez grabado) |
| Curso + Kit | $35.000 | 3 | Curso + kit de limpieza y lubricación Baiking | ~$8.000 (kit al costo) |
| Curso + Service | $60.000 | 5 | Curso + service completo en el taller (Shimano Service Center) + turno prioritario | ~$15.000 (mano de obra) |
| Pack Full | $110.000 | 10 | Curso + Kit + Service + jersey Baiking + salida grupal MTB | ~$38.000 |

Regla de proporcionalidad usada: **≈ 1 participación cada $12.000 de compra**. Mantenerla si se cambian los precios: es lo que justifica que "más compra = más participaciones" sin que se parezca a vender chances.

Ideas para sumar valor sin costo: descuento del 10 % en repuestos durante la vigencia para quien compró el curso; acceso a una clase en vivo con el taller; prioridad en la lista de espera de bicis.

## 3. Escenarios económicos (ilustrativos: cargar números reales)

Supuestos: bici al costo para Baiking ≈ $2.600.000 (PVP $3.664.500 menos margen); premios adicionales $250.000; escribano $100.000; producción del curso $300.000; comisiones Mercado Pago + retenciones ≈ 8 % del cobrado; mezcla de ventas 50 % Curso · 25 % Kit · 20 % Service · 5 % Full.

- Ticket promedio ≈ **$33.750**.
- Costo variable promedio por orden ≈ $6.900 (kits, mano de obra, jersey) + 8 % comisiones ≈ **$9.600**.
- Margen de contribución por orden ≈ **$24.000**.
- Costos fijos ≈ **$3.250.000** → **punto de equilibrio ≈ 135 órdenes**.

| Órdenes pagas | Ingresos | Costos variables | Costos fijos | Resultado |
|---|---|---|---|---|
| 150 | $5.060.000 | $1.440.000 | $3.250.000 | **+$370.000** |
| 300 | $10.125.000 | $2.880.000 | $3.250.000 | **+$3.995.000** |
| 600 | $20.250.000 | $5.760.000 | $3.250.000 | **+$11.240.000** |
| 1.000 | $33.750.000 | $9.600.000 | $3.250.000 | **+$20.900.000** |

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
