import { readFileSync } from 'node:fs';
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';
import wordListPath from 'word-list';

/** Every 5-letter English word in the `word-list` package, in capitals. */
export const loadFiveLetterWords = (): Set<string> =>
  new Set(
    readFileSync(wordListPath, 'utf8')
      .split(/\r?\n/)
      .filter((word) => /^[a-z]{5}$/.test(word))
      .map((word) => word.toUpperCase())
  );

/** Returns a check for offensive words, including ones buried inside other letters. */
export const createBlocklist = (): ((text: string) => boolean) => {
  const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  return (text) => matcher.hasMatch(text);
};
