# Baiking · Curso + Participación por una Polygon

Sitio y sistema para la primera edición de la promoción de **Baiking Tienda de Bicis** (Del Viso, Pilar): la gente hace el **Curso Baiking de Mantenimiento** y participa por una **Polygon Siskiu T7** o una **Polygon Tambora**, a su elección. Sorteo en vivo por Instagram, ante escribano. **Sin obligación de compra.**

> Estado: demo lista para mostrar (modo `demo`, sin cobros reales). Precios, fechas, versión de la Tambora y datos legales marcados `[A CONFIRMAR]` en `config/campaign.json`. Ver `docs/04-checklist-lanzamiento.md` para pasar a producción.

## Qué hay en el repositorio

```
index.html                  Landing principal (hero, bicis, cómo funciona, curso, packs, sorteo, FAQ, legales)
participa-sin-cargo.html    Vía gratuita de participación (obligatoria por Lealtad Comercial)
gracias.html                Confirmación con los números de participación (post-pago)
bases-y-condiciones.html    Bases y condiciones (borrador para revisión legal)
sorteo.html                 Herramienta para el sorteo en vivo (carga el padrón, sortea con crypto, exporta acta)
config/campaign.json        ÚNICA fuente de verdad: fechas, bicis, curso, packs, precios, contacto, textos legales
assets/                     CSS, JS y sprite de íconos/ilustraciones (sin build)
api/                        Funciones serverless (Vercel): checkout, webhook de Mercado Pago, orden, export, vía gratuita
supabase/schema.sql         Base de datos Postgres: ediciones, órdenes, participaciones y asignación atómica de números
scripts/                    check (validaciones), screenshots (Playwright), build-demo (HTML autocontenido), sorteo (CLI)
docs/                       Investigación legal y de mercado, mecánica y decisiones, automatizaciones, checklist
```

## Cómo verlo

```bash
npm run dev            # sirve el sitio en http://localhost:3000 (modo demo, sin backend)
npm run check          # valida config, íconos, links y sintaxis del backend
npm run screenshots    # capturas desktop + móvil de todas las páginas en ./screenshots (requiere Playwright)
node scripts/build-demo.mjs   # genera ./dist con cada página en un solo archivo HTML (para compartir)
```

En modo `demo` el botón "Ir a pagar" simula la confirmación y muestra los números en pantalla, sin cobrar.

## Modos de cobro (`config/campaign.json` → `checkout.modo`)

| Modo | Qué hace | Cuándo usarlo |
|---|---|---|
| `demo` | Simula la compra en el navegador | Para mostrar el proyecto |
| `api` | Crea la orden, cobra con Mercado Pago Checkout Pro, asigna números por webhook y notifica por mail/WhatsApp | Producción recomendada |
| `externo` | Redirige cada pack a `packs[].url_externa` (por ejemplo, un producto en la Tienda Nube de Baiking) | Si se prefiere cobrar desde la tienda existente |

## Puesta en producción (resumen)

1. Supabase: ejecutar `supabase/schema.sql`.
2. Mercado Pago: credenciales de producción + webhook a `/api/webhooks/mercadopago`.
3. Resend: dominio verificado + API key. (WhatsApp Cloud API opcional.)
4. Vercel: importar el repo, cargar las variables de `.env.example`, dominio.
5. `checkout.modo: "api"` y desplegar. Probar de punta a punta con credenciales de prueba.

Detalle completo en `docs/04-checklist-lanzamiento.md`.

## Por qué está armado así (y no como Autoloop)

En Argentina vender "chances" es juego de azar sin autorización (art. 301 bis del Código Penal) y la Ley de Lealtad Comercial exige que toda promoción con premio tenga una vía gratuita con igual probabilidad y la leyenda "Sin obligación de compra". Por eso:

- lo que se cobra es siempre un producto real (curso, kit, service), descripto como tal en Mercado Pago;
- las participaciones son una bonificación proporcional al valor comprado, no un producto;
- existe la participación sin cargo (`/participa-sin-cargo`, una por DNI);
- el sorteo es en vivo, ante escribano, con padrón certificado y acta;
- el lenguaje evita "rifa", "chances" y "números" como producto.

Fuentes, casos y detalle: `docs/01-investigacion.md`.

## Personalizar

- **Marca:** variables en `:root` de `assets/css/styles.css` (`--acento`, `--gravel`, fondos) y wordmark en el nav.
- **Fotos de las bicis:** `bicis[].imagen` en la config (PNG recortado); si es `null` se usa la ilustración técnica del sprite.
- **Textos:** todo el copy editable está en `config/campaign.json` y en el HTML de cada sección.
- **Ganadores:** `ganadores` en la config (`{ numero, nombre, localidad, premio }`).
