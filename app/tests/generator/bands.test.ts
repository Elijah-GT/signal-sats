import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDS,
  addDays,
  bandForDate,
  parseDate,
} from '../../scripts/lib/bands.ts';

describe('dates', () => {
  test('bandForDate follows the UTC weekday', () => {
    assert.equal(bandForDate('2026-11-16'), 'mon');
    assert.equal(bandForDate('2026-11-19'), 'thu');
    assert.equal(bandForDate('2026-11-22'), 'sun');
  });

  test('addDays crosses month and year ends', () => {
    assert.equal(addDays('2026-11-30', 1), '2026-12-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-11-16', 6), '2026-11-22');
  });

  test('parseDate rejects anything that is not a real YYYY-MM-DD date', () => {
    for (const bad of [
      '2026-11-31',
      '2026-13-01',
      '16/11/2026',
      '2026-1-1',
      '',
    ]) {
      assert.throws(() => parseDate(bad), /not a valid YYYY-MM-DD date/, bad);
    }
  });
});

describe('BANDS', () => {
  test('every band can be satisfied', () => {
    for (const [name, spec] of Object.entries(BANDS)) {
      const [minSats, maxSats] = spec.satellites;
      const [minPath, maxPath] = spec.pathLength;
      assert.ok(minSats <= maxSats, `${name}: satellites range`);
      assert.ok(minPath <= maxPath, `${name}: path range`);
      assert.ok(
        minPath + spec.minDecoys <= maxSats,
        `${name}: room for decoys`
      );
      assert.ok(spec.ops.length > 0, `${name}: ops`);
      assert.ok(spec.debris[0] <= spec.debris[1], `${name}: debris range`);
      if (spec.ops.includes('shift')) {
        assert.ok(spec.maxShift >= 1, `${name}: shift amount`);
      }
    }
  });

  test('path lengths are even, since a top-to-bottom beam turns an even number of times', () => {
    for (const [name, spec] of Object.entries(BANDS)) {
      for (const length of spec.pathLength) {
        assert.equal(length % 2, 0, `${name}: path length ${length}`);
      }
    }
  });

  test('difficulty never drops from Monday to Sunday', () => {
    const week = [
      BANDS.mon,
      BANDS.tue,
      BANDS.wed,
      BANDS.thu,
      BANDS.fri,
      BANDS.sat,
      BANDS.sun,
    ];
    for (let i = 1; i < week.length; i++) {
      const [prev, curr] = [week[i - 1], week[i]];
      assert.ok(prev && curr);
      assert.ok(
        curr.satellites[0] >= prev.satellites[0],
        `day ${i}: satellites`
      );
      assert.ok(curr.minRoutes >= prev.minRoutes, `day ${i}: routes`);
      assert.ok(curr.ops.length >= prev.ops.length, `day ${i}: ops`);
    }
  });
});
