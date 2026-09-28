// POST /api/inbound-email
// Recibe los mails con comprobantes que la gente manda a pagos@... (reenviados
// por un servicio de correo entrante: Cloudflare Email Routing + Worker,
// Resend/Postmark inbound, etc.) en un formato normalizado:
//   { from, subject, text, html, attachments: [{ filename, content_type, content }] }   (content en base64)
// Protegido con el header X-Inbound-Secret = INBOUND_SECRET.
// Busca la orden (transferencias abiertas: pendiente / en_revision) en este orden:
//   1) código interno BK-XXXXX si aparece en asunto o cuerpo (mails viejos / panel),
//   2) email del remitente, 3) DNI en asunto o cuerpo, 4) nombre y apellido del
//   remitente o del asunto (el sitio pide "tu nombre y DNI en el asunto"),
// y procesa el comprobante igual que la carga desde el sitio.
import { timingSafeEqual } from 'node:crypto';
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { db } from './_lib/db.js';
import { procesarComprobante, TIPOS } from './_lib/comprobante.js';

const RE_CODIGO = /BK-[A-Z0-9]{5}/i;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// DNI de 7 u 8 dígitos, con o sin puntos/espacios de miles (12.345.678 · 12 345 678 · 12345678).
const RE_DNI = /(?<!\d)(\d{1,2})[.\s]?(\d{3})[.\s]?(\d{3})(?!\d)/g;
const ESTADOS_ABIERTOS = ['pendiente', 'en_revision'];

function secretoValido(req) {
  const esperado = process.env.INBOUND_SECRET || '';
  const recibido = String(req.headers['x-inbound-secret'] || '');
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const sinAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (s) => sinAcentos(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);

function dnisEn(texto) {
  const out = new Set();
  for (const m of String(texto || '').matchAll(RE_DNI)) {
    const d = `${m[1]}${m[2]}${m[3]}`;
    if (d.length >= 7 && d.length <= 8) out.add(d);
  }
  return [...out];
}

function abiertas() {
  return db().from('ordenes').select('*').eq('medio_pago', 'transferencia').in('estado', ESTADOS_ABIERTOS).order('created_at', { ascending: false });
}

async function buscarOrden({ codigo, email, texto, nombreRemitente }) {
  if (codigo) {
    const { data } = await db().from('ordenes').select('*').eq('codigo', codigo.toUpperCase()).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await abiertas().eq('email', email.toLowerCase()).limit(1);
    if (data?.length) return data[0];
  }
  const dnis = dnisEn(texto);
  if (dnis.length) {
    const { data } = await abiertas().in('dni', dnis).limit(1);
    if (data?.length) return data[0];
  }
  // Nombre y apellido: tienen que aparecer los dos entre las palabras del remitente y del asunto.
  const tokens = new Set(palabras(nombreRemitente).concat(palabras(texto).slice(0, 60)));
  if (tokens.size >= 2) {
    const { data } = await abiertas().limit(300);
    const candidatas = (data || []).filter((o) => {
      const nombre = palabras(o.nombre)[0];
      const apellido = palabras(o.apellido)[0];
      return nombre && apellido && tokens.has(nombre) && tokens.has(apellido);
    });
    if (candidatas.length) return candidatas[0]; // la más reciente
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (!secretoValido(req)) return json(res, 401, { error: 'No autorizado' });

  const body = readJson(req);
  const asunto = String(body.subject || '');
  const texto = String(body.text || '').slice(0, 20000);
  const from = String(body.from || '');
  const desde = (from.match(RE_EMAIL) || [])[0] || '';
  const nombreRemitente = from.replace(RE_EMAIL, '').replace(/[<>"']/g, ' ');
  const codigo = (`${asunto} ${texto}`.match(RE_CODIGO) || [])[0] || '';

  try {
    const orden = await buscarOrden({ codigo, email: desde, texto: `${asunto}\n${texto.slice(0, 2000)}`, nombreRemitente });
    if (!orden) return json(res, 200, { ok: false, motivo: 'No se encontró una orden para este mail', codigo, desde });
    if (orden.estado === 'pagada') return json(res, 200, { ok: true, orden_id: orden.id, estado: 'pagada', motivo: 'ya estaba pagada' });
    // Un comprobante nunca reabre una orden rechazada, reembolsada o anulada
    // (un reenvío viejo o un código reutilizado volvería a ponerla en la cola del panel).
    if (!['pendiente', 'en_revision'].includes(orden.estado)) {
      return json(res, 200, { ok: false, orden_id: orden.id, estado: orden.estado, motivo: `La orden está ${orden.estado}; no se reabre` });
    }

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
