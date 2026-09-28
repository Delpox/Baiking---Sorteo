// GET /api/orden?id=<uuid>
// Devuelve el resumen de una orden y sus números (para la página /gracias).
// El id es un UUID que solo conoce quien pagó (llega en la URL de retorno de MP).
import campaign from '../config/campaign.json' with { type: 'json' };
import { json, getQuery } from './_lib/http.js';
import { obtenerOrden, obtenerParticipaciones } from './_lib/db.js';
import { configCarta, venceCarta } from './_lib/carta.js';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function enmascararEmail(email) {
  const [user, dom] = String(email).split('@');
  if (!dom) return '';
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${dom}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  const { id } = getQuery(req);
  if (!RE_UUID.test(String(id || ''))) return json(res, 400, { error: 'Orden inválida' });

  try {
    const orden = await obtenerOrden(id);
    if (!orden) return json(res, 404, { error: 'No encontramos esa orden' });
    const numeros = orden.estado === 'pagada' ? await obtenerParticipaciones(orden.id) : [];
    const pack = campaign.packs.find((p) => p.id === orden.pack_id);
    const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);

    const out = {
      id: orden.id,
      estado: orden.estado,
      nombre: orden.nombre,
      email: enmascararEmail(orden.email),
      cantidad: orden.cantidad_participaciones,
      pack: pack ? { id: pack.id, nombre: pack.nombre } : null,
      bici: bici ? { id: bici.id, nombre: bici.nombre } : null,
      numeros,
      pagada_at: orden.pagada_at,
      medio_pago: orden.medio_pago,
      edicion: campaign.edicion,
    };

    if (orden.medio_pago === 'transferencia' && orden.estado !== 'pagada') {
      // Datos para /gracias: estado, monto, comprobante recibido (fecha + checks) y la cuenta.
      // El código interno (BK-…) ya no se le muestra al participante.
      const t = campaign.checkout.transferencia || {};
      out.monto = Number(orden.monto);
      out.comprobante_at = orden.comprobante_at;
      out.comprobante_checks = orden.comprobante_datos?.checks || null;
      out.transferencia = {
        alias: t.alias,
        cbu: t.cbu,
        titular: t.titular,
        cuit: t.cuit,
        banco: t.banco,
        email_comprobantes: t.email_comprobantes,
        plazo_horas: t.plazo_horas,
        descuento_pct: t.descuento_pct,
      };
    }

    if (orden.origen === 'gratuita') {
      // Vía gratuita en dos pasos: /gracias muestra la dirección y el plazo mientras espera la carta.
      const c = configCarta(campaign);
      out.carta = {
        requiere: c.requiere,
        recibida_at: orden.carta_recibida_at || null,
        direccion: c.direccion,
        plazo_dias: c.plazoDias,
        vence_at: venceCarta(orden, campaign),
      };
    }

    return json(res, 200, out);
  } catch (err) {
    console.error('[orden]', err);
    return json(res, 500, { error: 'Error consultando la orden' });
  }
}
