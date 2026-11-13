// Pixel-art sprite data for the board. Drawn with Bitmap from ./pixels.

type Tone = Readonly<Record<string, string>>;

export const ASTEROID = [
  '...aaa...',
  '.aaaaaaa.',
  'aaAaaaaaa',
  'aaaaakaaA',
  'aaaakaaAA',
  '.aaaaaAA.',
  '..aAAAA..',
  '...AAA...',
];
export const ASTEROID_TONE: Tone = {
  a: 'sg-px-rock',
  A: 'sg-px-rock-dark',
  k: 'sg-px-crack',
};

/** The radar dish on Earth. Row 0's feed horn is where the beam is caught. */
export const DISH = [
  '......fff......',
  '.......s.......',
  'd.....s.s.....d',
  'dd...s...s...dd',
  'ddd.s.....s.ddd',
  '.ddds.....sddd.',
  '..DDdddddddDD..',
  '....DDDDDDD....',
  '......mmm......',
  '......mmm......',
  '.....bbbbb.....',
  '...bbbbbbbbb...',
];
export const DISH_TONE: Tone = {
  f: 'sg-px-feed',
  s: 'sg-px-strut',
  d: 'sg-px-dish',
  D: 'sg-px-dish-dark',
  m: 'sg-px-strut',
  b: 'sg-px-base',
};
export const DISH_UNIT = 3;

// A chevron pointing down: where the signal comes in.
export const CHEVRON = ['#.....#', '.#...#.', '..#.#..', '...#...'];
