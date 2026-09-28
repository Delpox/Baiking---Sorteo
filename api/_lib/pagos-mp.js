// Aplica el estado de un pago de Mercado Pago a su orden. Lo usan el webhook
// (api/webhooks/mercadopago.js) y la acción "sincronizar_mp" del panel (api/admin.js),
// que sirve para recuperar una orden si un webhook se perdió.
//
// Reglas:
//  - Una orden ya `pagada` NUNCA se degrada por un pago distinto del que la pagó
//    (Checkout Pro permite varios intentos sobre la misma preferencia: una tarjeta
//    rechazada y luego otra aprobada son dos pagos con el mismo external_reference).
//    Solo un reembolso / contracargo del MISMO mp_payment_id la pasa a `reembolsada`.
//  - Antes de confirmar se verifica monto ≥ orden.monto, moneda, que no haya reembolso
//    parcial y que el pago se haya acreditado antes de `campaign.edicion.cierre_ventas`.
//    Si algo no cierra, la orden queda `en_revision` con una nota (el panel la lista
//    para que Baiking decida y reembolse) sin asignar números ni mandar mail.
//  - Cada intento relevante queda anotado en comprobante_datos (auditoría).
import { actualizarOrden, actualizarOrdenSiEstado } from './db.js';
import { mapearEstadoPago } from './mercadopago.js';
import { confirmarOrden } from './confirmar.js';

const anotar = (orden, extra) => ({ ...(orden.comprobante_datos || {}), ...extra });

const resumenPago = (pago) => ({
  id: String(pago.id),
  status: pago.status || null,
  status_detail: pago.status_detail || null,
  monto: pago.transaction_amount ?? null,
  moneda: pago.currency_id || null,
  reembolsado: pago.transaction_amount_refunded ?? 0,
  aprobado_at: pago.date_approved || null,
  visto_at: new Date().toISOString(),
});

/** Problemas que impiden confirmar un pago aprobado (vacío si se puede confirmar). */
export function problemasDelPago(pago, orden, campaign, ahora = Date.now()) {
  const problemas = [];
  const monto = Number(pago.transaction_amount);
  if (!(monto >= Number(orden.monto) - 0.01)) problemas.push(`monto ${pago.transaction_amount} menor al de la orden (${orden.monto})`);
  if ((pago.currency_id || 'ARS') !== (orden.moneda || 'ARS')) problemas.push(`moneda ${pago.currency_id} distinta de ${orden.moneda}`);
  if (Number(pago.transaction_amount_refunded || 0) > 0) problemas.push(`reembolso parcial de ${pago.transaction_amount_refunded}`);
  const aprobadoEn = new Date(pago.date_approved || ahora).getTime();
  const cierre = new Date(campaign.edicion.cierre_ventas).getTime();
  if (Number.isFinite(cierre) && aprobadoEn > cierre) problemas.push('pago acreditado después del cierre');
  if (['reembolsada', 'anulada'].includes(orden.estado)) problemas.push(`pago aprobado sobre una orden ${orden.estado}`);
  return problemas;
}

/**
 * Devuelve { estado, numeros?, nota?, ignorado? } describiendo qué pasó con la orden.
 * Nunca lanza por reglas de negocio; solo por errores de infraestructura (base, mail).
 */
