"use client";

import { useId, useState, type FormEvent } from "react";
import type { UserDto } from "@/shared/api";
import { AlertIcon, Spinner } from "./icons";
import { btnSecondary, card } from "./ui";

type Props = {
  users: UserDto[];
  user: UserDto | null;
  disabled: boolean;
  /** Resolves to an error message, or null on success. */
  onSwitch: (name: string) => Promise<string | null>;
};

const inputClass =
  "min-h-11 w-full rounded-card border border-border-strong bg-surface px-3 text-base text-text placeholder:text-muted";

export function UserSwitcher({ users, user, disabled, onSwitch }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function run(target: string): Promise<boolean> {
    setBusy(true);
    const result = await onSwitch(target);
    setBusy(false);
    setError(result);
    return result === null;
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (await run(name.trim())) setName("");
  }

  return (
    <section aria-label="Пользователи" className={`${card} flex flex-col gap-3 p-4`}>
      {!user && (
        <p className="rounded-card bg-primary-soft p-3 text-sm font-semibold">
          Выберите пользователя или введите новое имя
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="user-select" className="text-sm font-semibold">
          Пользователь
        </label>
        <select
          id="user-select"
          className={inputClass}
          value={user ? String(user.id) : ""}
          disabled={disabled || busy}
          onChange={(e) => {
            const picked = users.find((u) => String(u.id) === e.target.value);
            if (picked) void run(picked.name);
          }}
        >
          {!user && (
            <option value="" disabled>
              Не выбран
            </option>
          )}
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={create} className="flex flex-col gap-1">
        <label htmlFor="new-name" className="text-sm font-semibold">
          Новое имя
        </label>
        <div className="flex gap-2">
          <input
            id="new-name"
            className={`${inputClass} min-w-0 flex-1 ${error ? "border-danger" : ""}`}
            value={name}
            maxLength={40}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            className={`${btnSecondary} shrink-0`}
            disabled={disabled || busy || name.trim() === ""}
            aria-busy={busy}
          >
            {busy && <Spinner />}
            Создать
          </button>
        </div>
        {error && (
          <p id={errorId} className="flex items-center gap-1 text-sm text-danger">
            <AlertIcon />
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
