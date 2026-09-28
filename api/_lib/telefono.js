// Normalización del WhatsApp (Argentina), compartida por el checkout y la vía gratuita.
// Se aceptan los formatos habituales (con 0 de larga distancia, con el 15 de celular,
// con +54 / 54 9, con espacios, guiones o paréntesis) y se guarda SIEMPRE como
// 549 + 10 dígitos (código de área de 2 a 4 dígitos + número de 6 a 8), que es el
// formato internacional que usa WhatsApp / Meta Cloud API.
//
//   "11 5728-0056"            → 5491157280056
//   "011 15 5728 0056"        → 5491157280056
//   "+54 9 351 15 123 4567"   → 5493511234567
//   "15 5728 0056" (sin área) → null (inválido)

// Los códigos de área argentinos empiezan con 11 (AMBA, 8 dígitos de número) o con 2/3
// (3 o 4 dígitos de área y 7 o 6 de número): siempre suman 10 dígitos.
const RE_LOCAL = /^(11\d{8}|[23]\d{9})$/;

/** Devuelve el número normalizado (549 + 10 dígitos) o null si no es un celular argentino válido. */
export function normalizarWhatsApp(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  d = d.replace(/^0+/, ''); // "0" de larga distancia o "00" internacional
  if (d.startsWith('549') && d.length >= 13) d = d.slice(3);
  else if (d.startsWith('54') && d.length >= 12) d = d.slice(2);
  d = d.replace(/^0+/, ''); // "+54 011 ..." / "54 0351 ..."
  if (d.length === 11 && d.startsWith('9')) d = d.slice(1); // "9 11 ..." sin el 54
  // "15" de celular escrito después del código de área: "11 15 5728 0056" → "11 5728 0056"
  if (d.length === 12) d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  if (!RE_LOCAL.test(d)) return null;
  return `549${d}`;
}

/** true si el valor ya está en el formato guardado (549 + 10 dígitos). */
export const esWhatsAppNormalizado = (v) => /^549(11\d{8}|[23]\d{9})$/.test(String(v || ''));
