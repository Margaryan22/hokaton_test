# Zod 4 — validating API input

## Version and sources
- zod 4.6.7. Import: `import { z } from "zod";`
- https://zod.dev/api, https://zod.dev/error-formatting, https://zod.dev/v4/changelog

## How we use it here
- Request schemas live in `src/shared/schemas.ts` (backend owns; the client may import them for types). Route handlers `safeParse` the body/query; services receive typed data.
- The dialog state read from `dialog_states.state_json` is validated with `DialogStateSchema` (ADR-003); invalid → reset to `idle`.

## Do
- ```ts
  export const ChatRequestSchema = z.object({
    text: z.string().trim().min(1, { error: "Введите запрос" }).max(500),
  });
  export type ChatRequest = z.infer<typeof ChatRequestSchema>;

  const parsed = ChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Некорректные данные" } }, { status: 400 });
  }
  ```
- Names: `z.string().trim().min(1).max(40)` (user names, AC-20).
- Ids from the URL: `z.coerce.number().int().positive()`.
- Enums: `z.enum(["task", "meeting", "reminder"])`; dates `z.iso.date()` (YYYY-MM-DD), instants `z.iso.datetime({ offset: true })`.
- Use `z.strictObject` where unknown keys must be rejected (e.g. PATCH bodies).

## Don't
- Zod 3 APIs: no `message:` param (use `error:`), no `z.nativeEnum` (use `z.enum`), no `.flatten()` on errors (use `z.flattenError(err)` if needed), no `z.string().email()` style formats (top-level `z.email()` etc.).
- Don't trust a client-provided `userId` field — schemas for records never contain it.
- Don't `parse` (throws) in handlers; use `safeParse` and return 400.

## Testing
- Unit-test non-trivial schemas (trim, empty, too long). Handlers are covered by e2e.
