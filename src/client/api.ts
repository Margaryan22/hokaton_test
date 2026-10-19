import type {
  ChatResponse,
  DialogResponse,
  OkResponse,
  Panel,
  RecordResponse,
  SessionResponse,
  UsersResponse,
} from "@/shared/api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiRequestError("Нет связи с сервером", 0, "network");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiRequestError(error?.message ?? "Ошибка сервера", response.status, error?.code ?? "internal");
  }
  return body as T;
}

const post = (path: string, data?: unknown) =>
  ({ method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }) satisfies RequestInit;

export const getSession = () => request<SessionResponse>("/api/session");
export const getUsers = () => request<UsersResponse>("/api/users");
export const selectUser = (name: string) => request<SessionResponse>("/api/session", post("/api/session", { name }));
export const getDialog = () => request<DialogResponse>("/api/dialog");
export const sendChat = (text: string) => request<ChatResponse>("/api/chat", post("/api/chat", { text }));
export const resetDialog = () => request<OkResponse>("/api/dialog/reset", post("/api/dialog/reset"));
export const getRecords = () => request<Panel>("/api/records");
export const setRecordDone = (id: number, done: boolean) =>
  request<RecordResponse>(`/api/records/${id}`, { method: "PATCH", body: JSON.stringify({ done }) });
