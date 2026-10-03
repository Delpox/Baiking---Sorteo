# 06 · Planilla de Google Sheets para Gastón

La planilla de órdenes / transferencias del panel, espejada en un Google Sheets que Gastón puede abrir desde el celular. Él marca en una columna si la plata llegó y el sistema hace el resto (bloque de números, mail, WhatsApp). Sin dependencias nuevas: `api/_lib/sheets.js` firma el JWT de la service account con `node:crypto` y habla con la API REST de Sheets v4 por `fetch`.

## 1. Qué hace

**Base → planilla.** `/api/sheets-sync` espeja todas las órdenes de la edición actual (`campaign.edicion.id`) en la pestaña `Órdenes`, una fila por orden, con *upsert* por `orden_id` (columna A): si la fila existe la actualiza en su lugar, si no la agrega al final. Solo escribe las filas que cambiaron. Además, el hook `espejarOrdenEnSheet(orden)` actualiza esa fila apenas cambia el estado (ver §6).

**Planilla → base.** En la misma corrida lee la columna **"Llegó la plata"**. Donde Gastón puso `SI` o `NO` y la base todavía no lo tiene (o tiene lo contrario), aplica la misma lógica que la acción `acreditar` del panel:

- `SI` sobre una transferencia `pendiente` o `en_revision` → guarda `acreditada = true`, `acreditada_at`, `acreditada_nota`, `revisado_por = 'planilla'`, `revisado_at`, y **confirma la orden** (`confirmarOrden`: bloque correlativo de números, mail de confirmación con el link del producto y WhatsApp si está configurado).
- `NO` → solo guarda `acreditada = false` (+ fecha, nota y revisor). Rechazar la orden sigue siendo una decisión del panel.
- `SI` sobre una transferencia `rechazada` o `reembolsada` → solo marca; nunca la reabre (igual que el panel, que avisa "se marcó acreditada pero no se aprueba").
- `SI`/`NO` en una fila que no es transferencia (vía gratuita, o Mercado Pago si se reactivara) → no hace nada y lo informa en `errores` (el panel responde 409 en ese caso).
- Vacío u otra cosa (`ver`, `?`) → no hace nada.

La lógica está en `marcarAcreditada()` de `api/_lib/sheets.js`, calcada de la acción `acreditar` de `api/admin.js` (que hoy no la exporta): si en algún momento se quiere una sola implementación, el panel puede llamar a ese helper.

Columnas, en este orden:

| Col | Encabezado | Quién la escribe | Contenido |
|---|---|---|---|
| A | `orden_id` | sistema | uuid de la orden (la clave del upsert: **no editarla**) |
| B | `fecha` | sistema | `created_at` en hora de Buenos Aires (`dd/mm/aaaa HH:MM`) |
| C–H | `nombre` `apellido` `dni` `email` `whatsapp` `provincia` | sistema | datos del participante |
| I | `bici` | sistema | nombre de la bici elegida (`campaign.bicis`) |
| J | `pack` | sistema | nombre del producto comprado (`campaign.packs`); `Sin cargo` para la vía gratuita |
| K | `participaciones` | sistema | `cantidad_participaciones`: una por cada $1.000 del precio del producto (10 · 19 · 29); 1 en la vía gratuita |
| L | `monto` | sistema | número (sin formato) |
| M | `estado` | sistema | `pendiente` · `en_revision` · `pagada` · `rechazada` · … |
| N | `comprobante` | sistema | fecha en que subió el comprobante |
| O | `IA: monto ok / destino ok` | sistema | `OK / OK`, `NO / OK`…, `sin lectura` si hay comprobante pero no se leyó |
| P | `números` | sistema | el bloque correlativo de la orden como texto: `del 121 al 130` (vía gratuita, un solo número: `N.º 1.587`); con separador de miles y sin ceros a la izquierda, vacío hasta que la orden se confirma (`textoRango()`; el mismo bloque que va en el mail) |
| Q | **`Llegó la plata`** | **Gastón** | vacío / `SI` / `NO` (lista desplegable) |
| R | `acreditada_at` | sistema | cuándo se marcó |
| S | `nota` | **Gastón** (o el panel) | texto libre, se guarda en `acreditada_nota` |

Reglas de convivencia entre lo manual y lo automático:

