// POST /api/inbound-email
// Recibe los mails con comprobantes que la gente manda a pagos@... (reenviados
// por un servicio de correo entrante: Cloudflare Email Routing + Worker,
// Resend/Postmark inbound, etc.) en un formato normalizado:
//   { from, subject, text, html, attachments: [{ filename, content_type, content }] }   (content en base64)
// Protegido con el header X-Inbound-Secret = INBOUND_SECRET.
// Busca la orden por el código BK-XXXXX (asunto o cuerpo) o por el mail del remitente,
// y procesa el comprobante igual que la carga desde el sitio.
import { timingSafeEqual } from 'node:crypto';
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { db } from './_lib/db.js';
import { procesarComprobante, TIPOS } from './_lib/comprobante.js';

const RE_CODIGO = /BK-[A-Z0-9]{5}/i;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function secretoValido(req) {
  const esperado = process.env.INBOUND_SECRET || '';
  const recibido = String(req.headers['x-inbound-secret'] || '');
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function buscarOrden({ codigo, email }) {
  if (codigo) {
    const { data } = await db().from('ordenes').select('*').eq('codigo', codigo.toUpperCase()).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await db()
      .from('ordenes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('medio_pago', 'transferencia')
      .in('estado', ['pendiente', 'en_revision'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.length) return data[0];
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (!secretoValido(req)) return json(res, 401, { error: 'No autorizado' });

  const body = readJson(req);
  const asunto = String(body.subject || '');
  const texto = String(body.text || '').slice(0, 20000);
  const desde = (String(body.from || '').match(RE_EMAIL) || [])[0] || '';
  const codigo = (`${asunto} ${texto}`.match(RE_CODIGO) || [])[0] || '';

  try {
    const orden = await buscarOrden({ codigo, email: desde });
    if (!orden) return json(res, 200, { ok: false, motivo: 'No se encontró una orden para este mail', codigo, desde });
    if (orden.estado === 'pagada') return json(res, 200, { ok: true, orden_id: orden.id, estado: 'pagada', motivo: 'ya estaba pagada' });

    const adjunto = (body.attachments || []).find((a) => TIPOS[String(a.content_type || '').toLowerCase()] && a.content);
    if (!adjunto && !texto.trim()) return json(res, 200, { ok: false, orden_id: orden.id, motivo: 'El mail no trae comprobante' });

    const out = await procesarComprobante({
      orden,
      buffer: adjunto ? Buffer.from(String(adjunto.content), 'base64') : null,
      tipo: adjunto ? String(adjunto.content_type).toLowerCase() : 'text/plain',
      nombre: adjunto ? String(adjunto.filename || 'adjunto') : 'mail.txt',
      texto: adjunto ? null : texto,
      campaign,
      baseUrl: baseUrl(req),
      origen: 'email',
    });
    return json(res, 200, { ok: true, orden_id: orden.id, ...out });
  } catch (err) {
    console.error('[inbound-email]', err);
    return json(res, 500, { error: 'Error procesando el mail' });
  }
}
