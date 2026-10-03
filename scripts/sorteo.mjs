#!/usr/bin/env node
// Sorteo por línea de comandos (alternativa a sorteo.html) y módulo con la lógica pura del sorteo.
// Uso: node scripts/sorteo.mjs padron.csv [--suplentes N] [--adicionales N] [--out registro.json]
//   --suplentes    suplentes del 1.º premio. Por defecto `sorteo.suplentes` de config/campaign.json
//                  o, si no existe, 2 (las bases §7 fijan dos participaciones suplentes).
//   --adicionales  premios adicionales a sortear. Por defecto la cantidad de `sorteo.premios_secundarios`
//                  de la config (vacío en la 1.ª edición).
//   --out          archivo JSON de salida (por defecto registro-sorteo-<edicion>-<fecha>.json).
//
// Padrón (CSV de /api/export, separador ";"): UNA fila por orden pagada con su bloque correlativo de
// números `numero_desde`–`numero_hasta` (cada $1.000 del precio = 1 participación), ordenadas por
// numero_desde y sin huecos entre bloques. Total de participaciones = suma de `cantidad` = último número.
//
// Mecánica (en vivo y verificable por cualquiera): se elige con crypto un entero uniforme r entre 1 y
// el total; gana la orden cuyo bloque contiene r y el número ganador es r. Suplentes y premios
// adicionales: se excluyen los DNI ya sorteados y se sortea uniformemente sobre la UNIÓN de los bloques
// restantes (k uniforme en [0, total restante) → se recorren los bloques elegibles acumulando cantidades
// → número = desde + desplazamiento). El JSON es el registro técnico del sorteo (se guarda con el video).
//
// Las funciones puras (parseCsv, parsearPadron, verificarPadron, mapearNumero, enteroAleatorio, extraer,
// sortear, armarResultado, armarRegistro, hashPadron…) se exportan para las pruebas y viven copiadas en
// sorteo.html: mantener las dos copias iguales.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Columnas tal como las produce api/export.js (mismo orden). Mantener en sincronía.
export const COLUMNAS_EXPORT = [
  'edicion_id', 'numero_desde', 'numero_hasta', 'cantidad', 'orden_id', 'nombre', 'apellido', 'dni', 'email',
  'whatsapp', 'provincia', 'bici_preferida', 'pack_id', 'medio_pago', 'pagada_at',
];
export const COLUMNAS_REQUERIDAS = ['numero_desde', 'numero_hasta', 'nombre', 'apellido', 'dni'];

// Cantidad de suplentes cuando la config no trae `sorteo.suplentes`: las bases (§7) y la regla
// "Suplentes" de `sorteo.reglas` fijan DOS participaciones suplentes para el primer premio.
export const SUPLENTES_DEFAULT = 2;

// Descripción textual del método (va al registro JSON y a la pantalla "Cómo verificar").
export const METODO = 'Se elige al azar, con crypto.getRandomValues (palabra de 32 bits; entero uniforme en [0, N) por rechazo, '
  + 'sin sesgo de módulo), un entero r entre 1 y el total de participaciones N: gana la orden cuyo bloque correlativo '
  + 'de números contiene r y el número ganador es r. Para suplentes y premios adicionales se excluyen los DNI ya '
  + 'sorteados y se sortea uniformemente sobre la unión de los bloques restantes: k uniforme en [0, total restante), '
  + 'se recorren los bloques elegibles en orden acumulando cantidades y el número es desde + desplazamiento. En cada '
  + 'resultado, rng.crudo es la palabra de 32 bits aceptada, rng.k = rng.crudo mod rng.universo y rng.universo es la '
  + 'cantidad de números elegibles en esa extracción (en la primera, número = k + 1).';
export const REGLA_EXCLUSION = 'Una persona (DNI) no puede salir sorteada dos veces: quien sale queda excluida, con todas sus órdenes, de los sorteos siguientes.';

// Separador de miles es-AR: 12.345. Sin ceros a la izquierda.
const nf = new Intl.NumberFormat('es-AR');
export const fmtNum = (n) => nf.format(n);
// Ordinal en castellano: 1.º, 2.º (no "1°", que es el signo de grados).
export const ord = (n) => `${n}.º`;
export const fmtBloque = (b) => `${fmtNum(b.desde)}–${fmtNum(b.hasta)}`;
// Misma normalización que api/checkout.js (solo dígitos) para que "35.123.456" y "35123456" sean la misma persona.
export const claveDni = (dni) => { const d = String(dni ?? '').replace(/\D/g, ''); return d || String(dni ?? '').trim(); };
export const enmascararDni = (dni) => { const d = String(dni ?? '').trim(); return d ? `***${d.slice(-3)}` : ''; };
export const nombreCompleto = (p) => `${p.nombre || ''} ${p.apellido || ''}`.replace(/\s+/g, ' ').trim();

