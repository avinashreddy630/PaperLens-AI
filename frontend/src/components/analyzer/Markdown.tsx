import { useState, Fragment } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

/** Clean Markdown renderer for ChatGPT-inspired aesthetic with full Light/Dark theme support. */
function renderInline(text: string, keyPrefix: string) {
  // If line begins with a single stray backtick without closing, clean it
  const processed = text;
  if (processed.startsWith("`") && !processed.slice(1).includes("`")) {
    return (
      <code
        key={`${keyPrefix}-stray`}
        className="mx-0.5 inline-flex items-center rounded-md border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-primary"
      >
        {processed.slice(1).trim()}
      </code>
    );
  }

  const tokens = processed.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={key}
          className="mx-0.5 inline-flex items-center rounded-md border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-primary"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <em key={key} className="text-muted-foreground italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <Fragment key={key}>{token}</Fragment>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card my-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3.5 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {lang || "code"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[0.84rem] leading-relaxed text-foreground bg-card">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const blocks = content.split(/```/);

  return (
    <div className="ai-response space-y-1.5 text-[15px] sm:text-[15.5px] leading-[1.65] text-foreground font-sans">
      {blocks.map((block, blockIndex) => {
        if (blockIndex % 2 === 1) {
          const [rawLang, ...rest] = block.replace(/^\n/, "").split("\n");
          const maybeLang = rawLang ?? "";
          const isLang = /^[a-z0-9#+.-]+$/i.test(maybeLang.trim());
          const code = (isLang ? rest.join("\n") : block.replace(/^\n/, "")).replace(/\n$/, "");
          return <CodeBlock key={blockIndex} lang={isLang ? maybeLang.trim() : ""} code={code} />;
        }

        const lines = block.split("\n");
        return (
          <Fragment key={blockIndex}>
            {lines.map((line, lineIndex) => {
              const key = `${blockIndex}-${lineIndex}`;
              const trimmed = line.trim();
              if (!trimmed) return null;

              // Horizontal Divider
              if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
                return <div key={key} className="my-3 h-px w-full bg-border" />;
              }

              // Headings
              if (trimmed.startsWith("#### ")) {
                return (
                  <h5
                    key={key}
                    className="pt-2 text-xs font-semibold uppercase tracking-wider text-primary"
                  >
                    {renderInline(trimmed.slice(5), key)}
                  </h5>
                );
              }
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={key} className="pt-2 text-sm font-semibold text-foreground">
                    {renderInline(trimmed.slice(4), key)}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={key} className="pt-2.5 pb-0.5 text-base font-semibold text-foreground">
                    {renderInline(trimmed.slice(3), key)}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={key} className="pt-3 pb-1 text-lg font-semibold text-foreground">
                    {renderInline(trimmed.slice(2), key)}
                  </h2>
                );
              }

              // Blockquotes
              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote
                    key={key}
                    className="my-2 rounded-r-lg border-l-2 border-primary bg-muted/40 px-3 py-1.5 text-sm italic text-foreground/90"
                  >
                    {renderInline(trimmed.slice(2), key)}
                  </blockquote>
                );
              }

              // Numbered lists
              const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (ordered) {
                return (
                  <div key={key} className="flex items-start gap-2.5 pl-0.5 my-1">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10.5px] font-mono font-medium text-foreground">
                      {ordered[1]}
                    </span>
                    <div className="flex-1 pt-0.5 text-foreground">
                      {renderInline(ordered[2] ?? "", key)}
                    </div>
                  </div>
                );
              }

              // Bullet lists
              if (
                trimmed.startsWith("- ") ||
                trimmed.startsWith("* ") ||
                trimmed.startsWith("+ ")
              ) {
                return (
                  <div key={key} className="flex items-start gap-2.5 pl-1 my-1">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" />
                    <div className="flex-1 text-foreground">
                      {renderInline(trimmed.slice(2), key)}
                    </div>
                  </div>
                );
              }

              // Normal paragraph
              return (
                <p key={key} className="my-1 leading-relaxed text-foreground">
                  {renderInline(trimmed, key)}
                </p>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