export async function aplicarPago({ pago, orden, campaign, baseUrl }) {
  const pagoId = String(pago.id);
  const estado = mapearEstadoPago(pago.status);
  const esElPagoDeLaOrden = Boolean(orden.mp_payment_id) && String(orden.mp_payment_id) === pagoId;
  const resumen = resumenPago(pago);

  if (orden.medio_pago !== 'mercadopago') {
    console.warn(`[pagos mp] pago ${pagoId} apunta a la orden ${orden.id}, que no se paga por Mercado Pago (${orden.medio_pago}); se ignora`);
    return { estado: orden.estado, ignorado: true, nota: 'la orden no se paga por Mercado Pago' };
  }

  // ---------- pago NO aprobado (pendiente, rechazado, reembolsado, en disputa) ----------
  if (estado !== 'pagada') {
    if (orden.estado === 'pagada') {
      if (!esElPagoDeLaOrden) {
        return { estado: 'pagada', ignorado: true, nota: `pago ${pagoId} (${pago.status}) no es el que pagó la orden` };
      }
      if (estado === 'reembolsada') {
        await actualizarOrden(orden.id, { estado: 'reembolsada', comprobante_datos: anotar(orden, { mp_reembolso: resumen }) });
        return { estado: 'reembolsada', nota: `pago ${pago.status}` };
      }
      // in_mediation / pending sobre el pago aprobado: dejar constancia sin sacar la orden del padrón.
      await actualizarOrden(orden.id, { comprobante_datos: anotar(orden, { mp_disputa: resumen }) });
      return { estado: 'pagada', nota: `pago ${pago.status}: disputa anotada` };
    }

    // Orden no pagada (pendiente / en_revision / rechazada / reembolsada / anulada).
    if (esElPagoDeLaOrden && estado === 'reembolsada') {
      // Reembolso de un pago que había quedado en revisión (fuera de término, monto, etc.).
      await actualizarOrden(orden.id, { estado: 'reembolsada', comprobante_datos: anotar(orden, { mp_reembolso: resumen }) });
      return { estado: 'reembolsada', nota: `pago ${pago.status}` };
    }
    if (estado === 'rechazada' && orden.estado === 'pendiente') {
      // Solo pendiente → rechazada; el update es condicional por si otro pago la confirmó mientras tanto.
      const actual = await actualizarOrdenSiEstado(
        orden.id,
        { estado: 'rechazada', comprobante_datos: anotar(orden, { mp_ultimo_intento: resumen }) },
        ['pendiente'],
      );
      return { estado: actual ? 'rechazada' : orden.estado, nota: `pago ${pago.status} (${pago.status_detail || ''})` };
    }
    return { estado: orden.estado, nota: `pago ${pago.status} sin efecto sobre una orden ${orden.estado}` };
  }

  // ---------- pago aprobado ----------
  if (orden.estado === 'pagada') {
    if (esElPagoDeLaOrden || !orden.mp_payment_id) {
      // Reintento de la misma notificación: confirmarOrden es idempotente
      // (mismos números; mail y WhatsApp solo si faltaban).
      if (!orden.mp_payment_id) await actualizarOrden(orden.id, { mp_payment_id: pagoId });
      const { numeros } = await confirmarOrden({ orden, campaign, baseUrl });
      return { estado: 'pagada', numeros };
    }
    // Segundo pago aprobado sobre una orden ya pagada (doble pago): anotar para reembolsarlo desde MP.
    console.warn(`[pagos mp] pago ${pagoId} aprobado sobre la orden ${orden.id}, que ya fue pagada con ${orden.mp_payment_id}: reembolsar desde Mercado Pago`);
    await actualizarOrden(orden.id, { comprobante_datos: anotar(orden, { mp_pago_duplicado: resumen }) });
    return { estado: 'pagada', nota: 'pago duplicado anotado: reembolsar desde Mercado Pago' };
  }

  const problemas = problemasDelPago(pago, orden, campaign);
  if (problemas.length) {
    const nota = problemas.join(' · ');
    console.warn(`[pagos mp] orden ${orden.id} queda en revisión: ${nota}`);
    await actualizarOrden(orden.id, {
      estado: 'en_revision',
      mp_payment_id: pagoId,
      comprobante_datos: anotar(orden, { nota, mp_pago: resumen }),
    });
    return { estado: 'en_revision', nota };
  }

  const { numeros } = await confirmarOrden({
    orden,
    campaign,
    baseUrl,
    cambios: {
      mp_payment_id: pagoId,
      pagada_at: new Date(pago.date_approved || Date.now()).toISOString(),
    },
  });
  return { estado: 'pagada', numeros };
}
