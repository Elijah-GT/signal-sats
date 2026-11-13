import { context, reddit } from '@devvit/web/server';
import type { SignalPostData } from '../../shared/api';
import {
  bandOf,
  dailyNumber,
  dailyPuzzle,
  dailyTitle,
} from '../../shared/daily';
import type { TrayPuzzle } from '../../shared/tray';
import { dailyPostId, savePuzzle, setDailyPostId } from './store';

const FALLBACK =
  'Signal Sats is a daily space puzzle: place satellites to bounce a ' +
  'signal down to Earth and unscramble the word. Open this post in the ' +
  'Reddit app or on new Reddit to play.';

/** A link to a post in this subreddit. */
export const postUrl = (postId: string): string =>
  `https://reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;

/**
 * Posts the daily puzzle for `date`, unless it's already up. Returns the post
 * id and whether this call made it.
 */
export const createDailyPost = async (
  date: string
): Promise<{ postId: string; created: boolean }> => {
  const existing = await dailyPostId(date);
  if (existing) return { postId: existing, created: false };

  const puzzle = dailyPuzzle(date);
  const postData: SignalPostData = {
    kind: 'daily',
    number: dailyNumber(date),
    date,
    band: bandOf(date),
    author: '',
  };
  const post = await reddit.submitCustomPost({
    title: dailyTitle(date),
    entry: 'default',
    postData,
    textFallback: { text: FALLBACK },
  });
  await savePuzzle(post.id, puzzle);
  await setDailyPostId(date, post.id);
  return { postId: post.id, created: true };
};

/** Posts a player's level as its own post. Returns the new post's id. */
export const createLevelPost = async (
  puzzle: TrayPuzzle,
  author: string
): Promise<string> => {
  const postData: SignalPostData = {
    kind: 'custom',
    number: 0,
    date: '',
    band: puzzle.band,
    author,
  };
  const post = await reddit.submitCustomPost({
    title: `Signal Sats level by u/${author}`,
    entry: 'default',
    postData,
    textFallback: { text: FALLBACK },
  });
  await savePuzzle(post.id, { ...puzzle, id: post.id });
  return post.id;
};
