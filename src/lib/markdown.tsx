import { ReactNode } from "react";
import clsx from "clsx";
import { Check } from "../components/Check";

/** Render inline-level markdown: **bold**, *italic*, `code`, [text](url). */
function renderInline(text: string): ReactNode {
  const tokens: ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    let m: RegExpMatchArray | null;
    if ((m = remaining.match(/^\*\*([^*\n]+)\*\*/))) {
      tokens.push(<strong key={key++} className="font-semibold text-zinc-100">{m[1]}</strong>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    if ((m = remaining.match(/^\*([^*\n]+)\*/))) {
      tokens.push(<em key={key++} className="italic">{m[1]}</em>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    if ((m = remaining.match(/^`([^`\n]+)`/))) {
      tokens.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-zinc-800 text-[0.85em] font-mono text-zinc-200">
          {m[1]}
        </code>,
      );
      remaining = remaining.slice(m[0].length);
      continue;
    }
    if ((m = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/))) {
      tokens.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer" className="text-focus-work hover:underline">
          {m[1]}
        </a>,
      );
      remaining = remaining.slice(m[0].length);
      continue;
    }
    const nextSpecial = remaining.search(/[*`[]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    }
    if (nextSpecial > 0) {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }
  return tokens.length === 1 ? tokens[0] : tokens;
}

export function MarkdownView({
  source,
  onToggleTask,
}: {
  source: string;
  onToggleTask: (lineIdx: number) => void;
}) {
  const lines = source.split("\n");
  const result: ReactNode[] = [];
  let bulletBuf: ReactNode[] = [];
  let bulletStartKey = 0;

  const flushBullets = () => {
    if (bulletBuf.length) {
      result.push(
        <ul key={`ul-${bulletStartKey}`} className="list-disc pl-5 my-1 space-y-0.5 marker:text-zinc-600">
          {bulletBuf}
        </ul>,
      );
      bulletBuf = [];
    }
  };

  lines.forEach((line, i) => {
    const taskMatch = line.match(/^(\s*)- \[([ xX])\] (.*)$/);
    if (taskMatch) {
      flushBullets();
      const [, indent, mark, text] = taskMatch;
      const done = mark.toLowerCase() === "x";
      const indentLevel = Math.floor(indent.length / 2);
      result.push(
        <div
          key={i}
          className={clsx("flex items-start gap-2 my-0.5", indentLevel > 0 && "ml-5")}
        >
          <span className="pt-[3px]">
            <Check
              checked={done}
              onChange={() => onToggleTask(i)}
              size={14}
              ariaLabel={done ? "Uncheck task" : "Check task"}
            />
          </span>
          <span className={clsx("flex-1 text-sm leading-relaxed", done && "line-through text-zinc-500")}>
            {renderInline(text)}
          </span>
        </div>,
      );
      return;
    }
    const bulletMatch = line.match(/^(\s*)- (.+)$/);
    if (bulletMatch) {
      if (bulletBuf.length === 0) bulletStartKey = i;
      bulletBuf.push(
        <li key={i} className="text-sm text-zinc-300 leading-relaxed">
          {renderInline(bulletMatch[2])}
        </li>,
      );
      return;
    }
    flushBullets();
    if (line.startsWith("### ")) {
      result.push(
        <h4 key={i} className="text-sm font-semibold mt-3 mb-1 text-zinc-100">
          {renderInline(line.slice(4))}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      result.push(
        <h3 key={i} className="text-base font-semibold mt-3 mb-1.5 text-zinc-100">
          {renderInline(line.slice(3))}
        </h3>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      result.push(
        <h2 key={i} className="text-lg font-semibold mt-3.5 mb-1.5 text-zinc-100">
          {renderInline(line.slice(2))}
        </h2>,
      );
      return;
    }
    if (!line.trim()) {
      result.push(<div key={i} className="h-2" />);
      return;
    }
    result.push(
      <p key={i} className="text-sm leading-relaxed text-zinc-300 my-0.5">
        {renderInline(line)}
      </p>,
    );
  });
  flushBullets();
  return <>{result}</>;
}

export function toggleTaskAtLine(source: string, lineIdx: number): string {
  const lines = source.split("\n");
  if (lineIdx < 0 || lineIdx >= lines.length) return source;
  const m = lines[lineIdx].match(/^(\s*- \[)([ xX])(\].*)$/);
  if (!m) return source;
  const next = m[2].toLowerCase() === "x" ? " " : "x";
  lines[lineIdx] = `${m[1]}${next}${m[3]}`;
  return lines.join("\n");
}

export function countTasks(source: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*- \[([ xX])\] /);
    if (m) {
      total++;
      if (m[1].toLowerCase() === "x") done++;
    }
  }
  return { done, total };
}

export function countWords(source: string): number {
  const trimmed = source.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
