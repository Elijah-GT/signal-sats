import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { context } from '@devvit/web/server';
import type {
  CheckResponse,
  ErrorResponse,
  InitResponse,
  MyResult,
  PostLevelResponse,
  SignalPostData,
} from '../../shared/api';
import { currentStreak, dayOf, extendStreak } from '../../shared/daily';
import { parsePuzzle } from '../../shared/level';
import type { DayBand } from '../../shared/puzzle';
import { isValidLayout, toPublic, trayDecode } from '../../shared/tray';
import { solveTray } from '../../shared/traySolve';
import { createLevelPost, postUrl } from '../core/post';
import {
  loadPuzzle,
  loadResult,
  loadStats,
  loadStreak,
  markSeen,
  onCooldown,
  saveResult,
  saveStreak,
  startCooldown,
} from '../core/store';

/** How long a player waits between posting levels, in seconds. */
const LEVEL_COOLDOWN = 60;
const MAX_MOVES = 999;
const BANDS: readonly DayBand[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const api = new Hono();

const fail = (c: Context, message: string, status: ContentfulStatusCode) =>
  c.json<ErrorResponse>({ status: 'error', message }, status);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The post's public data, or a safe default for posts made before it existed. */
const readPostData = (): SignalPostData => {
  const d = context.postData;
  const band = BANDS.find((b) => isRecord(d) && b === d['band']) ?? 'mon';
  if (!isRecord(d)) {
    return { kind: 'custom', number: 0, date: '', band, author: '' };
  }
  return {
    kind: d['kind'] === 'daily' ? 'daily' : 'custom',
    number: typeof d['number'] === 'number' ? d['number'] : 0,
    date: typeof d['date'] === 'string' ? d['date'] : '',
    band,
    author: typeof d['author'] === 'string' ? d['author'] : '',
  };
};

const readBody = async (c: Context): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
};

api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return fail(c, 'Open this from a Signal Sats post.', 400);
  const puzzle = await loadPuzzle(postId);
  if (!puzzle) return fail(c, 'This post has no puzzle.', 404);

  if (userId) await markSeen(postId, userId);
  const [mine, stats, streak] = await Promise.all([
    userId ? loadResult(postId, userId) : Promise.resolve(null),
    loadStats(postId),
    userId ? loadStreak(userId) : Promise.resolve(null),
  ]);
  return c.json<InitResponse>({
    type: 'init',
    postId,
    post: readPostData(),
    puzzle: toPublic(puzzle),
    mine,
    stats,
    streak: currentStreak(streak, dayOf(new Date())),
    username: context.username ?? null,
  });
});

/**
 * Checks a layout by running the beam on the server, so a solve can't be
 * faked. A first solve is counted, and today's daily extends the streak.
 */
api.post('/check', async (c) => {
  const { postId, userId } = context;
  if (!postId) return fail(c, 'Open this from a Signal Sats post.', 400);
  const puzzle = await loadPuzzle(postId);
  if (!puzzle) return fail(c, 'This post has no puzzle.', 404);

  const body = await readBody(c);
  const placed = isRecord(body) ? body['placed'] : null;
  if (!isRecord(body) || !isValidLayout(puzzle, placed)) {
    return fail(c, "That layout isn't possible on this board.", 400);
  }
  const { output } = trayDecode(puzzle, { placed, selected: null, moves: 0 });
  if (output !== puzzle.answer) {
    return c.json<CheckResponse>({ type: 'check', correct: false });
  }

  // Moves can't be replayed, so take the player's count, but never fewer
  // than the pieces on the board.
  const claimed = body['moves'];
  const moves = Math.min(
    MAX_MOVES,
    Math.max(
      typeof claimed === 'number' && Number.isInteger(claimed) ? claimed : 0,
      Object.keys(placed).length
    )
  );
  let result: MyResult = { moves, word: puzzle.answer };
  let streak = 0;
  if (userId) {
    const first = await saveResult(postId, userId, result, puzzle.par);
    if (!first) result = (await loadResult(postId, userId)) ?? result;
    const today = dayOf(new Date());
    let saved = await loadStreak(userId);
    const post = readPostData();
    if (first && post.kind === 'daily' && post.date === today) {
      saved = extendStreak(saved, today);
      await saveStreak(userId, saved);
    }
    streak = currentStreak(saved, today);
  }
  return c.json<CheckResponse>({
    type: 'check',
    correct: true,
    result,
    stats: await loadStats(postId),
    streak,
  });
});

/** Posts a level made in the editor, once the server has checked it. */
api.post('/level', async (c) => {
  const { userId, username } = context;
  if (!userId || !username) return fail(c, 'Log in to post a level.', 401);
  if (await onCooldown(userId)) {
    return fail(c, 'You just posted a level. Try again in a minute.', 429);
  }
  const body = await readBody(c);
  const puzzle = parsePuzzle(isRecord(body) ? body['puzzle'] : null);
  if (!puzzle || puzzle.pieces.length === 0) {
    return fail(c, "That level isn't valid.", 400);
  }
  if (puzzle.ciphertext === puzzle.answer) {
    return fail(c, 'That signal is already unscrambled.', 400);
  }
  const report = solveTray(puzzle);
  if (report.orders.length === 0 || report.par === 0) {
    return fail(c, "That level can't be solved with its satellites.", 400);
  }
  await startCooldown(userId, LEVEL_COOLDOWN);
  const postId = await createLevelPost(
    { ...puzzle, par: report.par },
    username
  );
  return c.json<PostLevelResponse>({ type: 'level', url: postUrl(postId) });
});
