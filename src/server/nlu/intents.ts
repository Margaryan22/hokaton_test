import type { Token } from "./normalize";
import type { Kind } from "./types";

/** Vocabulary and ordered rule predicates of the intent detector (docs/architecture.md §5). All words are normalised (ё -> е). */

const startsWithAny = (t: string, prefixes: readonly string[]): boolean => prefixes.some((p) => t.startsWith(p));

// --- kinds -----------------------------------------------------------------

export function kindOfWord(t: string): Kind | undefined {
  if (t.startsWith("напом")) return "reminder";
  if (t.startsWith("задач")) return "task";
  if (startsWithAny(t, ["встреч", "созвон", "планерк"]) || t === "демо") return "meeting";
  return undefined;
}

/** Kind words that are only a filter and not a search term («найди задачу …»). «созвон/планерка/демо» stay terms (ADR-005). */
export function isKindFilterWord(t: string): boolean {
  return t.startsWith("напом") || t.startsWith("задач") || t.startsWith("встреч");
}

export function firstKindWord(tokens: Token[]): { index: number; kind: Kind } | undefined {
  for (let i = 0; i < tokens.length; i++) {
    const kind = kindOfWord(tokens[i]!.t);
    if (kind) return { index: i, kind };
  }
  return undefined;
}

// --- command verbs -----------------------------------------------------------

// Imperatives always count; infinitives («убрать», «перенести») only when the phrase has no creation verb
// («Нужно убрать мусор» is a task, «Убрать задачу …» is a deletion).
const DELETE_IMPERATIVE = new Set(["удали", "удалите", "убери", "уберите", "сотри"]);
const DELETE_INFINITIVE = new Set(["удалить", "убрать", "стереть"]);
const UPDATE_IMPERATIVE = new Set(["перенеси", "перенесите", "передвинь", "сдвинь", "переставь", "поменяй", "измени"]);
const UPDATE_INFINITIVE = new Set(["перенести", "передвинуть", "сдвинуть", "переставить", "поменять", "изменить"]);
const MARK_IMPERATIVE = new Set(["отметь", "отметьте", "пометь"]);
const MARK_INFINITIVE = new Set(["отметить", "пометить"]);
const FINISH_IMPERATIVE = new Set(["заверши", "закрой"]);
const FINISH_INFINITIVE = new Set(["завершить", "закрыть"]);
export const SEARCH_VERBS = new Set(["найди", "найти", "найдите", "поищи", "ищи", "поискать", "отыщи"]);
/** Verbs that start a creation for sure (a list marker after them does not turn the phrase into a list). */
export const STRONG_CREATE_VERBS = new Set([
  "поставь",
  "поставить",
  "добавь",
  "добавить",
  "запиши",
  "записать",
  "создай",
  "создать",
  "запланируй",
  "запланировать",
  "назначь",
  "назначить",
  "организуй",
]);
export const WEAK_CREATE_VERBS = new Set(["нужно", "надо"]);

export function isCreateVerb(t: string): boolean {
  return STRONG_CREATE_VERBS.has(t) || WEAK_CREATE_VERBS.has(t) || t.startsWith("напомн");
}

export const isSearchVerb = (t: string): boolean => SEARCH_VERBS.has(t);

function hasVerb(tokens: Token[], imperative: Set<string>, infinitive: Set<string>): boolean {
  return (
    tokens.some((x) => imperative.has(x.t)) ||
    (tokens.some((x) => infinitive.has(x.t)) && !tokens.some((x) => isCreateVerb(x.t)))
  );
}

export const isDelete = (tokens: Token[]): boolean => hasVerb(tokens, DELETE_IMPERATIVE, DELETE_INFINITIVE);
export const isUpdate = (tokens: Token[]): boolean => hasVerb(tokens, UPDATE_IMPERATIVE, UPDATE_INFINITIVE);

const isDoneWord = (t: string): boolean => startsWithAny(t, ["выполн", "сделан", "готов"]);

/** «выполнена», «сделано», «завершена»: a participle saying the record is done. */
const isDoneParticiple = (t: string): boolean => startsWithAny(t, ["выполнен", "сделан", "завершен", "закончен"]);

/** Past-tense verbs of finishing something: «купил», «отправила», «сделал» (stem without the ending). */
const DONE_VERB = /^(?:купил|отправил|сделал|выполнил|закончил|завершил|позвонил|подготовил|оплатил|написал|сдал|заказал|забронировал|согласовал|провел|подписал|закрыл|отдал|получил|сходил|съездил|приготовил|решил)(?:а|и)?$/u;
const NOT_DONE_VERB = new Set(["был", "была", "было", "были"]);
const DONE_FILLERS = new Set(["я", "мы", "уже", "только", "все", "наконец"]);

