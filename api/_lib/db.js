// Acceso a datos (Supabase / Postgres). Solo se usa desde el backend
// con la service_role key: nunca exponer esta clave en el navegador.
import { createClient } from '@supabase/supabase-js';
import { env } from './http.js';

let client;

export function db() {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function unwrap({ data, error }) {
  if (error) throw new Error(`[db] ${error.message}`);
  return data;
}

export async function crearOrden(orden) {
  return unwrap(await db().from('ordenes').insert(orden).select('*').single());
}

export async function obtenerOrden(id) {
  const { data, error } = await db().from('ordenes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`[db] ${error.message}`);
  return data;
}

export async function actualizarOrden(id, cambios) {
  return unwrap(await db().from('ordenes').update(cambios).eq('id', id).select('*').single());
}

/**
 * Actualiza la orden SOLO si está en alguno de los estados dados (update condicional,
 * atómico en la base). Devuelve la orden actualizada o null si el estado ya cambió.
 */
export async function actualizarOrdenSiEstado(id, cambios, estados) {
  const { data, error } = await db().from('ordenes').update(cambios).eq('id', id).in('estado', estados).select('*');
  if (error) throw new Error(`[db] ${error.message}`);
  return data?.[0] || null;
}

/**
 * Reclama una marca de "ya enviado" (email_enviado_at / whatsapp_enviado_at) de forma
 * atómica: `update ... where id = $1 and <columna> is null`. Devuelve true solo para la
 * primera llamada; dos invocaciones concurrentes no pueden ganar las dos.
 */
export async function reclamarMarca(id, columna) {
  const { data, error } = await db()
    .from('ordenes')
    .update({ [columna]: new Date().toISOString() })
    .eq('id', id)
    .is(columna, null)
    .select('id');
  if (error) throw new Error(`[db] ${error.message}`);
  return Boolean(data && data.length);
}

/** Libera una marca reclamada (cuando el envío falló) para que un reintento pueda mandar. */
export async function liberarMarca(id, columna) {
  const { error } = await db().from('ordenes').update({ [columna]: null }).eq('id', id);
  if (error) throw new Error(`[db] ${error.message}`);
}

/** Igual que reclamarMarca / liberarMarca, para cualquier tabla (p. ej. los marcadores de `ediciones`). */
export async function reclamarMarcaEn(tabla, id, columna) {
  const { data, error } = await db()
    .from(tabla)
    .update({ [columna]: new Date().toISOString() })
    .eq('id', id)
    .is(columna, null)
    .select('id');
  if (error) throw new Error(`[db] ${error.message}`);
  return Boolean(data && data.length);
}

export async function liberarMarcaEn(tabla, id, columna) {
  const { error } = await db().from(tabla).update({ [columna]: null }).eq('id', id);
  if (error) throw new Error(`[db] ${error.message}`);
}

// Supabase devuelve como máximo 1000 filas por request: los listados van paginados.
const PAGINA = 1000;

async function paginar(armarQuery) {
  const todas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armarQuery().range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`[db] ${error.message}`);
    todas.push(...(data || []));
    if (!data || data.length < PAGINA) return todas;
  }
}

/** Todas las órdenes de una edición (opcionalmente filtradas por estado), de la más vieja a la más nueva. */
export async function listarOrdenes(edicionId, { estados, columnas = '*' } = {}) {
  return paginar(() => {
    let q = db().from('ordenes').select(columnas).eq('edicion_id', edicionId).order('created_at', { ascending: true });
    if (estados?.length) q = q.in('estado', estados);
    return q;
  });
}

/** Todos los números asignados en una edición: [{ orden_id, numero }]. */
export async function listarParticipaciones(edicionId) {
  return paginar(() => db().from('participaciones').select('orden_id,numero').eq('edicion_id', edicionId).order('numero', { ascending: true }));
}

/** Orden de la vía gratuita de un DNI en una edición (la más reciente), o null. */
export async function obtenerOrdenGratuita(edicionId, dni) {
  const { data, error } = await db()
    .from('ordenes')
    .select('*')
    .eq('edicion_id', edicionId)
    .eq('dni', String(dni))
    .eq('origen', 'gratuita')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`[db] ${error.message}`);
  return data?.[0] || null;
}

/** Cantidad de órdenes de un email con los filtros dados (anti-spam de los POST públicos). */
export async function contarOrdenes({ email, edicionId, medioPago, origen, estados, desde }) {
  let query = db().from('ordenes').select('id', { count: 'exact', head: true }).eq('email', String(email).toLowerCase());
  if (edicionId) query = query.eq('edicion_id', edicionId);
  if (medioPago) query = query.eq('medio_pago', medioPago);
  if (origen) query = query.eq('origen', origen);
  if (estados?.length) query = query.in('estado', estados);
  if (desde) query = query.gte('created_at', desde);
  const { count, error } = await query;
  if (error) throw new Error(`[db] ${error.message}`);
  return count ?? 0;
}

export async function obtenerOrdenPorPago(mpPaymentId) {
  const { data, error } = await db()
    .from('ordenes')
    .select('*')
    .eq('mp_payment_id', String(mpPaymentId))
    .maybeSingle();
  if (error) throw new Error(`[db] ${error.message}`);
  return data;
}

// Devuelve los números de participación de la orden (los crea si aún no existen).
export async function asignarParticipaciones(ordenId) {
  const rows = unwrap(await db().rpc('asignar_participaciones', { p_orden_id: ordenId }));
  return (rows || []).map((r) => r.numero).sort((a, b) => a - b);
}

export async function obtenerParticipaciones(ordenId) {
  const rows = unwrap(
    await db().from('participaciones').select('numero').eq('orden_id', ordenId).order('numero'),
  );
  return (rows || []).map((r) => r.numero);
}

export async function obtenerPadron(edicionId) {
  let query = db().from('padron_sorteo').select('*').order('numero');
  if (edicionId) query = query.eq('edicion_id', edicionId);
  return unwrap(await query) || [];
}

// Números EMITIDOS en la edición (contador correlativo; incluye órdenes luego
// reembolsadas o rechazadas). Es lo que se usa para el cupo y la barra de progreso.
export async function contarParticipaciones(edicionId) {
  const { data, error } = await db()
    .from('ediciones')
    .select('ultimo_numero')
    .eq('id', edicionId)
    .maybeSingle();
  if (error) throw new Error(`[db] ${error.message}`);
  return data?.ultimo_numero ?? 0;
}

// Participaciones EN EL PADRÓN (solo órdenes pagadas): coincide con el CSV que
// certifica el escribano. Es lo que muestra el panel.
export async function contarPadron(edicionId) {
  const { count, error } = await db()
    .from('padron_sorteo')
    .select('*', { count: 'exact', head: true })
    .eq('edicion_id', edicionId);
  if (error) throw new Error(`[db] ${error.message}`);
  return count ?? 0;
}
