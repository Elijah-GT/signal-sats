// Calls to the game's server. Each reply is checked for the shape we expect,
// since a failed request can come back as an error page.

import type {
  CheckRequest,
  CheckResponse,
  InitResponse,
  PostLevelResponse,
} from '../shared/api';
import type { TrayPuzzle } from '../shared/tray';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const call = async (path: string, body?: unknown): Promise<unknown> => {
  const res = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
  );
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON: handled below.
  }
  if (!res.ok) {
    const message =
      isRecord(data) && typeof data['message'] === 'string'
        ? data['message']
        : `Something went wrong (${res.status}).`;
    throw new Error(message);
  }
  return data;
};

const isInit = (v: unknown): v is InitResponse =>
  isRecord(v) && v['type'] === 'init' && isRecord(v['puzzle']);

const isCheck = (v: unknown): v is CheckResponse =>
  isRecord(v) && v['type'] === 'check' && typeof v['correct'] === 'boolean';

const isLevel = (v: unknown): v is PostLevelResponse =>
  isRecord(v) && v['type'] === 'level' && typeof v['url'] === 'string';

export const fetchInit = async (): Promise<InitResponse> => {
  const data = await call('/api/init');
  if (!isInit(data)) throw new Error("Couldn't load the puzzle.");
  return data;
};

export const checkLayout = async (
  request: CheckRequest
): Promise<CheckResponse> => {
  const data = await call('/api/check', request);
  if (!isCheck(data)) throw new Error("Couldn't check the signal.");
  return data;
};

export const postLevel = async (puzzle: TrayPuzzle): Promise<string> => {
  const data = await call('/api/level', { puzzle });
  if (!isLevel(data)) throw new Error("Couldn't post the level.");
  return data.url;
};
