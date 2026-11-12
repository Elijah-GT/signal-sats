import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeek } from '../../scripts/lib/week.ts';

const DICTIONARY = new Set([
  'PROBE',
  'AWAKE',
  'RADIO',
  'ORBIT',
  'LIGHT',
  'VOICE',
  'EARTH',
]);
const isWord = (text: string): boolean => DICTIONARY.has(text);

const valid = {
  id: 'w01',
  start: '2026-11-16',
  message: 'THE OLD PROBE IS AWAKE AND LISTENING FOR US',
  words: ['PROBE', 'AWAKE', 'RADIO', 'ORBIT', 'LIGHT', 'VOICE', 'EARTH'],
};

describe('parseWeek', () => {
  test('accepts a well-formed week', () => {
    assert.deepEqual(parseWeek(valid, isWord), valid);
  });

  test('rejects something that is not an object', () => {
    for (const raw of [null, [], 'week', 7]) {
      assert.throws(() => parseWeek(raw, isWord), /must be a JSON object/);
    }
  });

  test('lists every problem at once', () => {
    const error = captureError(() =>
      parseWeek(
        {
          id: 'Week One',
          start: '2026-11-17',
          message: 'too short',
          words: ['PROBE', 'probe', 'QXZVK', 'PROBE', 'LIGHT', 'VOICE', 7],
        },
        isWord
      )
    );
    assert.match(error, /"id" must be lowercase/);
    assert.match(error, /"start" must be a Monday/);
    assert.match(error, /"message" must be 20–60 capital letters/);
    assert.match(error, /Word "probe" must be 5 capital letters/);
    assert.match(error, /Word "QXZVK" is not in the dictionary/);
    assert.match(error, /Word "PROBE" appears twice/);
    assert.match(error, /Word 7 must be 5 capital letters/);
  });

  test('rejects missing fields, a bad date and the wrong number of words', () => {
    const error = captureError(() =>
      parseWeek({ start: 'next monday', words: ['PROBE'] }, isWord)
    );
    assert.match(error, /"id" must be/);
    assert.match(error, /not a valid YYYY-MM-DD date/);
    assert.match(error, /"message" must be/);
    assert.match(error, /exactly 7 words/);

    assert.match(
      captureError(() => parseWeek({ ...valid, start: 20261116 }, isWord)),
      /"start" must be a YYYY-MM-DD date/
    );
  });
});

function captureError(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return assert.fail('Expected an error');
}
