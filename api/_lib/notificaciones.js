// Notificaciones al participante: mail (Resend) y WhatsApp (Meta Cloud API).
// Regla de copy: lo que se cobra es SIEMPRE el curso; las participaciones ("chances")
// son una bonificación del curso y nunca se presentan como lo comprado.
import { env } from './http.js';
import { configCarta, venceCarta } from './carta.js';

const TIMEOUT_MS = 15000;

const fmtDia = (iso, tz = 'America/Argentina/Buenos_Aires') =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date(iso));

const fmtFecha = (iso, tz = 'America/Argentina/Buenos_Aires') =>
  new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));

const fmtNumero = (n) => String(n).padStart(4, '0');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const unidad = (campaign, n) => {
  const u = campaign.unidad || { singular: 'participación', plural: 'participaciones' };
  return n === 1 ? u.singular : u.plural;
};

const pendienteConfig = (v) => !v || /A CONFIRMAR/i.test(String(v));
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Pie legal del HTML: leyenda "sin obligación de compra", aviso corto y link a las bases. */
function pieLegalHtml(campaign, baseUrl) {
  const legal = campaign.legal || {};
  return `<p style="font-size:12px;line-height:1.6;color:#6b7784;margin:28px 0 0">
      ${legal.leyenda ? `<strong>${escapeHtml(legal.leyenda)}</strong><br>` : ''}
      ${escapeHtml(legal.aviso_corto || '')}
      Bases y condiciones: <a href="${escapeHtml(baseUrl)}/bases-y-condiciones" style="color:#c9f31d">${escapeHtml(baseUrl)}/bases-y-condiciones</a>
    </p>`;
}

/** Mismo pie legal para la versión en texto plano. */
function pieLegalTexto(campaign, baseUrl) {
  const legal = campaign.legal || {};
  return [legal.leyenda, legal.aviso_corto, `Bases y condiciones: ${baseUrl}/bases-y-condiciones`].filter(Boolean).join('\n');
}

export function armarMailConfirmacion({ orden, numeros, campaign, baseUrl, gratuita = false }) {
  const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);
  const pack = campaign.packs.find((p) => p.id === orden.pack_id);
  const fecha = fmtFecha(campaign.edicion.fecha_sorteo);
  const lista = numeros.map(fmtNumero).join(' · ');
  const nombre = escapeHtml(orden.nombre);
  const plural = numeros.length > 1;
  const u = unidad(campaign, numeros.length);
  const curso = campaign.curso;
  const biciNombre = bici?.nombre || 'Polygon';
  const packTxt = pack ? ` · pack de ${pack.nombre}` : '';
  // Nombre completo del curso solo si difiere del corto (para no repetirlo).
  const cursoLargo = curso.nombre && curso.nombre !== curso.nombre_corto ? curso.nombre : '';

  const subject = gratuita
    ? `¡Listo, ${orden.nombre}! Registramos tu participación sin cargo · Baiking`
    : `¡Listo, ${orden.nombre}! Tu curso y ${plural ? `tus ${u}` : `tu ${u}`} · Baiking`;

  const conCarta = gratuita && Boolean(orden.carta_recibida_at);
  const intro = gratuita
    ? `${conCarta ? 'Recibimos tu carta y registramos' : 'Registramos'} tu participación <strong style="color:#fff">sin obligación de compra</strong>. Quedaste participando por tu <strong style="color:#fff">${escapeHtml(biciNombre)}</strong> con la misma probabilidad que cualquier otra participación.`
    : `Confirmamos tu pago del <strong style="color:#fff">${escapeHtml(curso.nombre_corto)}</strong>${escapeHtml(packTxt)}. Ya tenés acceso al ${cursoLargo ? `<strong style="color:#fff">${escapeHtml(cursoLargo)}</strong>` : 'curso'} y, como bonificación sin cargo del curso, quedaste participando por tu <strong style="color:#fff">${escapeHtml(biciNombre)}</strong> con ${numeros.length} ${escapeHtml(u)}.`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#0b0f14;font-family:Inter,Arial,sans-serif;color:#f4f6f8">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c9f31d;margin:0 0 12px">Baiking · ${escapeHtml(campaign.edicion.nombre)}</p>
    <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">¡Ya estás adentro, ${nombre}!</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#c8d0d8">${intro}</p>

    <div style="background:#121820;border:1px solid #223041;border-radius:14px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9aa6b2">
        ${plural ? `Tus ${escapeHtml(u)}` : `Tu ${escapeHtml(u)}`}
      </p>
      <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:.04em;color:#c9f31d">${lista}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#9aa6b2">Orden ${escapeHtml(orden.id)}</p>
    </div>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px">
      <tr><td style="padding:8px 0;color:#9aa6b2">Sorteo en vivo</td><td style="padding:8px 0;text-align:right">${escapeHtml(fecha)} hs · Instagram @${escapeHtml(campaign.contacto.instagram)}</td></tr>
      <tr><td style="padding:8px 0;color:#9aa6b2">Bici elegida</td><td style="padding:8px 0;text-align:right">${escapeHtml(bici?.nombre || '')}</td></tr>
      <tr><td style="padding:8px 0;color:#9aa6b2">${escapeHtml(unidad(campaign, 2).charAt(0).toUpperCase() + unidad(campaign, 2).slice(1))}</td><td style="padding:8px 0;text-align:right">${numeros.length}</td></tr>
    </table>

    ${
      gratuita
        ? ''
        : `<a href="${escapeHtml(curso.url_acceso || baseUrl)}" style="display:inline-block;background:#c9f31d;color:#0b0f14;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Entrar al curso</a>`
    }

    <p style="font-size:13px;line-height:1.6;color:#9aa6b2;margin:28px 0 0">
      Guardá este mail: es tu comprobante de participación. Podés ver tus ${escapeHtml(unidad(campaign, 2))} cuando quieras en
      <a href="${escapeHtml(baseUrl)}/gracias?orden=${escapeHtml(orden.id)}" style="color:#c9f31d">${escapeHtml(baseUrl)}/gracias</a>.
    </p>
    ${pieLegalHtml(campaign, baseUrl)}
  </div>
