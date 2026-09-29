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

/**
 * Cómo se muestran los números de una orden: pocos → lista ("0001 · 0002 · 0003");
 * muchos y consecutivos (los packs grandes: 100, 500, 2000 chances; el RPC siempre asigna
 * un bloque correlativo) → rango ("del 0001 al 0100"), para que el mail no lleve miles de
 * números y el parámetro de la plantilla de WhatsApp no supere el largo que admite Meta.
 */
export function describirNumeros(numeros, { sep = ' · ', maxLista = 12, maxTramos = 6 } = {}) {
  const lista = [...new Set((numeros || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!lista.length) return '';
  if (lista.length <= maxLista) return lista.map(fmtNumero).join(sep);
  // Tramos consecutivos: una persona con varias órdenes tiene varios bloques
  // ("del 0001 al 0100 y del 0201 al 0300"); si está muy fragmentado, la lista completa.
  const tramos = [];
  for (const n of lista) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && n === ultimo[1] + 1) ultimo[1] = n;
    else tramos.push([n, n]);
  }
  if (tramos.length > maxTramos) return lista.map(fmtNumero).join(sep);
  const partes = tramos.map(([a, b]) => (a === b ? fmtNumero(a) : `del ${fmtNumero(a)} al ${fmtNumero(b)}`));
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

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
  return `<p style="font-size:12px;line-height:1.6;color:#6e686b;margin:28px 0 0">
      ${legal.leyenda ? `<strong>${escapeHtml(legal.leyenda)}</strong><br>` : ''}
      ${escapeHtml(legal.aviso_corto || '')}
      Bases y condiciones: <a href="${escapeHtml(baseUrl)}/bases-y-condiciones" style="color:#c40020">${escapeHtml(baseUrl)}/bases-y-condiciones</a>
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
  const lista = describirNumeros(numeros);
  const nombre = escapeHtml(orden.nombre);
  const plural = numeros.length > 1;
  const u = unidad(campaign, numeros.length);
  const curso = campaign.curso;
  const biciNombre = bici?.nombre || 'Polygon';
  const packTxt = pack ? ` · pack de ${pack.nombre}` : '';
  // Nombre completo del curso solo si difiere del corto (para no repetirlo).
  const cursoLargo = curso.nombre && curso.nombre !== curso.nombre_corto ? curso.nombre : '';
  // Link al curso (YouTube no listado). Vacío o "[A CONFIRMAR]" → el mail avisa que llega aparte.
  const cursoUrl = pendienteConfig(curso.url_acceso) ? '' : String(curso.url_acceso).trim();

  const subject = gratuita
    ? `¡Listo, ${orden.nombre}! Registramos tu participación sin cargo · Baiking`
    : `¡Listo, ${orden.nombre}! Tu curso y ${plural ? `tus ${u}` : `tu ${u}`} · Baiking`;

  const conCarta = gratuita && Boolean(orden.carta_recibida_at);
  const intro = gratuita
    ? `${conCarta ? 'Recibimos tu carta y registramos' : 'Registramos'} tu participación <strong style="color:#1c1a1b">sin obligación de compra</strong>. Quedaste participando por tu <strong style="color:#1c1a1b">${escapeHtml(biciNombre)}</strong> con la misma probabilidad que cualquier otra participación.`
    : `Confirmamos tu pago del <strong style="color:#1c1a1b">${escapeHtml(curso.nombre_corto)}</strong>${escapeHtml(packTxt)}. Ya tenés acceso al ${cursoLargo ? `<strong style="color:#1c1a1b">${escapeHtml(cursoLargo)}</strong>` : 'curso'} y, como bonificación sin cargo del curso, quedaste participando por tu <strong style="color:#1c1a1b">${escapeHtml(biciNombre)}</strong> con ${numeros.length} ${escapeHtml(u)}.`;

  const html = marcoMail(
    campaign,
    `¡Ya estás adentro, ${nombre}!`,
    `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#4a4649">${intro}</p>

    <div style="background:#fff0f2;border:1px solid #f3b5be;border-radius:14px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6e686b">
        ${plural ? `Tus ${escapeHtml(u)}` : `Tu ${escapeHtml(u)}`}
      </p>
      <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:.04em;color:#c40020">${lista}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#6e686b">Orden ${escapeHtml(orden.id)}</p>
    </div>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px">
      <tr><td style="padding:8px 0;color:#6e686b">Sorteo en vivo</td><td style="padding:8px 0;text-align:right">${escapeHtml(fecha)} hs · Instagram @${escapeHtml(campaign.contacto.instagram)}</td></tr>
      <tr><td style="padding:8px 0;color:#6e686b">Bici elegida</td><td style="padding:8px 0;text-align:right">${escapeHtml(bici?.nombre || '')}</td></tr>
      <tr><td style="padding:8px 0;color:#6e686b">${escapeHtml(unidad(campaign, 2).charAt(0).toUpperCase() + unidad(campaign, 2).slice(1))}</td><td style="padding:8px 0;text-align:right">${numeros.length}</td></tr>
    </table>

    ${
      gratuita
        ? ''
        : cursoUrl
          ? `<a href="${escapeHtml(cursoUrl)}" style="display:inline-block;background:#eb0627;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Entrar al curso</a>
    <p style="font-size:13px;line-height:1.6;color:#6e686b;margin:14px 0 0">${escapeHtml(curso.acceso_texto || '')}</p>`
          : `<p style="font-size:15px;line-height:1.6;color:#4a4649;margin:0;padding:14px 16px;background:#f7f5f6;border-radius:10px">El link del curso te llega en un mail aparte, apenas esté publicado.</p>`
    }

    <p style="font-size:13px;line-height:1.6;color:#6e686b;margin:28px 0 0">
      Guardá este mail: es tu comprobante de participación. Podés ver tus ${escapeHtml(unidad(campaign, 2))} cuando quieras en
      <a href="${escapeHtml(baseUrl)}/gracias?orden=${escapeHtml(orden.id)}" style="color:#c40020">${escapeHtml(baseUrl)}/gracias</a>.
    </p>`,
    baseUrl,
  );

  const text = `¡Ya estás adentro, ${orden.nombre}!
${
  gratuita
    ? `${conCarta ? 'Recibimos tu carta y registramos' : 'Registramos'} tu participación sin obligación de compra.`
    : `Confirmamos tu pago del ${curso.nombre_corto}${packTxt}${cursoLargo ? ` (${cursoLargo})` : ''}. Ya tenés acceso al curso y, como bonificación sin cargo del curso, quedaste participando por tu ${biciNombre}.`
}
${plural ? `Tus ${u}` : `Tu ${u}`}: ${lista}
Bici elegida: ${bici?.nombre || ''}
Sorteo en vivo: ${fecha} hs por Instagram @${campaign.contacto.instagram}
${gratuita ? '' : `${cursoUrl ? `Acceso al curso: ${cursoUrl}\n${curso.acceso_texto || ''}` : 'El link del curso te llega en un mail aparte, apenas esté publicado.'}\n`}Orden: ${orden.id}
Ver tus ${unidad(campaign, 2)}: ${baseUrl}/gracias?orden=${orden.id}

${pieLegalTexto(campaign, baseUrl)}`;

  return { subject, html, text };
}

const fmtARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/**
 * Marco común de todos los mails (identidad Baiking: header rojo con el logo, tarjeta
 * blanca, un solo botón rojo, pie gris con contacto y leyenda legal). Tablas e inline
 * styles porque los clientes de mail no cargan CSS ni tipografías externas.
 * El logo se sirve desde el sitio (`${baseUrl}/assets/img/logo-baiking-blanco.png`).
 */
function marcoMail(campaign, titulo, cuerpoHtml, baseUrl) {
  const logo = `${baseUrl}/assets/img/logo-baiking-blanco.png`;
  const contacto = campaign.contacto || {};
  const wa = contacto.whatsapp ? `https://wa.me/${escapeHtml(contacto.whatsapp)}` : '';
  const ig = contacto.instagram ? `https://instagram.com/${escapeHtml(contacto.instagram)}` : '';
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f2f3;font-family:Helvetica,Arial,sans-serif;color:#1c1a1b;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2f3;border-collapse:collapse">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;border-collapse:separate;border-radius:16px;overflow:hidden;background:#ffffff;border:1px solid #e6e0e2">
        <tr><td style="background:#eb0627;padding:18px 28px" align="center">
          <img src="${escapeHtml(logo)}" alt="Baiking · Tienda de bicis" height="40" style="height:40px;width:auto;display:block;border:0">
        </td></tr>
        <tr><td style="padding:28px 28px 8px">
          <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#c40020;margin:0 0 12px;font-weight:700">${escapeHtml(campaign.edicion.nombre)} · Curso + sorteo</p>
          <h1 style="font-size:26px;line-height:1.15;margin:0 0 16px;color:#1c1a1b">${titulo}</h1>
          ${cuerpoHtml}
        </td></tr>
        <tr><td style="padding:20px 28px 28px">
          <p style="font-size:13px;line-height:1.6;color:#6e686b;margin:0;border-top:1px solid #e6e0e2;padding-top:18px">
            ¿Dudas? Respondé este mail${wa ? ` o escribinos por <a href="${wa}" style="color:#c40020">WhatsApp</a>` : ''}${ig ? ` · <a href="${ig}" style="color:#c40020">@${escapeHtml(contacto.instagram)}</a>` : ''}.<br>
            Baiking Tienda de Bicis · ${escapeHtml(contacto.direccion || '')}
          </p>
          ${pieLegalHtml(campaign, baseUrl)}
        </td></tr>
      </table>
    </td></tr>
  </table>
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
    `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#4a4649">Elegiste pagar el <strong style="color:#1c1a1b">${escapeHtml(curso.nombre_corto)}</strong>${escapeHtml(packTxt)} por transferencia. Transferí el monto exacto (si tu banco pide un concepto, poné tu nombre y apellido) y subí el comprobante desde el botón. Si ya transferiste, solo falta el comprobante. Lo confirmamos en menos de ${escapeHtml(plazo)} hs y te asignamos tus ${escapeHtml(unidad(campaign, 2))}.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px;background:#fff0f2;border:1px solid #f3b5be;border-radius:14px">
      ${filas.map(([k, v]) => `<tr><td style="padding:10px 14px;color:#6e686b">${escapeHtml(k)}</td><td style="padding:10px 14px;text-align:right;font-weight:600;color:#1c1a1b">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#eb0627;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Subir el comprobante</a>
    <p style="font-size:14px;line-height:1.6;color:#6e686b;margin:20px 0 0">${porMailHtml}La reserva vence si no recibimos la transferencia en ${escapeHtml(plazo)} hs.</p>`,
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
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#4a4649">Tu participación <strong style="color:#1c1a1b">sin obligación de compra</strong> queda firme cuando recibimos tu carta. Mandala por correo a:</p>
    <p style="font-size:17px;line-height:1.5;margin:0 0 6px;color:#fff;font-weight:700">${escapeHtml(direccion)}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#6e686b">o entregala en la tienda${escapeHtml(horarios)}.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#4a4649">La carta tiene que incluir:</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:#4a4649">${requisitos.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#4a4649">Tenés <strong style="color:#1c1a1b">${plazoDias} días</strong>: la carta tiene que llegar antes del <strong style="color:#1c1a1b">${escapeHtml(vence)}</strong>. Cuando la recibamos te mandamos un mail con tu ${escapeHtml(u)}. Una (1) ${escapeHtml(u)} por persona, con la misma probabilidad que cualquier otra.</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#eb0627;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Ver el estado de mi participación</a>`,
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
    `<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#4a4649">Recibimos el comprobante de tu transferencia de <strong style="color:#1c1a1b">${escapeHtml(detalle)}</strong>. Lo estamos revisando: en cuanto se acredite te mandamos otro mail con el acceso al curso y tus ${escapeHtml(unidad(campaign, 2))} (en general, en menos de ${escapeHtml(plazo)} hs).</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#eb0627;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Ver el estado de mi orden</a>
    <p style="font-size:13px;line-height:1.6;color:#6e686b;margin:20px 0 0">Orden ${escapeHtml(orden.id)}</p>`,
    baseUrl,
  );
  const text = `Recibimos tu comprobante, ${orden.nombre}.
Transferencia de ${detalle}. Lo estamos revisando: en cuanto se acredite te mandamos otro mail con el acceso al curso y tus ${unidad(campaign, 2)} (en general, en menos de ${plazo} hs).
Estado de tu orden: ${link}
Orden: ${orden.id}

${pieLegalTexto(campaign, baseUrl)}`;
  return { subject, html, text };
}

