import type { Board } from '../../src/shared/engine/types.ts';

/**
 * A 3×3 board where, with `loopSettings`, the beam crosses satellite S twice:
 * it enters from the left, turns up at S, right at A, down at B, left at C,
 * back through S (now turning down), and out the bottom to the receiver.
 *
 *     . A B
 *  →  . S C
 *     . . .
 *       ↓
 */
export const loopBoard: Board = {
  width: 3,
  height: 3,
  source: { side: 'left', index: 1 },
  receiver: { side: 'bottom', from: 1, to: 1 },
  satellites: [
    { id: 'S', x: 1, y: 1, op: { kind: 'rotate' } },
    { id: 'A', x: 1, y: 0, op: { kind: 'swap' } },
    { id: 'B', x: 2, y: 0, op: { kind: 'reverse' } },
    { id: 'C', x: 2, y: 1, op: { kind: 'shift', amount: 2 } },
  ],
  debris: [],
};

export const loopSettings = { S: '/', A: '/', B: '\\', C: '/' } as const;
