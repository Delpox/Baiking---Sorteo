// /api/admin — datos del panel de administración (protegido por ADMIN_TOKEN, que viaja
// en el header Authorization: Bearer <token>; ver adminAutorizado en _lib/http.js).
//   GET  [?edicion=edicion-1]            → resumen: órdenes (cada una con su bloque `rango` =
//                                          { desde, hasta, cantidad } | null), presencia, contadores
//   POST { accion, orden_id, revisor, motivo }   (las acciones que confirman responden `rango`)
//        accion = 'aprobar'        → confirma una TRANSFERENCIA pendiente o en revisión (bloque de números + mail + WhatsApp)
//        accion = 'rechazar'       → marca una orden pendiente o en revisión como rechazada
//        accion = 'sincronizar_mp' → vuelve a consultar en Mercado Pago los pagos de una orden
//                                    (recupera órdenes cuyo webhook se perdió; mismas reglas que el webhook)
//        accion = 'acreditar'      → conciliación manual contra el banco de una TRANSFERENCIA:
//                                    { acreditada: true | false | null, nota? }. true = "llegó la plata":
//                                    si la orden está pendiente/en_revision la aprueba (bloque de números + mail);
//                                    false = "no llegó": queda marcada para reclamar, sin cambiar el estado;
//                                    null = vuelve a "sin revisar".
//        accion = 'carta_recibida' → vía gratuita en dos pasos: llegó la carta de una participación
//                                    sin cargo `pendiente` → guarda carta_recibida_at, asigna la participación y manda el mail
//        accion = 'carta_rechazada'→ la carta no llegó en el plazo (o no sirve): la participación queda `rechazada`
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { db, obtenerOrden, actualizarOrden, contarParticipaciones, contarPadron, rangoDeOrden } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';
import { buscarPagosPorOrden } from './_lib/mercadopago.js';
import { aplicarPago } from './_lib/pagos-mp.js';
import { RE_UUID, texto } from './_lib/validar.js';
import { configCarta } from './_lib/carta.js';
import { espejarOrdenEnSheet } from './_lib/sheets.js';

const RE_EDICION = /^[a-z0-9-]{1,40}$/;

const CAMPOS = [
  'id', 'created_at', 'pagada_at', 'estado', 'origen', 'medio_pago', 'pack_id',
  'cantidad_participaciones', 'numero_desde', 'numero_hasta', 'monto', 'bici_preferida', 'provincia', 'nombre', 'apellido',
  'email', 'dni', 'whatsapp', 'codigo', 'comprobante_url', 'comprobante_datos', 'comprobante_at',
  'revisado_por', 'revisado_at', 'email_enviado_at', 'whatsapp_enviado_at', 'mp_payment_id',
  'acreditada', 'acreditada_at', 'acreditada_nota', 'carta_recibida_at', 'instrucciones_enviado_at',
].join(',');

// Participaciones sin cargo que esperan la carta (vía gratuita en dos pasos).
const esCartaPendiente = (o) => o.origen === 'gratuita' && o.estado === 'pendiente';

// Transferencias que entran en la conciliación diaria: con comprobante y no cerradas.
const ESTADOS_CONCILIABLES = ['pendiente', 'en_revision', 'pagada'];
const esConciliable = (o) => o.medio_pago === 'transferencia' && Boolean(o.comprobante_at) && ESTADOS_CONCILIABLES.includes(o.estado);

