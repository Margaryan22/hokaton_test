import { distance } from "fastest-levenshtein";
import type { DateTime } from "luxon";
import type { Kind, Tense } from "../nlu/types";
import { isStopWord } from "./stopwords";
import { stem, words } from "./stem";
import { areSynonyms } from "./synonyms";

// ADR-005. Pure: the caller passes the records of the current user only.

/** The fields of a record that search needs (a row from `src/db` fits). */
export type SearchableRecord = {
  id: number;
  kind: Kind;
  title: string;
  /** Moscow day `YYYY-MM-DD`. */
  dueDate: string | null;
  startsAt: Date | null;
};

export type SearchQuery = { terms: string[]; kind?: Kind; tense?: Tense };
export type SearchResult<T> = { items: T[]; total: number };

export const SEARCH_LIMIT = 5;

const W_STEM = 1.0;
const W_PREFIX = 0.8;
const W_SYNONYM = 0.6;
const W_FUZZY = 0.4;
const MIN_PREFIX = 3;
const W_ASPECT = 0.9;

/** Verb prefixes that only change the aspect: звонить/позвонить/созвониться, готовить/подготовить. */
const VERB_PREFIXES = ["пере", "под", "при", "про", "раз", "по", "за", "со", "от", "до", "на", "вы", "у", "с"];
const MIN_CORE = 4;

/** The stem without an aspect prefix, when at least 4 letters stay. */
function core(stemmed: string): string {
  const prefix = VERB_PREFIXES.find((p) => stemmed.startsWith(p) && stemmed.length - p.length >= MIN_CORE);
  return prefix ? stemmed.slice(prefix.length) : stemmed;
}

type Word = { raw: string; stem: string };

function toWords(text: string): Word[] {
  return words(text).map((raw) => ({ raw, stem: stem(raw) }));
}

function fuzzyLimit(len: number): number {
  return len >= 9 ? 2 : len >= 5 ? 1 : -1;
}

function wordScore(term: Word, token: Word): number {
  if (term.stem === token.stem) return W_STEM;
  if (
    (term.stem.length >= MIN_PREFIX && token.raw.startsWith(term.stem)) ||
    (token.stem.length >= MIN_PREFIX && term.raw.startsWith(token.stem))
  ) {
    return W_PREFIX;
  }
  const a = core(term.stem);
  const b = core(token.stem);
  if ((a !== term.stem || b !== token.stem) && a.length >= MIN_CORE && b.length >= MIN_CORE && (a === b || a.startsWith(b) || b.startsWith(a))) {
    return W_ASPECT;
  }
  if (areSynonyms(term.stem, token.stem)) return W_SYNONYM;
  const limit = Math.min(fuzzyLimit(term.stem.length), fuzzyLimit(token.stem.length));
  if (limit >= 0 && distance(term.stem, token.stem) <= limit) return W_FUZZY;
  return 0;
}

function scoreRecord(terms: Word[], title: string): number {
  const tokens = toWords(title).filter((token) => !isStopWord(token.raw));
  let sum = 0;
  for (const term of terms) {
    let best = 0;
    for (const token of tokens) best = Math.max(best, wordScore(term, token));
    sum += best;
  }
  return sum;
}

/** Records without a date go last. */
function when(record: SearchableRecord): number {
  if (record.startsAt) return record.startsAt.getTime();
  return record.dueDate ? Date.parse(`${record.dueDate}T00:00:00+03:00`) : Number.POSITIVE_INFINITY;
}

function compare(a: { score: number; record: SearchableRecord }, b: { score: number; record: SearchableRecord }): number {
  if (b.score !== a.score) return b.score - a.score;
  const wa = when(a.record);
  const wb = when(b.record);
  if (wa !== wb) return wa < wb ? -1 : 1;
  return a.record.id - b.record.id;
}

function matchesTense(record: SearchableRecord, tense: Tense, now: DateTime): boolean {
  if (record.startsAt) {
    return tense === "past" ? record.startsAt.getTime() < now.toMillis() : record.startsAt.getTime() >= now.toMillis();
  }
  if (record.dueDate) {
    const today = now.toISODate()!;
    return tense === "past" ? record.dueDate < today : record.dueDate >= today;
  }
  return false; // undated records have no tense (ADR-005)
}

function queryTerms(terms: string[]): Word[] {
  return terms.flatMap((term) => toWords(term)).filter((w) => w.raw !== "" && !isStopWord(w.raw));
}

function scored<T extends SearchableRecord>(records: T[], terms: Word[], kind: Kind | undefined) {
  return records
    .filter((record) => !kind || record.kind === kind)
    .map((record) => ({ record, score: terms.length === 0 ? 1 : scoreRecord(terms, record.title) }))
    .filter((entry) => entry.score > 0);
}

/** Filters (kind, tense) then ranks by score, earlier date, id; top 5 and the total found. */
export function searchRecords<T extends SearchableRecord>(records: T[], query: SearchQuery, now: DateTime): SearchResult<T> {
  const terms = queryTerms(query.terms);
  const pool = query.tense ? records.filter((r) => matchesTense(r, query.tense!, now)) : records;
  const ranked = scored(pool, terms, query.kind).sort(compare);
  return { items: ranked.slice(0, SEARCH_LIMIT).map((e) => e.record), total: ranked.length };
}

/**
 * Candidates for delete / complete / update: records with the top score, no time filter.
 * One = the target, several = the user chooses (AC-17), none = not found. Needs at least one term.
 */
export function resolveTargets<T extends SearchableRecord>(
  records: T[],
  target: { kind?: Kind; terms: string[] },
): T[] {
  const terms = queryTerms(target.terms);
  if (terms.length === 0) return [];
  const ranked = scored(records, terms, target.kind).sort(compare);
  if (ranked.length === 0) return [];
  const top = ranked[0]!.score;
  return ranked
    .filter((e) => e.score === top)
    .slice(0, SEARCH_LIMIT)
    .map((e) => e.record);
}