// Parser CSV (RFC 4180): campos entre comillas, comillas dobles escapadas como "" y
// saltos de línea dentro de comillas. Espeja el formato de api/export.js: separador ";",
// BOM inicial y prefijo ' anti-inyección en celdas que empiezan con = + - @ \t \r.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const primera = src.slice(0, src.search(/\r|\n|$/));
  const sep = primera.includes(';') ? ';' : ',';
  const filas = [];
  let fila = [], celda = '', enComillas = false, inicio = true;
  const cerrarFila = () => {
    fila.push(celda);
    if (fila.some((c) => c !== '')) filas.push(fila);
    fila = []; celda = ''; inicio = true;
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (enComillas) {
      if (ch === '"') {
        if (src[i + 1] === '"') { celda += '"'; i++; } else enComillas = false;
      } else celda += ch;
      continue;
    }
    if (ch === '"' && inicio) { enComillas = true; inicio = false; continue; }
    if (ch === sep) { fila.push(celda); celda = ''; inicio = true; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cerrarFila();
      continue;
    }
    celda += ch; inicio = false;
  }
  if (celda !== '' || fila.length) cerrarFila();
  if (!filas.length) return { columnas: [], filas: [] };
  const columnas = filas[0].map((c) => c.trim().toLowerCase());
  // Deshace el prefijo ' que agrega export.js solo delante de = + - @ \t \r (un apellido que empiece con ' se conserva).
  const limpiar = (v) => String(v ?? '').replace(/^'(?=[=+\-@\t\r])/, '').trim();
  const registros = filas.slice(1).map((vals) => {
    const o = {};
    columnas.forEach((c, i) => { o[c] = limpiar(vals[i]); });
    return o;
  });
  return { columnas, filas: registros };
}

// CSV → bloques { desde, hasta, cantidad, cantidad_csv, fila, ...columnas }. Las filas sin un bloque
// válido (numero_desde/numero_hasta no enteros, desde < 1 o hasta < desde) se ignoran con aviso.
export function parsearPadron(text) {
  const { columnas, filas } = parseCsv(text);
  const avisos = [];
  if (!columnas.length) return { columnas, bloques: [], faltan: [], ignoradas: 0, avisos: ['El CSV está vacío.'] };
  const faltan = COLUMNAS_REQUERIDAS.filter((c) => !columnas.includes(c));
  if (faltan.length) {
    return { columnas, bloques: [], faltan, ignoradas: 0, avisos: [`Faltan columnas en el CSV: ${faltan.join(', ')}. Encabezado esperado: ${COLUMNAS_EXPORT.join(';')}`] };
  }
  const bloques = [];
  let ignoradas = 0;
  filas.forEach((o, i) => {
    const desde = /^\d+$/.test(o.numero_desde) ? Number(o.numero_desde) : NaN;
    const hasta = /^\d+$/.test(o.numero_hasta) ? Number(o.numero_hasta) : NaN;
    if (!Number.isSafeInteger(desde) || !Number.isSafeInteger(hasta) || desde < 1 || hasta < desde) { ignoradas++; return; }
    bloques.push({ ...o, desde, hasta, cantidad: hasta - desde + 1, cantidad_csv: o.cantidad ?? '', fila: i + 2 });
  });
  if (ignoradas) avisos.push(`${ignoradas} fila(s) ignorada(s) sin bloque válido (numero_desde–numero_hasta).`);
  const desconocidas = columnas.filter((c) => !COLUMNAS_EXPORT.includes(c));
  if (desconocidas.length) avisos.push(`Columnas no reconocidas: ${desconocidas.join(', ')}.`);
  return { columnas, bloques, faltan, ignoradas, avisos };
}