/** Index of the past-tense verb in «Я купил билеты» / «Сделал отчет», when it opens the phrase (after «я/уже»). */
function doneVerbIndex(tokens: Token[]): number | undefined {
  const i = tokens.findIndex((x) => !DONE_FILLERS.has(x.t));
  const verb = tokens[i];
  if (!verb || NOT_DONE_VERB.has(verb.t) || !DONE_VERB.test(verb.t)) return undefined;
  const asks = tokens.some((x) => ["когда", "что", "как", "какие", "какой", "ли"].includes(x.t));
  return asks || isSearch(tokens) || isListMarker(tokens) ? undefined : i;
}

export function isComplete(tokens: Token[]): boolean {
  const marks = hasVerb(tokens, MARK_IMPERATIVE, MARK_INFINITIVE);
  if ((marks && tokens.some((x) => isDoneWord(x.t))) || hasVerb(tokens, FINISH_IMPERATIVE, FINISH_INFINITIVE)) return true;
  if (tokens.some((x) => isDoneParticiple(x.t)) && !isSearch(tokens) && !isListMarker(tokens)) return true;
  return doneVerbIndex(tokens) !== undefined && tokens.length > (doneVerbIndex(tokens) ?? 0) + 1;
}

const PAST_WORDS = new Set(["был", "была", "было", "были", "прошлой", "прошлую", "раньше"]);
const FUTURE_WORDS = new Set(["будет", "будут"]);

export function tenseOf(t: string): "past" | "future" | undefined {
  if (PAST_WORDS.has(t) || t.startsWith("ставил") || t.startsWith("прошл")) return "past";
  if (FUTURE_WORDS.has(t) || t.startsWith("запланирован") || t.startsWith("предстоящ")) return "future";
  return undefined;
}

/** «когда» opens the question: «Когда я должен позвонить стоматологу?», «Когда мне нужно отправить отчет?». */
function asksWhen(tokens: Token[]): boolean {
  const first = tokens.find((x) => !["а", "и", "ну", "скажи", "подскажи", "пожалуйста"].includes(x.t));
  return first?.t === "когда" && tokens.some((x) => x.t !== "когда" && !isStopWord(x.t));
}

/** «Что там про договор», «Что у меня про стоматолога»: a topic after «про/о/об» with words behind it. */
function asksAboutTopic(tokens: Token[]): boolean {
  if (tokens[0]?.t !== "что") return false;
  const at = tokens.findIndex((x) => ["про", "о", "об"].includes(x.t));
  if (at < 1 || tokens.slice(1, at).some((x) => !["там", "у", "меня", "нас", "мне", "было", "есть", "тут"].includes(x.t))) return false;
  return tokens.slice(at + 1).some((x) => !isStopWord(x.t));
}

export function isSearch(tokens: Token[]): boolean {
  if (tokens.some((x) => isSearchVerb(x.t))) return true;
  if (asksWhen(tokens) || asksAboutTopic(tokens)) return true;
  const hasWhen = tokens.some((x) => x.t === "когда");
  return hasWhen && tokens.some((x) => tenseOf(x.t) !== undefined || kindOfWord(x.t) !== undefined);
}

/** Tense of a search: a past word wins; «должен (был) позвонить» has none (undated records have no tense, ADR-005). */
export function searchTense(tokens: Token[]): "past" | "future" | undefined {
  if (tokens.some((x) => x.t.startsWith("долж"))) return undefined;
  const tenses = tokens.map((x) => tenseOf(x.t));
  return tenses.includes("past") ? "past" : tenses.includes("future") ? "future" : undefined;
}

const LIST_AFTER_WHAT = new Set(["у", "на", "запланировано", "было", "будет", "есть", "по", "в", "со", "сегодня", "завтра", "послезавтра", "нужно", "надо"]);

const WHICH_WORDS = ["какие", "какой", "какая", "какое"];

/** «что у меня», «какие задачи/планы …», «покажи …», «есть ли …», «планы», «расписание». */
export function isListMarker(tokens: Token[]): boolean {
  const asksAboutPlans = tokens.some((x) => kindOfWord(x.t) !== undefined || startsWithAny(x.t, ["план", "дела"]));
  return tokens.some((x, i) => {
    const t = x.t;
    if (t === "что") return LIST_AFTER_WHAT.has(tokens[i + 1]?.t ?? "");
    if (t === "есть") return tokens[i + 1]?.t === "ли";
    if (WHICH_WORDS.includes(t)) return asksAboutPlans;
    return startsWithAny(t, ["покаж", "выведи", "планы", "расписан", "список", "планировал"]) || t === "запланировано";
  });
}

export function isExists(tokens: Token[]): boolean {
  return tokens.some((x, i) => x.t === "есть" && tokens[i + 1]?.t === "ли");
}

/** The phrase starts with «поставь/добавь/нужно/напомни…» (after «а», «и», «пожалуйста»): then it is a creation. */
export function startsWithCreateVerb(tokens: Token[]): boolean {
  const first = tokens.find((x) => !["а", "и", "пожалуйста", "ну"].includes(x.t));
  return first !== undefined && isCreateVerb(first.t);
}

// --- target words ------------------------------------------------------------

export const FOCUS_PRONOUNS = new Set(["ее", "его", "эту", "этот", "это", "эта", "ту", "тот", "она", "он", "оно"]);

