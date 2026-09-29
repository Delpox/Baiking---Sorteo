// Integración con Mercado Pago (Checkout Pro) usando la API REST.
// Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
import crypto from 'node:crypto';
import { env } from './http.js';

const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15000;

// Los pagos en efectivo (Rapipago, Pago Fácil: payment_type "ticket") se acreditan 1 a 3
// días después de generados. Si falta menos que esto para el cierre de ventas, se excluyen
// para que nadie pague en efectivo y quede fuera del padrón por acreditarse tarde.
const HORAS_SIN_EFECTIVO_ANTES_DEL_CIERRE = 48;

async function mp(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = {
    Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`[mercadopago] ${method} ${path} -> ${res.status}: ${String(data.message || text || '').slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Fecha en el formato que pide MP (yyyy-MM-ddTHH:mm:ss.SSS-03:00), en hora argentina (UTC-3, sin horario de verano). */
export function fechaMP(fecha) {
  const ms = fecha instanceof Date ? fecha.getTime() : Number(fecha);
  return `${new Date(ms - 3 * 36e5).toISOString().slice(0, 23)}-03:00`;
}

/**
 * Crea una preferencia de Checkout Pro para una orden.
 * El usuario es redirigido a `init_point`; el pago se confirma por webhook.
 * La preferencia vence en `campaign.edicion.cierre_ventas`: nadie puede pagar un link
 * viejo después del cierre (las bases dicen que solo integran el padrón los pagos
 * acreditados a esa fecha).
 */
export async function crearPreferencia({ orden, pack, campaign, baseUrl, ahora = Date.now() }) {
  // El ítem cobrado es SIEMPRE el producto digital real (fondos, checklist o curso). La
  // participación es una bonificación y no forma parte del título ni la descripción del
  // cobro (Mercado Pago prohíbe cobrar loterías o productos de azar).
  const titulo = String(pack.nombre || campaign.curso?.nombre_corto || 'Producto Baiking').slice(0, 256);
  const descripcion = [pack.descripcion, ...(pack.incluye || [])].filter(Boolean).join(' · ').slice(0, 600);
  const cierre = new Date(campaign.edicion.cierre_ventas).getTime();

  const body = {
    items: [
      {
        id: pack.id,
        title: titulo,
        description: descripcion || titulo,
        category_id: 'learnings',
        quantity: 1,
        currency_id: campaign.moneda || 'ARS',
        unit_price: Number(pack.precio),
      },
    ],
    payer: {
      name: orden.nombre,
      surname: orden.apellido,
      email: orden.email,
      identification: { type: 'DNI', number: String(orden.dni) },
    },
    external_reference: orden.id,
    metadata: { orden_id: orden.id, pack_id: pack.id, edicion_id: orden.edicion_id },
    back_urls: {
      success: `${baseUrl}/gracias?orden=${orden.id}`,
      pending: `${baseUrl}/gracias?orden=${orden.id}&estado=pendiente`,
      failure: `${baseUrl}/?pago=error&orden=${orden.id}`,
    },
    auto_return: 'approved',
    notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    statement_descriptor: (campaign.mercadopago?.statement_descriptor || 'BAIKING CURSO').slice(0, 22),
    // Vencimiento del link de pago = cierre de ventas.
    expires: true,
    expiration_date_from: fechaMP(ahora - 5 * 60e3),
    expiration_date_to: fechaMP(cierre),
  };

  const horasHastaCierre = (cierre - ahora) / 36e5;
  if (horasHastaCierre < HORAS_SIN_EFECTIVO_ANTES_DEL_CIERRE) {
    body.payment_methods = { excluded_payment_types: [{ id: 'ticket' }] };
  } else {
    // Vencimiento del cupón de pago en efectivo: el cierre (tope de 29 días, que es lo
    // que admite MP para este campo).
    body.date_of_expiration = fechaMP(Math.min(cierre, ahora + 29 * 864e5));
  }

  const pref = await mp('/checkout/preferences', { method: 'POST', body, idempotencyKey: orden.id });
  return { id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point };
}

export async function obtenerPago(paymentId) {
  return mp(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

/** Pagos de MP asociados a una orden (external_reference), del más nuevo al más viejo. */
export async function buscarPagosPorOrden(ordenId) {
  const data = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(ordenId)}&sort=date_created&criteria=desc`);
  return Array.isArray(data.results) ? data.results : [];
}

/**
 * Verifica la firma del webhook (header x-signature).
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#validaci%C3%B3n
 * Plantilla oficial: `id:[data.id_url];request-id:[x-request-id];ts:[ts];` — los valores
 * que no vienen en la notificación se eliminan de la plantilla (no se dejan vacíos).
 * Además se rechazan notificaciones con `ts` más viejo que `maxAntiguedadSeg` (replay).
 */
export function verificarFirmaWebhook({ xSignature, xRequestId, dataId, secret, maxAntiguedadSeg = 600, ahora = Date.now() }) {
  if (!xSignature || !secret) return false;
  const parts = Object.fromEntries(
    String(xSignature)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((kv) => kv.length === 2),
  );
  if (!parts.ts || !parts.v1) return false;

  const tsNum = Number(parts.ts);
  if (!Number.isFinite(tsNum)) return false;
  const tsMs = tsNum > 1e11 ? tsNum : tsNum * 1000; // MP manda segundos; tolerar milisegundos
  if (maxAntiguedadSeg > 0 && Math.abs(ahora - tsMs) > maxAntiguedadSeg * 1000) return false;

  const id = /^[a-zA-Z0-9]+$/.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const partes = [];
  if (id) partes.push(`id:${id};`);
  if (xRequestId) partes.push(`request-id:${xRequestId};`);
  partes.push(`ts:${parts.ts};`);
  const manifest = partes.join('');
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(String(parts.v1), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function mapearEstadoPago(status) {
  switch (status) {
    case 'approved':
      return 'pagada';
    case 'rejected':
    case 'cancelled':
      return 'rechazada';
    case 'refunded':
    case 'charged_back':
      return 'reembolsada';
    default:
      return 'pendiente'; // pending, in_process, authorized, in_mediation
  }
}