// Chequeos de integridad previos al sorteo. `ok: false` = no se sortea.
export function verificarPadron(bloques) {
  const errores = [], avisos = [];
  const personas = new Set(), ediciones = new Set(), ordenes = new Set();
  let total = 0, max = 0, ordenesRepetidas = 0;
  if (!bloques.length) errores.push('El padrón está vacío: ninguna fila con un bloque válido.');
  bloques.forEach((b, i) => {
    total += b.cantidad;
    if (b.hasta > max) max = b.hasta;
    personas.add(claveDni(b.dni));
    ediciones.add(b.edicion_id || '');
    if (b.orden_id) { if (ordenes.has(b.orden_id)) ordenesRepetidas++; ordenes.add(b.orden_id); }
    const f = `Fila ${b.fila}`;
    if (b.cantidad_csv !== '' && Number(b.cantidad_csv) !== b.cantidad) {
      errores.push(`${f}: cantidad ${b.cantidad_csv} no coincide con el bloque ${fmtBloque(b)} (${fmtNum(b.cantidad)} números).`);
    }
    if (i === 0) {
      if (b.desde !== 1) errores.push(`El primer bloque empieza en ${fmtNum(b.desde)} y no en 1.`);
      return;
    }
    const prev = bloques[i - 1];
    if (b.desde < prev.desde) errores.push(`${f}: los bloques no están ordenados por numero_desde (${fmtNum(b.desde)} después de ${fmtNum(prev.desde)}).`);
    else if (b.desde <= prev.hasta) errores.push(`${f}: el bloque ${fmtBloque(b)} se solapa con ${fmtBloque(prev)}.`);
    else if (b.desde !== prev.hasta + 1) {
      const n = b.desde - prev.hasta - 1;
      errores.push(`${f}: hueco entre ${fmtNum(prev.hasta)} y ${fmtNum(b.desde)} (${n === 1 ? 'falta 1 número' : `faltan ${fmtNum(n)} números`}).`);
    }
  });
  if (bloques.length && !errores.length && total !== max) {
    errores.push(`La suma de cantidades (${fmtNum(total)}) no coincide con el último número del padrón (${fmtNum(max)}).`);
  }
  if (ordenesRepetidas) avisos.push(`${ordenesRepetidas} orden_id repetido(s).`);
  if (ediciones.size > 1) avisos.push(`El padrón mezcla ${ediciones.size} ediciones: ${[...ediciones].map((e) => e || '(vacía)').join(', ')}.`);
  const ok = !errores.length;
  return {
    ok, errores, avisos, total, ordenes: bloques.length, personas: personas.size,
    ediciones: [...ediciones], edicion: [...ediciones].find(Boolean) || '',
    resumen: ok ? `bloques contiguos 1–${fmtNum(total)} sin huecos ni solapamientos` : `${errores.length} error(es) de integridad`,
  };
}

// Bloque que contiene el número r (búsqueda binaria sobre bloques ordenados por `desde`) o null.
export function mapearNumero(bloques, r) {
  let lo = 0, hi = bloques.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const b = bloques[m];
    if (r < b.desde) hi = m - 1;
    else if (r > b.hasta) lo = m + 1;
    else return b;
  }
  return null;
}

// Entero uniforme en [0, n) con crypto.getRandomValues, sin sesgo de módulo (rechazo de las palabras
// de 32 bits que no entran en un múltiplo de n). Devuelve { k, crudo, descartes } para que el registro
// guarde el valor crudo. n tiene que ser ≤ 2^32 (4.294.967.296 participaciones).
export function enteroAleatorio(n, cripto = globalThis.crypto) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0x100000000) throw new RangeError(`enteroAleatorio: n fuera de rango (${n})`);
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let descartes = 0;
  for (;;) {
    cripto.getRandomValues(buf);
    if (buf[0] < max) return { k: buf[0] % n, crudo: buf[0], descartes };
    descartes++;
  }
}

// Una extracción: número uniforme sobre la unión de los bloques cuyo DNI no está excluido.
// `rng(n)` devuelve un entero en [0, n) o un objeto { k, crudo, descartes } (inyectable en las pruebas).
// Devuelve { numero, bloque, rng: { crudo, k, universo, ordenes_elegibles, descartes } } o null si no queda nadie.
export function extraer(bloques, excluidos = new Set(), rng = enteroAleatorio) {
  const candidatos = bloques.filter((b) => !excluidos.has(claveDni(b.dni)));
  const universo = candidatos.reduce((s, b) => s + b.cantidad, 0);
  if (!universo) return null;
  const res = rng(universo);
  const k = typeof res === 'number' ? res : res.k;
  if (!Number.isInteger(k) || k < 0 || k >= universo) throw new RangeError(`rng devolvió ${k} fuera de [0, ${universo})`);
  const crudo = typeof res === 'number' ? res : (res.crudo ?? res.k);
  let off = k;
  for (const b of candidatos) {
    if (off < b.cantidad) {
      return { numero: b.desde + off, bloque: b, rng: { crudo, k, universo, ordenes_elegibles: candidatos.length, descartes: (typeof res === 'object' && res.descartes) || 0 } };
    }
    off -= b.cantidad;
  }
  throw new Error('extraer: desplazamiento fuera de los bloques elegibles');
}

