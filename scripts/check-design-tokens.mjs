#!/usr/bin/env node
/**
 * Guardia del sistema de diseno (ver DESIGN.md).
 * Falla si el codigo de UI usa colores de paleta cruda, tamanos de fuente fuera de la escala
 * 12/14/16/20 o pesos distintos de normal/medium/semibold.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const MODS = '(?<![A-Za-z0-9_-])(?:[a-z0-9-]+:)*';
const END = '(?![A-Za-z0-9_-])';
const PALETTE =
  '(?:red|green|blue|yellow|orange|purple|violet|indigo|emerald|amber|rose|pink|teal|cyan|sky|lime|fuchsia|gray|slate|zinc|neutral|stone)';

export const RULES = [
  {
    id: 'paleta',
    hint: 'Usa tokens semanticos (text-danger, bg-success-subtle, border-warning-border, text-muted-foreground...) o StatusBadge.',
    regex: new RegExp(
      `${MODS}(?:text|bg|border|ring|fill|stroke|divide|outline|decoration|accent|caret|from|via|to|shadow)-${PALETTE}-[0-9]{2,3}(?:/[0-9]{1,3})?${END}`,
      'g'
    ),
  },
  {
    id: 'color-hexadecimal',
    hint: 'No uses colores hexadecimales en clases: define o reutiliza un token en globals.css.',
    regex: new RegExp(`${MODS}(?:text|bg|border|ring|fill|stroke|divide|outline|shadow)-\\[#[0-9a-fA-F]{3,8}\\]`, 'g'),
  },
  {
    id: 'tamano-arbitrario',
    hint: 'Usa la escala: text-xs (12), text-sm (14), text-base (16) o text-xl (20).',
    regex: new RegExp(`${MODS}text-\\[[0-9.]+(?:px|rem|em)\\]`, 'g'),
  },
  {
    id: 'tamano-fuera-de-escala',
    hint: 'text-lg y text-2xl+ no existen en la escala: usa text-base (16) o text-xl (20).',
    regex: new RegExp(`${MODS}text-(?:lg|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)${END}`, 'g'),
  },
  {
    id: 'peso-fuera-de-escala',
    hint: 'Solo font-normal, font-medium y font-semibold.',
    regex: new RegExp(`${MODS}font-(?:bold|extrabold|black|thin|extralight|light)${END}`, 'g'),
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__fixtures__') continue;
      walk(full, out);
    } else if (/\.(?:tsx|ts)$/.test(entry.name) && !/\.(?:test|spec)\.(?:tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function findViolations(text) {
  const found = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.regex)) {
        found.push({ rule: rule.id, hint: rule.hint, line: index + 1, token: match[0] });
      }
    }
  });
  return found;
}

function main() {
  const violations = [];
  for (const file of walk(ROOT)) {
    for (const v of findViolations(readFileSync(file, 'utf8'))) {
      violations.push({ file: file.replaceAll('\\', '/'), ...v });
    }
  }

  if (violations.length === 0) {
    console.log('Design tokens: sin violaciones.');
    return;
  }

  const byRule = new Map();
  for (const v of violations) {
    console.error(`${v.file}:${v.line}  [${v.rule}]  ${v.token}`);
    byRule.set(v.rule, v.hint);
  }
  console.error(`\nDesign tokens: ${violations.length} violacion(es). Reglas en DESIGN.md.`);
  for (const [rule, hint] of byRule) console.error(`  - ${rule}: ${hint}`);
  process.exitCode = 1;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1]?.endsWith('check-design-tokens.mjs')) {
  main();
}
