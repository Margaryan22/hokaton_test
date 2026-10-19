import type { ReactNode } from "react";
import { AlertIcon } from "./icons";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-border-strong bg-surface px-4 font-semibold text-text hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50";

export const card = "rounded-card bg-surface shadow-card border border-border";

export function ErrorAlert({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-card border border-danger bg-danger-soft p-3 text-sm text-danger"
    >
      <AlertIcon />
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {action}
    </div>
  );
}
