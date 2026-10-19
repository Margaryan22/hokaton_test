/** API DTOs shared by the server and the client (docs/architecture.md §4). No server imports here. */

export type RecordKind = "task" | "meeting" | "reminder";

export type RecordDto = {
  id: number;
  kind: RecordKind;
  title: string;
  /** Moscow day, `YYYY-MM-DD`, or null. */
  date: string | null;
  /** Moscow wall-clock time, `HH:mm`, or null. */
  time: string | null;
  done: boolean;
};

export type MessageDto = {
  id: number;
  role: "user" | "assistant";
  text: string;
  items: RecordDto[] | null;
  createdAt: string;
};

/** The right-hand column «Записи». */
export type Panel = { title: string; items: RecordDto[]; total: number };

/** What the assistant waits for after this reply. */
export type Awaiting = "slot" | "yes_no" | "choice" | "target" | null;

export type ChatResponse = { messages: [MessageDto, MessageDto]; panel: Panel; awaiting: Awaiting };

export type UserDto = { id: number; name: string };
export type UsersResponse = { users: UserDto[] };
export type SessionResponse = { user: UserDto | null };
export type DialogResponse = { messages: MessageDto[]; awaiting: Awaiting; panel: Panel };
export type RecordResponse = { record: RecordDto };
export type OkResponse = { ok: true };

export type ApiErrorCode = "invalid_input" | "no_user" | "not_found" | "rate_limited" | "internal";
export type ApiError = { error: { code: ApiErrorCode; message: string } };
