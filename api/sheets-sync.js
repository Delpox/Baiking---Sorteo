// GET | POST /api/sheets-sync[?edicion=edicion-1]
// Sincroniza la planilla de Google Sheets con la base, en las dos direcciones:
//   1) lee la columna "Llegó la plata": donde Gastón puso SI/NO y la base todavía no lo tiene,
//      aplica la acreditación (SI sobre una transferencia pendiente o en revisión = números +
//      mail + WhatsApp; NO solo marca);
//   2) espeja todas las órdenes de la edición en la planilla (upsert por orden_id).
// Autorización: Authorization: Bearer <CRON_SECRET> (lo manda Vercel Cron solo) o
// Bearer <ADMIN_TOKEN> (panel / a mano). Idempotente: se puede llamar todas las veces que haga falta.
// Responde { ok, filas_escritas, marcadas_si, marcadas_no, pendientes, errores }. Si faltan las
// variables GOOGLE_*, responde 200 con { ok: false, motivo: 'sheets no configurado' }.
// Configuración y cron: docs/06-google-sheets.md.
import { timingSafeEqual } from 'node:crypto';
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { sheetsConfigurado, sincronizarSheet } from './_lib/sheets.js';

const RE_EDICION = /^[a-z0-9-]{1,40}$/;

/** Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` (variable de entorno del proyecto). */
function cronAutorizado(req) {
  const esperado = process.env.CRON_SECRET || '';
  const auth = String(req.headers.authorization || '');
  const recibido = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Método no permitido' });
  if (!cronAutorizado(req) && !(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });
  if (!sheetsConfigurado()) return json(res, 200, { ok: false, motivo: 'sheets no configurado' });

  const { edicion } = getQuery(req);
  if (edicion && !RE_EDICION.test(String(edicion))) return json(res, 400, { error: 'edicion inválida' });

  try {
    const resumen = await sincronizarSheet({ edicionId: edicion || campaign.edicion.id, baseUrl: baseUrl(req), revisor: 'planilla' });
    return json(res, 200, resumen);
  } catch (err) {
    console.error('[sheets-sync]', err.message || err);
    return json(res, 500, { ok: false, error: 'Error sincronizando la planilla', detalle: String(err.message || err).slice(0, 300) });
  }
}
