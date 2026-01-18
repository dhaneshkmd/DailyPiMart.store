'use client';

import { useEffect, useState, useCallback } from 'react';
import { piAPI } from '@/lib/pi-api';

declare global {
  interface Window {
    Pi?: any;
    __PI_READY__?: boolean;
  }
}

export interface PiUser {
  uid: string;
  username: string;
  accessToken: string;
}

export function usePiSDK() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<PiUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  /* -------------------------------
     Pi SDK readiness (NO polling)
  -------------------------------- */
  useEffect(() => {
    if (window.__PI_READY__) {
      setIsReady(true);
      return;
    }

    const onReady = () => setIsReady(true);
    document.addEventListener('pi-ready', onReady, { once: true });

    return () => {
      document.removeEventListener('pi-ready', onReady);
    };
  }, []);

  /* -------------------------------
     Restore session (UI only)
  -------------------------------- */
  useEffect(() => {
    const stored = localStorage.getItem('pi_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('pi_user');
      }
    }
    setIsLoadingSession(false);
  }, []);

  /* -------------------------------
     Authenticate user
  -------------------------------- */
  const authenticate = useCallback(async () => {
    if (!isReady || !window.Pi) {
      throw new Error('Pi SDK not ready');
    }

    setIsAuthenticating(true);

    try {
      const auth = await window.Pi.authenticate(
        ['username', 'payments'],
        // IMPORTANT: frontend does NOT decide anything here
        (payment: any) => {
          if (payment?.identifier) {
            // Notify backend ONLY
            piAPI.reportIncompletePayment(payment.identifier);
          }
        }
      );

      // Verify user server-side (/me)
      await piAPI.verifyUser(auth.accessToken);

      const piUser: PiUser = {
        uid: auth.user.uid,
        username: auth.user.username,
        accessToken: auth.accessToken,
      };

      setUser(piUser);
      localStorage.setItem('pi_user', JSON.stringify(piUser));

      return piUser;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isReady]);

  /* -------------------------------
     Logout
  -------------------------------- */
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pi_user');
  }, []);

  /* -------------------------------
     Create payment (frontend ONLY)
  -------------------------------- */
  const createPayment = useCallback(
    async (
      paymentData: {
        amount: number;
        memo: string;
        metadata: Record<string, any>;
      },
      callbacks: {
        onReadyForServerApproval: (paymentId: string) => Promise<void>;
        onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void>;
        onCancel?: (paymentId: string) => void;
        onError?: (error: any, payment: any) => void;
      }
    ) => {
      if (!isReady || !window.Pi) {
        throw new Error('Pi SDK not ready');
      }

      return window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId: string) => {
          await callbacks.onReadyForServerApproval(paymentId);
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          await callbacks.onReadyForServerCompletion(paymentId, txid);
        },
        onCancel: (paymentId: string) => {
          callbacks.onCancel?.(paymentId);
        },
        onError: (error: any, payment: any) => {
          callbacks.onError?.(error, payment);
        },
      });
    },
    [isReady]
  );

  return {
    isReady,
    isLoadingSession,
    user,
    isAuthenticated: !!user,
    isAuthenticating,
    authenticate,
    logout,
    createPayment,
  };
}
