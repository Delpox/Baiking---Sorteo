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

export async function contarParticipaciones(edicionId) {
  const { data, error } = await db()
    .from('ediciones')
    .select('ultimo_numero')
    .eq('id', edicionId)
    .maybeSingle();
  if (error) throw new Error(`[db] ${error.message}`);
  return data?.ultimo_numero ?? 0;
}
