// POST /api/checkout
// Crea la orden (estado pendiente) y, según el medio de pago:
//  - transferencia (flujo principal): el participante ve los datos bancarios y ADJUNTA el
//    comprobante en el mismo formulario. El body trae `comprobante: { tipo, nombre,
//    contenido_base64 }`; se guarda, se lee con Claude y se evalúa igual que en
//    api/comprobante.js. Responde { orden_id, medio_pago, estado, numeros }:
//    estado 'pagada' (auto-aprobada, con números), 'en_revision' (lo revisa el panel) o
//    'pendiente' (el adjunto no se pudo procesar; puede volver a subirlo en /gracias).
//    Sin `comprobante` (fallback) manda el mail con los datos para transferir.
//  - mercadopago (si checkout.mercadopago.habilitada): crea la preferencia y responde
//    { orden_id, init_point } para redirigir al usuario a pagar.
import { randomInt } from 'node:crypto';
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, readJson, baseUrl } from './_lib/http.js';
import { crearOrden, actualizarOrden, actualizarOrdenSiEstado, obtenerOrden, contarParticipaciones, contarOrdenes } from './_lib/db.js';
import { crearPreferencia } from './_lib/mercadopago.js';
import { armarMailTransferencia, enviarMail } from './_lib/notificaciones.js';
import { procesarComprobante, validarArchivo, enviarAcuseComprobante } from './_lib/comprobante.js';
import { validarPersona, texto } from './_lib/validar.js';
import { espejarOrdenEnSheet } from './_lib/sheets.js';

// Código interno para identificar la transferencia (sin 0/O/1/I). Ya no se le muestra al
// participante; queda para el panel y para matchear mails con comprobantes.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nuevoCodigo = () => `BK-${Array.from({ length: 5 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')}`;

// Anti-spam del POST público por transferencia: no más de N reservas sin pagar por email en 24 h.
const MAX_TRANSFERENCIAS_PENDIENTES_POR_EMAIL = 3;

// `origen` viene del sitio (analítica); 'gratuita' está reservado para la vía sin cargo
// porque el índice único por DNI filtra por ese valor.
const RE_ORIGEN = /^[a-z0-9_-]{1,40}$/;
const origenDe = (v) => (typeof v === 'string' && RE_ORIGEN.test(v) && v !== 'gratuita' ? v : 'web');

// Medios habilitados en la config (misma regla que assets/js/app.js: Mercado Pago está
// habilitado salvo que checkout.mercadopago.habilitada sea false).
const mercadopagoHabilitado = () => (campaign.checkout.mercadopago ? campaign.checkout.mercadopago.habilitada !== false : true);
const transferenciaHabilitada = () => Boolean(campaign.checkout.transferencia?.habilitada);

function validar(body) {
  const { errores, datos: persona } = validarPersona(body, campaign);
  const pack = campaign.packs.find((p) => p.id === body.pack_id);
  const porDefecto = mercadopagoHabilitado() ? 'mercadopago' : 'transferencia';
  const medio = typeof body.medio_pago === 'string' && body.medio_pago ? body.medio_pago : porDefecto;
  const transferencia = campaign.checkout.transferencia || {};

  if (!['mercadopago', 'transferencia'].includes(medio)) errores.medio_pago = 'Elegí cómo querés pagar.';
  if (medio === 'transferencia' && !transferenciaHabilitada()) errores.medio_pago = 'La transferencia no está habilitada.';
  if (medio === 'mercadopago' && !mercadopagoHabilitado()) errores.medio_pago = 'El pago con Mercado Pago no está habilitado; elegí transferencia.';
  if (!pack) errores.pack_id = 'Elegí un pack.';

  // Comprobante adjunto (opcional en la API; el sitio lo exige para transferencias).
  let archivo = null;
  const adjunto = body.comprobante;
  if (medio === 'transferencia' && adjunto && typeof adjunto === 'object') {
    const v = validarArchivo(adjunto);
    if (v.error) errores.comprobante = v.error;
    else archivo = { buffer: v.buffer, tipo: v.tipo, nombre: texto(adjunto.nombre, 120) || 'comprobante' };
  }

  return { errores, datos: { ...persona, pack, medio, transferencia, archivo } };
}

/**
 * Si procesar el adjunto falló (storage caído, base, etc.), deja la orden en un estado
 * coherente y devuelve el estado real: en_revision si el archivo llegó a guardarse,
 * pendiente (con nota y el mail con los datos + link para volver a subirlo) si no.
 */
