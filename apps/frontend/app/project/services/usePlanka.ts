"use client";

import { useState, useCallback } from 'react';

// --- Types for Planka ---
export interface PlankaUserOnboardRequest {
  email: string;
  username?: string;
  name?: string;
  role?: string;
}

export interface PlankaUserResponse {
  status: string;
  message: string;
  user?: {
    id?: string;
    email?: string;
    username?: string;
    name?: string;
    role?: string;
    [key: string]: any;
  } | null;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const PLANKA_ENDPOINT = `${backendApiDomain}/planka/onboard-planka-user`;

export function usePlanka() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Onboard User ---
  const onboardUser = useCallback(
    async (payload: PlankaUserOnboardRequest): Promise<PlankaUserResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(PLANKA_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: payload.email,
            username: payload.username || null,
            name: payload.name || null,
            role: payload.role || "projectOwner"
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const data: PlankaUserResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while onboarding Planka user'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Onboard User by Email (simplified) ---
  const onboardUserByEmail = useCallback(
    async (email: string): Promise<PlankaUserResponse | null> => {
      return onboardUser({ email });
    },
    [onboardUser]
  );

  return {
    onboardUser,
    onboardUserByEmail,
    loading,
    error,
  };
}
