// Integración con Mercado Pago (Checkout Pro) usando la API REST.
// Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
import crypto from 'node:crypto';
import { env } from './http.js';

const API = 'https://api.mercadopago.com';

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
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`[mercadopago] ${method} ${path} -> ${res.status}: ${data.message || text}`);
  }
  return data;
}

/**
 * Crea una preferencia de Checkout Pro para una orden.
 * El usuario es redirigido a `init_point`; el pago se confirma por webhook.
 */
export async function crearPreferencia({ orden, pack, campaign, baseUrl }) {
  // El ítem cobrado es SIEMPRE el producto real (curso / kit / service).
  // La participación es una bonificación y no forma parte del título del cobro.
  const titulo = `${campaign.curso.nombre_corto} · ${pack.nombre}`.slice(0, 256);
  const descripcion = (pack.incluye || []).join(' · ').slice(0, 600);

  const body = {
    items: [
      {
        id: pack.id,
        title: titulo,
        description: descripcion || campaign.curso.nombre,
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
    expires: false,
  };

  const pref = await mp('/checkout/preferences', { method: 'POST', body, idempotencyKey: orden.id });
  return { id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point };
}

export async function obtenerPago(paymentId) {
  return mp(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Verifica la firma del webhook (header x-signature).
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#validaci%C3%B3n
 */
export function verificarFirmaWebhook({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !secret) return false;
  const parts = Object.fromEntries(
    String(xSignature)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((kv) => kv.length === 2),
  );
  if (!parts.ts || !parts.v1) return false;

  const id = /^[a-zA-Z0-9]+$/.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${xRequestId || ''};ts:${parts.ts};`;
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
