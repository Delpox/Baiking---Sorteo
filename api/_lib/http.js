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

export function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

/**
 * Autorización del panel y exportaciones: token en ?token=, en el header
 * Authorization: Bearer <token> o en X-Admin-Token. Comparación en tiempo constante.
 */
export async function adminAutorizado(req) {
  const { timingSafeEqual } = await import('node:crypto');
  const esperado = process.env.ADMIN_TOKEN || '';
  const q = getQuery(req);
  const auth = String(req.headers.authorization || '');
  const token = q.token || req.headers['x-admin-token'] || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!esperado || !token) return false;
  const a = Buffer.from(String(token));
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
