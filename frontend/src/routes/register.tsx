import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, BrainCircuit, UserPlus, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account | PaperLens AI" },
      {
        name: "description",
        content: "Create your free PaperLens AI account — AI Question Paper Analyzer",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  // Show OAuth error messages passed back from backend redirect (?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      toast.error(decodeURIComponent(oauthError));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleOAuthClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) throw new Error("Backend unavailable");
      window.location.href = `${API_BASE}/api/auth/oauth/google`;
    } catch {
      toast.error(
        `Cannot connect to backend at ${API_BASE}. Please make sure the FastAPI server is running.`,
      );
    }
  };

  const set = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (form.password !== form.confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success("Account created! Welcome to PaperLens AI 🎉");
      navigate({ to: "/" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Decorative left showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#0c101a] via-[#101524] to-[#0a0d16] border-r border-border/40 p-12">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-cyan-600/25 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-500/25 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 shadow-2xl shadow-indigo-500/40">
              <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/90 backdrop-blur-xl">
                <BrainCircuit className="h-10 w-10 text-cyan-300" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
            Join PaperLens{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              AI
            </span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed mb-8">
            Experience the next generation of academic document intelligence and exam preparation.
          </p>

          <div className="space-y-3 text-left max-w-sm mx-auto">
            {[
              "Multi-format ingestion: PDF, DOCX, PPTX & Images",
              "Exact citations with document names & page numbers",
              "Instant Tesseract OCR for handwritten notes",
              "Exam trend analytics & repeating question detection",
              "Hybrid RAG powered by Gemini 2.0 & PaperQA",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-2.5 backdrop-blur-sm"
              >
                <div className="h-5 w-5 rounded-full flex items-center justify-center bg-cyan-500/20 text-cyan-400 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-white/90">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form right */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 shadow-md">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950/90">
                  <BrainCircuit className="h-5 w-5 text-cyan-300" />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                PaperLens <span className="text-primary font-black">AI</span>
              </span>
            </div>
          </div>

          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              Create account
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
              Get started with PaperLens AI for free
            </p>
          </div>

          {/* Google OAuth */}
          <div className="mb-5">
            <a
              href={`${API_BASE}/api/auth/oauth/google`}
              onClick={(e) => handleOAuthClick(e)}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-surface/80 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-surface-elevated hover:border-primary/40 cursor-pointer shadow-xs"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign up with Google
            </a>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                or sign up with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Avinash Reddy"
                className="w-full rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                style={{ borderColor: errors.name ? "var(--destructive)" : undefined }}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                style={{ borderColor: errors.email ? "var(--destructive)" : undefined }}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                  style={{ borderColor: errors.password ? "var(--destructive)" : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                style={{ borderColor: errors.confirm ? "var(--destructive)" : undefined }}
              />
              {errors.confirm && <p className="mt-1 text-xs text-destructive">{errors.confirm}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating Account…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Create Free Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