const fmtHora = (iso, tz = 'America/Argentina/Buenos_Aires') =>
  new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));

const BOTON = 'display:inline-block;background:#eb0627;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px';
const PARRAFO = 'font-size:16px;line-height:1.6;margin:0 0 20px;color:#4a4649';

/**
 * Recordatorio "falta una semana para el sorteo" (lo manda /api/recordatorios una sola vez
 * por edición, a una persona por email). Tres variantes según las órdenes de la persona:
 *  - general: fecha del sorteo, cierre de inscripciones y botón "Sumar chances";
 *  - comprobante: su última orden por transferencia sigue `pendiente` (sin comprobante);
 *  - carta: tiene una participación sin cargo `pendiente` de la carta.
 * Devuelve { subject, html, text, variante }.
 */
export function armarMailRecordatorioSemana({ persona, ordenes, campaign, baseUrl }) {
  const lista = Array.isArray(ordenes) ? ordenes : persona?.ordenes || [];
  const nombre = persona?.nombre || lista[0]?.nombre || '';
  const ig = campaign.contacto?.instagram || '';
  const u2 = unidad(campaign, 2);
  const fechaSorteo = fmtFecha(campaign.edicion.fecha_sorteo);
  const cierre = fmtFecha(campaign.edicion.cierre_ventas);
  const porFecha = [...lista].sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
  const ultimaTransferencia = porFecha.find((o) => o.medio_pago === 'transferencia');
  const gratuitaPendiente = porFecha.find((o) => o.origen === 'gratuita' && o.estado === 'pendiente');
  const enRevision = lista.some((o) => o.estado === 'en_revision');

  const subject = 'Falta una semana para el sorteo · Baiking';
  const titulo = `Falta una semana para el sorteo${nombre ? `, ${escapeHtml(nombre)}` : ''}`;
  const cuandoHtml = `El <strong style="color:#1c1a1b">${escapeHtml(fechaSorteo)} hs</strong> sorteamos en vivo en Instagram <strong style="color:#1c1a1b">@${escapeHtml(ig)}</strong>. Las inscripciones cierran el ${escapeHtml(cierre)} hs.`;
  const cuandoTexto = `El ${fechaSorteo} hs sorteamos en vivo en Instagram @${ig}. Las inscripciones cierran el ${cierre} hs.`;

  let variante = 'general';
  let cuerpoHtml;
  let cuerpoTexto;
  let boton;
  if (ultimaTransferencia && ultimaTransferencia.estado === 'pendiente') {
    variante = 'comprobante';
    const link = `${baseUrl}/gracias?orden=${ultimaTransferencia.id}`;
    boton = { texto: 'Subir el comprobante', href: link };
    cuerpoHtml = `<p style="${PARRAFO}">Tu orden sigue <strong style="color:#1c1a1b">pendiente</strong>: todavía no recibimos el comprobante de tu transferencia. Subilo para que tus ${escapeHtml(u2)} entren al sorteo.</p>
    <p style="${PARRAFO}">${cuandoHtml}</p>`;
    cuerpoTexto = `Tu orden sigue pendiente: todavía no recibimos el comprobante de tu transferencia. Subilo para que tus ${u2} entren al sorteo: ${link}\n${cuandoTexto}`;
  } else if (gratuitaPendiente) {
    variante = 'carta';
    const { direccion } = configCarta(campaign);
    const vence = fmtDia(venceCarta(gratuitaPendiente, campaign));
    const link = `${baseUrl}/gracias?orden=${gratuitaPendiente.id}`;
    boton = { texto: 'Ver el estado de mi participación', href: link };
    cuerpoHtml = `<p style="${PARRAFO}">Todavía no recibimos tu carta: tenés tiempo hasta el <strong style="color:#1c1a1b">${escapeHtml(vence)}</strong>. Mandala a <strong style="color:#1c1a1b">${escapeHtml(direccion)}</strong> o entregala en la tienda, y tu ${escapeHtml(unidad(campaign, 1))} entra al sorteo.</p>
    <p style="${PARRAFO}">${cuandoHtml}</p>`;
    cuerpoTexto = `Todavía no recibimos tu carta: tenés tiempo hasta el ${vence}. Mandala a ${direccion} o entregala en la tienda, y tu ${unidad(campaign, 1)} entra al sorteo.\n${cuandoTexto}\nEstado de tu participación: ${link}`;
  } else {
    boton = { texto: `Sumar ${u2}`, href: baseUrl };
    const revisionHtml = enRevision ? `<p style="${PARRAFO}">Tu transferencia está en revisión: en cuanto se acredite te mandamos tus ${escapeHtml(u2)} por mail.</p>` : '';
    cuerpoHtml = `<p style="${PARRAFO}">${cuandoHtml}</p>
    <p style="${PARRAFO}">Si querés sumar ${escapeHtml(u2)}, todavía estás a tiempo.</p>${revisionHtml}`;
    cuerpoTexto = `${cuandoTexto}\nSi querés sumar ${u2}, todavía estás a tiempo: ${baseUrl}${enRevision ? `\nTu transferencia está en revisión: en cuanto se acredite te mandamos tus ${u2} por mail.` : ''}`;
  }

  const html = marcoMail(campaign, titulo, `${cuerpoHtml}
    <a href="${escapeHtml(boton.href)}" style="${BOTON}">${escapeHtml(boton.texto)}</a>`, baseUrl);
  const text = `Falta una semana para el sorteo${nombre ? `, ${nombre}` : ''}.
${cuerpoTexto}

${pieLegalTexto(campaign, baseUrl)}`;
  return { subject, html, text, variante };
}

