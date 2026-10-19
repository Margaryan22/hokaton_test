import { z } from "zod";
import type { Expect } from "../nlu/types";

// ADR-003: the dialog state lives in dialog_states.state_json and is validated on every read.

const KindSchema = z.enum(["task", "meeting", "reminder"]);

/** A record being collected from the user's answers. */
export const DraftSchema = z.object({
  kind: KindSchema,
  title: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  hasDeadline: z.boolean(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const MissingSchema = z.enum(["title", "date", "time"]);
export type Missing = z.infer<typeof MissingSchema>;

/** The change waiting for the user's «да» after a conflict warning. */
export const WriteSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), draft: DraftSchema }),
  z.object({ type: z.literal("update"), recordId: z.number().int(), date: z.string().nullable(), time: z.string().nullable() }),
]);
export type Write = z.infer<typeof WriteSchema>;

export const OpSchema = z.enum(["delete", "complete", "update"]);
export type Op = z.infer<typeof OpSchema>;

const ChangeSchema = z.object({ date: z.string().optional(), time: z.string().optional() });

export const DialogStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("idle") }),
  z.object({ kind: z.literal("await_slot"), draft: DraftSchema, missing: z.array(MissingSchema) }),
  z.object({ kind: z.literal("await_conflict"), write: WriteSchema, conflictIds: z.array(z.number().int()) }),
  z.object({ kind: z.literal("await_delete"), recordId: z.number().int() }),
  z.object({
    kind: z.literal("await_choice"),
    op: OpSchema,
    candidateIds: z.array(z.number().int()).min(1).max(5),
    change: ChangeSchema.optional(),
  }),
  z.object({ kind: z.literal("await_target"), op: OpSchema, change: ChangeSchema.optional() }),
]);
export type DialogState = z.infer<typeof DialogStateSchema>;

export const IDLE: DialogState = { kind: "idle" };

/** A damaged or outdated state falls back to idle. */
export function parseState(json: string | null | undefined): DialogState {
  if (!json) return IDLE;
  try {
    const parsed = DialogStateSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : IDLE;
  } catch {
    return IDLE;
  }
}

/** What the parser should expect from the next utterance. */
export function expectOf(state: DialogState): Expect {
  switch (state.kind) {
    case "await_slot":
      return "slot";
    case "await_conflict":
    case "await_delete":
      return "yes_no";
    case "await_choice":
      return "choice";
    case "await_target":
      return "target";
    default:
      return null;
  }
}
