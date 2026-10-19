import { newStemmer } from "snowball-stemmers";
import { tokenize } from "../nlu/normalize";

const ru = newStemmer("russian");

/** Normalised words of a text (lower case, ё -> е, no punctuation). */
export function words(text: string): string[] {
  return tokenize(text).map((token) => token.t);
}

/** Snowball stem of an already normalised word. */
export function stem(word: string): string {
  return ru.stem(word);
}
