import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

export const sendPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    // Check the email exists in auth
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error("Server error");
    const exists = users.users.some((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!exists) throw new Error("No account found with that email");

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otp_hash = hashOtp(otp);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Invalidate old OTPs for this email
    await supabaseAdmin
      .from("password_reset_otps")
      .update({ used: true })
      .eq("email", data.email.toLowerCase())
      .eq("used", false);

    // Store new OTP
    await supabaseAdmin.from("password_reset_otps").insert({
      email: data.email.toLowerCase(),
      otp_hash,
      expires_at,
    });

    // Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer re_eMWfXhvb_4noh1riZFfociovpoQNXyG6m`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sreeneela CRM <onboarding@resend.dev>",
        to: data.email,
        subject: "Your password reset code",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Password Reset Code</h2>
            <p>Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size:40px;font-weight:bold;letter-spacing:12px;text-align:center;
                        background:#f4f4f5;border-radius:8px;padding:24px;margin:24px 0">
              ${otp}
            </div>
            <p style="color:#888;font-size:13px">If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to send email: ${body}`);
    }

    return { ok: true };
  });

export const verifyPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), otp: z.string().length(6) }).parse(input),
  )
  .handler(async ({ data }) => {
    const otp_hash = hashOtp(data.otp);
    const now = new Date().toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .eq("otp_hash", otp_hash)
      .eq("used", false)
      .gt("expires_at", now)
      .maybeSingle();

    if (error || !row) throw new Error("Invalid or expired code");

    // Mark as used
    await supabaseAdmin.from("password_reset_otps").update({ used: true }).eq("id", row.id);

    // Generate a Supabase recovery link so the user gets a real session
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (linkErr || !link) throw new Error("Could not create session");

    return { token_hash: link.properties.hashed_token };
  });
