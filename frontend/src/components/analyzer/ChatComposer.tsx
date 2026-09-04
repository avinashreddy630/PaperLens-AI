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
    <div className="border-t border-border/60 bg-background/80 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-5">
      <div className="mx-auto max-w-3xl">
        {/* Floating Composer Capsule */}
        <div className="relative rounded-2xl border border-border/80 bg-card/90 shadow-sm transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-md">
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
            className="max-h-48 min-h-[50px] resize-none border-0 bg-transparent px-4 py-3 text-[14.5px] sm:text-[15px] leading-relaxed text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground font-normal"
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7.5 gap-1.5 rounded-lg px-2.5 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              onClick={() => docInput.current?.click()}
              title="Attach question papers or notes (PDF, DOCX, TXT)"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Attach Papers</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7.5 gap-1.5 rounded-lg px-2.5 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
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
                  className="h-8 w-8 shrink-0 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <Square className="h-3 w-3 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  aria-label="Send message"
                  disabled={!value.trim()}
                  onClick={onSend}
                  className="h-8 w-8 shrink-0 rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:bg-muted/70 disabled:text-muted-foreground/60 disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-500/20"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Branded Footer Disclaimer */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          PaperLens AI answers are strictly grounded in your materials with verified citations.
        </p>
      </div>
    </div>
  );
}