async function resumen(req, res) {
  const { edicion } = getQuery(req);
  if (edicion && !RE_EDICION.test(String(edicion))) return json(res, 400, { error: 'edicion inválida' });
  const edicionId = edicion || campaign.edicion.id;

  const { data: ordenes, error } = await db()
    .from('ordenes')
    .select(CAMPOS)
    .eq('edicion_id', edicionId)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`[db] ${error.message}`);

  const hace1min = new Date(Date.now() - 60e3).toISOString();
  const hoy = new Date();
  hoy.setUTCHours(hoy.getUTCHours() - 3); // día calendario de Argentina
  const inicioHoy = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 3)).toISOString();

  const [{ count: ahora }, { count: visitasHoy }, enPadron, emitidos] = await Promise.all([
    db().from('presencia').select('*', { count: 'exact', head: true }).gt('last_seen', hace1min),
    db().from('presencia').select('*', { count: 'exact', head: true }).gte('first_seen', inicioHoy),
    contarPadron(edicionId),
    contarParticipaciones(edicionId),
  ]);

  return json(res, 200, {
    generado_at: new Date().toISOString(),
    edicion: campaign.edicion,
    unidad: campaign.unidad || { singular: 'participación', plural: 'participaciones' },
    packs: campaign.packs,
    bicis: campaign.bicis.map((b) => ({ id: b.id, nombre: b.nombre })),
    presencia: { ahora: ahora || 0, hoy: visitasHoy || 0 },
    // En el padrón: suma de las cantidades de las órdenes pagadas con bloque (coincide con el
    // CSV de /api/export que se publica antes del sorteo).
    participaciones_total: enPadron,
    // Números emitidos (contador correlativo = máximo numero_hasta; incluye reembolsadas/rechazadas).
    numeros_emitidos: emitidos,
    cupo_total: Number(campaign.edicion.cupo_total || 0),
    // Conciliación contra el banco: con comprobante y todavía sin marcar / marcadas "no llegó".
    transferencias_sin_conciliar: (ordenes || []).filter((o) => esConciliable(o) && o.acreditada == null).length,
    transferencias_no_acreditadas: (ordenes || []).filter((o) => o.medio_pago === 'transferencia' && o.acreditada === false).length,
    // Vía gratuita en dos pasos: registradas en el sitio que todavía esperan la carta.
    gratuitas_sin_carta: (ordenes || []).filter(esCartaPendiente).length,
    participacion_gratuita: (() => {
      const c = configCarta(campaign);
      return { requiere_carta: c.requiere, direccion_carta: c.direccion, plazo_carta_dias: c.plazoDias };
    })(),
    // Cada orden lleva su bloque de números como `rango` ({ desde, hasta, cantidad } | null).
    ordenes: (ordenes || []).map(({ numero_desde, numero_hasta, ...o }) => ({ ...o, rango: rangoDeOrden({ numero_desde, numero_hasta }) })),
  });
}

