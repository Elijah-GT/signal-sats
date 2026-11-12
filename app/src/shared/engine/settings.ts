import type { Angle, Settings } from './types.ts';

export const flipAngle = (angle: Angle): Angle => (angle === '/' ? '\\' : '/');

/** The angle set for satellite `id`. Throws if it has none, since every satellite needs one. */
export const angleFor = (settings: Settings, id: string): Angle => {
  const angle = settings[id];
  if (angle === undefined) {
    throw new Error(`No reflector angle set for satellite "${id}"`);
  }
  return angle;
};

/** Returns new settings with satellite `id` flipped, which is what a tap does. */
export const toggleSatellite = (settings: Settings, id: string): Settings => ({
  ...settings,
  [id]: flipAngle(angleFor(settings, id)),
});
