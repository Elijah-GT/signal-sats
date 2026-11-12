import { traceBeam, type Trace } from './beam.ts';
import { applyOp } from './cipher.ts';
import type { Board, CipherOp, Settings } from './types.ts';

/** What one satellite did to the text, for the step-by-step trace shown after a transmission. */
export type DecodeStep = {
  satelliteId: string;
  op: CipherOp;
  before: string;
  after: string;
};

export type DecodeResult = {
  trace: Trace;
  steps: DecodeStep[];
  /** The text that reached the receiver, or `null` if the beam never got there. */
  output: string | null;
};

/** Sends `ciphertext` along the beam and records how each satellite on the path changes it. */
export const decode = (
  board: Board,
  settings: Settings,
  ciphertext: string
): DecodeResult => {
  const trace = traceBeam(board, settings);
  const steps: DecodeStep[] = [];
  let text = ciphertext;
  for (const satellite of trace.hits) {
    const after = applyOp(text, satellite.op);
    steps.push({
      satelliteId: satellite.id,
      op: satellite.op,
      before: text,
      after,
    });
    text = after;
  }
  return {
    trace,
    steps,
    output: trace.end.kind === 'received' ? text : null,
  };
};
