// /api/comprobante
//   POST { orden_id, tipo, nombre, contenido_base64 }  → sube y lee el comprobante (desde /gracias)
//   GET  ?token=<ADMIN_TOKEN>&id=<orden>             → redirige a una URL firmada para verlo (panel)
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { obtenerOrden } from './_lib/db.js';
import { procesarComprobante, urlFirmada, TIPOS } from './_lib/comprobante.js';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BASE64 = 3.6 * 1024 * 1024; // el cuerpo de una función de Vercel admite ~4,5 MB

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });
    const { id } = getQuery(req);
    const orden = RE_UUID.test(String(id || '')) ? await obtenerOrden(id) : null;
    if (!orden?.comprobante_url) return json(res, 404, { error: 'Sin comprobante' });
    try {
      const url = await urlFirmada(orden.comprobante_url);
      res.statusCode = 302;
      res.setHeader('Location', url);
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    } catch (err) {
      console.error('[comprobante] url', err);
      return json(res, 500, { error: 'No se pudo abrir el comprobante' });
    }
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  const body = readJson(req);
  const ordenId = String(body.orden_id || '');
  const tipo = String(body.tipo || '');
  const contenido = String(body.contenido_base64 || '');

  if (!RE_UUID.test(ordenId)) return json(res, 400, { error: 'Orden inválida' });
  if (!TIPOS[tipo] || tipo === 'text/plain') return json(res, 400, { error: 'Subí una imagen (JPG, PNG) o un PDF.' });
  if (!contenido || contenido.length > MAX_BASE64) return json(res, 413, { error: 'El archivo es muy pesado. Probá con una captura de pantalla.' });

  try {
    const orden = await obtenerOrden(ordenId);
    if (!orden) return json(res, 404, { error: 'No encontramos esa orden' });
    if (orden.medio_pago !== 'transferencia') return json(res, 400, { error: 'Esta orden no se paga por transferencia.' });
    if (!['pendiente', 'en_revision'].includes(orden.estado)) return json(res, 409, { error: `La orden ya está ${orden.estado}.` });

    const buffer = Buffer.from(contenido, 'base64');
    if (!buffer.length) return json(res, 400, { error: 'Archivo vacío' });

    const out = await procesarComprobante({
      orden,
      buffer,
      tipo,
      nombre: String(body.nombre || 'comprobante'),
      campaign,
      baseUrl: baseUrl(req),
      origen: 'web',
    });
    return json(res, 200, out);
  } catch (err) {
    console.error('[comprobante]', err);
    return json(res, 500, { error: 'No pudimos procesar el comprobante. Probá de nuevo o mandalo por mail.' });
  }
}
