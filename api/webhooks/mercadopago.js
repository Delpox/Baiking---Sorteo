// POST /api/webhooks/mercadopago
// Mercado Pago avisa acá cada cambio de un pago. Si quedó aprobado:
//   1) marcamos la orden como pagada,
//   2) asignamos los números de participación (atómico e idempotente),
//   3) mandamos el mail y el WhatsApp de confirmación.
// Siempre respondemos 200 rápido; MP reintenta si no.
import campaign from '../../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl } from '../_lib/http.js';
import { obtenerOrden, actualizarOrden, asignarParticipaciones } from '../_lib/db.js';
import { obtenerPago, verificarFirmaWebhook, mapearEstadoPago } from '../_lib/mercadopago.js';
import {
  armarMailConfirmacion,
  enviarMail,
  enviarWhatsApp,
  whatsappConfigurado,
} from '../_lib/notificaciones.js';

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
      if (orden.estado !== 'pagada') {
        await actualizarOrden(orden.id, { estado, mp_payment_id: String(pago.id) });
      }
      return json(res, 200, { ok: true, estado });
    }

    // Pago aprobado ---------------------------------------------------------
    let ordenActual = orden;
    if (orden.estado !== 'pagada') {
      ordenActual = await actualizarOrden(orden.id, {
        estado: 'pagada',
        mp_payment_id: String(pago.id),
        pagada_at: new Date(pago.date_approved || Date.now()).toISOString(),
      });
    }

    const numeros = await asignarParticipaciones(orden.id);
    const base = baseUrl(req);

    if (!ordenActual.email_enviado_at) {
      try {
        const mail = armarMailConfirmacion({ orden: ordenActual, numeros, campaign, baseUrl: base });
        await enviarMail({ to: ordenActual.email, ...mail });
        await actualizarOrden(orden.id, { email_enviado_at: new Date().toISOString() });
      } catch (err) {
        console.error('[webhook mp] mail', err);
      }
    }

    if (!ordenActual.whatsapp_enviado_at && whatsappConfigurado()) {
      try {
        await enviarWhatsApp({ orden: ordenActual, numeros, campaign, baseUrl: base });
        await actualizarOrden(orden.id, { whatsapp_enviado_at: new Date().toISOString() });
      } catch (err) {
        console.error('[webhook mp] whatsapp', err);
      }
    }

    return json(res, 200, { ok: true, estado: 'pagada', numeros });
  } catch (err) {
    console.error('[webhook mp]', err);
    // 500 => Mercado Pago reintenta la notificación más tarde.
    return json(res, 500, { error: 'Error procesando la notificación' });
  }
}
