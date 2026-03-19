"use client";

import { useState, useCallback } from 'react';

// --- Types for Google Tokens ---
export interface OAuthCodePayload {
  code: string;
  redirect_uri?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  success: boolean;
  message?: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  valid: boolean;
  message?: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const GOOGLE_TOKEN_ENDPOINT = `${backendApiDomain}/user-google-tokens`;

export function useGoogleToken() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Exchange OAuth code for tokens ---
  const exchangeOAuthCode = useCallback(
    async (userId: string, payload: OAuthCodePayload): Promise<GoogleTokenResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${GOOGLE_TOKEN_ENDPOINT}/google/oauth/exchange?user_id=${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: GoogleTokenResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while exchanging OAuth code'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Disconnect Google integration ---
  const disconnectGoogle = useCallback(
    async (userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${GOOGLE_TOKEN_ENDPOINT}/google/disconnect?user_id=${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        setLoading(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while disconnecting Google'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  // --- Get Google connection status ---
  const getGoogleConnectionStatus = useCallback(
    async (userId: string): Promise<GoogleConnectionStatus | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${GOOGLE_TOKEN_ENDPOINT}/google/status?user_id=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: GoogleConnectionStatus = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while getting Google connection status'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Get Google token ---
  const getGoogleToken = useCallback(
    async (userId: string): Promise<GoogleTokenResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${GOOGLE_TOKEN_ENDPOINT}/google/token?user_id=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: GoogleTokenResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while getting Google token'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    exchangeOAuthCode,
    disconnectGoogle,
    getGoogleConnectionStatus,
    getGoogleToken,
    loading,
    error,
  };
}
