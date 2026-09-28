// GET /api/export?token=<ADMIN_TOKEN>[&edicion=edicion-1]
// Exporta el padrón de participaciones (solo órdenes pagadas) en CSV.
// Se usa para el sorteo en vivo, el escribano y la planilla de Gastón.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, getQuery, adminAutorizado } from './_lib/http.js';
import { obtenerPadron } from './_lib/db.js';

// Escapa comillas y evita "CSV injection" (celdas que empiezan con = + - @).
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  const { edicion } = getQuery(req);
  if (!(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });

  try {
    const filas = await obtenerPadron(edicion || campaign.edicion.id);
    const columnas = [
      'edicion_id', 'numero', 'orden_id', 'nombre', 'apellido', 'dni', 'email',
      'whatsapp', 'provincia', 'bici_preferida', 'pack_id', 'medio_pago', 'pagada_at',
    ];
    const lineas = [columnas.join(';')];
    for (const f of filas) lineas.push(columnas.map((c) => csvCell(f[c])).join(';'));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="padron-${edicion || campaign.edicion.id}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(`﻿${lineas.join('\n')}`);
  } catch (err) {
    console.error('[export]', err);
    return json(res, 500, { error: 'Error exportando el padrón' });
  }
}
