"use client";

import { formatDateTime } from "@/shared/format";
import type { Panel, RecordDto, RecordKind } from "@/shared/api";
import { BellIcon, CalendarIcon, CheckIcon, CheckSquareIcon } from "./icons";
import { btnSecondary, card, ErrorAlert } from "./ui";

const KIND: Record<RecordKind, { label: string; icon: React.ReactNode }> = {
  task: { label: "Задача", icon: <CheckSquareIcon /> },
  meeting: { label: "Встреча", icon: <CalendarIcon /> },
  reminder: { label: "Напоминание", icon: <BellIcon /> },
};

function today(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(new Date());
}

type Props = {
  panel: Panel;
  loading: boolean;
  error: string | null;
  pendingIds: ReadonlySet<number>;
  onToggle: (record: RecordDto) => void;
  onRetry: () => void;
};

export function RecordsPanel({ panel, loading, error, pendingIds, onToggle, onRetry }: Props) {
  const now = today();
  const hiddenCount = panel.total > panel.items.length;
  return (
    <section aria-label="Записи" aria-busy={loading} className={`${card} flex min-h-0 flex-col lg:max-h-[calc(100dvh-200px)]`}>
      <div className="flex items-center gap-2 rounded-t-card bg-primary-soft px-4 py-3">
        <h2 className="min-w-0 flex-1 break-words text-xl font-semibold">{panel.title || "Записи"}</h2>
        {hiddenCount && (
          <span className="rounded-full bg-surface px-2 text-sm font-semibold" title="Всего записей">
            {panel.items.length} из {panel.total}
          </span>
        )}
      </div>
      {error && (
        <div className="p-3">
          <ErrorAlert
            action={
              <button type="button" className={btnSecondary} onClick={onRetry}>
                Повторить
              </button>
            }
          >
            {error}
          </ErrorAlert>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-card bg-surface-alt" />
            ))}
          </div>
        ) : panel.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="text-muted">
              <CalendarIcon size={40} />
            </span>
            <p>{panel.total === 0 && /ближайш/i.test(panel.title) ? "Записей пока нет" : "Ничего не найдено"}</p>
            <p className="text-sm text-muted">Попросите ассистента создать задачу</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {panel.items.map((record) => {
              const pending = pendingIds.has(record.id);
              const kind = KIND[record.kind];
              return (
                <li
                  key={record.id}
                  className={`flex min-h-14 items-start gap-1 px-2 py-2 hover:bg-surface-alt ${pending ? "opacity-50" : ""}`}
                >
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-6 w-6 accent-primary"
                      checked={record.done}
                      disabled={pending}
                      aria-label={`Отметить выполненной: ${record.title}`}
                      onChange={() => onToggle(record)}
                    />
                  </label>
                  <div className="min-w-0 flex-1 py-2">
                    <p className={`break-words ${record.done ? "text-muted line-through" : ""}`}>{record.title}</p>
                    <p className="text-sm text-muted">
                      {record.date ? formatDateTime(record.date, record.time, now) : "Без срока"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 py-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 text-xs font-semibold">
                      {kind.icon}
                      {kind.label}
                    </span>
                    {record.done && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 text-xs font-semibold text-success">
                        <CheckIcon />
                        Выполнено
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
