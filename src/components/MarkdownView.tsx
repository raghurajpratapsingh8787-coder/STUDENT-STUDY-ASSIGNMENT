import type { ReactNode } from 'react';

function formatInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded px-1.5 py-0.5 text-[0.85em] font-mono bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function MarkdownView({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      elements.push(
        <pre
          key={`code-${i}`}
          className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-3.5 text-xs font-mono leading-relaxed"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i += 1;
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="mt-4 mb-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {formatInline(line.slice(4))}
        </h4>
      );
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="mt-5 mb-2 text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          {formatInline(line.slice(3))}
        </h3>
      );
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="mt-5 mb-2.5 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {formatInline(line.slice(2))}
        </h2>
      );
      i += 1;
      continue;
    }

    // Bullet lists
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-5 list-disc marker:text-slate-400">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-5 list-decimal marker:text-slate-400">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {formatInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="my-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {formatInline(line)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
