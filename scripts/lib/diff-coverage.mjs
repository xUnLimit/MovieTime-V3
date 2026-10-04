import path from 'node:path';
import ts from 'typescript';

const criticalPattern = /(?:platform\/.*auth|application\/.*auth|authStore|payment|pago|refund|reembolso|rls|migration|orders?[-/]|pedidos?[-/]|venta-batch|commerce|useVentaCreate(?:Workflow|Submit))/i;
const productionFile = /^src\/.*\.[jt]sx?$/;
const excludedFile = /(?:\.(?:test|spec)\.[jt]sx?$|\.d\.ts$|^src\/test\/|^src\/types\/|^src\/app\/design-lab\/|^src\/platform\/supabase\/database\.types\.ts$)/;

export function isProductionFile(file) {
  return productionFile.test(file) && !excludedFile.test(file);
}

export function parseChangedLines(diff) {
  const files = new Map();
  let file;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      if (!files.has(file)) files.set(file, new Set());
    } else if (file && line.startsWith('@@ ')) {
      const range = line.split(' ')[2]?.slice(1);
      if (!range) continue;
      const [startText, countText] = range.split(',');
      const start = Number(startText);
      const count = countText === undefined ? 1 : Number(countText);
      for (let index = 0; index < count; index += 1) files.get(file).add(start + index);
    }
  }
  return files;
}

export function mergeChangedLines(target, source) {
  for (const [file, lines] of source) {
    if (!target.has(file)) target.set(file, new Set());
    for (const line of lines) target.get(file).add(line);
  }
  return target;
}

export function addUntrackedFile(changed, file, contents) {
  if (!isProductionFile(file)) return;
  const lines = new Set(contents.split(/\r?\n/).map((_, index) => index + 1));
  mergeChangedLines(changed, new Map([[file, lines]]));
}

function emptyTotals() {
  return { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
}

function intersects(changed, location) {
  if (!location?.start || !location?.end) return false;
  for (let line = location.start.line; line <= location.end.line; line += 1) {
    if (changed.has(line)) return true;
  }
  return false;
}

function collect(map, hits, changed, total, locationOf, branch = false) {
  for (const [id, entry] of Object.entries(map ?? {})) {
    if (!intersects(changed, locationOf(entry))) continue;
    const values = branch ? hits[id] ?? [] : [hits[id] ?? 0];
    total[0] += values.filter((value) => value > 0).length;
    total[1] += values.length;
  }
}

function collectFile(fileCoverage, changed, totals) {
  collect(fileCoverage.statementMap, fileCoverage.s, changed, totals.lines, (entry) => entry);
  collect(fileCoverage.fnMap, fileCoverage.f, changed, totals.functions, (entry) => entry.loc ?? entry.decl);
  collect(fileCoverage.branchMap, fileCoverage.b, changed, totals.branches, (entry) => entry.loc, true);
}

const punctuation = new Set([
  ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.OpenParenToken,
  ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.SemicolonToken, ts.SyntaxKind.CommaToken,
]);

function hasExecutableChangedCode(source, changed) {
  const ast = ts.createSourceFile('changed.ts', source, ts.ScriptTarget.Latest, true);
  function hasRuntimeToken(node) {
    const start = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    const end = ast.getLineAndCharacterOfPosition(node.end - 1).line + 1;
    if (![...changed].some((line) => line >= start && line <= end)) return false;
    if (ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isPropertySignature(node) || ts.isInterfaceDeclaration(node)) return false;
    // V8 does not create statement entries for static imports or reexports.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return false;
    // Braces, parentheses and separators on their own never run.
    if (punctuation.has(node.kind)) return false;
    const children = node.getChildren(ast);
    if (children.length === 0) return true;
    // A function header (keyword, name, parameters) is not a statement; only its body can run.
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.body ? hasRuntimeToken(node.body) : false;
    return children.some(hasRuntimeToken);
  }
  return ast.statements.some(hasRuntimeToken);
}

export function relativeCoverage(coverage, cwd) {
  return new Map(Object.entries(coverage).map(([file, value]) => [path.relative(cwd, file).replaceAll('\\', '/'), value]));
}

export function evaluateCoverage(changed, report, readSource) {
  const totals = emptyTotals();
  const critical = emptyTotals();
  const missing = [];
  for (const [file, lines] of changed) {
    if (!isProductionFile(file) || lines.size === 0) continue;
    const fileCoverage = report.get(file);
    if (!fileCoverage) {
      if (hasExecutableChangedCode(readSource(file), lines)) missing.push(file);
      continue;
    }
    const target = criticalPattern.test(file) ? critical : totals;
    const before = target.lines[1];
    collectFile(fileCoverage, lines, target);
    if (target.lines[1] === before && hasExecutableChangedCode(readSource(file), lines)) missing.push(file);
  }
  for (const metric of Object.keys(totals)) {
    totals[metric][0] += critical[metric][0];
    totals[metric][1] += critical[metric][1];
  }
  return { totals, critical, missing };
}
