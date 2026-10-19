import { describe, expect, it } from "vitest";
import { ChatRequestSchema, RecordIdSchema, RecordPatchSchema, SessionRequestSchema } from "./schemas";

describe("ChatRequestSchema", () => {
  it("trims the text", () => {
    expect(ChatRequestSchema.parse({ text: "  привет  " }).text).toBe("привет");
  });
  it("rejects empty and too long text", () => {
    expect(ChatRequestSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ text: "а".repeat(501) }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ text: "а".repeat(500) }).success).toBe(true);
  });
  it("gives a Russian message", () => {
    const result = ChatRequestSchema.safeParse({ text: "" });
    expect(result.success ? "" : result.error.issues[0]?.message).toBe("Введите запрос");
  });
});

describe("SessionRequestSchema", () => {
  it("trims and limits the name to 40 characters", () => {
    expect(SessionRequestSchema.parse({ name: " Анна " }).name).toBe("Анна");
    expect(SessionRequestSchema.safeParse({ name: "" }).success).toBe(false);
    expect(SessionRequestSchema.safeParse({ name: "а".repeat(41) }).success).toBe(false);
  });
});

describe("RecordPatchSchema", () => {
  it("accepts only done:boolean", () => {
    expect(RecordPatchSchema.safeParse({ done: true }).success).toBe(true);
    expect(RecordPatchSchema.safeParse({ done: "yes" }).success).toBe(false);
    expect(RecordPatchSchema.safeParse({ done: true, title: "x" }).success).toBe(false);
    expect(RecordPatchSchema.safeParse({ done: true, userId: 2 }).success).toBe(false);
  });
});

describe("RecordIdSchema", () => {
  it("coerces positive integers only", () => {
    expect(RecordIdSchema.parse("12")).toBe(12);
    expect(RecordIdSchema.safeParse("0").success).toBe(false);
    expect(RecordIdSchema.safeParse("1.5").success).toBe(false);
    expect(RecordIdSchema.safeParse("abc").success).toBe(false);
  });
});
