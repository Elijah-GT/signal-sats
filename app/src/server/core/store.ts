// Everything the game keeps in Redis.
//
//   puzzle:{postId}   the post's puzzle, with its answer (JSON)
//   result:{postId}   hash: userId → the player's solve (JSON)
//   seen:{postId}     hash: userId → 1, for counting players
//   stats:{postId}    hash: players, solves, parSolves, moves (total)
//   streak:{userId}   the player's daily streak (JSON)
//   daily:{date}      the daily post's id for that date
//   cooldown:{userId} set while a player must wait to post another level

import { redis } from '@devvit/web/server';
import type { MyResult, PostStats } from '../../shared/api';
import type { Streak } from '../../shared/daily';
import { parsePuzzle } from '../../shared/level';
import type { TrayPuzzle } from '../../shared/tray';

const parse = (raw: string | undefined): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const savePuzzle = (postId: string, puzzle: TrayPuzzle) =>
  redis.set(`puzzle:${postId}`, JSON.stringify(puzzle));

export const loadPuzzle = async (postId: string): Promise<TrayPuzzle | null> =>
  parsePuzzle(parse(await redis.get(`puzzle:${postId}`)));

export const loadResult = async (
  postId: string,
  userId: string
): Promise<MyResult | null> => {
  const data = parse(await redis.hGet(`result:${postId}`, userId));
  return isRecord(data) &&
    typeof data['moves'] === 'number' &&
    typeof data['word'] === 'string'
    ? { moves: data['moves'], word: data['word'] }
    : null;
};

/**
 * Keeps a player's first solve of a post and counts it. Returns false if they
 * had already solved it, so a solve is only ever counted once.
 */
export const saveResult = async (
  postId: string,
  userId: string,
  result: MyResult,
  par: number
): Promise<boolean> => {
  const added = await redis.hSetNX(
    `result:${postId}`,
    userId,
    JSON.stringify(result)
  );
  if (!added) return false;
  const key = `stats:${postId}`;
  await redis.hIncrBy(key, 'solves', 1);
  await redis.hIncrBy(key, 'moves', result.moves);
  if (result.moves <= par) await redis.hIncrBy(key, 'parSolves', 1);
  return true;
};

/** Counts a player the first time they open a post. */
export const markSeen = async (postId: string, userId: string) => {
  const added = await redis.hSetNX(`seen:${postId}`, userId, '1');
  if (added) await redis.hIncrBy(`stats:${postId}`, 'players', 1);
};

export const loadStats = async (postId: string): Promise<PostStats> => {
  const raw = await redis.hGetAll(`stats:${postId}`);
  const n = (field: string) => Number(raw[field] ?? 0) || 0;
  const solves = n('solves');
  return {
    players: Math.max(n('players'), solves),
    solves,
    parSolves: n('parSolves'),
    averageMoves:
      solves > 0 ? Math.round((n('moves') / solves) * 10) / 10 : null,
  };
};

export const loadStreak = async (userId: string): Promise<Streak | null> => {
  const data = parse(await redis.get(`streak:${userId}`));
  return isRecord(data) &&
    typeof data['count'] === 'number' &&
    typeof data['last'] === 'string'
    ? { count: data['count'], last: data['last'] }
    : null;
};

export const saveStreak = (userId: string, streak: Streak) =>
  redis.set(`streak:${userId}`, JSON.stringify(streak));

export const dailyPostId = async (date: string): Promise<string | null> =>
  (await redis.get(`daily:${date}`)) ?? null;

export const setDailyPostId = (date: string, postId: string) =>
  redis.set(`daily:${date}`, postId);

/** Starts a wait before the player can post another level. */
export const startCooldown = async (userId: string, seconds: number) => {
  const key = `cooldown:${userId}`;
  await redis.set(key, '1');
  await redis.expire(key, seconds);
};

export const onCooldown = async (userId: string): Promise<boolean> =>
  Boolean(await redis.get(`cooldown:${userId}`));
