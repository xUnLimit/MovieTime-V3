import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

type ReportRecord = Record<string, unknown>;

export class MigrationReport {
  readonly startedAt = new Date().toISOString();
  finishedAt: string | null = null;
  dryRun = false;
  counts: Record<string, number> = {};
  warnings: ReportRecord[] = [];
  errors: ReportRecord[] = [];
  orphans: ReportRecord[] = [];

  constructor(dryRun: boolean) {
    this.dryRun = dryRun;
  }

  addCount(key: string, delta: number) {
    this.counts[key] = (this.counts[key] ?? 0) + delta;
  }

  setCount(key: string, value: number) {
    this.counts[key] = value;
  }

  warn(message: string, details: ReportRecord = {}) {
    this.warnings.push({ message, ...details });
  }

  error(message: string, details: ReportRecord = {}) {
    this.errors.push({ message, ...details });
  }

  orphan(sourceCollection: string, sourceId: string, reason: string, payload: unknown) {
    this.orphans.push({ sourceCollection, sourceId, reason, payload });
  }

  toJSON() {
    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      dryRun: this.dryRun,
      counts: this.counts,
      warnings: this.warnings,
      errors: this.errors,
      orphans: this.orphans,
    };
  }

  summary(reportPath: string) {
    const orphanSummary = this.orphans.reduce<Record<string, number>>((acc, orphan) => {
      const key = `${String(orphan.sourceCollection)}:${String(orphan.reason)}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      reportPath,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      dryRun: this.dryRun,
      counts: this.counts,
      warningCount: this.warnings.length,
      orphanCount: this.orphans.length,
      errorCount: this.errors.length,
      warnings: this.warnings,
      orphanSummary,
    };
  }

  async save(path: string) {
    this.finishedAt = new Date().toISOString();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(this.toJSON(), null, 2) + '\n', 'utf8');
  }
}
