// Espejo de las órdenes en una planilla de Google Sheets, para que Gastón vea las
// transferencias desde cualquier lado y marque a mano si la plata llegó.
//
// Dos direcciones:
//   Supabase → Sheet   escribirFilas() hace upsert por orden_id (columna A). Las columnas
//                      "Llegó la plata" (Q) y "nota" (S) son de Gastón: el sistema solo las
//                      escribe cuando la base ya tiene un valor (acreditada / acreditada_nota);
//                      si no, deja lo que haya en la celda.
//   Sheet → Supabase   sincronizarSheet() lee Q y, donde dice SI/NO y la base tiene otra cosa,
//                      aplica marcarAcreditada(): misma lógica que la acción "acreditar" del
//                      panel (guarda acreditada / acreditada_at / acreditada_nota y, con SI
//                      sobre una transferencia pendiente o en revisión, confirma la orden:
//                      números + mail + WhatsApp). Con NO solo marca.
//
// Sin dependencias: el JWT RS256 de la service account se firma con node:crypto y se habla
// con la API REST de Sheets v4 por fetch. Todo se escribe en modo RAW (ninguna celda se
// interpreta como fórmula) y las fechas van como texto en hora de Buenos Aires.
//
// Variables: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (con los \n escapados, como
// los guarda Vercel, o reales), GOOGLE_SHEETS_ID (el id o la URL de la planilla) y
// GOOGLE_SHEETS_TAB (pestaña; default "Órdenes"). Ver docs/06-google-sheets.md.
import { createSign } from 'node:crypto';
import campaign from '../../config/campaign.json' with { type: 'json' };
import { baseUrl as baseUrlDe } from './http.js';
import { db, actualizarOrden, obtenerParticipaciones } from './db.js';
import { texto } from './validar.js';

export const ENCABEZADO = [
  'orden_id', 'fecha', 'nombre', 'apellido', 'dni', 'email', 'whatsapp', 'provincia', 'bici', 'pack',
  'chances', 'monto', 'estado', 'comprobante', 'IA: monto ok / destino ok', 'números', 'Llegó la plata',
  'acreditada_at', 'nota',
];
export const COL_LLEGO = ENCABEZADO.indexOf('Llegó la plata'); // Q
export const COL_NOTA = ENCABEZADO.indexOf('nota'); // S
// Marcas (SI/NO) que se aplican por corrida: cada SI manda mail y WhatsApp, y la función
// tiene 60 s. Lo que sobra queda para la corrida siguiente (`pendientes` en el resumen).
export const MAX_MARCAS_POR_CORRIDA = 20;

const TAB_DEFAULT = 'Órdenes';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TIMEOUT_MS = 15000;
const LOTE_MARCAS = 5; // acreditaciones en paralelo
const LOTE_RANGOS = 500; // rangos por llamada a values:batchUpdate
const PAGINA_DB = 1000; // Supabase devuelve como máximo 1000 filas por request
const TZ = 'America/Argentina/Buenos_Aires';

const letra = (i) => String.fromCharCode(65 + i); // 0 → A (la planilla tiene menos de 26 columnas)
const ULTIMA = letra(ENCABEZADO.length - 1); // S
const rango = (tab, ref) => `'${tab.replace(/'/g, "''")}'!${ref}`;
const celda = (v) => (v == null ? '' : String(v));
const valorCelda = (v) => (v == null ? '' : typeof v === 'number' ? v : String(v));
const trozos = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ------------------------------------------------------------------ configuración y auth

export function sheetsConfigurado() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_ID);
}

