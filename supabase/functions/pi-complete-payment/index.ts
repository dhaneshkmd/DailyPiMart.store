// supabase/functions/pi-complete-payment/index.ts
// Pi-compliant server-side completion (verified, idempotent)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PI_API = "https://api.minepi.com/v2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type Json = Record<string, unknown>;

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: cors });

function tryParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function safeJson<T = any>(req: Request): Promise<T | null> {
  try {
    const raw = await req.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isValidStr(s?: string) {
  return !!s && s.length > 6 && s.length <= 300;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }

      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  throw lastErr ?? new Error("Network error");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return text("ok");
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const body = await safeJson<{ paymentId?: string; txid?: string }>(req);
  const paymentId = body?.paymentId;
  const txid = body?.txid;

  if (!isValidStr(paymentId) || !isValidStr(txid)) {
    return json({ error: "paymentId and txid are required" }, 400);
  }

  const serverKey = Deno.env.get("PI_SERVER_API_KEY");
  if (!serverKey) {
    console.error("[pi-complete] Missing PI_SERVER_API_KEY");
    return json({ error: "Server not configured" }, 500);
  }

  try {
    /* ----------------------------------------
       STEP 1: Fetch payment from Pi
    ----------------------------------------- */
    const paymentRes = await fetchWithRetry(
      `${PI_API}/payments/${encodeURIComponent(paymentId!)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${serverKey}`,
        },
      }
    );

    const paymentText = await paymentRes.text();
    if (!paymentRes.ok) {
      console.error("[pi-complete] Failed to fetch payment", paymentText);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch payment",
          details: tryParse(paymentText),
        }),
        { status: paymentRes.status, headers: cors }
      );
    }

    const payment = JSON.parse(paymentText);

    /* ----------------------------------------
       STEP 2: Mandatory Pi state validation
    ----------------------------------------- */
    if (!payment.status?.developer_approved) {
      return json({ error: "Payment not approved by app" }, 409);
    }

    if (payment.status?.developer_completed) {
      // Idempotent success
      return json(payment, 200);
    }

    if (!payment.status?.transaction_verified) {
      return json({ error: "Transaction not verified by Pi" }, 409);
    }

    if (payment.transaction?.txid !== txid) {
      return json({ error: "txid mismatch" }, 409);
    }

    /* ----------------------------------------
       STEP 3: Complete payment with Pi
    ----------------------------------------- */
    const completeRes = await fetchWithRetry(
      `${PI_API}/payments/${encodeURIComponent(paymentId!)}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const completeText = await completeRes.text();
    if (!completeRes.ok) {
      console.error("[pi-complete] Pi API error", completeText);
      return new Response(
        JSON.stringify({
          error: "Pi complete failed",
          details: tryParse(completeText),
        }),
        { status: completeRes.status, headers: cors }
      );
    }

    return new Response(completeText, { status: 200, headers: cors });
  } catch (err) {
    console.error("[pi-complete] Unexpected error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
