// Confirmación de una orden (la usan el webhook de Mercado Pago, la aprobación
// de transferencias desde el panel y la vía gratuita):
//   1) marca la orden como pagada, 2) le asigna su bloque correlativo de números (atómico e
//   idempotente), 3) manda mail y WhatsApp una sola vez. Devuelve la orden actualizada y el
//   bloque como `rango` = { desde, hasta, cantidad }.
//
// "Una sola vez" se garantiza con un update condicional en la base
// (`update ... set email_enviado_at = now() where id = $1 and email_enviado_at is null`):
// si dos notificaciones del mismo pago llegan a la vez, solo una gana el reclamo y
// manda; si el envío falla, se libera la marca para que un reintento lo vuelva a intentar.
import { actualizarOrden, asignarParticipaciones, reclamarMarca, liberarMarca } from './db.js';
import { armarMailConfirmacion, enviarMail, enviarWhatsApp, whatsappConfigurado } from './notificaciones.js';
import { espejarOrdenEnSheet } from './sheets.js';

export async function confirmarOrden({ orden, campaign, baseUrl, cambios = {}, gratuita = false }) {
  let actual = orden;
  if (orden.estado !== 'pagada') {
    actual = await actualizarOrden(orden.id, {
      estado: 'pagada',
      pagada_at: cambios.pagada_at || new Date().toISOString(),
      ...cambios,
    });
  }

  const rango = await asignarParticipaciones(actual.id);
  actual = { ...actual, numero_desde: rango.desde, numero_hasta: rango.hasta };

  if (!actual.email_enviado_at && (await reclamarMarca(actual.id, 'email_enviado_at'))) {
    try {
      const mail = armarMailConfirmacion({ orden: actual, rango, campaign, baseUrl, gratuita });
      await enviarMail({ to: actual.email, ...mail });
      actual = { ...actual, email_enviado_at: new Date().toISOString() };
    } catch (err) {
      console.error(`[confirmar] mail de la orden ${actual.id}:`, err.message || err);
      await liberarMarca(actual.id, 'email_enviado_at').catch((e) => console.error('[confirmar] liberar marca mail', e.message));
    }
  }

  if (!gratuita && !actual.whatsapp_enviado_at && whatsappConfigurado() && (await reclamarMarca(actual.id, 'whatsapp_enviado_at'))) {
    try {
      await enviarWhatsApp({ orden: actual, rango, campaign, baseUrl });
      actual = { ...actual, whatsapp_enviado_at: new Date().toISOString() };
    } catch (err) {
      console.error(`[confirmar] whatsapp de la orden ${actual.id}:`, err.message || err);
      await liberarMarca(actual.id, 'whatsapp_enviado_at').catch((e) => console.error('[confirmar] liberar marca whatsapp', e.message));
    }
  }

  // Espejo en Google Sheets (no lanza: si la planilla no está configurada, no hace nada).
  await espejarOrdenEnSheet(actual, { rango });
  return { orden: actual, rango };
}
