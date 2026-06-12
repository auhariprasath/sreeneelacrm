import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAppLogo } from "@/lib/use-app-logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const appLogo = useAppLogo();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) toast.error(error);
    else toast.success("Welcome back");
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        className="fixed top-4 right-4 z-50 h-9 w-9 rounded-full border flex items-center justify-center transition-colors
          bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700
          dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/20 dark:text-white"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden
        bg-slate-50 border-r border-slate-200
        dark:bg-transparent dark:border-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none dark:from-primary/20" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none dark:bg-primary/10" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary overflow-hidden flex items-center justify-center shadow-lg">
            <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-xl leading-tight text-slate-900 dark:text-white">Neela Events</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">CRM Platform</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>Built for Indian event venues</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 dark:text-white">
            Manage every event,<br />
            <span className="text-primary">effortlessly.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-sm text-slate-500 dark:text-slate-400">
            From lead capture to event day — quotations, bookings, payments, and vendor coordination in one place.
          </p>
          <div className="space-y-3 pt-2">
            {["Lead & requirement tracking", "Quotation builder with PDF export", "Real-time booking & payment status"].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Neela Events CRM · Secure &amp; private
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="h-10 w-10 rounded-xl bg-primary overflow-hidden flex items-center justify-center shadow-lg">
              <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight text-slate-900 dark:text-white">Neela Events CRM</div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign in</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back — enter your credentials to continue.</p>
          </div>

          <div className="rounded-2xl p-6 shadow-sm border
            bg-white border-slate-200
            dark:bg-slate-800/60 dark:backdrop-blur-sm dark:border-slate-700/50 dark:shadow-2xl">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-slate-700 dark:text-slate-300">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email" type="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="pl-10
                      bg-white border-slate-300 text-slate-900 placeholder:text-slate-400
                      dark:bg-slate-700/50 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500
                      focus:border-primary focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm text-slate-700 dark:text-slate-300">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password" type={showPassword ? "text" : "password"} required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10
                      bg-white border-slate-300 text-slate-900 placeholder:text-slate-400
                      dark:bg-slate-700/50 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500
                      focus:border-primary focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors
                      text-slate-400 hover:text-slate-700
                      dark:text-slate-400 dark:hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 h-11 text-sm font-semibold" disabled={submitting}>
                {submitting ? "Signing in…" : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Secured with Supabase Auth · Data stays in your region
          </p>
        </div>
      </div>
    </div>
  );
}
