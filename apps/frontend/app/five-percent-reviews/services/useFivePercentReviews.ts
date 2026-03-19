import { useState, useCallback } from 'react';
import { Database } from '@/lib/database.types';

type FivePercentReview = Database['public']['Tables']['five_percent_reviews']['Row'];
type FivePercentReviewInsert = Database['public']['Tables']['five_percent_reviews']['Insert'];
type FivePercentReviewUpdate = Database['public']['Tables']['five_percent_reviews']['Update'];

// Define the type for the data sent to the API
export interface FivePercentReviewPayload extends Omit<FivePercentReviewInsert, 'id' | 'created_at' | 'updated_at'> {}

// Define the type for the data received from the API
export interface FivePercentReviewResponse extends FivePercentReview {}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const FIVE_PERCENT_REVIEWS_ENDPOINT = `${backendApiDomain}/five-percent-reviews/`;

export function useFivePercentReviews() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createFivePercentReview = useCallback(
    async (payload: FivePercentReviewPayload): Promise<FivePercentReviewResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(FIVE_PERCENT_REVIEWS_ENDPOINT, {
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

        const data: FivePercentReviewResponse = await response.json();
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

  const updateFivePercentReview = useCallback(
    async (id: string, userId: string, payload: Partial<FivePercentReviewPayload>): Promise<FivePercentReviewResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${FIVE_PERCENT_REVIEWS_ENDPOINT}${id}?user_id=${userId}`, {
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

        const data: FivePercentReviewResponse = await response.json();
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

  const fetchUserReviews = useCallback(
    async (userId: string, limit: number = 100, skip: number = 0): Promise<FivePercentReviewResponse[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${FIVE_PERCENT_REVIEWS_ENDPOINT}?user_id=${userId}`;
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

        const data: FivePercentReviewResponse[] = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching reviews'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const getReviewById = useCallback(
    async (reviewId: string, userId: string): Promise<FivePercentReviewResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = `${FIVE_PERCENT_REVIEWS_ENDPOINT}${reviewId}?user_id=${userId}`;
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

        const data: FivePercentReviewResponse = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching review'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  const deleteReview = useCallback(
    async (reviewId: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${FIVE_PERCENT_REVIEWS_ENDPOINT}${reviewId}?user_id=${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        setLoading(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting review'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    createFivePercentReview,
    updateFivePercentReview,
    fetchUserReviews,
    getReviewById,
    deleteReview,
    loading,
    error,
  };
} 