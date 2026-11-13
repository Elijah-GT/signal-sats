import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { dayOf } from '../../shared/daily';
import { createDailyPost } from '../core/post';

export const triggers = new Hono();

/** On install, post today's puzzle so the subreddit has one straight away. */
triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const { postId } = await createDailyPost(dayOf(new Date()));
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Daily puzzle ${postId} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error posting the daily puzzle: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to post the daily puzzle' },
      400
    );
  }
});
