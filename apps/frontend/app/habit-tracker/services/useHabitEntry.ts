import { useState, useCallback } from 'react';

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const HABITS_ENDPOINT = `${backendApiDomain}/habits`;

// Define the status types for habit entries
type HabitEntryStatus = 'completed' | 'skipped' | 'missed' | 'pending'; // Adjust as needed

// Define the type for the data sent to the API when creating an entry
interface HabitEntryPayload {
  entry_date: string; // YYYY-MM-DD format
  status: HabitEntryStatus;
  note?: string;
  value?: string | null;
}

// Define the type for the data sent to the API when updating an entry
interface HabitEntryUpdatePayload {
  status?: HabitEntryStatus;
  note?: string;
  value?: string | null;
}

// Define the type for the data received from the API
export interface HabitEntryResponse {
  habit_id: string;
  entry_date: string; // YYYY-MM-DD format
  status: HabitEntryStatus;
  note: string | null;
  value: string | null;
  id: string;
  created_at: string; // ISO date string
}

export function useHabitEntries() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper function to construct the entry URL
  const getEntriesUrl = (habitId: string, entryId?: string) => {
    let url = `${HABITS_ENDPOINT}/${habitId}/entries`;
    if (entryId) {
      url += `/${entryId}`;
    }
    return url;
  };

  const createHabitEntry = useCallback(
    async (habitId: string, payload: HabitEntryPayload): Promise<HabitEntryResponse | null> => {
      // Ensure value is always a string or null
      if (payload.value !== undefined && payload.value !== null) {
        payload.value = String(payload.value);
      }

      setLoading(true);
      setError(null);
      console.log('[useHabitEntries] Creating entry for habit:', habitId, 'Payload:', payload);
      try {
        const url = getEntriesUrl(habitId);
        const response = await fetch(url, {
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

        const data: HabitEntryResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating habit entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchHabitEntries = useCallback(
    async (habitId: string, startDate: string, endDate: string): Promise<HabitEntryResponse[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${getEntriesUrl(habitId)}?start_date=${startDate}&end_date=${endDate}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: HabitEntryResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching habit entries'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const updateHabitEntry = useCallback(
    async (habitId: string, entryId: string, payload: HabitEntryUpdatePayload): Promise<HabitEntryResponse | null> => {
      setLoading(true);
      setError(null);
      console.log('[useHabitEntries] Updating entry:', entryId, 'for habit:', habitId, 'Payload:', payload);
      try {
        const url = getEntriesUrl(habitId, entryId);
        const response = await fetch(url, {
          method: 'PUT',
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

        const data: HabitEntryResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating habit entry'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteHabitEntry = useCallback(
    async (habitId: string, entryId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const url = getEntriesUrl(habitId, entryId);
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Accept': '*/*',
          },
        });

        if (response.status === 204) {
          setLoading(false);
          return true; // Successfully deleted
        } else if (!response.ok) {
          const errorData = await response.json().catch(() => null); // Try parsing error, might not have body
          throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
        } else {
           // Should not happen for a successful DELETE returning 204
          console.warn(`Unexpected status code for DELETE: ${response.status}`);
          setLoading(false);
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting habit entry'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    createHabitEntry,
    fetchHabitEntries,
    updateHabitEntry,
    deleteHabitEntry,
    loading,
    error,
  };
}
