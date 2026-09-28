// /api/comprobante
//   POST { orden_id, tipo, nombre, contenido_base64 }  → sube y lee el comprobante (desde /gracias)
//   GET  ?id=<orden>[&json=1]                         → panel (Authorization: Bearer <ADMIN_TOKEN>):
//        redirige a una URL firmada para verlo; con json=1 responde { url } (el panel abre
//        la URL firmada sin poner el token en la barra de direcciones)
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { obtenerOrden } from './_lib/db.js';
import { procesarComprobante, urlFirmada, validarArchivo } from './_lib/comprobante.js';
import { RE_UUID, texto } from './_lib/validar.js';

const URL_FIRMADA_SEG = 300;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });
    const { id, json: comoJson } = getQuery(req);
    const orden = RE_UUID.test(String(id || '')) ? await obtenerOrden(id) : null;
    if (!orden?.comprobante_url) return json(res, 404, { error: 'Sin comprobante' });
    try {
      const url = await urlFirmada(orden.comprobante_url, URL_FIRMADA_SEG);
      if (String(comoJson || '') === '1') return json(res, 200, { url, expira_en: URL_FIRMADA_SEG });
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
  if (!RE_UUID.test(ordenId)) return json(res, 400, { error: 'Orden inválida' });

  // Misma validación (tipo, tamaño, firma del archivo) que el comprobante adjunto en el checkout.
  const archivo = validarArchivo({ tipo: body.tipo, contenido_base64: body.contenido_base64 });
  if (archivo.error) return json(res, 422, { error: archivo.error });

  try {
    const orden = await obtenerOrden(ordenId);
    if (!orden) return json(res, 404, { error: 'No encontramos esa orden' });
    if (orden.medio_pago !== 'transferencia') return json(res, 400, { error: 'Esta orden no se paga por transferencia.' });
    if (!['pendiente', 'en_revision'].includes(orden.estado)) return json(res, 409, { error: `La orden ya está ${orden.estado}.` });

    const out = await procesarComprobante({
      orden,
      buffer: archivo.buffer,
      tipo: archivo.tipo,
      nombre: texto(body.nombre, 120) || 'comprobante',
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