- Q y S son de Gastón: el sistema **no las pisa** mientras la base no tenga un valor. Una vez que la marca está en la base (por la planilla o por el panel), la vuelve a escribir en cada sincronización: para cambiarla hay que escribir el valor nuevo (`SI` → `NO`), no borrar la celda.
- Si cambia la nota (S) de una fila ya marcada, la nota se copia a la base sin volver a confirmar nada.
- Todo lo demás (A–P y R) se pisa en cada sincronización; al editarlo la planilla avisa (rango protegido "solo advertencia").
- Se pueden agregar columnas a la derecha de S (comentarios, seguimiento): el sistema no las toca. También se puede ordenar o filtrar: las filas se buscan por `orden_id`, no por posición.
- Una pestaña por edición: una fila con `SI` de otra edición queda en `errores` ("no existe en la edición…") y no hace nada.
- Cada corrida aplica hasta 20 marcas (cada `SI` manda mail y WhatsApp y la función de Vercel tiene 60 s); lo que sobra queda para la siguiente (`pendientes` en la respuesta).

## 2. Crear la service account (10 minutos, una sola vez)

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta de Google de Baiking y crear un proyecto (por ejemplo `baiking-sorteo`), o usar uno existente.
2. **APIs y servicios → Biblioteca** → buscar **Google Sheets API** → **Habilitar**.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**. Nombre: `baiking-sheets`. No hace falta darle ningún rol; **Listo**.
4. Abrir la cuenta recién creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo `baiking-sorteo-xxxx.json`. **Es un secreto**: no va al repo ni por WhatsApp; se guarda en el gestor de contraseñas y se borra de Descargas.
5. Del JSON se usan dos campos: `client_email` (termina en `@…iam.gserviceaccount.com`) y `private_key` (empieza con `-----BEGIN PRIVATE KEY-----\n`).

## 3. La planilla

1. Crear una planilla nueva en Google Sheets (sugerido: "Baiking · Órdenes · edición 1"). No hace falta armar nada adentro.
2. **Compartir** → pegar el `client_email` de la service account → rol **Editor** → destildar "Notificar a las personas" → Enviar.
3. Compartir también con Gastón (Editor). La planilla tiene DNI, mail y WhatsApp de cada participante: solo con quien lo necesite.
4. Copiar el ID de la URL: `https://docs.google.com/spreadsheets/d/`**`1AbC…xyz`**`/edit`. Se puede pegar la URL entera en `GOOGLE_SHEETS_ID`; el backend extrae el ID.
5. La pestaña **`Órdenes`** la crea el sistema en la primera sincronización, con el encabezado en negrita, la fila 1 fija, la lista `SI`/`NO` en la columna Q y el aviso al editar columnas del sistema. Para usar otro nombre (o una pestaña por edición): `GOOGLE_SHEETS_TAB`.

## 4. Variables de entorno (Vercel → Settings → Environment Variables)

