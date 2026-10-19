/**
 * Normalisation and tokenisation of a Russian utterance.
 * Lower case, ё -> е, punctuation dropped, number words -> numbers.
 * Tokens keep their position in the original string so titles can be cut from it with their case.
 */

export type Token = {
  /** Normalised text of the token (lower case, ё -> е). */
  t: string;
  /** Position in the original string: `original.slice(start, end)`. */
  start: number;
  end: number;
  /** Numeric value of a digit token or a number word. */
  n?: number;
  /** Set for clock tokens like «14:30». */
  clock?: { h: number; m: number };
  /** True when `n` comes from digits rather than from a word. */
  digits?: boolean;
};

const NUMBER_WORDS: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  одну: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
};

/** Lower case and ё -> е without changing the string length (positions stay valid). */
function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = lower === "ё" ? "е" : lower;
    out += mapped.length === ch.length ? mapped : ch;
  }
  return out;
}

export function tokenize(text: string): Token[] {
  const folded = fold(text);
  const tokens: Token[] = [];
  for (const match of folded.matchAll(/\d{1,2}:\d{2}|[\p{L}\p{N}]+/gu)) {
    const t = match[0];
    const start = match.index ?? 0;
    const token: Token = { t, start, end: start + t.length };
    const clock = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (clock) {
      const h = Number(clock[1]);
      const m = Number(clock[2]);
      if (h > 23 || m > 59) continue;
      token.clock = { h, m };
    } else if (/^\d+$/.test(t)) {
      token.n = Number(t);
      token.digits = true;
    } else if (t in NUMBER_WORDS) {
      token.n = NUMBER_WORDS[t];
    }
    tokens.push(token);
  }
  return mergeCompoundNumbers(tokens);
}

/** «двадцать пять» -> one token with n = 25. */
function mergeCompoundNumbers(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1];
    if (a.n !== undefined && !a.digits && a.n >= 20 && a.n % 10 === 0 && b && b.n !== undefined && !b.digits && b.n >= 1 && b.n <= 9) {
      out.push({ t: `${a.t} ${b.t}`, start: a.start, end: b.end, n: a.n + b.n });
      i++;
    } else {
      out.push(a);
    }
  }
  return out;
}

/** Normalised text: tokens joined by single spaces, number words written as digits. */
export function normalize(text: string): string {
  return tokenize(text)
    .map((token) => (token.n !== undefined ? String(token.n) : token.t))
    .join(" ");
}
