"use client";

import { useState, useCallback } from 'react';

// --- Types for Manifestation ---
export interface TargetItem {
  text: string;
  completed: boolean;
}

export interface CourageItem {
  text: string;
  completed: boolean;
}

export interface ManifestationPayload {
  strong_life_changes?: string[];
  big_targets?: (string | TargetItem)[];
  top_values?: string[];
  non_negotiables?: string[];
  life_rules?: string[];
  rituals?: string[];
  courage_list?: (string | CourageItem)[];
  year?: number;
  theme?: string;
  user_id: string;
}

// Response type
export interface ManifestationResponse {
  strong_life_changes: string[];
  big_targets: (string | TargetItem)[];
  top_values: string[];
  non_negotiables: string[];
  life_rules: string[];
  rituals: string[];
  courage_list: (string | CourageItem)[];
  year: number;
  theme: string;
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const MANIFESTATION_ENDPOINT = `${backendApiDomain}/manifestation/`;

export function useManifestation() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addManifestation = useCallback(
    async (payload: ManifestationPayload): Promise<ManifestationResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(MANIFESTATION_ENDPOINT, {
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
        const data: ManifestationResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding manifestation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch all by user ---
  const fetchManifestations = useCallback(
    async (userId: string, skip = 0, limit = 100): Promise<ManifestationResponse[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      const url = `${MANIFESTATION_ENDPOINT}?${params.toString()}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ManifestationResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching manifestations'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchManifestationById = useCallback(
    async (id: string, userId: string): Promise<ManifestationResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${MANIFESTATION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ManifestationResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching manifestation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update ---
  const updateManifestation = useCallback(
    async (id: string, userId: string, updatePayload: Partial<ManifestationPayload>): Promise<ManifestationResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${MANIFESTATION_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: ManifestationResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating manifestation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    addManifestation,
    fetchManifestations,
    fetchManifestationById,
    updateManifestation,
    loading,
    error,
  };
}
