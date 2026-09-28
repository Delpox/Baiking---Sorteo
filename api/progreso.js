// GET /api/progreso
// Barra de progreso pública: cuántas chances ya están ocupadas sobre el cupo total.
// Se cachea 30 s en el CDN para aguantar picos de tráfico.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json } from './_lib/http.js';
import { contarParticipaciones } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  const total = Number(campaign.edicion.cupo_total || 0);
  try {
    const ocupadas = await contarParticipaciones(campaign.edicion.id);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ocupadas,
        total,
        restantes: total ? Math.max(0, total - ocupadas) : null,
        porcentaje: total ? Math.min(100, Math.round((ocupadas / total) * 1000) / 10) : null,
        cierre_ventas: campaign.edicion.cierre_ventas,
      }),
    );
  } catch (err) {
    console.error('[progreso]', err);
    return json(res, 500, { error: 'Error consultando el progreso' });
  }
}
