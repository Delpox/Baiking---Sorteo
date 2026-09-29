// GET | POST /api/recordatorios[?tipo=semana|sorteo][&test=mail@dominio][&forzar=1]
// Recordatorios automáticos por mail, uno solo de cada tipo por edición:
//   semana → 7 días antes de edicion.fecha_sorteo: a todas las personas con alguna orden de la
//            edición (pagada, en_revision o pendiente), una por email (variantes: general /
//            subí el comprobante / mandá la carta).
//   sorteo → el día de edicion.fecha_sorteo: a todas las personas con alguna orden pagada, una
//            por email, con sus números (de todas sus órdenes juntas).
// Lo llama Vercel Cron todos los días a las 10:00 de Buenos Aires (vercel.json: "0 13 * * *";
// el plan Hobby solo admite crons diarios y hasta 2: este y /api/sheets-sync). Sin parámetros
// decide solo por la fecha de hoy en Buenos Aires; si no corresponde, no manda nada.
// Idempotente: `ediciones.recordatorio_semana_at` / `recordatorio_sorteo_at` se reclaman con un
// update condicional antes de enviar (si una corrida no logra mandar ninguno, libera la marca).
// Autorización: Bearer <CRON_SECRET> (cron) o el token de admin (a mano).
//   ?tipo=…&test=mail@dominio → manda UN mail de muestra a esa dirección, sin marcar nada.
//   ?tipo=…&forzar=1 (solo admin) → manda hoy aunque no sea la fecha (y marca).
// Respuesta: { ok, tipo, destinatarios, enviados, errores } · sin mails: { ok, enviados: 0, motivo }.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, getQuery, baseUrl, adminAutorizado, cronAutorizado } from './_lib/http.js';
import { listarOrdenes, listarParticipaciones, reclamarMarcaEn, liberarMarcaEn } from './_lib/db.js';
import { armarMailRecordatorioSemana, armarMailRecordatorioSorteo, enviarLote, enviarMail } from './_lib/notificaciones.js';
import { RE_EMAIL } from './_lib/validar.js';

const TZ = 'America/Argentina/Buenos_Aires';
const TIPOS = ['semana', 'sorteo'];
const MARCA = { semana: 'recordatorio_semana_at', sorteo: 'recordatorio_sorteo_at' };
const ESTADOS = { semana: ['pagada', 'en_revision', 'pendiente'], sorteo: ['pagada'] };

const claveDia = (ms) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(new Date(ms));

/** Qué recordatorio corresponde hoy (día calendario de Buenos Aires), o null. */
export function tipoQueCorresponde(cfg, ahora = Date.now()) {
  const sorteo = new Date(cfg.edicion.fecha_sorteo).getTime();
  if (!Number.isFinite(sorteo)) return null;
  const hoy = claveDia(ahora);
  if (hoy === claveDia(sorteo)) return 'sorteo';
  if (hoy === claveDia(sorteo - 7 * 864e5)) return 'semana';
  return null;
}

/** Agrupa las órdenes por email (una persona = un mail): { email, nombre, ordenes } con el nombre de la orden más reciente. */
export function agruparPersonas(ordenes) {
  const personas = new Map();
  for (const o of ordenes) {
    const email = String(o.email || '').trim().toLowerCase();
    if (!RE_EMAIL.test(email)) continue;
    const p = personas.get(email) || { email, nombre: o.nombre, ordenes: [] };
    p.ordenes.push(o);
    if (String(o.created_at) >= String(p.ordenes[0]?.created_at || '')) p.nombre = o.nombre;
    personas.set(email, p);
  }
  return [...personas.values()];
}

