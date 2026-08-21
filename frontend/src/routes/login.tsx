import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, BrainCircuit, CheckCircle2, ShieldCheck, Zap, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In | PaperLens AI" },
      { name: "description", content: "Sign in to PaperLens AI — AI Question Paper Analyzer & Document Intelligence" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, setGuest, isAuthenticated, isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/" });
      }
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // Show OAuth error messages passed back from backend redirect (?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      toast.error(decodeURIComponent(oauthError));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back to PaperLens AI!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) throw new Error("Backend unavailable");
      window.location.href = `${API_BASE}/api/auth/oauth/google`;
    } catch {
      toast.error(`Cannot connect to backend server at ${API_BASE}. Please ensure the FastAPI server is running.`);
    }
  };

  const handleGuest = () => {
    setGuest();
    toast("Browsing as guest — uploads and chats won't be saved.");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left decorative showcase panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#0c101a] via-[#101524] to-[#0a0d16] border-r border-border/40 p-12">
        {/* Cosmic ambient glow */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl" />
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
            PaperLens <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed mb-8">
            Academic document intelligence & question paper analyzer. Upload past papers and notes to get document-grounded answers with exact citations.
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-3 text-left">
            {[
              { title: "Exact Citations", desc: "Page-level references", icon: Layers, color: "text-indigo-400" },
              { title: "Smart OCR", desc: "Instant text extraction", icon: Zap, color: "text-cyan-400" },
              { title: "Exam Trends", desc: "Repeating questions", icon: ShieldCheck, color: "text-emerald-400" },
            ].map(({ title, desc, icon: Icon, color }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md shadow-sm"
              >
                <Icon className={`h-4.5 w-4.5 mb-1.5 ${color}`} />
                <div className="text-xs font-semibold text-white">{title}</div>
                <div className="text-[10px] text-white/60 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo (mobile only) */}
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
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
              Sign in to your PaperLens AI workspace
            </p>
          </div>

          {/* Google OAuth button */}
          <div className="mb-5">
            <a
              href={`${API_BASE}/api/auth/oauth/google`}
              onClick={(e) => handleOAuthClick(e)}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-surface/80 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-surface-elevated hover:border-primary/40 cursor-pointer shadow-xs"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
          </div>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-foreground/90 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/40"
                style={{ borderColor: errors.email ? "var(--destructive)" : undefined }}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-foreground/90">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="••••••••"
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
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <><LogIn className="h-4 w-4" /> Sign In</>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
            <p>
              Don't have an account?{" "}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Create free account
              </Link>
            </p>
            <div>
              <button
                onClick={handleGuest}
                className="text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer"
              >
                Continue as guest →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
