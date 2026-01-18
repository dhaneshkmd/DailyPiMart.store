// supabase/functions/pi-verify-user/index.ts
// Verifies Pi user access token using /v2/me (Pi-compliant)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PI_ME_ENDPOINT = "https://api.minepi.com/v2/me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type PiMeResponse = {
  uid: string;
  username?: string;
  credentials?: {
    scopes: string[];
    valid_until: {
      timestamp: number;
      iso8601: string;
    };
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Enforce POST only
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const accessToken = body?.accessToken;

    if (!accessToken || typeof accessToken !== "string") {
      return json({ error: "Access token is required" }, 400);
    }

    // Call Pi /me endpoint
    const response = await fetch(PI_ME_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return json({ error: "Invalid or expired access token" }, 401);
      }

      console.error("[pi-verify-user] Pi API error", response.status);
      return json({ error: "Pi verification failed" }, 502);
    }

    const userData: PiMeResponse = await response.json();

    // Minimal structural validation (Pi guideline)
    if (!userData?.uid || typeof userData.uid !== "string") {
      console.error("[pi-verify-user] Invalid Pi /me response", userData);
      return json({ error: "Invalid Pi response" }, 502);
    }

    // Return verified user info
    return json({
      uid: userData.uid,
      username: userData.username,
      credentials: userData.credentials,
    });
  } catch (err) {
    console.error("[pi-verify-user] Unexpected error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
