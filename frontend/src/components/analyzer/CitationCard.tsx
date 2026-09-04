import { useState } from "react";
import { FileText, Quote, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import type { Citation } from "@/lib/analyzer";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function CitationCard({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);
  const relevancePct = Math.round((citation.relevance ?? 0.85) * 100);

  return (
    <div className="group rounded-2xl border border-border bg-card p-3.5 transition-all duration-200 hover:border-primary/40 hover:shadow-xs">
      {/* Header with Source and Page */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <span className="truncate text-xs font-semibold text-foreground">{citation.source}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary ring-1 ring-primary/20">
            Page {citation.page}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title={expanded ? "Collapse snippet" : "Expand snippet"}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Snippet Quote */}
      <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-muted/60 p-2.5 border border-border/60">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary opacity-80" />
        <p
          className={cn(
            "min-w-0 text-xs leading-relaxed text-foreground/90 transition-all",
            !expanded && "line-clamp-2",
          )}
        >
          {citation.snippet}
        </p>
      </div>

      {/* Relevance match bar */}
      <div className="mt-3 flex items-center gap-2.5">
        <span className="text-[10px] font-medium text-muted-foreground">Relevance</span>
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${relevancePct}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-semibold text-primary">
          {relevancePct}%
        </span>
      </div>
    </div>
  );
}

export function SourceCard({ citation }: { citation: Citation }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs transition-colors hover:border-border/80 hover:bg-muted cursor-pointer">
      <FileText className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:scale-110" />
      <span className="max-w-[190px] truncate font-medium text-foreground">{citation.source}</span>
      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
        p.{citation.page}
      </span>
    </div>
  );
}