/** Arma los mails de un tipo para todas las personas de la edición. */
async function armarMails(tipo, edicionId, base) {
  const ordenes = await listarOrdenes(edicionId, {
    estados: ESTADOS[tipo],
    columnas: 'id,created_at,email,nombre,estado,medio_pago,origen,comprobante_at,cantidad_participaciones',
  });
  const personas = agruparPersonas(ordenes);
  if (tipo === 'semana') {
    return personas.map((persona) => ({ to: persona.email, ...armarMailRecordatorioSemana({ persona, ordenes: persona.ordenes, campaign, baseUrl: base }) }));
  }
  const numerosPorOrden = new Map();
  for (const p of await listarParticipaciones(edicionId)) {
    if (!numerosPorOrden.has(p.orden_id)) numerosPorOrden.set(p.orden_id, []);
    numerosPorOrden.get(p.orden_id).push(Number(p.numero));
  }
  return personas
    .map((persona) => {
      const numeros = persona.ordenes.filter((o) => o.estado === 'pagada').flatMap((o) => numerosPorOrden.get(o.id) || []).sort((a, b) => a - b);
      if (!numeros.length) return null;
      return { to: persona.email, ...armarMailRecordatorioSorteo({ persona, numeros, campaign, baseUrl: base }) };
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Método no permitido' });
  const esAdmin = await adminAutorizado(req);
  if (!esAdmin && !(await cronAutorizado(req))) return json(res, 401, { error: 'No autorizado' });

  const q = getQuery(req);
  const pedido = q.tipo ? String(q.tipo) : '';
  if (pedido && !TIPOS.includes(pedido)) return json(res, 400, { error: 'tipo inválido (semana | sorteo)' });
  const test = q.test ? String(q.test).trim().toLowerCase() : '';
  if (test && !RE_EMAIL.test(test)) return json(res, 400, { error: 'test debe ser una dirección de mail' });
  if (test && !pedido) return json(res, 400, { error: 'test requiere tipo=semana|sorteo' });
  const forzar = String(q.forzar || '') === '1';
  if (forzar && !esAdmin) return json(res, 403, { error: 'forzar requiere el token de admin' });
  if (forzar && !pedido) return json(res, 400, { error: 'forzar requiere tipo=semana|sorteo' });

  const hoyCorresponde = tipoQueCorresponde(campaign);
  const tipo = pedido || hoyCorresponde;
  if (!tipo) return json(res, 200, { ok: true, enviados: 0, motivo: 'no corresponde hoy' });
  if (!test && !forzar && tipo !== hoyCorresponde) return json(res, 200, { ok: true, tipo, enviados: 0, motivo: 'no corresponde hoy' });

  const edicionId = campaign.edicion.id;
  const base = baseUrl(req);

  try {
    if (test) {
      // Un mail de muestra: el de esa persona si tiene órdenes, si no el de la primera (o uno sintético).
      const mails = await armarMails(tipo, edicionId, base);
      let muestra = mails.find((m) => m.to === test) || mails[0];
      if (!muestra) {
        const persona = { email: test, nombre: 'Prueba', ordenes: [] };
        muestra = tipo === 'semana'
          ? armarMailRecordatorioSemana({ persona, ordenes: [], campaign, baseUrl: base })
          : armarMailRecordatorioSorteo({ persona, numeros: [1, 2, 3], campaign, baseUrl: base });
      }
      await enviarMail({ ...muestra, to: test });
      return json(res, 200, { ok: true, tipo, test: true, destinatarios: 1, enviados: 1, errores: 0 });
    }

    const columna = MARCA[tipo];
    if (!(await reclamarMarcaEn('ediciones', edicionId, columna))) {
      return json(res, 200, { ok: true, tipo, enviados: 0, motivo: 'ya se mandó en esta edición' });
    }
    const mails = await armarMails(tipo, edicionId, base);
    const { enviados, errores } = await enviarLote(mails);
    if (mails.length && !enviados) {
      // No salió ninguno (Resend caído): se libera la marca para poder reintentar (forzar=1).
      await liberarMarcaEn('ediciones', edicionId, columna).catch((e) => console.error('[recordatorios] liberar marca', e.message || e));
    }
    console.log(`[recordatorios] ${tipo} · edición ${edicionId} · destinatarios ${mails.length} · enviados ${enviados} · errores ${errores}`);
    return json(res, 200, { ok: errores === 0, tipo, destinatarios: mails.length, enviados, errores });
  } catch (err) {
    console.error('[recordatorios]', err.message || err);
    return json(res, 500, { ok: false, error: 'Error mandando los recordatorios', detalle: String(err.message || err).slice(0, 300) });
  }
}
