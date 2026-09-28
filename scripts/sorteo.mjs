#!/usr/bin/env node
// Sorteo por línea de comandos (alternativa a sorteo.html).
// Uso: node scripts/sorteo.mjs padron.csv [--suplentes N] [--adicionales N] [--out registro.json]
//   --suplentes    suplentes del 1.º premio. Por defecto `sorteo.suplentes` de config/campaign.json
//                  o, si no existe, 2 (las bases §7 fijan dos participaciones suplentes).
//   --adicionales  premios adicionales a sortear. Por defecto la cantidad de `sorteo.premios_secundarios`
//                  de la config (vacío en la 1.ª edición).
//   --out          archivo JSON de salida (por defecto registro-sorteo-<edicion>-<fecha>.json).
// Elige con crypto.randomInt (uniforme, sin sesgo). Una persona (DNI) no puede salir dos veces.
// El JSON es el registro técnico del sorteo (se guarda junto con el video).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
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

// Ordinal en castellano: 1.º, 2.º (no "1°", que es el signo de grados).
const ord = (n) => `${n}.º`;

// Cantidad de suplentes cuando la config no trae `sorteo.suplentes`: las bases (§7) y la regla
// "Suplentes" de `sorteo.reglas` fijan DOS participaciones suplentes para el primer premio.
const SUPLENTES_DEFAULT = 2;

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
// Misma normalización que api/checkout.js (solo dígitos) para que "35.123.456" y "35123456" sean la misma persona.
const claveDni = (dni) => { const d = String(dni ?? '').replace(/\D/g, ''); return d || String(dni ?? '').trim(); };

// Parser CSV (RFC 4180): campos entre comillas, comillas dobles escapadas como "" y
// saltos de línea dentro de comillas. Espeja el formato de api/export.js: separador ";",
// BOM inicial y prefijo ' anti-inyección en celdas que empiezan con = + - @ \t \r.
// La misma función vive en sorteo.html: mantener las dos copias iguales.
function parseCsv(text) {
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

const { columnas, filas } = parseCsv(readFileSync(file, 'utf8'));
const faltan = ['numero', 'nombre', 'apellido', 'dni'].filter((c) => !columnas.includes(c));
if (faltan.length) {
  console.error(`Faltan columnas en el CSV: ${faltan.join(', ')}.`);
  process.exit(1);
}
let ignoradas = 0;
const padron = filas
  .filter((o) => { const ok = /^\d+$/.test(o.numero); if (!ok) ignoradas++; return ok; })
  .map((o) => ({ ...o, numero: Number(o.numero) }));
if (!padron.length) {
  console.error('El padrón está vacío (ninguna fila con "numero" válido).');
  process.exit(1);
}
// Sin spread (Math.max(...arr)) para que no falle con padrones muy grandes (cupo_total puede ser null).
const maxNumero = padron.reduce((m, p) => (p.numero > m ? p.numero : m), 0);
const padLen = Math.max(4, String(maxNumero).length);
const fmt = (n) => String(n).padStart(padLen, '0');
const personas = new Set(padron.map((p) => claveDni(p.dni)));
const numeros = new Set(padron.map((p) => p.numero));
const edicion = padron[0].edicion_id || cfg?.edicion?.id || '';

const excluidos = new Set();
const resultados = [];
function sortear(tipo, label, extra = {}) {
  const candidatos = padron.filter((p) => !excluidos.has(claveDni(p.dni)));
  if (!candidatos.length) {
    console.log(`${label.padEnd(26)} (no quedan ${unidad(2)} elegibles: todas las personas ya salieron sorteadas)`);
    return null;
  }
  const g = candidatos[randomInt(candidatos.length)];
  excluidos.add(claveDni(g.dni));
  const bici = nombreBici(g.bici_preferida);
  const r = {
    tipo, label, ...extra,
    numero: g.numero, orden_id: g.orden_id, nombre: `${g.nombre} ${g.apellido}`.trim(), dni: g.dni,
    provincia: g.provincia, bici_preferida: g.bici_preferida, bici, pack_id: g.pack_id, at: new Date().toISOString(),
  };
  resultados.push(r);
  const nombre = r.nombre.replace(/\s+/g, ' ');
  console.log(`${label.padEnd(26)} N.º ${fmt(g.numero)}  ${nombre}  (DNI ***${String(g.dni).slice(-3)})${bici ? `  · ${bici}` : ''}`);
  return r;
}

console.log(`Padrón: ${padron.length} ${unidad(padron.length)} · ${personas.size} personas · edición ${edicion || '—'}`);
if (padron.length !== numeros.size) console.log(`Aviso: ${padron.length - numeros.size} número(s) duplicado(s) en el padrón.`);
if (ignoradas) console.log(`Aviso: ${ignoradas} fila(s) ignorada(s) sin número válido.`);
console.log('Una persona (DNI) no puede salir dos veces: quien sale queda excluida de los sorteos siguientes.\n');

sortear('ganador', `1.º premio · ${cfg?.premio?.titulo || 'Polygon'}`);
for (let i = 1; i <= nSuplentes; i++) sortear('suplente', `${ord(i)} suplente`, { orden: i });
for (let i = 1; i <= nAdicionales; i++) {
  const premio = premiosSecundarios[i - 1] || {};
  sortear('adicional', [`${ord(i + 1)} premio`, premio.detalle].filter(Boolean).join(' · '), { orden: i, premio: premio.detalle || '' });
}

const registro = {
  _nota: 'Registro técnico del sorteo generado por scripts/sorteo.mjs. Guardalo junto con el video de la transmisión.',
  archivo: file,
  edicion,
  fecha: new Date().toISOString(),
  metodo: 'crypto.randomInt (entero uniforme, sin sesgo) sobre las participaciones elegibles',
  regla_exclusion: 'Una persona (DNI) no puede salir sorteada dos veces: quien sale queda excluida de los sorteos siguientes.',
  participaciones: padron.length,
  personas: personas.size,
  suplentes_previstos: nSuplentes,
  premios_adicionales_previstos: nAdicionales,
  resultados,
};
const out = opt('out') || `registro-sorteo-${edicion || 'edicion'}-${registro.fecha.slice(0, 10)}.json`;
writeFileSync(out, JSON.stringify(registro, null, 2));
console.log(`\nRegistro del sorteo guardado en ${out} (respaldo técnico; guardalo junto con el video).`);
