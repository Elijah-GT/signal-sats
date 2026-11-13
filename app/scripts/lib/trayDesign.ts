// The hand-written form of a tray puzzle, in content/tray/designs.json.
//
// Satellites and storms name what they do in one of two ways:
//   { "swap": [2, 5] }      swap letters 2 and 5 (1-based, as players count)
//   { "op": "reverse" }     reverse the whole signal
//   { "op": "rotate" }      move the first letter to the end

import { encode } from '../../src/shared/engine/cipher.ts';
import type {
  Angle,
  CipherOp,
  Point,
  Port,
} from '../../src/shared/engine/types.ts';
import type { DayBand } from '../../src/shared/puzzle.ts';
import type { TrayPuzzle } from '../../src/shared/tray.ts';

export type Swap = [number, number];
export type OpSpec = { swap: Swap } | { op: 'reverse' | 'rotate' };

export type Design = {
  id: string;
  band: DayBand;
  width: number;
  height: number;
  source: Port;
  debris: Point[];
  storms: ({ id: string; x: number; y: number } & OpSpec)[];
  fixed: ({ id: string; x: number; y: number; angle: Angle } & OpSpec)[];
  pieces: ({ id: string } & OpSpec)[];
  /** Tray pieces the solution never needs. */
  decoys: string[];
  answer: string;
  /** Satellite and storm ids in the order the beam meets them. */
  intended: string[];
};

export const toOp = (spec: OpSpec): CipherOp =>
  'swap' in spec
    ? { kind: 'trade', a: spec.swap[0] - 1, b: spec.swap[1] - 1 }
    : { kind: spec.op };

/** The ops the beam meets along `order`. */
export const opsAlong = (
  design: Design,
  order: readonly string[]
): CipherOp[] => {
  const ops = new Map(
    [...design.storms, ...design.fixed, ...design.pieces].map((s) => [
      s.id,
      toOp(s),
    ])
  );
  return order.map((id) => {
    const op = ops.get(id);
    if (!op) throw new Error(`${design.id}: unknown satellite "${id}"`);
    return op;
  });
};

/** The puzzle, with the signal worked out from the intended order. Par is left at 0. */
export const toPuzzle = (
  design: Design,
  intended: readonly string[] = design.intended
): TrayPuzzle => ({
  id: design.id,
  band: design.band,
  width: design.width,
  height: design.height,
  source: design.source,
  debris: design.debris,
  storms: design.storms.map(({ id, x, y, ...spec }) => ({
    id,
    x,
    y,
    op: toOp(spec),
  })),
  fixed: design.fixed.map(({ id, x, y, angle, ...spec }) => ({
    id,
    x,
    y,
    angle,
    op: toOp(spec),
  })),
  pieces: design.pieces.map(({ id, ...spec }) => ({ id, op: toOp(spec) })),
  ciphertext: encode(design.answer, opsAlong(design, intended)),
  answer: design.answer,
  par: 0,
});
