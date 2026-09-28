// POST /api/participacion-gratuita
// Vía de participación SIN OBLIGACIÓN DE COMPRA (Lealtad Comercial, DNU 274/2019 art. 14).
// Registra una (1) participación por persona (DNI) y edición, con la misma
// probabilidad que cualquier participación por compra. Envía el mail de confirmación.
//
// Anti-abuso actual: honeypot, índice único por DNI y tope de registros por email.
// Pendiente (decisión): captcha (Cloudflare Turnstile) y límite por IP; ver .env.example.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { crearOrden, contarParticipaciones, contarOrdenes, obtenerOrdenGratuita } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';
import { validarPersona } from './_lib/validar.js';

// Cada registro dispara un mail a la dirección indicada: tope por email y edición.
const MAX_GRATUITAS_POR_EMAIL = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  const cfg = campaign.participacion_gratuita || {};
  if (!cfg.habilitada) return json(res, 400, { error: 'La participación sin cargo no está habilitada.' });
  if (Date.now() > new Date(campaign.edicion.cierre_ventas).getTime()) {
    return json(res, 400, { error: 'Las inscripciones de esta edición ya cerraron.' });
  }

  const body = readJson(req);

  // Honeypot anti-bots: el campo "website" está oculto y debe llegar vacío. Se responde
  // con la misma forma que un alta real (sin números) para que el sitio no rompa.
  if (body.website) return json(res, 200, { ok: true, orden_id: null, numeros: [] });

  const { errores, datos } = validarPersona(body, campaign);
  if (Object.keys(errores).length) return json(res, 422, { error: 'Revisá los datos.', errores });
  const { nombre, apellido, dni, email, whatsapp, provincia, bici } = datos;

  try {
    const cupo = Number(campaign.edicion.cupo_total || 0);
    if (cupo && (await contarParticipaciones(campaign.edicion.id)) >= cupo) {
      return json(res, 409, { error: 'Se ocuparon todas las chances de esta edición.' });
    }

    const porEmail = await contarOrdenes({ edicionId: campaign.edicion.id, email, origen: 'gratuita' });
    if (porEmail >= MAX_GRATUITAS_POR_EMAIL) {
      return json(res, 429, { error: 'Ya hay varias participaciones sin cargo registradas con ese email. Si es un error, escribinos por WhatsApp.' });
    }

    let orden;
    try {
      orden = await crearOrden({
        edicion_id: campaign.edicion.id,
        pack_id: 'gratuita',
        cantidad_participaciones: Number(cfg.participaciones || 1),
        monto: 0,
        moneda: campaign.moneda || 'ARS',
        nombre,
        apellido,
        dni,
        email,
        whatsapp,
        provincia,
        bici_preferida: bici,
        acepta_bases: true,
        estado: 'pendiente',
        medio_pago: 'gratuita',
        origen: 'gratuita',
      });
    } catch (err) {
      if (!/duplicate key|ordenes_gratuita_dni_idx/i.test(String(err.message))) throw err;

      // Ya hay una orden gratuita con ese DNI. Si quedó `pendiente` (confirmarOrden falló
      // después del insert) y la pide la misma persona (mismo email), se completa ahora
      // en vez de dejarla bloqueada para siempre.
      const previa = await obtenerOrdenGratuita(campaign.edicion.id, dni);
      if (previa && previa.estado === 'pendiente' && String(previa.email).toLowerCase() === email) {
        console.warn(`[participacion-gratuita] completando la orden ${previa.id} que había quedado pendiente`);
        const { numeros } = await confirmarOrden({ orden: previa, campaign, baseUrl: baseUrl(req), gratuita: true });
        return json(res, 200, { orden_id: previa.id, numeros, recuperada: true });
      }
      return json(res, 409, {
        error: 'Ya registramos una participación sin cargo con ese DNI para esta edición.',
      });
    }

    const { numeros } = await confirmarOrden({ orden, campaign, baseUrl: baseUrl(req), gratuita: true });
    return json(res, 200, { orden_id: orden.id, numeros });
  } catch (err) {
    console.error('[participacion-gratuita]', err.message || err);
    return json(res, 500, { error: 'No pudimos registrar tu participación. Probá de nuevo en unos minutos.' });
  }
}
