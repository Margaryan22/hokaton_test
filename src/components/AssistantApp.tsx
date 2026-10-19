"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ApiRequestError,
  getDialog,
  getRecords,
  getSession,
  getUsers,
  resetDialog,
  selectUser,
  sendChat,
  setRecordDone,
} from "@/client/api";
import { readSound, subscribeSound, writeSound } from "@/client/preferences";
import { speak, stopSpeaking } from "@/client/speech/synthesis";
import type { Awaiting, MessageDto, Panel, RecordDto, UserDto } from "@/shared/api";
import { Composer } from "./Composer";
import { DialogFeed } from "./DialogFeed";
import { SpeakerIcon } from "./icons";
import { RecordsPanel } from "./RecordsPanel";
import { UserSwitcher } from "./UserSwitcher";
import { btnSecondary, card, ErrorAlert } from "./ui";

const EMPTY_PANEL: Panel = { title: "Ближайшие", items: [], total: 0 };
const NO_USER = "Выберите пользователя или введите новое имя";

type Phase = "loading" | "ready" | "error";

type Snapshot = { users: UserDto[]; user: UserDto | null; messages: MessageDto[]; awaiting: Awaiting; panel: Panel };

/** Session, users and dialog in one go; null when the server cannot be read. */
async function fetchSnapshot(): Promise<Snapshot | null> {
  try {
    const [{ user }, { users }] = await Promise.all([getSession(), getUsers()]);
    if (!user) return { users, user, messages: [], awaiting: null, panel: EMPTY_PANEL };
    const dialog = await getDialog();
    return { users, user, messages: dialog.messages, awaiting: dialog.awaiting, panel: dialog.panel };
  } catch {
    return null;
  }
}

