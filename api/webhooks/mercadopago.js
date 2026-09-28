// POST /api/webhooks/mercadopago
// Mercado Pago avisa acá cada cambio de un pago. Si quedó aprobado, confirmamos
// la orden (números + mail + WhatsApp) vía api/_lib/confirmar.js.
// Siempre respondemos 200 rápido; MP reintenta si no.
import campaign from '../../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl } from '../_lib/http.js';
import { obtenerOrden, actualizarOrden } from '../_lib/db.js';
import { obtenerPago, verificarFirmaWebhook, mapearEstadoPago } from '../_lib/mercadopago.js';
import { confirmarOrden } from '../_lib/confirmar.js';

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
  if (secret) {
    const ok = verificarFirmaWebhook({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId,
      secret,
    });
    if (!ok) {
      console.warn('[webhook mp] firma inválida para pago', dataId);
      return json(res, 401, { error: 'Firma inválida' });
    }
  }

  try {
    const pago = await obtenerPago(dataId);
    const ordenId = pago.external_reference || pago.metadata?.orden_id;
    if (!ordenId) return json(res, 200, { ignored: true, motivo: 'pago sin external_reference' });

    const orden = await obtenerOrden(ordenId);
    if (!orden) return json(res, 200, { ignored: true, motivo: 'orden inexistente' });

    const estado = mapearEstadoPago(pago.status);

    if (estado !== 'pagada') {
      // Un reembolso o contracargo posterior deja constancia; los números ya
      // asignados se excluyen del padrón porque la vista filtra estado = 'pagada'.
      if (orden.estado !== estado) {
        await actualizarOrden(orden.id, { estado, mp_payment_id: String(pago.id) });
      }
      return json(res, 200, { ok: true, estado });
    }

    const { numeros } = await confirmarOrden({
      orden,
      campaign,
      baseUrl: baseUrl(req),
      cambios: {
        mp_payment_id: String(pago.id),
        pagada_at: new Date(pago.date_approved || Date.now()).toISOString(),
      },
    });

    return json(res, 200, { ok: true, estado: 'pagada', numeros });
  } catch (err) {
    console.error('[webhook mp]', err);
    // 500 => Mercado Pago reintenta la notificación más tarde.
    return json(res, 500, { error: 'Error procesando la notificación' });
  }
}