/** Words that never count as search terms or record words. */
export const STOP_WORDS = new Set([
  "я", "мне", "меня", "мной", "мой", "моя", "мое", "мои", "моих", "мою", "мою", "ты", "вы",
  "у", "в", "во", "на", "по", "про", "о", "об", "с", "со", "из", "к", "от", "до", "для", "за", "при", "над",
  "и", "а", "но", "или", "ли", "же", "бы", "то", "ну", "вот", "еще", "уже", "тоже",
  "это", "эту", "этот", "эта", "тот", "ту", "ее", "его", "их", "ей", "ему",
  "найди", "найти", "найдите", "поищи", "ищи", "поискать", "отыщи",
  "когда", "что", "как", "какая", "какой", "какие", "какое", "который", "которую", "которая", "нибудь", "либо",
  "был", "была", "было", "были", "будет", "будут", "раньше", "давно",
  "есть", "пожалуйста", "нужно", "надо", "покажи", "показать",
  "удали", "удалить", "убери", "убрать", "сотри", "отметь", "отметить", "пометь", "выполненной", "выполненную", "выполненным",
  "перенеси", "перенести", "передвинь", "сдвинь", "измени", "время", "дату",
  "все", "всех", "всем", "там", "тут", "должен", "должна", "должны", "должно", "буду", "будем", "мы", "нас", "нам",
]);

export function isStopWord(t: string): boolean {
  return (
    STOP_WORDS.has(t) ||
    t.startsWith("ставил") ||
    t.startsWith("выполн") ||
    t.startsWith("сделан") ||
    t.startsWith("завершен") ||
    t.startsWith("закончен") ||
    UPDATE_IMPERATIVE.has(t) ||
    UPDATE_INFINITIVE.has(t) ||
    MARK_IMPERATIVE.has(t) ||
    MARK_INFINITIVE.has(t) ||
    DELETE_IMPERATIVE.has(t) ||
    DELETE_INFINITIVE.has(t) ||
    t.startsWith("прошл") ||
    t.startsWith("запланирован") ||
    t.startsWith("предстоящ")
  );
}

// --- answers to a question -----------------------------------------------------

const CANCEL_WORDS = new Set(["отмена", "отмени", "отменить", "стоп", "хватит", "забудь", "неважно", "отбой", "пожалуйста"]);
const YES_WORDS = new Set([
  "да", "ага", "угу", "конечно", "давай", "давайте", "ставь", "ставьте", "хорошо", "ок", "окей", "ладно", "верно", "точно",
  "удаляй", "подтверждаю", "согласен", "согласна", "разумеется",
]);
const NO_WORDS = new Set(["нет", "не", "неа"]);
const CONFIRM_FILLERS = new Set(["надо", "нужно", "стоит", "пожалуйста", "все", "равно", "же", "это", "так", "спасибо", "и", "а", "лучше", "пока", "хочу", "ставить", "удалять"]);

export function matchCancel(tokens: Token[]): boolean {
  return tokens.length > 0 && tokens.some((x) => x.t !== "пожалуйста") && tokens.every((x) => CANCEL_WORDS.has(x.t));
}

/** `true` = yes, `false` = no, `undefined` = not a yes/no answer. */
export function matchConfirm(tokens: Token[]): boolean | undefined {
  if (tokens.length === 0 || tokens.length > 5) return undefined;
  const known = tokens.every((x) => YES_WORDS.has(x.t) || NO_WORDS.has(x.t) || CONFIRM_FILLERS.has(x.t));
  if (!known) return undefined;
  if (tokens.some((x) => NO_WORDS.has(x.t))) return false;
  return tokens.some((x) => YES_WORDS.has(x.t)) ? true : undefined;
}

const ORDINALS: Record<string, number> = {
  первый: 1, первая: 1, первую: 1, первое: 1, первого: 1,
  второй: 2, вторая: 2, вторую: 2, второе: 2, второго: 2,
  третий: 3, третья: 3, третью: 3, третье: 3, третьего: 3,
  четвертый: 4, четвертая: 4, четвертую: 4, четвертое: 4, четвертого: 4,
  пятый: 5, пятая: 5, пятую: 5, пятое: 5, пятого: 5,
};
const CHOOSE_FILLERS = new Set(["номер", "под", "пожалуйста", "выбираю", "давай", "давайте", "вот", "эту", "ту", "этот", "тот", "а", "и", "хочу", "пусть", "будет", "первым", "вариант"]);

export function matchChoose(tokens: Token[]): number | undefined {
  let index: number | undefined;
  for (const x of tokens) {
    const value = x.t in ORDINALS ? ORDINALS[x.t] : x.n;
    if (value !== undefined && !x.clock) {
      if (index !== undefined) return undefined;
      index = value;
    } else if (!CHOOSE_FILLERS.has(x.t)) {
      return undefined;
    }
  }
  return index !== undefined && index >= 1 && index <= 99 ? index : undefined;
}
