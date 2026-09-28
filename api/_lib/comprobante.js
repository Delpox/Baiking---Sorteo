// Comprobantes de transferencia: guardado en Supabase Storage, lectura con la
// API de Claude (imagen o PDF → JSON) y chequeos contra la orden.
//
// Regla de oro: la IA LEE el comprobante, no lo VALIDA. Un comprobante puede
// estar editado. Por eso, salvo que TRANSFERENCIAS_AUTO_APROBAR=true, la orden
// queda "en_revision" y alguien la aprueba desde el panel (idealmente después
// de ver la acreditación en el home banking o en Mercado Pago).
import Anthropic from '@anthropic-ai/sdk';
import { db, actualizarOrden } from './db.js';
import { confirmarOrden } from './confirmar.js';
import { armarMailComprobanteRecibido, enviarMail } from './notificaciones.js';

export const BUCKET = 'comprobantes';
export const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

// Esquema de lo que devuelve la lectura (salida estructurada de la API).
const ESQUEMA_LECTURA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    es_comprobante: { type: 'boolean', description: 'true si el archivo es un comprobante de transferencia o pago' },
    monto_encontrado: { type: 'boolean' },
    monto: { type: 'number', description: 'importe transferido en pesos, 0 si no se ve' },
    moneda: { type: 'string' },
    fecha: { type: 'string', description: 'fecha de la operación en formato YYYY-MM-DD, vacío si no se ve' },
    hora: { type: 'string' },
    destino_alias: { type: 'string' },
    destino_cbu: { type: 'string', description: 'CBU o CVU de destino, solo dígitos' },
    destino_titular: { type: 'string' },
    destino_cuit: { type: 'string' },
    origen_nombre: { type: 'string' },
    origen_cuit: { type: 'string' },
    banco_o_app: { type: 'string', description: 'banco o billetera desde donde se hizo (Galicia, Mercado Pago, Ualá, etc.)' },
    referencia: { type: 'string', description: 'concepto, motivo o referencia tal cual aparece' },
    numero_operacion: { type: 'string' },
    codigos_detectados: { type: 'array', items: { type: 'string' }, description: 'cualquier código con formato BK-XXXXX que aparezca' },
    senales_de_edicion: { type: 'array', items: { type: 'string' }, description: 'indicios de que la imagen fue editada (tipografías distintas, alineaciones raras, recortes)' },
    confianza: { type: 'number', description: 'de 0 a 1, qué tan legible y completo es el comprobante' },
    observaciones: { type: 'string' },
  },
  required: [
    'es_comprobante', 'monto_encontrado', 'monto', 'moneda', 'fecha', 'hora', 'destino_alias', 'destino_cbu',
    'destino_titular', 'destino_cuit', 'origen_nombre', 'origen_cuit', 'banco_o_app', 'referencia',
    'numero_operacion', 'codigos_detectados', 'senales_de_edicion', 'confianza', 'observaciones',
  ],
};

const SISTEMA = `Leés comprobantes de transferencias y pagos de Argentina (home banking de bancos, Mercado Pago, Ualá, Brubank, MODO, Naranja X, Cuenta DNI, etc.) y devolvés los datos exactamente como aparecen.
Reglas: no inventes ni completes datos que no se vean; si algo no está, dejalo vacío (o 0 / false). Copiá montos como números sin separadores de miles. Si el documento no es un comprobante, marcá es_comprobante=false. Reportá en senales_de_edicion cualquier indicio de que la imagen fue modificada. Respondé solo con el JSON pedido.`;

export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Lee un comprobante (imagen, PDF o texto) con la API de Claude.
 * Devuelve el objeto del esquema, o null si la IA no está configurada o rechazó la lectura.
 */
export async function leerComprobante({ buffer, tipo, texto }) {
  if (!iaConfigurada()) return null;
  const client = new Anthropic();

  const contenido = [];
  if (tipo === 'application/pdf') {
    contenido.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
  } else if (tipo && tipo.startsWith('image/')) {
    contenido.push({ type: 'image', source: { type: 'base64', media_type: tipo, data: buffer.toString('base64') } });
  } else if (texto) {
    contenido.push({ type: 'text', text: `Texto del comprobante recibido por mail:\n\n${String(texto).slice(0, 12000)}` });
  } else {
    return null;
  }
  contenido.push({ type: 'text', text: 'Extraé los datos de este comprobante.' });

  const respuesta = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_LECTURA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: contenido }],
  });

  if (respuesta.stop_reason === 'refusal') {
    console.warn('[comprobante] la lectura fue rechazada', respuesta.stop_details);
    return null;
  }
  const bloque = respuesta.content.find((b) => b.type === 'text');
  if (!bloque) return null;
  try {
    return JSON.parse(bloque.text);
  } catch {
    console.error('[comprobante] respuesta no es JSON', bloque.text.slice(0, 200));
    return null;
  }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const pendienteConfig = (v) => !v || /A CONFIRMAR/i.test(String(v));

