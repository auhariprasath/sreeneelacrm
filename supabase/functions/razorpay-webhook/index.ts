// Razorpay webhook handler — auto-marks payments received.
// Configure in Razorpay dashboard:
//   URL:    <project>/functions/v1/razorpay-webhook
//   Events: payment_link.paid, payment.captured
//   Secret: same value stored in RAZORPAY_WEBHOOK_SECRET

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!secret) return new Response("Webhook secret not configured", { status: 500 });

    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const raw = await req.text();
    const ok = await verifyHmac(secret, raw, signature);
    if (!ok) return new Response("Invalid signature", { status: 401 });

    const payload = JSON.parse(raw) as {
      event: string;
      payload: {
        payment_link?: { entity: { reference_id?: string; amount: number; notes?: Record<string, string> } };
        payment?: { entity: { id: string; amount: number; notes?: Record<string, string> } };
      };
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = (path: string, init: RequestInit = {}) =>
      fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(init.headers ?? {}),
        },
      });

    let paymentId: string | null = null;
    let txnRef: string | null = null;
    let amountInPaise = 0;

    if (payload.event === "payment_link.paid" && payload.payload.payment_link) {
      const link = payload.payload.payment_link.entity;
      paymentId = link.notes?.payment_id ?? link.reference_id ?? null;
      amountInPaise = link.amount;
      txnRef = payload.payload.payment?.entity?.id ?? null;
    } else if (payload.event === "payment.captured" && payload.payload.payment) {
      const p = payload.payload.payment.entity;
      paymentId = p.notes?.payment_id ?? null;
      amountInPaise = p.amount;
      txnRef = p.id;
    } else {
      return new Response("ok", { status: 200 });
    }

    if (!paymentId) return new Response("ok", { status: 200 });

    const pRes = await sb(`payments?id=eq.${paymentId}&select=id,lead_id,amount,status`);
    const pArr = await pRes.json();
    const payment = Array.isArray(pArr) ? pArr[0] : null;
    if (!payment) return new Response("ok", { status: 200 });
    if (payment.status === "received") return new Response("ok", { status: 200 });

    await sb(`payments?id=eq.${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "received",
        received_at: new Date().toISOString(),
        transaction_reference: txnRef,
        notes: "Auto-received via Razorpay webhook",
      }),
    });

    await sb(`activity_logs`, {
      method: "POST",
      body: JSON.stringify({
        lead_id: payment.lead_id,
        action: `Payment received via Razorpay — ₹${(amountInPaise / 100).toLocaleString("en-IN")}`,
        action_type: "system",
        metadata: { payment_id: paymentId, razorpay_event: payload.event, txn_ref: txnRef },
      }),
    });

    const lRes = await sb(`leads?id=eq.${payment.lead_id}&select=assigned_to,full_name`);
    const lead = (await lRes.json())?.[0];
    if (lead?.assigned_to) {
      await sb(`notifications`, {
        method: "POST",
        body: JSON.stringify({
          user_id: lead.assigned_to,
          title: "Payment received",
          body: `Razorpay payment of ₹${(amountInPaise / 100).toLocaleString("en-IN")} from ${lead.full_name}`,
          type: "system",
          lead_id: payment.lead_id,
        }),
      });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("razorpay-webhook error", e);
    return new Response("error", { status: 500 });
  }
});

async function verifyHmac(secret: string, payload: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
