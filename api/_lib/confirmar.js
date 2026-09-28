// Confirmación de una orden (la usan el webhook de Mercado Pago, la aprobación
// de transferencias desde el panel y la vía gratuita):
//   1) marca la orden como pagada, 2) asigna los números (atómico e idempotente),
//   3) manda mail y WhatsApp una sola vez. Devuelve la orden actualizada y los números.
import { actualizarOrden, asignarParticipaciones } from './db.js';
import { armarMailConfirmacion, enviarMail, enviarWhatsApp, whatsappConfigurado } from './notificaciones.js';

export async function confirmarOrden({ orden, campaign, baseUrl, cambios = {}, gratuita = false }) {
  let actual = orden;
  if (orden.estado !== 'pagada') {
    actual = await actualizarOrden(orden.id, {
      estado: 'pagada',
      pagada_at: cambios.pagada_at || new Date().toISOString(),
      ...cambios,
    });
  }

  const numeros = await asignarParticipaciones(actual.id);

  if (!actual.email_enviado_at) {
    try {
      const mail = armarMailConfirmacion({ orden: actual, numeros, campaign, baseUrl, gratuita });
      await enviarMail({ to: actual.email, ...mail });
      actual = await actualizarOrden(actual.id, { email_enviado_at: new Date().toISOString() });
    } catch (err) {
      console.error('[confirmar] mail', err);
    }
  }

  if (!gratuita && !actual.whatsapp_enviado_at && whatsappConfigurado()) {
    try {
      await enviarWhatsApp({ orden: actual, numeros, campaign, baseUrl });
      actual = await actualizarOrden(actual.id, { whatsapp_enviado_at: new Date().toISOString() });
    } catch (err) {
      console.error('[confirmar] whatsapp', err);
    }
  }

  return { orden: actual, numeros };
}