/** Compara lo leído con la orden y la cuenta configurada. */
export function evaluarComprobante(lectura, orden, transferencia) {
  if (!lectura) return null;
  const monto_ok = Boolean(lectura.monto_encontrado) && Math.abs(Number(lectura.monto) - Number(orden.monto)) < 1;

  const esperados = [transferencia.alias, transferencia.cbu, transferencia.cuit].filter((v) => !pendienteConfig(v));
  const leidos = [lectura.destino_alias, lectura.destino_cbu, lectura.destino_cuit].map(norm).filter(Boolean);
  const titularOk =
    !pendienteConfig(transferencia.titular) &&
    norm(lectura.destino_titular).length > 4 &&
    (norm(lectura.destino_titular).includes(norm(transferencia.titular)) || norm(transferencia.titular).includes(norm(lectura.destino_titular)));
  const destino_ok = titularOk || esperados.some((v) => leidos.some((x) => x === norm(v) || (x.length >= 8 && norm(v).endsWith(x)) || (norm(v).length >= 8 && x.endsWith(norm(v)))));

  const textos = [lectura.referencia, lectura.observaciones, ...(lectura.codigos_detectados || [])].map(norm);
  const codigo_ok = Boolean(orden.codigo) && textos.some((t) => t.includes(norm(orden.codigo)));

  let fecha_ok = false;
  if (lectura.fecha) {
    const diff = Date.now() - new Date(`${lectura.fecha}T12:00:00-03:00`).getTime();
    fecha_ok = Number.isFinite(diff) && diff > -2 * 864e5 && diff < 10 * 864e5;
  }
  const sin_edicion = !(lectura.senales_de_edicion || []).length;
  const confianza = Number(lectura.confianza || 0);
  const es_comprobante = Boolean(lectura.es_comprobante);
  const aprobable = es_comprobante && monto_ok && destino_ok && codigo_ok && fecha_ok && sin_edicion && confianza >= 0.8;
  return { es_comprobante, monto_ok, destino_ok, codigo_ok, fecha_ok, sin_edicion, confianza, aprobable };
}

export async function guardarArchivo({ ordenId, buffer, tipo }) {
  const ext = TIPOS[tipo];
  if (!ext) throw new Error('Tipo de archivo no soportado');
  const ruta = `${ordenId}/${Date.now()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(ruta, buffer, { contentType: tipo, upsert: false });
  if (error) throw new Error(`[storage] ${error.message}`);
  return ruta;
}

export async function urlFirmada(ruta, segundos = 300) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(ruta, segundos);
  if (error) throw new Error(`[storage] ${error.message}`);
  return data.signedUrl;
}

/**
 * Flujo completo: guarda el archivo, lo lee, evalúa, actualiza la orden y
 * (si corresponde) aprueba automáticamente o manda el acuse de recibo.
 */
export async function procesarComprobante({ orden, buffer, tipo, nombre, texto, campaign, baseUrl, origen = 'web' }) {
  const transferencia = campaign.checkout.transferencia || {};
  const ruta = await guardarArchivo({ ordenId: orden.id, buffer: buffer || Buffer.from(String(texto || ''), 'utf8'), tipo: buffer ? tipo : 'text/plain' });

  let lectura = null;
  try {
    lectura = await leerComprobante({ buffer, tipo, texto });
  } catch (err) {
    console.error('[comprobante] lectura', err);
  }
  const checks = evaluarComprobante(lectura, orden, transferencia);

  const datos = {
    ...(orden.comprobante_datos || {}),
    origen,
    archivo: String(nombre || '').slice(0, 120),
    lectura,
    checks,
    monto_leido: lectura?.monto_encontrado ? Number(lectura.monto) : null,
    fecha_leida: lectura?.fecha || null,
    destino_ok: checks ? checks.destino_ok : null,
    codigo_ok: checks ? checks.codigo_ok : null,
  };

  let actual = await actualizarOrden(orden.id, {
    comprobante_url: ruta,
    comprobante_datos: datos,
    comprobante_at: new Date().toISOString(),
    estado: orden.estado === 'pagada' ? 'pagada' : 'en_revision',
  });

  if (actual.estado !== 'pagada' && process.env.TRANSFERENCIAS_AUTO_APROBAR === 'true' && checks?.aprobable) {
    const { numeros } = await confirmarOrden({
      orden: actual,
      campaign,
      baseUrl,
      cambios: { revisado_por: 'auto', revisado_at: new Date().toISOString() },
    });
    return { estado: 'pagada', checks, numeros };
  }

  if (actual.estado !== 'pagada' && !datos.mail_recibido_at) {
    try {
      const mail = armarMailComprobanteRecibido({ orden: actual, campaign, baseUrl });
      await enviarMail({ to: actual.email, ...mail });
      actual = await actualizarOrden(orden.id, { comprobante_datos: { ...datos, mail_recibido_at: new Date().toISOString() } });
    } catch (err) {
      console.error('[comprobante] mail acuse', err);
    }
  }
  return { estado: actual.estado, checks };
}
