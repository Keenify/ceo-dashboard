import { useState, useCallback } from 'react';

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const HABITS_ENDPOINT = `${backendApiDomain}/habits`;

// Define the type for the data received from the API
export interface HabitStreakResponse {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  total_streak: number;
  last_entry_date: string | null; // Date can be null if no entries yet
  last_value: number | null; // Value can be null
}

/**
 * Custom hook for fetching habit streak data.
 */
export function useHabitStreaks() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches the current and longest streak for a specific habit.
   * @param habitId - The ID of the habit.
   * @returns The streak data or null if an error occurred.
   */
  const fetchHabitStreak = useCallback(
    async (habitId: string): Promise<HabitStreakResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABITS_ENDPOINT}/${habitId}/streak`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          // Handle cases like 404 Not Found if streak calculation hasn't run or habit doesn't exist
          if (response.status === 404) {
              console.warn(`Streak data not found for habit ${habitId}. Maybe no entries yet?`);
              // Return a default-like object or null, depending on desired behavior
              setLoading(false);
              return null; // Or return a default structure like { habit_id: habitId, current_streak: 0, ... }
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: HabitStreakResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching habit streak'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  return {
    fetchHabitStreak,
    loading,
    error,
  };
}
