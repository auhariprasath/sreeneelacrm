import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Mail, ArrowRight, KeyRound } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) { toast.error("Enter your email address"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("A 6-digit code has been sent to your email");
    setOtp("");
    setStep("otp");
    setResendIn(60);
  };

  const verifyCode = async () => {
    if (otp.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid or expired code. Please try again.");
      setOtp("");
      return;
    }
    toast.success("Identity verified — set your new password");
    navigate({ to: "/change-password" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {step === "email" ? (
              <><Mail className="h-5 w-5 text-primary" /> Forgot password</>
            ) : (
              <><KeyRound className="h-5 w-5 text-primary" /> Enter verification code</>
            )}
          </CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your registered email and we'll send a 6-digit code."
              : `We sent a 6-digit code to ${email}. Enter it below.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === "email" ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email address</Label>
                <Input
                  id="fp-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full gap-2 h-11" disabled={busy}>
                {busy ? "Sending…" : <><span>Send code</span><ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label>6-digit code</Label>
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button
                className="w-full gap-2 h-11"
                onClick={verifyCode}
                disabled={busy || otp.length !== 6}
              >
                {busy ? "Verifying…" : <><span>Verify &amp; continue</span><ArrowRight className="h-4 w-4" /></>}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                  onClick={() => { setStep("email"); setOtp(""); }}
                >
                  Change email
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-40 disabled:no-underline text-xs transition-colors"
                  onClick={sendCode}
                  disabled={resendIn > 0 || busy}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          <div className="text-center text-sm border-t pt-4">
            <Link to="/login" className="text-primary hover:underline text-xs">
              ← Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