const sinComillas = (v) => String(v || '').trim().replace(/^["']|["']$/g, '');

function config() {
  if (!sheetsConfigurado()) throw new Error('sheets no configurado');
  const idOUrl = sinComillas(process.env.GOOGLE_SHEETS_ID);
  return {
    email: sinComillas(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    // Vercel guarda la clave con los saltos de línea escapados ("\n" literal); también se admite pegada con saltos reales.
    key: sinComillas(process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n'),
    id: (idOUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || idOUrl,
    tab: sinComillas(process.env.GOOGLE_SHEETS_TAB) || TAB_DEFAULT,
  };
}

let tokenCache = { email: '', token: '', vence: 0 };

function firmarJwt({ email, key }) {
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  // iat 30 s atrás: Google rechaza tokens "del futuro" si el reloj del servidor adelanta.
  const cuerpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: ahora - 30, exp: ahora + 3600 })}`;
  let firma;
  try {
    firma = createSign('RSA-SHA256').update(cuerpo).sign(key, 'base64url');
  } catch (err) {
    throw new Error(`[sheets] GOOGLE_PRIVATE_KEY inválida (pegá el private_key del JSON de la service account, con sus \\n): ${err.message}`);
  }
  return `${cuerpo}.${firma}`;
}

/** Token OAuth de la service account, cacheado en memoria hasta un minuto antes de vencer. */
async function token() {
  const { email, key } = config();
  if (tokenCache.email === email && tokenCache.vence > Date.now()) return tokenCache.token;
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: firmarJwt({ email, key }) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    throw new Error(`[sheets] token: ${data.error_description || data.error || `HTTP ${r.status}`}`);
  }
  tokenCache = { email, token: data.access_token, vence: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60e3 };
  return tokenCache.token;
}

const pista = (status) =>
  status === 403 ? ' (¿la planilla está compartida como Editor con el mail de la service account?)'
    : status === 404 ? ' (¿GOOGLE_SHEETS_ID correcto?)'
      : '';

/** Llamada a la API de Sheets v4 sobre la planilla configurada. `ruta` va después del id. */
async function llamarSheets(ruta, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API}/${config().id}${ruta}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(`[sheets] ${method} ${ruta || '/'}: ${data.error?.message || `HTTP ${r.status}`}${pista(r.status)}`);
    err.status = r.status;
    err.detalle = data.error?.message || '';
    throw err;
  }
  return data;
}

const pestanaInexistente = (err) => err?.status === 400 && /Unable to parse range/i.test(err.detalle || '');

let sheetIdCache = { clave: '', sheetId: null };

async function obtenerSheetId() {
  const { id, tab } = config();
  const clave = `${id}/${tab}`;
  if (sheetIdCache.clave === clave && sheetIdCache.sheetId != null) return sheetIdCache.sheetId;
  const meta = await llamarSheets('', { query: { fields: 'sheets.properties(sheetId,title)' } });
  const hoja = (meta.sheets || []).find((s) => s.properties?.title === tab);
  if (!hoja) return null;
  sheetIdCache = { clave, sheetId: hoja.properties.sheetId };
  return sheetIdCache.sheetId;
}

async function crearPestana() {
  const { id, tab } = config();
  const r = await llamarSheets(':batchUpdate', {
    method: 'POST',
    body: { requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] },
  });
  const sheetId = r.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId != null) sheetIdCache = { clave: `${id}/${tab}`, sheetId };
}

/** Una sola vez (cuando se escribe el encabezado): fila 1 fija y en negrita, lista SI/NO en Q, aviso al editar columnas del sistema. */
async function formatear() {
  const sheetId = await obtenerSheetId();
  if (sheetId == null) return;
  const cols = (desde, hasta) => ({ sheetId, startColumnIndex: desde, endColumnIndex: hasta });
  await llamarSheets(':batchUpdate', {
    method: 'POST',
    body: {
      requests: [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        {
          setDataValidation: {
            range: { ...cols(COL_LLEGO, COL_LLEGO + 1), startRowIndex: 1 },
            rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'SI' }, { userEnteredValue: 'NO' }] }, showCustomUi: true, strict: false },
          },
        },
        { addProtectedRange: { protectedRange: { range: cols(0, COL_LLEGO), warningOnly: true, description: 'Columnas que escribe el sistema: se pisan en cada sincronización' } } },
        { addProtectedRange: { protectedRange: { range: cols(COL_LLEGO + 1, COL_NOTA), warningOnly: true, description: 'acreditada_at la escribe el sistema' } } },
        { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: ENCABEZADO.length } } },
      ],
    },
  });
}

// ------------------------------------------------------------------ formato de las filas

const FMT_FECHA = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** "dd/mm/aaaa HH:MM" en hora de Buenos Aires; '' si no hay fecha. */
export function fechaBA(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(FMT_FECHA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Lo que Gastón escribió en "Llegó la plata": true (SI), false (NO) o null (vacío / otra cosa). */
export function interpretarLlego(valor) {
  const v = String(valor ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v === 'SI') return true;
  if (v === 'NO') return false;
  return null;
}

const nombreBici = (id) => campaign.bicis.find((b) => b.id === id)?.nombre || id || '';
const nombrePack = (id) => (id === 'gratuita' ? 'Sin cargo' : campaign.packs.find((p) => p.id === id)?.nombre || id || '');

/**
 * Fila de la planilla (19 celdas, en el orden de ENCABEZADO) para una orden. Q y S vienen
 * como null cuando la base no tiene valor: escribirFilas() no las toca en filas existentes.
 */
export function filaDeOrden(orden, numeros = []) {
  const checks = orden.comprobante_datos?.checks || null;
  const ia = checks ? `${checks.monto_ok ? 'OK' : 'NO'} / ${checks.destino_ok ? 'OK' : 'NO'}` : orden.comprobante_at ? 'sin lectura' : '';
  const monto = Number(orden.monto);
  return [
    orden.id,
    fechaBA(orden.created_at),
    celda(orden.nombre),
    celda(orden.apellido),
    celda(orden.dni),
    celda(orden.email),
    celda(orden.whatsapp),
    celda(orden.provincia),
    nombreBici(orden.bici_preferida),
    nombrePack(orden.pack_id),
    Number(orden.cantidad_participaciones) || 0,
    Number.isFinite(monto) ? monto : celda(orden.monto),
    celda(orden.estado),
    fechaBA(orden.comprobante_at),
    ia,
    (numeros || []).map((n) => String(n).padStart(4, '0')).join(', '),
    orden.acreditada == null ? null : orden.acreditada ? 'SI' : 'NO',
    fechaBA(orden.acreditada_at),
    orden.acreditada_nota == null ? null : String(orden.acreditada_nota),
  ];
}

// ------------------------------------------------------------------ lectura y escritura

/**
 * Lee la pestaña (por defecto A:S entera). Devuelve { encabezado, filas, porId }: cada fila es
 * { fila: número de fila en la planilla (1-based), orden_id, celdas: string[] } y porId mapea
 * orden_id → primera fila que lo tiene. Con `columnas: 'A:A'` solo trae los ids (más liviano).
 */
export async function leerFilas({ columnas = `A:${ULTIMA}` } = {}) {
  const { tab } = config();
  const data = await llamarSheets(`/values/${encodeURIComponent(rango(tab, columnas))}`, {
    query: { valueRenderOption: 'UNFORMATTED_VALUE', majorDimension: 'ROWS' },
  });
  const values = data.values || [];
  const encabezado = (values[0] || []).map(celda);
  const filas = [];
  const porId = new Map();
  for (let i = 1; i < values.length; i++) {
    const celdas = (values[i] || []).map(celda);
    const fila = { fila: i + 1, orden_id: celdas[0] || '', celdas };
    filas.push(fila);
    if (fila.orden_id && !porId.has(fila.orden_id)) porId.set(fila.orden_id, fila);
  }
  return { encabezado, filas, porId };
}

const encabezadoOk = (actual) => ENCABEZADO.every((h, i) => (actual || [])[i] === h);

/**
 * Garantiza que la pestaña exista y tenga el encabezado en la fila 1 (la crea si falta).
 * Se le puede pasar lo que devolvió leerFilas() para no volver a leer. Devuelve
 * { creada, encabezado_escrito }.
 */
export async function asegurarEncabezado(hoja) {
  const { tab } = config();
  let creada = false;
  let encabezado = hoja?.encabezado;
  if (!encabezado) {
    try {
      ({ encabezado } = await leerFilas({ columnas: `A1:${ULTIMA}1` }));
    } catch (err) {
      if (!pestanaInexistente(err)) throw err;
      await crearPestana();
      creada = true;
      encabezado = [];
    }
  }
  if (!creada && encabezadoOk(encabezado)) return { creada: false, encabezado_escrito: false };
  await llamarSheets(`/values/${encodeURIComponent(rango(tab, `A1:${ULTIMA}1`))}`, {
    method: 'PUT',
    query: { valueInputOption: 'RAW' },
    body: { values: [ENCABEZADO] },
  });
  if (creada || !encabezado.length) {
    await formatear().catch((err) => console.warn('[sheets] no se pudo dar formato a la pestaña:', err.message || err));
  }
  return { creada, encabezado_escrito: true };
}

/**
 * Tramos contiguos de una fila existente que hay que escribir: todas las columnas menos Q y
 * S cuando la base no tiene valor (null), que son de Gastón. Vacío si nada cambió.
 */
function segmentos(fila, previas) {
  const escribir = fila.map((v, j) => !((j === COL_LLEGO || j === COL_NOTA) && v == null));
  const cambio = fila.some((v, j) => escribir[j] && String(valorCelda(v)) !== celda(previas[j]));
  if (!cambio) return [];
  const out = [];
  fila.forEach((v, j) => {
    if (!escribir[j]) return;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.hasta === j - 1) {
      ultimo.hasta = j;
      ultimo.valores.push(valorCelda(v));
    } else {
      out.push({ desde: j, hasta: j, valores: [valorCelda(v)] });
    }
  });
  return out;
}

/**
 * Upsert por orden_id (columna A): las filas que ya están se actualizan en su lugar (solo si
 * algo cambió, y sin pisar Q/S), las nuevas se agregan al final. `filas` son arrays de 19
 * valores (filaDeOrden). `existentes` permite reutilizar una lectura previa (leerFilas).
 * Devuelve { actualizadas, agregadas }.
 */
export async function escribirFilas(filas, { existentes } = {}) {
  const { tab } = config();
  const hoja = existentes || (await leerFilas());
  const data = [];
  const nuevas = [];
  let actualizadas = 0;
  for (const fila of filas) {
    const previa = hoja.porId.get(celda(fila[0]));
    if (!previa) {
      nuevas.push(fila.map(valorCelda));
      continue;
    }
    const segs = segmentos(fila, previa.celdas);
    if (!segs.length) continue;
    actualizadas += 1;
    for (const s of segs) {
      data.push({ range: rango(tab, `${letra(s.desde)}${previa.fila}:${letra(s.hasta)}${previa.fila}`), values: [s.valores] });
    }
  }
  for (const parte of trozos(data, LOTE_RANGOS)) {
    await llamarSheets('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data: parte } });
  }
  if (nuevas.length) {
    await llamarSheets(`/values/${encodeURIComponent(rango(tab, `A:${ULTIMA}`))}:append`, {
      method: 'POST',
      query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
      body: { values: nuevas },
    });
  }
  return { actualizadas, agregadas: nuevas.length };
}

async function borrarFilas(numerosDeFila) {
  const sheetId = await obtenerSheetId();
  if (sheetId == null) throw new Error('[sheets] no se encontró la pestaña para borrar filas repetidas');
  const requests = [...numerosDeFila]
    .sort((a, b) => b - a) // de abajo hacia arriba, para que no se corran los índices
    .map((n) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: n - 1, endIndex: n } } }));
  await llamarSheets(':batchUpdate', { method: 'POST', body: { requests } });
}

/** Lectura completa lista para sincronizar: crea la pestaña / encabezado si faltan y borra filas repetidas. */
async function leerHojaLista() {
  let hoja;
  try {
    hoja = await leerFilas();
  } catch (err) {
    if (!pestanaInexistente(err)) throw err;
    await asegurarEncabezado();
    hoja = await leerFilas();
  }
  if (!encabezadoOk(hoja.encabezado)) await asegurarEncabezado(hoja);
  // Dos sincronizaciones a la vez pueden agregar la misma orden dos veces: se conserva la primera.
  const repetidas = hoja.filas.filter((f) => f.orden_id && hoja.porId.get(f.orden_id) !== f);
  if (repetidas.length) {
    console.warn(`[sheets] ${repetidas.length} fila(s) repetida(s) en la planilla; se borran`);
    await borrarFilas(repetidas.map((f) => f.fila));
    hoja = await leerFilas();
  }
  return hoja;
}

// ------------------------------------------------------------------ base de datos

async function todas(construir) {
  const out = [];
  for (let desde = 0; ; desde += PAGINA_DB) {
    const { data, error } = await construir().range(desde, desde + PAGINA_DB - 1);
    if (error) throw new Error(`[db] ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGINA_DB) return out;
  }
}

