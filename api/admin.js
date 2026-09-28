// /api/admin — datos del panel de administración (protegido por ADMIN_TOKEN).
//   GET  ?token=...                      → resumen: órdenes, presencia, contador
//   POST ?token=...  { accion, orden_id, revisor, motivo }
//        accion = 'aprobar'  → confirma una transferencia (números + mail + WhatsApp)
//        accion = 'rechazar' → marca la orden como rechazada
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, getQuery, baseUrl, adminAutorizado } from './_lib/http.js';
import { db, obtenerOrden, actualizarOrden, contarParticipaciones } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';

const CAMPOS = [
  'id', 'created_at', 'pagada_at', 'estado', 'origen', 'medio_pago', 'pack_id',
  'cantidad_participaciones', 'monto', 'bici_preferida', 'provincia', 'nombre', 'apellido',
  'email', 'dni', 'whatsapp', 'codigo', 'comprobante_url', 'comprobante_datos', 'comprobante_at',
  'revisado_por', 'revisado_at', 'email_enviado_at', 'whatsapp_enviado_at',
].join(',');

async function resumen(req, res) {
  const { edicion } = getQuery(req);
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

  const [{ count: ahora }, { count: visitasHoy }] = await Promise.all([
    db().from('presencia').select('*', { count: 'exact', head: true }).gt('last_seen', hace1min),
    db().from('presencia').select('*', { count: 'exact', head: true }).gte('first_seen', inicioHoy),
  ]);

  const total = await contarParticipaciones(edicionId);

  return json(res, 200, {
    generado_at: new Date().toISOString(),
    edicion: campaign.edicion,
    unidad: campaign.unidad || { singular: 'participación', plural: 'participaciones' },
    packs: campaign.packs,
    bicis: campaign.bicis.map((b) => ({ id: b.id, nombre: b.nombre })),
    presencia: { ahora: ahora || 0, hoy: visitasHoy || 0 },
    participaciones_total: total,
    ordenes: ordenes || [],
  });
}

async function accion(req, res) {
  const body = readJson(req);
  const orden = await obtenerOrden(String(body.orden_id || ''));
  if (!orden) return json(res, 404, { error: 'Orden inexistente' });
  const revisor = String(body.revisor || 'panel').slice(0, 60);

  if (body.accion === 'aprobar') {
    if (orden.estado === 'pagada') return json(res, 200, { ok: true, ya_estaba: true });
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
    await actualizarOrden(orden.id, {
      estado: 'rechazada',
      revisado_por: revisor,
      revisado_at: new Date().toISOString(),
      comprobante_datos: { ...(orden.comprobante_datos || {}), motivo_rechazo: String(body.motivo || '').slice(0, 300) },
    });
    return json(res, 200, { ok: true });
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
    console.error('[admin]', err);
    return json(res, 500, { error: 'Error en el panel' });
  }
}