async function accion(req, res) {
  const body = readJson(req);
  const ordenId = String(body.orden_id || '');
  if (!RE_UUID.test(ordenId)) return json(res, 400, { error: 'orden_id inválido' });
  const orden = await obtenerOrden(ordenId);
  if (!orden) return json(res, 404, { error: 'Orden inexistente' });
  const revisor = texto(body.revisor, 60) || 'panel';

  if (body.accion === 'aprobar') {
    if (orden.estado === 'pagada') return json(res, 200, { ok: true, ya_estaba: true });
    if (orden.medio_pago !== 'transferencia' || !['pendiente', 'en_revision'].includes(orden.estado)) {
      return json(res, 409, {
        error: `Solo se aprueban transferencias pendientes o en revisión (esta orden es ${orden.medio_pago} / ${orden.estado}). Para una orden de Mercado Pago, usá "sincronizar_mp" o el reembolso.`,
      });
    }
    const { rango } = await confirmarOrden({
      orden,
      campaign,
      baseUrl: baseUrl(req),
      cambios: { revisado_por: revisor, revisado_at: new Date().toISOString() },
    });
    return json(res, 200, { ok: true, rango });
  }

  if (body.accion === 'rechazar') {
    if (orden.estado === 'pagada') return json(res, 409, { error: 'La orden ya está pagada; usá un reembolso.' });
    if (!['pendiente', 'en_revision'].includes(orden.estado)) return json(res, 409, { error: `La orden ya está ${orden.estado}.` });
    const rechazada = await actualizarOrden(orden.id, {
      estado: 'rechazada',
      revisado_por: revisor,
      revisado_at: new Date().toISOString(),
      comprobante_datos: { ...(orden.comprobante_datos || {}), motivo_rechazo: texto(body.motivo, 300) },
    });
    await espejarOrdenEnSheet(rechazada);
    return json(res, 200, { ok: true });
  }

  if (body.accion === 'acreditar') {
    if (orden.medio_pago !== 'transferencia') return json(res, 409, { error: 'Solo se concilian transferencias.' });
    const valor = body.acreditada;
    if (valor !== true && valor !== false && valor !== null) return json(res, 400, { error: 'acreditada debe ser true, false o null' });
    const ahora = new Date().toISOString();
    const marca = {
      acreditada: valor,
      acreditada_at: valor === null ? null : ahora,
      acreditada_nota: texto(body.motivo ?? body.nota, 300) || null,
      revisado_por: revisor,
      revisado_at: ahora,
    };
    if (valor === true && ['pendiente', 'en_revision'].includes(orden.estado)) {
      // "Llegó la plata" es la aprobación definitiva: bloque de números + mail de confirmación.
      const { rango } = await confirmarOrden({ orden, campaign, baseUrl: baseUrl(req), cambios: marca });
      return json(res, 200, { ok: true, estado: 'pagada', acreditada: true, rango });
    }
    const actual = await actualizarOrden(orden.id, marca);
    await espejarOrdenEnSheet(actual);
    const nota = valor === true && actual.estado !== 'pagada' ? `La orden está ${actual.estado}: se marcó acreditada pero no se aprueba.` : undefined;
    return json(res, 200, { ok: true, estado: actual.estado, acreditada: actual.acreditada, ...(nota ? { nota } : {}) });
  }

  if (body.accion === 'carta_recibida') {
    if (orden.origen !== 'gratuita') return json(res, 409, { error: 'Solo para participaciones sin cargo.' });
    if (orden.estado === 'pagada') return json(res, 409, { error: 'La participación ya está confirmada.' });
    if (orden.estado !== 'pendiente') return json(res, 409, { error: `La participación está ${orden.estado}.` });
    const ahora = new Date().toISOString();
    const nota = texto(body.motivo ?? body.nota, 300);
    const { rango } = await confirmarOrden({
      orden,
      campaign,
      baseUrl: baseUrl(req),
      gratuita: true,
      cambios: {
        carta_recibida_at: ahora,
        revisado_por: revisor,
        revisado_at: ahora,
        ...(nota ? { comprobante_datos: { ...(orden.comprobante_datos || {}), carta_nota: nota } } : {}),
      },
    });
    return json(res, 200, { ok: true, estado: 'pagada', rango, carta_recibida_at: ahora });
  }

  if (body.accion === 'carta_rechazada') {
    if (orden.origen !== 'gratuita') return json(res, 409, { error: 'Solo para participaciones sin cargo.' });
    if (orden.estado !== 'pendiente') return json(res, 409, { error: `La participación está ${orden.estado}.` });
    const rechazada = await actualizarOrden(orden.id, {
      estado: 'rechazada',
      revisado_por: revisor,
      revisado_at: new Date().toISOString(),
      comprobante_datos: { ...(orden.comprobante_datos || {}), motivo_rechazo: texto(body.motivo ?? body.nota, 300) || 'La carta no llegó en el plazo' },
    });
    await espejarOrdenEnSheet(rechazada);
    return json(res, 200, { ok: true, estado: 'rechazada' });
  }

  if (body.accion === 'sincronizar_mp') {
    if (orden.medio_pago !== 'mercadopago') return json(res, 409, { error: 'La orden no se paga por Mercado Pago.' });
    const pagos = await buscarPagosPorOrden(orden.id);
    if (!pagos.length) return json(res, 200, { ok: true, estado: orden.estado, nota: 'Mercado Pago no registra pagos para esta orden.' });
    // Si hay un pago aprobado, manda ese; si no, el más reciente.
    const pago = pagos.find((p) => p.status === 'approved') || pagos[0];
    const out = await aplicarPago({ pago, orden, campaign, baseUrl: baseUrl(req) });
    return json(res, 200, { ok: true, pago_id: String(pago.id), pago_status: pago.status, ...out });
  }

  return json(res, 400, { error: 'Acción desconocida' });
}

export default async function handler(req, res) {
  if (!(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });
  try {
    if (req.method === 'GET') return await resumen(req, res);
    if (req.method === 'POST') return await accion(req, res);
    return json(res, 405, { error: 'Método no permitido' });
  } catch (err) {
    console.error('[admin]', err.message || err);
    return json(res, 500, { error: 'Error en el panel' });
  }
}