</body></html>`;

  const text = `¡Ya estás adentro, ${orden.nombre}!
${
  gratuita
    ? `${conCarta ? 'Recibimos tu carta y registramos' : 'Registramos'} tu participación sin obligación de compra.`
    : `Confirmamos tu pago del ${curso.nombre_corto}${packTxt}${cursoLargo ? ` (${cursoLargo})` : ''}. Ya tenés acceso al curso y, como bonificación sin cargo del curso, quedaste participando por tu ${biciNombre}.`
}
${plural ? `Tus ${u}` : `Tu ${u}`}: ${lista}
Bici elegida: ${bici?.nombre || ''}
Sorteo en vivo: ${fecha} hs por Instagram @${campaign.contacto.instagram}
${gratuita ? '' : `Acceso al curso: ${curso.url_acceso || baseUrl}\n`}Orden: ${orden.id}
Ver tus ${unidad(campaign, 2)}: ${baseUrl}/gracias?orden=${orden.id}

${pieLegalTexto(campaign, baseUrl)}`;

  return { subject, html, text };
}

const fmtARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function marcoMail(campaign, titulo, cuerpoHtml, baseUrl) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#0b0f14;font-family:Inter,Arial,sans-serif;color:#f4f6f8">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c9f31d;margin:0 0 12px">Baiking · ${escapeHtml(campaign.edicion.nombre)}</p>
    <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">${titulo}</h1>
    ${cuerpoHtml}
    ${pieLegalHtml(campaign, baseUrl)}
  </div>
</body></html>`;
}

const mailComprobantesDe = (t) =>
  pendienteConfig(t.email_comprobantes) || !RE_EMAIL.test(String(t.email_comprobantes)) ? '' : String(t.email_comprobantes).trim();

/**
 * Mail con los datos para transferir. Solo se manda cuando la orden entra SIN el
 * comprobante adjunto (fallback) o cuando no se pudo procesar el adjunto: el flujo
 * principal adjunta el comprobante en la inscripción y recibe el acuse.
 * El código interno (BK-…) ya no se le muestra al participante: si el banco pide un
 * concepto, pone su nombre. Si `checkout.transferencia.email_comprobantes` está
 * configurado, la respuesta al mail va a esa casilla (reply_to).
 */