/** Órdenes de la edición (por fecha de creación) y números asignados por orden. */
async function cargarOrdenes(edicionId) {
  const ordenes = await todas(() => db().from('ordenes').select('*').eq('edicion_id', edicionId).order('created_at', { ascending: true }));
  const participaciones = await todas(() => db().from('participaciones').select('orden_id,numero').eq('edicion_id', edicionId).order('numero', { ascending: true }));
  const numerosPorOrden = new Map();
  for (const p of participaciones) {
    if (!numerosPorOrden.has(p.orden_id)) numerosPorOrden.set(p.orden_id, []);
    numerosPorOrden.get(p.orden_id).push(p.numero);
  }
  return { ordenes, numerosPorOrden };
}

/**
 * Misma lógica que la acción "acreditar" del panel (api/admin.js): solo transferencias; guarda
 * acreditada, acreditada_at, acreditada_nota, revisado_por y revisado_at y, si es SI sobre una
 * orden pendiente o en revisión, la confirma (números + mail + WhatsApp, idempotente). Con NO,
 * o con SI sobre una orden cerrada, solo marca: rechazar sigue siendo una decisión del panel.
 * Devuelve { orden, numeros, confirmada }.
 */
export async function marcarAcreditada({ orden, acreditada, nota = null, baseUrl, revisor = 'planilla' }) {
  if (orden.medio_pago !== 'transferencia') throw new Error(`Solo se concilian transferencias (esta orden es ${orden.medio_pago})`);
  const ahora = new Date().toISOString();
  const marca = {
    acreditada: Boolean(acreditada),
    acreditada_at: ahora,
    acreditada_nota: texto(nota, 300) || null,
    revisado_por: revisor,
    revisado_at: ahora,
  };
  if (!(Boolean(acreditada) && ['pendiente', 'en_revision'].includes(orden.estado))) {
    return { orden: await actualizarOrden(orden.id, marca), numeros: null, confirmada: false };
  }
  // Import dinámico para no armar un ciclo confirmar.js ⇄ sheets.js cuando confirmarOrden llame al hook.
  const { confirmarOrden } = await import('./confirmar.js');
  const { orden: actual, numeros } = await confirmarOrden({ orden, campaign, baseUrl: baseUrl || baseUrlDe(null), cambios: marca });
  return { orden: actual, numeros, confirmada: true };
}

