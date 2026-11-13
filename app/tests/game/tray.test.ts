import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solveTray } from '../../scripts/lib/traySolve.ts';
import {
  dropPiece,
  isFreeCell,
  isTraySolved,
  newTrayGame,
  pieceAt,
  selectPiece,
  tapCell,
  tapSatellite,
  trayBoard,
  type TrayPuzzle,
  type TrayState,
} from '../../src/shared/tray.ts';

// Monday's puzzle: PBOER → PROBE with 2⇄5 then 4⇄5. 1⇄3 is a decoy.
const puzzle: TrayPuzzle = {
  id: 't',
  band: 'mon',
  width: 4,
  height: 4,
  source: { side: 'top', index: 1 },
  debris: [{ x: 3, y: 3 }],
  storms: [],
  fixed: [],
  pieces: [
    { id: 'A', op: { kind: 'trade', a: 1, b: 4 } },
    { id: 'B', op: { kind: 'trade', a: 3, b: 4 } },
    { id: 'C', op: { kind: 'trade', a: 0, b: 2 } },
  ],
  ciphertext: 'PBOER',
  answer: 'PROBE',
  par: 2,
};

describe('tray rules', () => {
  test('picking up a piece and tapping a square places it, facing "/"', () => {
    let state = selectPiece(newTrayGame(), 'A');
    assert.equal(state.selected, 'A');
    state = tapCell(puzzle, state, { x: 1, y: 1 });
    assert.deepEqual(state.placed['A'], { x: 1, y: 1, angle: '/' });
    assert.equal(state.selected, null);
    assert.equal(state.moves, 1);
  });

  test('tapping the picked-up piece again puts it back down', () => {
    const state = selectPiece(selectPiece(newTrayGame(), 'A'), 'A');
    assert.equal(state.selected, null);
  });

  test('pieces cannot go on debris, other pieces or off the board', () => {
    let state = tapCell(puzzle, selectPiece(newTrayGame(), 'A'), {
      x: 0,
      y: 0,
    });
    state = selectPiece(state, 'B');
    for (const cell of [
      { x: 3, y: 3 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: -1, y: 2 },
    ]) {
      assert.equal(isFreeCell(puzzle, state, cell), false);
      assert.equal(tapCell(puzzle, state, cell), state);
    }
  });

  test('pieces cannot go on a storm', () => {
    const stormy = {
      ...puzzle,
      storms: [{ id: 'S', x: 2, y: 2, op: { kind: 'reverse' } as const }],
    };
    const state = selectPiece(newTrayGame(), 'A');
    assert.equal(isFreeCell(stormy, state, { x: 2, y: 2 }), false);
    assert.equal(trayBoard(stormy, state).board.storms?.length, 1);
  });

  test('tapping a square with nothing picked up does nothing', () => {
    const state = newTrayGame();
    assert.equal(tapCell(puzzle, state, { x: 0, y: 0 }), state);
  });

  test('tapping a placed satellite turns its mirror; others do nothing', () => {
    let state = tapCell(puzzle, selectPiece(newTrayGame(), 'A'), {
      x: 1,
      y: 1,
    });
    state = tapSatellite(state, 'A');
    assert.equal(state.placed['A']?.angle, '\\');
    assert.equal(state.moves, 2);
    assert.equal(tapSatellite(state, 'F'), state);
  });

  test('tapping a placed piece in the tray picks it back up', () => {
    let state = tapCell(puzzle, selectPiece(newTrayGame(), 'A'), {
      x: 1,
      y: 1,
    });
    state = selectPiece(state, 'A');
    assert.equal(state.placed['A'], undefined);
    assert.equal(state.selected, 'A');
  });

  test('a correct build decodes the word', () => {
    // A at (1,1) facing "\" turns the falling beam right; B at (2,1) facing
    // "\" turns it back down into the dish.
    let state = newTrayGame();
    state = tapCell(puzzle, selectPiece(state, 'A'), { x: 1, y: 1 });
    state = tapSatellite(state, 'A');
    state = tapCell(puzzle, selectPiece(state, 'B'), { x: 2, y: 1 });
    assert.equal(isTraySolved(puzzle, state), false);
    state = tapSatellite(state, 'B');
    assert.equal(isTraySolved(puzzle, state), true);
    assert.equal(trayBoard(puzzle, state).board.satellites.length, 2);
  });
});