async function recuperarTrasFallo({ orden, err, base }) {
  const nota = `No se pudo procesar el comprobante adjunto en la inscripción: ${String(err?.message || err).slice(0, 200)}`;
  try {
    await actualizarOrdenSiEstado(orden.id, { comprobante_datos: { ...(orden.comprobante_datos || {}), nota, origen: 'web' } }, ['pendiente']);
    const actual = (await obtenerOrden(orden.id)) || orden;
    if (actual.estado === 'pendiente') {
      const mail = armarMailTransferencia({ orden: actual, campaign, baseUrl: base });
      await enviarMail({ to: actual.email, ...mail }).catch((e) => console.error(`[checkout] mail transferencia de la orden ${orden.id}:`, e.message || e));
    } else if (actual.estado === 'en_revision') {
      await enviarAcuseComprobante({ orden: actual, campaign, baseUrl: base }).catch((e) => console.error(`[checkout] acuse de la orden ${orden.id}:`, e.message || e));
    }
    return { estado: actual.estado, checks: actual.comprobante_datos?.checks || null, nota };
  } catch (e2) {
    console.error(`[checkout] recuperando la orden ${orden.id}:`, e2.message || e2);
    return { estado: orden.estado, checks: null, nota };
  }
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
    // Cupo: si la edición tiene un total de chances, no vender más de las que quedan.
    const cupo = Number(campaign.edicion.cupo_total || 0);
    if (cupo) {
      const ocupadas = await contarParticipaciones(campaign.edicion.id);
      const restantes = cupo - ocupadas;
      if (restantes <= 0) return json(res, 409, { error: 'Se ocuparon todas las chances de esta edición.' });
      if (datos.pack.participaciones > restantes) {
        return json(res, 409, { error: `Quedan solo ${restantes} chances disponibles. Elegí una opción más chica.` });
      }
    }

    const esTransferencia = datos.medio === 'transferencia';
    if (esTransferencia) {
      const pendientes = await contarOrdenes({
        email: datos.email,
        medioPago: 'transferencia',
        estados: ['pendiente'],
        desde: new Date(Date.now() - 24 * 36e5).toISOString(),
      });
      if (pendientes >= MAX_TRANSFERENCIAS_PENDIENTES_POR_EMAIL) {
        return json(res, 429, {
          error: 'Ya tenés varias reservas por transferencia sin pagar. Subí el comprobante desde el link que te mandamos por mail o escribinos por WhatsApp.',
        });
      }
    }

    const descuento = esTransferencia ? Number(datos.transferencia.descuento_pct || 0) : 0;
    const monto = Math.round(datos.pack.precio * (1 - descuento / 100));
    const base = {
      edicion_id: campaign.edicion.id,
      pack_id: datos.pack.id,
      cantidad_participaciones: datos.pack.participaciones,
      monto,
      moneda: campaign.moneda || 'ARS',
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      email: datos.email,
      whatsapp: datos.whatsapp,
      provincia: datos.provincia,
      bici_preferida: datos.bici,
      acepta_bases: true,
      estado: 'pendiente',
      medio_pago: datos.medio,
      origen: origenDe(body.origen),
    };

    if (esTransferencia) {
      let orden;
      for (let intento = 0; intento < 3; intento++) {
        try {
          orden = await crearOrden({ ...base, codigo: nuevoCodigo() });
          break;
        } catch (err) {
          if (!/duplicate key|ordenes_codigo_key/i.test(String(err.message)) || intento === 2) throw err;
        }
      }
      const urlBase = baseUrl(req);

      if (datos.archivo) {
        // Flujo principal: comprobante adjunto → storage + lectura + checks; auto-aprobación
        // si TRANSFERENCIAS_AUTO_APROBAR=true y todo cierra, si no queda en revisión (acuse por mail).
        let out;
        try {
          out = await procesarComprobante({
            orden,
            buffer: datos.archivo.buffer,
            tipo: datos.archivo.tipo,
            nombre: datos.archivo.nombre,
            campaign,
            baseUrl: urlBase,
            origen: 'web',
          });
        } catch (err) {
          console.error(`[checkout] comprobante de la orden ${orden.id}:`, err.message || err);
          out = await recuperarTrasFallo({ orden, err, base: urlBase });
        }
        // Espejo en la planilla con el estado real de la orden (si Sheets no está configurado, no hace nada).
        if (out.estado !== 'pagada') {
          const fresca = await obtenerOrden(orden.id).catch(() => null);
          await espejarOrdenEnSheet(fresca || { ...orden, estado: out.estado }, { numeros: out.numeros || [] });
        }
        return json(res, 200, {
          orden_id: orden.id,
          medio_pago: 'transferencia',
          estado: out.estado,
          numeros: out.numeros || [],
          checks: out.checks || null,
          ...(out.nota ? { nota: out.nota } : {}),
        });
      }

      // Fallback sin comprobante: mail con los datos para transferir y el link para subirlo.
      try {
        const mail = armarMailTransferencia({ orden, campaign, baseUrl: urlBase });
        await enviarMail({ to: orden.email, ...mail });
      } catch (err) {
        console.error(`[checkout] mail transferencia de la orden ${orden.id}:`, err.message || err);
      }
      await espejarOrdenEnSheet(orden);
      return json(res, 200, { orden_id: orden.id, medio_pago: 'transferencia', estado: 'pendiente', numeros: [] });
    }

    const orden = await crearOrden(base);
    const pref = await crearPreferencia({ orden, pack: datos.pack, campaign, baseUrl: baseUrl(req) });
    await actualizarOrden(orden.id, { mp_preference_id: pref.id });

    return json(res, 200, { orden_id: orden.id, medio_pago: 'mercadopago', estado: 'pendiente', init_point: pref.init_point });
  } catch (err) {
    console.error('[checkout]', err.message || err);
    return json(res, 500, { error: 'No pudimos registrar tu inscripción. Probá de nuevo en unos minutos.' });
  }
}
