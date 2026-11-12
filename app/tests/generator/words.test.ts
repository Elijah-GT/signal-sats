import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlocklist,
  loadFiveLetterWords,
} from '../../scripts/lib/words.ts';

describe('loadFiveLetterWords', () => {
  const words = loadFiveLetterWords();

  test('holds thousands of capitalised 5-letter words', () => {
    assert.ok(words.size > 10000);
    assert.ok(words.has('ORBIT'));
    assert.ok([...words].every((w) => /^[A-Z]{5}$/.test(w)));
  });

  test('leaves out other lengths', () => {
    assert.equal(words.has('SIGNAL'), false);
    assert.equal(words.has('SKY'), false);
  });
});

describe('createBlocklist', () => {
  const isBlocked = createBlocklist();

  test('catches offensive words, even inside other letters', () => {
    assert.equal(isBlocked('SHITS'), true);
    assert.equal(isBlocked('XSHIT'), true);
  });

  test('lets ordinary words and scrambles through', () => {
    for (const text of ['ORBIT', 'ASSET', 'CLASS', 'TIBRO', 'QNSHA']) {
      assert.equal(isBlocked(text), false, text);
    }
  });
});