/**
 * Recordatorio del día del sorteo, a cada persona con órdenes pagadas (sus números de
 * todas las órdenes juntos). Botón "Ver el vivo" → Instagram.
 */
export function armarMailRecordatorioSorteo({ persona, numeros, campaign, baseUrl }) {
  const nombre = persona?.nombre || '';
  const ig = campaign.contacto?.instagram || '';
  const linkIg = `https://instagram.com/${ig}`;
  const hora = fmtHora(campaign.edicion.fecha_sorteo);
  const lista = describirNumeros(numeros);
  const n = (numeros || []).length;
  const u = unidad(campaign, n);
  const plural = n !== 1;

  const subject = `¡Hoy es el sorteo! ${hora} en vivo · Baiking`;
  const html = marcoMail(
    campaign,
    `¡Hoy es el sorteo${nombre ? `, ${escapeHtml(nombre)}` : ''}!`,
    `<p style="${PARRAFO}">Hoy a las <strong style="color:#1c1a1b">${escapeHtml(hora)} hs</strong> sorteamos en vivo en Instagram <strong style="color:#1c1a1b">@${escapeHtml(ig)}</strong>.</p>
    <div style="background:#fff0f2;border:1px solid #f3b5be;border-radius:14px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6e686b">${plural ? `Tus ${n} ${escapeHtml(u)}` : `Tu ${escapeHtml(u)}`}</p>
      <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:.04em;color:#c40020">${escapeHtml(lista)}</p>
    </div>
    <p style="${PARRAFO}">Si ganás, te llamamos hoy mismo.</p>
    <a href="${escapeHtml(linkIg)}" style="${BOTON}">Ver el vivo</a>`,
    baseUrl,
  );
  const text = `¡Hoy es el sorteo${nombre ? `, ${nombre}` : ''}!
Hoy a las ${hora} hs sorteamos en vivo en Instagram @${ig}.
${plural ? `Tus ${n} ${u}` : `Tu ${u}`}: ${lista}
Si ganás, te llamamos hoy mismo.
Ver el vivo: ${linkIg}

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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Envío masivo (recordatorios): lotes de hasta 100 mails con Resend `/emails/batch`,
 * con una pausa entre lotes para no pasar el límite de requests por segundo. Si un lote
 * falla por un error del pedido (4xx: p. ej. una dirección inválida), cae a envío
 * individual para que un rebote no tumbe a los otros 99. Nunca lanza: devuelve
 * { enviados, errores } y loguea sin datos personales.
 */
export async function enviarLote(mails, { tamano = 100, pausaMs = 600, pausaIndividualMs = 120 } = {}) {
  let enviados = 0;
  let errores = 0;
  const cabeceras = { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' };
  const from = mailFrom();
  const aPayload = ({ to, subject, html, text, replyTo }) => ({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) });

  for (let i = 0; i < mails.length; i += tamano) {
    const lote = mails.slice(i, i + tamano);
    if (i > 0) await dormir(pausaMs);
    let status = 0;
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(lote.map(aPayload)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        enviados += Array.isArray(data.data) ? data.data.length : lote.length;
        continue;
      }
      console.error(`[resend] lote ${i / tamano + 1} (${lote.length} mails): ${errorProveedor('resend', res.status, await res.text()).message}`);
    } catch (err) {
      console.error(`[resend] lote ${i / tamano + 1} (${lote.length} mails): ${sinDatosPersonales(err.message || err)}`);
    }
    if (status && status < 500) {
      // Error del pedido: uno por uno, así solo se pierde el que rebota.
      for (const m of lote) {
        try {
          await enviarMail(m);
          enviados += 1;
        } catch (err) {
          errores += 1;
          console.error(`[resend] envío individual: ${err.message || err}`);
        }
        await dormir(pausaIndividualMs);
      }
    } else {
      errores += lote.length;
    }
  }
  return { enviados, errores };
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
            { type: 'text', text: parametro(describirNumeros(numeros, { sep: ', ' }), 1000) },
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
