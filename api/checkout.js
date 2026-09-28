// POST /api/checkout
// Crea la orden (estado pendiente) y la preferencia de Mercado Pago.
// Responde { orden_id, init_point } para redirigir al usuario a pagar.
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { crearOrden, actualizarOrden } from './_lib/db.js';
import { crearPreferencia } from './_lib/mercadopago.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiarTelefono(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('54')) d = `54${d}`;
  // Argentina móvil: el formato internacional de WhatsApp lleva "9" después del 54.
  if (!d.startsWith('549')) d = `549${d.slice(2)}`;
  return d;
}

function validar(body) {
  const errores = {};
  const nombre = String(body.nombre || '').trim();
  const apellido = String(body.apellido || '').trim();
  const dni = String(body.dni || '').replace(/\D/g, '');
  const email = String(body.email || '').trim().toLowerCase();
  const whatsapp = limpiarTelefono(body.whatsapp);
  const provincia = String(body.provincia || '').trim();
  const bici = String(body.bici_preferida || '');
  const pack = campaign.packs.find((p) => p.id === body.pack_id);

  if (nombre.length < 2) errores.nombre = 'Ingresá tu nombre.';
  if (apellido.length < 2) errores.apellido = 'Ingresá tu apellido.';
  if (dni.length < 7 || dni.length > 8) errores.dni = 'DNI inválido (7 u 8 dígitos).';
  if (!RE_EMAIL.test(email)) errores.email = 'Ingresá un email válido.';
  if (whatsapp.length < 12 || whatsapp.length > 14) errores.whatsapp = 'Ingresá tu WhatsApp con código de área.';
  if (!campaign.bicis.some((b) => b.id === bici)) errores.bici_preferida = 'Elegí la bici por la que querés participar.';
  if (!pack) errores.pack_id = 'Elegí un pack.';
  if (body.acepta_bases !== true) errores.acepta_bases = 'Tenés que aceptar las bases y condiciones.';
  if (body.mayor_edad !== true) errores.mayor_edad = 'Tenés que ser mayor de 18 años.';

  return { errores, datos: { nombre, apellido, dni, email, whatsapp, provincia, bici, pack } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  if (campaign.checkout.modo !== 'api') {
    return json(res, 400, { error: 'El checkout online no está habilitado en esta configuración.' });
  }
  if (Date.now() > new Date(campaign.edicion.cierre_ventas).getTime()) {
    return json(res, 400, { error: 'Las inscripciones de esta edición ya cerraron.' });
  }

  const body = readJson(req);
  const { errores, datos } = validar(body);
  if (Object.keys(errores).length) return json(res, 422, { error: 'Revisá los datos.', errores });

  try {
    const orden = await crearOrden({
      edicion_id: campaign.edicion.id,
      pack_id: datos.pack.id,
      cantidad_participaciones: datos.pack.participaciones,
      monto: datos.pack.precio,
      moneda: campaign.moneda || 'ARS',
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      email: datos.email,
      whatsapp: datos.whatsapp,
      provincia: datos.provincia || null,
      bici_preferida: datos.bici,
      acepta_bases: true,
      estado: 'pendiente',
      origen: String(body.origen || 'web').slice(0, 40),
    });

    const pref = await crearPreferencia({ orden, pack: datos.pack, campaign, baseUrl: baseUrl(req) });
    await actualizarOrden(orden.id, { mp_preference_id: pref.id });

    return json(res, 200, { orden_id: orden.id, init_point: pref.init_point });
  } catch (err) {
    console.error('[checkout]', err);
    return json(res, 500, { error: 'No pudimos iniciar el pago. Probá de nuevo en unos minutos.' });
  }
}
