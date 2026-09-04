import { useRef } from "react";
import { ArrowUp, ImagePlus, Paperclip, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onFiles: (files: File[]) => void;
  loading: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  onFiles,
  loading,
}: ChatComposerProps) {
  const docInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t border-border/80 bg-background/90 px-3 pb-3 pt-2 backdrop-blur-md sm:px-5">
      <div className="mx-auto max-w-3xl">
        {/* Floating Composer Capsule (ChatGPT Style) */}
        <div className="relative rounded-2xl border border-border bg-card shadow-xs transition-all duration-200 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          {/* Hidden file inputs */}
          <input
            ref={docInput}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(event) => {
              onFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <input
            ref={imageInput}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(event) => {
              onFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />

          {/* Textarea Input */}
          <Textarea
            id="chat-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!loading && value.trim()) onSend();
              }
            }}
            rows={1}
            placeholder="Ask anything about your papers, formulas, or past exam questions..."
            className="max-h-48 min-h-[48px] resize-none border-0 bg-transparent px-4 py-3 text-[15px] sm:text-[15.5px] leading-relaxed text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground font-normal"
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center gap-1 px-3 pb-2 pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              onClick={() => docInput.current?.click()}
              title="Attach question papers or notes (PDF, DOCX, TXT)"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Attach Papers</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              onClick={() => imageInput.current?.click()}
              title="Upload question paper photo for instant OCR"
            >
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">OCR Image</span>
            </Button>

            {/* Send / Stop Action Button */}
            <div className="ml-auto flex items-center gap-1.5">
              {loading ? (
                <Button
                  size="icon"
                  aria-label="Stop generating"
                  onClick={onStop}
                  className="h-7.5 w-7.5 shrink-0 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Square className="h-3 w-3 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  aria-label="Send message"
                  disabled={!value.trim()}
                  onClick={onSend}
                  className="h-7.5 w-7.5 shrink-0 rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Branded Footer Disclaimer */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          PaperLens AI can make mistakes. Verify critical exam formulas against original syllabus
          papers.
        </p>
      </div>
    </div>
  );
}
