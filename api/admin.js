// /api/admin — datos del panel de administración (protegido por ADMIN_TOKEN, que viaja
// en el header Authorization: Bearer <token>; ver adminAutorizado en _lib/http.js).
//   GET  [?edicion=edicion-1]            → resumen: órdenes, presencia, contador
//   POST { accion, orden_id, revisor, motivo }
//        accion = 'aprobar'        → confirma una TRANSFERENCIA pendiente o en revisión (números + mail + WhatsApp)
//        accion = 'rechazar'       → marca una orden pendiente o en revisión como rechazada
//        accion = 'sincronizar_mp' → vuelve a consultar en Mercado Pago los pagos de una orden
//                                    (recupera órdenes cuyo webhook se perdió; mismas reglas que el webhook)
//        accion = 'acreditar'      → conciliación manual contra el banco de una TRANSFERENCIA:
//                                    { acreditada: true | false | null, nota? }. true = "llegó la plata":
//                                    si la orden está pendiente/en_revision la aprueba (números + mail);
//                                    false = "no llegó": queda marcada para reclamar, sin cambiar el estado;
//                                    null = vuelve a "sin revisar".
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { db, obtenerOrden, actualizarOrden, contarParticipaciones, contarPadron } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';
import { buscarPagosPorOrden } from './_lib/mercadopago.js';
import { aplicarPago } from './_lib/pagos-mp.js';
import { RE_UUID, texto } from './_lib/validar.js';

const RE_EDICION = /^[a-z0-9-]{1,40}$/;

const CAMPOS = [
  'id', 'created_at', 'pagada_at', 'estado', 'origen', 'medio_pago', 'pack_id',
  'cantidad_participaciones', 'monto', 'bici_preferida', 'provincia', 'nombre', 'apellido',
  'email', 'dni', 'whatsapp', 'codigo', 'comprobante_url', 'comprobante_datos', 'comprobante_at',
  'revisado_por', 'revisado_at', 'email_enviado_at', 'whatsapp_enviado_at', 'mp_payment_id',
  'acreditada', 'acreditada_at', 'acreditada_nota',
].join(',');

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
    // En el padrón (solo órdenes pagadas): coincide con el CSV del escribano.
    participaciones_total: enPadron,
    // Números emitidos (contador correlativo; incluye reembolsadas/rechazadas).
    numeros_emitidos: emitidos,
    cupo_total: Number(campaign.edicion.cupo_total || 0),
    // Conciliación contra el banco: con comprobante y todavía sin marcar / marcadas "no llegó".
    transferencias_sin_conciliar: (ordenes || []).filter((o) => esConciliable(o) && o.acreditada == null).length,
    transferencias_no_acreditadas: (ordenes || []).filter((o) => o.medio_pago === 'transferencia' && o.acreditada === false).length,
    ordenes: ordenes || [],
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
    const { numeros } = await confirmarOrden({
      orden,
      campaign,
      baseUrl: baseUrl(req),
      cambios: { revisado_por: revisor, revisado_at: new Date().toISOString() },
    });
    return json(res, 200, { ok: true, numeros });
  }

  if (body.accion === 'rechazar') {
    if (orden.estado === 'pagada') return json(res, 409, { error: 'La orden ya está pagada; usá un reembolso.' });
    if (!['pendiente', 'en_revision'].includes(orden.estado)) return json(res, 409, { error: `La orden ya está ${orden.estado}.` });
    await actualizarOrden(orden.id, {
      estado: 'rechazada',
      revisado_por: revisor,
      revisado_at: new Date().toISOString(),
      comprobante_datos: { ...(orden.comprobante_datos || {}), motivo_rechazo: texto(body.motivo, 300) },
    });
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
      // "Llegó la plata" es la aprobación definitiva: números + mail de confirmación.
      const { numeros } = await confirmarOrden({ orden, campaign, baseUrl: baseUrl(req), cambios: marca });
      return json(res, 200, { ok: true, estado: 'pagada', acreditada: true, numeros });
    }
    const actual = await actualizarOrden(orden.id, marca);
    const nota = valor === true && actual.estado !== 'pagada' ? `La orden está ${actual.estado}: se marcó acreditada pero no se aprueba.` : undefined;
    return json(res, 200, { ok: true, estado: actual.estado, acreditada: actual.acreditada, ...(nota ? { nota } : {}) });
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
