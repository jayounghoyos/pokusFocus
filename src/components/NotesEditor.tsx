import { useLayoutEffect, useRef, useState, KeyboardEvent, ReactNode } from "react";
import clsx from "clsx";
import { MarkdownView, toggleTaskAtLine, countTasks, countWords } from "../lib/markdown";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function NotesEditor({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onToggleTask = (lineIdx: number) => onChange(toggleTaskAtLine(value, lineIdx));

  const counts = countTasks(value);
  const words = countWords(value);

  const statusBits: string[] = [];
  if (editing) {
    statusBits.push("Editing");
    statusBits.push("Ctrl+Enter to preview");
  } else {
    if (words > 0) statusBits.push(`${words} word${words === 1 ? "" : "s"}`);
    if (counts.total > 0) statusBits.push(`${counts.done}/${counts.total} done`);
    if (words === 0 && counts.total === 0) statusBits.push("Click to add notes");
  }

  const headerActions = (
    <div className="flex items-center gap-1">
      <ToggleButton
        active={!editing}
        onClick={() => setEditing(false)}
        title="Preview"
        aria-label="Preview"
      >
        <EyeIcon />
      </ToggleButton>
      <ToggleButton
        active={editing}
        onClick={() => setEditing(true)}
        title="Edit"
        aria-label="Edit"
      >
        <PencilIcon />
      </ToggleButton>
      <div className="w-px h-4 bg-zinc-800 mx-0.5" aria-hidden />
      <ToggleButton
        onClick={() => {
          setExpanded(true);
          setEditing(true);
        }}
        title="Expand"
        aria-label="Expand"
      >
        <ExpandIcon />
      </ToggleButton>
    </div>
  );

  const body = editing ? (
    <Editor
      value={value}
      onChange={onChange}
      onDone={() => setEditing(false)}
      mode={expanded ? "modal" : "inline"}
      autoFocus
    />
  ) : (
    <PreviewPane
      value={value}
      onClickToEdit={() => setEditing(true)}
      onToggleTask={onToggleTask}
    />
  );

  if (expanded) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-8 animate-fade-in"
        onClick={() => setExpanded(false)}
      >
        <div
          className="w-full max-w-3xl h-[85vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl animate-scale-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
              Notes
            </h2>
            <div className="flex items-center gap-3">
              {headerActions}
              <button
                onClick={() => setExpanded(false)}
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none ml-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-4">{body}</div>
          <footer className="px-5 py-2 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>{statusBits.join(" · ")}</span>
            <span className="text-zinc-700">Esc to close</span>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Notes</p>
        {headerActions}
      </div>
      {body}
      <p className="mt-2 text-[10px] text-zinc-600 tracking-wide">
        {statusBits.join(" · ")}
      </p>
    </div>
  );
}

function Editor({
  value,
  onChange,
  onDone,
  mode,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  onDone: () => void;
  mode: "inline" | "modal";
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    if (mode === "inline") {
      el.style.height = Math.max(96, Math.min(el.scrollHeight, 480)) + "px";
    } else {
      el.style.height = Math.max(el.scrollHeight, 480) + "px";
    }
  }, [value, mode]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onDone();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onDone();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKey}
      autoFocus={autoFocus}
      placeholder={`# Heading\n**bold** and *italic*\n- bullet list\n- [ ] task to do\n- [x] done task`}
      className={clsx(
        "w-full bg-transparent text-sm text-zinc-200",
        "placeholder:text-zinc-700 placeholder:whitespace-pre",
        "focus:outline-none resize-none leading-relaxed font-sans",
      )}
    />
  );
}

function PreviewPane({
  value,
  onClickToEdit,
  onToggleTask,
}: {
  value: string;
  onClickToEdit: () => void;
  onToggleTask: (idx: number) => void;
}) {
  if (!value.trim()) {
    return (
      <button
        onClick={onClickToEdit}
        className="w-full text-left text-sm italic text-zinc-600 hover:text-zinc-400 transition-colors py-2"
      >
        Click to add notes — supports markdown (# headings, **bold**, - lists, - [ ] tasks)
      </button>
    );
  }
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button[role="checkbox"]') || target.closest("a")) return;
        onClickToEdit();
      }}
      className="cursor-text"
    >
      <MarkdownView source={value} onToggleTask={onToggleTask} />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  title,
  children,
  ...rest
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      {...rest}
      className={clsx(
        "h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500",
        "hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors",
        active && "text-zinc-100 bg-zinc-800/60",
      )}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

