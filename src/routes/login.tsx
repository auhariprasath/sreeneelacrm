import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Mail, Phone, Lock, ArrowRight, Sparkles } from "lucide-react";
import { useAppLogo } from "@/lib/use-app-logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

function normalizePhone(raw: string) {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  return trimmed.startsWith("0") ? `+91${trimmed.slice(1)}` : `+${trimmed}`;
}

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const appLogo = useAppLogo();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) toast.error(error);
    else toast.success("Welcome back");
  };

  const sendOtp = async () => {
    const p = normalizePhone(phone);
    if (!/^\+\d{8,15}$/.test(p)) {
      toast.error("Enter a valid phone number with country code");
      return;
    }
    setOtpBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setOtpBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("OTP sent to your phone");
    setOtpStep("code");
    setResendIn(45);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setOtpBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: otp,
      type: "sms",
    });
    setOtpBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in");
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary overflow-hidden flex items-center justify-center shadow-lg">
            <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-white font-bold text-xl leading-tight">Neela Events</div>
            <div className="text-slate-400 text-sm">CRM Platform</div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative space-y-6">
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>Built for Indian event venues</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage every event,<br />
            <span className="text-primary">effortlessly.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            From lead capture to event day — quotations, bookings, payments, and vendor coordination in one place.
          </p>

          {/* Feature list */}
          <div className="space-y-3 pt-2">
            {["Lead & requirement tracking", "Quotation builder with PDF export", "Real-time booking & payment status"].map((f) => (
              <div key={f} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-slate-500 text-xs">
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
              <div className="text-white font-bold text-lg leading-tight">Neela Events CRM</div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-slate-400 text-sm">Welcome back — enter your credentials to continue.</p>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-700/50">
                <TabsTrigger value="email" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-slate-300">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-slate-300">
                  <Phone className="h-3.5 w-3.5 mr-1.5" /> Phone OTP
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-slate-300 text-sm">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email" type="email" required
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password" type="password" required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2 h-11 text-sm font-semibold" disabled={submitting}>
                    {submitting ? "Signing in…" : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="phone">
                {otpStep === "phone" ? (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-slate-300 text-sm">Phone number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="phone" type="tel" inputMode="tel"
                          placeholder="+91 98765 43210"
                          value={phone} onChange={(e) => setPhone(e.target.value)}
                          autoComplete="tel"
                          className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                        />
                      </div>
                      <p className="text-xs text-slate-500">We'll text you a 6-digit code. Defaults to +91.</p>
                    </div>
                    <Button onClick={sendOtp} className="w-full gap-2 h-11 text-sm font-semibold" disabled={otpBusy || !phone.trim()}>
                      {otpBusy ? "Sending…" : <><span>Send code</span><ArrowRight className="h-4 w-4" /></>}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Enter the 6-digit code</Label>
                      <div className="flex justify-center py-2">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <InputOTPSlot key={i} index={i} className="bg-slate-700/50 border-slate-600 text-white" />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <p className="text-xs text-slate-500 text-center">Sent to {normalizePhone(phone)}</p>
                    </div>
                    <Button onClick={verifyOtp} className="w-full gap-2 h-11 text-sm font-semibold" disabled={otpBusy || otp.length !== 6}>
                      {otpBusy ? "Verifying…" : <><span>Verify &amp; sign in</span><ArrowRight className="h-4 w-4" /></>}
                    </Button>
                    <div className="flex items-center justify-between text-sm">
                      <button type="button" className="text-slate-400 hover:text-white transition-colors"
                        onClick={() => { setOtpStep("phone"); setOtp(""); }}>
                        Change number
                      </button>
                      <button type="button"
                        className="text-primary hover:underline disabled:opacity-40 disabled:no-underline transition-colors"
                        onClick={sendOtp} disabled={resendIn > 0 || otpBusy}>
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-center text-slate-500 text-xs">
            Secured with Supabase Auth · Data stays in your region
          </p>
        </div>
      </div>
    </div>
  );
}
