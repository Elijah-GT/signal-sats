import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../../src/shared/engine/cipher.ts';
import {
  SCORED_TRANSMISSIONS,
  isSolved,
  newGame,
  preview,
  recordTransmission,
  scoredTriesLeft,
  shareText,
  solvedOn,
  tap,
  transmitBlock,
  type GameState,
} from '../../src/shared/game.ts';
import { toClientPuzzle, type Puzzle } from '../../src/shared/puzzle.ts';

// The source is above column 0 and Earth runs along the bottom. At the start
// R is '/', which sends the beam off the left edge. Turning R to '\' sends it
// right to T, and turning T to '\' then sends it down to Earth. U is a decoy.
const puzzle: Puzzle = {
  date: '2026-11-16',
  week: 'test',
  band: 'mon',
  board: {
    width: 3,
    height: 3,
    source: { side: 'top', index: 0 },
    receiver: { side: 'bottom', from: 0, to: 2 },
    satellites: [
      { id: 'R', x: 0, y: 0, op: { kind: 'rotate' } },
      { id: 'T', x: 2, y: 0, op: { kind: 'reverse' } },
      { id: 'U', x: 0, y: 2, op: { kind: 'swap' } },
    ],
    debris: [],
  },
  ciphertext: encode('ORBIT', [{ kind: 'rotate' }, { kind: 'reverse' }]),
  start: { R: '/', T: '/', U: '/' },
  answer: 'ORBIT',
  solution: { R: '\\', T: '\\', U: '/' },
  stats: {
    satellites: 3,
    pathLength: 2,
    reachingSettings: 2,
    routes: 1,
    minTaps: 2,
    opKinds: ['rotate', 'reverse'],
  },
};
const client = toClientPuzzle(puzzle);

/** Turns R and T so the beam reaches Earth through both. */
const aimed = (): GameState => tap(tap(newGame(client), 'R'), 'T');

/** Sends whatever currently reaches Earth, marked right if it's the answer. */
const send = (state: GameState): GameState => {
  const current = preview(client, state);
  return recordTransmission(state, current, current.output === puzzle.answer);
};

describe('toClientPuzzle', () => {
  test('drops the answer and solution', () => {
    assert.equal('answer' in client, false);
    assert.equal('solution' in client, false);
    assert.equal(client.ciphertext, puzzle.ciphertext);
  });
});

describe('a game', () => {
  test('starts from the puzzle start angles with nothing sent', () => {
    const state = newGame(client);
    assert.deepEqual(state.settings, puzzle.start);
    assert.equal(state.taps, 0);
    assert.equal(scoredTriesLeft(state), SCORED_TRANSMISSIONS);
    assert.equal(solvedOn(state), null);
  });

  test('tapping flips a reflector and counts the tap', () => {
    const state = tap(newGame(client), 'R');
    assert.equal(state.settings['R'], '\\');
    assert.equal(state.taps, 1);
  });

  test('cannot transmit while the beam is lost in space', () => {
    const state = newGame(client);
    const current = preview(client, state);
    assert.equal(current.output, null);
    assert.equal(transmitBlock(state, current), 'lost');
    assert.equal(recordTransmission(state, current, false), state);
  });

  test('a miss uses a try, and the same route cannot be sent twice', () => {
    // The server decides what's correct; mark this one wrong to test a miss.
    const state = recordTransmission(aimed(), preview(client, aimed()), false);
    assert.equal(state.transmissions.length, 1);
    assert.equal(scoredTriesLeft(state), SCORED_TRANSMISSIONS - 1);
    assert.equal(transmitBlock(state, preview(client, state)), 'repeat');
  });

  test('a correct transmission solves it and locks the board', () => {
    const state = send(aimed());
    assert.equal(isSolved(state), true);
    assert.equal(solvedOn(state), 1);
    assert.equal(transmitBlock(state, preview(client, state)), 'solved');
    assert.equal(tap(state, 'R'), state);
  });

  test('records the route and what each satellite did to the text', () => {
    const [first] = send(aimed()).transmissions;
    assert.equal(first?.route, 'R>T');
    assert.equal(first?.output, 'ORBIT');
    assert.deepEqual(
      first?.steps.map((s) => s.satelliteId),
      ['R', 'T']
    );
  });
});

describe('shareText', () => {
  const miss = (route: string) => ({
    route,
    output: 'XXXXX',
    correct: false,
    steps: [],
  });
  const hit = (route: string) => ({
    route,
    output: 'ORBIT',
    correct: true,
    steps: [],
  });
  const base = newGame(client);

  test('shows the score and one mark per scored try', () => {
    const state = { ...base, transmissions: [miss('a'), hit('b')] };
    assert.equal(
      shareText('Signal Sats', '2026-11-16', state),
      'Signal Sats 2026-11-16 2/3\n❌📡⬛'
    );
  });

  test('a late or missing solve scores X', () => {
    const late = {
      ...base,
      transmissions: [miss('a'), miss('b'), miss('c'), hit('d')],
    };
    assert.equal(shareText('S', 'd', late), 'S d X/3\n❌❌❌');
    assert.equal(shareText('S', 'd', base), 'S d X/3\n⬛⬛⬛');
    assert.equal(scoredTriesLeft(late), 0);
  });
});