export function armarMailTransferencia({ orden, campaign, baseUrl }) {
  const t = campaign.checkout.transferencia || {};
  const pack = campaign.packs.find((p) => p.id === orden.pack_id);
  const curso = campaign.curso;
  const link = `${baseUrl}/gracias?orden=${orden.id}`;
  const plazo = String(t.plazo_horas || 48);
  const mailComprobantes = mailComprobantesDe(t);
  const packTxt = pack ? ` (pack de ${pack.nombre})` : '';
  const filas = [
    ['Monto', fmtARS(orden.monto)],
    ['Alias', t.alias],
    ['CBU', t.cbu],
    ['Titular', t.titular],
    ['CUIT', t.cuit],
    ['Banco', t.banco],
  ].filter(([, v]) => v && !pendienteConfig(v));

  const subject = `Reservamos tu lugar · datos para transferir · Baiking`;
  const porMailHtml = mailComprobantes
    ? `También podés responder este mail con el comprobante adjunto (llega a ${escapeHtml(mailComprobantes)}), con tu nombre y DNI en el asunto. `
    : '';
  const html = marcoMail(
    campaign,
    `Reservamos tu lugar, ${escapeHtml(orden.nombre)}`,
    `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#c8d0d8">Elegiste pagar el <strong style="color:#fff">${escapeHtml(curso.nombre_corto)}</strong>${escapeHtml(packTxt)} por transferencia. Transferí el monto exacto (si tu banco pide un concepto, poné tu nombre y apellido) y subí el comprobante desde el botón. Si ya transferiste, solo falta el comprobante. Lo confirmamos en menos de ${escapeHtml(plazo)} hs y te asignamos tus ${escapeHtml(unidad(campaign, 2))}.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px;background:#121820;border:1px solid #223041;border-radius:14px">
      ${filas.map(([k, v]) => `<tr><td style="padding:10px 14px;color:#9aa6b2">${escapeHtml(k)}</td><td style="padding:10px 14px;text-align:right;font-weight:600;color:#fff">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#c9f31d;color:#0b0f14;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Subir el comprobante</a>
    <p style="font-size:14px;line-height:1.6;color:#9aa6b2;margin:20px 0 0">${porMailHtml}La reserva vence si no recibimos la transferencia en ${escapeHtml(plazo)} hs.</p>`,
    baseUrl,
  );
  const porMailTexto = mailComprobantes ? ` o respondé este mail con el comprobante adjunto (con tu nombre y DNI en el asunto)` : '';
  const text = `Reservamos tu lugar, ${orden.nombre}.
Elegiste pagar el ${curso.nombre_corto}${packTxt} por transferencia. Transferí el monto exacto (si tu banco pide un concepto, poné tu nombre y apellido). Si ya transferiste, solo falta el comprobante.
${filas.map(([k, v]) => `${k}: ${v}`).join('\n')}
Subí el comprobante en ${link}${porMailTexto}.
La reserva vence si no recibimos la transferencia en ${plazo} hs.

${pieLegalTexto(campaign, baseUrl)}`;
  return { subject, html, text, replyTo: mailComprobantes || undefined };
}

/**
 * Vía gratuita en dos pasos: mail "Registramos tus datos: ahora mandá la carta", con la
 * dirección, qué tiene que incluir la carta y el plazo. La chance se asigna cuando Baiking
 * marca la carta como recibida (ahí sale el mail de confirmación con el número).
 */
export function armarMailGratuitaPendiente({ orden, campaign, baseUrl }) {
  const { direccion, plazoDias } = configCarta(campaign);
  const vence = fmtDia(venceCarta(orden, campaign));
  const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);
  const biciNombre = bici?.nombre || 'Polygon';
  const u = unidad(campaign, 1);
  const horarios = campaign.contacto?.horarios ? ` (${campaign.contacto.horarios})` : '';
  const link = `${baseUrl}/gracias?orden=${orden.id}`;
  const requisitos = [
    'Tu nombre y apellido',
    `Tu DNI (${orden.dni})`,
    `Tu mail (${orden.email}, el mismo que usaste en el formulario)`,
    `Por qué deberías ganar la ${biciNombre}, con tus palabras`,
  ];

  const subject = `Registramos tus datos: ahora mandá la carta · Baiking`;
  const html = marcoMail(
    campaign,
    `Registramos tus datos, ${escapeHtml(orden.nombre)}`,
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#c8d0d8">Tu participación <strong style="color:#fff">sin obligación de compra</strong> queda firme cuando recibimos tu carta. Mandala por correo a:</p>
    <p style="font-size:17px;line-height:1.5;margin:0 0 6px;color:#fff;font-weight:700">${escapeHtml(direccion)}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#9aa6b2">o entregala en la tienda${escapeHtml(horarios)}.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#c8d0d8">La carta tiene que incluir:</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:#c8d0d8">${requisitos.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#c8d0d8">Tenés <strong style="color:#fff">${plazoDias} días</strong>: la carta tiene que llegar antes del <strong style="color:#fff">${escapeHtml(vence)}</strong>. Cuando la recibamos te mandamos un mail con tu ${escapeHtml(u)}. Una (1) ${escapeHtml(u)} por persona, con la misma probabilidad que cualquier otra.</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#c9f31d;color:#0b0f14;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Ver el estado de mi participación</a>`,
    baseUrl,
  );
  const text = `Registramos tus datos, ${orden.nombre}.
Tu participación sin obligación de compra queda firme cuando recibimos tu carta. Mandala por correo a:
${direccion}
o entregala en la tienda${horarios}.
La carta tiene que incluir:
${requisitos.map((r) => `- ${r}`).join('\n')}
Tenés ${plazoDias} días: la carta tiene que llegar antes del ${vence}. Cuando la recibamos te mandamos un mail con tu ${u}. Una (1) ${u} por persona, con la misma probabilidad que cualquier otra.
Estado de tu participación: ${link}

${pieLegalTexto(campaign, baseUrl)}`;
  return { subject, html, text };
}

