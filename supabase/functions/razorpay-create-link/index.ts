// Razorpay payment link creator
// Called by staff from the payment credentials dialog.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return json({ error: "Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend secrets." }, 400);
    }
    const { booking_id, amount, lead_name, lead_phone, company_id } = await req.json();
    if (!booking_id || !amount) return json({ error: "booking_id and amount required" }, 400);

    // Look up payment record for this booking to attach reference + tokenized callback
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pRes = await fetch(`${supabaseUrl}/rest/v1/payments?booking_id=eq.${booking_id}&select=id,public_token,amount&order=created_at.desc&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const pArr = await pRes.json();
    const payment = Array.isArray(pArr) ? pArr[0] : null;

    const reference_id = payment?.id ?? booking_id;
    const phone = String(lead_phone || "").replace(/\D/g, "").slice(-10);

    const body = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      accept_partial: false,
      reference_id,
      description: `Booking ${booking_id.slice(0, 6)} payment`,
      customer: {
        name: lead_name ?? "",
        contact: phone ? `+91${phone}` : undefined,
      },
      notify: { sms: !!phone, email: false },
      reminder_enable: true,
      notes: { booking_id, company_id, payment_id: payment?.id ?? "" },
    };

    const auth = btoa(`${keyId}:${keySecret}`);
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.description ?? "Razorpay error", details: data }, res.status);
    return json({ short_url: data.short_url, id: data.id, status: data.status });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
