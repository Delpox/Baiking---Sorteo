// GET /api/export[?edicion=edicion-1]   (header Authorization: Bearer <ADMIN_TOKEN>)
// Exporta el padrón del sorteo en CSV (separador `;`): UNA fila por orden pagada con su
// bloque correlativo de números (numero_desde, numero_hasta, cantidad), ordenadas por
// numero_desde. Es el padrón que se cierra y publica antes del sorteo en vivo (sorteo.html
// sortea un entero entre 1 y el total: gana la orden cuyo bloque lo contiene) y el que va
// a la planilla de Gastón.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, getQuery, adminAutorizado } from './_lib/http.js';
import { obtenerPadron } from './_lib/db.js';

// `edicion` va al nombre del archivo (Content-Disposition): solo minúsculas, dígitos y guiones.
const RE_EDICION = /^[a-z0-9-]{1,40}$/;

// Escapa comillas y evita "CSV injection" (celdas que empiezan con = + - @).
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  if (!(await adminAutorizado(req))) return json(res, 401, { error: 'No autorizado' });
  const { edicion } = getQuery(req);
  if (edicion && !RE_EDICION.test(String(edicion))) return json(res, 400, { error: 'edicion inválida' });

  try {
    const filas = await obtenerPadron(edicion || campaign.edicion.id);
    const columnas = [
      'edicion_id', 'numero_desde', 'numero_hasta', 'cantidad', 'orden_id', 'nombre', 'apellido', 'dni', 'email',
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