export function AssistantApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<UserDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [awaiting, setAwaiting] = useState<Awaiting>(null);
  const [panel, setPanel] = useState<Panel>(EMPTY_PANEL);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<number>>(new Set());
  const soundOn = useSyncExternalStore(subscribeSound, readSound, () => true);
  const soundRef = useRef(soundOn);
  useEffect(() => {
    soundRef.current = soundOn;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((snap: Snapshot | null) => {
    if (!snap) {
      setPhase("error");
      return;
    }
    setUsers(snap.users);
    setUser(snap.user);
    setMessages(snap.messages);
    setAwaiting(snap.awaiting);
    setPanel(snap.panel);
    setPanelError(null);
    setPhase("ready");
  }, []);

  const loadAll = useCallback(async () => apply(await fetchSnapshot()), [apply]);

  useEffect(() => {
    let cancelled = false;
    void fetchSnapshot().then((snap) => {
      if (!cancelled) apply(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingText, phase]);

  /** Marks rows that are new or changed compared with the current panel for 2 seconds. */
  function highlight(ids: number[]) {
    if (ids.length === 0) return;
    setHighlightIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setHighlightIds((prev) => {
        const rest = new Set(prev);
        ids.forEach((id) => rest.delete(id));
        return rest;
      });
    }, 2000);
  }

  function changedIds(next: Panel): number[] {
    const before = new Map(panel.items.map((r) => [r.id, JSON.stringify(r)]));
    return next.items.filter((r) => before.get(r.id) !== JSON.stringify(r)).map((r) => r.id);
  }

  async function reload() {
    setPhase("loading");
    await loadAll();
  }

  async function switchUser(name: string): Promise<string | null> {
    try {
      const { user: picked } = await selectUser(name);
      stopSpeaking();
      setPhase("loading");
      await loadAll();
      if (picked) {
        setFlash(`Пользователь: ${picked.name}`);
        setTimeout(() => setFlash(null), 4000);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Не удалось выбрать пользователя";
    }
  }

  async function send(text: string): Promise<boolean> {
    setPendingText(text);
    setSendError(null);
    try {
      const reply = await sendChat(text);
      setMessages((prev) => [...prev, ...reply.messages]);
      setAwaiting(reply.awaiting);
      if (panel.title === reply.panel.title) highlight(changedIds(reply.panel));
      setPanel(reply.panel);
      setPanelError(null);
      if (soundRef.current) speak(reply.messages[1].text);
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setUser(null);
        setSendError(NO_USER);
      } else {
        setSendError("Не удалось отправить. Повторите.");
      }
      return false;
    } finally {
      setPendingText(null);
    }
  }

  async function startNewDialog() {
    try {
      await resetDialog();
      stopSpeaking();
      await reload();
    } catch {
      setSendError("Не удалось начать новый диалог. Повторите.");
    }
  }

  async function toggleDone(record: RecordDto) {
    const next = !record.done;
    setPendingIds((prev) => new Set(prev).add(record.id));
    setPanelError(null);
    try {
      const { record: saved } = await setRecordDone(record.id, next);
      setPanel((prev) => ({ ...prev, items: prev.items.map((r) => (r.id === saved.id ? saved : r)) }));
      highlight([saved.id]);
    } catch {
      setPanelError("Не удалось обновить запись");
    } finally {
      setPendingIds((prev) => {
        const rest = new Set(prev);
        rest.delete(record.id);
        return rest;
      });
    }
  }

  async function refreshPanel() {
    try {
      setPanel(await getRecords());
      setPanelError(null);
    } catch {
      setPanelError("Не удалось обновить записи");
    }
  }

  const loading = phase === "loading";
  const noUser = phase === "ready" && !user;
  const chatDisabled = loading || !user;

  return (
    <div className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Голосовой ассистент</h1>
        <div className="flex flex-wrap items-center gap-2">
          {user && <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold">{user.name}</span>}
          <button
            type="button"
            aria-pressed={soundOn}
            onClick={() => {
              if (soundOn) stopSpeaking();
              writeSound(!soundOn);
            }}
            className={`${btnSecondary} ${soundOn ? "!border-primary !bg-primary-soft !text-primary" : ""}`}
          >
            <SpeakerIcon on={soundOn} />
            {soundOn ? "Звук: вкл" : "Звук: выкл"}
          </button>
          <button type="button" className={btnSecondary} disabled={chatDisabled} onClick={() => void startNewDialog()}>
            Новый диалог
          </button>
        </div>
      </header>

      {phase === "error" && (
        <div className="mb-4">
          <ErrorAlert
            action={
              <button type="button" className={btnSecondary} onClick={() => void reload()}>
                Повторить
              </button>
            }
          >
            Не удалось загрузить данные. Обновите страницу.
          </ErrorAlert>
        </div>
      )}
      {flash && (
        <p role="status" className="mb-4 rounded-card bg-success-soft p-3 text-sm font-semibold text-success">
          {flash}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6">
        <div className="lg:col-start-2 lg:row-start-1">
          <UserSwitcher users={users} user={user} disabled={loading} onSwitch={switchUser} />
        </div>

        <section
          aria-label="Диалог с ассистентом"
          className={`${card} flex h-[min(75dvh,600px)] flex-col sm:h-[60dvh] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-200px)] lg:min-h-[480px]`}
        >
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 pt-6 [mask-image:linear-gradient(to_bottom,transparent,black_20px)]">
            <DialogFeed
              messages={messages}
              pendingText={pendingText}
              awaiting={awaiting}
              loading={loading}
              disabled={chatDisabled || pendingText !== null}
              onQuickReply={(text) => void send(text)}
            />
          </div>
          <Composer
            disabled={chatDisabled}
            disabledReason={noUser ? NO_USER : null}
            busy={pendingText !== null}
            error={sendError}
            onSend={send}
          />
        </section>

        <div className="lg:col-start-2 lg:row-start-2 lg:self-start">
          <RecordsPanel
            panel={panel}
            loading={loading}
            error={panelError}
            pendingIds={pendingIds}
            highlightIds={highlightIds}
            onToggle={(r) => void toggleDone(r)}
            onRetry={() => void refreshPanel()}
          />
        </div>
      </div>
    </div>
  );
}
