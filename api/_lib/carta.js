// Vía gratuita en dos pasos: 1) formulario del sitio, 2) carta enviada (o entregada) a la
// tienda contando por qué debería ganar la bici. La chance se asigna cuando Baiking marca
// "carta recibida" en el panel. Configuración en config/campaign.json > participacion_gratuita:
//   requiere_carta (bool) · direccion_carta (string) · plazo_carta_dias (número)
// Todo con fallback por si la config todavía no trae esas claves.
const DIRECCION_POR_DEFECTO = 'Las Camelias 3327, Del Viso (1669), Pilar, Buenos Aires';
const PLAZO_POR_DEFECTO_DIAS = 15;

export function configCarta(campaign) {
  const g = campaign.participacion_gratuita || {};
  const plazo = Number(g.plazo_carta_dias);
  const direccion = String(g.direccion_carta || campaign.legal?.domicilio || campaign.contacto?.direccion || DIRECCION_POR_DEFECTO).trim();
  return {
    requiere: g.requiere_carta === true,
    direccion,
    plazoDias: Number.isFinite(plazo) && plazo > 0 ? Math.round(plazo) : PLAZO_POR_DEFECTO_DIAS,
  };
}

/** Fecha límite (ISO) para que llegue la carta: registro + plazo. */
export function venceCarta(orden, campaign) {
  const { plazoDias } = configCarta(campaign);
  const desde = new Date(orden?.created_at || Date.now()).getTime();
  return new Date(desde + plazoDias * 864e5).toISOString();
}
