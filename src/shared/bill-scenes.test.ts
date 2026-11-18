import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import manifest from '../generated/bill-visualizations.json';
import { billCollection } from './bill-catalog';

const bills = billCollection.bills;
const scenes = manifest.visualizations;
const definitionsRoot = join(process.cwd(), 'content', 'bill-visualizations');

describe('version-pinned, individually stored bill scenes', () => {
  test('all 100 catalog bills have one and only one scene', () => {
    expect(manifest.schema).toBe('civic-synthesis/bill-visualizations-manifest/v1');
    expect(manifest.sourceCollection).toBe('eudaimonia-100');
    expect(scenes.length).toBe(bills.length);
    expect(new Set(scenes.map(scene => scene.billId)).size).toBe(bills.length);
    expect(scenes.map(scene => scene.billId)).toEqual(bills.map(bill => bill.id));
  });

  test('every versioned JSON spec matches its canonical bill and current revision', () => {
    for (const bill of bills) {
      const path = join(definitionsRoot, bill.id + '.json');
      expect(existsSync(path)).toBe(true);
      const spec = JSON.parse(readFileSync(path, 'utf8'));
      const scene = scenes.find(item => item.billId === bill.id)!;
      expect(spec).toEqual(scene);
      expect(scene.schema).toBe('civic-synthesis/bill-visualization/v1');
      expect(scene.sourceRevision).toBe(bill.revision);
      expect(['journey', 'comparison', 'systems', 'timeline']).toContain(scene.layout);
      expect(bill.dimensions.split(';').map(tag => tag.trim())).toContain(scene.focusDimension);
      expect(scene.accent).toMatch(/^#[a-f0-9]{6}$/i);
    }
  });

  test('per-law scenes vary in layout and are not fabricated quantitative outcomes', () => {
    expect(new Set(scenes.map(scene => scene.layout)).size).toBe(4);
    expect(scenes.find(scene => scene.billId === 'HFL-051')?.focusDimension).toBe('Relationships');
    const keys = Object.keys(scenes[0]!);
    expect(keys).not.toContain('support');
    expect(keys).not.toContain('cost');
    expect(keys).not.toContain('impact');
    expect(keys).not.toContain('voteCount');
  });
  test('the checked-in manifest can be rebuilt byte-for-byte', () => {
    const result = spawnSync(process.execPath, ['scripts/build-bill-visualizations.mjs', '--check'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    if (result.status !== 0) throw new Error(result.stdout + '\\n' + result.stderr);
    expect(result.status).toBe(0);
  });

  test('carousel keyboard and thumbnail interactions work without network access', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-law-carousel-ui.tsx'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    if (result.status !== 0) throw new Error(result.stdout + '\\n' + result.stderr);
    expect(result.status).toBe(0);
  });
});
