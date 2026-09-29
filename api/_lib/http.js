// Helpers mínimos para funciones serverless de Vercel (Node runtime).

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function readJson(req) {
  const body = req.body;
  if (body == null || body === '') return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const url = new URL(req.url || '/', 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

/**
 * URL pública del sitio, para links que viajan por mail y para las back_urls /
 * notification_url de Mercado Pago. Orden: BASE_URL (obligatoria en producción) →
 * VERCEL_PROJECT_PRODUCTION_URL (dominio de producción que inyecta Vercel) → host de la
 * request (solo desarrollo; se loguea una advertencia porque el header Host lo controla
 * quien hace la request y en un preview apunta a *.vercel.app).
 */
export function baseUrl(req) {
  const configurada = String(process.env.BASE_URL || '').trim();
  if (configurada) return configurada.replace(/\/$/, '');
  const produccion = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (produccion) return `https://${produccion.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:3000').split(',')[0].trim();
  console.warn(`[http] BASE_URL no configurada: se usa el host de la request (${host}). Configurá BASE_URL en producción.`);
  return `${proto}://${host}`;
}

/**
 * Autorización del panel y exportaciones: token en el header Authorization: Bearer <token>
 * (o X-Admin-Token). Se mantiene ?token= solo como fallback (queda en logs e historial;
 * el panel ya no lo usa). Comparación en tiempo constante.
 */
export async function adminAutorizado(req) {
  const { timingSafeEqual } = await import('node:crypto');
  const esperado = process.env.ADMIN_TOKEN || '';
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const token = bearer || req.headers['x-admin-token'] || getQuery(req).token || '';
  if (!esperado || !token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` (variable de entorno del
 * proyecto) al llamar los endpoints programados (/api/sheets-sync, /api/recordatorios).
 * Comparación en tiempo constante; sin CRON_SECRET configurado, nunca autoriza.
 */
export async function cronAutorizado(req) {
  const { timingSafeEqual } = await import('node:crypto');
  const esperado = process.env.CRON_SECRET || '';
  const auth = String(req.headers.authorization || '');
  const recibido = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function env(name, { required = true } = {}) {
  const value = process.env[name];
  if ((value === undefined || value === '') && required) {
    throw new Error(`Falta configurar la variable de entorno ${name}`);
  }
  return value;
}
