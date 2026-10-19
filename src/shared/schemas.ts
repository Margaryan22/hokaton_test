import { z } from "zod";

/** Zod inputs of the HTTP API. Messages are shown to the user, so they are in Russian. */

export const ChatRequestSchema = z.object({
  text: z
    .string({ error: "Введите запрос" })
    .trim()
    .min(1, { error: "Введите запрос" })
    .max(500, { error: "Запрос слишком длинный (не больше 500 символов)" }),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const SessionRequestSchema = z.object({
  name: z
    .string({ error: "Введите имя" })
    .trim()
    .min(1, { error: "Введите имя" })
    .max(40, { error: "Имя слишком длинное (не больше 40 символов)" }),
});
export type SessionRequest = z.infer<typeof SessionRequestSchema>;

/** PATCH /api/records/[id]: only the done flag can be changed; unknown keys (userId, title…) are rejected. */
export const RecordPatchSchema = z.strictObject({
  done: z.boolean({ error: "Некорректные данные" }),
});
export type RecordPatch = z.infer<typeof RecordPatchSchema>;

export const RecordIdSchema = z.coerce.number({ error: "Некорректные данные" }).int({ error: "Некорректные данные" }).positive({ error: "Некорректные данные" });
