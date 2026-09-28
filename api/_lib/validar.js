// Validación compartida de los datos de la persona (checkout y participación gratuita).
// La bici y los packs se validan contra config/campaign.json (única fuente de verdad);
// la provincia, contra la lista de provincias argentinas (la misma que muestra el sitio).
import { normalizarWhatsApp } from './telefono.js';

export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tope de longitud de cada campo (evita textos enormes en la base, en el asunto del
// mail y en los parámetros de la plantilla de WhatsApp).
export const LIMITES = { nombre: 80, apellido: 80, email: 120, dni: 8 };

export const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

/**
 * Texto plano acotado: solo acepta strings (o números finitos), quita caracteres de
 * control, colapsa espacios y recorta a `max`. Cualquier otra cosa ("[object Object]",
 * arrays, null) devuelve ''.
 */
export function texto(v, max = 80) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const clave = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const PROVINCIA_POR_CLAVE = new Map(PROVINCIAS.map((p) => [clave(p), p]));
PROVINCIA_POR_CLAVE.set('caba', 'Ciudad Autónoma de Buenos Aires');
PROVINCIA_POR_CLAVE.set('capitalfederal', 'Ciudad Autónoma de Buenos Aires');

/** Devuelve el nombre canónico de la provincia (tolera mayúsculas y acentos) o null. */
export function provinciaCanonica(v) {
  const t = texto(v, 60);
  return t ? PROVINCIA_POR_CLAVE.get(clave(t)) || null : null;
}

/**
 * Valida y normaliza los datos de la persona. Devuelve { errores, datos }:
 * errores es un objeto campo → mensaje (vacío si todo está bien) que el sitio pinta
 * debajo de cada campo; datos trae los valores ya listos para guardar.
 */
export function validarPersona(body, campaign) {
  const errores = {};
  const nombre = texto(body.nombre, LIMITES.nombre);
  const apellido = texto(body.apellido, LIMITES.apellido);
  const dni = texto(body.dni, 20).replace(/\D/g, '');
  const email = texto(body.email, 254).toLowerCase();
  const whatsapp = normalizarWhatsApp(texto(body.whatsapp, 40));
  const provincia = provinciaCanonica(body.provincia);
  const bici = typeof body.bici_preferida === 'string' ? body.bici_preferida : '';

  if (nombre.length < 2) errores.nombre = 'Ingresá tu nombre.';
  if (apellido.length < 2) errores.apellido = 'Ingresá tu apellido.';
  if (dni.length < 7 || dni.length > LIMITES.dni) errores.dni = 'DNI inválido (7 u 8 dígitos).';
  if (!RE_EMAIL.test(email) || email.length > LIMITES.email) errores.email = 'Ingresá un email válido.';
  if (!whatsapp) errores.whatsapp = 'Ingresá tu WhatsApp con código de área, sin 0 ni 15. Ej: 11 5728 0056.';
  if (!provincia) errores.provincia = 'Elegí tu provincia.';
  if (!campaign.bicis.some((b) => b.id === bici)) errores.bici_preferida = 'Elegí la bici por la que querés participar.';
  if (body.acepta_bases !== true) errores.acepta_bases = 'Tenés que aceptar las bases y condiciones.';
  if (body.mayor_edad !== true) errores.mayor_edad = 'Tenés que ser mayor de 18 años.';

  return { errores, datos: { nombre, apellido, dni, email, whatsapp, provincia, bici } };
}
