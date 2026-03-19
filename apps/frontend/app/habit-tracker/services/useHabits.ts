import { useState, useCallback } from 'react';

// Define the type for the data sent to the API
interface HabitPayload {
  name: string;
  description: string;
  habit_type: 'build' | 'break' | 'track';  // Updated habit types
  color_code: string;
  user_id: string;
}

// Define the type for the data received from the API
interface HabitResponse extends HabitPayload {
  id: string;
  created_at: string;  // ISO date string
  sort_order: number;
}

// Export the type for use in other components
export interface FetchedHabit {
  id: string;
  name: string;
  description: string;
  habit_type: 'build' | 'break' | 'track';
  color_code: string;
  user_id: string;
  created_at: string;
  sort_order: number;
  dates?: Record<string, number>;
  streak?: number;
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const HABITS_ENDPOINT = `${backendApiDomain}/habits/`;

// Define update payload type (omitting user_id since it's in the query params)
interface HabitUpdatePayload {
  name?: string;
  description?: string;
  habit_type?: 'build' | 'break' | 'track';
  color_code?: string;
  sort_order?: number;
}

export function useHabits() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createHabit = useCallback(
    async (payload: HabitPayload): Promise<HabitResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(HABITS_ENDPOINT, {
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

        const data: HabitResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating habit'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchUserHabits = useCallback(
    async (userId: string, skip: number = 0, limit: number = 50, sort_order?: string): Promise<FetchedHabit[] | null> => {
      setLoading(true);
      setError(null);
      try {
        let url = `${HABITS_ENDPOINT}?user_id=${userId}&skip=${skip}&limit=${limit}`;
        if (sort_order !== undefined) {
          url += `&sort_order=${sort_order}`;
        }
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

        const data: FetchedHabit[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching habits'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const updateHabit = useCallback(
    async (habitId: string, userId: string, payload: HabitUpdatePayload): Promise<HabitResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABITS_ENDPOINT}${habitId}?user_id=${userId}`;
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

        const data: HabitResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating habit'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteHabit = useCallback(
    async (habitId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABITS_ENDPOINT}${habitId}?user_id=${userId}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Accept': '*/*', // Accept any response type
          },
        });

        if (response.status === 204) {
          // Successfully deleted
          setLoading(false);
          return true;
        } else if (!response.ok) {
          // Handle other errors (e.g., 404 Not Found, 403 Forbidden)
          const errorData = await response.json().catch(() => null); // Try to parse error details
          throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
        } else {
          // Unexpected success status code other than 204
          console.warn(`Unexpected success status code: ${response.status}`);
          setLoading(false);
          return true; // Consider it successful? Or handle differently?
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting habit'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    createHabit,
    fetchUserHabits,
    updateHabit,
    deleteHabit,
    loading,
    error,
  };
}
