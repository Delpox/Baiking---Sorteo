// POST /api/ping  { sid, pagina }
// Beacon de presencia: el sitio lo manda al cargar y cada 30 s mientras la
// pestaña está visible. El panel cuenta las sesiones vistas en el último minuto
// ("en el sitio ahora") y las nuevas de hoy ("visitas hoy").
import { json, readJson } from './_lib/http.js';
import { db } from './_lib/db.js';

const RE_SID = /^[a-zA-Z0-9_-]{8,64}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const body = readJson(req);
  const sid = String(body.sid || '');
  if (!RE_SID.test(sid)) return json(res, 400, { error: 'sid inválido' });
  const pagina = String(body.pagina || '/').slice(0, 80);

  try {
    const ahora = new Date().toISOString();
    const { error } = await db()
      .from('presencia')
      .upsert({ session_id: sid, pagina, last_seen: ahora }, { onConflict: 'session_id', ignoreDuplicates: false });
    if (error) throw new Error(error.message);

    // Limpieza ocasional (1 de cada 50 pings): sesiones de hace más de 2 días.
    if (Math.random() < 0.02) {
      const limite = new Date(Date.now() - 2 * 864e5).toISOString();
      await db().from('presencia').delete().lt('last_seen', limite);
    }
    res.statusCode = 204;
    res.setHeader('Cache-Control', 'no-store');
    res.end();
  } catch (err) {
    console.error('[ping]', err);
    return json(res, 500, { error: 'Error registrando presencia' });
  }
}
