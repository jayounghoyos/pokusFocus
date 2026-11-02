import { useEffect, useRef, useState, KeyboardEvent } from "react";
import clsx from "clsx";
import { MarkdownView, toggleTaskAtLine, countTasks, countWords } from "../lib/markdown";
import { plural } from "../lib/format";

/**
 * Markdown notes that fill the height they are given (the notes rail).
 * Preview by default when there is something to read, edit when empty.
 */
export function NotesEditor({ value, onChange, taskKey }: {
  value: string; onChange: (next: string) => void; taskKey: string;
}) {
  const [editing, setEditing] = useState(() => !value.trim());
  const ref = useRef<HTMLTextAreaElement>(null);

  // Opening another task's notes resets the mode for that task.
  useEffect(() => { setEditing(!value.trim()); }, [taskKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const counts = countTasks(value);
  const words = countWords(value);
  const status = editing
    ? "Editing · Ctrl+Enter to preview"
    : [words ? plural(words, "word") : null, counts.total ? `${counts.done} of ${counts.total} checked` : null]
        .filter(Boolean).join(" · ") || "Empty";

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); setEditing(false); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      onChange(value.slice(0, start) + "  " + value.slice(el.selectionEnd));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Notes</h3>
        <div className="flex rounded-full bg-raised p-0.5" role="tablist" aria-label="Notes mode">
          {(["Preview", "Edit"] as const).map((m) => {
            const on = (m === "Edit") === editing;
            return (
              <button key={m} role="tab" aria-selected={on} onClick={() => setEditing(m === "Edit")}
                className={clsx("h-6 rounded-full px-3 text-xs transition-colors duration-150",
                  on ? "bg-invert text-on-invert" : "text-muted hover:text-ink")}>{m}</button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 min-h-[160px] flex-1 overflow-y-auto rounded-xl bg-ground/60 px-3.5 py-3">
        {editing ? (
          <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey}
            aria-label="Notes (markdown)"
            placeholder={"# Heading\n**bold** and *italic*\n- a list item\n- [ ] something to do\n- [x] something done"}
            className="h-full min-h-[140px] w-full resize-none bg-transparent text-sm leading-relaxed text-ink placeholder:whitespace-pre placeholder:text-faint focus:outline-none" />
        ) : value.trim() ? (
          <div className="cursor-text" onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest('button[role="checkbox"]') || t.closest("a")) return;
            setEditing(true);
          }}>
            <MarkdownView source={value} onToggleTask={(i) => onChange(toggleTaskAtLine(value, i))} />
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="w-full py-1 text-left text-sm text-muted hover:text-ink">
            Nothing written yet. Click to add notes: headings, lists and - [ ] checkboxes work.
          </button>
        )}
      </div>
      <p className="num mt-2 text-xs text-faint">{status}</p>
    </div>
  );
}
