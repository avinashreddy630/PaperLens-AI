import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyzerSidebar, type SidebarChat } from "@/components/analyzer/AnalyzerSidebar";
import { UserSettingsModal } from "@/components/analyzer/UserSettingsModal";
import { SearchPadModal } from "@/components/analyzer/SearchPadModal";
import { Navbar } from "@/components/analyzer/Navbar";
import { ChatMessage, TypingIndicator } from "@/components/analyzer/ChatMessage";
import { ChatComposer } from "@/components/analyzer/ChatComposer";
import { AnalyzerPanel } from "@/components/analyzer/AnalyzerPanel";
import { UploadCard, ImagePreviewCard } from "@/components/analyzer/UploadCard";
import { UploadDropzone } from "@/components/analyzer/UploadDropzone";
import { EmptyState } from "@/components/analyzer/EmptyState";
import {
  kindFromName,
  sampleAnswer,
  sampleCitations,
  typeLabel,
  type ChatMessageData,
  type UploadedDoc,
} from "@/lib/analyzer";
import { useAuth } from "@/lib/auth";
import { chatApi, documentsApi, sessionsApi, type SessionResponse } from "@/lib/api";
import { BrainCircuit, FileText, Sparkles, Search, Loader2, ArrowRight, Layers, Flame, BookOpen, Calculator } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Question Paper Analyzer | PaperLens AI" },
      {
        name: "description",
        content:
          "Upload previous question papers, notes and textbooks, then ask questions and get AI answers grounded only in your documents.",
      },
      { property: "og:title", content: "AI Question Paper Analyzer | PaperLens AI" },
      {
        property: "og:description",
        content:
          "A premium AI workspace for analyzing question papers, notes and textbooks with cited, document-grounded answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzerPage,
});

// Structured prompt cards shown on the empty state
const SUGGESTED_PROMPTS = [
  {
    category: "Exam Analysis",
    title: "Find Repeating Questions",
    prompt: "Which topics and questions repeat most frequently across all uploaded papers?",
    icon: "🎯",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    category: "High-Yield Topics",
    title: "Most Important Questions",
    prompt: "What are the most critical and high-weightage questions to prepare for the exam?",
    icon: "⭐",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    category: "Step-by-Step Solver",
    title: "Explain Algorithm / Formula",
    prompt:
      "Explain binary search and provide an optimized C++/Python implementation with step-by-step trace.",
    icon: "⚡",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    category: "Quick Revision",
    title: "Generate Study Cheat Sheet",
    prompt:
      "Summarize all key formulas, definitions, and core concepts into a fast revision guide.",
    icon: "📑",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

function formatCleanTitle(text: string, maxLen = 48): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 16) {
    return sliced.slice(0, lastSpace).trim() + "…";
  }
  return sliced.trim() + "…";
}

function getStoredSessions(): SessionResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("paperlens_sessions_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy demo mock sessions
        return parsed.filter(
          (s: SessionResponse) =>
            s.user_id !== "demo" &&
            !["c1", "c2", "c3", "c4"].includes(s.id),
        );
      }
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

function persistSessions(list: SessionResponse[]) {
  try {
    localStorage.setItem("paperlens_sessions_v2", JSON.stringify(list));
  } catch {
    // Ignore storage quota error
  }
}