// Resultado tal como va al registro JSON: número, bloque, orden, nombre, DNI enmascarado y RNG crudo.
export function armarResultado(tipo, label, extra, e, nombreBici = (id) => id || '', at = new Date().toISOString()) {
  const b = e.bloque;
  return {
    tipo, label, ...extra,
    numero: e.numero,
    bloque: { desde: b.desde, hasta: b.hasta, cantidad: b.cantidad },
    orden_id: b.orden_id || '', nombre: nombreCompleto(b), dni: enmascararDni(b.dni),
    provincia: b.provincia || '', bici_preferida: b.bici_preferida || '', bici: nombreBici(b.bici_preferida), pack_id: b.pack_id || '',
    rng: e.rng, at,
  };
}

// "N.º 12.345 → bloque 10.001–20.000 · Juan Pérez (DNI ***123) · Polygon Siskiu T7"
export function describirResultado(r) {
  return [`N.º ${fmtNum(r.numero)} → bloque ${fmtBloque(r.bloque)}`, `${r.nombre || 'Participante'}${r.dni ? ` (DNI ${r.dni})` : ''}`, r.bici]
    .filter(Boolean).join(' · ');
}

// Sorteo completo: 1.º premio, suplentes y premios adicionales. Devuelve { resultados, sinCandidatos }
// (sinCandidatos = extracciones que no se pudieron hacer porque ya salieron todas las personas).
export function sortear(bloques, opts = {}) {
  const {
    suplentes = SUPLENTES_DEFAULT, adicionales = 0, premiosSecundarios = [], rng = enteroAleatorio,
    premioTitulo = 'Polygon', nombreBici = (id) => id || '', ahora = () => new Date().toISOString(), alExtraer = () => {},
  } = opts;
  const excluidos = new Set();
  const resultados = [], sinCandidatos = [];
  const uno = (tipo, label, extra = {}) => {
    const e = extraer(bloques, excluidos, rng);
    if (!e) { sinCandidatos.push({ tipo, label, ...extra }); alExtraer(null, label); return null; }
    excluidos.add(claveDni(e.bloque.dni));
    const r = armarResultado(tipo, label, extra, e, nombreBici, ahora());
    resultados.push(r);
    alExtraer(r, label);
    return r;
  };
  uno('ganador', `1.º premio · ${premioTitulo}`);
  for (let i = 1; i <= suplentes; i++) uno('suplente', `${ord(i)} suplente`, { orden: i });
  for (let i = 1; i <= adicionales; i++) {
    const premio = premiosSecundarios[i - 1] || {};
    uno('adicional', [`${ord(i + 1)} premio`, premio.detalle].filter(Boolean).join(' · '), { orden: i, premio: premio.detalle || '' });
  }
  return { resultados, sinCandidatos, excluidos };
}

// Hash del padrón: SHA-256 (hex) del texto del CSV normalizado (sin BOM, saltos de línea LF, sin saltos
// ni espacios al final), para que el pegado en sorteo.html y el archivo den el mismo valor.
export const normalizarCsv = (text) => String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
export function hashPadron(text) {
  return createHash('sha256').update(normalizarCsv(text), 'utf8').digest('hex');
}

// Registro técnico del sorteo (mismo formato en la CLI y en sorteo.html).
export function armarRegistro({ herramienta, archivo, edicion, verificacion, hash, hashArchivo, suplentes, adicionales, resultados, sinCandidatos = [], fecha = new Date().toISOString() }) {
  return {
    _nota: `Registro técnico del sorteo generado por ${herramienta}. Guardalo junto con el video de la transmisión.`,
    herramienta,
    ...(archivo ? { archivo } : {}),
    edicion,
    fecha,
    metodo: METODO,
    regla_exclusion: REGLA_EXCLUSION,
    padron: {
      ordenes: verificacion.ordenes,
      participaciones: verificacion.total,
      personas: verificacion.personas,
      hash_sha256: hash,
      ...(hashArchivo ? { hash_archivo_sha256: hashArchivo } : {}),
      hash_nota: 'SHA-256 del texto del CSV sin BOM, con saltos de línea LF y sin saltos ni espacios al final. hash_archivo_sha256 = SHA-256 de los bytes del archivo tal cual (sha256sum padron.csv).',
      integridad: verificacion.resumen,
    },
    suplentes_previstos: suplentes,
    premios_adicionales_previstos: adicionales,
    resultados,
    ...(sinCandidatos.length ? { sin_candidatos: sinCandidatos } : {}),
  };
}

