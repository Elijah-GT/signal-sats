import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { dayOf } from '../../shared/daily';
import { createDailyPost, postUrl } from '../core/post';

export const menu = new Hono();

/** Moderators: post today's puzzle now, without waiting for the scheduler. */
menu.post('/post-daily', async (c) => {
  try {
    const { postId, created } = await createDailyPost(dayOf(new Date()));
    return c.json<UiResponse>(
      created
        ? { navigateTo: postUrl(postId) }
        : { showToast: "Today's puzzle is already posted." },
      200
    );
  } catch (error) {
    console.error(`Error posting the daily puzzle: ${error}`);
    return c.json<UiResponse>({ showToast: "Couldn't post the puzzle." }, 400);
  }
});