function AnalyzerPage() {
  const { user, isGuest, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>(getStoredSessions);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchPadOpen, setSearchPadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track blob URLs for cleanup to prevent memory leaks
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Redirect to login if not authenticated and not guest (after auth loads)
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, isGuest, navigate]);

  // Load real documents from backend on mount (authenticated users only)
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadDocs() {
      setDocsLoading(true);
      try {
        const result = await documentsApi.list();
        const serverDocs: UploadedDoc[] = result.data.map((doc) => ({
          id: doc.id,
          name: doc.name,
          kind: kindFromName(doc.name),
          typeLabel: typeLabel(kindFromName(doc.name)),
          uploadedAt: new Date(doc.uploaded_at),
          pages: doc.pages,
          previewUrl: undefined,
        }));
        setDocs(serverDocs);
      } catch (err) {
        console.warn("Could not load documents:", err);
      } finally {
        setDocsLoading(false);
      }
    }

    loadDocs();
  }, [isAuthenticated]);

  // Fetch real chat sessions from backend (or hydrate from localStorage for guest mode)
  const loadSessions = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const res = await sessionsApi.list();
        if (res.data) {
          setSessions(res.data);
          persistSessions(res.data);
        }
      } catch (err) {
        console.warn("Could not load chat sessions:", err);
      }
    } else {
      const stored = getStoredSessions();
      setSessions(stored);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages, loading]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const currentBlobUrls = blobUrlsRef.current;
    return () => {
      currentBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      currentBlobUrls.clear();
    };
  }, []);

  const imageDocs = useMemo(() => docs.filter((doc) => doc.kind === "image"), [docs]);
  const fileDocs = useMemo(() => docs.filter((doc) => doc.kind !== "image"), [docs]);
  const totalEstimatedPages = useMemo(() => {
    return docs.reduce((acc, d) => acc + (d.pages || 1), 0);
  }, [docs]);

  // Convert SessionResponse to SidebarChat (preserving all attributes)
  const sidebarChats = useMemo<SidebarChat[]>(() => {
    return sessions.map((s) => ({
      id: s.id,
      title: s.title || "New Chat",
      subtitle: `${s.message_count || 0} message${s.message_count === 1 ? "" : "s"}`,
      pinned: Boolean(s.pinned),
      favorite: Boolean(s.favorite),
      archived: Boolean(s.archived),
      folder: s.folder ?? null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }, [sessions]);

  // Handle renaming a chat session
  const handleRenameChat = useCallback(
    async (sessionId: string, newTitle: string) => {
      if (!newTitle.trim()) return;
      const cleanTitle = newTitle.trim();
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? { ...s, title: cleanTitle, updated_at: new Date().toISOString() }
            : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { title: cleanTitle });
          toast.success("Chat renamed");
        } catch (err) {
          toast.error("Failed to rename chat on server");
          loadSessions();
        }
      } else {
        toast.success("Chat renamed");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle pinning / unpinning a chat session
  const handleTogglePinChat = useCallback(
    async (sessionId: string, pinned: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, pinned, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { pinned });
          toast.success(pinned ? "Chat pinned to top" : "Chat unpinned");
        } catch (err) {
          toast.error("Failed to update pin status");
          loadSessions();
        }
      } else {
        toast.success(pinned ? "Chat pinned to top" : "Chat unpinned");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle favorite / unfavorite a chat session
  const handleToggleFavoriteChat = useCallback(
    async (sessionId: string, favorite: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, favorite, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { favorite });
          toast.success(favorite ? "Added to Favorites" : "Removed from Favorites");
        } catch (err) {
          toast.error("Failed to update favorite status");
          loadSessions();
        }
      } else {
        toast.success(favorite ? "Added to Favorites" : "Removed from Favorites");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle archiving / unarchiving a chat session
  const handleToggleArchiveChat = useCallback(
    async (sessionId: string, archived: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, archived, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (activeChat === sessionId && archived) {
        setMessages([]);
        setActiveChat(null);
      }
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { archived });
          toast.success(archived ? "Chat archived" : "Chat unarchived");
        } catch (err) {
          toast.error("Failed to update archive status");
          loadSessions();
        }
      } else {
        toast.success(archived ? "Chat archived" : "Chat unarchived");
      }
    },
    [activeChat, isAuthenticated, loadSessions],
  );

  // Handle assigning / removing a folder
  const handleAssignFolder = useCallback(
    async (sessionId: string, folder: string | null) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, folder, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { folder });
          toast.success(folder ? `Assigned to ${folder}` : "Removed from folder");
        } catch (err) {
          toast.error("Failed to update folder");
          loadSessions();
        }
      } else {
        toast.success(folder ? `Assigned to ${folder}` : "Removed from folder");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle deleting a chat session
  const handleDeleteChat = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== sessionId);
        persistSessions(updated);
        return updated;
      });
      if (activeChat === sessionId) {
        setMessages([]);
        setActiveChat(null);
      }
      try {
        localStorage.removeItem(`paperlens_msgs_${sessionId}`);
      } catch {}
      if (isAuthenticated) {
        try {
          await sessionsApi.delete(sessionId);
          toast.success("Chat deleted");
        } catch (err) {
          toast.error("Failed to delete chat");
          loadSessions();
        }
      } else {
        toast.success("Chat deleted");
      }
    },
    [activeChat, isAuthenticated, loadSessions],
  );

  // Handle selecting a chat session in the sidebar or settings modal
  async function handleSelectChat(sessionId: string) {
    setActiveChat(sessionId);
    if (isAuthenticated) {
      try {
        const historyRes = await chatApi.history(sessionId);
        const historyMsgs: ChatMessageData[] = historyRes.data.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at),
          confidence: m.confidence,
          // Preserve full citation including id and relevance
          citations: m.citations,
        }));
        setMessages(historyMsgs);
      } catch (err) {
        toast.error("Failed to load chat history");
      }
    } else {
      // Guest mode: load stored messages from localStorage
      try {
        const raw = localStorage.getItem(`paperlens_msgs_${sessionId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setMessages(
              parsed.map((m: any) => ({
                ...m,
                createdAt: new Date(m.createdAt || m.created_at || Date.now()),
              })),
            );
            return;
          }
        }
      } catch {}
      setMessages([]);
    }
  }

  const removeDoc = useCallback(
    async (docId: string) => {
      let previousDocs: UploadedDoc[] = [];
      let removedDoc: UploadedDoc | undefined;

      setDocs((current) => {
        previousDocs = current;
        removedDoc = current.find((d) => d.id === docId);
        return current.filter((d) => d.id !== docId);
      });

      if (isAuthenticated) {
        try {
          await documentsApi.delete(docId);
          if (removedDoc?.previewUrl && blobUrlsRef.current.has(removedDoc.previewUrl)) {
            URL.revokeObjectURL(removedDoc.previewUrl);
            blobUrlsRef.current.delete(removedDoc.previewUrl);
          }
          toast.success("Document removed from workspace");
        } catch (err: unknown) {
          // Revert optimistic removal on server failure
          setDocs(previousDocs);
          toast.error(err instanceof Error ? err.message : "Failed to delete document from server");
        }
      } else {
        if (removedDoc?.previewUrl && blobUrlsRef.current.has(removedDoc.previewUrl)) {
          URL.revokeObjectURL(removedDoc.previewUrl);
          blobUrlsRef.current.delete(removedDoc.previewUrl);
        }
        toast.info("Document removed");
      }
    },
    [isAuthenticated],
  );

  async function addFiles(files: File[]) {
    if (files.length === 0) return;

    // Optimistic UI update
    const added = files.map<UploadedDoc>((file) => {
      const kind = kindFromName(file.name);
      let previewUrl: string | undefined;
      if (kind === "image") {
        previewUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(previewUrl);
      }
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        kind,
        typeLabel: typeLabel(kind),
        uploadedAt: new Date(),
        pages: kind === "image" ? 1 : Math.max(1, Math.round(file.size / 42000) || 6),
        previewUrl,
      };
    });
    setDocs((current) => [...added, ...current]);

    // Real upload if authenticated
    if (isAuthenticated) {
      try {
        await documentsApi.upload(files);
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded and indexed!`);

        try {
          const result = await documentsApi.list();
          setDocs((current) => {
            const previewMap = new Map<string, string>();
            current.forEach((d) => {
              if (d.previewUrl) previewMap.set(d.name, d.previewUrl);
            });
            return result.data.map((doc) => ({
              id: doc.id,
              name: doc.name,
              kind: kindFromName(doc.name),
              typeLabel: typeLabel(kindFromName(doc.name)),
              uploadedAt: new Date(doc.uploaded_at),
              pages: doc.pages,
              previewUrl: previewMap.get(doc.name),
            }));
          });
        } catch {
          // Non-fatal
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        setDocs((current) => {
          const filtered = current.filter((d) => !added.some((a) => a.id === d.id));
          added.forEach((a) => {
            if (a.previewUrl && blobUrlsRef.current.has(a.previewUrl)) {
              URL.revokeObjectURL(a.previewUrl);
              blobUrlsRef.current.delete(a.previewUrl);
            }
          });
          return filtered;
        });
      }
    } else {
      toast.success(
        `${added.length} file${added.length > 1 ? "s" : ""} added (guest mode — not saved)`,
      );
    }
  }

  // FIX: regenerate sends the last user message, not the empty input
  function handleRegenerate() {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setInput(lastUserMsg.content);
    // Remove last assistant response to re-ask
    setMessages((current) => {
      const lastAssistantIdx = [...current]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === "assistant");
      if (lastAssistantIdx) return current.slice(0, lastAssistantIdx.i);
      return current;
    });
    // Small timeout to let state update, then send
    setTimeout(() => {
      sendMessage(lastUserMsg.content);
    }, 50);
  }

  // Export formatted Revision / Study Sheet
  const handleExportStudyGuide = useCallback(() => {
    if (messages.length === 0) return;
    let docContent = `# PaperLens AI — Exam Revision & Study Guide\n`;
    docContent += `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n\n---\n\n`;

    messages.forEach((m, idx) => {
      if (m.role === "user") {
        docContent += `## ❓ Question ${Math.floor(idx / 2) + 1}\n${m.content}\n\n`;
      } else {
        docContent += `### 💡 Answer\n${m.content}\n\n`;
        if (m.citations && m.citations.length > 0) {
          docContent += `**Verified Sources & Citations:**\n`;
          m.citations.forEach((c) => {
            docContent += `- **${c.source}** (Page ${c.page}) — Relevance: ${Math.round(c.relevance * 100)}%\n`;
          });
          docContent += `\n`;
        }
        docContent += `---\n\n`;
      }
    });

    const blob = new Blob([docContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PaperLens_Study_Guide_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exam Study Guide downloaded successfully!");
  }, [messages]);

  // Core send function — accepts optional explicit text (used by regenerate & suggestion chips)
  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const cleanText = text.trim();
    const isNewChat = !activeChat;
    const sessionId = activeChat || crypto.randomUUID();
    const sessionTitle = formatCleanTitle(cleanText);

    if (isNewChat) {
      setActiveChat(sessionId);
    }

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessageData = {
      id: `u-${Date.now()}`,
      role: "user",
      content: cleanText,
      createdAt: new Date(),
    };

    setMessages((current) => [...current, userMsg]);
    setInput("");
    setLoading(true);

    // OPTIMISTIC SESSION UPDATE: Chat appears immediately in Recent Chats without waiting for LLM
    setSessions((prev) => {
      const existingIdx = prev.findIndex((s) => s.id === sessionId);
      let updatedList: SessionResponse[];
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const updatedItem: SessionResponse = {
          ...existing,
          title: existing.title === "New Chat" ? sessionTitle : existing.title,
          message_count: (existing.message_count || 0) + 1,
          updated_at: nowIso,
        };
        updatedList = [updatedItem, ...prev.filter((_, idx) => idx !== existingIdx)];
      } else {
        const newItem: SessionResponse = {
          id: sessionId,
          user_id: user?.id || "guest",
          title: sessionTitle || "New Chat",
          pinned: false,
          archived: false,
          favorite: false,
          folder: null,
          message_count: 1,
          created_at: nowIso,
          updated_at: nowIso,
        };
        updatedList = [newItem, ...prev];
      }
      persistSessions(updatedList);
      return updatedList;
    });

    if (isAuthenticated) {
      try {
        const res = await chatApi.send(cleanText, sessionId);
        const d = res.data;

        const assistantMsg: ChatMessageData = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: d.answer,
          createdAt: new Date(),
          confidence: d.confidence ?? undefined,
          status: d.status,
          // Preserve all citation fields including id and relevance
          citations: d.citations.map((c) => ({
            id: c.id,
            source: c.source,
            page: c.page,
            snippet: c.snippet,
            relevance: c.relevance,
          })),
        };

        setMessages((current) => {
          const updated = [...current, assistantMsg];
          return updated;
        });

        // Sync with server sessions
        await loadSessions();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to get answer");
      } finally {
        setLoading(false);
      }
    } else {
      // Guest / demo mode — use sample answer and persist locally
      window.setTimeout(() => {
        const assistantMsg: ChatMessageData = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: sampleAnswer,
          createdAt: new Date(),
          confidence: 0.89,
          citations: sampleCitations,
        };

        setMessages((current) => {
          const updated = [...current, assistantMsg];
          try {
            localStorage.setItem(`paperlens_msgs_${sessionId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setSessions((prev) => {
          const updatedList = prev.map((s) =>
            s.id === sessionId
              ? { ...s, message_count: (s.message_count || 0) + 1, updated_at: new Date().toISOString() }
              : s,
          );
          persistSessions(updatedList);
          return updatedList;
        });

        setLoading(false);
      }, 1200);
    }
  }

  function send() {
    sendMessage(input.trim());
  }

  function handleStop() {
    setLoading(false);
    toast("Response stopped.");
  }

  const hasMessages = messages.length > 0;

  // Loading state while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Prevent rendering analyzer dashboard if unauthenticated
  if (!isAuthenticated && !isGuest) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Left sidebar ── */}
      <AnalyzerSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        docs={docs}
        chats={sidebarChats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onNewChat={() => {
          setMessages([]);
          setActiveChat(null);
          toast.success("Started a new chat");
        }}
        onUpload={() => setUploadOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        search={search}
        onSearch={setSearch}
        onRenameChat={handleRenameChat}
        onTogglePinChat={handleTogglePinChat}
        onToggleFavoriteChat={handleToggleFavoriteChat}
        onToggleArchiveChat={handleToggleArchiveChat}
        onAssignFolder={handleAssignFolder}
        onDeleteChat={handleDeleteChat}
        onSelectPrompt={(p) => {
          setInput(p);
          setTimeout(() => sendMessage(p), 50);
        }}
        onOpenSearchPad={() => setSearchPadOpen(true)}
      />

      {/* ── Main content column ── */}
      <div className="ambient-glow flex min-w-0 flex-1 flex-col">
        {/* Top navbar */}
        <Navbar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          panelOpen={panelOpen}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          docCount={docs.length}
          onOpenSearchPad={() => setSearchPadOpen(true)}
          onExportGuide={handleExportStudyGuide}
          hasMessages={hasMessages}
        />

        {/* ── Scrollable chat & document workspace area ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* ── 1. Empty / Welcome state (0 documents loaded) ── */}
          {!hasMessages && !loading && docs.length === 0 && (
            <EmptyState
              onFiles={addFiles}
              onSelectPrompt={(p) => {
                setInput(p);
                setTimeout(() => sendMessage(p), 50);
              }}
            />
          )}

          {/* ── 2. Document Intelligence Workspace (Post-Upload Dashboard) ── */}
          {!hasMessages && !loading && docs.length > 0 && (
            <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
              {/* Hero & Metrics Banner */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="grid h-6 w-6 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                        <BrainCircuit className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="text-base font-semibold text-foreground">
                        Document Intelligence Workspace
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {docs.length} document{docs.length === 1 ? "" : "s"} indexed with full-text search, OCR, and AI citations.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground font-medium">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>{totalEstimatedPages} Pages Total</span>
                    </div>
                    <button
                      onClick={() => setSearchPadOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Search Pad ⌘K</span>
                    </button>
                  </div>
                </div>

                {/* Suggested Analysis Prompts for Uploaded Papers */}
                <div className="mt-4 pt-4 border-t border-border/60">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Quick Question Paper Analysis
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const p = "Which topics and questions repeat most frequently across all uploaded papers? List the top recurring questions with years.";
                        setInput(p);
                        setTimeout(() => sendMessage(p), 50);
                      }}
                      className="group flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5 text-left text-xs text-foreground hover:border-primary/40 hover:bg-card transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔥</span>
                        <span className="font-medium group-hover:text-primary transition-colors">Find Repeated Questions</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <button
                      onClick={() => {
                        const p = "What are the most critical and high-weightage questions to prepare for the exam?";
                        setInput(p);
                        setTimeout(() => sendMessage(p), 50);
                      }}
                      className="group flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5 text-left text-xs text-foreground hover:border-primary/40 hover:bg-card transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">⭐</span>
                        <span className="font-medium group-hover:text-primary transition-colors">Important Questions</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <button
                      onClick={() => {
                        const p = "Generate 5 high-yield exam practice questions with hints and marking schemes based on the uploaded materials.";
                        setInput(p);
                        setTimeout(() => sendMessage(p), 50);
                      }}
                      className="group flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5 text-left text-xs text-foreground hover:border-primary/40 hover:bg-card transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">📝</span>
                        <span className="font-medium group-hover:text-primary transition-colors">Generate Practice Questions</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <button
                      onClick={() => {
                        const p = "Summarize all key formulas, definitions, and core concepts into a fast revision cheat sheet.";
                        setInput(p);
                        setTimeout(() => sendMessage(p), 50);
                      }}
                      className="group flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5 text-left text-xs text-foreground hover:border-primary/40 hover:bg-card transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🗂</span>
                        <span className="font-medium group-hover:text-primary transition-colors">Create Revision Sheet</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Documents Tabs & Explorer */}
              <Tabs defaultValue="documents">
                <TabsList className="w-full">
                  <TabsTrigger value="documents" className="flex-1">
                    Papers & Documents ({fileDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex-1">
                    Scanned OCR Images ({imageDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    Upload More Files
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="documents" className="mt-3 grid gap-3 sm:grid-cols-2">
                  {fileDocs.map((doc) => (
                    <UploadCard
                      key={doc.id}
                      doc={doc}
                      onDelete={() => removeDoc(doc.id)}
                      onAnalyze={(name) => {
                        const prompt = `Analyze question paper structure, topics, and recurring themes in ${name}`;
                        setInput(prompt);
                        setTimeout(() => sendMessage(prompt), 50);
                      }}
                      onAsk={(docName) => {
                        const prompt = `What are the key questions, topics, and formulas discussed in ${docName}?`;
                        setInput(prompt);
                        setTimeout(() => sendMessage(prompt), 50);
                      }}
                    />
                  ))}
                  {fileDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center sm:col-span-2">No documents yet. Add your PDFs or DOCX files.</p>
                  )}
                </TabsContent>
                <TabsContent value="images" className="mt-3 grid gap-3 sm:grid-cols-3">
                  {imageDocs.map((doc) => (
                    <ImagePreviewCard
                      key={doc.id}
                      doc={doc}
                      onDelete={() => removeDoc(doc.id)}
                      onAsk={(prompt) => {
                        setInput(prompt);
                        setTimeout(() => sendMessage(prompt), 50);
                      }}
                    />
                  ))}
                  {imageDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center sm:col-span-3">
                      No scanned images yet. Upload photos of handwritten or printed papers.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="upload" className="mt-3">
                  <UploadDropzone onFiles={addFiles} compact />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* ── 3. Active Chat Conversation ── */}
          {(hasMessages || loading) && (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-1 py-6 sm:px-2">
              {messages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRegenerate={handleRegenerate}
                  onSelectPrompt={(prompt) => {
                    setInput(prompt);
                    setTimeout(() => sendMessage(prompt), 50);
                  }}
                  isLatest={idx === messages.length - 1}
                />
              ))}
              {loading && <TypingIndicator />}
            </div>
          )}

          {/* Loading spinner for docs */}
          {docsLoading && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Loading your documents…
            </div>
          )}
        </div>

        {/* ── Chat composer — always visible at bottom ── */}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={handleStop}
          onFiles={addFiles}
          loading={loading}
        />
      </div>

      {/* ── Right analyzer panel ── */}
      <AnalyzerPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        paperCount={docs.length}
      />

      {/* ── Upload dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            onFiles={(files) => {
              addFiles(files);
              setUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Search Pad & Document Workspace Modal ── */}
      <SearchPadModal
        open={searchPadOpen}
        onOpenChange={setSearchPadOpen}
        docs={docs}
        onUploadFiles={addFiles}
        onDeleteDoc={removeDoc}
        onAskAboutDoc={(docName) => {
          setInput(`Tell me the main topics and important questions from ${docName}`);
        }}
      />

      {/* ── User Settings Modal ── */}
      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sessions={sessions}
        onSelectSession={handleSelectChat}
        onRefreshSessions={loadSessions}
      />
    </div>
  );
}