/* ---------- CLI ---------- */
function main(args) {
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && /^--(suplentes|adicionales|out)$/.test(args[i - 1])));
  if (!file) {
    console.error('Uso: node scripts/sorteo.mjs padron.csv [--suplentes N] [--adicionales N] [--out registro.json]');
    process.exit(1);
  }
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const entero = (v, def, nombre) => {
    if (v === undefined) return def;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      console.error(`--${nombre} debe ser un entero mayor o igual a 0.`);
      process.exit(1);
    }
    return n;
  };

  let cfg = null;
  try {
    cfg = JSON.parse(readFileSync(path.join(root, 'config/campaign.json'), 'utf8'));
  } catch {
    console.error('Aviso: no se pudo leer config/campaign.json; se usan valores por defecto (2 suplentes, sin premios adicionales).');
  }
  const suplentesCfg = Number(cfg?.sorteo?.suplentes);
  const premiosSecundarios = Array.isArray(cfg?.sorteo?.premios_secundarios) ? cfg.sorteo.premios_secundarios : [];
  const nSuplentes = entero(opt('suplentes'), Number.isInteger(suplentesCfg) && suplentesCfg >= 0 ? suplentesCfg : SUPLENTES_DEFAULT, 'suplentes');
  const nAdicionales = entero(opt('adicionales'), premiosSecundarios.length, 'adicionales');
  const unidad = (n) => {
    const u = cfg?.unidad || { singular: 'participación', plural: 'participaciones' };
    return n === 1 ? u.singular : u.plural;
  };
  const nombreBici = (id) => (cfg?.bicis || []).find((b) => b.id === id)?.nombre || id || '';

  const bytes = readFileSync(file);
  const texto = bytes.toString('utf8');
  const { bloques, avisos: avisosParse } = parsearPadron(texto);
  for (const a of avisosParse) console.log(`Aviso: ${a}`);
  const v = verificarPadron(bloques);
  const edicion = v.edicion || cfg?.edicion?.id || '';
  console.log(`Padrón: ${fmtNum(v.ordenes)} ${v.ordenes === 1 ? 'orden' : 'órdenes'} · ${fmtNum(v.total)} ${unidad(v.total)} · ${fmtNum(v.personas)} personas · edición ${edicion || '—'}`);
  for (const a of v.avisos) console.log(`Aviso: ${a}`);
  if (!v.ok) {
    console.error('\nEl padrón no pasa los chequeos de integridad; no se sortea:');
    for (const e of v.errores.slice(0, 15)) console.error(`  ✖ ${e}`);
    if (v.errores.length > 15) console.error(`  … y ${v.errores.length - 15} más.`);
    process.exit(1);
  }
  const hash = hashPadron(texto);
  const hashArchivo = createHash('sha256').update(bytes).digest('hex');
  console.log(`Integridad: ${v.resumen} ✔`);
  console.log(`SHA-256 del padrón: ${hash}`);
  if (hashArchivo !== hash) console.log(`SHA-256 del archivo tal cual (sha256sum): ${hashArchivo}`);
  console.log(`${REGLA_EXCLUSION}\n`);

  const { resultados, sinCandidatos } = sortear(bloques, {
    suplentes: nSuplentes, adicionales: nAdicionales, premiosSecundarios, nombreBici,
    premioTitulo: cfg?.premio?.titulo || 'Polygon',
    alExtraer: (r, label) => {
      if (!r) console.log(`${label.padEnd(26)} (no quedan ${unidad(2)} elegibles: todas las personas ya salieron sorteadas)`);
      else console.log(`${label.padEnd(26)} ${describirResultado(r)}`);
    },
  });

  const registro = armarRegistro({
    herramienta: 'scripts/sorteo.mjs', archivo: file, edicion, verificacion: v, hash, hashArchivo,
    suplentes: nSuplentes, adicionales: nAdicionales, resultados, sinCandidatos,
  });
  const out = opt('out') || `registro-sorteo-${edicion || 'edicion'}-${registro.fecha.slice(0, 10)}.json`;
  writeFileSync(out, JSON.stringify(registro, null, 2));
  console.log(`\nRegistro del sorteo guardado en ${out} (respaldo técnico; guardalo junto con el video).`);
}

// Solo corre la CLI cuando el archivo es el programa principal (importado desde las pruebas, no hace nada).
const esPrincipal = (() => {
  try { return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (esPrincipal) main(process.argv.slice(2));
