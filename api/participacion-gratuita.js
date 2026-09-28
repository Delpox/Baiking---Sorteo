// POST /api/participacion-gratuita
// Vía de participación SIN OBLIGACIÓN DE COMPRA (Lealtad Comercial, DNU 274/2019 art. 14).
// Registra una (1) participación por persona (DNI) y edición, con la misma
// probabilidad que cualquier participación por compra. Envía el mail de confirmación.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { crearOrden } from './_lib/db.js';
import { confirmarOrden } from './_lib/confirmar.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiarTelefono(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('54')) d = `54${d}`;
  if (!d.startsWith('549')) d = `549${d.slice(2)}`;
  return d;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  const cfg = campaign.participacion_gratuita || {};
  if (!cfg.habilitada) return json(res, 400, { error: 'La participación sin cargo no está habilitada.' });
  if (Date.now() > new Date(campaign.edicion.cierre_ventas).getTime()) {
    return json(res, 400, { error: 'Las inscripciones de esta edición ya cerraron.' });
  }

  const body = readJson(req);

  // Honeypot anti-bots: el campo "website" está oculto y debe llegar vacío.
  if (body.website) return json(res, 200, { ok: true });

  const errores = {};
  const nombre = String(body.nombre || '').trim();
  const apellido = String(body.apellido || '').trim();
  const dni = String(body.dni || '').replace(/\D/g, '');
  const email = String(body.email || '').trim().toLowerCase();
  const whatsapp = limpiarTelefono(body.whatsapp);
  const provincia = String(body.provincia || '').trim();
  const bici = String(body.bici_preferida || '');

  if (nombre.length < 2) errores.nombre = 'Ingresá tu nombre.';
  if (apellido.length < 2) errores.apellido = 'Ingresá tu apellido.';
  if (dni.length < 7 || dni.length > 8) errores.dni = 'DNI inválido (7 u 8 dígitos).';
  if (!RE_EMAIL.test(email)) errores.email = 'Ingresá un email válido.';
  if (whatsapp.length < 12 || whatsapp.length > 14) errores.whatsapp = 'Ingresá tu WhatsApp con código de área.';
  if (!campaign.bicis.some((b) => b.id === bici)) errores.bici_preferida = 'Elegí la bici por la que querés participar.';
  if (body.acepta_bases !== true) errores.acepta_bases = 'Tenés que aceptar las bases y condiciones.';
  if (body.mayor_edad !== true) errores.mayor_edad = 'Tenés que ser mayor de 18 años.';
  if (Object.keys(errores).length) return json(res, 422, { error: 'Revisá los datos.', errores });

  try {
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
        provincia: provincia || null,
        bici_preferida: bici,
        acepta_bases: true,
        estado: 'pendiente',
        medio_pago: 'gratuita',
        origen: 'gratuita',
      });
    } catch (err) {
      if (/duplicate key|ordenes_gratuita_dni_idx/i.test(String(err.message))) {
        return json(res, 409, {
          error: 'Ya registramos una participación sin cargo con ese DNI para esta edición.',
        });
      }
      throw err;
    }

    const { numeros } = await confirmarOrden({ orden, campaign, baseUrl: baseUrl(req), gratuita: true });
    return json(res, 200, { orden_id: orden.id, numeros });
  } catch (err) {
    console.error('[participacion-gratuita]', err);
    return json(res, 500, { error: 'No pudimos registrar tu participación. Probá de nuevo en unos minutos.' });
  }
}
