import { useState, useCallback } from 'react';
import { Database } from '@/lib/database.types';

// Define types using the Database interface
export type FutureLetterResponse = Database['public']['Tables']['future_letters']['Row'];
export type FutureLetterPayload = Database['public']['Tables']['future_letters']['Insert'];
export type FutureLetterUpdatePayload = Database['public']['Tables']['future_letters']['Update'];

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const FUTURE_LETTERS_ENDPOINT = `${backendApiDomain}/future-letters/`;

export function useFutureLetters() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createFutureLetter = useCallback(
    async (payload: FutureLetterPayload): Promise<FutureLetterResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        // Ensure attachment_urls is an array
        if (payload.attachment_urls === null || payload.attachment_urls === undefined) {
          payload.attachment_urls = [];
        }
        
        const response = await fetch(FUTURE_LETTERS_ENDPOINT, {
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

        const data: FutureLetterResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during creation'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const updateFutureLetter = useCallback(
    async (id: string, userId: string, payload: FutureLetterUpdatePayload): Promise<FutureLetterResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        // Ensure attachment_urls is an array
        if (payload.attachment_urls === null || payload.attachment_urls === undefined) {
          payload.attachment_urls = [];
        }
        
        const response = await fetch(`${FUTURE_LETTERS_ENDPOINT}${id}?user_id=${userId}`, {
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

        const data: FutureLetterResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred during update'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const fetchUserLetters = useCallback(
    async (userId: string, limit: number = 100, skip: number = 0): Promise<FutureLetterResponse[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${FUTURE_LETTERS_ENDPOINT}?user_id=${userId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLoading(false);
            return [];
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FutureLetterResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching letters'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const getLetterById = useCallback(
    async (letterId: string, userId: string): Promise<FutureLetterResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${FUTURE_LETTERS_ENDPOINT}${letterId}?user_id=${userId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLoading(false);
            return null;
          }
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: FutureLetterResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching letter'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteLetter = useCallback(
    async (letterId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${FUTURE_LETTERS_ENDPOINT}${letterId}?user_id=${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        setLoading(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting letter'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    createFutureLetter,
    updateFutureLetter,
    fetchUserLetters,
    getLetterById,
    deleteLetter,
    loading,
    error,
  };
}