Nombres exactos:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=baiking-sheets@baiking-sorteo.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n
GOOGLE_SHEETS_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
GOOGLE_SHEETS_TAB=Órdenes
CRON_SECRET=un-token-largo-y-aleatorio
```

- `GOOGLE_PRIVATE_KEY`: pegar el valor de `private_key` del JSON **tal cual**, con los `\n` literales (así viene en el JSON) y sin comillas. Vercel lo guarda sin tocar y el backend convierte los `\n` en saltos de línea. También funciona pegada con saltos de línea reales. Si Google responde "Invalid JWT Signature", la clave se pegó cortada o con comillas.
- `GOOGLE_SHEETS_TAB` es opcional (default `Órdenes`).
- `CRON_SECRET`: Vercel lo manda en `Authorization: Bearer <CRON_SECRET>` en cada invocación del cron; sin él, el endpoint responde 401 y el cron no hace nada. Generarlo con `openssl rand -hex 24`. El endpoint también acepta `Bearer <ADMIN_TOKEN>` (para llamarlo a mano o desde el panel).
- Sin las variables `GOOGLE_*` no pasa nada: `/api/sheets-sync` responde `200 { ok: false, motivo: 'sheets no configurado' }` y el hook no hace nada.

Las cuatro `GOOGLE_*` ya están en `.env.example`, con sus comentarios.

## 5. Cron en `vercel.json`

El `vercel.json` del repo ya trae la clave `crons` (al lado de `functions` y `headers`):

```json
{
  "crons": [
    { "path": "/api/sheets-sync", "schedule": "50 2 * * *" },
    { "path": "/api/recordatorios", "schedule": "0 13 * * *" }
  ]
}
```

La sincronización corre una vez por día a las 02:50 UTC (23:50 en Argentina) y los recordatorios a las 13:00 UTC (10:00 en Argentina); cada corrida tarda entre 2 y 5 segundos, muy por debajo de la cuota gratuita de la API de Sheets (300 lecturas por minuto por proyecto). Vercel llama al endpoint con `GET` y el header `Authorization: Bearer <CRON_SECRET>`; los crons corren solo en el deploy de producción.

**Plan Hobby de Vercel:** admite como máximo 2 crons y solo con frecuencia diaria (con `*/10` el deploy falla). Por eso son diarios. Si hace falta que la planilla se actualice más seguido:

1. Pasar a Pro (los crons pasan a ser por minuto y se puede poner `*/10 * * * *`).
2. Dejar el cron diario como respaldo y disparar la sincronización desde la propia planilla con Apps Script (abajo). Además de resolver la frecuencia, hace que la acreditación salga **segundos después** de que Gastón marca `SI`.
3. Un botón "Sincronizar planilla" en el panel que haga `POST /api/sheets-sync` con el `Bearer <ADMIN_TOKEN>` (pendiente en `admin.html` / `assets/js/admin.js`).

### Disparar desde la planilla (Apps Script, opcional)

En la planilla: **Extensiones → Apps Script**, pegar esto y guardar:

```js
// Llama a /api/sheets-sync cuando se edita la columna "Llegó la plata" (Q) y cada 10 minutos.
const URL = 'https://participa.baiking.com.ar/api/sheets-sync';
const COLUMNA_LLEGO = 17; // Q

function sincronizar() {
  const secreto = PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  UrlFetchApp.fetch(URL, { method: 'post', headers: { Authorization: 'Bearer ' + secreto }, muteHttpExceptions: true });
}

