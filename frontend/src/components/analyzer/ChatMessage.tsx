import { useState } from "react";
import {
  BadgeCheck,
  BrainCircuit,
  ChevronDown,
  Clock,
  Copy,
  Check,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Sparkles,
  Layers,
  Share2,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatTime, type ChatMessageData } from "@/lib/analyzer";
import { Markdown } from "./Markdown";
import { CitationCard, SourceCard } from "./CitationCard";

export function ChatMessage({
  message,
  onRegenerate,
  onSelectPrompt,
  isLatest,
}: {
  message: ChatMessageData;
  onRegenerate: () => void;
  onSelectPrompt?: (prompt: string) => void;
  isLatest?: boolean;
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  // ─── User Message — Clean Minimalist Pill (ChatGPT Style) ───
  if (isUser) {
    return (
      <div className="animate-message-in flex justify-end px-2 sm:px-4">
        <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
          <div className="user-message-bubble rounded-2xl rounded-tr-xs px-4 py-2.5 text-[15px] leading-relaxed shadow-xs">
            {message.content}
          </div>
          <div className="flex items-center gap-1.5 pr-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    void navigator.clipboard?.writeText(message.content);
    setCopied(true);
    toast.success("Answer copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Subtle suggestion chips
  const smartSuggestions = [
    { label: "3 Practice Questions", prompt: "Generate 3 high-yield exam practice questions based on this topic with answer hints." },
    { label: "Flashcard Summary", prompt: "Summarize this into 3 concise question-answer study flashcards for fast revision." },
    { label: "Step-by-Step Code / Math", prompt: "Provide a detailed step-by-step mathematical derivation and code implementation for this." },
  ];

  // ─── Assistant Message — Natural Conversational Layout (ChatGPT Style) ───
  return (
    <div className="animate-message-in group px-2 sm:px-4">
      <div className="mx-auto flex max-w-3xl gap-3 sm:gap-3.5">
        {/* PaperLens AI Minimalist Avatar */}
        <div className="flex shrink-0 flex-col items-center pt-0.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-xs">
            <BrainCircuit className="h-4 w-4" />
          </div>
        </div>

        {/* Content Container */}
        <div className="min-w-0 flex-1 pb-2">
          {/* Header row: Model Name + Grounded/General Badge + Confidence */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              PaperLens AI
            </span>

            {message.status === "general" ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                General AI
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <FileCheck2 className="h-2.5 w-2.5" />
                Grounded
              </span>
            )}

            {message.confidence !== undefined && message.confidence !== null && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                <BadgeCheck className="h-2.5 w-2.5 text-primary" />
                {Math.round(message.confidence * 100)}% match
              </span>
            )}

            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatTime(message.createdAt)}
            </span>
          </div>

          {/* Clean Markdown Answer Body (15-16px, line-height 1.6) */}
          <div className="text-[15px] sm:text-[15.5px] leading-[1.65] text-foreground font-normal">
            <Markdown content={message.content} />
          </div>

          {/* Document Citations & Retrieved Context */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3.5 space-y-2.5 rounded-xl border border-border bg-card/60 p-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <Layers className="h-3 w-3 text-primary" />
                    Verified Sources ({message.citations.length})
                  </p>
                  <button
                    onClick={() => setContextOpen((v) => !v)}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                  >
                    <span>{contextOpen ? "Hide excerpts" : "View excerpts"}</span>
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform duration-200", contextOpen && "rotate-180")}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {message.citations.map((citation, idx) => (
                    <SourceCard key={citation.id ?? `src-${idx}`} citation={citation} />
                  ))}
                </div>
              </div>

              {contextOpen && (
                <div className="animate-message-in grid gap-2 pt-2 sm:grid-cols-2 border-t border-border">
                  {message.citations.map((citation, idx) => (
                    <CitationCard key={citation.id ?? `ctx-${idx}`} citation={citation} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtle Suggestion Chips (Shown on latest assistant answer) */}
          {isLatest && onSelectPrompt && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {smartSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt(s.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted px-3 py-1 text-[12px] font-normal text-foreground transition-colors cursor-pointer"
                >
                  <Sparkles className="h-2.5 w-2.5 text-primary" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Row — Subtle icon buttons */}
          <div className="mt-2.5 flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
            <ActionButton
              label={copied ? "Copied" : "Copy"}
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              active={copied}
            />
            <ActionButton label="Regenerate" icon={RefreshCw} onClick={onRegenerate} />
            <ActionButton
              label="Accurate"
              icon={ThumbsUp}
              active={vote === "up"}
              onClick={() => {
                setVote("up");
                toast.success("Feedback recorded — thank you!");
              }}
            />
            <ActionButton
              label="Inaccurate"
              icon={ThumbsDown}
              active={vote === "down"}
              onClick={() => {
                setVote("down");
                toast("Feedback recorded — improving retrieval weights.");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "h-7 gap-1.5 rounded-lg px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer",
        active && "text-primary font-medium bg-primary/10",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

// ─── Modern Pulsing Typing Indicator ───
export function TypingIndicator() {
  return (
    <div className="animate-message-in px-2 sm:px-4">
      <div className="mx-auto flex max-w-3xl gap-3.5 sm:gap-4">
        <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/25 mt-0.5">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950/90 backdrop-blur-sm">
            <BrainCircuit className="h-4 w-4 text-cyan-300 animate-pulse" />
          </div>
        </div>

        <div className="flex-1 pb-2">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-foreground">PaperLens AI</span>
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <span>Synthesizing from documents</span>
              <span className="flex gap-1">
                <Dot delay="0s" />
                <Dot delay="0.2s" />
                <Dot delay="0.4s" />
              </span>
            </span>
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-border/30 bg-surface/30 p-4">
            <Skeleton className="h-3 w-3/4 rounded-full bg-muted/60" />
            <Skeleton className="h-3 w-full rounded-full bg-muted/40" />
            <Skeleton className="h-3 w-5/6 rounded-full bg-muted/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="animate-dot h-1.5 w-1.5 rounded-full bg-cyan-400"
      style={{ animationDelay: delay }}
    />
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary",
        className,
      )}
    />
  );
}
