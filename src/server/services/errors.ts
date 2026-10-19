/** Business errors the API maps to `{ error: { code, message } }` (docs/architecture.md §10). Messages are for the user. */
export type ServiceErrorCode = "invalid_input" | "not_found" | "limit_reached" | "rate_limited";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}
