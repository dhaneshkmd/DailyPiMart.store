// Pi Network – Frontend API client (transport ONLY)
// This file NEVER decides payment state.
// All authority lives in Supabase Edge Functions.

const PI_API_BASE = 'https://api.minepi.com/v2';

export interface PiUser {
  uid: string;
  username?: string;
  credentials: {
    scopes: string[];
    valid_until: {
      timestamp: number;
      iso8601: string;
    };
  };
}

export interface PiPayment {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, any>;
  from_address: string;
  to_address: string;
  direction: 'user_to_app' | 'app_to_user';
  created_at: string;
  network: 'Pi Network' | 'Pi Testnet';
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: {
    txid: string;
    verified: boolean;
    _link: string;
  } | null;
}

/* ----------------------------------------
   Supabase base URL (edge functions)
----------------------------------------- */
const getSupabaseUrl = () => {
  return import.meta.env.VITE_SUPABASE_URL || window.location.origin;
};

/* ----------------------------------------
   Frontend → Backend transport only
----------------------------------------- */
export const piAPI = {
  /* -------------------------------
     Verify user (/me)
  -------------------------------- */
  async verifyUser(accessToken: string): Promise<PiUser> {
    const res = await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-verify-user`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      }
    );

    if (!res.ok) {
      throw new Error('Pi user verification failed');
    }

    return res.json();
  },

  /* -------------------------------
     Notify backend of incomplete payment
     (NO decisions here)
  -------------------------------- */
  async reportIncompletePayment(paymentId: string): Promise<void> {
    await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-incomplete-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      }
    );
  },

  /* -------------------------------
     Server approval (mandatory)
  -------------------------------- */
  async approvePayment(paymentId: string): Promise<PiPayment> {
    const res = await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-approve-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      }
    );

    if (!res.ok) {
      throw new Error('Payment approval failed');
    }

    return res.json();
  },

  /* -------------------------------
     Server completion (mandatory)
     Backend MUST verify txid
  -------------------------------- */
  async completePayment(paymentId: string, txid: string): Promise<PiPayment> {
    const res = await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-complete-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, txid }),
      }
    );

    if (!res.ok) {
      throw new Error('Payment completion failed');
    }

    return res.json();
  },

  /* -------------------------------
     Fetch payment (read-only)
  -------------------------------- */
  async getPayment(paymentId: string): Promise<PiPayment> {
    const res = await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-get-payment/${paymentId}`,
      { method: 'GET' }
    );

    if (!res.ok) {
      throw new Error('Failed to fetch payment');
    }

    return res.json();
  },

  /* -------------------------------
     Cancel payment (server decides)
  -------------------------------- */
  async cancelPayment(paymentId: string): Promise<PiPayment> {
    const res = await fetch(
      `${getSupabaseUrl()}/functions/v1/pi-cancel-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      }
    );

    if (!res.ok) {
      throw new Error('Payment cancellation failed');
    }

    return res.json();
  },
};
