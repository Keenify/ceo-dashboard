import { useState, useCallback } from 'react';

// Define the type for the data sent to the API
interface HabitBuddyPayload {
  user_id: string;
  buddy_email: string;
  censor_habits?: boolean;
}

// Define the type for the data received from the API
export interface HabitBuddyResponse {
  id: string;
  user_id: string;
  buddy_email: string;
  censor_habits: boolean;
  created_at: string; // ISO date string
}

// Define update payload type
interface HabitBuddyUpdatePayload {
  buddy_email?: string;
  censor_habits?: boolean;
}

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

const HABIT_BUDDIES_ENDPOINT = `${backendApiDomain}/habits/buddies`;

export function useHabitBuddies() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createHabitBuddy = useCallback(
    async (payload: HabitBuddyPayload): Promise<HabitBuddyResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(HABIT_BUDDIES_ENDPOINT, {
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

        const data: HabitBuddyResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while creating habit buddy'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchHabitBuddies = useCallback(
    async (userId: string): Promise<HabitBuddyResponse[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABIT_BUDDIES_ENDPOINT}?user_id=${userId}`;
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

        const data: HabitBuddyResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching habit buddies'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const updateHabitBuddy = useCallback(
    async (buddyId: string, payload: HabitBuddyUpdatePayload): Promise<HabitBuddyResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABIT_BUDDIES_ENDPOINT}/${buddyId}`;
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

        const data: HabitBuddyResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating habit buddy'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteHabitBuddy = useCallback(
    async (buddyId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABIT_BUDDIES_ENDPOINT}/${buddyId}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Accept': '*/*',
          },
        });

        if (response.status === 204) {
          setLoading(false);
          return true;
        } else if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
        } else {
          setLoading(false);
          return true;
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting habit buddy'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  const sendAccountabilityEmail = useCallback(
    async (buddyId: string, userId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${HABIT_BUDDIES_ENDPOINT}/${buddyId}/send-email?user_id=${userId}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setLoading(false);
        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while sending email';
        setError(err instanceof Error ? err : new Error(errorMessage));
        setLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  return {
    createHabitBuddy,
    fetchHabitBuddies,
    updateHabitBuddy,
    deleteHabitBuddy,
    sendAccountabilityEmail,
    loading,
    error,
  };
} 