// ------------------------------------------------------------------ sincronización

// Mientras corre una sincronización, el hook espejarOrdenEnSheet no hace nada: las órdenes que
// confirma la propia sincronización se escriben todas juntas al final.
let sincronizando = false;

/**
 * Sincronización completa (la llama /api/sheets-sync):
 *   1) Sheet → base: aplica los SI/NO de "Llegó la plata" que la base todavía no tiene (y las
 *      notas de S de esas filas), de a MAX_MARCAS_POR_CORRIDA por corrida.
 *   2) base → Sheet: upsert de todas las órdenes de la edición.
 * Devuelve { ok, filas_escritas, marcadas_si, marcadas_no, pendientes, errores } o, sin
 * configuración, { ok: false, motivo }.
 */
export async function sincronizarSheet({ edicionId = campaign.edicion.id, baseUrl, revisor = 'planilla' } = {}) {
  if (!sheetsConfigurado()) return { ok: false, motivo: 'sheets no configurado' };
  if (sincronizando) return { ok: false, motivo: 'ya hay una sincronización en curso' };
  sincronizando = true;
  try {
    const resumen = { ok: true, filas_escritas: 0, marcadas_si: 0, marcadas_no: 0, pendientes: 0, errores: [] };
    const hoja = await leerHojaLista();
    const { ordenes, numerosPorOrden } = await cargarOrdenes(edicionId);
    const porId = new Map(ordenes.map((o) => [o.id, o]));

    // 1) Lo que Gastón marcó en la planilla y la base todavía no tiene.
    const marcas = [];
    for (const f of hoja.filas) {
      const llego = interpretarLlego(f.celdas[COL_LLEGO]);
      if (llego == null) continue;
      const orden = porId.get(f.orden_id);
      if (!orden) {
        resumen.errores.push(`fila ${f.fila}: la orden ${f.orden_id || '(sin id)'} no existe en la edición ${edicionId}`);
        continue;
      }
      const nota = texto(f.celdas[COL_NOTA], 300) || null;
      if ((orden.acreditada ?? null) === llego) {
        if (nota !== (orden.acreditada_nota ?? null)) marcas.push({ fila: f.fila, orden, nota, soloNota: true });
        continue;
      }
      marcas.push({ fila: f.fila, orden, llego, nota });
    }
    const aplicar = marcas.slice(0, MAX_MARCAS_POR_CORRIDA);
    resumen.pendientes = marcas.length - aplicar.length;
    for (const lote of trozos(aplicar, LOTE_MARCAS)) {
      const resultados = await Promise.allSettled(
        lote.map(async (m) => {
          if (m.soloNota) {
            porId.set(m.orden.id, await actualizarOrden(m.orden.id, { acreditada_nota: m.nota }));
            return;
          }
          const { orden, numeros } = await marcarAcreditada({ orden: m.orden, acreditada: m.llego, nota: m.nota, baseUrl, revisor });
          porId.set(orden.id, orden);
          if (numeros?.length) numerosPorOrden.set(orden.id, numeros);
          resumen[m.llego ? 'marcadas_si' : 'marcadas_no'] += 1;
        }),
      );
      resultados.forEach((r, i) => {
        if (r.status === 'rejected') resumen.errores.push(`fila ${lote[i].fila} (${lote[i].orden.id}): ${r.reason?.message || r.reason}`);
      });
    }

    // 2) Espejo de todas las órdenes de la edición.
    const filas = [...porId.values()].map((o) => filaDeOrden(o, numerosPorOrden.get(o.id) || []));
    const { actualizadas, agregadas } = await escribirFilas(filas, { existentes: hoja });
    resumen.filas_escritas = actualizadas + agregadas;
    return resumen;
  } finally {
    sincronizando = false;
  }
}

/**
 * Hook para llamar después de cada cambio de estado de una orden (checkout, confirmación,
 * rechazo, acreditación). Escribe/actualiza esa fila en la planilla. Nunca lanza: si Sheets no
 * está configurado o falla, loguea y devuelve false (el cron de /api/sheets-sync la espeja después).
 */
export async function espejarOrdenEnSheet(orden, { numeros } = {}) {
  if (!sheetsConfigurado() || sincronizando || !orden?.id) return false;
  try {
    let nums = numeros;
    if (!nums && orden.estado === 'pagada') nums = await obtenerParticipaciones(orden.id);
    let hoja;
    try {
      hoja = await leerFilas({ columnas: 'A:A' });
    } catch (err) {
      if (!pestanaInexistente(err)) throw err;
      await asegurarEncabezado();
      hoja = await leerFilas({ columnas: 'A:A' });
    }
    if (hoja.encabezado[0] !== ENCABEZADO[0]) await asegurarEncabezado();
    await escribirFilas([filaDeOrden(orden, nums || [])], { existentes: hoja });
    return true;
  } catch (err) {
    console.error(`[sheets] no se pudo espejar la orden ${orden.id}:`, err.message || err);
    return false;
  }
}
