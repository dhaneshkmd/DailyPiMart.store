// supabase/functions/pi-cancel-payment/index.ts
// Cancels a Pi payment: POST { paymentId: string }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PI_API = "https://api.minepi.com/v2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type Json = Record<string, unknown>;
const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: cors });

function tryParse(s: string) { try { return JSON.parse(s); } catch { return s; } }
async function safeJson<T = any>(req: Request): Promise<T | null> {
  try {
    const raw = await req.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
const isValidPaymentId = (s?: string) => !!s && /^[A-Za-z0-9_\-:.]{6,200}$/.test(s);

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Network error");
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return text("ok");

  // Only POST
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // Parse & validate
  const body = await safeJson<{ paymentId?: string }>(req);
  const paymentId = body?.paymentId;
  if (!isValidPaymentId(paymentId)) {
    return json({ error: "Invalid or missing paymentId" }, 400);
  }

  // Secret
  const serverKey = Deno.env.get("PI_SERVER_API_KEY");
  if (!serverKey) {
    console.error("[pi-cancel-payment] Missing PI_SERVER_API_KEY");
    return json({ error: "Server not configured" }, 500);
  }

  try {
    // Pi cancel endpoint does not require a body; no Content-Type needed
    const res = await fetchWithRetry(
      `${PI_API}/payments/${encodeURIComponent(paymentId!)}/cancel`,
      {
        method: "POST",
        headers: { "Authorization": `Key ${serverKey}` },
      },
      3
    );

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("[pi-cancel-payment] Pi API error", res.status, bodyText);
      return new Response(
        JSON.stringify({ error: "Pi cancel failed", details: tryParse(bodyText) }),
        { status: res.status, headers: cors }
      );
    }

    return new Response(bodyText, { status: 200, headers: cors });
  } catch (err) {
    console.error("[pi-cancel-payment] Unexpected error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
