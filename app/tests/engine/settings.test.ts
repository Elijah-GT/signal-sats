import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleFor,
  flipAngle,
  toggleSatellite,
} from '../../src/shared/engine/settings.ts';

describe('settings', () => {
  test('flipAngle swaps the two angles', () => {
    assert.equal(flipAngle('/'), '\\');
    assert.equal(flipAngle('\\'), '/');
  });

  test('toggleSatellite flips one satellite and leaves the original untouched', () => {
    const before = { S: '/', T: '/' } as const;
    const after = toggleSatellite(before, 'S');
    assert.deepEqual(after, { S: '\\', T: '/' });
    assert.deepEqual(before, { S: '/', T: '/' });
  });

  test('angleFor and toggleSatellite reject an unknown satellite', () => {
    assert.throws(() => angleFor({}, 'S'), /satellite "S"/);
    assert.throws(() => toggleSatellite({}, 'S'), /satellite "S"/);
  });
});
