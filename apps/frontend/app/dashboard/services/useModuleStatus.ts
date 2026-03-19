"use client";

import { useState, useCallback } from 'react';

// --- Types for Module Status ---
export interface ModuleStatusResponse {
  weekly_rhythm_completed: boolean;
  daily_journal_completed: boolean;
  habit_tracker_completed: boolean;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const MODULE_STATUS_ENDPOINT = `${backendApiDomain}/module-status/`;

export function useModuleStatus() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Fetch today's status by user ---
  const fetchModuleStatusToday = useCallback(
    async (userId: string): Promise<ModuleStatusResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${MODULE_STATUS_ENDPOINT}today?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {
            // Ignore if response body is not JSON or empty
          }
          throw new Error(errorDetail);
        }
        const data: ModuleStatusResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        console.error("Error fetching module status:", err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching module status'));
        setLoading(false);
        return null;
      }
    },
    [] // No dependencies, fetch is stable
  );

  return {
    fetchModuleStatusToday,
    loading,
    error,
  };
}
