import { decode, type DecodeResult, type DecodeStep } from './engine/decode.ts';
import { toggleSatellite } from './engine/settings.ts';
import type { Settings } from './engine/types.ts';
import type { ClientPuzzle } from './puzzle.ts';

/** Transmissions that count toward the score. Players can keep going after, unscored. */
export const SCORED_TRANSMISSIONS = 3;

export type Transmission = {
  /** Satellites the beam passed through, in order, e.g. "C>A". */
  route: string;
  output: string;
  correct: boolean;
  steps: DecodeStep[];
};

export type GameState = {
  settings: Settings;
  taps: number;
  transmissions: Transmission[];
};

/** Where the beam goes right now, and what text would reach Earth. */
export type Preview = DecodeResult & { route: string };

/** Why the Transmit button is disabled, or `null` when it can be pressed. */
export type TransmitBlock = 'solved' | 'lost' | 'repeat';

export const newGame = (puzzle: ClientPuzzle): GameState => ({
  settings: puzzle.start,
  taps: 0,
  transmissions: [],
});

export const isSolved = (state: GameState): boolean =>
  state.transmissions.some((t) => t.correct);

/** Flips one satellite's reflector. Does nothing once the puzzle is solved. */
export const tap = (state: GameState, satelliteId: string): GameState =>
  isSolved(state)
    ? state
    : {
        ...state,
        settings: toggleSatellite(state.settings, satelliteId),
        taps: state.taps + 1,
      };

export const preview = (puzzle: ClientPuzzle, state: GameState): Preview => {
  const result = decode(puzzle.board, state.settings, puzzle.ciphertext);
  return { ...result, route: result.trace.hits.map((s) => s.id).join('>') };
};

export const transmitBlock = (
  state: GameState,
  current: Preview
): TransmitBlock | null => {
  if (isSolved(state)) return 'solved';
  if (current.output === null) return 'lost';
  if (state.transmissions.some((t) => t.route === current.route))
    return 'repeat';
  return null;
};

/** Adds a transmission. Ignored if the Transmit button should have been disabled. */
export const recordTransmission = (
  state: GameState,
  current: Preview,
  correct: boolean
): GameState => {
  const { output } = current;
  if (transmitBlock(state, current) !== null || output === null) return state;
  const transmission = {
    route: current.route,
    output,
    correct,
    steps: current.steps,
  };
  return { ...state, transmissions: [...state.transmissions, transmission] };
};

/** Which transmission solved it (1-based), or `null` if not solved yet. */
export const solvedOn = (state: GameState): number | null => {
  const index = state.transmissions.findIndex((t) => t.correct);
  return index === -1 ? null : index + 1;
};

export const scoredTriesLeft = (state: GameState): number =>
  Math.max(0, SCORED_TRANSMISSIONS - state.transmissions.length);

/**
 * Spoiler-free result for live play, scored by taps against par, e.g.
 * "Signal Sats 2026-11-16 · 3 taps (par 2)\n🛰🛰🛰📡".
 */
export const parShareText = (
  title: string,
  date: string,
  taps: number,
  par: number
): string => {
  const shown = Math.min(taps, 12);
  const sats = '🛰'.repeat(shown) + (taps > shown ? '…' : '');
  const badge = taps <= par ? ' ⭐' : '';
  return `${title} ${date} · ${taps} ${taps === 1 ? 'tap' : 'taps'} (par ${par})${badge}\n${sats}📡`;
};

/** Spoiler-free result for sharing, e.g. "Signal Sats 2026-11-16 2/3\n❌📡⬛". */
export const shareText = (
  title: string,
  date: string,
  state: GameState
): string => {
  const solved = solvedOn(state);
  const marks = Array.from({ length: SCORED_TRANSMISSIONS }, (_, i) => {
    const t = state.transmissions[i];
    if (!t) return '⬛';
    return t.correct ? '📡' : '❌';
  }).join('');
  const score =
    solved !== null && solved <= SCORED_TRANSMISSIONS
      ? `${solved}/${SCORED_TRANSMISSIONS}`
      : `X/${SCORED_TRANSMISSIONS}`;
  return `${title} ${date} ${score}\n${marks}`;
};