/** Mail de acuse cuando llega un comprobante (adjunto en la inscripción, subido en /gracias o por mail). */
export function armarMailComprobanteRecibido({ orden, campaign, baseUrl }) {
  const t = campaign.checkout.transferencia || {};
  const pack = campaign.packs.find((p) => p.id === orden.pack_id);
  const curso = campaign.curso;
  const link = `${baseUrl}/gracias?orden=${orden.id}`;
  const plazo = String(t.plazo_horas || 48);
  const detalle = `${fmtARS(orden.monto)} por el ${curso.nombre_corto}${pack ? ` (pack de ${pack.nombre})` : ''}`;
  const subject = `Recibimos tu comprobante · Baiking`;
  const html = marcoMail(
    campaign,
    `Recibimos tu comprobante, ${escapeHtml(orden.nombre)}`,
    `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#c8d0d8">Recibimos el comprobante de tu transferencia de <strong style="color:#fff">${escapeHtml(detalle)}</strong>. Lo estamos revisando: en cuanto se acredite te mandamos otro mail con el acceso al curso y tus ${escapeHtml(unidad(campaign, 2))} (en general, en menos de ${escapeHtml(plazo)} hs).</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#c9f31d;color:#0b0f14;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Ver el estado de mi orden</a>
    <p style="font-size:13px;line-height:1.6;color:#9aa6b2;margin:20px 0 0">Orden ${escapeHtml(orden.id)}</p>`,
    baseUrl,
  );
  const text = `Recibimos tu comprobante, ${orden.nombre}.
Transferencia de ${detalle}. Lo estamos revisando: en cuanto se acredite te mandamos otro mail con el acceso al curso y tus ${unidad(campaign, 2)} (en general, en menos de ${plazo} hs).
Estado de tu orden: ${link}
Orden: ${orden.id}

${pieLegalTexto(campaign, baseUrl)}`;
  return { subject, html, text };
}

// Los proveedores repiten el destinatario en sus mensajes de error ("Invalid `to`: juan@…"):
// se recorta y se enmascaran mails y teléfonos antes de que el mensaje llegue a los logs.
const sinDatosPersonales = (s) =>
  String(s || '')
    .slice(0, 200)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '<tel>');

function errorProveedor(nombre, status, cuerpo) {
  const err = new Error(`[${nombre}] ${status}: ${sinDatosPersonales(cuerpo)}`);
  err.status = status;
  return err;
}

// Vercel guarda las variables tal cual: si MAIL_FROM se cargó con comillas, se quitan acá.
const mailFrom = () => env('MAIL_FROM').trim().replace(/^"(.*)"$/, '$1');

export async function enviarMail({ to, subject, html, text, replyTo }) {
  const payload = { from: mailFrom(), to: [to], subject, html, text };
  if (replyTo && RE_EMAIL.test(String(replyTo))) payload.reply_to = String(replyTo);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw errorProveedor('resend', res.status, await res.text());
  return res.json();
}

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

// Meta rechaza parámetros con saltos de línea, tabs o más de 4 espacios seguidos.
const parametro = (s, max = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Envía la plantilla aprobada en Meta Business con los parámetros:
 * {{1}} nombre · {{2}} números · {{3}} bici · {{4}} fecha del sorteo · {{5}} link de la orden
 * (ver docs/03-automatizaciones.md para el texto de la plantilla).
 */
export async function enviarWhatsApp({ orden, numeros, campaign, baseUrl }) {
  const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);
  const fecha = fmtFecha(campaign.edicion.fecha_sorteo);
  const to = String(orden.whatsapp).replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME || 'participacion_confirmada',
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'es_AR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: parametro(orden.nombre, 80) },
            { type: 'text', text: parametro(numeros.map(fmtNumero).join(', '), 1000) },
            { type: 'text', text: parametro(bici?.nombre || 'Polygon', 80) },
            { type: 'text', text: parametro(`${fecha} hs`, 80) },
            { type: 'text', text: `${baseUrl}/gracias?orden=${orden.id}` },
          ],
        },
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw errorProveedor('whatsapp', res.status, await res.text());
  return res.json();
}