describe('solveTray', () => {
  test('finds the one satellite order and ignores the decoy', () => {
    const report = solveTray(puzzle);
    assert.deepEqual(report.orders, ['A>B']);
    assert.deepEqual(report.unusedPieces, ['C']);
    assert.ok(report.solutions.length > 1);
    // Both pieces facing "/": left along a row, then back down.
    assert.equal(report.par, 2);
  });

  test('follows fixed satellites the player cannot move', () => {
    const withFixed: TrayPuzzle = {
      ...puzzle,
      fixed: [
        {
          id: 'F',
          x: 1,
          y: 2,
          angle: '\\',
          op: { kind: 'trade', a: 0, b: 1 },
        },
      ],
      pieces: [],
      ciphertext: 'PROBE',
    };
    // F turns the beam right along row 2 and off the side: no way to the dish.
    assert.deepEqual(solveTray(withFixed).orders, []);
  });

  test('the shipped tray puzzles each have exactly one satellite order', () => {
    const shipped: TrayPuzzle[] = JSON.parse(
      readFileSync('content/tray/puzzles.json', 'utf8')
    );
    assert.equal(shipped.length, 3);
    for (const p of shipped) {
      const report = solveTray(p);
      assert.equal(report.orders.length, 1, p.id);
      assert.equal(report.par, p.par, p.id);
      assert.ok(report.unusedPieces.length >= 1, `${p.id}: has a decoy`);
    }
  });
});

describe('dragging pieces', () => {
  const placeAt = (state: TrayState, id: string, x: number, y: number) =>
    tapCell(puzzle, selectPiece(state, id), { x, y });

  test('a piece dragged from the tray lands on an empty square', () => {
    const state = dropPiece(puzzle, newTrayGame(), 'A', { x: 2, y: 1 });
    assert.deepEqual(state.placed['A'], { x: 2, y: 1, angle: '/' });
    assert.equal(state.moves, 1);
  });

  test('a placed piece dragged to an empty square moves there, keeping its angle', () => {
    let state = tapSatellite(placeAt(newTrayGame(), 'A', 0, 0), 'A');
    state = dropPiece(puzzle, state, 'A', { x: 2, y: 2 });
    assert.equal(pieceAt(state, { x: 0, y: 0 }), undefined);
    assert.equal(pieceAt(state, { x: 2, y: 2 }), 'A');
    assert.equal(state.placed['A']?.angle, '\\');
    assert.equal(state.moves, 3);
  });

  test('dropping one placed piece on another swaps their squares', () => {
    let state = placeAt(newTrayGame(), 'A', 0, 0);
    state = tapSatellite(placeAt(state, 'B', 1, 1), 'B');
    state = dropPiece(puzzle, state, 'A', { x: 1, y: 1 });
    assert.deepEqual(state.placed['A'], { x: 1, y: 1, angle: '/' });
    assert.deepEqual(state.placed['B'], { x: 0, y: 0, angle: '\\' });
  });

  test('a tray piece dropped on a placed one sends that one back to the tray', () => {
    let state = placeAt(newTrayGame(), 'A', 0, 0);
    state = dropPiece(puzzle, state, 'C', { x: 0, y: 0 });
    assert.equal(state.placed['A'], undefined);
    assert.equal(pieceAt(state, { x: 0, y: 0 }), 'C');
  });

  test('debris, storms, its own square, off the board and unknown pieces change nothing', () => {
    const stormy: TrayPuzzle = {
      ...puzzle,
      storms: [{ id: 'S', x: 2, y: 2, op: { kind: 'reverse' } }],
    };
    const state = placeAt(newTrayGame(), 'A', 0, 0);
    for (const cell of [
      { x: 3, y: 3 },
      { x: 2, y: 2 },
      { x: 0, y: 0 },
      { x: 9, y: 0 },
    ]) {
      assert.equal(dropPiece(stormy, state, 'A', cell), state);
    }
    assert.equal(dropPiece(stormy, state, 'Z', { x: 1, y: 1 }), state);
  });
});
