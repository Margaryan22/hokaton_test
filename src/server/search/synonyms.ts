/** Groups of stems that mean the same for search (weight 0.6, ADR-005). Stems are Snowball stems after ё -> е. */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["отчет", "доклад"],
  ["договор", "контракт"],
  ["созвон", "звонок", "звон", "встреч"],
  ["презентац", "слайд"],
  ["бюджет", "смет"],
];

const GROUP_OF = new Map<string, number>();
SYNONYM_GROUPS.forEach((group, index) => group.forEach((s) => GROUP_OF.set(s, index)));

export function areSynonyms(a: string, b: string): boolean {
  const ga = GROUP_OF.get(a);
  return ga !== undefined && ga === GROUP_OF.get(b);
}
