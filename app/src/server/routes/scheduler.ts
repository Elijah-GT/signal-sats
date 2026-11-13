import { Hono } from 'hono';
import { dayOf } from '../../shared/daily';
import { createDailyPost } from '../core/post';

export const scheduler = new Hono();

/** Runs at 00:00 UTC (see devvit.json): posts the day's puzzle. */
scheduler.post('/daily-post', async (c) => {
  const date = dayOf(new Date());
  try {
    const { postId, created } = await createDailyPost(date);
    console.log(
      created
        ? `Posted ${date}: ${postId}`
        : `${date} already posted: ${postId}`
    );
    return c.json({ status: 'ok' }, 200);
  } catch (error) {
    console.error(`Error posting the daily puzzle for ${date}: ${error}`);
    return c.json({ status: 'error' }, 500);
  }
});
