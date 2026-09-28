// POST /api/webhooks/mercadopago
// Mercado Pago avisa acá cada cambio de un pago. Se consulta el pago en la API de MP
// (nunca se confía en el body) y se aplica a la orden con api/_lib/pagos-mp.js.
//
// Respuestas: 200 para todo lo que no tiene sentido reintentar (notificación que no es
// de pago, pago inexistente, orden inexistente, pago que no corresponde confirmar);
// 401 si la firma no es válida; 500 SOLO ante fallas transitorias (base, red, MP caído),
// que es cuando conviene que MP reintente.
import campaign from '../../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl } from '../_lib/http.js';
import { obtenerOrden } from '../_lib/db.js';
import { obtenerPago, verificarFirmaWebhook } from '../_lib/mercadopago.js';
import { aplicarPago } from '../_lib/pagos-mp.js';
import { RE_UUID } from '../_lib/validar.js';

// Antigüedad máxima del `ts` de la firma (evita replays de notificaciones capturadas).
const MAX_ANTIGUEDAD_SEG = 10 * 60;

const esProduccion = () => process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

// Un 4xx de la API de MP (pago inexistente, id inválido) no se arregla reintentando.
// 401/403 (credenciales) y 429 sí pueden resolverse más tarde.
const errorNoRecuperable = (err) => Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 && ![401, 403, 429].includes(err.status);

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  const query = getQuery(req);
  const body = readJson(req);

  const tipo = query.type || query.topic || body.type || body.action?.split('.')[0];
  const dataId = query['data.id'] || body.data?.id || query.id;

  if (tipo !== 'payment' || !dataId) {
    return json(res, 200, { ignored: true, motivo: 'no es una notificación de pago' });
  }

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    if (esProduccion()) {
      console.error('[webhook mp] falta MP_WEBHOOK_SECRET en producción: notificación rechazada (configurarla en Vercel)');
      return json(res, 401, { error: 'Webhook sin clave secreta configurada' });
    }
    console.warn('[webhook mp] MP_WEBHOOK_SECRET no configurado: firma NO verificada (solo admitido fuera de producción)');
  } else {
    const ok = verificarFirmaWebhook({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId,
      secret,
      maxAntiguedadSeg: MAX_ANTIGUEDAD_SEG,
    });
    if (!ok) {
      console.warn('[webhook mp] firma inválida o vencida para el pago', dataId);
      return json(res, 401, { error: 'Firma inválida' });
    }
  }

  let pago;
  try {
    pago = await obtenerPago(dataId);
  } catch (err) {
    if (errorNoRecuperable(err)) {
      console.warn(`[webhook mp] pago ${dataId} no consultable (HTTP ${err.status}): se ignora`);
      return json(res, 200, { ignored: true, motivo: `pago no consultable (${err.status})` });
    }
    console.error('[webhook mp] consultando el pago', dataId, err.message || err);
    return json(res, 500, { error: 'Error consultando el pago' });
  }

  try {
    const ordenId = String(pago.external_reference || pago.metadata?.orden_id || '');
    if (!RE_UUID.test(ordenId)) {
      // Pago de otra integración de la misma cuenta de MP (Tienda Nube, etc.) o sin referencia.
      return json(res, 200, { ignored: true, motivo: 'pago sin external_reference de una orden' });
    }

    const orden = await obtenerOrden(ordenId);
    if (!orden) {
      console.warn(`[webhook mp] pago ${dataId} referencia la orden ${ordenId}, que no existe`);
      return json(res, 200, { ignored: true, motivo: 'orden inexistente' });
    }

    const out = await aplicarPago({ pago, orden, campaign, baseUrl: baseUrl(req) });
    return json(res, 200, { ok: true, ...out });
  } catch (err) {
    console.error('[webhook mp] pago', dataId, err.message || err);
    // 500 => Mercado Pago reintenta la notificación más tarde.
    return json(res, 500, { error: 'Error procesando la notificación' });
  }
}
