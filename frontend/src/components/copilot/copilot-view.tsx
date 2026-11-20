"use client";

import clsx from "clsx";
import { ArrowUp, Info, PanelLeft, Square } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LogoMark } from "@/components/brand";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, isAbort, type ChatMessageOut, type ConversationOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";
import { ConversationList } from "./conversation-list";
import { MessageView, type ChatItem } from "./message";

const STARTERS = [
  "Which of our obligations have no policy coverage?",
  "What changed in the KYC periodic updation rules?",
  "What is due in the next 30 days?",
  "Is the 2019 Fair Practices Code still in force?",
  "How fast must we report a cyber security incident?",
  "Summarise our digital lending gaps and what to fix first.",
];

interface Thread {
  /** Conversation the items belong to (null = a new, unsaved conversation). */
  convId: string | null;
  items: ChatItem[];
  error?: unknown;
  /**
   * While a new conversation's id is being written to the URL, the thread is also shown
   * for its previous URL value, so the answer doesn't blink out mid-stream.
   */
  alias?: string | null;
}

function fromMessage(m: ChatMessageOut): ChatItem {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    citations: Array.isArray(m.citations) ? m.citations : [],
    tools: [],
    status: "done",
  };
}

export function CopilotView() {
  const { get, set } = useUrlState();
  const { aiMode } = useAuth();
  const toast = useToast();
  const activeId = get("c") || null;

  const convs = useQuery<ConversationOut[]>("copilot:conversations", (signal) => api.copilot.conversations({ signal }));
  const [thread, setThread] = useState<Thread>({ convId: null, items: [] });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [draft, setDraft] = useState(() => get("q"));
  const [streaming, setStreaming] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [deleting, setDeleting] = useState<ConversationOut | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const live = useRef<{ ctrl: AbortController | null }>({ ctrl: null });
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);

  // The URL has caught up with a conversation created mid-stream: drop the alias.
  if (thread.alias !== undefined && thread.convId !== null && activeId === thread.convId) {
    setThread({ ...thread, alias: undefined });
  }

  const showing = thread.convId === activeId || (thread.alias !== undefined && thread.alias === activeId);
  const items = showing ? thread.items : [];
  const threadError = showing ? thread.error : undefined;
  const threadLoading = activeId !== null && !showing;

  // Load a saved conversation when the URL points at one we don't already hold.
  const needsLoad = useEffectEvent((id: string) => id !== thread.convId && thread.alias !== id);
  useEffect(() => {
    if (!activeId || !needsLoad(activeId)) return;
    const ctrl = new AbortController();
    api.copilot.conversation(activeId, { signal: ctrl.signal }).then(
      (d) => setThread({ convId: activeId, items: d.messages.map(fromMessage) }),
      (err: unknown) => {
        if (!ctrl.signal.aborted && !isAbort(err)) setThread({ convId: activeId, items: [], error: err });
      },
    );
    return () => ctrl.abort();
  }, [activeId, reloadNonce]);

  // Stop any answer in flight when leaving the page.
  useEffect(() => {
    const holder = live.current;
    return () => holder.ctrl?.abort();
  }, []);

  // Follow the answer as it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [thread, activeId]);

  function stopStream() {
    live.current.ctrl?.abort();
  }

  function selectConversation(id: string) {
    setListOpen(false);
    if (id === activeId) return;
    stopStream();
    stick.current = true;
    set({ c: id, q: null });
  }

  function newConversation() {
    setListOpen(false);
    stopStream();
    setThread({ convId: null, items: [] });
    set({ c: null, q: null });
    composer.current?.focus();
  }

  function retryLoad() {
    setThread({ convId: null, items: [] });
    setReloadNonce((n) => n + 1);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.copilot.remove(deleting.id);
      convs.setData((prev) => (prev ?? []).filter((c) => c.id !== deleting.id));
      if (deleting.id === activeId || deleting.id === thread.convId) {
        stopStream();
        setThread({ convId: null, items: [] });
        set({ c: null });
      }
      toast.success("Conversation deleted");
      setDeleting(null);
    } catch (err) {
      toast.error("Couldn't delete the conversation", errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    const convId = showing ? thread.convId : activeId;
    const stamp = crypto.randomUUID();
    const asstId = `a-${stamp}`;
    const userItem: ChatItem = { id: `u-${stamp}`, role: "user", text: message, citations: [], tools: [], status: "done" };
    const asstItem: ChatItem = { id: asstId, role: "assistant", text: "", citations: [], tools: [], status: "streaming" };
    setThread((t) => ({
      convId,
      items: [...(t.convId === convId ? t.items : []), userItem, asstItem],
      alias: t.convId === convId ? t.alias : undefined,
    }));
    setDraft("");
    setStreaming(true);
    stick.current = true;

    const patch = (fn: (it: ChatItem) => ChatItem) =>
      setThread((t) => ({ ...t, items: t.items.map((it) => (it.id === asstId ? fn(it) : it)) }));

    const ctrl = new AbortController();
    live.current.ctrl = ctrl;
    try {
      for await (const ev of api.copilot.chat({ message, conversation_id: convId }, ctrl.signal)) {
        switch (ev.type) {
          case "conversation":
            if (ev.id !== convId) {
              setThread((t) => (t.convId === ev.id ? t : { ...t, convId: ev.id, alias: t.convId }));
              set({ c: ev.id, q: null });
              const now = new Date().toISOString();
              convs.setData((prev) => [
                { id: ev.id, title: ev.title, created_at: now, updated_at: now },
                ...(prev ?? []).filter((c) => c.id !== ev.id),
              ]);
            }
            break;
          case "text":
            patch((it) => ({ ...it, text: it.text + ev.text }));
            break;
          case "tool":
            patch((it) => ({ ...it, tools: [...it.tools, { name: ev.name, input: ev.input ?? {} }] }));
            break;
          case "citations":
            patch((it) => ({ ...it, citations: ev.citations ?? [] }));
            break;
          case "error":
            patch((it) => ({ ...it, status: "error", error: ev.message }));
            break;
          case "done":
            break;
        }
      }
      patch((it) => (it.status === "streaming" ? { ...it, status: "done" } : it));
    } catch (err) {
      if (ctrl.signal.aborted || isAbort(err)) {
        patch((it) => (it.status === "streaming" ? { ...it, status: "stopped" } : it));
      } else {
        const msg =
          err instanceof ApiError && err.status === 404
            ? "This conversation no longer exists. Start a new one."
            : errorMessage(err);
        patch((it) => (it.status === "error" ? it : { ...it, status: "error", error: msg }));
      }
    } finally {
      if (live.current.ctrl === ctrl) live.current.ctrl = null;
      setStreaming(false);
      convs.reload();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  }

  const activeTitle =
    convs.data?.find((c) => c.id === (activeId ?? thread.convId))?.title ??
    (activeId ? "Conversation" : "New conversation");
  const empty = !threadLoading && !threadError && items.length === 0;

  const list = (
    <ConversationList
      items={convs.data}
      loading={convs.loading}
      error={convs.error}
      onRetry={convs.reload}
      activeId={activeId ?? thread.convId}
      onSelect={selectConversation}
      onNew={newConversation}
      onDelete={setDeleting}
    />
  );

  return (
    <div className="relative flex h-[calc(100dvh-76px)] min-h-[480px] gap-6 px-4 pb-6 sm:px-8">
      <title>Copilot · Obligraph</title>

      <aside className="hidden w-[290px] shrink-0 overflow-hidden rounded-card card lg:block">{list}</aside>
      {listOpen && (
        <div className="absolute inset-0 z-20 flex lg:hidden">
          <div className="overlay w-[300px] max-w-[85%] overflow-hidden rounded-r-[30px]">{list}</div>
          <button type="button" aria-label="Close conversations" className="flex-1 bg-[rgb(30_38_56/0.3)]" onClick={() => setListOpen(false)} />
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card card">
        <header className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-7">
          <IconButton label="Show conversations" size="sm" tone="soft" className="lg:hidden" onClick={() => setListOpen(true)}>
            <PanelLeft size={16} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">Copilot</p>
            <h1 className="display truncate text-[18px] leading-snug">{activeTitle}</h1>
          </div>
          {streaming && (
            <Button size="sm" variant="secondary" icon={<Square size={12} />} onClick={stopStream}>
              Stop
            </Button>
          )}
        </header>

        {aiMode === "offline" && (
          <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-[18px] bg-surface-2 px-4 py-3 text-[12.5px] text-ink-2 sm:mx-7">
            <Info size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
            <p>
              <span className="font-medium text-ink">Offline mode.</span> Claude isn&rsquo;t configured, so answers are
              retrieval summaries: the most relevant regulations, your obligations and policy passages, without a written
              analysis.
            </p>
          </div>
        )}

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[780px] px-4 py-6 sm:px-6">
            {threadLoading && <LoadingBlock label="Loading conversation…" />}
            {threadError != null && (
              <ErrorState
                error={threadError}
                onRetry={threadError instanceof ApiError && threadError.status === 404 ? undefined : retryLoad}
                title={threadError instanceof ApiError && threadError.status === 404 ? "This conversation was deleted" : undefined}
              />
            )}
            {threadError != null && (
              <div className="-mt-6 flex justify-center">
                <Button size="sm" variant="ghost" onClick={newConversation}>
                  Start a new conversation
                </Button>
              </div>
            )}
            {empty && (
              <div className="py-6 sm:py-10">
                <LogoMark size={44} />
                <h2 className="display mt-5 text-[24px] leading-tight">Ask about your regulations and obligations</h2>
                <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-2">
                  Copilot searches the regulatory corpus, traces amendments and supersessions, and checks your obligations,
                  tasks and policies. Every answer lists its sources.
                </p>
                <p className="mb-3 mt-8 text-[12.5px] font-medium text-ink-3">Try asking</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {STARTERS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => void send(q)}
                        className="h-full w-full rounded-[20px] card-xs px-4 py-3.5 text-left text-[13px] text-ink transition-[box-shadow,color,transform] hover:-translate-y-px hover:text-accent hover:shadow-card"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {items.length > 0 && (
              <div className="space-y-6">
                {items.map((it) => (
                  <MessageView key={it.id} item={it} />
                ))}
              </div>
            )}
          </div>
        </div>

        <form
          className="px-4 pb-5 pt-3 sm:px-7"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <div className="mx-auto flex w-full max-w-[780px] items-end gap-2 rounded-[24px] border border-[var(--field-border)] bg-field py-2 pl-5 pr-2 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[var(--),var(--focus-ring)]">
            <label htmlFor="copilot-input" className="sr-only">
              Ask Copilot
            </label>
            <textarea
              id="copilot-input"
              ref={composer}
              rows={1}
              value={draft}
              disabled={streaming}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={streaming ? "Copilot is answering…" : "Ask about a circular, a deadline or a coverage gap"}
              className="max-h-48 min-h-[24px] flex-1 resize-none self-center bg-transparent py-1.5 text-[14px] leading-6 outline-none [field-sizing:content] placeholder:text-ink-3 focus-visible:outline-none disabled:opacity-60"
            />
            {streaming ? (
              <IconButton label="Stop answering" tone="soft" onClick={stopStream}>
                <Square size={12} />
              </IconButton>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                className={clsx(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-[box-shadow,background-color]",
                  draft.trim() ? "bg-primary text-white" : "bg-surface-3 text-ink-3",
                )}
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="mx-auto mt-2 hidden max-w-[780px] px-5 text-[11px] text-ink-3 sm:block">
            Enter to send · Shift+Enter for a new line · Check cited sources before acting on an answer.
          </p>
        </form>
      </section>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title="Delete conversation?"
        confirmLabel="Delete conversation"
      >
        <p>
          &ldquo;{deleting?.title}&rdquo; and its answers will be removed for good. Regulations and obligations it cited are
          not affected.
        </p>
      </ConfirmDialog>
    </div>
  );
}
