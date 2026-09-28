// POST /api/participacion-gratuita
// Vía de participación SIN OBLIGACIÓN DE COMPRA (Lealtad Comercial, DNU 274/2019 art. 14).
// Una (1) participación por persona (DNI) y edición, con la misma probabilidad que
// cualquier participación por compra.
//
// Dos modos, según config participacion_gratuita.requiere_carta:
//  - true (dos pasos): el POST crea la orden `pendiente` (sin números) y manda el mail
//    "Registramos tus datos: ahora mandá la carta". La chance se asigna cuando Baiking marca
//    "carta recibida" en el panel (api/admin.js). Responde
//    { ok, orden_id, estado: 'pendiente', numeros: [], requiere_carta: true }.
//  - false: confirmación inmediata (número + mail) y { ok, orden_id, estado: 'pagada', numeros }.
//
// Anti-abuso: honeypot, índice único por DNI y tope de registros por email.
// Pendiente (decisión): captcha (Cloudflare Turnstile) y límite por IP; ver .env.example.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { crearOrden, contarParticipaciones, contarOrdenes, obtenerOrdenGratuita, reclamarMarca, liberarMarca } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';
import { armarMailGratuitaPendiente, enviarMail } from './_lib/notificaciones.js';
import { validarPersona } from './_lib/validar.js';
import { configCarta } from './_lib/carta.js';

// Cada registro dispara un mail a la dirección indicada: tope por email y edición.
const MAX_GRATUITAS_POR_EMAIL = 5;

const respuestaPendiente = (orden) => ({ ok: true, orden_id: orden?.id || null, estado: 'pendiente', numeros: [], requiere_carta: true });

/** Mail con las instrucciones de la carta, una sola vez por orden (marca atómica instrucciones_enviado_at). */
async function mandarInstrucciones(orden, base) {
  if (orden.instrucciones_enviado_at || !(await reclamarMarca(orden.id, 'instrucciones_enviado_at'))) return;
  try {
    const mail = armarMailGratuitaPendiente({ orden, campaign, baseUrl: base });
    await enviarMail({ to: orden.email, ...mail });
  } catch (err) {
    console.error(`[participacion-gratuita] mail de instrucciones de la orden ${orden.id}:`, err.message || err);
    await liberarMarca(orden.id, 'instrucciones_enviado_at').catch((e) => console.error('[participacion-gratuita] liberar marca', e.message));
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  const cfg = campaign.participacion_gratuita || {};
  if (!cfg.habilitada) return json(res, 400, { error: 'La participación sin cargo no está habilitada.' });
  if (Date.now() > new Date(campaign.edicion.cierre_ventas).getTime()) {
    return json(res, 400, { error: 'Las inscripciones de esta edición ya cerraron.' });
  }
  const { requiere: requiereCarta } = configCarta(campaign);

  const body = readJson(req);

  // Honeypot anti-bots: el campo "website" está oculto y debe llegar vacío. Se responde
  // con la misma forma que un alta real (sin orden ni números) para que el sitio no rompa.
  if (body.website) return json(res, 200, requiereCarta ? respuestaPendiente(null) : { ok: true, orden_id: null, estado: 'pendiente', numeros: [] });

  const { errores, datos } = validarPersona(body, campaign);
  if (Object.keys(errores).length) return json(res, 422, { error: 'Revisá los datos.', errores });
  const { nombre, apellido, dni, email, whatsapp, provincia, bici } = datos;
  const base = baseUrl(req);

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

      // Ya hay una orden gratuita con ese DNI. Si sigue `pendiente` y la pide la misma
      // persona (mismo email): con carta, se responde lo mismo que la primera vez (sin
      // repetir el mail); sin carta, se completa ahora (confirmarOrden falló tras el insert).
      const previa = await obtenerOrdenGratuita(campaign.edicion.id, dni);
      if (previa && previa.estado === 'pendiente' && String(previa.email).toLowerCase() === email) {
        if (requiereCarta) {
          await mandarInstrucciones(previa, base);
          return json(res, 200, respuestaPendiente(previa));
        }
        console.warn(`[participacion-gratuita] completando la orden ${previa.id} que había quedado pendiente`);
        const { numeros } = await confirmarOrden({ orden: previa, campaign, baseUrl: base, gratuita: true });
        return json(res, 200, { ok: true, orden_id: previa.id, estado: 'pagada', numeros, recuperada: true });
      }
      return json(res, 409, {
        error: 'Ya registramos una participación sin cargo con ese DNI para esta edición.',
      });
    }

    if (requiereCarta) {
      await mandarInstrucciones(orden, base);
      return json(res, 200, respuestaPendiente(orden));
    }

    const { numeros } = await confirmarOrden({ orden, campaign, baseUrl: base, gratuita: true });
    return json(res, 200, { ok: true, orden_id: orden.id, estado: 'pagada', numeros });
  } catch (err) {
    console.error('[participacion-gratuita]', err.message || err);
    return json(res, 500, { error: 'No pudimos registrar tu participación. Probá de nuevo en unos minutos.' });
  }
}
