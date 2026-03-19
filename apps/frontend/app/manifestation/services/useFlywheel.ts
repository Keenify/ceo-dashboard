"use client";

import { useState, useCallback } from 'react';

// --- Types for Flywheel ---
export interface FlywheelEdge {
  id: string;
  text: string;
}

export interface FlywheelPayload {
  name: string;
  description?: string;
  edges: FlywheelEdge[];
  image_path?: string | null;
  user_id: string;
}

export interface FlywheelResponse {
  name: string;
  description?: string;
  edges: FlywheelEdge[];
  image_path?: string | null;
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const FLYWHEEL_ENDPOINT = `${backendApiDomain}/flywheels/`;

export function useFlywheel() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Create ---
  const addFlywheel = useCallback(
    async (payload: FlywheelPayload): Promise<FlywheelResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(FLYWHEEL_ENDPOINT, {
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
        const data: FlywheelResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding flywheel'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch all by user ---
  const fetchFlywheels = useCallback(
    async (userId: string, skip = 0, limit = 100): Promise<FlywheelResponse[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      const url = `${FLYWHEEL_ENDPOINT}?${params.toString()}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: FlywheelResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching flywheels'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchFlywheelById = useCallback(
    async (id: string, userId: string): Promise<FlywheelResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${FLYWHEEL_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: FlywheelResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching flywheel'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update ---
  const updateFlywheel = useCallback(
    async (id: string, userId: string, updatePayload: Partial<FlywheelPayload>): Promise<FlywheelResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${FLYWHEEL_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
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
        const data: FlywheelResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating flywheel'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteFlywheel = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${FLYWHEEL_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Accept': '*/*', // As per curl example
          },
        });
        if (!response.ok) {
          // Delete might return 204 No Content on success, which is ok.
          // Only throw if status is not 204 and not ok.
          if (response.status !== 204) {
            let errorData;
            try {
              // Try parsing JSON, but DELETE might not return a body
              errorData = await response.json();
            } catch (parseError) {
              errorData = { detail: `HTTP error! status: ${response.status}` };
            }
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
          }
        }
        setLoading(false);
        // Return true if the status is 204 (No Content) or 200 (OK)
        return response.status === 204 || response.ok;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting flywheel'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    addFlywheel,
    fetchFlywheels,
    fetchFlywheelById,
    updateFlywheel,
    deleteFlywheel,
    loading,
    error,
  };
}