function alEditar(e) {
  if (e && e.range && e.range.getColumn() === COLUMNA_LLEGO) sincronizar();
}
```

Luego: **Configuración del proyecto → Propiedades del script** → agregar `CRON_SECRET` con el mismo valor que en Vercel. **Activadores → Añadir activador**: función `alEditar`, evento "De hoja de cálculo · Al editar"; y otro: función `sincronizar`, "Según tiempo · cada 10 minutos". Google pide autorizar el script la primera vez (con la cuenta de Baiking, no con la de Gastón).

## 6. Líneas de integración (ya aplicadas en `api/`)

`espejarOrdenEnSheet(orden, { rango })` está en `api/_lib/sheets.js`: **nunca lanza** (si Sheets no está configurado o falla, loguea y devuelve `false`), hace 2 llamadas a la API (≈ 1 s) y no hace nada mientras corre una sincronización (esa ya escribe todo al final). Se `await`-ea antes de responder: Vercel puede congelar la función después de `res.end()`. `rango` es el bloque de la orden (`{ desde, hasta, cantidad }`); si no se pasa, se toma de `numero_desde` / `numero_hasta` de la orden. Estas son las líneas, ya presentes en el código (sirven de referencia si se agrega otro camino que cambie el estado de una orden):

| # | Archivo | Dónde | Línea |
|---|---|---|---|
| 1 | `api/_lib/confirmar.js` | arriba, con los imports | `import { espejarOrdenEnSheet } from './sheets.js';` |
| 2 | `api/_lib/confirmar.js` | `confirmarOrden()`, justo antes de `return { orden: actual, rango };` | `await espejarOrdenEnSheet(actual, { rango });` |
| 3 | `api/checkout.js` | arriba, con los imports | `import { espejarOrdenEnSheet } from './_lib/sheets.js';` |
| 4 | `api/checkout.js` | rama `if (esTransferencia)`, después del `try/catch` del mail y antes de `return json(res, 200, { orden_id: orden.id, medio_pago: 'transferencia', … })` | `await espejarOrdenEnSheet(orden);` |
| 5 | `api/admin.js` | arriba, con los imports | `import { espejarOrdenEnSheet } from './_lib/sheets.js';` |
| 6 | `api/admin.js` | acción `rechazar`: guardar el resultado del update y espejarlo | `const actual = await actualizarOrden(orden.id, { estado: 'rechazada', … });` → `await espejarOrdenEnSheet(actual);` |
| 7 | `api/admin.js` | acción `acreditar`, rama que no confirma: después de `const actual = await actualizarOrden(orden.id, marca);` | `await espejarOrdenEnSheet(actual);` |

La línea 2 cubre de una vez todos los caminos que confirman una orden: aprobar o acreditar desde el panel, webhook de Mercado Pago, vía gratuita, aprobación automática por IA y la propia planilla. Por eso `aprobar` en `admin.js` (y la rama de `acreditar` que llama a `confirmarOrden`) no necesitan nada más. `sheets.js` importa `confirmar.js` de forma dinámica, así que el import de la línea 1 no arma un ciclo.

Para el checkout por Mercado Pago (hoy deshabilitado) va la misma línea 4 después de `actualizarOrden(orden.id, { mp_preference_id: pref.id })`.

Opcional: `api/_lib/comprobante.js`, en `procesarComprobante()` después de `actualizarOrdenSiEstado(…, 'en_revision', …)`, `await espejarOrdenEnSheet(actual);` para que el comprobante aparezca en la planilla al instante (si no, aparece con el próximo cron).

## 7. Probar

Sin tocar Google: `node <scratchpad>/sheets/test-sheets.mjs` simula OAuth (verifica la firma RS256 del JWT), la API de Sheets y Supabase, y cubre el upsert, los `SI`/`NO`, las notas, el tope por corrida, las filas repetidas, el hook y el caso sin variables. Vale la pena copiarlo a `scripts/` cuando se ordene la carpeta de tests.

Contra la planilla real, después de cargar las variables y desplegar:

```bash
curl -sS -X POST https://participa.baiking.com.ar/api/sheets-sync -H "Authorization: Bearer $ADMIN_TOKEN"
# → {"ok":true,"filas_escritas":12,"marcadas_si":0,"marcadas_no":0,"pendientes":0,"errores":[]}
```

Después poner `SI` en la fila de una orden de prueba y volver a llamar: `marcadas_si: 1`, la fila pasa a `pagada` con su bloque en la columna `números` ("del 121 al 130") y a la persona le llega el mail. Con `?edicion=edicion-2` se sincroniza otra edición (usar otra pestaña).

Errores típicos (vienen en `detalle` de la respuesta 500 y en los logs de Vercel):

| Mensaje | Causa |
|---|---|
| `The caller does not have permission` (403) | la planilla no está compartida como Editor con el `client_email` |
| `Requested entity was not found` (404) | `GOOGLE_SHEETS_ID` incorrecto |
| `Invalid JWT Signature` / `GOOGLE_PRIVATE_KEY inválida` | la clave se pegó cortada, con comillas o le faltan los `\n` |
| `Google Sheets API has not been used in project…` | falta habilitar la API (§2 paso 2) |
| `column "acreditada" does not exist` en `errores` | falta correr la migración de `supabase/schema.sql` que agrega `acreditada`, `acreditada_at` y `acreditada_nota` |

## 8. Límites y cuidados

- La API de Sheets es gratuita. Cuotas: 300 lecturas y 300 escrituras por minuto por proyecto; una corrida usa 1 lectura y 1 o 2 escrituras (más 1 token OAuth por hora, cacheado en memoria).
- Todo se escribe en modo `RAW`: ninguna celda se interpreta como fórmula, aunque un participante ponga `=…` en su nombre.
- Si dos sincronizaciones corren a la vez (cron + botón) y agregan la misma orden dos veces, la siguiente corrida borra la fila repetida y conserva la primera. Confirmar dos veces es inofensivo: el bloque es idempotente en la base (`asignar_participaciones` devuelve el mismo) y el mail se marca como enviado.
- Hasta 5 mil órdenes por edición sin problema (la base se lee en páginas de 1.000); la cantidad de números no importa, porque cada orden ocupa una sola fila con su bloque. La planilla no reemplaza al padrón oficial del sorteo: eso sigue siendo `/api/export` (el CSV que se publica antes de sortear).
- El archivo JSON de la service account es una llave a la planilla (y a cualquier otra que se le comparta): si se filtra, borrar la clave en Google Cloud (Cuenta de servicio → Claves) y crear otra.
