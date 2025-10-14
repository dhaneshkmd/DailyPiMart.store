// supabase/functions/pi-approve/index.ts
// Approves a Pi payment: POST { paymentId: string }
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

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function text(body: string, status = 200) {
  return new Response(body, { status, headers: cors });
}

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try {
    // Accept empty body protection
    const raw = await req.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isValidPaymentId(id: string | undefined): id is string {
  // Pi payment IDs are typically UUID-ish; allow common forms to avoid rejecting valid ones
  return !!id && /^[a-zA-Z0-9_\-:.]{6,200}$/.test(id);
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000); // 15s timeout
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(t);
      // Retry on 429/5xx
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Network error");
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return text("ok", 200);

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  // Parse and validate input
  const body = await safeJson<{ paymentId?: string }>(req);
  const paymentId = body?.paymentId;
  if (!isValidPaymentId(paymentId)) {
    return json({ error: "Invalid or missing paymentId" }, 400);
  }

  // Server key
  const serverKey = Deno.env.get("PI_SERVER_API_KEY");
  if (!serverKey) {
    console.error("[pi-approve] Missing PI_SERVER_API_KEY");
    return json({ error: "Server not configured" }, 500);
  }

  try {
    const res = await fetchWithRetry(
      `${PI_API}/payments/${encodeURIComponent(paymentId)}/approve`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${serverKey}`,
          // No body required by Pi approve endpoint; Content-Type not necessary
        },
      },
      3
    );

    const textBody = await res.text();
    // Forward Pi’s error details if not OK
    if (!res.ok) {
      console.error("[pi-approve] Pi API error", res.status, textBody);
      return new Response(
        JSON.stringify({ error: "Pi approve failed", details: tryParse(textBody) }),
        { status: res.status, headers: cors }
      );
    }

    return new Response(textBody, { status: 200, headers: cors });
  } catch (err) {
    console.error("[pi-approve] Unexpected error", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function tryParse(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}
