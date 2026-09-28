#!/usr/bin/env node
// Sorteo por línea de comandos (alternativa a sorteo.html).
// Uso: node scripts/sorteo.mjs padron.csv [--suplentes 2] [--adicionales 2] [--seed-log acta.json]
// Elige con crypto.randomInt (uniforme, sin sesgo). Una persona (DNI) no puede ganar dos veces.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Uso: node scripts/sorteo.mjs padron.csv [--suplentes 2] [--adicionales 2]');
  process.exit(1);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const nSuplentes = opt('suplentes', 2);
const nAdicionales = opt('adicionales', 2);

const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
const lineas = text.split(/\r?\n/).filter((l) => l.trim());
const sep = lineas[0].includes(';') ? ';' : ',';
const cols = lineas[0].split(sep).map((c) => c.trim());
const padron = lineas.slice(1).map((l) => {
  const vals = l.split(sep);
  const o = {};
  cols.forEach((c, i) => (o[c] = (vals[i] || '').trim()));
  o.numero = Number(o.numero);
  return o;
}).filter((o) => Number.isFinite(o.numero));

if (!padron.length) {
  console.error('El padrón está vacío.');
  process.exit(1);
}

const excluidos = new Set();
const resultados = [];
function sortear(label, tipo) {
  const candidatos = padron.filter((p) => !excluidos.has(p.dni));
  if (!candidatos.length) return null;
  const g = candidatos[randomInt(candidatos.length)];
  excluidos.add(g.dni);
  const r = { tipo, label, numero: g.numero, orden_id: g.orden_id, nombre: `${g.nombre} ${g.apellido}`.trim(), dni: g.dni, bici: g.bici_preferida, at: new Date().toISOString() };
  resultados.push(r);
  console.log(`${label.padEnd(22)} N° ${String(g.numero).padStart(4, '0')}  ${r.nombre}  (DNI ***${String(g.dni).slice(-3)})`);
  return r;
}

console.log(`Padrón: ${padron.length} participaciones · ${new Set(padron.map((p) => p.dni)).size} personas\n`);
sortear('Primer premio', 'ganador');
for (let i = 1; i <= nSuplentes; i++) sortear(`Suplente ${i}`, 'suplente');
for (let i = 1; i <= nAdicionales; i++) sortear(`Premio adicional ${i + 1}°`, 'adicional');

const acta = { archivo: file, fecha: new Date().toISOString(), participaciones: padron.length, resultados };
const out = `acta-sorteo-${acta.fecha.slice(0, 10)}.json`;
writeFileSync(out, JSON.stringify(acta, null, 2));
console.log(`\nActa guardada en ${out}`);
